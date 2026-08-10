import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { categoryLabel } from "@/lib/categories";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

export default async function LandlordRequestsPage() {
  const { user } = await requireProfile();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select(
      "id, title, category, status, created_at, last_activity_at, units(label, properties(name))"
    )
    .eq("landlord_id", user.id)
    .order("last_activity_at", { ascending: false });

  const { data: reads } = await supabase
    .from("request_reads")
    .select("request_id, last_read_at")
    .eq("user_id", user.id);

  const readMap = new Map((reads ?? []).map((r) => [r.request_id, r.last_read_at]));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-medium">Requests</h1>

      {!requests || requests.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          No requests yet across your properties.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {requests.map((r) => {
            const unit = r.units as unknown as {
              label: string;
              properties: { name: string } | null;
            } | null;
            const lastRead = readMap.get(r.id);
            const isUnread = !lastRead || new Date(r.last_activity_at) > new Date(lastRead);
            return (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isUnread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.title}</p>
                      <p className="text-xs text-zinc-500">
                        {[unit?.properties?.name, unit?.label].filter(Boolean).join(" ")} ·{" "}
                        {categoryLabel(r.category)} · {formatRelativeTime(r.created_at)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
