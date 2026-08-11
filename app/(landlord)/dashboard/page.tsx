import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

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
            const CategoryIcon = relevantRequest
              ? CATEGORIES.find((c) => c.value === relevantRequest.category)?.icon
              : undefined;

            return (
              <li
                key={p.id}
                className="rounded-xl border border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:border-white/10 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
              >
                <details>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{tenantName || "No tenant"}</p>
                      <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {[p.name, p.city, p.state].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {CategoryIcon && relevantRequest && (
                        <span className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                          <CategoryIcon size={18} aria-hidden="true" />
                          {categoryLabel(relevantRequest.category)}
                        </span>
                      )}
                      {badgeStatus && <StatusBadge status={badgeStatus} />}
                    </div>
                  </summary>

                  <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
                    {newest ? (
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">{newest.title}</p>
                        <p className="text-xs text-zinc-500">
                          {categoryLabel(newest.category)} · {formatRelativeTime(newest.created_at)}
                        </p>
                        {newest.description && (
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {newest.description}
                          </p>
                        )}
                        <Link
                          href={`/requests/${newest.id}`}
                          className="mt-2 self-start rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/20"
                        >
                          View request
                        </Link>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">No requests yet.</p>
                    )}
                    <Link
                      href={`/properties/${p.id}`}
                      className="mt-3 block text-xs text-zinc-500 hover:underline"
                    >
                      Manage property →
                    </Link>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
