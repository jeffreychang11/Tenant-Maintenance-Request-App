import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeAccessStatus, getSubscriptionForLandlord } from "@/lib/billing/subscription";

// Called first in every mutating landlord server action, in the same
// position as the existing `if (!user) redirect("/login")` check. A
// locked-out landlord can still view everything — this only blocks writes.
export async function requireActiveSubscription(landlordId: string) {
  const supabase = await createClient();
  const sub = await getSubscriptionForLandlord(supabase, landlordId);
  if (computeAccessStatus(sub).locked) redirect("/billing?locked=1");
}
