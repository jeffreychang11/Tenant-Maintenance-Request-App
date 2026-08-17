"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { triggerNotificationProcessing } from "@/lib/notifications/trigger";

type Message = {
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  senderName: string | null;
};

export function MessageThread({
  requestId,
  currentUserId,
  initialMessages,
}: {
  requestId: string;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Subscribes regardless of whether a reply exists yet, so the chatbox can
  // appear live the moment the landlord's first reply arrives, instead of
  // needing a reload.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`request:${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "request_messages",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            body: string | null;
            created_at: string;
          };
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, senderName: null }]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  const firstMessage = messages[0];
  const hasReply =
    messages.length > 1 && messages.some((m) => m.sender_id !== firstMessage?.sender_id);
  const replyMessages = messages.slice(1);

  useEffect(() => {
    if (hasReply) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replyMessages.length, hasReply]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || blocked) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("request_messages").insert({
      request_id: requestId,
      sender_id: currentUserId,
      body: body.trim(),
    });
    if (!error) {
      setBody("");
      triggerNotificationProcessing();
    } else if (error.message.includes("message_cap_exceeded")) {
      setBlocked(true);
    }
    setSending(false);
  }

  // No chatbox at all until the other side has actually replied — the
  // tenant's own opening message already shows above (photo/video +
  // description), so there's nothing to show here yet.
  if (!hasReply) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Messages</h2>
      <div className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto rounded-xl border border-black/10 p-3 dark:border-white/10">
        {replyMessages.map((m) => {
          const isMe = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <span className="mb-0.5 text-xs text-zinc-500">
                {isMe ? "You" : m.senderName || "Them"}
              </span>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  isMe
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-black/5 dark:bg-white/10"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {blocked ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-400">
          Your landlord has reached their monthly message limit. New messages can&apos;t be sent
          right now — try again later.
        </p>
      ) : (
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
