"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";

export function TenantNavBar() {
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
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="relative flex items-center justify-end border-b border-black/10 px-6 py-3 dark:border-white/10">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="rounded-md p-1.5 text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
      >
        {open ? <IconX size={22} /> : <IconMenu2 size={22} />}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-4 top-14 z-10 flex w-48 flex-col gap-1 rounded-xl border border-black/10 bg-white p-2 text-sm dark:border-white/10 dark:bg-zinc-900"
        >
          <Link
            href="/home"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Home
          </Link>
          <Link
            href="/my-requests"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Requests
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Settings
          </Link>
          <div className="my-1 border-t border-black/10 dark:border-white/10" />
          <button
            onClick={handleSignOut}
            className="rounded-md px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
