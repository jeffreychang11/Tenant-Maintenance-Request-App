import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { categoryLabel } from "@/lib/categories";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

export default async function TenantRequestsPage() {
  const { user } = await requireProfile();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("id, title, category, status, created_at, last_activity_at, units(label, properties(name))")
    .eq("tenant_id", user.id)
    .order("last_activity_at", { ascending: false });

  const requestIds = (requests ?? []).map((r) => r.id);

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

      {!requests || requests.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          You haven&apos;t submitted any requests yet.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {requests.map((r) => {
            const unit = r.units as unknown as {
              label: string;
              properties: { name: string } | null;
            } | null;
            const lastRead = readMap.get(r.id);
            const latestMessage = latestMessageByRequest.get(r.id);
            const landlordResponded =
              !!latestMessage &&
              latestMessage.sender_id !== user.id &&
              (!lastRead || new Date(latestMessage.created_at) > new Date(lastRead));

            return (
              <li key={r.id}>
                <Link
                  href={`/my-requests/${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {landlordResponded && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
                        aria-label="Landlord responded"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.title}</p>
                      <p className="text-xs text-zinc-500">
                        {[unit?.properties?.name, unit?.label].filter(Boolean).join(" ")} ·{" "}
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
