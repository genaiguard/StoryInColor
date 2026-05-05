import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import StripeImport from 'stripe';
// In stripe-node v22+, the top-level "stripe" ambient module was removed
// (see CHANGELOG 22.0.0). The runtime constructor still imports cleanly
// as the default export above, but the namespace types (Stripe.Event,
// Stripe.Checkout.Session, Stripe.Checkout.SessionCreateParams, etc.)
// only live inside stripe.core. Type-only deep import gives us those
// types back without bundling internals at runtime.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Stripe } from 'stripe/cjs/stripe.core.js';
import { defineSecret } from 'firebase-functions/params';
import { sendWelcomeEmail, sendContactFormEmail } from './email-service';
import { CREDIT_PACKAGES } from './credit-packages';
import { dispatchServerConversion } from './conversions/dispatch';
import type { ServerUserData } from './conversions/types';
import { handleQuizPurchase } from './quiz-webhook-handler';

// Quiz funnel callables (additive — see QUIZ-PIVOT-SPEC.md §8.1).
// Re-exporting from index so `firebase deploy --only functions` picks them up.
export { generateForToolUnauth } from './generate-for-tool-unauth';
export {
  captureQuizEmail,
  createQuizCheckoutSession,
  getQuizPaywallStatus,
} from './quiz-checkout';
export { cleanupExpiredPendingReadings } from './cleanup-pending-readings';
export {
  dispatchDailyReflections,
  generateReflectionPreview,
} from './daily-reflections';

// Version log - update this to verify deployments
console.log('Cloud Functions initializing - OpenAI Integration Version');

