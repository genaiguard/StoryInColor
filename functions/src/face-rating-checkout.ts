// Face-rating checkout + email capture + share toggle + invite-3 mechanic.
// Per PIVOT-2.md + BUG-REVIEW.md fixes (C1+C2, C4, H1, H4, M7).
//
// Single SKU only: $4.99 one-time, lookup_key=face_rating_single_v1.
//
// AUTH MODEL (post-bug-review):
//   - Pre-claim: token-only auth is fine (no privileged data yet).
//   - Post-claim or sensitive: caller MUST present `ownerSecret` (returned
//     from analyzeFaceUnauth on first run, persisted client-side). Server
//     compares against pending.ownerSecret — without it, the call rejects.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import StripeImport from "stripe";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import { isValidEmail, isValidToken } from "./face-rating-helpers";
import { isFaceRatingEnabled } from "./face-rating-types";
import type { PendingFaceReadingDoc } from "./face-rating-types";
import { sendFaceRatingReadyEmail } from "./email-service";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const AWS_ACCESS_KEY_ID = defineSecret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = defineSecret("AWS_SECRET_ACCESS_KEY");
const SENDER_EMAIL_ADDRESS = defineSecret("SENDER_EMAIL_ADDRESS");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const FACE_RATING_LOOKUP_KEY = "face_rating_single_v1";

// Per-instance Stripe price-id cache.
const priceCache = new Map<string, string>();

/** True iff this pendingReadings doc is a face-rating doc.
 *  Structural check + the explicit type discriminator. */
function isFaceRatingDoc(p: PendingFaceReadingDoc | undefined | null): boolean {
  if (!p) return false;
  if (p.type === "face-rating") return true;
  // Structural: face-rating docs have frontPhotoStoragePath; legacy quiz
  // docs have inputStoragePath.
  return !!p.frontPhotoStoragePath;
}

function requireOwnerSecret(
  pending: PendingFaceReadingDoc,
  supplied: unknown,
): void {
  if (
    !pending.ownerSecret ||
    typeof supplied !== "string" ||
    supplied.length === 0 ||
    supplied !== pending.ownerSecret
  ) {
    throw new HttpsError(
      "permission-denied",
      "Missing or invalid ownerSecret. This action requires the original session secret.",
    );
  }
}

/* -------------------------------------------------------------------- */
/* captureFaceRatingEmail — email-gate on the reveal                     */
/* -------------------------------------------------------------------- */

interface CaptureEmailRequest {
  token?: string;
  email?: string;
  marketingOptIn?: boolean;
}

export const captureFaceRatingEmail = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
    secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SENDER_EMAIL_ADDRESS],
  },
  async (request) => {
    if (!isFaceRatingEnabled()) {
      throw new HttpsError("unavailable", "Face rating is currently disabled.");
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
      throw new HttpsError("not-found", "Reading not found or expired.");
    }
    const pending = snap.data() as PendingFaceReadingDoc;
    // H4: only operate on face-rating docs.
    if (!isFaceRatingDoc(pending)) {
      throw new HttpsError(
        "failed-precondition",
        "This token is not a face-rating reading.",
      );
    }
    if (pending.status === "expired") {
      throw new HttpsError(
        "failed-precondition",
        "This reading has expired. Please start over.",
      );
    }
    if (pending.status === "claimed") {
      return { success: true, alreadyClaimed: true };
    }
    const alreadyHadEmail = !!pending.email;
    await ref.update({
      email,
      emailCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
      marketingOptIn: !!marketingOptIn,
    });
    if (!alreadyHadEmail && pending.status === "ready") {
      try {
        const unlockUrl = `https://storyincolor.com/face-rating/result?token=${token}`;
        await sendFaceRatingReadyEmail({
          email,
          tierLabel: pending.lightAnalysis?.tier_label || "Reading",
          overallScore: pending.lightAnalysis?.overall_score ?? null,
          unlockUrl,
        });
      } catch (emailErr) {
        console.warn(
          "[FaceCaptureEmail] reading-ready email failed:",
          emailErr,
        );
      }
    }
    return { success: true };
  },
);

