// Webhook handler for face_rating_purchase Stripe sessions.
// Per PIVOT-2.md.

import * as admin from "firebase-admin";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import { dispatchServerConversion } from "./conversions/dispatch";
import type { ServerUserData } from "./conversions/types";
import type { PendingFaceReadingDoc } from "./face-rating-types";
import { runFaceStage2ForToken } from "./analyze-face-full";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

interface HandleFaceRatingPurchaseInput {
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
}

export async function handleFaceRatingPurchase(
  input: HandleFaceRatingPurchaseInput,
): Promise<{ ok: boolean; granted: boolean; reason: string; uid?: string }> {
  const { event, session } = input;
  const token = session.metadata?.pendingReadingToken;
  if (!token) {
    return { ok: false, granted: false, reason: "missing-token" };
  }
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { ok: false, granted: false, reason: "not-paid" };
  }

  const stripeEventId = event.id;
  const pendingRef = db.collection("pendingReadings").doc(token);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) {
    return { ok: false, granted: false, reason: "pending-not-found" };
  }
  const pending = pendingSnap.data() as PendingFaceReadingDoc;
  // H9: refuse to process the wrong doc type.
  const isFaceDoc =
    pending.type === "face-rating" || !!pending.frontPhotoStoragePath;
  if (!isFaceDoc) {
    console.warn(
      `[FaceWebhook] token=${token} is not a face-rating doc; refusing.`,
    );
    return { ok: false, granted: false, reason: "wrong-type" };
  }

  const markerRef = db.collection("processedStripeEvents").doc(stripeEventId);

  const txnResult = await db.runTransaction(async (tx) => {
    const markerSnap = await tx.get(markerRef);
    if (markerSnap.exists) {
      return {
        ok: true,
        granted: false,
        reason: "already-processed" as const,
        uid: pending.claimedByUid,
      };
    }

    // Find/create Firebase Auth user keyed on email.
    const email =
      pending.email ||
      session.customer_email ||
      session.customer_details?.email;
    if (!email) {
      throw new Error("No email found on pendingReading or session");
    }
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const created = await auth.createUser({ email, emailVerified: false });
      uid = created.uid;
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      tx.set(userRef, {
        email,
        attribution: pending.attribution || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sourceFlow: "face_rating",
      });
    } else {
      tx.update(userRef, {
        lastFaceRatingAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Per-user face-readings ledger (lighter than userCredits — face rating
    // is a one-time SKU, no balance/subscription concept).
    const userCreditsRef = db.collection("userCredits").doc(uid);
    const userCreditsSnap = await tx.get(userCreditsRef);
    const purchaseEntry = {
      packageId: "face_rating_single",
      creditAmount: 1,
      pricePaid: session.amount_total || 499,
      purchaseDate: new Date(),
      stripeEventId,
      stripeSessionId: session.id,
      tier: "face_rating_single",
    };
    if (!userCreditsSnap.exists) {
      tx.set(userCreditsRef, {
        balance: 0,
        used: 0,
        purchaseHistory: [purchaseEntry],
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(userCreditsRef, {
        purchaseHistory:
          admin.firestore.FieldValue.arrayUnion(purchaseEntry),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Mark pending claimed.
    tx.update(pendingRef, {
      claimedByUid: uid,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "claimed",
    });

    const expireAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    );
    tx.set(markerRef, {
      stripeEventId,
      stripeSessionId: session.id,
      userId: uid,
      type: "face_rating_purchase",
      pendingReadingToken: token,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt,
    });

    return {
      ok: true,
      granted: true,
      reason: "processed" as const,
      uid,
    };
  });

  if (!txnResult.granted) {
    return txnResult;
  }

  // Outside the transaction: kick off Stage 2 analysis. Don't fail the
  // webhook if Stage 2 errors — the result page can lazy-run via
  // getFaceFullReport.
  try {
    const stage2 = await runFaceStage2ForToken(token);
    if (!stage2.ok) {
      console.warn(
        `[FaceWebhook] Stage 2 failed (will retry on result-page lazy run):`,
        stage2.reason,
      );
    }
  } catch (stage2Err) {
    console.warn("[FaceWebhook] Stage 2 dispatch threw:", stage2Err);
  }

  // Server-side Purchase mirror.
  try {
    const eventId =
      typeof pending.fbEventId === "string" && pending.fbEventId.length > 0
        ? pending.fbEventId
        : `srv-face-rating-${session.id}`;
    const userData: ServerUserData = {
      uid: txnResult.uid!,
      email: pending.email,
      fbp: pending.attribution?.fbp,
      fbc: pending.attribution?.fbc,
      gaClientId: pending.attribution?.gaClientId,
    };
    await dispatchServerConversion(
      {
        name: "Purchase",
        eventId,
        customData: {
          currency: "USD",
          value: (session.amount_total || 499) / 100,
          content_ids: ["face_rating_single"],
          content_name: "Face Rating Purchase",
          content_category: "face_rating_single",
          num_items: 1,
          transaction_id: session.id,
        },
      },
      userData,
    );
  } catch (convErr) {
    console.warn(
      "[FaceWebhook] Purchase CAPI dispatch failed (non-fatal):",
      convErr,
    );
  }

  return txnResult;
}
