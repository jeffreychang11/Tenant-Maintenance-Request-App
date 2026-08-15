"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push/register";

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const isSupported = "serviceWorker" in navigator && "PushManager" in window;
      setSupported(isSupported);
      if (isSupported) {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setEnabled(!!sub);
      }
    })();
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
      className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
    >
      {enabled ? "Disable push notifications" : "Enable push notifications"}
    </button>
  );
}