/* -------------------------------------------------------------------- */
/* createFaceRatingCheckoutSession — single SKU $4.99                    */
/* -------------------------------------------------------------------- */

interface CreateCheckoutRequest {
  token?: string;
  successUrl?: string;
}

export const createFaceRatingCheckoutSession = onCall(
  {
    secrets: [STRIPE_SECRET_KEY],
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!isFaceRatingEnabled()) {
      throw new HttpsError("unavailable", "Face rating is currently disabled.");
    }
    const data = (request.data ?? {}) as CreateCheckoutRequest;
    const { token, successUrl } = data;
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    const ref = db.collection("pendingReadings").doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Reading not found.");
    }
    const pending = snap.data() as PendingFaceReadingDoc;
    if (!isFaceRatingDoc(pending)) {
      throw new HttpsError(
        "failed-precondition",
        "This token is not a face-rating reading.",
      );
    }
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

    let priceId = priceCache.get(FACE_RATING_LOOKUP_KEY);
    if (!priceId) {
      const prices = await stripe.prices.list({
        lookup_keys: [FACE_RATING_LOOKUP_KEY],
        active: true,
        limit: 1,
      });
      const found = prices.data[0];
      if (!found) {
        throw new HttpsError(
          "failed-precondition",
          `Stripe price with lookup_key=${FACE_RATING_LOOKUP_KEY} not found. Run scripts/setup-quiz-stripe-products.mjs.`,
        );
      }
      priceId = found.id;
      priceCache.set(FACE_RATING_LOOKUP_KEY, priceId);
    }

    // Match the legacy createCreditCheckout branding so the embedded
    // iframe doesn't show the default white background.
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      ui_mode: "embedded_page",
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: pending.email,
      return_url: `${successUrl || "https://storyincolor.com/face-rating/result"}?token=${token}&session_id={CHECKOUT_SESSION_ID}`,
      redirect_on_completion: "if_required",
      branding_settings: {
        display_name: "StoryInColor",
        background_color: "#0a0a0a",
        button_color: "#ffffff",
        font_family: "inter",
        border_style: "rounded",
      },
      payment_method_options: {
        card: {
          request_three_d_secure: "automatic",
        },
      },
      metadata: {
        type: "face_rating_purchase",
        pendingReadingToken: token,
        tier: "single",
        productKey: "face_rating_single",
        fbEventId: pending.fbEventId || "",
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    await ref.update({
      stripeCheckoutSessionId: session.id,
    });

    return {
      success: true,
      clientSecret: session.client_secret,
      sessionId: session.id,
    };
  },
);

/* -------------------------------------------------------------------- */
/* setFaceRatingShareEnabled — option C: opt-in shareable URL            */
/* SECURITY: requires ownerSecret. The shared doc no longer leaks token. */
/* -------------------------------------------------------------------- */

interface SetShareRequest {
  token?: string;
  enabled?: boolean;
  ownerSecret?: string;
}

const SHARE_ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l ambiguity
function cryptoRandomCode(len: number): string {
  // Use crypto.randomBytes (CSPRNG). Per BUG-REVIEW.md M7.
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += SHARE_ID_ALPHABET[bytes[i] % SHARE_ID_ALPHABET.length];
  }
  return out;
}

