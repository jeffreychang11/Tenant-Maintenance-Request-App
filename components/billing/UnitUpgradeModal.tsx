"use client";

import { PLAN_LABELS, PLAN_PRICES, type BillingInterval, type Tier } from "@/lib/stripe/plans";

export function UnitUpgradeModal({
  targetTier,
  interval,
  amountDueCents,
  loading,
  onConfirm,
  onCancel,
}: {
  targetTier: Tier;
  interval: BillingInterval;
  amountDueCents: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const amount = (amountDueCents / 100).toFixed(2);
  const goingForward = PLAN_PRICES[targetTier][interval === "year" ? "year" : "month"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !loading && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-zinc-900"
      >
        <p className="font-medium">This needs an upgrade</p>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          This puts you over your current plan&apos;s limit. Upgrading to the{" "}
          {PLAN_LABELS[targetTier]} plan costs a prorated <strong>${amount}</strong> today, then{" "}
          {goingForward} going forward.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            {loading ? "…" : "Confirm & upgrade"}
          </button>
        </div>
      </div>
    </div>
  );
}
