"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-medium">Log in</h1>

      <div className="mt-6 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`rounded-full px-3 py-1 ${mode === "password" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-black/10 dark:border-white/20"}`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic-link")}
          className={`rounded-full px-3 py-1 ${mode === "magic-link" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-black/10 dark:border-white/20"}`}
        >
          Magic link
        </button>
      </div>

      {status === "sent" ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <form
          onSubmit={mode === "password" ? handlePasswordSignIn : handleMagicLink}
          className="mt-8 flex flex-col gap-4"
        >
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

          {mode === "password" && (
            <div>
              <label htmlFor="password" className="block text-sm text-zinc-600 dark:text-zinc-400">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {mode === "password" ? "Log in" : "Send magic link"}
          </button>
        </form>
      )}

      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        Landlord and don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-black dark:text-white">
          Sign up
        </Link>
        . Tenants join via an invite link from their landlord.
      </p>
    </div>
  );
}
