// Server-side credit pack catalog. Mirrors the client-side
// CREDIT_PACKAGES exported from app/firebase/credits-helpers.ts so that
// stripeWebhook + createCreditCheckout share one pricing surface across
// the client UI and the server-side billing path.
//
// If you change pricing here, update app/firebase/credits-helpers.ts to
// match — they are kept in sync by hand because functions/ ships as a
// separate npm tree (no shared imports).
//
// Pricing model: 1 credit == 1 reading. Single-issue is the headline
// price; trio + set discount per-reading. The coloring page is free
// (creditCost: 0 in tool-prompts.ts) and is not represented here.
//
// Realigned to $4.99 / credit anchor — same as the face-rating product
// on /face-rating. Pack discount ladder (~0% / 20% / 33%) preserved.

export interface CreditPackage {
  id: string;
  credits: number;
  price: number; // in cents
  pricePerCredit: number; // in cents
  discountPercentage: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  // Single Issue — $4.99 for one reading. Headline anchor / impulse SKU.
  // Aligned with the face-rating one-time product on /face-rating.
  { id: "single", credits: 1, price: 499, pricePerCredit: 499, discountPercentage: 0 },
  // Three Readings — $11.99, ~20% off per reading vs Single. Default "most loved".
  { id: "trio",   credits: 3, price: 1199, pricePerCredit: 400, discountPercentage: 20 },
  // Six Readings — $19.99, ~33% off per reading. Heavy / gift bundle.
  { id: "set",    credits: 6, price: 1999, pricePerCredit: 333, discountPercentage: 33 },
];
