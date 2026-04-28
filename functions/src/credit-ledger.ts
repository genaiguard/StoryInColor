import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Atomically deducts `cost` credits from `userCredits/{userId}` and writes a
 * `deduct` event to userCredits/{userId}/usageEvents/{jobId}. Throws
 * Error("INSUFFICIENT_CREDITS") if balance is too low or the doc is missing.
 *
 * The event is keyed by jobId so retries are deduplicated naturally and the
 * collection scales linearly with usage (the previous arrayUnion approach
 * capped at the 1MB doc limit, ~5–10k events per user).
 */
export async function deductCreditsTx(params: {
  userId: string;
  cost: number;
  jobId: string;
  toolId: string;
}): Promise<void> {
  const { userId, cost, jobId, toolId } = params;
  const credRef = db.collection("userCredits").doc(userId);
  const eventRef = credRef.collection("usageEvents").doc(`deduct-${jobId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(credRef);
    if (!snap.exists) {
      throw new Error("INSUFFICIENT_CREDITS");
    }
    const balance = (snap.data()?.balance ?? 0) as number;
    if (balance < cost) {
      throw new Error("INSUFFICIENT_CREDITS");
    }
    tx.update(credRef, {
      balance: admin.firestore.FieldValue.increment(-cost),
      used: admin.firestore.FieldValue.increment(cost),
      lastUpdated: admin.firestore.Timestamp.now(),
    });
    tx.set(eventRef, {
      type: "deduct",
      toolId,
      jobId,
      cost,
      date: admin.firestore.Timestamp.now(),
    });
  });
}

/**
 * Atomically refunds `cost` credits to `userCredits/{userId}` and writes a
 * `refund` event to userCredits/{userId}/usageEvents/refund-{jobId}.
 * Idempotent on jobId via a deterministic doc id — re-running the operation
 * is a no-op (the second tx.set on the same doc inside the transaction guard
 * detects the existing doc and bails).
 */
export async function refundCreditsTx(params: {
  userId: string;
  cost: number;
  jobId: string;
  toolId: string;
  reason: string;
}): Promise<void> {
  const { userId, cost, jobId, toolId, reason } = params;
  const credRef = db.collection("userCredits").doc(userId);
  const eventRef = credRef.collection("usageEvents").doc(`refund-${jobId}`);

  await db.runTransaction(async (tx) => {
    const credSnap = await tx.get(credRef);
    if (!credSnap.exists) {
      // Nothing to refund against — silently no-op to keep idempotent behavior.
      return;
    }
    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists) {
      // Already refunded — idempotent no-op
      return;
    }
    tx.update(credRef, {
      balance: admin.firestore.FieldValue.increment(cost),
      used: admin.firestore.FieldValue.increment(-cost),
      lastUpdated: admin.firestore.Timestamp.now(),
    });
    tx.set(eventRef, {
      type: "refund",
      toolId,
      jobId,
      cost,
      reason,
      date: admin.firestore.Timestamp.now(),
    });
  });
}
