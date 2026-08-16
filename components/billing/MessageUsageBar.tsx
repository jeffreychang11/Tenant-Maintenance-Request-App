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
      viewBox="0 0 44 36"
      width="32"
      height="26"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <line x1="18" y1="26" x2="16" y2="33" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="33" x2="13" y2="34.5" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="33" x2="18" y2="35" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="26" x2="27" y2="33" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
      <line x1="27" y1="33" x2="24" y2="34.5" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27" y1="33" x2="29" y2="35" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 16 C4 6, 0 -2, 9 1 C6 9, 12 15, 16 16 Z" fill="#4a2c17" />
      <path d="M17 18 C6 12, 1 6, 7 5 C7 12, 13 19, 17 18 Z" fill="#6b4423" />
      <path d="M18 20 C8 17, 4 12, 9 10 C9 16, 14 21, 18 20 Z" fill="#8b5a2b" />
      <ellipse cx="20" cy="19" rx="11" ry="8" fill="#8b5a2b" />
      <path d="M14 15 Q22 14 24 22 Q17 24 13 19 Q12 16 14 15 Z" fill="#6b4423" />
      <ellipse cx="24" cy="23" rx="4" ry="3" fill="#c9a876" opacity="0.85" />
      <circle cx="31" cy="10" r="5.5" fill="#8b5a2b" />
      <path
        d="M27 4 Q27.5 1 28.5 3.5 Q29.5 0.5 30.5 3.5 Q31.5 0.5 32.5 3.5 Q33.5 1 34 4 Q33 6.5 30.5 6.5 Q28 6.5 27 4 Z"
        fill="#dc2626"
      />
      <path d="M33 13 Q35.5 14.5 33 18 Q30.5 15 33 13 Z" fill="#dc2626" />
      <path d="M36 10 L42 11.5 L36 13.5 Z" fill="#f59e0b" />
      <circle cx="32" cy="8.5" r="1.1" fill="#1c1917" />
      <circle cx="32.3" cy="8.2" r="0.35" fill="#fff" />
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
      <div className="relative mt-4 h-7 w-full">
        <div className="absolute top-1/2 h-2.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${barColorClass(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <RoosterIcon
          className={`absolute top-1/2 ${running ? "animate-rooster-waddle" : ""}`}
          style={{ left: `${percent}%`, transform: running ? undefined : "translate(-50%, -50%)" }}
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
