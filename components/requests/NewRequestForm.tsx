"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, type CategoryValue } from "@/lib/categories";
import { triggerNotificationProcessing } from "@/lib/notifications/trigger";

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
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [category, setCategory] = useState<CategoryValue>(
    (initialCategory as CategoryValue) || "other"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
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
    }
    setError(null);
    setFiles(selected);
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
    router.push(`/my-requests/${requestId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      {units.length > 1 && (
        <div>
          <label htmlFor="unit" className="block text-sm text-zinc-600 dark:text-zinc-400">
            Unit
          </label>
          <select
            id="unit"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="category" className="block text-sm text-zinc-600 dark:text-zinc-400">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryValue)}
          className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

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

      <div>
        <label htmlFor="files" className="block text-sm text-zinc-600 dark:text-zinc-400">
          Photo or video (optional)
        </label>
        <input
          id="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
          onChange={handleFileChange}
          className="mt-1 w-full text-sm"
        />
        {files.length > 0 && (
          <p className="mt-1 text-xs text-zinc-500">{files.length} file(s) selected</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting" || !unitId}
        className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {status === "submitting" ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