// Define secrets - Use UPPER_SNAKE_CASE for variable names too
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const AWS_ACCESS_KEY_ID = defineSecret('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = defineSecret('AWS_SECRET_ACCESS_KEY');
// AWS_REGION is NOT a secret — region strings are public. Lives in
// functions/.env and is read via process.env.AWS_REGION inside email-service.ts.
const SENDER_EMAIL_ADDRESS = defineSecret('SENDER_EMAIL_ADDRESS');
// Server-side conversion forwarding (Phase 4). Only consumed by the
// dispatchServerConversion helper, which reads them via process.env at
// call time. Marking them as Firebase secrets here ensures they're injected
// into the function runtime; setting their values is a separate
// `firebase functions:secrets:set <NAME>` step.
const META_CAPI_TOKEN = defineSecret('META_CAPI_TOKEN');
const GA4_MP_API_SECRET = defineSecret('GA4_MP_API_SECRET');
// Initialize Firebase Admin (guarded — quiz-funnel modules also self-init
// because ES module imports hoist ahead of this line; without the guard,
// Firebase throws app/duplicate-app on the second call).
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore(); // Initialize Firestore globally here
const auth = admin.auth();    // Initialize Auth globally here

/**
 * Handles Stripe webhook events
 */
export const stripeWebhook = onRequest(
  {
    secrets: [
      STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET,
      // AWS secrets for email services (region is now in functions/.env, not a secret)
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      SENDER_EMAIL_ADDRESS,
      // Server-side conversion mirroring (Phase 4). Bound here so the
      // runtime env exposes them to dispatchServerConversion.
      META_CAPI_TOKEN,
      GA4_MP_API_SECRET,
    ],
    invoker: 'public'
  },
  async (req, res) => {
      console.log("[Webhook] Received request.");
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
          console.warn('[Webhook Error] Missing stripe-signature header.');
          res.status(400).send('Bad Request - Missing stripe-signature header.');
          return;
      }

      try {
          console.log("[Webhook] Initializing Stripe client for verification.");
          const stripeKey = STRIPE_SECRET_KEY.value();

          // Fail loudly on a malformed secret. The previous version stripped
          // non-ASCII chars and continued — that masks real misconfiguration
          // (e.g. a paste-in error with a zero-width space) and runtime-
          // mutating a secret value is never the right answer.
          if (!/^sk_(live|test)_[A-Za-z0-9_]+$/.test(stripeKey)) {
            const len = stripeKey.length;
            console.error(`[Webhook] STRIPE_SECRET_KEY format invalid (length=${len}). Re-set the secret in Secret Manager.`);
            throw new Error('STRIPE_SECRET_KEY format invalid');
          }
          // Sanitized prefix for cross-referencing logs without leaking the key.
          console.log(`[Webhook] Stripe secret prefix: ${stripeKey.substring(0, 8)}... (length: ${stripeKey.length})`);
          
          const stripe = new StripeImport(stripeKey, {
            apiVersion: '2026-04-22.dahlia',
          });

          let event: Stripe.Event;
          try {
              // Use rawBody for verification
              const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
              console.log("[Webhook] Constructing event...");
              
              // Trim the webhook secret to remove any whitespace
              const webhookSecret = STRIPE_WEBHOOK_SECRET.value().trim();
              console.log(`[Webhook] Using webhook secret (length: ${webhookSecret.length})`);
              
              event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
              console.log(`[Webhook] Event constructed successfully: ${event.id}, Type: ${event.type}`);
          } catch (err) {
              console.error('[Webhook Error] Signature verification failed:', err);
              res.status(400).send('Webhook Error - Signature verification failed.');
              return;
          }

          // Handle the checkout.session.completed event
          if (event.type === 'checkout.session.completed') {
              const session = event.data.object as Stripe.Checkout.Session;
              // Log only PII-free fields. The full session object contains
              // customer_email, customer_details (name + billing address),
              // and payment_intent — those go to Cloud Logging on every
              // checkout and would persist for ~30 days. If you need the
              // full session for one-off debugging, fetch it from Stripe's
              // dashboard by session.id rather than logging it routinely.
              console.log(`[Webhook] checkout.session.completed`, {
                sessionId: session.id,
                paymentStatus: session.payment_status,
                paymentMethod: session.payment_method_types?.join(', '),
                metadataType: session.metadata?.type,
                packageId: session.metadata?.packageId,
              });

              // Check if this is a credit purchase
              if (session.metadata?.type === 'credit_purchase') {
                  // Handle credit purchase
                  console.log(`[Webhook] Processing credit purchase`);

              const userId = session.metadata?.userId;
                  const packageId = session.metadata?.packageId;
                  const creditAmount = session.metadata?.creditAmount ? parseInt(session.metadata.creditAmount, 10) : 0;
                  const priceInCents = session.metadata?.priceInCents ? parseInt(session.metadata.priceInCents, 10) : 0;
                  
                  if (!userId || !packageId || creditAmount <= 0) {
                      console.error('[Webhook Error] Missing userId, packageId, or valid creditAmount in session metadata.', session.metadata);
                      res.status(200).send({ received: true, error: 'Missing required metadata for credit purchase' });
                  return;
              }
                  
                  // Only process if payment is successful
                  if (session.payment_status === 'paid') {
                      // Idempotency: dedupe on Stripe event id so retried/replayed
                      // checkout.session.completed deliveries cannot double-grant.
                      // The marker write + credit grant happen in one transaction;
                      // a transient Firestore failure throws and we return 500
                      // (Stripe will retry, the marker prevents the retry from
                      // double-granting).
                      const stripeEventId = event.id;
                      try {
                          const grantResult = await db.runTransaction(async (tx) => {
                              const markerRef = db.collection('processedStripeEvents').doc(stripeEventId);
                              const markerSnap = await tx.get(markerRef);
                              if (markerSnap.exists) {
                                  console.log(`[Webhook] Stripe event ${stripeEventId} already processed; skipping credit grant.`);
                                  return { granted: false, reason: 'already-processed' as const };
                              }

                              const userCreditsRef = db.collection('userCredits').doc(userId);
                              const userCreditsSnap = await tx.get(userCreditsRef);
                              const purchaseEntry = {
                                  packageId,
                                  creditAmount,
                                  pricePaid: priceInCents,
                                  purchaseDate: new Date(),
                                  stripeEventId,
                                  stripeSessionId: session.id,
                              };
                              if (!userCreditsSnap.exists) {
                                  tx.set(userCreditsRef, {
                                      balance: creditAmount,
                                      used: 0,
                                      purchaseHistory: [purchaseEntry],
                                      // usageHistory array intentionally omitted — usage now lives in the
                                      // userCredits/{uid}/usageEvents subcollection (see credit-ledger.ts).
                                      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                                  });
                              } else {
                                  tx.update(userCreditsRef, {
                                      balance: admin.firestore.FieldValue.increment(creditAmount),
                                      purchaseHistory: admin.firestore.FieldValue.arrayUnion(purchaseEntry),
                                      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                                  });
                              }

                              // Set expireAt 90 days out so Firestore TTL
                              // service auto-deletes the marker. Stripe
                              // retries deliveries for at most 3 days, so
                              // 90 days is comfortable. TTL is configured
                              // via fieldOverrides in firestore.indexes.json.
                              const expireAt = admin.firestore.Timestamp.fromMillis(
                                  Date.now() + 90 * 24 * 60 * 60 * 1000,
                              );
                              tx.set(markerRef, {
                                  stripeEventId,
                                  stripeSessionId: session.id,
                                  userId,
                                  packageId,
                                  creditAmount,
                                  priceInCents,
                                  processedAt: admin.firestore.FieldValue.serverTimestamp(),
                                  expireAt,
                              });

                              return { granted: true, reason: 'processed' as const };
                          });

                          if (grantResult.granted) {
                              console.log(`[Credits] Successfully added ${creditAmount} credits for user ${userId} (stripe_event=${stripeEventId})`);
                          }

                          // Phase 4: server-side Purchase mirror to Meta CAPI + GA4 MP.
                          // Wrapped in its own try/catch so a tracker failure doesn't
                          // 500 the webhook (Stripe would then retry the credit grant).
                          //
                          // Gate on grantResult.granted: Meta CAPI dedupes via the
                          // shared event_id, but GA4 Measurement Protocol does NOT,
                          // so firing on a Stripe retry would double-count Purchase
                          // in GA4. Only emit when the credit grant just happened.
                          if (grantResult.granted) try {
                              const fbEventIdFromMeta = session.metadata?.fbEventId;
                              const eventId =
                                  (typeof fbEventIdFromMeta === 'string' && fbEventIdFromMeta.length > 0)
                                      ? fbEventIdFromMeta
                                      : `srv-purchase-${session.id}`;
                              // Pull cookies + GA client_id from users/{uid}.attribution
                              // (set by lib/attribution/persist.ts at signup time).
                              let userData: ServerUserData = {
                                  email: session.customer_details?.email || session.customer_email || undefined,
                                  uid: userId,
                              };
                              try {
                                  const userDoc = await db.collection('users').doc(userId).get();
                                  const attribution = userDoc.data()?.attribution as
                                      | { fbp?: string; fbc?: string; gaClientId?: string }
                                      | undefined;
                                  if (attribution) {
                                      userData = {
                                          ...userData,
                                          fbp: attribution.fbp || undefined,
                                          fbc: attribution.fbc || undefined,
                                          gaClientId: attribution.gaClientId || undefined,
                                      };
                                  }
                              } catch (attrErr) {
                                  console.warn('[Conversions] Could not load user attribution; proceeding with reduced match quality:', attrErr);
                              }
                              const dispatched = await dispatchServerConversion(
                                  {
                                      name: 'Purchase',
                                      eventId,
                                      customData: {
                                          currency: 'USD',
                                          value: priceInCents / 100,
                                          content_ids: [packageId],
                                          content_name: 'Credit Purchase',
                                          content_category: 'credits',
                                          num_items: creditAmount,
                                          transaction_id: session.id,
                                      },
                                  },
                                  userData,
                              );
                              console.log('[Conversions] Purchase dispatch result:', JSON.stringify(dispatched));
                          } catch (convErr) {
                              console.error('[Conversions] Server-side Purchase mirror failed (non-fatal):', convErr);
                          }
                      } catch (error) {
                          // Transient Firestore failure: return 500 so Stripe
                          // retries the webhook (default backoff up to 3 days).
                          // The processedStripeEvents marker is part of the same
                          // transaction so a successful retry will not double-grant.
                          console.error(`[Credits Error] Failed to grant credits transactionally: ${error}`);
                          res.status(500).send({ received: false, error: 'Transient failure granting credits; please retry.' });
                          return;
                               }
                          } else {
                      console.log(`[Credits] Payment not completed: ${session.payment_status}`);
                  }
                  
                  // Acknowledge receipt of the event
                  res.status(200).send({ received: true, type: 'credit_purchase' });
                  return;
              } else if (session.metadata?.type === 'quiz_purchase') {
                  // Quiz funnel purchase (per QUIZ-PIVOT-SPEC.md §3.3.4).
                  // Materializes account, claims pending reading, grants
                  // sub allowance or one-time credit. Idempotent on event.id.
                  console.log(`[Webhook] Processing quiz_purchase`);
                  try {
                      const handlerResult = await handleQuizPurchase({
                          event,
                          session,
                          stripe,
                      });
                      console.log(`[QuizWebhook] result:`, JSON.stringify(handlerResult));
                      res.status(200).send({ received: true, type: 'quiz_purchase', ...handlerResult });
                      return;
                  } catch (qpErr) {
                      console.error(`[QuizWebhook Error]`, qpErr);
                      // Return 500 so Stripe retries — handleQuizPurchase
                      // is idempotent on Stripe event id.
                      res.status(500).send({ received: false, error: 'Transient failure processing quiz purchase; please retry.' });
                      return;
                  }
                  } else {
                  // Unknown checkout type
                  console.log(`[Webhook] Unrecognized checkout type. Session ID: ${session.id}`);
                  res.status(200).send({ received: true, type: 'unknown' });
                  return;
              }
          } else if (
              event.type === 'customer.subscription.updated' ||
              event.type === 'customer.subscription.deleted' ||
              event.type === 'invoice.paid'
          ) {
              // Quiz funnel subscription lifecycle (per QUIZ-PIVOT-SPEC.md §17.6, §8.7).
              // Lazy-imported so the file doesn't grow unbounded; pure additive branch.
              try {
                  const { handleSubscriptionLifecycleEvent } = await import('./quiz-subscription-events');
                  await handleSubscriptionLifecycleEvent(event);
              } catch (subErr) {
                  console.warn('[Webhook] Subscription lifecycle handler failed (non-fatal):', subErr);
              }
              res.status(200).send({ received: true, type: event.type });
              return;
          } else {
              // Other event types can be handled here if needed
              console.log(`[Webhook] Received non-checkout event: ${event.type}`);
              res.status(200).send({ received: true, type: event.type });
              return;
          }
      } catch (error) {
          console.error('[Webhook Error] Failed to process webhook:', error);
          if (error instanceof Error) {
            console.error('[Webhook Error Details]', error.message);
          }
          res.status(500).send({ error: 'Internal server error during webhook processing' });
          return;
      }
  }
);

