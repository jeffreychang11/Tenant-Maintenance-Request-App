"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";

export function UpgradeCelebrationModal({ show }: { show: boolean }) {
  const [open, setOpen] = useState(show);

  useEffect(() => {
    if (!show) return;
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
  }, [show]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-w-sm rounded-2xl border border-black/10 bg-white p-6 text-center dark:border-white/10 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-medium">🎉 Looks like your business is growing!</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Upgrade to Premium for up to 10 units.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link
            href="/billing"
            onClick={() => setOpen(false)}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            View plans
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
