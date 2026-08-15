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
  description: string | null;
  timeLabel: string;
};

export function PropertyTile({
  tenantName,
  addressLine,
  badgeStatus,
  categoryValue,
  newest,
  addTenantHref,
}: {
  tenantName: string | null;
  addressLine: string;
  badgeStatus: "open" | "in_progress" | "done" | null;
  categoryValue: string | null;
  newest: NewestRequest | null;
  addTenantHref: string;
}) {
  const [open, setOpen] = useState(false);

  const CategoryIcon = categoryValue
    ? CATEGORIES.find((c) => c.value === categoryValue)?.icon
    : undefined;

  const isVacant = !tenantName;

  const barColor = isVacant
    ? "border-l-transparent"
    : badgeStatus === "open"
      ? "border-l-red-500"
      : badgeStatus === "in_progress"
        ? "border-l-amber-500"
        : "border-l-green-500";

  // No resting background tint — the row stays plain until interacted
  // with: hovering (desktop) previews the color, and it stays lit once
  // clicked open, as confirmation of which tile is selected (a released
  // tap has no lingering :hover of its own to keep it lit otherwise). A
  // vacant property has no status color to reach for, so it gets a plain
  // grey version of the same treatment instead of no feedback at all.
  const rowTint = statusInteractiveClass(isVacant ? "vacant" : badgeStatus, open);

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
          {CategoryIcon && categoryValue && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              <CategoryIcon size={20} aria-hidden="true" />
              {categoryLabel(categoryValue)}
            </span>
          )}
          {badgeStatus === "done" ? (
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
                <Link
                  href={addTenantHref}
                  className="mt-2 self-start rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/20"
                >
                  Add tenant
                </Link>
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
                <Link
                  href={`/requests/${newest.id}`}
                  className="mt-2 self-start rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/20"
                >
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
