"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { previewPremiumUpgrade, confirmPremiumUpgrade } from "@/app/(landlord)/billing/actions";
import { PlanChangeModal } from "@/components/billing/PlanChangeModal";
import { PLAN_PRICES, YEARLY_SAVINGS_PERCENT, type BillingInterval } from "@/lib/stripe/plans";

// Shown on the Premium card in place of the plain Subscribe buttons when a
// landlord is already on Basic — an in-place prorated swap on their
// existing subscription (either interval), rather than the plain Subscribe
// buttons' createCheckoutSession, which would start a second, separate
// subscription instead of replacing the first.
export function UpgradeToPremiumButton() {
  const router = useRouter();
  const [loadingInterval, setLoadingInterval] = useState<BillingInterval | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingInterval, setPendingInterval] = useState<BillingInterval | null>(null);
  const [amountDueCents, setAmountDueCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(interval: BillingInterval) {
    setLoadingInterval(interval);
    setError(null);
    const result = await previewPremiumUpgrade(interval);
    setLoadingInterval(null);
    if (result.status !== "ok") {
      setError("Couldn't start the upgrade — try again in a moment.");
      return;
    }
    setPendingInterval(interval);
    setAmountDueCents(result.amountDueCents);
  }

  async function confirm() {
    if (!pendingInterval) return;
    setConfirming(true);
    await confirmPremiumUpgrade(pendingInterval);
    setConfirming(false);
    setAmountDueCents(null);
    setPendingInterval(null);
    router.refresh();
  }

  function cancel() {
    setAmountDueCents(null);
    setPendingInterval(null);
  }

  const amount = amountDueCents !== null ? (amountDueCents / 100).toFixed(2) : null;
  const goingForward = pendingInterval ? PLAN_PRICES.tier_4_10[pendingInterval === "year" ? "year" : "month"] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => start("month")}
        disabled={loadingInterval !== null}
        className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
      >
        {loadingInterval === "month" ? "…" : "Upgrade monthly"}
      </button>
      <button
        type="button"
        onClick={() => start("year")}
        disabled={loadingInterval !== null}
        className="w-full rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
      >
        {loadingInterval === "year"
          ? "…"
          : `Upgrade yearly ${PLAN_PRICES.tier_4_10.year?.replace("/yr", "")} (Save ${YEARLY_SAVINGS_PERCENT.tier_4_10}%)`}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {amount !== null && (
        <PlanChangeModal
          description={`Upgrading to the Premium plan costs a prorated $${amount} today, then ${goingForward} going forward.`}
          confirmLabel="Confirm & upgrade"
          loading={confirming}
          onCancel={cancel}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
