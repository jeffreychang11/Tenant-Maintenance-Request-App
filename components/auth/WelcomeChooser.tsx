"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconBuildingSkyscraper, IconHome } from "@tabler/icons-react";

// Accepts a full invite URL, a bare "/invite/<token>" path, or a raw token
// pasted directly, and returns just the token.
function extractInviteToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const pathMatch = trimmed.match(/\/invite\/([^/?#\s]+)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);

  return trimmed;
}

export function WelcomeChooser() {
  const router = useRouter();
  const [tenantOpen, setTenantOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const token = extractInviteToken(inviteInput);
    if (!token) {
      setError("Paste your invite link to continue.");
      return;
    }
    router.push(`/invite/${encodeURIComponent(token)}`);
  }

  if (tenantOpen) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <button
          type="button"
          onClick={() => {
            setTenantOpen(false);
            setError(null);
          }}
          aria-label="Back"
          className="mb-4 inline-flex h-9 w-9 items-center justify-center self-start rounded-full text-zinc-600 transition-colors hover:bg-black/5 active:bg-black/10 dark:text-zinc-400 dark:hover:bg-white/10 dark:active:bg-white/15"
        >
          <IconArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="text-2xl font-medium">You&apos;ll need an invite</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Tenant accounts are set up by your landlord. Ask them to invite you — you&apos;ll get an
          email with an invite link. Already have one? Paste it below to get started.
        </p>

        <form onSubmit={handleContinue} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="inviteLink" className="block text-sm text-zinc-600 dark:text-zinc-400">
              Invite link
            </label>
            <input
              id="inviteLink"
              required
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Paste your invite link here"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-medium">Welcome</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Tell us who you are to get started.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/signup"
          className="flex flex-col items-center gap-3 rounded-xl border border-black/10 px-4 py-8 text-center transition-colors hover:border-black/30 active:border-black/40 dark:border-white/10 dark:hover:border-white/30 dark:active:border-white/40"
        >
          <IconBuildingSkyscraper size={32} stroke={1.5} />
          <span className="font-medium">I&apos;m a landlord</span>
        </Link>

        <button
          type="button"
          onClick={() => setTenantOpen(true)}
          className="flex flex-col items-center gap-3 rounded-xl border border-black/10 px-4 py-8 text-center transition-colors hover:border-black/30 active:border-black/40 dark:border-white/10 dark:hover:border-white/30 dark:active:border-white/40"
        >
          <IconHome size={32} stroke={1.5} />
          <span className="font-medium">I&apos;m a tenant</span>
        </button>
      </div>

      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login?form=1"
          className="font-medium text-black hover:underline active:underline dark:text-white"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
