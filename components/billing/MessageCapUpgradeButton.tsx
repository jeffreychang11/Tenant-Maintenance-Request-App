"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  previewMessageCapUpgrade,
  confirmMessageCapUpgrade,
  createMessageBundleCheckout,
} from "@/app/(landlord)/billing/actions";
import { UnitUpgradeModal } from "@/components/billing/UnitUpgradeModal";
import type { Tier, BillingInterval } from "@/lib/stripe/plans";

type PendingUpgrade = { targetTier: Tier; interval: BillingInterval; amountDueCents: number };

// Shown on the settings page once a landlord is blocked. Basic offers a
// real, permanent, prorated upgrade to Premium (same UnitUpgradeModal used
// for the unit-count upgrade flow — it's already generic on
// targetTier/interval/amountDueCents). Premium offers a one-time $5/200
// message top-up instead, no confirmation modal needed since the price is
// fixed.
export function MessageCapUpgradeButton({ tier }: { tier: Tier }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [upgrade, setUpgrade] = useState<PendingUpgrade | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (tier === "tier_4_10") {
    return (
      <form action={createMessageBundleCheckout} className="mt-3">
        <button
          type="submit"
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          Buy 200 more messages ($5)
        </button>
      </form>
    );
  }

  async function startUpgrade() {
    setPending(true);
    setError(null);
    const result = await previewMessageCapUpgrade();
    setPending(false);
    if (result.status !== "needs_upgrade") {
      setError("Couldn't start the upgrade — try again in a moment.");
      return;
    }
    setUpgrade(result);
  }

  async function confirm() {
    setPending(true);
    await confirmMessageCapUpgrade();
    setPending(false);
    setUpgrade(null);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={startUpgrade}
        disabled={pending}
        className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
      >
        {pending ? "…" : "Upgrade to Premium"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {upgrade && (
        <UnitUpgradeModal
          targetTier={upgrade.targetTier}
          interval={upgrade.interval}
          amountDueCents={upgrade.amountDueCents}
          loading={pending}
          onCancel={() => setUpgrade(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
