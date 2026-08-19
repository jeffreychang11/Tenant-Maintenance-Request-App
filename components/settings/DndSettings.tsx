"use client";

import { useEffect, useState } from "react";
import { updateDndSettings } from "@/app/settings/actions";

export function DndSettings({
  initialEnabled,
  initialStartTime,
  initialEndTime,
}: {
  initialEnabled: boolean;
  initialStartTime: string | null;
  initialEndTime: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [startTime, setStartTime] = useState(initialStartTime?.slice(0, 5) ?? "22:00");
  const [endTime, setEndTime] = useState(initialEndTime?.slice(0, 5) ?? "07:00");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      await updateDndSettings(formData);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={handleSubmit} className="mt-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Do Not Disturb</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Mute push notifications during this time range every day. You&apos;ll still get email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            enabled
              ? "bg-black text-white hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
              : "border border-black/10 hover:bg-black/5 active:bg-black/10 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      <input type="hidden" name="dnd_enabled" value={enabled ? "on" : "off"} />
      <input type="hidden" name="dnd_timezone" value={timezone} />

      {enabled && (
        <div className="mt-3 flex items-center gap-3">
          <label className="flex flex-col text-xs text-zinc-500 dark:text-zinc-400">
            From
            <input
              type="time"
              name="dnd_start_time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 rounded-md border border-black/10 px-2 py-1 text-sm dark:border-white/20 dark:bg-black"
            />
          </label>
          <label className="flex flex-col text-xs text-zinc-500 dark:text-zinc-400">
            To
            <input
              type="time"
              name="dnd_end_time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 rounded-md border border-black/10 px-2 py-1 text-sm dark:border-white/20 dark:bg-black"
            />
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
