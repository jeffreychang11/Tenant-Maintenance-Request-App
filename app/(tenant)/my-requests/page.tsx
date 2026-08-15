import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { categoryLabel } from "@/lib/categories";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { statusUrgencyRank, statusBarColorClass, statusInteractiveClass } from "@/lib/statusRank";

export default async function TenantRequestsPage() {
  const { user } = await requireProfile();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("id, title, category, status, created_at, last_activity_at")
    .eq("tenant_id", user.id)
    .order("last_activity_at", { ascending: false });

  const sortedRequests = [...(requests ?? [])].sort(
    (a, b) => statusUrgencyRank(a.status) - statusUrgencyRank(b.status)
  );

  const requestIds = sortedRequests.map((r) => r.id);

  const [{ data: reads }, { data: messages }] = await Promise.all([
    supabase.from("request_reads").select("request_id, last_read_at").eq("user_id", user.id),
    requestIds.length > 0
      ? supabase
          .from("request_messages")
          .select("request_id, sender_id, created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { request_id: string; sender_id: string; created_at: string }[] }),
  ]);

  const readMap = new Map((reads ?? []).map((r) => [r.request_id, r.last_read_at]));
  const latestMessageByRequest = new Map<string, { sender_id: string; created_at: string }>();
  for (const m of messages ?? []) {
    if (!latestMessageByRequest.has(m.request_id)) {
      latestMessageByRequest.set(m.request_id, { sender_id: m.sender_id, created_at: m.created_at });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-medium">Your requests</h1>

      {sortedRequests.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          You haven&apos;t submitted any requests yet.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {sortedRequests.map((r) => {
            const lastRead = readMap.get(r.id);
            const latestMessage = latestMessageByRequest.get(r.id);
            const landlordResponded =
              !!latestMessage &&
              latestMessage.sender_id !== user.id &&
              (!lastRead || new Date(latestMessage.created_at) > new Date(lastRead));

            return (
              <li
                key={r.id}
                className="overflow-hidden rounded-xl border border-black/10 shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:border-white/10 dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
              >
                <Link
                  href={`/my-requests/${r.id}`}
                  className={`flex items-center justify-between gap-3 border-l-4 px-4 py-4 transition-colors ${statusBarColorClass(r.status)} ${statusInteractiveClass(r.status, false)}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {landlordResponded && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
                        aria-label="Landlord responded"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium">{r.title}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {categoryLabel(r.category)} · {formatRelativeTime(r.created_at)}
                        {landlordResponded && " · Landlord responded"}
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
