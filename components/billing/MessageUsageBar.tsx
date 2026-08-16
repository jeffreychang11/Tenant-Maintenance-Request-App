"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageUsage } from "@/lib/billing/messageLimit";

// Green below 60% of the base cap, yellow 60-80%, red 80% and up
// (including the buffer zone and fully-blocked states, which are always
// past the base cap by definition).
function barColorClass(percent: number): string {
  if (percent >= 80) return "bg-red-500";
  if (percent >= 60) return "bg-amber-500";
  return "bg-green-500";
}

const RUN_DURATION_MS = 1400;

export function MessageUsageBar({ usage }: { usage: MessageUsage }) {
  const targetPercent =
    usage.tier && usage.baseCap > 0
      ? Math.min(100, (usage.messagesUsed / usage.baseCap) * 100)
      : 0;

  const [percent, setPercent] = useState(0);
  const [running, setRunning] = useState(false);
  const frameRef = useRef<number | null>(null);

  // Runs the rooster from the start of the bar to its current usage point
  // every time this component mounts (i.e. every time the landlord lands
  // on the settings page), driving `percent` frame-by-frame via rAF
  // rather than a CSS transition — that's what lets barColorClass
  // recompute live as it passes the 60%/80% thresholds mid-run, instead
  // of jumping straight to its final color.
  useEffect(() => {
    if (!usage.tier) return;
    setPercent(0);

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setPercent(targetPercent);
      return;
    }

    setRunning(true);
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / RUN_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setPercent(targetPercent * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setRunning(false);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usage.tier, targetPercent]);

  if (!usage.tier) return null;

  return (
    <div>
      <h2 className="text-lg font-medium">Monthly maintenance message allowance</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {usage.messagesUsed} of {usage.baseCap} messages used this month
        {usage.bundleCap > 0 && ` (+${usage.bundleCap} purchased)`}.
      </p>
      <div className="relative mt-7 w-full">
        <span
          aria-hidden="true"
          className={`absolute -top-6 inline-block text-xl ${running ? "animate-rooster-waddle" : ""}`}
          style={{ left: `${percent}%`, transform: running ? undefined : "translateX(-50%)" }}
        >
          🐓
        </span>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${barColorClass(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {usage.inBufferZone && !usage.blocked && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          {usage.tier === "tier_1_3"
            ? `You're past your plan's allowance and using your ${usage.bufferCap}-message emergency buffer.`
            : "You're past your plan's allowance and using your purchased extra messages."}
        </p>
      )}
      {usage.blocked && (
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          You&apos;ve used all your messages for this month. You can still view existing
          conversations, but new messages won&apos;t send until you upgrade or the month resets.
        </p>
      )}
    </div>
  );
}
