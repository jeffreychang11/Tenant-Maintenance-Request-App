"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

type UnitInfo = {
  id: string;
  tenant_units: { status: string; profiles: { full_name: string | null } | null }[];
};

type PropertyInfo = {
  id: string;
  addressLine: string;
  units: UnitInfo[];
};

type DoneEvent = { request_id: string; created_at: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function toDoneAtMap(events: DoneEvent[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of events) {
    if (!map[e.request_id] || e.created_at > map[e.request_id]) {
      map[e.request_id] = e.created_at;
    }
  }
  return map;
}

export function DashboardPropertyList({
  properties: initialProperties,
  initialRequests,
  initialDoneEvents,
  landlordId,
}: {
  properties: PropertyInfo[];
  initialRequests: RequestRow[];
  initialDoneEvents: DoneEvent[];
  landlordId: string;
}) {
  const [properties, setProperties] = useState<PropertyInfo[]>(initialProperties);
  const [requests, setRequests] = useState<RequestRow[]>(initialRequests);
  // Maps request id -> the timestamp it was most recently marked done, only
  // for requests done within the last 24h (see the dashboard page's query
  // comment for why this comes from request_status_history, not
  // maintenance_requests.updated_at). Drives the tile's "Complete" badge.
  const [doneAt, setDoneAt] = useState<Record<string, string>>(() => toDoneAtMap(initialDoneEvents));

  // A same-page action could trigger Next's automatic post-action refresh,
  // which re-renders this component with fresh props — but useState only
  // reads its initial value once, so without this a change wouldn't show
  // until a full remount. Adjusting state during render (rather than in an
  // effect) avoids an extra render pass — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-when-a-prop-changes
  const [prevInitialProperties, setPrevInitialProperties] = useState(initialProperties);
  if (initialProperties !== prevInitialProperties) {
    setPrevInitialProperties(initialProperties);
    setProperties(initialProperties);
  }

  const [prevInitialRequests, setPrevInitialRequests] = useState(initialRequests);
  if (initialRequests !== prevInitialRequests) {
    setPrevInitialRequests(initialRequests);
    setRequests(initialRequests);
  }

  const [prevInitialDoneEvents, setPrevInitialDoneEvents] = useState(initialDoneEvents);
  if (initialDoneEvents !== prevInitialDoneEvents) {
    setPrevInitialDoneEvents(initialDoneEvents);
    setDoneAt(toDoneAtMap(initialDoneEvents));
  }

  // Keeps the property list and status badges live even when the dashboard
  // is restored from the browser's back/forward cache, which Next.js
  // intentionally serves without revalidating (see staleTimes docs) — a
  // plain router refresh on mutation doesn't reach a page already sitting
  // in that cache. The initial fetch below re-syncs on every mount
  // (covering the case where this component itself is restored from that
  // cache with stale server-rendered props, e.g. a newly added property),
  // and the requests subscription keeps status badges live from then on.
  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("properties")
      .select("id, name, city, state, units(id, label, tenant_units(status, profiles(full_name)))")
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setProperties(
            data.map((p) => ({
              id: p.id,
              addressLine: [p.name, p.city, p.state].filter(Boolean).join(", "),
              units: (p.units ?? []) as unknown as UnitInfo[],
            }))
          );
        }
      });

    supabase
      .from("maintenance_requests")
      .select("id, unit_id, title, description, category, status, created_at")
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setRequests(data);
      });

    supabase
      .from("request_status_history")
      .select("request_id, created_at")
      .eq("to_status", "done")
      .gte("created_at", new Date(Date.now() - DAY_MS).toISOString())
      .then(({ data }) => {
        if (data) setDoneAt(toDoneAtMap(data));
      });

    const channel = supabase
      .channel(`dashboard-requests:${landlordId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "maintenance_requests",
          filter: `landlord_id=eq.${landlordId}`,
        },
        (payload) => {
          const row = payload.new as RequestRow;
          setRequests((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)));
          if (row.status === "done") {
            setDoneAt((prev) => ({ ...prev, [row.id]: new Date().toISOString() }));
          } else {
            setDoneAt((prev) => {
              if (!(row.id in prev)) return prev;
              const next = { ...prev };
              delete next[row.id];
              return next;
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "maintenance_requests",
          filter: `landlord_id=eq.${landlordId}`,
        },
        (payload) => {
          const row = payload.new as RequestRow;
          setRequests((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [landlordId]);

  const requestsByUnit = new Map<string, RequestRow[]>();
  for (const r of requests) {
    const list = requestsByUnit.get(r.unit_id) ?? [];
    list.push(r);
    requestsByUnit.set(r.unit_id, list);
  }

  // Each property's own requests (newest first), whether it's vacant (no
  // active tenant on any unit), and whichever status badge (if any) it
  // should show right now.
  const withRequests = properties.map((p) => {
    const unitIds = p.units.map((u) => u.id);
    const propertyRequests = unitIds
      .flatMap((id) => requestsByUnit.get(id) ?? [])
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const tenantName = p.units
      .flatMap((u) => u.tenant_units)
      .find((tu) => tu.status === "active")?.profiles?.full_name;

    const hasOpen = propertyRequests.some((r) => r.status === "open" || r.status === "reopened");
    const hasInProgress = propertyRequests.some((r) => r.status === "in_progress");
    const recentlyDone = !hasOpen && !hasInProgress
      ? propertyRequests.find(
          (r) => r.status === "done" && r.id in doneAt && Date.now() - Date.parse(doneAt[r.id]) < DAY_MS
        )
      : undefined;
    const badgeStatus: "open" | "in_progress" | "done" | null = hasOpen
      ? "open"
      : hasInProgress
        ? "in_progress"
        : recentlyDone
          ? "done"
          : null;

    // The specific request driving the status badge, so the category icon,
    // expanded preview, and Details link all point at what the badge is
    // actually about — not just whatever request happens to be most recent
    // overall. Only falls back to the newest request when nothing is
    // open/in progress/recently done (nothing for the badge to show).
    const relevantRequest =
      badgeStatus === "open" || badgeStatus === "in_progress"
        ? propertyRequests.find((r) =>
            badgeStatus === "open" ? r.status === "open" || r.status === "reopened" : r.status === "in_progress"
          )
        : recentlyDone;

    return {
      property: p,
      propertyRequests,
      isVacant: !tenantName,
      tenantName,
      badgeStatus,
      relevantRequest,
    };
  });

  // Five tiers, most urgent first, mirroring the tile's own color bar: red
  // (open/reopened) worst, then yellow (in progress), then green-Complete
  // (just done), then a plain green tile with nothing to show, then vacant
  // always last since no one lives there and no requests will be filed for
  // the time being. Within a tier, whichever property has the most
  // recently created request rises to the top.
  const tierRank = (entry: (typeof withRequests)[number]) => {
    if (entry.isVacant) return 4;
    if (entry.badgeStatus === "open") return 0;
    if (entry.badgeStatus === "in_progress") return 1;
    if (entry.badgeStatus === "done") return 2;
    return 3;
  };

  const orderedProperties = [...withRequests].sort((a, b) => {
    const rankDiff = tierRank(a) - tierRank(b);
    if (rankDiff !== 0) return rankDiff;
    const aTime = a.propertyRequests[0]?.created_at;
    const bTime = b.propertyRequests[0]?.created_at;
    if (!aTime && !bTime) return 0;
    if (!aTime) return 1;
    if (!bTime) return -1;
    return aTime < bTime ? 1 : -1;
  });

  return (
    <ul className="mt-6 flex flex-col gap-2">
      {orderedProperties.map(({ property: p, tenantName, badgeStatus, relevantRequest }) => {
        // Only ever the request driving the current badge (open /
        // in progress / done-within-24h) — once a done request ages past
        // that window there's no live status to show, so the dropdown
        // shouldn't keep surfacing its now-stale title/description either.
        const newest = relevantRequest;

        // Same routing as the Manage Properties page's "Add a tenant" link:
        // straight to the unit if there's exactly one, otherwise to the
        // property page to pick (or add) a unit.
        const addTenantHref =
          p.units.length === 1 ? `/properties/${p.id}/units/${p.units[0].id}` : `/properties/${p.id}`;

        return (
          <PropertyTile
            key={p.id}
            tenantName={tenantName ?? null}
            addressLine={p.addressLine}
            badgeStatus={badgeStatus}
            categoryValue={badgeStatus ? (relevantRequest?.category ?? null) : null}
            addTenantHref={addTenantHref}
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
  );
}
