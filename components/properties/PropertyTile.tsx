"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { statusInteractiveClass } from "@/lib/statusRank";

type NewestRequest = {
  id: string;
  title: string;
  category: string;
  status: string;
  description: string | null;
  timeLabel: string;
};

export function PropertyTile({
  tenantName,
  addressLine,
  badgeStatus,
  categoryValue,
  categorySummary,
  newest,
  waveRequests,
  addTenantHref,
}: {
  tenantName: string | null;
  addressLine: string;
  badgeStatus: "open" | "in_progress" | "done" | "multiple" | null;
  categoryValue: string | null;
  categorySummary: { category: string; count: number }[] | null;
  newest: NewestRequest | null;
  waveRequests: NewestRequest[] | null;
  addTenantHref: string;
}) {
  const [open, setOpen] = useState(false);

  const CategoryIcon = categoryValue
    ? CATEGORIES.find((c) => c.value === categoryValue)?.icon
    : undefined;

  const isVacant = !tenantName;

  // Single source of truth for the tile's color, shared by the left bar
  // and the hover/select tint below — badgeStatus is null both for a
  // recently-done request past its 24h window AND a property with no
  // requests at all, and both cases still render a green bar, so the tone
  // falls through to "done" (green) whenever it isn't open/in_progress/
  // multiple.
  const tone = isVacant
    ? "vacant"
    : badgeStatus === "multiple"
      ? "multiple"
      : badgeStatus === "open"
        ? "open"
        : badgeStatus === "in_progress"
          ? "in_progress"
          : "done";

  const barColor =
    tone === "vacant"
      ? "border-l-transparent"
      : tone === "multiple"
        ? "border-l-blue-500"
        : tone === "open"
          ? "border-l-red-500"
          : tone === "in_progress"
            ? "border-l-amber-500"
            : "border-l-green-500";

  // No resting background tint — the row stays plain until interacted
  // with: hovering (desktop) previews the color, and it stays lit once
  // clicked open, as confirmation of which tile is selected (a released
  // tap has no lingering :hover of its own to keep it lit otherwise). A
  // vacant property has no status color to reach for, so it gets a plain
  // grey version of the same treatment instead of no feedback at all.
  const rowTint = statusInteractiveClass(tone, open);

  // Shared look for every plain white pill button inside the dropdown
  // (Details, Add tenant) — turns silver on hover, and on :active too so
  // a tap gives the same feedback on mobile, where there's no hover state
  // to reveal it's tappable otherwise. Text forced to black on the silver
  // fill since it's light in both themes, unlike the border it sits on.
  const pillButtonClass =
    "self-start rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#C0C0C0] hover:text-black active:bg-[#C0C0C0] active:text-black dark:border-white/20";

  return (
    <li
      className={`overflow-hidden rounded-xl border border-black/10 shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:border-white/10 dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 border-l-4 px-4 py-4 text-left transition-colors ${barColor} ${rowTint}`}
      >
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{tenantName || "Vacant"}</p>
          <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{addressLine}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {categorySummary ? (
            <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
              {categorySummary.map(({ category, count }) => {
                const Icon = CATEGORIES.find((c) => c.value === category)?.icon;
                if (!Icon) return null;
                return (
                  <span key={category} className="flex items-center gap-0.5">
                    <Icon size={20} aria-hidden="true" />
                    {count > 1 && <span className="text-xs font-medium">×{count}</span>}
                  </span>
                );
              })}
            </span>
          ) : (
            CategoryIcon &&
            categoryValue && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                <CategoryIcon size={20} aria-hidden="true" />
                {categoryLabel(categoryValue)}
              </span>
            )
          )}
          {badgeStatus === "multiple" ? (
            <span className="whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
              Multiple requests
            </span>
          ) : badgeStatus === "done" ? (
            <span className="whitespace-nowrap rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
              Complete
            </span>
          ) : (
            badgeStatus && <StatusBadge status={badgeStatus} />
          )}
        </div>
      </button>

      <div
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      >
        <div className="overflow-hidden">
          <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
            {isVacant ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-zinc-500">No tenant yet.</p>
                <Link href={addTenantHref} className={`mt-2 ${pillButtonClass}`}>
                  Add tenant
                </Link>
              </div>
            ) : waveRequests ? (
              <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
                {waveRequests.map((r) => {
                  const RowIcon = CATEGORIES.find((c) => c.value === r.category)?.icon;
                  return (
                    <div key={r.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{r.title}</p>
                        <span className="flex shrink-0 items-center gap-2">
                          {RowIcon && (
                            <RowIcon
                              size={18}
                              aria-hidden="true"
                              className="text-zinc-500 dark:text-zinc-400"
                            />
                          )}
                          <StatusBadge status={r.status} />
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {categoryLabel(r.category)} · {r.timeLabel}
                      </p>
                      {r.description && (
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {r.description}
                        </p>
                      )}
                      <Link href={`/requests/${r.id}`} className={`mt-1 ${pillButtonClass}`}>
                        Details
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : newest ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{newest.title}</p>
                <p className="text-xs text-zinc-500">
                  {categoryLabel(newest.category)} · {newest.timeLabel}
                </p>
                {newest.description && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {newest.description}
                  </p>
                )}
                <Link href={`/requests/${newest.id}`} className={`mt-2 ${pillButtonClass}`}>
                  Details
                </Link>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No requests yet.</p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