// Callable function to send welcome email (to be called after user registration)
export const sendWelcomeEmailNotification = onCall({
  secrets: [
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    SENDER_EMAIL_ADDRESS,
  ],
}, async (request) => {
  // Verbose logging for debugging
  console.log('[Email Debug] Welcome email function called. Request Auth:', JSON.stringify(request.auth));
  console.log('[Email Debug] Request Data:', JSON.stringify(request.data));
  
  // console.log('[Email Debug] Using AWS credentials:', {
  //   region: AWS_REGION.value(),
  //   sender: SENDER_EMAIL_ADDRESS.value(),
  //   keyIdPrefix: AWS_ACCESS_KEY_ID.value().substring(0, 5) + '...' // Log only the prefix for security
  // });
  
  // Verify authentication
  if (!request.auth || !request.auth.token) {
    console.error('[Email] Unauthorized attempt to send welcome email or token missing.');
    throw new HttpsError('unauthenticated', 'User must be authenticated and token must be present.');
  }
  
  // Get user details
  const userEmail = request.auth.token.email;
  if (!userEmail) {
    console.error('[Email] User email is required but not found in auth token');
    throw new HttpsError('invalid-argument', 'User email not found in auth token.');
  }
  
  // Prioritize displayName from client data, then from auth token.
  let finalDisplayName = request.data?.displayName || request.auth.token.name;
  
  console.log(`[Email Debug] Attempting to use displayName: '${finalDisplayName}' for user: ${userEmail}. request.data?.displayName was '${request.data?.displayName}', request.auth.token.name was '${request.auth.token.name}'.`);

  // The email-service's sendWelcomeEmail function has its own fallback "there" if finalDisplayName is undefined or empty.

  try {
    // Pass the determined email and displayName to the email service
    const success = await sendWelcomeEmail(userEmail, finalDisplayName); 
    if (success) {
      console.log(`[Email] Welcome email successfully queued for ${userEmail}`);
      return { success: true, message: "Welcome email sent." };
    } else {
      console.error(`[Email] sendWelcomeEmail returned false for ${userEmail}. Check email-service logs.`);
      throw new HttpsError('internal', 'Failed to send welcome email via email service.');
    }
  } catch (error: any) {
    console.error(`[Email] Error in sendWelcomeEmailNotification for ${userEmail}:`, error.message, error.stack);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', `Error processing welcome email: ${error.message}`);
  }
});

