import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { PropertyTile } from "@/components/properties/PropertyTile";

type RequestRow = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  created_at: string;
};

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

  const requestsByUnit = new Map<string, RequestRow[]>();
  for (const r of requests ?? []) {
    const list = requestsByUnit.get(r.unit_id) ?? [];
    list.push(r);
    requestsByUnit.set(r.unit_id, list);
  }

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
        <ul className="mt-6 flex flex-col gap-2">
          {properties.map((p) => {
            const units = (p.units ?? []) as unknown as {
              id: string;
              label: string;
              tenant_units: { status: string; profiles: { full_name: string | null } | null }[];
            }[];

            const unitIds = units.map((u) => u.id);
            const propertyRequests = unitIds
              .flatMap((id) => requestsByUnit.get(id) ?? [])
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

            const hasOpen = propertyRequests.some(
              (r) => r.status === "open" || r.status === "reopened"
            );
            const hasInProgress = propertyRequests.some((r) => r.status === "in_progress");
            const badgeStatus = hasOpen ? "open" : hasInProgress ? "in_progress" : null;

            const tenantName = units
              .flatMap((u) => u.tenant_units)
              .find((tu) => tu.status === "active")?.profiles?.full_name;

            const newest = propertyRequests[0];

            // The specific request driving the status badge, so the
            // category icon shown matches what the badge is about (not
            // just whatever request happens to be most recent overall).
            const relevantRequest = badgeStatus
              ? propertyRequests.find((r) =>
                  badgeStatus === "open"
                    ? r.status === "open" || r.status === "reopened"
                    : r.status === "in_progress"
                )
              : undefined;

            return (
              <PropertyTile
                key={p.id}
                tenantName={tenantName ?? null}
                addressLine={[p.name, p.city, p.state].filter(Boolean).join(", ")}
                badgeStatus={badgeStatus}
                categoryValue={relevantRequest?.category ?? null}
                newest={
                  newest
                    ? {
                        id: newest.id,
                        title: newest.title,
                        category: newest.category,
                        description: newest.description,
                        timeLabel: formatRelativeTime(newest.created_at),
                      }
                    : null
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
