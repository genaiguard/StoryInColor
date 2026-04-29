import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';
import { sendWelcomeEmail, sendContactFormEmail } from './email-service';
import { CREDIT_PACKAGES } from './credit-packages';
import { dispatchServerConversion } from './conversions/dispatch';
import type { ServerUserData } from './conversions/types';

// Version log - update this to verify deployments
console.log('Cloud Functions initializing - OpenAI Integration Version');

// Define secrets - Use UPPER_SNAKE_CASE for variable names too
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const AWS_ACCESS_KEY_ID = defineSecret('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = defineSecret('AWS_SECRET_ACCESS_KEY');
const AWS_REGION = defineSecret('AWS_REGION');
const SENDER_EMAIL_ADDRESS = defineSecret('SENDER_EMAIL_ADDRESS');
// Server-side conversion forwarding (Phase 4). Only consumed by the
// dispatchServerConversion helper, which reads them via process.env at
// call time. Marking them as Firebase secrets here ensures they're injected
// into the function runtime; setting their values is a separate
// `firebase functions:secrets:set <NAME>` step.
const META_CAPI_TOKEN = defineSecret('META_CAPI_TOKEN');
const GA4_MP_API_SECRET = defineSecret('GA4_MP_API_SECRET');
// Initialize Firebase Admin
admin.initializeApp();
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
      // AWS secrets for email services
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
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
          // Fetch the secret and apply stronger validation
          let stripeKey = STRIPE_SECRET_KEY.value();
          
          // Check if key matches expected format pattern (sk_live_... or sk_test_...)
          const isValidStripeKeyFormat = /^sk_(live|test)_[A-Za-z0-9_]+$/.test(stripeKey);
          console.log(`[Webhook] Secret key format valid: ${isValidStripeKeyFormat}`);
          
          if (!isValidStripeKeyFormat) {
            console.error('[Webhook] API key has invalid format - this will cause auth errors');
            // Try to sanitize by removing all non-ASCII characters
            const originalLength = stripeKey.length;
            stripeKey = stripeKey.replace(/[^\x20-\x7E]/g, '');
            console.log(`[Webhook] Sanitized key: removed ${originalLength - stripeKey.length} non-ASCII chars`);
          }
          
          // Log a sanitized version for debugging
          console.log(`[Webhook] Secret key prefix: ${stripeKey.substring(0, 8)}... (length: ${stripeKey.length})`);
          
          const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16' // Updated to a newer version
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
              console.log(`[Webhook] Handling checkout.session.completed for session: ${session.id}`);
              console.log(`[Webhook] Payment status: ${session.payment_status}`);
              console.log(`[Webhook] Payment method: ${session.payment_method_types?.join(', ')}`);
              console.log(`[Webhook] Full session object: ${JSON.stringify(session)}`);

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
                      try {
                          console.log(`[Credits] Adding ${creditAmount} credits for user ${userId}`);
                          const userCreditsRef = db.collection('userCredits').doc(userId);
                          
                          // Get current user credits or create if not exists
                          const userCreditsDoc = await userCreditsRef.get();
                          if (!userCreditsDoc.exists) {
                              // Create new user credits document
                              await userCreditsRef.set({
                                  balance: creditAmount,
                                  used: 0,
                                  purchaseHistory: [{
                                      packageId,
                                      creditAmount,
                                      pricePaid: priceInCents,
                                      purchaseDate: new Date() // Use regular Date instead of server timestamp
                                  }],
                                  // usageHistory array intentionally omitted — usage now lives in the
                                  // userCredits/{uid}/usageEvents subcollection (see credit-ledger.ts).
                                  lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                              });
                                      } else {
                              // Update existing user credits document
                              // We don't need the existing data for an increment operation
                              await userCreditsRef.update({
                                  balance: admin.firestore.FieldValue.increment(creditAmount),
                                  purchaseHistory: admin.firestore.FieldValue.arrayUnion({
                                      packageId,
                                      creditAmount,
                                      pricePaid: priceInCents,
                                      purchaseDate: new Date() // Use regular Date instead of server timestamp
                                  }),
                                  lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                              });
                          }
                          
                          console.log(`[Credits] Successfully added ${creditAmount} credits for user ${userId}`);

                          // Phase 4: server-side Purchase mirror to Meta CAPI + GA4 MP.
                          // Wrapped in its own try/catch so a tracker failure doesn't
                          // 500 the webhook (Stripe would then retry the credit grant).
                          try {
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
                          console.error(`[Credits Error] Failed to add credits: ${error}`);
                          // Still return success to Stripe but log the error
                          res.status(200).send({ received: true, error: 'Failed to add credits' });
                          return;
                               }
                          } else {
                      console.log(`[Credits] Payment not completed: ${session.payment_status}`);
                  }
                  
                  // Acknowledge receipt of the event
                  res.status(200).send({ received: true, type: 'credit_purchase' });
                  return;
                  } else {
                  // Unknown checkout type
                  console.log(`[Webhook] Unrecognized checkout type. Session ID: ${session.id}`);
                  res.status(200).send({ received: true, type: 'unknown' });
                  return;
              }
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
    AWS_ACCESS_KEY_ID, // Use updated variable name
    AWS_SECRET_ACCESS_KEY, // Use updated variable name
    AWS_REGION, // Use updated variable name
    SENDER_EMAIL_ADDRESS // Use updated variable name
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
    AWS_ACCESS_KEY_ID, // Use updated variable name
    AWS_SECRET_ACCESS_KEY, // Use updated variable name
    AWS_REGION, // Use updated variable name
    SENDER_EMAIL_ADDRESS // Use updated variable name
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
export const createCreditCheckout = onCall<{packageId: string, origin?: string, fbEventId?: string}>(
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
    const { packageId, origin, fbEventId } = request.data;
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
      
      // Fetch the secret and apply stronger validation
      let stripeKey = STRIPE_SECRET_KEY.value();
      
      // Check if key matches expected format pattern (sk_live_... or sk_test_...)
      const isValidStripeKeyFormat = /^sk_(live|test)_[A-Za-z0-9_]+$/.test(stripeKey);
      console.log(`[Stripe] Secret key format valid: ${isValidStripeKeyFormat}`);
      
      if (!isValidStripeKeyFormat) {
        console.error('[Stripe] API key has invalid format - this will cause auth errors');
        // Try to sanitize by removing all non-ASCII characters
        const originalLength = stripeKey.length;
        stripeKey = stripeKey.replace(/[^\x20-\x7E]/g, '');
        console.log(`[Stripe] Sanitized key: removed ${originalLength - stripeKey.length} non-ASCII chars`);
      }
      
      // Log a sanitized version (first 8 chars) for debugging
      console.log(`[Stripe] Secret key prefix: ${stripeKey.substring(0, 8)}... (length: ${stripeKey.length})`);
      
      const stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16',
      });

      // Create product name and description
      const productName = `${creditPackage.credits} Credits`;
      const productDescription = `${creditPackage.credits} credits for generating coloring pages (${creditPackage.discountPercentage}% discount)`;

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
      
      // Create checkout session
      console.log("[Stripe] Creating checkout session...");
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        payment_method_options: {
          card: {
            setup_future_usage: 'off_session',
            request_three_d_secure: 'automatic'
          }
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
        success_url: `${domain}/dashboard?credit_purchase=success`,
        cancel_url: `${domain}/credits`,
      });
      console.log(`[Stripe] Checkout session created successfully: ${session.id}`);

      // Return the session ID 
      return { sessionId: session.id };

    } catch (error) {
      console.error('[Stripe Error] Failed to create checkout session:', error);
      if (error instanceof Error && 'type' in error) {
          console.error('[Stripe Error Details]', { type: (error as any).type, code: (error as any).code, message: error.message });
      }
      throw new HttpsError('internal', 'Failed to create checkout session');
    }
  }
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

    // 1. Verify admin authentication
    if (!request.auth || request.auth.token.email !== 'ipekcioglu@me.com') {
      console.error(`[Admin Dashboard] Unauthorized attempt by ${request.auth?.token.email || 'unauthenticated user'}.`);
      throw new HttpsError('permission-denied', 'Admin access required.');
    }
    console.log(`[Admin Dashboard] Admin user verified: ${request.auth.token.email}`);

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
