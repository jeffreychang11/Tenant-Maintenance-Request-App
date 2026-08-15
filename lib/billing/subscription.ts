import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";

export type SubscriptionRow = Tables<"subscriptions">;

const UNLOCKED_STATUSES = new Set(["trialing", "active"]);

export type AccessStatus = {
  locked: boolean;
  trialing: boolean;
  trialEndsAt: string | null;
  daysLeftInTrial: number | null;
};

// Never stored — computed fresh from (trial_ends_at, status) wherever it's
// needed, so it can never drift out of sync with what Stripe/the DB think.
export function computeAccessStatus(sub: SubscriptionRow | null): AccessStatus {
  if (!sub) return { locked: true, trialing: false, trialEndsAt: null, daysLeftInTrial: null };

  if (sub.status && UNLOCKED_STATUSES.has(sub.status)) {
    // A real Stripe subscription in "trialing" status still has a trial to
    // count down — its trial end is Stripe's current_period_end, not our
    // local trial_ends_at (which stops being the source of truth once a
    // Stripe subscription actually exists).
    if (sub.status === "trialing" && sub.current_period_end) {
      const msLeft = new Date(sub.current_period_end).getTime() - Date.now();
      return {
        locked: false,
        trialing: true,
        trialEndsAt: sub.current_period_end,
        daysLeftInTrial: Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
      };
    }
    return { locked: false, trialing: sub.status === "trialing", trialEndsAt: null, daysLeftInTrial: null };
  }

  const trialEndsAt = new Date(sub.trial_ends_at);
  const msLeft = trialEndsAt.getTime() - Date.now();

  if (sub.status === null && msLeft > 0) {
    return {
      locked: false,
      trialing: true,
      trialEndsAt: sub.trial_ends_at,
      daysLeftInTrial: Math.ceil(msLeft / (24 * 60 * 60 * 1000)),
    };
  }

  return { locked: true, trialing: false, trialEndsAt: sub.trial_ends_at, daysLeftInTrial: 0 };
}

export async function getSubscriptionForLandlord(
  supabase: SupabaseClient<Database>,
  landlordId: string
): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("landlord_id", landlordId)
    .single();
  return data;
}

export async function countUnitsForLandlord(
  supabase: SupabaseClient<Database>,
  landlordId: string
): Promise<number> {
  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("landlord_id", landlordId);

  const propertyIds = (properties ?? []).map((p) => p.id);
  if (propertyIds.length === 0) return 0;

  const { count } = await supabase
    .from("units")
    .select("id", { count: "exact", head: true })
    .in("property_id", propertyIds);

  return count ?? 0;
}
