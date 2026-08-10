const LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  reopened: "Reopened",
};

type HistoryEntry = {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
  changedByName: string | null;
};

export function StatusTimeline({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">History</h2>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        {history.map((h) => (
          <li key={h.id}>
            {h.changedByName || "Someone"} changed status
            {h.from_status ? ` from ${LABELS[h.from_status] ?? h.from_status}` : ""} to{" "}
            {LABELS[h.to_status] ?? h.to_status}
            {" · "}
            {new Date(h.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