// Callable function to submit contact form
export const submitContactForm = onCall({
  secrets: [
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    SENDER_EMAIL_ADDRESS,
  ],
}, async (request) => {
  // Extract data from request
  const { name, email, subject, message } = request.data;
  
  // Validate input
  if (!name || !email || !subject || !message) {
    console.error('[Contact Form] Missing required information', request.data);
    throw new Error('Please fill in all required fields');
  }
  
  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('[Contact Form] Invalid email format:', email);
    throw new Error('Please enter a valid email address');
  }
  
  console.log(`[Contact Form] Processing submission from ${name} (${email})`);
  
  try {
    // Send contact form email
    const result = await sendContactFormEmail(name, email, subject, message);
    
    if (result) {
      console.log(`[Contact Form] Successfully sent message from ${email}`);
      return { success: true, message: 'Your message has been sent. We will get back to you soon!' };
    } else {
      console.error(`[Contact Form] Failed to send message from ${email}`);
      throw new Error('Failed to send your message. Please try again later.');
    }
  } catch (error) {
    console.error('[Contact Form] Error processing contact form:', error);
    throw new Error('An error occurred while processing your message. Please try again later.');
  }
});

/**
 * Creates a Stripe checkout session for credit purchase
 */
export const createCreditCheckout = onCall<{
  packageId: string;
  origin?: string;
  fbEventId?: string;
  returnPath?: string;
}>(
  {
    secrets: [STRIPE_SECRET_KEY],
    labels: {
      "deployment-callable": "true"
    }
  },
  async (request) => {
    console.log("[createCreditCheckout] Function called with request:", request.data);

    // Verify auth context is present
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to purchase credits');
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email;
    console.log(`[Auth] User authenticated: ${userId}`);

    // Extract packageId from data. fbEventId is the shared deduplication id
    // generated client-side at InitiateCheckout time. Phase 4 stripeWebhook
    // will pull it from session.metadata when firing the CAPI Purchase
    // mirror so Meta deduplicates with the client Pixel emit.
    const { packageId, origin, fbEventId, returnPath } = request.data;
    console.log("[Request Body] Received packageId:", packageId);
    console.log("[Request Body] Received origin:", origin);
    if (fbEventId) {
      console.log("[Request Body] Received fbEventId for CAPI dedup:", fbEventId);
    }

    // Validate packageId
    if (!packageId) {
      console.error('[Validation Error] Missing required field: packageId');
      throw new HttpsError('invalid-argument', 'Missing required field: packageId');
    }

    try {
      // Find the credit package
      const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
      if (!creditPackage) {
        console.error(`[Validation Error] Invalid credit package: ${packageId}`);
        throw new HttpsError('invalid-argument', 'Invalid credit package selected');
      }
      
      // Initialize Stripe
      console.log("[Stripe] Initializing Stripe client.");
      const stripeKey = STRIPE_SECRET_KEY.value();

      // Fail loudly on a malformed secret rather than silently mutating it.
      if (!/^sk_(live|test)_[A-Za-z0-9_]+$/.test(stripeKey)) {
        console.error(`[Stripe] STRIPE_SECRET_KEY format invalid (length=${stripeKey.length}). Re-set the secret in Secret Manager.`);
        throw new HttpsError('failed-precondition', 'Stripe is not configured correctly. Please contact support.');
      }
      console.log(`[Stripe] Secret prefix: ${stripeKey.substring(0, 8)}... (length: ${stripeKey.length})`);
      
      // Pin the API version explicitly. SDK 22.x defaults to
      // 2026-04-22.dahlia which is the version that introduced the
      // session-level `branding_settings` parameter we use below.
      const stripe = new StripeImport(stripeKey, {
        apiVersion: '2026-04-22.dahlia',
      });

      // Create product name and description.
      // User-facing vocabulary is "reading", not "credits" — this name shows
      // up on the Stripe Checkout page, the customer's bank statement, and
      // the receipt/invoice. Keeping it consistent with the site copy
      // reduces "what did I buy?" support inquiries and refund disputes.
      // The internal ledger field is still called `credits` (1 credit ==
      // 1 reading) — see DECISIONS.md "Copy rules".
      const readingLabel = creditPackage.credits === 1 ? "Reading" : "Readings";
      const productName = `${creditPackage.credits} ${readingLabel}`;
      const productDescription = `${creditPackage.credits} editorial photo ${readingLabel.toLowerCase()} on StoryInColor (${creditPackage.discountPercentage}% discount)`;

      // Create line items
      const lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            description: productDescription,
          },
          unit_amount: creditPackage.price,
        },
        quantity: 1,
      }];
      console.log("[Stripe] Prepared line items.");

      // Determine domain for success/cancel URLs - use provided origin or default to production
      const domain = origin || 'https://storyincolor.com';
      console.log(`[Stripe] Using domain for redirects: ${domain}`);
      // Optional same-site path to return visitors to the reading they were
      // trying to start. Do not accept absolute/protocol-relative URLs.
      const safeReturnPath =
        typeof returnPath === 'string' &&
        returnPath.startsWith('/') &&
        !returnPath.startsWith('//') &&
        !returnPath.startsWith('/\\') &&
        !/[\r\n]/.test(returnPath)
          ? returnPath
          : null;
      const appendQuery = (path: string, query: string) =>
        `${path}${path.includes('?') ? '&' : '?'}${query}`;
      const successPath = safeReturnPath
        ? appendQuery(safeReturnPath, 'credit_purchase=success')
        : '/dashboard?credit_purchase=success';
      // No cancelPath — embedded checkout has no Stripe-side "cancel"
      // step; closing the modal is the cancel action, handled entirely
      // client-side. The session expires after 24h if unused.
      
      // Create the embedded Checkout Session.
      //
      // ui_mode: "embedded" renders the Stripe payment form inside an
      // iframe on /credits via @stripe/react-stripe-js
      // (EmbeddedCheckoutProvider + EmbeddedCheckout). The user never
      // leaves storyincolor.com. The webhook event is still
      // `checkout.session.completed`, so the fulfilment pipeline
      // (idempotency marker + credit grant transaction + Phase-4 CAPI
      // Purchase mirror) is unchanged.
      //
      // We deliberately omit `payment_method_types` so Stripe surfaces
      // EVERY method enabled at the account level — Apple Pay, Google
      // Pay, Link (one-click), card, and any wallet/BNPL options. With
      // ~72% of our traffic on mobile, native-wallet coverage is the
      // largest single checkout-layer lift available. Apple Pay alone
      // is published as +22% global / +58% mobile vs card-only forms;
      // Stripe Link adds +14% on repeat customers.
      //
      // `payment_method_options.card` stays — it only applies when card
      // is the chosen method, and it preserves 3DS automatic + future
      // off-session use (for refund-able re-charges).
      //
      // `return_url` (not success_url/cancel_url) is required for
      // embedded mode. Stripe sends the user there only for redirect-
      // based payment methods (3DS challenge, bank wallets); for card
      // without redirect, the embedded checkout's onComplete fires
      // in-page and the client navigates to the same URL itself.
      // Either way the landing URL is the same `/dashboard?credit_
      // purchase=success` so the dashboard polling pipeline catches
      // both paths.
      console.log("[Stripe] Creating embedded checkout session...");
      const session = await stripe.checkout.sessions.create({
        // API version 2026-04-22.dahlia renamed the UiMode enum values:
        // "embedded" → "embedded_page", "hosted" → "hosted_page",
        // "custom" → "elements". Same behavior, new label.
        ui_mode: 'embedded_page',
        // {CHECKOUT_SESSION_ID} is a Stripe-side template variable —
        // Stripe substitutes the real session id when redirecting.
        // The dashboard uses this id to call getCheckoutSessionStatus
        // and verify the payment actually succeeded before showing the
        // success-polling state. Without this, a user who cancels a
        // 3DS / bank-redirect flow lands on `?credit_purchase=success`
        // and the dashboard would show "your purchase is being
        // processed" even though no webhook will ever fire.
        return_url: `${domain}${appendQuery(successPath, 'session_id={CHECKOUT_SESSION_ID}')}`,
        // For card / Apple Pay / Google Pay / Link without 3DS, Stripe
        // fires the embedded checkout's onComplete callback in-page
        // and the client navigates to the success URL. Only redirect-
        // requiring methods (3DS, bank wallets) hit the return_url.
        // Default is 'always' which would force a redirect even for
        // simple card payments, defeating the modal's onComplete path.
        redirect_on_completion: 'if_required',
        // Per-session brand override. Defaults come from the Stripe
        // Dashboard's Branding settings; we override here so the
        // embedded iframe matches the dark editorial brand exactly
        // without requiring the dashboard to be reconfigured. Hex
        // values mirror the site's CARD_BG / primary CTA. Inter font
        // matches the rest of the site (next/font/google in
        // app/layout.tsx). 'rounded' is the closest preset to our
        // rounded-2xl utility.
        branding_settings: {
          display_name: 'StoryInColor',
          background_color: '#0a0a0a',
          button_color: '#ffffff',
          font_family: 'inter',
          border_style: 'rounded',
        },
        payment_method_options: {
          card: {
            setup_future_usage: 'off_session',
            request_three_d_secure: 'automatic',
          },
        },
        payment_intent_data: {
          capture_method: 'automatic',
        },
        billing_address_collection: 'auto',
        line_items: lineItems,
        mode: 'payment',
        locale: 'en',
        client_reference_id: userId,
        customer_email: userEmail || undefined,
        metadata: {
          userId,
          packageId,
          creditAmount: String(creditPackage.credits),
          priceInCents: String(creditPackage.price),
          type: 'credit_purchase',
          // Shared dedup id for Meta CAPI mirror in stripeWebhook. Empty
          // string when caller didn't supply one (e.g. an older client) —
          // stripeWebhook generates a fallback id in that case.
          fbEventId: fbEventId || '',
        },
      });
      console.log(`[Stripe] Embedded checkout session created: ${session.id}`);

      // Return shape: clientSecret powers EmbeddedCheckoutProvider on
      // the client. sessionId is also returned for analytics / logging
      // continuity, and `cancelPath` doesn't apply in embedded mode
      // (the user just closes the modal to cancel — no Stripe-side
      // cancel URL is involved).
      return {
        sessionId: session.id,
        clientSecret: session.client_secret,
      };

    } catch (error) {
      console.error('[Stripe Error] Failed to create checkout session:', error);
      if (error instanceof Error && 'type' in error) {
          console.error('[Stripe Error Details]', { type: (error as any).type, code: (error as any).code, message: error.message });
      }
      throw new HttpsError('internal', 'Failed to create checkout session');
    }
  }
);

