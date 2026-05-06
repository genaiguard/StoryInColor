// Scheduled cleanup of expired pendingReadings.
// Per QUIZ-PIVOT-SPEC.md §3.3.2 §8.1.
//
// Firestore TTL deletes the doc; this function removes the corresponding
// Storage assets (input + output + blurred) since TTL doesn't reach Storage.

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { isFaceRatingEnabled } from "./face-rating-types";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * Runs every 6 hours. Finds pendingReadings whose expiresAt is past and
 * which haven't been claimed; deletes their Storage assets and marks the
 * doc as expired (Firestore TTL will then delete the doc itself).
 */
export const cleanupExpiredPendingReadings = onSchedule(
  {
    schedule: "every 6 hours",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    if (!isFaceRatingEnabled()) {
      console.log("[Cleanup] Face rating disabled — skipping.");
      return;
    }
    const now = admin.firestore.Timestamp.now();

    const snap = await db
      .collection("pendingReadings")
      .where("expiresAt", "<", now)
      .where("status", "in", ["processing", "ready", "failed"])
      .limit(500)
      .get();

    console.log(`[Cleanup] Found ${snap.size} expired pendingReadings`);
    let deleted = 0;
    let errors = 0;

    for (const doc of snap.docs) {
      const token = doc.id;
      try {
        // Delete the entire pending/{token}/ folder
        await bucket.deleteFiles({ prefix: `pending/${token}/` });
        await doc.ref.update({ status: "expired" });
        deleted++;
      } catch (err) {
        console.error(`[Cleanup] Failed for token=${token}:`, err);
        errors++;
      }
    }

    console.log(
      `[Cleanup] Done. Deleted ${deleted} pending readings, errors: ${errors}`,
    );
  },
);
