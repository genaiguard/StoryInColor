// Server-side credit pack catalog. Mirrors the client-side
// CREDIT_PACKAGES exported from app/firebase/credits-helpers.ts so that
// stripeWebhook + createCreditCheckout share one pricing surface across
// the client UI and the server-side billing path.
//
// If you change pricing here, update app/firebase/credits-helpers.ts to
// match — they are kept in sync by hand because functions/ ships as a
// separate npm tree (no shared imports).

export interface CreditPackage {
  id: string;
  credits: number;
  price: number; // in cents
  pricePerCredit: number; // in cents
  discountPercentage: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "small",  credits: 5,  price: 350,  pricePerCredit: 70, discountPercentage: 0 },
  { id: "medium", credits: 10, price: 600,  pricePerCredit: 60, discountPercentage: 14 },
  { id: "large",  credits: 20, price: 1000, pricePerCredit: 50, discountPercentage: 29 },
  { id: "xlarge", credits: 40, price: 1800, pricePerCredit: 45, discountPercentage: 36 },
];
