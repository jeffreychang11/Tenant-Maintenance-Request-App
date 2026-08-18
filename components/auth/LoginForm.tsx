"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BackButton } from "@/components/layout/BackButton";
import { Logo } from "@/components/layout/Logo";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
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

  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <header className="flex items-center px-6 py-3">
        <Logo href="/login" />
      </header>
      <div className="px-6 pt-4">
        <BackButton />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-10">
        <h1 className="text-2xl font-medium">Log in</h1>

        <form onSubmit={handlePasswordSignIn} className="mt-8 flex flex-col gap-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            Log in
          </button>
        </form>

        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          Landlord and don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-black hover:underline active:underline dark:text-white"
          >
            Sign up
          </Link>
          . Tenants join via an invite link from their landlord.
        </p>
      </div>
    </div>
  );
}
