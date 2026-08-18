"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createProperty } from "@/app/(landlord)/properties/actions";
import { UnitUpgradeModal } from "@/components/billing/UnitUpgradeModal";

type PendingUpgrade = Extract<
  Awaited<ReturnType<typeof createProperty>>,
  { status: "needs_upgrade" }
>;

const REQUIRED_FIELDS = ["address_line1", "city", "state", "postal_code"] as const;

export function NewPropertyForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<PendingUpgrade | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  // Which required fields are currently empty — drives a red-border
  // highlight instead of the browser's native "Please fill out this
  // field" bubble (the form has noValidate for exactly this reason).
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

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

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const missing = new Set<string>(
      REQUIRED_FIELDS.filter((field) => !(formData.get(field) as string)?.trim())
    );
    setInvalidFields(missing);
    if (missing.size > 0) return;
    submit(formData, false);
  }

  function clearInvalid(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  function inputClass(field: string) {
    return `mt-1 w-full rounded-md border px-3 py-2 dark:bg-black ${
      invalidFields.has(field)
        ? "border-red-500 dark:border-red-500"
        : "border-black/10 dark:border-white/20"
    }`;
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="address_line1" className="block text-sm text-zinc-600 dark:text-zinc-400">
            Street address
          </label>
          <input
            id="address_line1"
            name="address_line1"
            placeholder="123 Main St"
            className={inputClass("address_line1")}
            onChange={() => clearInvalid("address_line1")}
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
              className={inputClass("city")}
              onChange={() => clearInvalid("city")}
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm text-zinc-600 dark:text-zinc-400">
              State
            </label>
            <input
              id="state"
              name="state"
              className={inputClass("state")}
              onChange={() => clearInvalid("state")}
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
            className={inputClass("postal_code")}
            onChange={() => clearInvalid("postal_code")}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">
            {error}{" "}
            <Link href="/support" className="underline">
              Contact us for custom enterprise pricing.
            </Link>
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
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
