import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { NavBar } from "@/components/layout/NavBar";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (profile.role !== "tenant") redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <NavBar
        role="tenant"
        links={[
          { href: "/home", label: "Home" },
          { href: "/settings", label: "Settings" },
        ]}
      />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
