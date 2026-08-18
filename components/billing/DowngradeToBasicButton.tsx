"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { previewBasicDowngrade, confirmBasicDowngrade } from "@/app/(landlord)/billing/actions";
import { PlanChangeModal } from "@/components/billing/PlanChangeModal";
import { PLAN_PRICES, YEARLY_SAVINGS_PERCENT, type BillingInterval } from "@/lib/stripe/plans";

// Shown on the Basic card when a landlord is currently on Premium, letting
// them pick either billing interval for the downgrade (mirrors
// UpgradeToPremiumButton) rather than assuming they want to keep whatever
// interval Premium was on. previewBasicDowngrade blocks with a message
// when their unit count is still above Basic's 3-unit range, regardless of
// which interval button was clicked.
export function DowngradeToBasicButton() {
  const router = useRouter();
  const [loadingInterval, setLoadingInterval] = useState<BillingInterval | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingInterval, setPendingInterval] = useState<BillingInterval | null>(null);
  const [amountDueCents, setAmountDueCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(interval: BillingInterval) {
    setLoadingInterval(interval);
    setError(null);
    const result = await previewBasicDowngrade(interval);
    setLoadingInterval(null);
    if (result.status === "blocked") {
      setError(result.message);
      return;
    }
    if (result.status !== "ok") {
      setError("Couldn't start the downgrade — try again in a moment.");
      return;
    }
    setPendingInterval(interval);
    setAmountDueCents(result.amountDueCents);
  }

  async function confirm() {
    if (!pendingInterval) return;
    setConfirming(true);
    try {
      await confirmBasicDowngrade(pendingInterval);
      setAmountDueCents(null);
      setPendingInterval(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't complete the downgrade.");
    } finally {
      setConfirming(false);
    }
  }

  function cancel() {
    setAmountDueCents(null);
    setPendingInterval(null);
  }

  const goingForward = pendingInterval
    ? PLAN_PRICES.tier_1_3[pendingInterval === "year" ? "year" : "month"]
    : null;

  function describeAmount(cents: number) {
    if (cents <= 0) {
      return `Downgrading to the Basic plan gets you a prorated credit of $${(Math.abs(cents) / 100).toFixed(2)}, applied to your next invoice. Then ${goingForward} going forward.`;
    }
    return `Downgrading to the Basic plan costs a prorated $${(cents / 100).toFixed(2)} today, then ${goingForward} going forward.`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => start("month")}
        disabled={loadingInterval !== null}
        className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
      >
        {loadingInterval === "month" ? "…" : "Downgrade monthly"}
      </button>
      <button
        type="button"
        onClick={() => start("year")}
        disabled={loadingInterval !== null}
        className="w-full rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
      >
        {loadingInterval === "year"
          ? "…"
          : `Downgrade yearly ${PLAN_PRICES.tier_1_3.year?.replace("/yr", "")} (Save ${YEARLY_SAVINGS_PERCENT.tier_1_3}%)`}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {amountDueCents !== null && (
        <PlanChangeModal
          description={describeAmount(amountDueCents)}
          confirmLabel="Confirm & downgrade"
          loading={confirming}
          onCancel={cancel}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
