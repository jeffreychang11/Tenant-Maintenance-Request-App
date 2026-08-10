import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { LandlordNavBar } from "@/components/layout/LandlordNavBar";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "landlord") redirect("/home");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandlordNavBar />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
