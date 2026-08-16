import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeAccessStatus, getSubscriptionForLandlord } from "@/lib/billing/subscription";
import { getMessageUsage, MESSAGE_CAP_WARNING_THRESHOLD } from "@/lib/billing/messageLimit";
import { LandlordNavBar } from "@/components/layout/LandlordNavBar";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { UpgradeCelebrationModal } from "@/components/billing/UpgradeCelebrationModal";
import { MessageUsageBanner } from "@/components/billing/MessageUsageBanner";
import { MessageCapWarningPopup } from "@/components/billing/MessageCapWarningPopup";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "landlord") redirect("/home");

  const supabase = await createClient();
  const [sub, usage] = await Promise.all([
    getSubscriptionForLandlord(supabase, profile.id),
    getMessageUsage(supabase),
  ]);
  const access = computeAccessStatus(sub);
  const showCelebration = (await cookies()).has("celebrate_unit_upgrade");

  // The 80% popup is a one-time nudge, distinct from the persistent banner
  // below — it only makes sense before the harder buffer-zone/blocked
  // states kick in, since "no action needed" would be misleading once
  // they're actually restricted.
  const approachingLimit =
    !usage.blocked &&
    !usage.inBufferZone &&
    usage.baseCap > 0 &&
    usage.messagesUsed / usage.baseCap >= MESSAGE_CAP_WARNING_THRESHOLD;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandlordNavBar />
      <TrialBanner access={access} />
      <MessageUsageBanner usage={usage} />
      <UpgradeCelebrationModal show={showCelebration} />
      <MessageCapWarningPopup show={approachingLimit} periodMonth={usage.periodMonth} />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
