"use client";

import { useState } from "react";

export function CopyInviteMessage({ inviteUrl }: { inviteUrl: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    const message = `Hi [Name], going forward all maintenance requests will go through our official portal here: ${inviteUrl}. Please bookmark this link on your phone's home screen.`;

    try {
      await navigator.clipboard.writeText(message);
      setStatus("copied");
    } catch {
      // Clipboard API can be unavailable/denied (older browsers, some
      // embedded contexts) — fall back to the legacy textarea+execCommand
      // trick rather than failing silently with no feedback at all.
      try {
        const textarea = document.createElement("textarea");
        textarea.value = message;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        setStatus(ok ? "copied" : "error");
      } catch {
        setStatus("error");
      }
    }
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs text-zinc-600 hover:underline active:underline dark:text-zinc-400"
    >
      {status === "copied" ? "Copied!" : status === "error" ? "Couldn't copy" : "Copy invite message"}
    </button>
  );
}
