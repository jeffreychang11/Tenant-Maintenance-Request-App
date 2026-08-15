import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeAccessStatus, getSubscriptionForLandlord } from "@/lib/billing/subscription";
import { LandlordNavBar } from "@/components/layout/LandlordNavBar";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { UpgradeCelebrationModal } from "@/components/billing/UpgradeCelebrationModal";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "landlord") redirect("/home");

  const supabase = await createClient();
  const sub = await getSubscriptionForLandlord(supabase, profile.id);
  const access = computeAccessStatus(sub);
  const showCelebration = (await cookies()).has("celebrate_unit_upgrade");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandlordNavBar />
      <TrialBanner access={access} />
      <UpgradeCelebrationModal show={showCelebration} />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