export const setFaceRatingShareEnabled = onCall(
  {
    invoker: "public",
    timeoutSeconds: 15,
  },
  async (request) => {
    const { token, enabled, ownerSecret } = (request.data ?? {}) as SetShareRequest;
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    if (typeof enabled !== "boolean") {
      throw new HttpsError("invalid-argument", "enabled must be boolean.");
    }
    const ref = db.collection("pendingReadings").doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Reading not found.");
    }
    const pending = snap.data() as PendingFaceReadingDoc;
    if (!isFaceRatingDoc(pending)) {
      throw new HttpsError(
        "failed-precondition",
        "This token is not a face-rating reading.",
      );
    }
    requireOwnerSecret(pending, ownerSecret);
    if (pending.status !== "claimed" && pending.inviteUnlocked !== true) {
      throw new HttpsError(
        "failed-precondition",
        "Share toggle is only available after unlocking the full reading.",
      );
    }

    if (enabled) {
      let shareId = pending.shareId;
      if (!shareId) {
        // Cryptographically random + uniqueness check.
        for (let i = 0; i < 5; i++) {
          const candidate = cryptoRandomCode(8);
          const existing = await db
            .collection("sharedFaceReadings")
            .doc(candidate)
            .get();
          if (!existing.exists) {
            shareId = candidate;
            break;
          }
        }
        if (!shareId) {
          throw new HttpsError(
            "internal",
            "Could not allocate share id. Try again.",
          );
        }
      }
      // Materialize the public-facing share doc — DISPLAY FIELDS ONLY.
      // CRITICAL (C1): never store pendingToken in this doc.
      await db
        .collection("sharedFaceReadings")
        .doc(shareId)
        .set({
          shareId,
          tierLabel: pending.lightAnalysis?.tier_label || null,
          overallScore: pending.lightAnalysis?.overall_score ?? null,
          archetypeName: pending.fullAnalysis?.archetype?.name || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      // Server-only mapping doc — admin-only read in firestore.rules.
      await db
        .collection("sharedFaceReadingsInternal")
        .doc(shareId)
        .set({
          shareId,
          pendingToken: token,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      await ref.update({ shareEnabled: true, shareId });
      return { success: true, shareId, shareUrl: `https://storyincolor.com/r?id=${shareId}` };
    } else {
      if (pending.shareId) {
        await db
          .collection("sharedFaceReadings")
          .doc(pending.shareId)
          .delete()
          .catch(() => {});
        await db
          .collection("sharedFaceReadingsInternal")
          .doc(pending.shareId)
          .delete()
          .catch(() => {});
      }
      await ref.update({ shareEnabled: false });
      return { success: true };
    }
  },
);

/* -------------------------------------------------------------------- */
/* getFaceRatingPaywallStatus — polling endpoint post-checkout           */
/* -------------------------------------------------------------------- */

export const getFaceRatingPaywallStatus = onCall(
  {
    invoker: "public",
    timeoutSeconds: 15,
  },
  async (request) => {
    const { token } = (request.data ?? {}) as { token?: string };
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    const snap = await db.collection("pendingReadings").doc(token).get();
    if (!snap.exists) return { status: "not-found" as const };
    const pending = snap.data() as PendingFaceReadingDoc;
    if (!isFaceRatingDoc(pending)) {
      return { status: "not-found" as const };
    }
    return {
      status: pending.status,
      claimedByUid: pending.claimedByUid,
      hasFullAnalysis: !!pending.fullAnalysis,
      inviteUnlocked: !!pending.inviteUnlocked,
    };
  },
);

/* -------------------------------------------------------------------- */
/* INVITE-3-FRIENDS mechanic                                             */
/* getOrCreateFaceRatingInviteCode — owner mints their code              */
/* -------------------------------------------------------------------- */

export const getOrCreateFaceRatingInviteCode = onCall(
  {
    invoker: "public",
    timeoutSeconds: 15,
  },
  async (request) => {
    const { token, ownerSecret } = (request.data ?? {}) as {
      token?: string;
      ownerSecret?: string;
    };
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    const ref = db.collection("pendingReadings").doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Reading not found.");
    }
    const pending = snap.data() as PendingFaceReadingDoc;
    if (!isFaceRatingDoc(pending)) {
      throw new HttpsError(
        "failed-precondition",
        "This token is not a face-rating reading.",
      );
    }
    requireOwnerSecret(pending, ownerSecret);
    if (pending.status === "expired") {
      throw new HttpsError("failed-precondition", "Reading expired.");
    }
    let inviteCode = pending.inviteCode;
    if (!inviteCode) {
      for (let i = 0; i < 5; i++) {
        const candidate = cryptoRandomCode(6);
        const idxRef = db.collection("faceInviteCodes").doc(candidate);
        const idxSnap = await idxRef.get();
        if (!idxSnap.exists) {
          await idxRef.set({
            inviteCode: candidate,
            ownerToken: token,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            redemptions: 0,
          });
          inviteCode = candidate;
          break;
        }
      }
      if (!inviteCode) {
        throw new HttpsError("internal", "Could not allocate invite code.");
      }
      await ref.update({
        inviteCode,
        inviteRedemptions: 0,
        inviteUnlocked: false,
      });
    }
    return {
      success: true,
      inviteCode,
      inviteUrl: `https://storyincolor.com/face-rating?ref=${inviteCode}`,
      redemptions: pending.inviteRedemptions || 0,
      unlocked: pending.inviteUnlocked || false,
    };
  },
);

/**
 * Redeem an invite code on behalf of a redeemer's own pending doc.
 * Public callable — token-only is OK because the worst case is "I
 * mistakenly credit my own friend's invite even though I didn't intend
 * to" which is incentive-aligned anyway. The H1 race is fixed by moving
 * the idempotency check INSIDE the transaction.
 */
export const redeemFaceRatingInvite = onCall(
  {
    invoker: "public",
    timeoutSeconds: 15,
  },
  async (request) => {
    const { token, inviteCode } = (request.data ?? {}) as {
      token?: string;
      inviteCode?: string;
    };
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    if (typeof inviteCode !== "string" || !/^[a-z0-9]{6}$/i.test(inviteCode)) {
      throw new HttpsError("invalid-argument", "Invalid invite code.");
    }
    const lower = inviteCode.toLowerCase();
    const idxRef = db.collection("faceInviteCodes").doc(lower);
    const idxSnap = await idxRef.get();
    if (!idxSnap.exists) {
      return { success: false, reason: "code-not-found" };
    }
    const idx = idxSnap.data() as {
      inviteCode: string;
      ownerToken: string;
      redemptions?: number;
    };
    if (idx.ownerToken === token) {
      return { success: false, reason: "self-redemption" };
    }

    const redeemerRef = db.collection("pendingReadings").doc(token);
    const ownerRef = db.collection("pendingReadings").doc(idx.ownerToken);

    const result = await db.runTransaction(async (tx) => {
      const redeemerSnap = await tx.get(redeemerRef);
      if (!redeemerSnap.exists) {
        return { success: false, reason: "redeemer-not-found" as const };
      }
      const redeemer = redeemerSnap.data() as PendingFaceReadingDoc;
      if (!isFaceRatingDoc(redeemer)) {
        return { success: false, reason: "redeemer-wrong-type" as const };
      }
      // H1 fix: idempotency check INSIDE transaction.
      if (redeemer.creditedInviteCodes?.includes(lower)) {
        return { success: false, reason: "already-credited" as const };
      }
      const ownerSnap = await tx.get(ownerRef);
      if (!ownerSnap.exists) {
        return { success: false, reason: "owner-not-found" as const };
      }
      const owner = ownerSnap.data() as PendingFaceReadingDoc;
      if (!isFaceRatingDoc(owner)) {
        return { success: false, reason: "owner-wrong-type" as const };
      }
      const newCount = (owner.inviteRedemptions || 0) + 1;
      tx.update(ownerRef, {
        inviteRedemptions: newCount,
        ...(newCount >= 3 && !owner.inviteUnlocked
          ? { inviteUnlocked: true }
          : {}),
      });
      tx.update(idxRef, {
        redemptions: admin.firestore.FieldValue.increment(1),
      });
      tx.update(redeemerRef, {
        creditedInviteCodes: admin.firestore.FieldValue.arrayUnion(lower),
      });
      return {
        success: true as const,
        redemptions: newCount,
        unlocked: newCount >= 3,
      };
    });
    return result;
  },
);

/* -------------------------------------------------------------------- */
/* claimFaceRatingAccount — set a password on the user's Auth account    */
/* after they've paid for a face-rating. Lets them sign in to /dashboard */
/* and see their face-rating alongside other readings.                   */
/* SECURITY: requires ownerSecret + the pending must be claimed.         */
/* -------------------------------------------------------------------- */

interface ClaimAccountRequest {
  token?: string;
  ownerSecret?: string;
  password?: string;
}

export const claimFaceRatingAccount = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    const { token, ownerSecret, password } = (request.data ??
      {}) as ClaimAccountRequest;
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    if (typeof password !== "string" || password.length < 8) {
      throw new HttpsError(
        "invalid-argument",
        "Password must be at least 8 characters.",
      );
    }
    if (password.length > 200) {
      throw new HttpsError("invalid-argument", "Password too long.");
    }
    const ref = db.collection("pendingReadings").doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Reading not found.");
    }
    const pending = snap.data() as PendingFaceReadingDoc;
    if (!isFaceRatingDoc(pending)) {
      throw new HttpsError(
        "failed-precondition",
        "This token is not a face-rating reading.",
      );
    }
    requireOwnerSecret(pending, ownerSecret);
    if (pending.status !== "claimed" || !pending.claimedByUid) {
      throw new HttpsError(
        "failed-precondition",
        "Account claim is only available after the reading has been unlocked.",
      );
    }
    const uid = pending.claimedByUid;
    const email = pending.email;
    if (!email) {
      throw new HttpsError(
        "failed-precondition",
        "No email associated with this reading.",
      );
    }

    try {
      // Set the password on the existing Firebase Auth user. The webhook
      // already created the user (no password) — we're just adding one.
      await admin.auth().updateUser(uid, {
        password,
        emailVerified: true, // they got a working email link / paid invoice
      });
    } catch (err) {
      console.error("[claimFaceRatingAccount] updateUser failed:", err);
      throw new HttpsError(
        "internal",
        "Could not set password on the account. Try again or contact support.",
      );
    }

    // Mark the pending doc so we know the user has claimed.
    await ref.update({
      accountClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, email };
  },
);

