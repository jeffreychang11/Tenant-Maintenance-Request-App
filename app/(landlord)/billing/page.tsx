import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  computeAccessStatus,
  countUnitsForLandlord,
  getSubscriptionForLandlord,
} from "@/lib/billing/subscription";
import { getMessageUsage } from "@/lib/billing/messageLimit";
import { IconCheck } from "@tabler/icons-react";
import {
  PLAN_LABELS,
  PLAN_PRICES,
  PLAN_DESCRIPTIONS,
  YEARLY_SAVINGS_PERCENT,
  planPriceLabel,
  planFeatures,
  type Tier,
} from "@/lib/stripe/plans";
import { createCheckoutSession } from "@/app/(landlord)/billing/actions";
import { MessageUsageBar } from "@/components/billing/MessageUsageBar";
import { MessageCapUpgradeButton } from "@/components/billing/MessageCapUpgradeButton";
import { SwitchToYearlyButton } from "@/components/billing/SwitchToYearlyButton";
import { DowngradeToBasicButton } from "@/components/billing/DowngradeToBasicButton";
import { UpgradeToPremiumButton } from "@/components/billing/UpgradeToPremiumButton";
import { CancelSubscriptionControl } from "@/components/billing/CancelSubscriptionControl";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string; success?: string; welcome?: string }>;
}) {
  const { user } = await requireProfile();
  const { locked: lockedParam, success, welcome } = await searchParams;
  const supabase = await createClient();

  const [sub, unitCount, usage] = await Promise.all([
    getSubscriptionForLandlord(supabase, user.id),
    countUnitsForLandlord(supabase, user.id),
    getMessageUsage(supabase),
  ]);
  const access = computeAccessStatus(sub);
  // True only while there's a real, still-running subscription (trialing or
  // active) — sub.stripe_subscription_id and cancel_at_period_end both
  // persist as stale values after the subscription actually ends (Stripe's
  // customer.subscription.deleted webhook only flips status), so gating on
  // stripe_subscription_id alone would keep showing "Resume subscription"
  // forever after a cancellation has fully taken effect, and clicking it
  // would error against an already-canceled Stripe subscription.
  const hasOngoingSubscription =
    !!sub?.stripe_subscription_id && !!sub.status && ["trialing", "active"].includes(sub.status);
  // The tier/interval a landlord is actually paying for right now — sub.tier
  // persists after cancellation, so this also checks status is still
  // trialing/active before treating it as "on this plan" for the card
  // button logic below.
  const activeTier: Tier | null =
    sub?.tier === "tier_1_3" || sub?.tier === "tier_4_10"
      ? sub.status && ["trialing", "active"].includes(sub.status)
        ? sub.tier
        : null
      : null;
  const activeInterval: "month" | "year" = sub?.billing_interval === "year" ? "year" : "month";
  const periodEndLabel = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-medium">{welcome === "1" ? "Welcome!" : "Billing"}</h1>
      {welcome === "1" && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your account is ready. You&apos;re on a free trial to start — here&apos;s what it
          includes and what plans look like after.
        </p>
      )}

      {success === "1" && (
        <p className="mt-4 rounded-xl border border-green-400 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-600 dark:bg-green-950 dark:text-green-400">
          You&apos;re subscribed — thanks for signing up.
        </p>
      )}

      {(lockedParam === "1" || access.locked) && (
        <p className="mt-4 rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-950 dark:text-red-400">
          {access.trialEndsAt
            ? "Your free trial has ended. Subscribe below to keep managing your properties."
            : "Subscribe below to keep managing your properties."}{" "}
          You can still view all your existing data in the meantime.
        </p>
      )}

      {!access.locked && access.trialing && (
        <p className="mt-4 rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
          {access.daysLeftInTrial} day{access.daysLeftInTrial === 1 ? "" : "s"} left in your free
          trial.
        </p>
      )}

      {!access.locked && activeTier && (
        <p className="mt-4 rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
          You&apos;re on the {PLAN_LABELS[activeTier]} plan ({planPriceLabel(activeTier, activeInterval)}
          ), billed {activeInterval === "year" ? "yearly" : "monthly"}
          {periodEndLabel && ` · next billing date ${periodEndLabel}`}.
        </p>
      )}

      <p className="mt-4 text-sm text-zinc-500">
        You currently have {unitCount} unit{unitCount === 1 ? "" : "s"} across your properties.
      </p>

      {usage.tier && (
        <div className="mt-6">
          <MessageUsageBar usage={usage} />
          {usage.blocked && <MessageCapUpgradeButton tier={usage.tier} />}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(["tier_1_3", "tier_4_10"] as const).map((tier) => (
          <div key={tier} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <p className="font-medium">{PLAN_LABELS[tier]}</p>
            <p className="mt-1 text-2xl font-medium">{PLAN_PRICES[tier].month}</p>
            <p className="mt-2 text-sm italic text-zinc-500">
              &ldquo;{PLAN_DESCRIPTIONS[tier]}&rdquo;
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {planFeatures(tier).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <IconCheck
                    size={16}
                    className="mt-0.5 shrink-0 text-green-600 dark:text-green-500"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              {activeTier === tier ? (
                activeInterval === "month" ? (
                  <SwitchToYearlyButton tier={tier} />
                ) : (
                  <p className="text-center text-sm text-zinc-500">You&apos;re on this plan.</p>
                )
              ) : tier === "tier_1_3" && activeTier === "tier_4_10" ? (
                <DowngradeToBasicButton />
              ) : tier === "tier_4_10" && activeTier === "tier_1_3" ? (
                <UpgradeToPremiumButton />
              ) : (
                <>
                  <form action={createCheckoutSession}>
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value="month" />
                    <button
                      type="submit"
                      className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
                    >
                      Subscribe monthly
                    </button>
                  </form>
                  <form action={createCheckoutSession}>
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value="year" />
                    <button
                      type="submit"
                      className="w-full rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
                    >
                      Subscribe yearly {PLAN_PRICES[tier].year?.replace("/yr", "")} (Save{" "}
                      {YEARLY_SAVINGS_PERCENT[tier]}%)
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        Have more than 10 units?{" "}
        <Link href="/support" className="underline">
          Contact us for custom enterprise pricing.
        </Link>
      </p>

      {hasOngoingSubscription && (
        <CancelSubscriptionControl
          cancelAtPeriodEnd={!!sub?.cancel_at_period_end}
          periodEndLabel={periodEndLabel}
        />
      )}
    </div>
  );
}
