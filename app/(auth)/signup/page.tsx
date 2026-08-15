"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BackButton } from "@/components/layout/BackButton";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "landlord", full_name: fullName, phone },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/billing?welcome=1")}`,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <BackButton />
      <h1 className="text-2xl font-medium">Create a landlord account</h1>

      {status === "sent" ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          Check {email} to confirm your account, then log in.
        </p>
      ) : (
        <form onSubmit={handleSignup} className="mt-8 flex flex-col gap-4">
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
            <label htmlFor="phone" className="block text-sm text-zinc-600 dark:text-zinc-400">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
              placeholder="name@company.com"
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
            Sign up
          </button>
        </form>
      )}

      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login?form=1" className="font-medium text-black dark:text-white">
          Log in
        </Link>
      </p>
    </div>
  );
}
