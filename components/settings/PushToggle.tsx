"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push/register";

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isSupported = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(isSupported);
    if (isSupported) {
      navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setEnabled(!!sub);
      });
    }
  }, []);

  if (!supported) {
    return (
      <p className="text-sm text-zinc-500">
        Push notifications aren&apos;t supported in this browser.
      </p>
    );
  }

  async function handleToggle() {
    setLoading(true);
    if (enabled) {
      await unsubscribeFromPush();
      setEnabled(false);
    } else {
      const ok = await subscribeToPush();
      setEnabled(ok);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/20"
    >
      {enabled ? "Disable push notifications" : "Enable push notifications"}
    </button>
  );
}