/**
 * Returns the lifecycle status of a Checkout Session by id.
 *
 * Why this exists: with `ui_mode: "embedded_page"` and
 * `redirect_on_completion: "if_required"`, redirect-based payment
 * methods (3DS challenge, bank-redirect wallets) send the user to the
 * session's `return_url` AFTER auth — but Stripe also sends them there
 * on cancel/failure. The return URL appends `?credit_purchase=success`
 * unconditionally, so without verifying session status the dashboard
 * would show the "purchase processing" polling state for a payment
 * that will never produce a `checkout.session.completed` webhook.
 *
 * The dashboard calls this on mount whenever it sees `?session_id=...`
 * in the URL, BEFORE engaging the polling pipeline:
 *   - status="complete" + payment_status="paid" → real success, poll
 *     for credits as before
 *   - status="open" or "expired" → user cancelled / session timed
 *     out → dashboard shows "payment didn't complete, try again"
 *   - any retrieval error → fall back to existing polling behaviour
 *     (safer to assume success-path on error than to block a paying
 *     customer)
 *
 * Auth-gated to the user who owns the session: we verify the session's
 * `client_reference_id` matches the calling uid before returning, so a
 * malicious client can't fish for arbitrary session payment statuses.
 */
export const getCheckoutSessionStatus = onCall<{ sessionId: string }>(
  {
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const userId = request.auth.uid;
    const { sessionId } = request.data;
    if (!sessionId || typeof sessionId !== 'string') {
      throw new HttpsError('invalid-argument', 'sessionId is required');
    }
    // Defensive: Stripe session ids look like "cs_test_..." or "cs_live_...".
    // Reject anything that doesn't fit so we don't issue arbitrary lookups.
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      throw new HttpsError('invalid-argument', 'Invalid sessionId format');
    }

    try {
      const stripeKey = STRIPE_SECRET_KEY.value();
      if (!/^sk_(live|test)_[A-Za-z0-9_]+$/.test(stripeKey)) {
        throw new HttpsError(
          'failed-precondition',
          'Stripe is not configured correctly. Please contact support.',
        );
      }
      const stripe = new StripeImport(stripeKey, {
        apiVersion: '2026-04-22.dahlia',
      });

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Owner check: session.client_reference_id was set to the user's
      // uid when the session was created (see createCreditCheckout
      // above). If it doesn't match the caller's uid, deny — otherwise
      // any signed-in user could probe arbitrary session statuses.
      if (session.client_reference_id !== userId) {
        console.warn(
          `[getCheckoutSessionStatus] uid ${userId} attempted to read session ${sessionId} owned by ${session.client_reference_id}`,
        );
        throw new HttpsError('permission-denied', 'Not your session.');
      }

      return {
        status: session.status, // "open" | "complete" | "expired"
        paymentStatus: session.payment_status, // "no_payment_required" | "paid" | "unpaid"
        packageId: session.metadata?.packageId ?? null,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('[getCheckoutSessionStatus] retrieval failed:', error);
      throw new HttpsError(
        'internal',
        'Could not verify checkout session status.',
      );
    }
  },
);

