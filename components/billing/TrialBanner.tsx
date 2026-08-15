import Link from "next/link";
import type { AccessStatus } from "@/lib/billing/subscription";

const TRIAL_REMINDER_THRESHOLD_DAYS = 7;

export function TrialBanner({ access }: { access: AccessStatus }) {
  if (access.locked) {
    return (
      <div className="flex items-center justify-between gap-3 bg-red-50 px-6 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
        <span>Your free trial has ended — subscribe to keep managing your properties.</span>
        <Link href="/billing" className="shrink-0 font-medium underline">
          Subscribe
        </Link>
      </div>
    );
  }

  if (
    access.trialing &&
    access.daysLeftInTrial !== null &&
    access.daysLeftInTrial <= TRIAL_REMINDER_THRESHOLD_DAYS
  ) {
    return (
      <div className="flex items-center justify-between gap-3 bg-amber-50 px-6 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
        <span>
          {access.daysLeftInTrial} day{access.daysLeftInTrial === 1 ? "" : "s"} left in your free
          trial.
        </span>
        <Link href="/billing" className="shrink-0 font-medium underline">
          Subscribe
        </Link>
      </div>
    );
  }

  return null;
}
