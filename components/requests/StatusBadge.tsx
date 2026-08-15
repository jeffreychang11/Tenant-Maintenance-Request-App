const STYLES: Record<string, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  reopened: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

const LABELS: Record<string, string> = {
  open: "Maintenance required",
  reopened: "Reopened",
  in_progress: "In progress",
  done: "Complete",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${STYLES[status] ?? "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-400"}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
