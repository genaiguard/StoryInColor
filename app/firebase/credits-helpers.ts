import { getFirestore, doc, getDoc, Timestamp } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"

// Constants
// One credit == one reading. No signup grant — every editorial reading is
// paid. Mirrors functions/src/ensure-user-credits.ts.
export const FREE_CREDITS_PER_USER = 0;

// Interface for credit purchase packages
export interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  discountPercentage: number;
}

// Credit packages configuration. Mirrors functions/src/credit-packages.ts —
// keep them in sync by hand (no shared module across the two npm trees).
//
// Pricing model: 1 credit == 1 reading. Single-issue is the headline price;
// trio + set discount per-reading. The coloring page is free (creditCost 0
// in the registry) and is not represented as a pack.
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'single',
    credits: 1,
    price: 999, // $9.99
    pricePerCredit: 999,
    discountPercentage: 0,
  },
  {
    id: 'trio',
    credits: 3,
    price: 2400, // $24.00
    pricePerCredit: 800,
    discountPercentage: 20,
  },
  {
    id: 'set',
    credits: 6,
    price: 3900, // $39.00
    pricePerCredit: 650,
    discountPercentage: 35,
  },
];

// Interface for user credits. Usage history was migrated out of this doc
// (1MB array cap on heavy users) and now lives in
// userCredits/{uid}/usageEvents/{deduct|refund-jobId}.
export interface UserCredits {
  balance: number;
  used: number;
  purchaseHistory: CreditPurchase[];
  lastUpdated: Timestamp | null;
}

// Interface for credit purchase history
export interface CreditPurchase {
  packageId: string;
  creditAmount: number;
  pricePaid: number; // in cents
  purchaseDate: Timestamp;
  isInitialCredits?: boolean;
}

// Per-event usage record stored in usageEvents subcollection.
export interface CreditUsageEvent {
  type: "deduct" | "refund";
  toolId?: string | null;
  jobId?: string | null;
  cost: number;
  reason?: string | null;
  date: Timestamp;
}

// SECURITY: userCredits/{uid} is locked to admin-only writes in
// firestore.rules. The client cannot setDoc directly. New users are
// bootstrapped through the `ensureUserCredits` callable Cloud Function
// (server-side, idempotent, bypasses rules via admin SDK).
export async function initializeUserCredits(userId: string): Promise<UserCredits> {
  const functions = getFunctions();
  const ensure = httpsCallable(functions, "ensureUserCredits");
  await ensure({});
  // Re-read the doc (now guaranteed to exist on the server side)
  const db = getFirestore();
  const snap = await getDoc(doc(db, "userCredits", userId));
  if (!snap.exists()) {
    throw new Error("ensureUserCredits succeeded but userCredits doc still missing");
  }
  return snap.data() as UserCredits;
}

// Get user's current credits — bootstraps the doc on first read.
export async function getUserCredits(userId: string): Promise<UserCredits> {
  const db = getFirestore();
  const snap = await getDoc(doc(db, "userCredits", userId));
  if (snap.exists()) {
    return snap.data() as UserCredits;
  }
  return initializeUserCredits(userId);
}

// NOTE: client-side useCredit / refundCredit / addCredits were removed in the
// multi-tool rebuild. ALL writes to userCredits go through Cloud Functions
// (admin SDK bypasses the locked-down firestore.rules):
//   - generateForTool: deducts on dispatch, refunds on failure
//   - stripeWebhook: increments balance on checkout.session.completed
//   - ensureUserCredits: idempotent bootstrap on first sign-in
// Keeping client helpers that wrote the same fields would have created
// split-brain and let a malicious client forge balance.

// Display-formatted user balance. The internal field is named `credits`
// for backwards compatibility with the ledger, but every user-facing
// surface presents it as "readings" since 1 credit == 1 reading.
export function formatCreditBalance(credits: number): string {
  return credits === 1 ? "1 reading" : `${credits} readings`;
}