// --- Type Definitions for Admin Dashboard ---
interface AggregatedStats {
  totalUsers: number;
  totalRevenue: number; // In dollars
  payingCustomers: number;
  totalUploads: number;
  completedGenerations: number;
  failedGenerations: number;
}

interface UserGenerationSummary {
  id: string;
  toolId: string;
  status: string;
  createdAt: string | null;
}

// Mirrors lib/attribution/types.ts on the client side. The two npm trees
// don't share modules (see CLAUDE.md), so this is duplicated by hand. Keep
// field names + shape identical or the admin payload will desync.
interface AttributionTouch {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrer: string | null;
  landingPath: string;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  capturedAt: string;
}

interface UserAttributionPayload {
  firstTouch: AttributionTouch | null;
  lastTouch: AttributionTouch | null;
  anonId: string | null;
  gaClientId: string | null;
  fbp: string | null;
  fbc: string | null;
  clarityCustomId: string | null;
}

interface EnrichedUser {
  id: string; // Firebase Auth UID
  email: string | null;
  displayName: string | null;
  createdAt: string; // ISO string format (User creation)
  disabled: boolean; // Added Auth disabled status
  deleted: boolean; // Added Firestore deleted status
  creditBalance: number;
  totalSpent: number; // In dollars
  generationCount: number;
  failedGenerationCount: number;
  latestGenerationCreatedAt: string | null;
  generations: UserGenerationSummary[];
  // Attribution data persisted on signup by lib/attribution/persist.ts.
  // Null when the user signed up before attribution capture was deployed
  // (legacy users), or when localStorage + cookies were both empty (rare —
  // private mode + first-touch-only landing on a denylisted page).
  attribution: UserAttributionPayload | null;
}

/** Per-source funnel breakdown surfaced on the admin page. Computed by
 *  rolling up enrichedUsers in getAdminDashboardData. Only first-touch
 *  source is rolled up (last-touch is per-user noise; first-touch is what
 *  acquisition reports want). */
interface SourceFunnelRow {
  /** First-touch source label. "(unknown)" for users with no attribution. */
  source: string;
  /** Number of users whose first-touch source matches. */
  signups: number;
  /** Subset of signups who completed at least one reading. */
  activatedUsers: number;
  /** Subset of signups who paid at least once. */
  payingCustomers: number;
  /** Sum of totalSpent across users in this bucket (in dollars). */
  revenue: number;
  /** Sum of completed readings across users in this bucket. */
  completedReadings: number;
}

interface AdminDashboardData {
  success: boolean;
  aggregatedStats: AggregatedStats;
  users: EnrichedUser[];
  sourceBreakdown: SourceFunnelRow[];
  /** Quiz funnel rollup. Per QUIZ-PIVOT-SPEC.md §9.2. */
  quizFunnel?: {
    pendingReadingsByStatus: Record<string, number>;
    /** Last 7 days only — keeps the count meaningful as the corpus grows. */
    last7DaysCount: number;
    /** Distinct toolIds seen in last 7 days. */
    last7DaysByTool: Record<string, number>;
    /** Activated subscriptions (status=active|trialing). */
    activeSubscribers: number;
    /** Total subscribers with subscription field set (any status). */
    totalSubscribersEver: number;
  };
}

