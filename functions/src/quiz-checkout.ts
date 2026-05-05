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
import { sendQuizReadingReadyEmail } from "./email-service";
import { getServerToolConfig } from "./tool-prompts";

const AWS_ACCESS_KEY_ID = defineSecret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = defineSecret("AWS_SECRET_ACCESS_KEY");
const SENDER_EMAIL_ADDRESS = defineSecret("SENDER_EMAIL_ADDRESS");

const TOOL_NAME_BY_ID: Record<string, string> = {
  "palm-reading": "Palm Reading",
  "face-reading": "Face Reading",
  "beauty-report": "Beauty Report",
  "aura-reading": "Aura Reading",
  iridology: "Iridology Reading",
  handwriting: "Handwriting Read",
  "style-audit": "Style Audit",
  "hairstyle-analysis": "Hairstyle Analysis",
  "color-analysis": "Color Analysis",
  "skincare-glow": "Skincare Glow",
};

const HEADLINE_FALLBACKS: Record<string, string> = {
  "palm-reading": "Your palm reads more strongly than 73% of the hands we analyze.",
  "face-reading": "Your face reads in the top 12% for clarity of features.",
  "beauty-report": "Your overall score is in the upper third of the photos we've analyzed.",
  "aura-reading": "Your reading sits in a less-common configuration.",
  iridology: "Your iris pattern reads in a less-common configuration.",
  handwriting: "Your handwriting archetype fits under 8% of writers cleanly.",
  "style-audit": "Your archetype is one of the rarer four.",
  "hairstyle-analysis":
    "Three of the eight cuts read strongly on your face shape — and one is unexpected.",
  "color-analysis":
    "Your undertone reads cleaner than most — and three palettes really light you up.",
  "skincare-glow":
    "One zone of your face is doing more work than the others — and we have a routine for it.",
};

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

if (!admin.apps.length) {
  admin.initializeApp();
}

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
  two_pack: "quiz_two_pack_v2",
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
    secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SENDER_EMAIL_ADDRESS],
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

    const alreadyHadEmail = !!pending.email;
    await ref.update({
      email,
      emailCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
      marketingOptIn: !!marketingOptIn,
    });

    // Send the "Your reading is ready" transactional email. Pattern from
    // Nebula / Noom / Flo / Zoe — captures users who close the tab + acts
    // as an email-validation signal. Non-fatal if it fails.
    if (!alreadyHadEmail && pending.status === "ready") {
      try {
        const toolName =
          TOOL_NAME_BY_ID[pending.toolId] ??
          getServerToolConfig(pending.toolId)?.outputType ??
          "Reading";
        const headlineInsight =
          HEADLINE_FALLBACKS[pending.toolId] ?? "Your reading is ready.";
        // Build the resume URL the email links back to.
        const unlockUrl = `https://storyincolor.com/quiz/${pending.toolId}/result?token=${token}`;
        await sendQuizReadingReadyEmail({
          email,
          toolName,
          headlineInsight,
          unlockUrl,
          blurredPreviewUrl: pending.blurredOutputDownloadUrl,
        });
      } catch (emailErr) {
        console.warn("[CaptureQuizEmail] reading-ready email failed:", emailErr);
      }
    }
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

    const isSubscription =
      tier === "two_pack" || tier === "monthly" || tier === "annual";
    const mode = isSubscription ? "subscription" : "payment";

    // Stripe Embedded Checkout per existing app pattern (API 2026-04-22.dahlia
    // renamed "embedded" → "embedded_page" — must match the value used in
    // functions/src/index.ts createCheckoutSession).
    //
    // Hard paywall — no trial_period_days. Per category research (RevenueCat
    // 2026 hard-paywall data + founder direction): trial leaks conversions
    // on a one-output product because a user can extract one reading and
    // cancel before being charged. Hard paywall delivers 8x higher RPI
    // at Day 60 in this niche.
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
