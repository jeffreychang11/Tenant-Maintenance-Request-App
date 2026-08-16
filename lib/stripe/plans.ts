export type Tier = "tier_1_3" | "tier_4_10";
export type BillingInterval = "month" | "year";

export const PLAN_LABELS: Record<Tier, string> = {
  tier_1_3: "Basic",
  tier_4_10: "Premium",
};

export const PLAN_PRICES: Record<Tier, { month: string; year: string | null }> = {
  tier_1_3: { month: "$9.99/mo", year: "$95.88/yr" },
  tier_4_10: { month: "$24.99/mo", year: "$239.88/yr" },
};

// Raw cent amounts, so the yearly discount can be computed rather than
// hand-typed (stays correct if the prices above ever change). The 1-3 tier's
// yearly price is set to land on roughly the same discount percentage as
// the 4-10 tier (20%), not an independently-chosen number.
const TIER_1_3_MONTHLY_CENTS = 999;
const TIER_1_3_YEARLY_CENTS = 9588;
const TIER_4_10_MONTHLY_CENTS = 2499;
const TIER_4_10_YEARLY_CENTS = 23988;

function yearlySavingsPercent(monthlyCents: number, yearlyCents: number) {
  return Math.round(((monthlyCents * 12 - yearlyCents) / (monthlyCents * 12)) * 100);
}

export const TIER_1_3_YEARLY_SAVINGS_PERCENT = yearlySavingsPercent(
  TIER_1_3_MONTHLY_CENTS,
  TIER_1_3_YEARLY_CENTS
);
export const TIER_4_10_YEARLY_SAVINGS_PERCENT = yearlySavingsPercent(
  TIER_4_10_MONTHLY_CENTS,
  TIER_4_10_YEARLY_CENTS
);

export const YEARLY_SAVINGS_PERCENT: Record<Tier, number> = {
  tier_1_3: TIER_1_3_YEARLY_SAVINGS_PERCENT,
  tier_4_10: TIER_4_10_YEARLY_SAVINGS_PERCENT,
};

export const PLAN_DESCRIPTIONS: Record<Tier, string> = {
  tier_1_3: "I just want tenants to stop texting my personal cell phone.",
  tier_4_10: "I run a small business and need a professional dashboard.",
};

// Marketing-copy mirror of the monthly chat-message cap actually enforced
// by effective_message_cap() in
// supabase/migrations/20260816090100_message_cap_trigger_and_rpc.sql — keep
// these two numbers in sync if the caps ever change.
export const BASE_MESSAGE_CAP: Record<Tier, number> = {
  tier_1_3: 350,
  tier_4_10: 1000,
};

export function planFeatures(tier: Tier): string[] {
  const cap = BASE_MESSAGE_CAP[tier].toLocaleString();
  const shared = [
    "Instant, lightweight video previews to pinpoint the exact problem in seconds",
    "Realtime chat on every maintenance request, with photo and video attachments",
    "Status tracking from Open to In Progress to Complete, so nothing falls through the cracks",
  ];
  if (tier === "tier_1_3") {
    return [
      `Up to ${UNIT_RANGES.tier_1_3.max} units across your properties`,
      `${cap} messages a month — keeps tenant communication structured in one place instead of spilling into personal texts and calls`,
      ...shared,
    ];
  }
  return [
    `Up to ${UNIT_RANGES.tier_4_10.max} units across your properties`,
    `${cap} messages a month, with the option to add more — room for higher tenant volume without losing structure or tenants spamming your dashboard`,
    ...shared,
    "Built for a growing portfolio, with room to scale past a handful of units",
  ];
}

// Safely displays a price for a (tier, interval) pair read back from the
// DB, where both columns are plain nullable `text` rather than the typed
// union — returns null rather than throwing on an unrecognized value.
export function planPriceLabel(tier: string | null, interval: string | null): string | null {
  if (tier !== "tier_1_3" && tier !== "tier_4_10") return null;
  return PLAN_PRICES[tier][interval === "year" ? "year" : "month"];
}

// Returns null for a unit count no self-serve tier covers (0, or >10) —
// callers treat null as "no automatic plan applies here".
export function determineTier(unitCount: number): Tier | null {
  if (unitCount >= 1 && unitCount <= 3) return "tier_1_3";
  if (unitCount >= 4 && unitCount <= 10) return "tier_4_10";
  return null;
}

export const UNIT_RANGES: Record<Tier, { min: number; max: number }> = {
  tier_1_3: { min: 1, max: 3 },
  tier_4_10: { min: 4, max: 10 },
};

// The next self-serve tier up from `tier`, or null when there isn't one
// (4-10 is the top of what's sold automatically — 11+ is a manual
// enterprise conversation, not another button to click).
export function nextTierUp(tier: Tier): Tier | null {
  return tier === "tier_1_3" ? "tier_4_10" : null;
}

export function priceIdFor(tier: Tier, interval: BillingInterval): string | null {
  const envVar =
    tier === "tier_1_3"
      ? interval === "month"
        ? "STRIPE_PRICE_TIER_1_3_MONTHLY"
        : "STRIPE_PRICE_TIER_1_3_YEARLY"
      : interval === "month"
        ? "STRIPE_PRICE_TIER_4_10_MONTHLY"
        : "STRIPE_PRICE_TIER_4_10_YEARLY";
  return process.env[envVar] || null;
}

// Reverse lookup, for interpreting a Stripe subscription/price object
// coming back from a webhook.
export function tierAndIntervalForPriceId(
  priceId: string
): { tier: Tier; interval: BillingInterval } | null {
  if (priceId === process.env.STRIPE_PRICE_TIER_1_3_MONTHLY) {
    return { tier: "tier_1_3", interval: "month" };
  }
  if (priceId === process.env.STRIPE_PRICE_TIER_1_3_YEARLY) {
    return { tier: "tier_1_3", interval: "year" };
  }
  if (priceId === process.env.STRIPE_PRICE_TIER_4_10_MONTHLY) {
    return { tier: "tier_4_10", interval: "month" };
  }
  if (priceId === process.env.STRIPE_PRICE_TIER_4_10_YEARLY) {
    return { tier: "tier_4_10", interval: "year" };
  }
  return null;
}
