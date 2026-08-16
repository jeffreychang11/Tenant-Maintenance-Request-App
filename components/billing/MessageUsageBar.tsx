import type { MessageUsage } from "@/lib/billing/messageLimit";

// Green below 60% of the base cap, yellow 60-80%, red 80% and up
// (including the buffer zone and fully-blocked states, which are always
// past the base cap by definition).
function barColorClass(percent: number): string {
  if (percent >= 80) return "bg-red-500";
  if (percent >= 60) return "bg-amber-500";
  return "bg-green-500";
}

export function MessageUsageBar({ usage }: { usage: MessageUsage }) {
  if (!usage.tier) return null;

  const percent = usage.baseCap > 0 ? Math.min(100, Math.round((usage.messagesUsed / usage.baseCap) * 100)) : 0;

  return (
    <div>
      <h2 className="text-lg font-medium">Monthly maintenance message allowance</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {usage.messagesUsed} of {usage.baseCap} messages used this month
        {usage.bundleCap > 0 && ` (+${usage.bundleCap} purchased)`}.
      </p>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] ${barColorClass(percent)}`}
          style={{ width: `${percent}%` }}
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
