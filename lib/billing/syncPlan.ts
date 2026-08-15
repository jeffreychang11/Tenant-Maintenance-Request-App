import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { determineTier, priceIdFor, type Tier } from "@/lib/stripe/plans";

// Switches a landlord's Stripe subscription to `newTier` (same billing
// interval it's already on) and mirrors the result onto the `subscriptions`
// row. Shared by the automatic sync below (shrinking — never needs the
// landlord's confirmation, since it only ever lowers their bill) and
// `applyConfirmedUpgrade` in unitLimit.ts (growing — only called after the
// landlord has explicitly confirmed the prorated cost).
export async function applyTierChange(
  landlordId: string,
  newTier: Tier,
  options: { prorationBehavior?: "create_prorations" | "none" } = {}
) {
  if (!stripe) return;
  const { prorationBehavior = "create_prorations" } = options;

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();

  if (!sub?.stripe_subscription_id) return;

  const interval = (sub.billing_interval ?? "month") as "month" | "year";
  const newPriceId = priceIdFor(newTier, interval);
  if (!newPriceId) return; // price env var for this tier/interval isn't configured

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = stripeSub.items.data[0];
  if (!item) return;

  const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [{ id: item.id, price: newPriceId }],
    proration_behavior: prorationBehavior,
  });

  await admin
    .from("subscriptions")
    .update({
      tier: newTier,
      stripe_price_id: newPriceId,
      status: updated.status,
      current_period_end: new Date(updated.items.data[0].current_period_end * 1000).toISOString(),
    })
    .eq("landlord_id", landlordId);
}

type SyncOptions = {
  allowAnnual?: boolean;
  prorationBehavior?: "create_prorations" | "none";
};

// Called after deleteProperty, which can only ever shrink a landlord's unit
// count — createProperty/createUnit no longer call this directly; growing
// past the current tier's ceiling is gated through unitLimit.ts's
// checkUnitLimit/applyConfirmedUpgrade instead, which asks the landlord to
// confirm the prorated cost before adding the unit. No-ops cleanly whenever
// there's nothing to do — no Stripe subscription yet (trial-only), the
// subscription isn't in a state that should be touched, it's an annual
// plan (never force-changed mid-term unless explicitly re-evaluated at
// renewal via { allowAnnual: true }), the unit count doesn't map to any
// tier (0 or >10 — no price exists for either), or the tier hasn't
// actually changed.
export async function syncPlanForUnitCount(landlordId: string, options: SyncOptions = {}) {
  if (!stripe) return;
  const { allowAnnual = false, prorationBehavior = "create_prorations" } = options;

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();

  if (!sub?.stripe_subscription_id) return;
  if (!sub.status || !["trialing", "active"].includes(sub.status)) return;
  if (sub.billing_interval === "year" && !allowAnnual) return;

  const { data: properties } = await admin
    .from("properties")
    .select("id")
    .eq("landlord_id", landlordId);
  const propertyIds = (properties ?? []).map((p) => p.id);

  let unitCount = 0;
  if (propertyIds.length > 0) {
    const { count } = await admin
      .from("units")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds);
    unitCount = count ?? 0;
  }

  const newTier = determineTier(unitCount);
  if (!newTier || newTier === sub.tier) return; // 0 or >10 units, or no change

  await applyTierChange(landlordId, newTier, { prorationBehavior });
}
