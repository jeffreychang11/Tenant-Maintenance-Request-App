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

    const nonDoneRequests = propertyRequests.filter(
      (r) => r.status === "open" || r.status === "reopened" || r.status === "in_progress"
    );
    const doneRequests = propertyRequests.filter((r) => r.status === "done");

    // "Multiple requests" (blue) fires once 2+ requests need attention at
    // the same time, and is sticky: it stays even as they're resolved one
    // by one, only clearing once every request from that wave is done. A
    // done request still counts as part of the current wave if it was
    // marked done *after* the earliest still-active request was created
    // — i.e. they were genuinely open together at some point, not just
    // two unrelated issues months apart. waveRequests is every request in
    // that wave (active + qualifying done), for the dropdown list below;
    // categorySummary further down deliberately only looks at
    // nonDoneRequests, since icons represent current need, not history.
    const earliestActive = nonDoneRequests.length > 0
      ? nonDoneRequests.reduce((min, r) => (r.created_at < min.created_at ? r : min))
      : null;
    const qualifyingDone = earliestActive
      ? doneRequests.filter((d) => {
          const doneTs = doneAt[d.id];
          return doneTs && doneTs >= earliestActive.created_at;
        })
      : [];
    const waveIds = new Set([...nonDoneRequests, ...qualifyingDone].map((r) => r.id));
    const waveRequests = propertyRequests.filter((r) => waveIds.has(r.id));
    const isMultiWave = nonDoneRequests.length > 0 && waveRequests.length >= 2;

    const hasOpen = nonDoneRequests.some((r) => r.status === "open" || r.status === "reopened");
    const hasInProgress = nonDoneRequests.some((r) => r.status === "in_progress");
    // Every request done within the last 24h, once nothing is left active —
    // plural, not just the single newest one, so a property that just
    // finished an entire multi-request wave can still list all of them
    // (each showing its own "Complete" badge) rather than collapsing to
    // just one. For the ordinary single-request case this is just a
    // one-item array, so the dropdown still falls back to the plain
    // single-preview block below (see waveRequests/dropdownRequests).
    const recentlyDoneRequests = nonDoneRequests.length === 0
      ? propertyRequests.filter(
          (r) => r.status === "done" && r.id in doneAt && Date.now() - Date.parse(doneAt[r.id]) < DAY_MS
        )
      : [];
    const badgeStatus: "open" | "in_progress" | "done" | "multiple" | null = isMultiWave
      ? "multiple"
      : hasOpen
        ? "open"
        : hasInProgress
          ? "in_progress"
          : recentlyDoneRequests.length > 0
            ? "done"
            : null;

    // The specific request driving the status badge, so the category icon,
    // expanded preview, and Details link all point at what the badge is
    // actually about — not just whatever request happens to be most recent
    // overall. Only falls back to the newest request when nothing is
    // open/in progress/recently done (nothing for the badge to show).
    const relevantRequest =
      badgeStatus === "open" || badgeStatus === "in_progress"
        ? nonDoneRequests.find((r) =>
            badgeStatus === "open" ? r.status === "open" || r.status === "reopened" : r.status === "in_progress"
          )
        : badgeStatus === "done"
          ? recentlyDoneRequests[0]
          : undefined;

    // One icon per distinct category currently needing attention, with a
    // small ×N suffix when more than one active request shares a category
    // — this is what actually needs doing right now, independent of the
    // sticky "Multiple requests" text above (which can outlive a category
    // once its own request is resolved, while a sibling still isn't).
    const categorySummary =
      badgeStatus === "multiple"
        ? Array.from(
            nonDoneRequests
              .reduce((map, r) => map.set(r.category, (map.get(r.category) ?? 0) + 1), new Map<string, number>())
              .entries()
          ).map(([category, count]) => ({ category, count }))
        : null;

    // The multi-row, per-status-badge dropdown is used for two cases: an
    // active "Multiple requests" wave, or a wave that just finished (2+
    // requests all done within the last 24h). Anything else (a single
    // request, or nothing) falls back to PropertyTile's plain
    // single-preview block, unchanged.
    const dropdownRequests =
      badgeStatus === "multiple"
        ? waveRequests
        : badgeStatus === "done" && recentlyDoneRequests.length >= 2
          ? recentlyDoneRequests
          : null;

    return {
      property: p,
      propertyRequests,
      isVacant: !tenantName,
      tenantName,
      badgeStatus,
      relevantRequest,
      waveRequests: dropdownRequests,
      categorySummary,
    };
  });

  // Six tiers, most urgent first, mirroring the tile's own color bar: blue
  // (multiple requests needing attention) worst, then red (a single
  // open/reopened request), then yellow (in progress), then green-Complete
  // (just done), then a plain green tile with nothing to show, then vacant
  // always last since no one lives there and no requests will be filed for
  // the time being. Within a tier, whichever property has the most
  // recently created request rises to the top.
  const tierRank = (entry: (typeof withRequests)[number]) => {
    if (entry.isVacant) return 5;
    if (entry.badgeStatus === "multiple") return 0;
    if (entry.badgeStatus === "open") return 1;
    if (entry.badgeStatus === "in_progress") return 2;
    if (entry.badgeStatus === "done") return 3;
    return 4;
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
      {orderedProperties.map(({ property: p, tenantName, badgeStatus, relevantRequest, waveRequests, categorySummary }) => {
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

        const toRow = (r: RequestRow) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          status: r.status,
          description: r.description,
          timeLabel: formatRelativeTime(r.created_at),
        });

        return (
          <PropertyTile
            key={p.id}
            tenantName={tenantName ?? null}
            addressLine={p.addressLine}
            badgeStatus={badgeStatus}
            categoryValue={badgeStatus ? (relevantRequest?.category ?? null) : null}
            categorySummary={categorySummary}
            addTenantHref={addTenantHref}
            newest={newest ? toRow(newest) : null}
            waveRequests={waveRequests ? waveRequests.map(toRow) : null}
          />
        );
      })}
    </ul>
  );
}
