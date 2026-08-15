import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  computeAccessStatus,
  countUnitsForLandlord,
  getSubscriptionForLandlord,
} from "@/lib/billing/subscription";
import {
  PLAN_PRICES,
  PLAN_DESCRIPTIONS,
  YEARLY_SAVINGS_PERCENT,
  planPriceLabel,
} from "@/lib/stripe/plans";
import { createCheckoutSession, createPortalSession } from "@/app/(landlord)/billing/actions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string; success?: string; welcome?: string }>;
}) {
  const { user } = await requireProfile();
  const { locked: lockedParam, success, welcome } = await searchParams;
  const supabase = await createClient();

  const [sub, unitCount] = await Promise.all([
    getSubscriptionForLandlord(supabase, user.id),
    countUnitsForLandlord(supabase, user.id),
  ]);
  const access = computeAccessStatus(sub);
  const hasStripeSubscription = !!sub?.stripe_subscription_id;

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
          {hasStripeSubscription &&
            sub?.current_period_end &&
            (() => {
              const price = planPriceLabel(sub.tier, sub.billing_interval);
              return price ? (
                <>
                  {" "}
                  Then {price}, starting {new Date(sub.current_period_end).toLocaleDateString()}.
                </>
              ) : null;
            })()}
        </p>
      )}

      {!access.locked &&
        sub?.status === "active" &&
        (() => {
          const price = planPriceLabel(sub.tier, sub.billing_interval);
          if (!price) return null;
          return (
            <p className="mt-4 rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
              You&apos;re on the {sub.tier === "tier_4_10" ? "4-10 units" : "1-3 units"} plan (
              {price}),
              {sub.billing_interval === "year" ? " billed yearly" : " billed monthly"}
              {sub.current_period_end &&
                ` · next payment ${new Date(sub.current_period_end).toLocaleDateString()}`}
              .
            </p>
          );
        })()}

      <p className="mt-4 text-sm text-zinc-500">
        You currently have {unitCount} unit{unitCount === 1 ? "" : "s"} across your properties.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(["tier_1_3", "tier_4_10"] as const).map((tier) => (
          <div key={tier} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <p className="font-medium">{tier === "tier_1_3" ? "1-3 units" : "4-10 units"}</p>
            <p className="mt-1 text-2xl font-medium">{PLAN_PRICES[tier].month}</p>
            <p className="mt-2 text-sm italic text-zinc-500">
              &ldquo;{PLAN_DESCRIPTIONS[tier]}&rdquo;
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <form action={createCheckoutSession}>
                <input type="hidden" name="tier" value={tier} />
                <input type="hidden" name="interval" value="month" />
                <button
                  type="submit"
                  className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                >
                  Subscribe monthly
                </button>
              </form>
              <form action={createCheckoutSession}>
                <input type="hidden" name="tier" value={tier} />
                <input type="hidden" name="interval" value="year" />
                <button
                  type="submit"
                  className="w-full rounded-full border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/20"
                >
                  Subscribe yearly {PLAN_PRICES[tier].year?.replace("/yr", "")} (Save{" "}
                  {YEARLY_SAVINGS_PERCENT[tier]}%)
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        Have more than 10 units?{" "}
        <a
          href="mailto:jeffreychang129@gmail.com?subject=Enterprise%20pricing%20inquiry"
          className="underline"
        >
          Contact us for custom enterprise pricing.
        </a>
      </p>

      {hasStripeSubscription && (
        <form action={createPortalSession} className="mt-6">
          <button
            type="submit"
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/20"
          >
            Manage billing
          </button>
        </form>
      )}
    </div>
  );
}
