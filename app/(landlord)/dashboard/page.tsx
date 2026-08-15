import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardPropertyList } from "@/components/properties/DashboardPropertyList";

export default async function LandlordDashboardPage() {
  const { user } = await requireProfile();
  const supabase = await createClient();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, city, state, units(id, label, tenant_units(status, profiles(full_name)))")
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: false });

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("id, unit_id, title, description, category, status, created_at")
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: false });

  // Drives the 24-hour "Complete" badge on the dashboard tile. Sourced from
  // request_status_history (not maintenance_requests.updated_at, which also
  // gets bumped by unrelated chat messages) so the window reflects when the
  // request actually was marked done, not when it was last touched.
  const { data: doneEvents } = await supabase
    .from("request_status_history")
    .select("request_id, created_at")
    .eq("to_status", "done")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Your properties</h1>
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
        <DashboardPropertyList
          landlordId={user.id}
          properties={properties.map((p) => ({
            id: p.id,
            addressLine: [p.name, p.city, p.state].filter(Boolean).join(", "),
            units: (p.units ?? []) as unknown as {
              id: string;
              tenant_units: { status: string; profiles: { full_name: string | null } | null }[];
            }[],
          }))}
          initialRequests={requests ?? []}
          initialDoneEvents={doneEvents ?? []}
        />
      )}
    </div>
  );
}
