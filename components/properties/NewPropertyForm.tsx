"use client";

import { useState } from "react";
import { createProperty } from "@/app/(landlord)/properties/actions";
import { UnitUpgradeModal } from "@/components/billing/UnitUpgradeModal";

type PendingUpgrade = Extract<
  Awaited<ReturnType<typeof createProperty>>,
  { status: "needs_upgrade" }
>;

export function NewPropertyForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<PendingUpgrade | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  async function submit(formData: FormData, confirmed: boolean) {
    setPending(true);
    setError(null);
    if (confirmed) formData.set("confirmed", "1");

    const result = await createProperty(formData);
    setPending(false);

    if (!result) return; // action redirected — nothing left to do here
    if (result.status === "needs_upgrade") {
      setUpgrade(result);
      setPendingFormData(formData);
      return;
    }
    if (result.status === "blocked") {
      setError(result.message);
    }
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget), false);
        }}
        className="mt-8 flex flex-col gap-4"
      >
        <div>
          <label htmlFor="name" className="block text-sm text-zinc-600 dark:text-zinc-400">
            Property name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="123 Main St"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
        <div>
          <label htmlFor="address_line1" className="block text-sm text-zinc-600 dark:text-zinc-400">
            Street address
          </label>
          <input
            id="address_line1"
            name="address_line1"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
        <div>
          <label htmlFor="unit_label" className="block text-sm text-zinc-600 dark:text-zinc-400">
            Unit number (optional)
          </label>
          <input
            id="unit_label"
            name="unit_label"
            placeholder="e.g. Unit 2B"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
          <p className="mt-1 text-xs text-zinc-500">Leave blank if you&apos;ll add units later.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="city" className="block text-sm text-zinc-600 dark:text-zinc-400">
              City
            </label>
            <input
              id="city"
              name="city"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm text-zinc-600 dark:text-zinc-400">
              State
            </label>
            <input
              id="state"
              name="state"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
          </div>
        </div>
        <div>
          <label htmlFor="postal_code" className="block text-sm text-zinc-600 dark:text-zinc-400">
            ZIP code
          </label>
          <input
            id="postal_code"
            name="postal_code"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "…" : "Create property"}
        </button>
      </form>

      {upgrade && pendingFormData && (
        <UnitUpgradeModal
          targetTier={upgrade.targetTier}
          interval={upgrade.interval}
          amountDueCents={upgrade.amountDueCents}
          loading={pending}
          onCancel={() => {
            setUpgrade(null);
            setPendingFormData(null);
          }}
          onConfirm={() => {
            const formData = pendingFormData;
            setUpgrade(null);
            setPendingFormData(null);
            submit(formData, true);
          }}
        />
      )}
    </>
  );
}
