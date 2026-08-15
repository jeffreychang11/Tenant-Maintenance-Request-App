"use client";

import { useState } from "react";
import { IconPlayerPlay, IconX } from "@tabler/icons-react";
import { categoryLabel } from "@/lib/categories";
import { StatusBadge } from "@/components/requests/StatusBadge";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

type Attachment = {
  id: string;
  file_type: string;
  signedUrl: string | null;
};

export function RequestDetail({
  title,
  category,
  status,
  createdAt,
  attachments,
  description,
}: {
  title: string;
  category: string;
  status: string;
  createdAt: string;
  attachments: Attachment[];
  description?: string | null;
}) {
  const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video" } | null>(null);

  function openLightbox(a: Attachment) {
    if (!a.signedUrl) return;
    setLightbox({ url: a.signedUrl, type: a.file_type === "video" ? "video" : "image" });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            {categoryLabel(category)} · {formatRelativeTime(createdAt)}
          </p>
          <h1 className="mt-1 text-2xl font-medium">{title}</h1>
        </div>
        <StatusBadge status={status} />
      </div>

      {attachments.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((a) =>
            a.signedUrl ? (
              <button
                key={a.id}
                type="button"
                onClick={() => openLightbox(a)}
                className="relative aspect-square w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
              >
                {a.file_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.signedUrl}
                    alt="Request attachment"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <video src={a.signedUrl} className="h-full w-full object-cover" muted />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <IconPlayerPlay size={28} className="text-white" aria-hidden="true" />
                    </span>
                  </>
                )}
              </button>
            ) : null
          )}
        </div>
      )}

      {description && <p className="mt-4 text-sm text-black dark:text-white">{description}</p>}

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
    </>
  );
}
