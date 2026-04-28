import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const db = admin.firestore();

const FREE_CREDITS_PER_USER = 2;

/**
 * Server-side, idempotent initialiser for the userCredits doc.
 *
 * Why: firestore.rules is locked so users CANNOT write their own
 * userCredits/{uid}/{*} — otherwise a malicious user could grant themselves
 * unlimited balance from the browser console. The doc is now written only
 * via admin SDK (bypasses rules). On a fresh sign-up the client calls this
 * callable; existing users with a doc already in place no-op.
 *
 * Idempotent on userId — if the doc exists, we return it as-is. The Stripe
 * webhook is the only other path that writes this doc.
 */
export const ensureUserCredits = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const userId = request.auth.uid;
  const ref = db.collection("userCredits").doc(userId);
  const snap = await ref.get();
  if (snap.exists) {
    return { created: false };
  }

  const now = admin.firestore.Timestamp.now();
  await ref.set({
    balance: FREE_CREDITS_PER_USER,
    used: 0,
    purchaseHistory: [
      {
        packageId: "initial",
        creditAmount: FREE_CREDITS_PER_USER,
        pricePaid: 0,
        purchaseDate: now,
        isInitialCredits: true,
      },
    ],
    // usageHistory array intentionally omitted — usage events live in the
    // userCredits/{uid}/usageEvents subcollection (see credit-ledger.ts).
    lastUpdated: now,
  });

  return { created: true };
});
