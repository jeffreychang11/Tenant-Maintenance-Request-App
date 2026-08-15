import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { statusUrgencyRank, statusBarColorClass, statusInteractiveClass } from "@/lib/statusRank";

export default async function TenantHomePage() {
  const { user } = await requireProfile();
  const supabase = await createClient();

  const { data: tenantUnits } = await supabase
    .from("tenant_units")
    .select("unit_id, units(label, properties(name))")
    .eq("tenant_id", user.id)
    .eq("status", "active");

  const unitIds = (tenantUnits ?? []).map((tu) => tu.unit_id);
  const primaryUnit = tenantUnits?.[0]?.units as unknown as
    | { label: string; properties: { name: string } | null }
    | null;

  const { data: requests } =
    unitIds.length > 0
      ? await supabase
          .from("maintenance_requests")
          .select("id, title, category, status, created_at")
          .eq("tenant_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5)
      : { data: [] };

  const sortedRequests = [...(requests ?? [])].sort(
    (a, b) => statusUrgencyRank(a.status) - statusUrgencyRank(b.status)
  );

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-zinc-500">
        {[primaryUnit?.properties?.name, primaryUnit?.label].filter(Boolean).join(", ") ||
          "No unit linked yet"}
      </p>
      <h1 className="mt-1 text-2xl font-medium">What needs attention?</h1>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.value}
              href={unitIds.length > 0 ? `/my-requests/new?category=${c.value}` : "#"}
              aria-disabled={unitIds.length === 0}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-black/10 px-2 py-5 text-center text-xs shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow dark:border-white/10 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${
                unitIds.length > 0
                  ? "hover:bg-black/[.02] hover:shadow-[0_4px_14px_rgba(0,0,0,0.14)] dark:hover:bg-white/[.03] dark:hover:shadow-[0_4px_14px_rgba(0,0,0,0.6)]"
                  : "pointer-events-none opacity-40"
              }`}
            >
              <Icon size={24} className="text-zinc-500" />
              <span>{c.label}</span>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-8 text-lg font-medium">Your recent requests</h2>
      {sortedRequests.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No requests yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {sortedRequests.map((r) => (
            <li
              key={r.id}
              className="overflow-hidden rounded-xl border border-black/10 shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:border-white/10 dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
            >
              <Link
                href={`/my-requests/${r.id}`}
                className={`flex items-center justify-between gap-3 border-l-4 px-4 py-4 transition-colors ${statusBarColorClass(r.status)} ${statusInteractiveClass(r.status, false)}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">{r.title}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {categoryLabel(r.category)} · {formatRelativeTime(r.created_at)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