// --- Admin Dashboard Data Function (getAdminDashboardData - Enhanced) ---
export const getAdminDashboardData = onCall(
  {
    secrets: [], // Add secrets if needed later
    timeoutSeconds: 120, // Increased timeout for potentially large aggregations
    memory: '2GiB',    // Increased memory
  },
  async (request): Promise<AdminDashboardData> => {
    console.log("[getAdminDashboardData] Function called.");

    // 1. Verify admin authentication via the `admin: true` Firebase Auth
    // custom claim. To rotate admins, set the claim via Admin SDK — no
    // function redeploy needed. See CLAUDE.md § Admin for the recipe.
    const isAdminCaller =
      !!request.auth &&
      (request.auth.token as { admin?: boolean }).admin === true;
    if (!isAdminCaller) {
      console.error(`[Admin Dashboard] Unauthorized attempt by ${request.auth?.token.email || 'unauthenticated user'}.`);
      throw new HttpsError('permission-denied', 'Admin access required.');
    }
    console.log(`[Admin Dashboard] Admin user verified: ${request.auth!.token.email}`);

    let totalUsers = 0;
    let totalRevenueCents = 0;
    let payingCustomers = 0;
    let totalUploads = 0;
    let completedGenerations = 0;
    let failedGenerations = 0;
    const allAuthUsers: admin.auth.UserRecord[] = [];
    const userCreditSummaries = new Map<string, { balance: number; totalSpentCents: number }>();
    const userGenerationSummaries = new Map<string, { 
      generationCount: number; 
      failedGenerationCount: number;
      latestGenerationTimestamp: admin.firestore.Timestamp | null;
      generations: UserGenerationSummary[]; 
    }>();
    const userFirestoreData = new Map<string, { deleted: boolean; attribution: UserAttributionPayload | null }>(); // deleted flag + attribution from users/{uid}

    try {
      // 2. Aggregate Data & Build Summaries
      console.log("[Admin Dashboard] Starting data aggregation...");

      // --- Fetch All Users (Auth) & Count Total ---
      console.log("[Admin Dashboard] Fetching all users from Firebase Auth...");
      let pageToken: string | undefined;
      do {
        const listUsersResult = await auth.listUsers(1000, pageToken);
        totalUsers += listUsersResult.users.length;
        allAuthUsers.push(...listUsersResult.users);
        pageToken = listUsersResult.pageToken;
      } while (pageToken);
      console.log(`[Admin Dashboard] Fetched total ${totalUsers} users from Auth.`);

      // --- Fetch Firestore /users/{uid} docs (deleted flag + attribution) ---
      console.log("[Admin Dashboard] Fetching Firestore user docs (deleted + attribution)...");
      const usersSnapshot = await db.collection('users').get();
      usersSnapshot.forEach(doc => {
          const data = doc.data() || {};
          userFirestoreData.set(doc.id, {
            deleted: data.deleted || false,
            attribution: (data.attribution as UserAttributionPayload | undefined) ?? null,
          });
      });
      console.log(`[Admin Dashboard] Fetched user docs for ${userFirestoreData.size} users from Firestore.`);

      // --- Aggregate from userCredits & Build Summaries ---
      console.log("[Admin Dashboard] Aggregating from userCredits...");
      const userCreditsSnapshot = await db.collection('userCredits').get();
      userCreditsSnapshot.forEach(doc => {
        const data = doc.data();
        let userSpentCents = 0;
        let userPaid = false;
        if (data.purchaseHistory && Array.isArray(data.purchaseHistory)) {
          data.purchaseHistory.forEach((purchase: any) => {
            if (purchase.pricePaid && purchase.pricePaid > 0 && !purchase.isInitialCredits) {
              const price = Number(purchase.pricePaid) || 0;
              totalRevenueCents += price;
              userSpentCents += price;
              userPaid = true;
            }
          });
        }
        if (userPaid) {
          payingCustomers++;
        }
        userCreditSummaries.set(doc.id, {
          balance: data.balance || 0,
          totalSpentCents: userSpentCents,
        });
      });
      const totalRevenueDollars = totalRevenueCents / 100;
      console.log(`[Admin Dashboard] Aggregated Credits - Revenue: $${totalRevenueDollars.toFixed(2)}, Paying Customers: ${payingCustomers}`);

      // --- Aggregate from current generation jobs ---
      console.log("[Admin Dashboard] Aggregating from jobs collection group...");
      const jobsSnapshot = await db.collectionGroup('jobs').get();
      jobsSnapshot.forEach(doc => {
        const data = doc.data();
        const pathParts = doc.ref.path.split('/');
        const userId = pathParts.length > 1 ? pathParts[1] : null;
        const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;
        const status = typeof data.status === 'string' ? data.status : 'unknown';

        if (userId) {
           if (data.photoStoragePath || data.inputStoragePath) {
             totalUploads++;
           }

           if (status === 'complete') {
             completedGenerations++;
           }
           if (status === 'failed') {
             failedGenerations++;
           }

           const currentUserSummary = userGenerationSummaries.get(userId) || { 
               generationCount: 0, 
               failedGenerationCount: 0,
               latestGenerationTimestamp: null,
               generations: [] 
           };
           
           currentUserSummary.generationCount++;
           if (status === 'failed') {
             currentUserSummary.failedGenerationCount++;
           }

           if (createdAt && (!currentUserSummary.latestGenerationTimestamp || createdAt > currentUserSummary.latestGenerationTimestamp)) {
             currentUserSummary.latestGenerationTimestamp = createdAt;
           }

           if (currentUserSummary.generations.length < 10) {
                currentUserSummary.generations.push({ 
                    id: doc.id, 
                    toolId: data.toolId || 'unknown',
                    status,
                    createdAt: createdAt?.toDate().toISOString() || null,
                });
           }
           userGenerationSummaries.set(userId, currentUserSummary);
        }
      });
      console.log(`[Admin Dashboard] Aggregated Jobs - Uploads: ${totalUploads}, Completed: ${completedGenerations}, Failed: ${failedGenerations}`);

      // 3. Construct Enriched User List
      console.log("[Admin Dashboard] Constructing enriched user list...");
      const enrichedUsers: EnrichedUser[] = allAuthUsers.map(authUser => {
        const creditSummary = userCreditSummaries.get(authUser.uid) || { balance: 0, totalSpentCents: 0 };
        const generationSummary = userGenerationSummaries.get(authUser.uid) || { generationCount: 0, failedGenerationCount: 0, latestGenerationTimestamp: null, generations: [] };
        const firestoreUser = userFirestoreData.get(authUser.uid) || { deleted: false, attribution: null };

        return {
          id: authUser.uid,
          email: authUser.email || null,
          displayName: authUser.displayName || null,
          createdAt: authUser.metadata.creationTime, // ISO string (User creation)
          disabled: authUser.disabled, // Add disabled status
          deleted: firestoreUser.deleted, // Add deleted status
          creditBalance: creditSummary.balance,
          totalSpent: creditSummary.totalSpentCents / 100, // Convert to dollars
          generationCount: generationSummary.generationCount,
          failedGenerationCount: generationSummary.failedGenerationCount,
          latestGenerationCreatedAt: generationSummary.latestGenerationTimestamp?.toDate().toISOString() || null,
          generations: generationSummary.generations,
          attribution: firestoreUser.attribution,
        };
      });
      console.log(`[Admin Dashboard] Constructed enriched list for ${enrichedUsers.length} users.`);

      // --- Roll up per-source funnel rows ---
      // Iterates enrichedUsers and accumulates into a Map keyed by
      // first-touch source. "(unknown)" buckets users without attribution.
      const sourceMap = new Map<string, SourceFunnelRow>();
      for (const u of enrichedUsers) {
        const src = u.attribution?.firstTouch?.source;
        const key = src && src.length > 0 ? src : "(unknown)";
        const row = sourceMap.get(key) ?? {
          source: key,
          signups: 0,
          activatedUsers: 0,
          payingCustomers: 0,
          revenue: 0,
          completedReadings: 0,
        };
        row.signups += 1;
        if (u.generationCount > 0) row.activatedUsers += 1;
        if (u.totalSpent > 0) row.payingCustomers += 1;
        row.revenue += u.totalSpent;
        row.completedReadings += u.generationCount - u.failedGenerationCount;
        sourceMap.set(key, row);
      }
      const sourceBreakdown = Array.from(sourceMap.values()).sort(
        (a, b) => b.revenue - a.revenue || b.signups - a.signups,
      );

      console.log("[Admin Dashboard] Aggregation and data preparation complete.");

      // --- Quiz funnel rollup (additive, per QUIZ-PIVOT-SPEC.md §9.2) ---
      const quizFunnel: AdminDashboardData['quizFunnel'] = {
        pendingReadingsByStatus: {},
        last7DaysCount: 0,
        last7DaysByTool: {},
        activeSubscribers: 0,
        totalSubscribersEver: 0,
      };
      try {
        const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 3600 * 1000);
        const pendingSnap = await db.collection('pendingReadings').limit(2000).get();
        for (const d of pendingSnap.docs) {
          const data = d.data() as { status?: string; toolId?: string; createdAt?: admin.firestore.Timestamp };
          const status = data.status || 'unknown';
          quizFunnel.pendingReadingsByStatus[status] = (quizFunnel.pendingReadingsByStatus[status] || 0) + 1;
          if (data.createdAt && data.createdAt.toMillis() >= sevenDaysAgo.toMillis()) {
            quizFunnel.last7DaysCount++;
            const tool = data.toolId || 'unknown';
            quizFunnel.last7DaysByTool[tool] = (quizFunnel.last7DaysByTool[tool] || 0) + 1;
          }
        }
        // Subscribers count: re-walk userCredits we already loaded
        userCreditsSnapshot.forEach(doc => {
          const data = doc.data() as { subscription?: { status?: string } };
          if (data.subscription) {
            quizFunnel.totalSubscribersEver++;
            if (data.subscription.status === 'active' || data.subscription.status === 'trialing') {
              quizFunnel.activeSubscribers++;
            }
          }
        });
      } catch (qfErr) {
        console.warn('[Admin Dashboard] quizFunnel rollup failed (non-fatal):', qfErr);
      }

      // 4. Return Data
      return {
        success: true,
        aggregatedStats: {
          totalUsers,
          totalRevenue: totalRevenueDollars,
          payingCustomers,
          totalUploads,
          completedGenerations,
          failedGenerations,
        },
        users: enrichedUsers,
        sourceBreakdown,
        quizFunnel,
      };

    } catch (error: any) {
      console.error('[Admin Dashboard] Error fetching data:', error);
      throw new HttpsError('internal', `Failed to fetch admin dashboard data: ${error.message}`);
    }
  }
);

