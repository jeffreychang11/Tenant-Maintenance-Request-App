import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createUnit, deleteProperty, removeTenant } from "@/app/(landlord)/properties/actions";
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
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Add property
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
                    className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                  >
                    Delete property
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
                        <div className="flex shrink-0 items-center gap-2">
                          {activeTenant ? (
                            <ConfirmButton
                              action={removeTenant.bind(null, activeTenant.id)}
                              confirmMessage="Mark this tenant as moved out? They'll lose access to this unit, and you'll be able to invite a new tenant."
                              className="text-xs text-red-600 hover:underline"
                            >
                              Remove tenant
                            </ConfirmButton>
                          ) : (
                            <Link
                              href={`/properties/${p.id}/units/${u.id}`}
                              className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                            >
                              Invite tenant
                            </Link>
                          )}
                          <Link
                            href={`/properties/${p.id}/units/${u.id}`}
                            className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                          >
                            Manage →
                          </Link>
                        </div>
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
