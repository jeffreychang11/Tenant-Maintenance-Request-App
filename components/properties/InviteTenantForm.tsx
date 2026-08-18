"use client";

import { useState } from "react";
import { createInvite, sendInviteMessage } from "@/app/(landlord)/properties/actions";
import { buildInviteMessage } from "@/lib/inviteMessage";

type PendingInvite = { inviteId: string; inviteUrl: string; firstName: string };

export function InviteTenantForm({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleAddTenant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      const result = await createInvite(propertyId, unitId, formData);
      setInvite(result);
      setSendStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function handleSend() {
    if (!invite) return;
    setSendStatus("sending");
    try {
      await sendInviteMessage(propertyId, unitId, invite.inviteId);
      setSendStatus("sent");
    } catch {
      setSendStatus("error");
    }
  }

  return (
    <div className="mt-3">
      <form onSubmit={handleAddTenant} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tenant's name"
          className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
        />
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tenant@example.com"
          className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          {pending ? "…" : "Add tenant"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {invite && (
        <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
          {sendStatus === "sent" ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Invite message sent to {email}.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">Want to send this invite message?</p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                &ldquo;{buildInviteMessage(invite.firstName, invite.inviteUrl)}&rdquo;
              </p>
              {sendStatus === "error" && (
                <p className="mt-2 text-sm text-red-600">
                  Couldn&apos;t send the message — try again.
                </p>
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={sendStatus === "sending"}
                className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
              >
                {sendStatus === "sending" ? "Sending…" : "Send"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
