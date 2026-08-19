import Link from "next/link";
import type { MessageUsage } from "@/lib/billing/messageLimit";

// Persistent, account-wide — a blocked/buffer-zone landlord should see why
// messages aren't sending regardless of which page they're on, same
// reasoning as TrialBanner. The softer "approaching 80%" notice is a
// one-time popup instead (MessageCapWarningPopup), not this banner.
export function MessageUsageBanner({ usage }: { usage: MessageUsage }) {
  if (usage.blocked) {
    return (
      <div className="flex items-center justify-between gap-3 bg-red-50 px-6 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
        <span>
          You&apos;ve reached this month&apos;s messaging limit, so new messages won&apos;t send.{" "}
          {usage.tier === "tier_1_3" ? "Upgrade to Premium" : "Buy more messages"} to keep
          chatting with tenants.
        </span>
        <Link href="/billing" className="shrink-0 font-medium underline">
          Fix this
        </Link>
      </div>
    );
  }

  if (usage.inBufferZone) {
    return (
      <div className="flex items-center justify-between gap-3 bg-amber-50 px-6 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
        <span>
          {usage.tier === "tier_1_3"
            ? "You're past your plan's message allowance and using your emergency buffer."
            : "You're past your plan's message allowance and using your purchased extra messages."}
        </span>
        <Link href="/billing" className="shrink-0 font-medium underline">
          Manage usage
        </Link>
      </div>
    );
  }

  return null;
}
