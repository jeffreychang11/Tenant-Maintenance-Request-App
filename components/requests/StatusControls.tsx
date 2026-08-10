"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { triggerNotificationProcessing } from "@/lib/notifications/trigger";

const LANDLORD_TRANSITIONS: Record<string, { to: string; label: string }[]> = {
  open: [
    { to: "in_progress", label: "Mark in progress" },
    { to: "done", label: "Mark done" },
  ],
  in_progress: [
    { to: "open", label: "Move back to open" },
    { to: "done", label: "Mark done" },
  ],
  reopened: [
    { to: "in_progress", label: "Mark in progress" },
    { to: "done", label: "Mark done" },
  ],
  done: [],
};

async function callUpdateStatus(requestId: string, to: string) {
  const supabase = createClient();
  return supabase.rpc("update_request_status", { p_request_id: requestId, p_new_status: to });
}

export function LandlordStatusControls({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = LANDLORD_TRANSITIONS[status] ?? [];
  if (options.length === 0) return null;

  async function handleTransition(to: string) {
    setLoading(true);
    setError(null);
    const { error } = await callUpdateStatus(requestId, to);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    triggerNotificationProcessing();
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <button
          key={o.to}
          disabled={loading}
          onClick={() => handleTransition(o.to)}
          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-white/20"
        >
          {o.label}
        </button>
      ))}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function TenantReopenControl({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "done") return null;

  async function handleReopen() {
    setLoading(true);
    setError(null);
    const { error } = await callUpdateStatus(requestId, "reopened");
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    triggerNotificationProcessing();
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="mt-4">
      <button
        disabled={loading}
        onClick={handleReopen}
        className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-white/20"
      >
        This isn&apos;t fixed — reopen
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
