// One-time setup: creates the 3 Stripe Products/Prices this app bills
// against, and prints the resulting price IDs to paste into .env.local.
// Re-running this creates duplicates — it's meant to run once per Stripe
// account (e.g. once for test mode, once again when you go live).
//
// Usage:
//   set -a && source .env.local && set +a && node scripts/stripe-setup.mjs

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is not set. Add it to .env.local first.");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const tier1to3 = await stripe.products.create({ name: "Landlord Plan — 1-3 Units" });
const price1to3Monthly = await stripe.prices.create({
  product: tier1to3.id,
  currency: "usd",
  unit_amount: 999,
  recurring: { interval: "month" },
});
const price1to3Yearly = await stripe.prices.create({
  product: tier1to3.id,
  currency: "usd",
  unit_amount: 9588,
  recurring: { interval: "year" },
});

const tier4to10 = await stripe.products.create({ name: "Landlord Plan — 4-10 Units" });
const price4to10Monthly = await stripe.prices.create({
  product: tier4to10.id,
  currency: "usd",
  unit_amount: 2499,
  recurring: { interval: "month" },
});
const price4to10Yearly = await stripe.prices.create({
  product: tier4to10.id,
  currency: "usd",
  unit_amount: 23988,
  recurring: { interval: "year" },
});

console.log("\nAdd these to .env.local:\n");
console.log(`STRIPE_PRICE_TIER_1_3_MONTHLY=${price1to3Monthly.id}`);
console.log(`STRIPE_PRICE_TIER_1_3_YEARLY=${price1to3Yearly.id}`);
console.log(`STRIPE_PRICE_TIER_4_10_MONTHLY=${price4to10Monthly.id}`);
console.log(`STRIPE_PRICE_TIER_4_10_YEARLY=${price4to10Yearly.id}`);
