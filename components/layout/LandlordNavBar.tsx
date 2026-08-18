"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "./Logo";

export function LandlordNavBar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // `form=0` forces the logo/tagline splash instead of the plain login
    // form the `seen_auth` cookie would otherwise select (that cookie is
    // deliberately left set after logout — see middleware.ts — so this is
    // the one spot that needs to override it).
    router.push("/login?form=0");
    router.refresh();
  }

  return (
    <header className="relative flex items-center justify-between px-6 py-3">
      <Logo href="/dashboard" />
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-black/5 active:bg-black/10 dark:text-zinc-400 dark:hover:bg-white/10 dark:active:bg-white/15"
      >
        {open ? <IconX size={22} /> : <IconMenu2 size={22} />}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-4 top-14 z-10 flex w-56 flex-col gap-1 rounded-xl border border-black/10 bg-white p-2 text-sm dark:border-white/10 dark:bg-zinc-900"
        >
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            Home
          </Link>
          <Link
            href="/manage-properties"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            Manage Properties
          </Link>
          <Link
            href="/billing"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            Billing
          </Link>
          <Link
            href="/support"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            Support
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            Settings
          </Link>
          <div className="my-1 border-t border-black/10 dark:border-white/10" />
          <button
            onClick={handleSignOut}
            className="rounded-md px-3 py-2 text-left transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
