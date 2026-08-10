import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { NavBar } from "@/components/layout/NavBar";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "landlord") redirect("/home");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <NavBar
        role="landlord"
        links={[
          { href: "/dashboard", label: "Properties" },
          { href: "/requests", label: "Requests" },
          { href: "/settings", label: "Settings" },
        ]}
      />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
