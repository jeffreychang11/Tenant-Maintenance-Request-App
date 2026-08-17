"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY_PREFIX = "message_cap_warning_dismissed_";

// Fires once when a landlord first crosses 80% of their base cap, before
// they've hit the harder buffer-zone/blocked states (those get the
// persistent MessageUsageBanner instead, since "no action needed right
// now" would be a misleading thing to say once they're actually blocked).
// Dismissal is remembered per calendar month via localStorage — simplest
// way to make it a one-time nudge without new DB schema just for a seen
// flag.
export function MessageCapWarningPopup({
  show,
  periodMonth,
}: {
  show: boolean;
  periodMonth: string;
}) {
  const dismissedKey = `${DISMISSED_KEY_PREFIX}${periodMonth}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(dismissedKey)) return;
    setOpen(true);
  }, [show, dismissedKey]);

  function dismiss() {
    setOpen(false);
    window.localStorage.setItem(dismissedKey, "1");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={dismiss}>
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-zinc-900"
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Your account has used 80% of its monthly maintenance texts. No action is needed right
          now, but you can track usage in your dashboard.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
