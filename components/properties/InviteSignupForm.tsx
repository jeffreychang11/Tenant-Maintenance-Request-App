"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function InviteSignupForm({ email, token }: { email: string; token: string }) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    const supabase = createClient();
    const next = `/invite/${token}`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "tenant", full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Check {email} to confirm your account, then come back to this link to finish joining.
      </p>
    );
  }

  return (
    <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="fullName" className="block text-sm text-zinc-600 dark:text-zinc-400">
          Full name
        </label>
        <input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm text-zinc-600 dark:text-zinc-400">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className="mt-1 w-full rounded-md border border-black/10 bg-black/[.03] px-3 py-2 text-zinc-500 dark:border-white/20 dark:bg-white/[.05]"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm text-zinc-600 dark:text-zinc-400">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        Create account
      </button>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="font-medium text-black dark:text-white"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
