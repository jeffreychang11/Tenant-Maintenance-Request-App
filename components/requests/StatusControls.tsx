"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { triggerNotificationProcessing } from "@/lib/notifications/trigger";

const LANDLORD_TRANSITIONS: Record<string, { to: string; label: string }[]> = {
  open: [
    { to: "in_progress", label: "Mark in progress" },
    { to: "done", label: "Mark complete" },
  ],
  in_progress: [{ to: "done", label: "Mark complete" }],
  reopened: [
    { to: "in_progress", label: "Mark in progress" },
    { to: "done", label: "Mark complete" },
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
      if (error.message.includes("subscription_required")) {
        router.push("/billing?locked=1");
        return;
      }
      setError(error.message);
      setLoading(false);
      return;
    }
    triggerNotificationProcessing();
    router.refresh();
    setLoading(false);
  }

  const buttonColor: Record<string, string> = {
    in_progress:
      "border-amber-400 text-amber-700 hover:bg-amber-50 active:bg-amber-100 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950 dark:active:bg-amber-900",
    done: "border-green-400 text-green-700 hover:bg-green-50 active:bg-green-100 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-950 dark:active:bg-green-900",
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <button
          key={o.to}
          disabled={loading}
          onClick={() => handleTransition(o.to)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            buttonColor[o.to] ?? "border-black/10 hover:bg-black/5 active:bg-black/10 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
          }`}
        >
          {o.label}
        </button>
      ))}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

// In case the landlord fixed it in person and forgot to update the status,
// the tenant can resolve it themselves — either outcome just marks it done.
export function TenantStatusControls({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "done") return null;

  async function handleResolve() {
    setLoading(true);
    setError(null);
    const { error } = await callUpdateStatus(requestId, "done");
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
      <button
        disabled={loading}
        onClick={handleResolve}
        className="rounded-full border border-green-400 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-50 active:bg-green-100 disabled:opacity-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-950 dark:active:bg-green-900"
      >
        Mark complete
      </button>
      <button
        disabled={loading}
        onClick={handleResolve}
        className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 active:bg-black/10 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
      >
        No longer needed
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
