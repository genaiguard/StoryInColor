#!/usr/bin/env node
/**
 * One-shot setup: creates the Stripe products + prices the platform uses.
 * Idempotent — running twice is safe (uses `lookup_key` so it finds
 * existing prices and skips creating duplicates).
 *
 * After the platform restructure (May 2026), the catalog is just:
 *
 *   1. face_rating_single_v1 — $4.99 one-time, the unauth /face-rating
 *      product. Resolved by lookup_key in functions/src/face-rating-checkout.ts.
 *
 * Credit-pack purchases on /credits do NOT use Stripe Products —
 * createCreditCheckout in functions/src/index.ts builds inline price_data
 * objects from CREDIT_PACKAGES (see functions/src/credit-packages.ts and
 * app/firebase/credits-helpers.ts, kept in sync by hand).
 *
 * The previous quiz-funnel subscription products (quiz_two_pack_v2,
 * quiz_monthly_v2, quiz_annual_v2, quiz_trial_dollar) and the legacy
 * single quiz_single_v2 are NOT created by this script anymore. If they
 * already exist in your Stripe dashboard from a previous run, you can
 * archive them manually — no traffic hits them.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe-products.mjs
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.mjs
 */

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("Set STRIPE_SECRET_KEY env var before running.");
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: "2026-04-22.dahlia" });

const PRODUCTS = [
  // Face Rating — single SKU, $4.99 one-time. The whole platform now
  // anchors on this price (CAC × 1.40, see PIVOT-2.md §5).
  {
    name: "StoryInColor — Face Rating",
    description:
      "One full face rating with PSL tier, sub-scores, archetype, percentile, strengths, growth areas, celebrity look-alikes, glow-up plan, and 14-day free re-rate of the same face. One-time purchase.",
    metadata: { source: "face_rating", tier: "single" },
    price: {
      lookup_key: "face_rating_single_v1",
      unit_amount: 499, // $4.99
      currency: "usd",
    },
  },
];

async function findOrCreateProduct(spec) {
  const existing = await stripe.products.search({
    query: `metadata['source']:'${spec.metadata.source}' AND metadata['tier']:'${spec.metadata.tier}'`,
  });
  if (existing.data.length > 0) {
    console.log(`  product (existing): ${existing.data[0].id} — ${spec.name}`);
    return existing.data[0];
  }
  const product = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: spec.metadata,
  });
  console.log(`  product (created):  ${product.id} — ${spec.name}`);
  return product;
}

async function findOrCreatePrice(product, priceSpec) {
  const existing = await stripe.prices.list({
    lookup_keys: [priceSpec.lookup_key],
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) {
    console.log(
      `    price   (existing): ${existing.data[0].id} — lookup_key=${priceSpec.lookup_key}`,
    );
    return existing.data[0];
  }
  const params = {
    product: product.id,
    unit_amount: priceSpec.unit_amount,
    currency: priceSpec.currency,
    lookup_key: priceSpec.lookup_key,
  };
  if (priceSpec.recurring) {
    params.recurring = priceSpec.recurring;
  }
  const price = await stripe.prices.create(params);
  console.log(
    `    price   (created):  ${price.id} — lookup_key=${priceSpec.lookup_key}`,
  );
  return price;
}

async function main() {
  console.log("Setting up StoryInColor Stripe products + prices…\n");
  const out = [];
  for (const spec of PRODUCTS) {
    const product = await findOrCreateProduct(spec);
    const price = await findOrCreatePrice(product, spec.price);
    out.push({
      tier: spec.metadata.tier,
      productId: product.id,
      priceId: price.id,
      lookupKey: spec.price.lookup_key,
      amount: spec.price.unit_amount,
    });
  }
  console.log("\nDone. Summary:");
  for (const row of out) {
    console.log(
      `  ${row.tier.padEnd(15)} ${row.productId} ${row.priceId} (${row.lookupKey}, $${(row.amount / 100).toFixed(2)})`,
    );
  }
  console.log(
    "\nfunctions/src/face-rating-checkout.ts resolves these by lookup_key — no code change needed when test/live IDs differ.",
  );
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
