"use client";

import { useEffect, useRef, useState } from "react";
import { IconPlayerPlay, IconX } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { triggerNotificationProcessing } from "@/lib/notifications/trigger";

type MessageAttachment = { id: string; file_type: string; signedUrl: string | null };

type Message = {
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  senderName: string | null;
  attachments: MessageAttachment[];
};

export function RequestConversation({
  requestId,
  currentUserId,
  initialMessages,
}: {
  requestId: string;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const firstMessage = messages[0];
  const hasReply = messages.length > 0 && messages.some((m) => m.sender_id !== firstMessage.sender_id);

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
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { ...row, senderName: null, attachments: [] }]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  useEffect(() => {
    if (hasReply) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, hasReply]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("request_messages").insert({
      request_id: requestId,
      sender_id: currentUserId,
      body: body.trim(),
    });
    if (!error) {
      setBody("");
      setReplying(false);
      triggerNotificationProcessing();
    }
    setSending(false);
  }

  function openLightbox(a: MessageAttachment) {
    if (!a.signedUrl) return;
    setLightbox({ url: a.signedUrl, type: a.file_type === "video" ? "video" : "image" });
  }

  function AttachmentGrid({ attachments }: { attachments: MessageAttachment[] }) {
    if (attachments.length === 0) return null;
    return (
      <div className="grid grid-cols-3 gap-2">
        {attachments.map((a) =>
          a.signedUrl ? (
            <button
              key={a.id}
              type="button"
              onClick={() => openLightbox(a)}
              className="relative aspect-square overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
            >
              {a.file_type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.signedUrl} alt="Attachment" className="h-full w-full object-cover" />
              ) : (
                <>
                  <video src={a.signedUrl} className="h-full w-full object-cover" muted />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <IconPlayerPlay size={22} className="text-white" aria-hidden="true" />
                  </span>
                </>
              )}
            </button>
          ) : null
        )}
      </div>
    );
  }

  if (!hasReply) {
    return (
      <div className="mt-6">
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
          {firstMessage?.body && <p className="text-sm">{firstMessage.body}</p>}
          <AttachmentGrid attachments={firstMessage?.attachments ?? []} />
        </div>

        {replying ? (
          <form onSubmit={handleSend} className="mt-3 flex gap-2">
            <input
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
            />
            <button
              type="submit"
              disabled={sending}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Send
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/20"
          >
            Reply
          </button>
        )}

        {lightbox && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightbox(null)}
          >
            {lightbox.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt="Attachment" className="max-h-full max-w-full rounded-lg" />
            ) : (
              <video
                src={lightbox.url}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <IconX size={20} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium">Messages</h2>
      <div className="mt-3 flex max-h-96 flex-col gap-3 overflow-y-auto rounded-xl border border-black/10 p-3 dark:border-white/10">
        {messages.map((m) => {
          const isMe = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <span className="mb-0.5 text-xs text-zinc-500">
                {isMe ? "You" : m.senderName || "Them"}
              </span>
              {m.body && (
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    isMe
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {m.body}
                </div>
              )}
              {m.attachments.length > 0 && (
                <div className="mt-2 w-full max-w-[80%]">
                  <AttachmentGrid attachments={m.attachments} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
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
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Send
        </button>
      </form>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {lightbox.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt="Attachment" className="max-h-full max-w-full rounded-lg" />
          ) : (
            <video
              src={lightbox.url}
              controls
              autoPlay
              className="max-h-full max-w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <IconX size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
