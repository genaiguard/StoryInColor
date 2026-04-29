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

export interface CreditPackage {
  id: string;
  credits: number;
  price: number; // in cents
  pricePerCredit: number; // in cents
  discountPercentage: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  // Single Issue — $9.99 for one reading. Headline anchor / impulse SKU.
  { id: "single", credits: 1, price: 999, pricePerCredit: 999, discountPercentage: 0 },
  // Three Readings — $24, ~20% off per reading vs Single. Default "most loved".
  { id: "trio",   credits: 3, price: 2400, pricePerCredit: 800, discountPercentage: 20 },
  // Six Readings — $39, ~35% off per reading. Heavy / gift bundle.
  { id: "set",    credits: 6, price: 3900, pricePerCredit: 650, discountPercentage: 35 },
];
