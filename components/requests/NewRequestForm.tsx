"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryValue } from "@/lib/categories";
import { triggerNotificationProcessing } from "@/lib/notifications/trigger";
import { compressImage } from "@/lib/media/compressImage";
import { compressVideo } from "@/lib/media/compressVideo";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function classifyFile(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export function NewRequestForm({
  units,
  initialCategory,
}: {
  units: { id: string; label: string }[];
  initialCategory?: string;
}) {
  const router = useRouter();
  const unitId = units[0]?.id ?? "";
  const category: CategoryValue = (initialCategory as CategoryValue) || "other";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const kinds: ("image" | "video")[] = [];
    for (const file of selected) {
      const kind = classifyFile(file);
      if (!kind) {
        setError(`${file.name} isn't a supported photo or video type.`);
        return;
      }
      const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      if (file.size > limit) {
        setError(`${file.name} is too large (max ${kind === "image" ? "25MB" : "100MB"}).`);
        return;
      }
      kinds.push(kind);
    }
    setError(null);

    // Compress client-side (downscaled WebP/JPEG photos, trimmed-and-
    // recompressed video) before it ever touches Supabase Storage, to
    // keep storage costs down. Runs at selection time, not submit time,
    // so a resubmit after fixing a validation error doesn't redo it.
    setCompressing(true);
    const compressed = await Promise.all(
      selected.map((file, i) => (kinds[i] === "image" ? compressImage(file) : compressVideo(file)))
    );
    setCompressing(false);
    setFiles(compressed);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "create_maintenance_request",
      {
        p_unit_id: unitId,
        p_title: title,
        p_description: (description || null) as string,
        p_category: category,
      }
    );

    const created = rpcData?.[0];

    if (rpcError || !created || !user) {
      setError(rpcError?.message ?? "Something went wrong creating the request.");
      setStatus("idle");
      return;
    }

    const { request_id: requestId, message_id: messageId } = created;

    for (const file of files) {
      const kind = classifyFile(file)!;
      const path = `${requestId}/${crypto.randomUUID()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("request-attachments")
        .upload(path, file);

      if (uploadError) {
        setError(`Request created, but ${file.name} failed to upload: ${uploadError.message}`);
        continue;
      }

      await supabase.from("request_attachments").insert({
        request_id: requestId,
        message_id: messageId,
        uploader_id: user.id,
        storage_path: path,
        file_type: kind,
        mime_type: file.type,
        size_bytes: file.size,
      });
    }

    triggerNotificationProcessing();
    // replace, not push — the new-request form shouldn't sit in history
    // between the submitted request and wherever the tenant came from, so
    // pressing back from the request detail page goes straight to home
    // instead of back to the (now stale) empty form.
    router.replace(`/my-requests/${requestId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
      <div>
        <label htmlFor="title" className="block text-sm text-zinc-600 dark:text-zinc-400">
          Title
        </label>
        <input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Leaking kitchen faucet"
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
      </div>

      <div>
        <label htmlFor="files" className="block text-sm text-zinc-600 dark:text-zinc-400">
          Photo or video (optional)
        </label>
        <label
          htmlFor="files"
          className="mt-1 flex aspect-square w-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-black/20 text-zinc-400 transition-colors hover:bg-black/[.02] active:bg-black/[.05] dark:border-white/20 dark:hover:bg-white/[.03] dark:active:bg-white/[.06]"
        >
          <IconPlus size={28} aria-hidden="true" />
          <span className="sr-only">Add photo or video</span>
        </label>
        <input
          id="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
          onChange={handleFileChange}
          className="sr-only"
        />
        {compressing ? (
          <p className="mt-2 text-xs text-zinc-500">Compressing...</p>
        ) : (
          files.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">{files.length} file(s) selected</p>
          )
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm text-zinc-600 dark:text-zinc-400">
          Message
        </label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting" || compressing || !unitId}
        className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
      >
        {status === "submitting" ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
