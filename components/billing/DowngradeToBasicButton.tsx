"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { previewBasicDowngrade, confirmBasicDowngrade } from "@/app/(landlord)/billing/actions";
import { PlanChangeModal } from "@/components/billing/PlanChangeModal";
import { PLAN_PRICES } from "@/lib/stripe/plans";

// Shown on the Basic card when a landlord is currently on Premium.
// previewBasicDowngrade blocks with a message when their unit count is
// still above Basic's 3-unit range, rather than showing a cost at all.
export function DowngradeToBasicButton({ interval }: { interval: "month" | "year" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [amountDueCents, setAmountDueCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const result = await previewBasicDowngrade();
    setPending(false);
    if (result.status === "blocked") {
      setError(result.message);
      return;
    }
    if (result.status !== "ok") {
      setError("Couldn't start the downgrade — try again in a moment.");
      return;
    }
    setAmountDueCents(result.amountDueCents);
  }

  async function confirm() {
    setPending(true);
    try {
      await confirmBasicDowngrade();
      setAmountDueCents(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't complete the downgrade.");
    } finally {
      setPending(false);
    }
  }

  const goingForward = PLAN_PRICES.tier_1_3[interval === "year" ? "year" : "month"];

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
        onClick={start}
        disabled={pending}
        className="w-full rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
      >
        {pending ? "…" : "Downgrade to Basic"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {amountDueCents !== null && (
        <PlanChangeModal
          description={describeAmount(amountDueCents)}
          confirmLabel="Confirm & downgrade"
          loading={pending}
          onCancel={() => setAmountDueCents(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
