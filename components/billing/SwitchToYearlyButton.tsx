"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { previewSwitchToYearly, confirmSwitchToYearly } from "@/app/(landlord)/billing/actions";
import { PlanChangeModal } from "@/components/billing/PlanChangeModal";
import { PLAN_PRICES, YEARLY_SAVINGS_PERCENT, type Tier } from "@/lib/stripe/plans";

// Shown in place of the Subscribe buttons once a landlord is already on
// `tier` monthly — switches the same subscription's price to that tier's
// yearly price (prorated), rather than starting a second Checkout session.
export function SwitchToYearlyButton({ tier }: { tier: Tier }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [amountDueCents, setAmountDueCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const result = await previewSwitchToYearly(tier);
    setPending(false);
    if (result.status !== "ok") {
      setError("Couldn't start the switch — try again in a moment.");
      return;
    }
    setAmountDueCents(result.amountDueCents);
  }

  async function confirm() {
    setPending(true);
    await confirmSwitchToYearly(tier);
    setPending(false);
    setAmountDueCents(null);
    router.refresh();
  }

  const amount = amountDueCents !== null ? (amountDueCents / 100).toFixed(2) : null;

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="w-full rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
      >
        {pending ? "…" : `Switch to yearly (Save ${YEARLY_SAVINGS_PERCENT[tier]}%)`}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {amount !== null && (
        <PlanChangeModal
          description={`Switching to yearly billing costs a prorated $${amount} today, then ${PLAN_PRICES[tier].year} going forward.`}
          confirmLabel="Confirm & switch"
          loading={pending}
          onCancel={() => setAmountDueCents(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
