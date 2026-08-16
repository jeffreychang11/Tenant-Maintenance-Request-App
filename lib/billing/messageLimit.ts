import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyTierChange } from "@/lib/billing/syncPlan";
import { priceIdFor, type Tier, type BillingInterval } from "@/lib/stripe/plans";

// A Basic landlord gets warned well before the 350-400 buffer zone starts.
export const MESSAGE_CAP_WARNING_THRESHOLD = 0.8;

export type MessageUsage = {
  tier: Tier | null;
  periodMonth: string;
  messagesUsed: number;
  baseCap: number;
  bufferCap: number;
  bundleCap: number;
  effectiveCap: number;
  inBufferZone: boolean;
  blocked: boolean;
};

// Read-only usage snapshot for a landlord — used by the settings-page bar,
// the layout-level banner/popup, and the pre-disable check on the request
// detail page. Backed by the get_message_usage() RPC so the displayed
// numbers can never drift from what the request_messages trigger actually
// enforces (both read the same effective_message_cap() helper in SQL).
export async function getMessageUsage(
  supabase: SupabaseClient<Database>
): Promise<MessageUsage> {
  const { data } = await supabase.rpc("get_message_usage").single();
  if (!data) {
    return {
      tier: null,
      periodMonth: "",
      messagesUsed: 0,
      baseCap: 0,
      bufferCap: 0,
      bundleCap: 0,
      effectiveCap: 0,
      inBufferZone: false,
      blocked: false,
    };
  }
  return {
    tier: (data.tier as Tier | null) ?? null,
    periodMonth: data.period_month,
    messagesUsed: data.messages_used,
    baseCap: data.base_cap,
    bufferCap: data.buffer_cap,
    bundleCap: data.bundle_cap,
    effectiveCap: data.effective_cap,
    inBufferZone: data.in_buffer_zone,
    blocked: data.blocked,
  };
}

export type MessageCapUpgradeResult =
  | { status: "not_applicable" }
  | { status: "needs_upgrade"; targetTier: Tier; interval: BillingInterval; amountDueCents: number };

// Only meaningful for a Basic landlord who's blocked — offers the real,
// permanent, prorated upgrade to Premium (same mechanics as
// lib/billing/unitLimit.ts's checkUnitLimit/applyConfirmedUpgrade, just
// triggered by message volume instead of unit count).
export async function checkMessageCapUpgrade(landlordId: string): Promise<MessageCapUpgradeResult> {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();

  if (!sub?.stripe_subscription_id || sub.tier !== "tier_1_3") return { status: "not_applicable" };
  if (!stripe) return { status: "not_applicable" };

  const interval = (sub.billing_interval ?? "month") as BillingInterval;
  const newPriceId = priceIdFor("tier_4_10", interval);
  if (!newPriceId) return { status: "not_applicable" };

  try {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = stripeSub.items.data[0];
    if (!item) return { status: "not_applicable" };

    const preview = await stripe.invoices.createPreview({
      subscription: sub.stripe_subscription_id,
      subscription_details: {
        items: [{ id: item.id, price: newPriceId }],
        proration_behavior: "create_prorations",
      },
    });

    return {
      status: "needs_upgrade",
      targetTier: "tier_4_10",
      interval,
      amountDueCents: Math.max(0, preview.amount_due),
    };
  } catch (err) {
    console.error(`[billing] Failed to preview message-cap upgrade for landlord ${landlordId}:`, err);
    return { status: "not_applicable" };
  }
}

export async function applyConfirmedMessageCapUpgrade(landlordId: string) {
  await applyTierChange(landlordId, "tier_4_10", { prorationBehavior: "create_prorations" });
}
