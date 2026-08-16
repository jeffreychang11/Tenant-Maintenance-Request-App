"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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

// Small stylized rooster, facing right (the direction the bar fills), in
// brown — drawn as plain SVG shapes instead of the 🐓 emoji so the color
// and facing direction are both under our control (emoji glyphs render
// with fixed colors and orientation that vary by platform).
function RoosterIcon({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 40 32"
      width="28"
      height="22"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <line x1="16" y1="24" x2="14" y2="30" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="24" x2="24" y2="30" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 14 C4 8, 2 2, 8 4 C6 10, 10 14, 14 14 Z" fill="#5c3a21" />
      <path d="M15 16 C6 14, 2 10, 6 8 C7 14, 12 17, 15 16 Z" fill="#7c4a22" />
      <ellipse cx="19" cy="18" rx="11" ry="8" fill="#8b5a2b" />
      <circle cx="29" cy="10" r="5.5" fill="#8b5a2b" />
      <path d="M25 4 Q26 1 27 4 Q28 1 29 4 Q30 1 31 4 Q30 6 27 6 Q25 6 25 4 Z" fill="#dc2626" />
      <path d="M31 12 Q33 13 31 16 Q29 14 31 12 Z" fill="#dc2626" />
      <path d="M34 9 L39 10.5 L34 12 Z" fill="#f59e0b" />
      <circle cx="30" cy="8.5" r="1" fill="#1c1917" />
    </svg>
  );
}

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
      <div className="relative mt-4 h-6 w-full">
        <div className="absolute bottom-0 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${barColorClass(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <RoosterIcon
          className={`absolute bottom-1 ${running ? "animate-rooster-waddle" : ""}`}
          style={{ left: `${percent}%`, transform: running ? undefined : "translateX(-50%)" }}
        />
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
