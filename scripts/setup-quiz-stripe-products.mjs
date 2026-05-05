#!/usr/bin/env node
/**
 * One-shot setup: creates the Stripe products + prices for the quiz funnel.
 * Idempotent — running twice is safe (uses `lookup_key` so it finds existing
 * prices and skips creating duplicates).
 *
 * Per QUIZ-PIVOT-SPEC.md §17 §8.5.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/setup-quiz-stripe-products.mjs
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-quiz-stripe-products.mjs   # for test mode
 *
 * Output: prints the price IDs and lookup keys it created/found. Save these
 * for the founder; functions/src/quiz-checkout.ts resolves them at runtime
 * via lookup_key, so no code changes are needed when the IDs differ between
 * Stripe test and live modes.
 */

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("Set STRIPE_SECRET_KEY env var before running.");
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: "2026-04-22.dahlia" });

const PRODUCTS = [
  {
    name: "StoryInColor — Single reading",
    description: "One editorial AI reading. One-time purchase.",
    metadata: { source: "quiz_funnel", tier: "single" },
    price: {
      lookup_key: "quiz_single_v2",
      unit_amount: 1199, // $11.99
      currency: "usd",
      // one-time
    },
  },
  {
    name: "StoryInColor — Monthly Reading Plan",
    description:
      "Unlock today's reading + 3 readings/mo + Daily Reflections. 7-day free trial.",
    metadata: { source: "quiz_funnel", tier: "monthly" },
    price: {
      lookup_key: "quiz_monthly_v2",
      unit_amount: 1499, // $14.99/mo
      currency: "usd",
      recurring: { interval: "month", interval_count: 1 },
    },
  },
  {
    name: "StoryInColor — Annual Reading Plan",
    description:
      "Unlock today's reading + 4 readings/mo + Daily Reflections + early access. Save 50%.",
    metadata: { source: "quiz_funnel", tier: "annual" },
    price: {
      lookup_key: "quiz_annual_v2",
      unit_amount: 8999, // $89.99/yr
      currency: "usd",
      recurring: { interval: "year", interval_count: 1 },
    },
  },
  {
    name: "StoryInColor — Single reading (Trial $1)",
    description:
      "Recovery / promo single reading. One-time purchase. Used by exit-intent only when re-enabled.",
    metadata: { source: "quiz_funnel", tier: "trial_dollar" },
    price: {
      lookup_key: "quiz_trial_dollar",
      unit_amount: 100, // $1.00
      currency: "usd",
    },
  },
];

async function findOrCreateProduct(spec) {
  // Search by metadata.source + tier (idempotent)
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
  // Find existing by lookup_key
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
  console.log("Setting up StoryInColor quiz funnel Stripe products + prices…\n");
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
    "\nfunctions/src/quiz-checkout.ts resolves these by lookup_key — no code change needed.",
  );
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
