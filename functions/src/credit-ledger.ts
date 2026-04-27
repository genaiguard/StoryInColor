import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Atomically deducts `cost` credits from `userCredits/{userId}` and appends a
 * `deduct` entry to `usageHistory`. Throws `Error("INSUFFICIENT_CREDITS")` if
 * the user's balance is below the cost or the doc does not exist.
 */
export async function deductCreditsTx(params: {
  userId: string;
  cost: number;
  jobId: string;
  toolId: string;
}): Promise<void> {
  const { userId, cost, jobId, toolId } = params;
  const credRef = db.collection("userCredits").doc(userId);

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
      usageHistory: admin.firestore.FieldValue.arrayUnion({
        type: "deduct",
        toolId,
        jobId,
        cost,
        date: admin.firestore.Timestamp.now(),
      }),
      lastUpdated: admin.firestore.Timestamp.now(),
    });
  });
}

/**
 * Atomically refunds `cost` credits to `userCredits/{userId}` and appends a
 * `refund` entry to `usageHistory`. Idempotent on `jobId` — if a refund entry
 * with this jobId already exists, the operation is a no-op.
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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(credRef);
    if (!snap.exists) {
      // Nothing to refund against — silently no-op to keep idempotent behavior.
      return;
    }
    const history = (snap.data()?.usageHistory ?? []) as Array<{
      type?: string;
      jobId?: string;
    }>;
    const alreadyRefunded = history.some(
      (entry) => entry?.type === "refund" && entry?.jobId === jobId,
    );
    if (alreadyRefunded) {
      return;
    }
    tx.update(credRef, {
      balance: admin.firestore.FieldValue.increment(cost),
      used: admin.firestore.FieldValue.increment(-cost),
      usageHistory: admin.firestore.FieldValue.arrayUnion({
        type: "refund",
        toolId,
        jobId,
        cost,
        reason,
        date: admin.firestore.Timestamp.now(),
      }),
      lastUpdated: admin.firestore.Timestamp.now(),
    });
  });
}
