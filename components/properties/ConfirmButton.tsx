"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmButton({
  action,
  confirmMessage,
  confirmLabel = "Confirm",
  children,
  className,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  confirmLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setLoading(true);
    try {
      await action();
      router.refresh();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-zinc-900"
          >
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{confirmMessage}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
