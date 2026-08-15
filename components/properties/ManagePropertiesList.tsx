"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconMinus, IconPencil } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { deleteProperty } from "@/app/(landlord)/properties/actions";
import { ConfirmButton } from "@/components/properties/ConfirmButton";

type TenantUnitInfo = {
  id: string;
  status: string;
  profiles: { full_name: string | null } | null;
};

type UnitInfo = {
  id: string;
  label: string;
  tenant_units: TenantUnitInfo[];
};

type PropertyInfo = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  units: UnitInfo[];
};

export function ManagePropertiesList({
  properties: initialProperties,
  landlordId,
}: {
  properties: PropertyInfo[];
  landlordId: string;
}) {
  const [properties, setProperties] = useState<PropertyInfo[]>(initialProperties);

  // Same-page actions (e.g. the "Add unit" form below) trigger Next's
  // automatic post-action refresh, which re-renders this component with a
  // fresh `initialProperties` prop — but useState only reads its initial
  // value once, so without this the new unit wouldn't appear until a full
  // remount. Syncing during render (rather than in an effect) keeps that
  // path correct without an extra render pass — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-when-a-prop-changes
  const [prevInitialProperties, setPrevInitialProperties] = useState(initialProperties);
  if (initialProperties !== prevInitialProperties) {
    setPrevInitialProperties(initialProperties);
    setProperties(initialProperties);
  }

  // Re-syncs on every mount so a change made elsewhere — a property just
  // created, a tenant who just accepted an invite — shows up immediately
  // even when this page is restored from the browser's back/forward
  // cache, which Next.js serves without revalidating regardless of
  // server-side revalidatePath calls.
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("properties")
      .select(
        "id, name, address_line1, city, state, units(id, label, tenant_units(id, status, profiles(full_name)))"
      )
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProperties(data as unknown as PropertyInfo[]);
      });
  }, [landlordId]);

  if (properties.length === 0) {
    return (
      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        No properties yet. Add your first one to start inviting tenants.
      </p>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-4">
      {properties.map((p) => {
        const hasTenant = p.units.some((u) =>
          u.tenant_units.some((tu) => tu.status === "active")
        );

        return (
          <li key={p.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {[p.address_line1, p.city, p.state].filter(Boolean).join(", ")}
                </p>
                {!hasTenant && (
                  <p className="mt-0.5 text-sm text-zinc-400 dark:text-zinc-500">Vacant</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/properties/${p.id}/edit`}
                  aria-label="Edit property"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <IconPencil size={16} aria-hidden="true" />
                </Link>
                <ConfirmButton
                  action={deleteProperty.bind(null, p.id)}
                  confirmMessage={`Delete "${p.name}"? This permanently removes its units, tenant links, and all maintenance request history. This can't be undone.`}
                  confirmLabel="Delete property"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
                >
                  <IconMinus size={16} aria-hidden="true" />
                  <span className="sr-only">Delete property</span>
                </ConfirmButton>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {p.units.map((u) => {
                const activeTenant = u.tenant_units.find((tu) => tu.status === "active");
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-black/[.02] px-3 py-2 text-sm dark:bg-white/[.03]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{u.label}</p>
                      <p className="text-xs text-zinc-500">
                        {activeTenant
                          ? activeTenant.profiles?.full_name || "Unnamed tenant"
                          : "No tenant"}
                      </p>
                    </div>
                    <Link
                      href={`/properties/${p.id}/units/${u.id}`}
                      className="shrink-0 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
                    >
                      {activeTenant ? "Manage →" : "Add tenant"}
                    </Link>
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
