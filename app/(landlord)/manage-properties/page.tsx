import Link from "next/link";
import { IconPlus, IconMinus } from "@tabler/icons-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createUnit, deleteProperty } from "@/app/(landlord)/properties/actions";
import { ConfirmButton } from "@/components/properties/ConfirmButton";

export default async function ManagePropertiesPage() {
  const { user } = await requireProfile();
  const supabase = await createClient();

  const { data: properties } = await supabase
    .from("properties")
    .select(
      "id, name, address_line1, city, state, units(id, label, tenant_units(id, status, profiles(full_name)))"
    )
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Manage properties</h1>
        <Link
          href="/properties/new"
          aria-label="Add property"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <IconPlus size={18} aria-hidden="true" />
        </Link>
      </div>

      {!properties || properties.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          No properties yet. Add your first one to start inviting tenants.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {properties.map((p) => {
            const units = (p.units ?? []) as unknown as {
              id: string;
              label: string;
              tenant_units: {
                id: string;
                status: string;
                profiles: { full_name: string | null } | null;
              }[];
            }[];
            const createUnitForProperty = createUnit.bind(null, p.id);

            return (
              <li key={p.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {[p.address_line1, p.city, p.state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <ConfirmButton
                    action={deleteProperty.bind(null, p.id)}
                    confirmMessage={`Delete "${p.name}"? This permanently removes its units, tenant links, and all maintenance request history. This can't be undone.`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
                  >
                    <IconMinus size={16} aria-hidden="true" />
                    <span className="sr-only">Delete property</span>
                  </ConfirmButton>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {units.map((u) => {
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
                          className="shrink-0 text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                        >
                          Manage →
                        </Link>
                      </div>
                    );
                  })}
                </div>

                <form action={createUnitForProperty} className="mt-3 flex gap-2">
                  <input
                    name="label"
                    required
                    placeholder="Unit label (e.g. Unit 2B)"
                    className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/20"
                  >
                    Add unit
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
