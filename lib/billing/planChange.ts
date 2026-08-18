import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { priceIdFor, UNIT_RANGES, type Tier, type BillingInterval } from "@/lib/stripe/plans";
import { applyTierChange } from "@/lib/billing/syncPlan";
import { countUnitsForLandlord } from "@/lib/billing/subscription";

export type PlanChangePreview =
  | { status: "ok"; amountDueCents: number }
  | { status: "blocked"; message: string }
  | { status: "unavailable" };

// Shared by both preview functions below — a real Stripe-computed prorated
// amount for swapping the subscription's single item to `newPriceId`,
// mirroring the same stripe.invoices.createPreview usage already proven in
// unitLimit.ts. Can come back negative (a credit, not a charge) when the
// new price is cheaper than the current one.
async function previewPriceSwap(
  stripeSubscriptionId: string,
  newPriceId: string
): Promise<number | null> {
  if (!stripe) return null;
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = stripeSub.items.data[0];
  if (!item) return null;

  const preview = await stripe.invoices.createPreview({
    subscription: stripeSubscriptionId,
    subscription_details: {
      items: [{ id: item.id, price: newPriceId }],
      proration_behavior: "create_prorations",
    },
  });
  return preview.amount_due;
}

// Preview switching the landlord's current tier from monthly to yearly
// billing. Only valid when they're actually subscribed to `tier` on a
// monthly interval already — the button that calls this is only shown in
// that state, but this re-derives it from the DB rather than trusting the
// client either way.
export async function previewYearlySwitch(landlordId: string, tier: Tier): Promise<PlanChangePreview> {
  if (!stripe) return { status: "unavailable" };
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();

  if (!sub?.stripe_subscription_id || sub.tier !== tier || sub.billing_interval !== "month") {
    return { status: "unavailable" };
  }

  const newPriceId = priceIdFor(tier, "year");
  if (!newPriceId) return { status: "unavailable" };

  try {
    const amountDueCents = await previewPriceSwap(sub.stripe_subscription_id, newPriceId);
    if (amountDueCents === null) return { status: "unavailable" };
    return { status: "ok", amountDueCents };
  } catch (err) {
    console.error(`[billing] Failed to preview yearly switch for landlord ${landlordId}:`, err);
    return { status: "unavailable" };
  }
}

export async function applyYearlySwitch(landlordId: string, tier: Tier) {
  if (!stripe) return;
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();
  if (!sub?.stripe_subscription_id || sub.tier !== tier) return;

  const newPriceId = priceIdFor(tier, "year");
  if (!newPriceId) return;

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = stripeSub.items.data[0];
  if (!item) return;

  const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [{ id: item.id, price: newPriceId }],
    proration_behavior: "create_prorations",
  });

  await admin
    .from("subscriptions")
    .update({
      billing_interval: "year",
      stripe_price_id: newPriceId,
      status: updated.status,
      current_period_end: new Date(updated.items.data[0].current_period_end * 1000).toISOString(),
    })
    .eq("landlord_id", landlordId);
}

// Preview downgrading from Premium to Basic. Gated on the landlord's unit
// count actually fitting Basic's range — unlike growing (where the app
// picks the upgrade for you), shrinking tiers is the landlord's call, but
// only once their own units are already within range.
export async function previewDowngradeToBasic(landlordId: string): Promise<PlanChangePreview> {
  if (!stripe) return { status: "unavailable" };
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();
  if (!sub?.stripe_subscription_id || sub.tier !== "tier_4_10") return { status: "unavailable" };

  const unitCount = await countUnitsForLandlord(admin, landlordId);
  if (unitCount > UNIT_RANGES.tier_1_3.max) {
    return {
      status: "blocked",
      message: `You have ${unitCount} units — get your unit count down to ${UNIT_RANGES.tier_1_3.max} or fewer to downgrade to Basic.`,
    };
  }

  const interval = (sub.billing_interval ?? "month") as "month" | "year";
  const newPriceId = priceIdFor("tier_1_3", interval);
  if (!newPriceId) return { status: "unavailable" };

  try {
    const amountDueCents = await previewPriceSwap(sub.stripe_subscription_id, newPriceId);
    if (amountDueCents === null) return { status: "unavailable" };
    return { status: "ok", amountDueCents };
  } catch (err) {
    console.error(`[billing] Failed to preview downgrade for landlord ${landlordId}:`, err);
    return { status: "unavailable" };
  }
}

// Re-checks the unit-count gate server-side (never trusts that the client
// already saw an "ok" preview) before actually swapping the subscription's
// price down to Basic, same precedent as unitLimit.ts's confirmed-upgrade
// flow trusting `confirmed` only as permission to re-derive, not a fact.
export async function applyDowngradeToBasic(landlordId: string) {
  const admin = createAdminClient();
  const unitCount = await countUnitsForLandlord(admin, landlordId);
  if (unitCount > UNIT_RANGES.tier_1_3.max) {
    throw new Error(
      `You have ${unitCount} units — get your unit count down to ${UNIT_RANGES.tier_1_3.max} or fewer to downgrade to Basic.`
    );
  }
  await applyTierChange(landlordId, "tier_1_3", { prorationBehavior: "create_prorations" });
}

// Preview upgrading from Basic to Premium, in either billing interval — an
// in-place prorated swap on the existing subscription, unlike the plain
// Subscribe buttons (createCheckoutSession), which would start a second,
// separate subscription instead of replacing the first. No unit-count gate
// needed here: Premium's range is a superset of Basic's, so any landlord
// eligible for Basic already fits Premium too.
export async function previewUpgradeToPremium(
  landlordId: string,
  interval: BillingInterval
): Promise<PlanChangePreview> {
  if (!stripe) return { status: "unavailable" };
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();
  if (!sub?.stripe_subscription_id || sub.tier !== "tier_1_3") return { status: "unavailable" };

  const newPriceId = priceIdFor("tier_4_10", interval);
  if (!newPriceId) return { status: "unavailable" };

  try {
    const amountDueCents = await previewPriceSwap(sub.stripe_subscription_id, newPriceId);
    if (amountDueCents === null) return { status: "unavailable" };
    return { status: "ok", amountDueCents };
  } catch (err) {
    console.error(`[billing] Failed to preview upgrade to Premium for landlord ${landlordId}:`, err);
    return { status: "unavailable" };
  }
}

export async function applyUpgradeToPremium(landlordId: string, interval: BillingInterval) {
  if (!stripe) return;
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();
  if (!sub?.stripe_subscription_id || sub.tier !== "tier_1_3") return;

  const newPriceId = priceIdFor("tier_4_10", interval);
  if (!newPriceId) return;

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = stripeSub.items.data[0];
  if (!item) return;

  const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [{ id: item.id, price: newPriceId }],
    proration_behavior: "create_prorations",
  });

  await admin
    .from("subscriptions")
    .update({
      tier: "tier_4_10",
      billing_interval: interval,
      stripe_price_id: newPriceId,
      status: updated.status,
      current_period_end: new Date(updated.items.data[0].current_period_end * 1000).toISOString(),
    })
    .eq("landlord_id", landlordId);
}
