import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryLandlordContact } from "@/lib/landlord";
import { TenantNavBar } from "@/components/layout/TenantNavBar";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireProfile();
  if (profile.role !== "tenant") redirect("/dashboard");

  const supabase = await createClient();
  const landlordContact = await getPrimaryLandlordContact(supabase, user.id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TenantNavBar landlordContact={landlordContact} />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
