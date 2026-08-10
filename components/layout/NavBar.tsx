"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NavBar({
  role,
  links,
}: {
  role: "landlord" | "tenant";
  links: { href: string; label: string }[];
}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/10">
      <nav className="flex items-center gap-5 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-zinc-400">{role === "landlord" ? "Landlord" : "Tenant"}</span>
        <button onClick={handleSignOut} className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
          Sign out
        </button>
      </div>
    </header>
  );
}