// Add this function
export const disableCurrentUserAccount = onCall(
  {
    // Add secrets if necessary, e.g., if interacting with other services
    secrets: [],
  },
  async (request) => {
    console.log("[disableCurrentUserAccount] Function called.");

    // 1. Verify authentication
    if (!request.auth) {
      console.error('[Disable Account] Unauthorized: No authentication provided.');
      throw new HttpsError('unauthenticated', 'User must be authenticated to disable account.');
    }
    const userId = request.auth.uid;
    const userEmail = request.auth.token.email; // For logging
    console.log(`[Disable Account] Attempting to disable account for user: ${userId} (${userEmail})`);

    try {
      // 2. Disable user in Firebase Auth
      await admin.auth().updateUser(userId, { disabled: true });
      console.log(`[Disable Account] Successfully disabled user ${userId} in Firebase Auth.`);

      // Optionally: Could also trigger the Firestore soft-delete here instead of client-side,
      // but keeping it client-side is okay since re-authentication happens there.

      return { success: true, message: "Account disabled successfully." };

    } catch (error: any) {
      console.error(`[Disable Account] Error disabling user ${userId}:`, error);
      throw new HttpsError('internal', `Failed to disable account: ${error.message}`);
    }
  }
);

export * from "./generate-for-tool";
export * from "./ensure-user-credits";
export * from "./share-link";
