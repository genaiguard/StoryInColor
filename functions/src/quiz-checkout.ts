// Quiz funnel checkout + email capture Cloud Functions.
// Per QUIZ-PIVOT-SPEC.md §8.1.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import StripeImport from "stripe";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import { isQuizFunnelEnabled } from "./quiz-types";
import { isValidEmail, isValidToken } from "./quiz-helpers";
import type { PendingReadingDoc } from "./quiz-types";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

const db = admin.firestore();

/**
 * Quiz tier prices. Lookup keys must match the Stripe Price IDs created
 * in the Stripe dashboard. Update these once the founder runs the
 * one-time Stripe product setup script (see Phase 0 §10.1).
 *
 * For initial deployment we resolve price IDs at runtime via Stripe
 * lookup_key — set lookup_key on each Price in the Stripe dashboard so
 * we don't hard-code the random `price_xxxx` IDs here.
 */
const QUIZ_PRICE_LOOKUP_KEYS = {
  single: "quiz_single_v2",
  monthly: "quiz_monthly_v2",
  annual: "quiz_annual_v2",
  trial_dollar: "quiz_trial_dollar",
} as const;

type QuizTier = keyof typeof QUIZ_PRICE_LOOKUP_KEYS;

interface CaptureEmailRequest {
  token?: string;
  email?: string;
  marketingOptIn?: boolean;
}

interface CreateCheckoutRequest {
  token?: string;
  tier?: QuizTier;
  successUrl?: string;
}

/**
 * Records the email against the pendingReadings doc. Called from the
 * reveal screen when the user submits their email to "see my reading."
 */
export const captureQuizEmail = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!isQuizFunnelEnabled()) {
      throw new HttpsError("unavailable", "Quiz funnel is currently disabled.");
    }
    const data = (request.data ?? {}) as CaptureEmailRequest;
    const { token, email, marketingOptIn = false } = data;

    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    if (typeof email !== "string" || !isValidEmail(email)) {
      throw new HttpsError("invalid-argument", "Invalid email.");
    }

    const ref = db.collection("pendingReadings").doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Pending reading not found or expired.");
    }
    const pending = snap.data() as PendingReadingDoc;
    if (pending.status === "expired") {
      throw new HttpsError(
        "failed-precondition",
        "This reading has expired. Please start over.",
      );
    }
    if (pending.status === "claimed") {
      // Already paid — no need to recapture
      return { success: true, alreadyClaimed: true };
    }

    await ref.update({
      email,
      emailCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
      marketingOptIn: !!marketingOptIn,
    });
    return { success: true };
  },
);

/**
 * Creates a Stripe Checkout Session for the chosen tier.
 * The session metadata carries `pendingReadingToken` which the webhook
 * uses to materialize the account at payment success.
 */
export const createQuizCheckoutSession = onCall(
  {
    secrets: [STRIPE_SECRET_KEY],
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!isQuizFunnelEnabled()) {
      throw new HttpsError("unavailable", "Quiz funnel is currently disabled.");
    }
    const data = (request.data ?? {}) as CreateCheckoutRequest;
    const { token, tier, successUrl } = data;

    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    if (
      typeof tier !== "string" ||
      !(tier in QUIZ_PRICE_LOOKUP_KEYS)
    ) {
      throw new HttpsError("invalid-argument", "Invalid tier.");
    }

    const ref = db.collection("pendingReadings").doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Pending reading not found.");
    }
    const pending = snap.data() as PendingReadingDoc;
    if (pending.status === "expired") {
      throw new HttpsError(
        "failed-precondition",
        "This reading has expired. Please start over.",
      );
    }
    if (!pending.email) {
      throw new HttpsError(
        "failed-precondition",
        "Email must be captured before checkout.",
      );
    }

    const stripe = new StripeImport(STRIPE_SECRET_KEY.value(), {
      apiVersion: "2026-04-22.dahlia",
    });

    // Resolve price by lookup_key (so we don't hardcode price_xxxx)
    const lookupKey = QUIZ_PRICE_LOOKUP_KEYS[tier as QuizTier];
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (!price) {
      throw new HttpsError(
        "failed-precondition",
        `Stripe price with lookup_key=${lookupKey} not found. Configure in Stripe dashboard.`,
      );
    }

    const isSubscription = tier === "monthly" || tier === "annual";
    const mode = isSubscription ? "subscription" : "payment";

    // Stripe Embedded Checkout per existing app pattern (API 2026-04-22.dahlia
    // renamed "embedded" → "embedded_page" — must match the value used in
    // functions/src/index.ts createCheckoutSession).
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      ui_mode: "embedded_page",
      mode,
      line_items: [{ price: price.id, quantity: 1 }],
      customer_email: pending.email,
      return_url: `${successUrl || "https://storyincolor.com"}?session_id={CHECKOUT_SESSION_ID}`,
      redirect_on_completion: "if_required",
      metadata: {
        type: "quiz_purchase",
        pendingReadingToken: token,
        tier,
        toolId: pending.toolId,
        fbEventId: pending.fbEventId || "",
      },
      ...(isSubscription
        ? {
            subscription_data: {
              trial_period_days: tier === "monthly" ? 7 : 0,
              metadata: {
                pendingReadingToken: token,
                tier,
                toolId: pending.toolId,
              },
            },
          }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Annotate the pending doc with the session id (for status polling on
    // the post-payment unblur screen).
    await ref.update({
      stripeCheckoutSessionId: session.id,
      stripeCheckoutTier: tier,
    });

    return {
      success: true,
      clientSecret: session.client_secret,
      sessionId: session.id,
    };
  },
);

/**
 * Polled by the unlock screen after Stripe redirect. Returns the pending
 * reading status (claimed / processing / failed) so the client knows
 * whether the webhook has materialized the account yet.
 */
export const getQuizPaywallStatus = onCall(
  {
    invoker: "public",
    timeoutSeconds: 15,
  },
  async (request) => {
    const data = (request.data ?? {}) as { token?: string };
    const { token } = data;
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    const snap = await db.collection("pendingReadings").doc(token).get();
    if (!snap.exists) {
      return { status: "not-found" as const };
    }
    const pending = snap.data() as PendingReadingDoc;
    return {
      status: pending.status,
      claimedByUid: pending.claimedByUid,
      // Intentional: we do NOT return outputDownloadUrl here even after
      // claim. The dashboard fetches it via authenticated read.
    };
  },
);
