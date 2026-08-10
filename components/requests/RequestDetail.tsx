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
}: {
  title: string;
  category: string;
  status: string;
  createdAt: string;
  attachments: Attachment[];
}) {
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
              a.file_type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.id}
                  src={a.signedUrl}
                  alt="Request attachment"
                  className="aspect-square w-full rounded-lg border border-black/10 object-cover dark:border-white/10"
                />
              ) : (
                <video
                  key={a.id}
                  src={a.signedUrl}
                  controls
                  className="aspect-square w-full rounded-lg border border-black/10 object-cover dark:border-white/10"
                />
              )
            ) : null
          )}
        </div>
      )}
    </>
  );
}
