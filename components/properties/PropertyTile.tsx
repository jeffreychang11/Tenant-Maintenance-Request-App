"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { CATEGORIES, categoryLabel } from "@/lib/categories";

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
}: {
  tenantName: string | null;
  addressLine: string;
  badgeStatus: "open" | "in_progress" | null;
  categoryValue: string | null;
  newest: NewestRequest | null;
}) {
  const [open, setOpen] = useState(false);

  const CategoryIcon = categoryValue
    ? CATEGORIES.find((c) => c.value === categoryValue)?.icon
    : undefined;

  const barColor =
    badgeStatus === "open"
      ? "border-l-red-500"
      : badgeStatus === "in_progress"
        ? "border-l-amber-500"
        : "border-l-green-500";

  return (
    <li
      className={`overflow-hidden rounded-xl border border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:border-white/10 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 border-l-4 px-4 py-3 text-left ${barColor}`}
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{tenantName || "No tenant"}</p>
          <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{addressLine}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {CategoryIcon && categoryValue && (
            <span className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              <CategoryIcon size={18} aria-hidden="true" />
              {categoryLabel(categoryValue)}
            </span>
          )}
          {badgeStatus && <StatusBadge status={badgeStatus} />}
        </div>
      </button>

      <div
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      >
        <div className="overflow-hidden">
          <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
            {newest ? (
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
                  View request
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
