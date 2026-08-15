import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { countUnitsForLandlord } from "@/lib/billing/subscription";
import { applyTierChange } from "@/lib/billing/syncPlan";
import { UNIT_RANGES, nextTierUp, priceIdFor, type Tier, type BillingInterval } from "@/lib/stripe/plans";

export type UnitLimitResult =
  | { status: "ok" }
  | { status: "needs_upgrade"; targetTier: Tier; interval: BillingInterval; amountDueCents: number }
  | { status: "blocked"; message: string };

// Enforces that a landlord's unit count actually fits the tier they're
// subscribed to. A trial-only landlord (no real Stripe subscription yet)
// isn't gated at all — they haven't chosen a plan to hold them to. Once
// subscribed, adding units that would cross the current tier's ceiling
// returns "needs_upgrade" with a live Stripe-computed prorated cost instead
// of silently switching them — createProperty/createUnit only proceed with
// the insert once the landlord has confirmed that cost (or never crossed
// the ceiling to begin with).
export async function checkUnitLimit(
  supabase: SupabaseClient<Database>,
  landlordId: string,
  addingCount: number
): Promise<UnitLimitResult> {
  if (addingCount <= 0) return { status: "ok" };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();

  if (!sub?.stripe_subscription_id || !sub.tier) return { status: "ok" };
  if (!sub.status || !["trialing", "active"].includes(sub.status)) return { status: "ok" };

  const currentTier = sub.tier as Tier;
  const range = UNIT_RANGES[currentTier];
  if (!range) return { status: "ok" };

  const currentCount = await countUnitsForLandlord(supabase, landlordId);
  const newCount = currentCount + addingCount;
  if (newCount <= range.max) return { status: "ok" };

  const nextTier = nextTierUp(currentTier);
  if (!nextTier) {
    return {
      status: "blocked",
      message: `You're at the ${range.max}-unit maximum for your plan. Contact us for custom enterprise pricing before adding more.`,
    };
  }

  const nextRange = UNIT_RANGES[nextTier];
  if (newCount > nextRange.max) {
    return {
      status: "blocked",
      message: `That would put you at ${newCount} units, above the ${nextRange.max}-unit maximum we offer. Contact us for custom enterprise pricing.`,
    };
  }

  if (!stripe) return { status: "ok" }; // Stripe isn't configured — fail open rather than block property management entirely

  const interval = (sub.billing_interval ?? "month") as BillingInterval;
  const newPriceId = priceIdFor(nextTier, interval);
  if (!newPriceId) return { status: "ok" };

  try {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = stripeSub.items.data[0];
    if (!item) return { status: "ok" };

    const preview = await stripe.invoices.createPreview({
      subscription: sub.stripe_subscription_id,
      subscription_details: {
        items: [{ id: item.id, price: newPriceId }],
        proration_behavior: "create_prorations",
      },
    });

    return {
      status: "needs_upgrade",
      targetTier: nextTier,
      interval,
      amountDueCents: Math.max(0, preview.amount_due),
    };
  } catch (err) {
    console.error(`[billing] Failed to preview upgrade for landlord ${landlordId}:`, err);
    return { status: "ok" }; // fail open — a Stripe hiccup shouldn't block basic property management
  }
}

// Performs the actual tier upgrade once the landlord has confirmed the
// prorated cost shown for a `needs_upgrade` result.
export async function applyConfirmedUpgrade(landlordId: string, targetTier: Tier) {
  await applyTierChange(landlordId, targetTier, { prorationBehavior: "create_prorations" });
}
