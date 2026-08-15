// Red (needs attention) before yellow (in progress) before green (done),
// for tenant-facing request lists. Array.prototype.sort is stable, so
// requests within the same tier keep whatever order they arrived in.
const RANK: Record<string, number> = {
  open: 0,
  reopened: 0,
  in_progress: 1,
  done: 2,
};

export function statusUrgencyRank(status: string): number {
  return RANK[status] ?? 3;
}

// Same red/yellow/green coding as the landlord dashboard's PropertyTile bar.
const BAR_COLOR: Record<string, string> = {
  open: "border-l-red-500",
  reopened: "border-l-red-500",
  in_progress: "border-l-amber-500",
  done: "border-l-green-500",
};

export function statusBarColorClass(status: string): string {
  return BAR_COLOR[status] ?? "border-l-transparent";
}

// Shared status → color coding for the full-row background tint used by
// both the landlord's PropertyTile and the tenant's request list rows.
// Deliberately has NO resting/idle tint — the row is plain until the user
// actually interacts with it, and only then does the tint reveal itself:
// hovering on desktop, or the instant a finger presses down on a touch
// device. Written as complete, literal class strings (not built from
// interpolated fragments) since Tailwind's build-time scanner only
// generates CSS for class names it can find verbatim in source.
const INTERACTIVE_TINT: Record<string, { hoverActive: string; selected: string }> = {
  open: {
    hoverActive: "hover:bg-red-100 dark:hover:bg-red-950/60 active:bg-red-100 dark:active:bg-red-950/60",
    selected: "bg-red-100 dark:bg-red-950/60",
  },
  reopened: {
    hoverActive: "hover:bg-red-100 dark:hover:bg-red-950/60 active:bg-red-100 dark:active:bg-red-950/60",
    selected: "bg-red-100 dark:bg-red-950/60",
  },
  in_progress: {
    hoverActive:
      "hover:bg-amber-100 dark:hover:bg-amber-950/60 active:bg-amber-100 dark:active:bg-amber-950/60",
    selected: "bg-amber-100 dark:bg-amber-950/60",
  },
  done: {
    hoverActive: "hover:bg-green-100 dark:hover:bg-green-950/60 active:bg-green-100 dark:active:bg-green-950/60",
    selected: "bg-green-100 dark:bg-green-950/60",
  },
  // Not a real request status — a pseudo-key the landlord's PropertyTile
  // passes in for a vacant property, which has no status color of its own
  // but should still light up (grey, since there's no red/amber/green to
  // reach for) on hover/select, same as every other tile.
  vacant: {
    hoverActive: "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 active:bg-zinc-100 dark:active:bg-zinc-800/60",
    selected: "bg-zinc-100 dark:bg-zinc-800/60",
  },
};

// Used by both a plain toggle tile (the landlord's PropertyTile, passing
// its own `open` state as `selected` so the tile stays lit while expanded
// — a released tap has no lingering :hover/:active to keep it lit on its
// own) and a tenant's request-row `<Link>` (always passing `selected:
// false`, since :hover/:active alone already cover "hovering on desktop"
// and "the instant a finger presses down" before it navigates away).
export function statusInteractiveClass(status: string | null, selected: boolean): string {
  const tone = status ? INTERACTIVE_TINT[status] : undefined;
  if (!tone) return "";
  return selected ? `${tone.selected} ${tone.hoverActive}` : tone.hoverActive;
}
