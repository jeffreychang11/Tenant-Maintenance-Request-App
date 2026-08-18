"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelSubscription, resumeSubscription } from "@/app/(landlord)/billing/actions";
import { ConfirmButton } from "@/components/properties/ConfirmButton";

// Replaces the old "Manage billing" Stripe-portal redirect at the bottom
// of the page — cancellation is common enough to handle in-app directly,
// with our own confirm step instead of sending the landlord off to
// Stripe's hosted portal for it.
export function CancelSubscriptionControl({
  cancelAtPeriodEnd,
  periodEndLabel,
}: {
  cancelAtPeriodEnd: boolean;
  periodEndLabel: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resume() {
    setLoading(true);
    setError(null);
    try {
      await resumeSubscription();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resume the subscription.");
    } finally {
      setLoading(false);
    }
  }

  if (cancelAtPeriodEnd) {
    return (
      <div className="mt-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your subscription is set to cancel
          {periodEndLabel ? ` on ${periodEndLabel}` : ""}. You&apos;ll keep full access until
          then.
        </p>
        <button
          type="button"
          onClick={resume}
          disabled={loading}
          className="mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
        >
          {loading ? "…" : "Resume subscription"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <ConfirmButton
        action={cancelSubscription}
        confirmLabel="Cancel subscription"
        confirmMessage={
          periodEndLabel
            ? `You'll keep full access until ${periodEndLabel}, the end of your current billing period. After that, your subscription won't renew and you won't be charged again.`
            : "You'll keep full access until the end of your current billing period. After that, your subscription won't renew and you won't be charged again."
        }
        className="rounded-full border border-red-400 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 active:bg-red-100 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950 dark:active:bg-red-900"
      >
        Cancel subscription
      </ConfirmButton>
    </div>
  );
}
