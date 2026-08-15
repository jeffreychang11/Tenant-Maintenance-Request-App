"use client";

import { useEffect } from "react";

// Registers the service worker unconditionally on every page load (not
// just when a user opts into push notifications, which is the only place
// lib/push/register.ts registered it before). Chrome/Android's automatic
// "install app" prompt looks for an active service worker as one of its
// installability signals, so without this a landlord/tenant who never
// touches push notifications could still be missing the home-screen
// install prompt entirely. iOS's "Add to Home Screen" doesn't need a
// service worker at all (just the manifest + apple-touch-icon), so this
// is purely for Android/desktop Chrome install eligibility.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[pwa] Service worker registration failed:", err);
    });
  }, []);

  return null;
}
