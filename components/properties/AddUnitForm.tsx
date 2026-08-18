"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUnit } from "@/app/(landlord)/properties/actions";
import { UnitUpgradeModal } from "@/components/billing/UnitUpgradeModal";

type PendingUpgrade = Extract<
  Awaited<ReturnType<typeof createUnit>>,
  { status: "needs_upgrade" }
>;

export function AddUnitForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<PendingUpgrade | null>(null);

  async function submit(confirmed: boolean) {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("label", label);
    if (confirmed) formData.set("confirmed", "1");

    const result = await createUnit(propertyId, formData);
    setPending(false);

    if (!result) return; // action redirected/revalidated — nothing left to do here
    if (result.status === "needs_upgrade") {
      setUpgrade(result);
      return;
    }
    if (result.status === "blocked") {
      setError(result.message);
      return;
    }
    setLabel("");
    router.refresh();
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          name="label"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Unit label (e.g. Unit 2B)"
          className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
        >
          {pending ? "…" : "Add unit"}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-sm text-red-600">
          {error}{" "}
          <Link href="/support" className="underline">
            Contact us for custom enterprise pricing.
          </Link>
        </p>
      )}

      {upgrade && (
        <UnitUpgradeModal
          targetTier={upgrade.targetTier}
          interval={upgrade.interval}
          amountDueCents={upgrade.amountDueCents}
          loading={pending}
          onCancel={() => setUpgrade(null)}
          onConfirm={() => {
            setUpgrade(null);
            submit(true);
          }}
        />
      )}
    </>
  );
}