/* -------------------------------------------------------------------- */
/* deleteFaceRatingPhoto — one-click photo delete (legal compliance)     */
/* SECURITY: requires ownerSecret.                                       */
/* -------------------------------------------------------------------- */

export const deleteFaceRatingPhoto = onCall(
  {
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (request) => {
    const { token, ownerSecret } = (request.data ?? {}) as {
      token?: string;
      ownerSecret?: string;
    };
    if (typeof token !== "string" || !isValidToken(token)) {
      throw new HttpsError("invalid-argument", "Invalid token.");
    }
    const ref = db.collection("pendingReadings").doc(token);
    const snap = await ref.get();
    if (!snap.exists) {
      return { success: true, alreadyDeleted: true };
    }
    const pending = snap.data() as PendingFaceReadingDoc;
    if (!isFaceRatingDoc(pending)) {
      throw new HttpsError(
        "failed-precondition",
        "This token is not a face-rating reading.",
      );
    }
    requireOwnerSecret(pending, ownerSecret);
    const bucket = admin.storage().bucket();
    const paths = [
      pending.frontPhotoStoragePath,
      pending.sidePhotoStoragePath,
    ].filter((p): p is string => typeof p === "string" && p.length > 0);
    for (const p of paths) {
      try {
        await bucket.file(p).delete().catch(() => {});
      } catch {
        /* swallow */
      }
    }
    // M3: clear the path fields so re-rate paths don't 404.
    await ref.update({
      photosDeleted: true,
      photosDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
      frontPhotoStoragePath: admin.firestore.FieldValue.delete(),
      sidePhotoStoragePath: admin.firestore.FieldValue.delete(),
    });
    return { success: true };
  },
);
