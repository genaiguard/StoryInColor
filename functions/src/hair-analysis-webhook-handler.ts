// Webhook handler for hair_analysis_purchase Stripe sessions.
// Mirrors face-rating-webhook-handler.ts — no Stage 2 needed since all 8
// cells are already generated before payment.

import * as admin from "firebase-admin";
import type { Stripe } from "stripe/cjs/stripe.core.js";
import type { PendingHairAnalysisDoc } from "./hair-analysis-types";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

export async function handleHairAnalysisPurchase(input: {
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
}): Promise<{ ok: boolean; granted: boolean; reason: string }> {
  const { event, session } = input;

  const token = session.metadata?.token;
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

  const pending = pendingSnap.data() as PendingHairAnalysisDoc;
  if (pending.type !== "hair-analysis") {
    console.warn(`[HairWebhook] token=${token} is not a hair-analysis doc; refusing.`);
    return { ok: false, granted: false, reason: "wrong-type" };
  }

  const markerRef = db.collection("processedStripeEvents").doc(stripeEventId);

  const txnResult = await db.runTransaction(async (tx) => {
    const markerSnap = await tx.get(markerRef);
    if (markerSnap.exists) {
      return { ok: true, granted: false, reason: "already-processed" as const };
    }

    // Resolve email: prefer what the user typed in the email-gate; fall back
    // to Stripe's captured email so we always have something for Auth.
    const email =
      pending.email ||
      session.customer_email ||
      session.customer_details?.email ||
      undefined;

    // Create or retrieve Firebase Auth user if we have an email, so the
    // AccountClaimCard can let them set a password and access the dashboard.
    let uid: string | undefined;
    if (email) {
      try {
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
      } catch {
        const created = await auth.createUser({ email, emailVerified: false });
        uid = created.uid;
      }
    }

    tx.update(pendingRef, {
      status: "claimed",
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(uid ? { claimedByUid: uid } : {}),
      // Backfill email if user skipped the email-gate and Stripe captured it.
      ...(email && !pending.email ? { email } : {}),
    } as FirebaseFirestore.UpdateData<PendingHairAnalysisDoc>);

    const expireAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    );
    tx.set(markerRef, {
      stripeEventId,
      stripeSessionId: session.id,
      type: "hair_analysis_purchase",
      pendingReadingToken: token,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt,
    });

    return { ok: true, granted: true, reason: "processed" as const };
  });

  return txnResult;
}
