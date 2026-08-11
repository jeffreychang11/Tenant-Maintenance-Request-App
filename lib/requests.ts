import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function loadRequestDetail(supabase: SupabaseClient<Database>, requestId: string) {
  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("id, title, description, category, status, created_at, unit_id")
    .eq("id", requestId)
    .single();

  if (!request) return null;

  const [{ data: attachments }, { data: messages }, { data: history }] = await Promise.all([
    supabase
      .from("request_attachments")
      .select("id, storage_path, file_type, message_id")
      .eq("request_id", requestId),
    supabase
      .from("request_messages")
      .select("id, sender_id, body, created_at, profiles(full_name)")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
    supabase
      .from("request_status_history")
      .select("id, from_status, to_status, created_at, profiles(full_name)")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
  ]);

  let signedAttachments: {
    id: string;
    file_type: string;
    signedUrl: string | null;
    message_id: string | null;
  }[] = [];
  if (attachments && attachments.length > 0) {
    const { data: signed } = await supabase.storage
      .from("request-attachments")
      .createSignedUrls(
        attachments.map((a) => a.storage_path),
        3600
      );
    signedAttachments = attachments.map((a, i) => ({
      id: a.id,
      file_type: a.file_type,
      signedUrl: signed?.[i]?.signedUrl ?? null,
      message_id: a.message_id,
    }));
  }

  const chatMessages = (messages ?? []).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    body: m.body,
    created_at: m.created_at,
    senderName: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
    attachments: signedAttachments
      .filter((a) => a.message_id === m.id)
      .map((a) => ({ id: a.id, file_type: a.file_type, signedUrl: a.signedUrl })),
  }));

  const statusHistory = (history ?? []).map((h) => ({
    id: h.id,
    from_status: h.from_status,
    to_status: h.to_status,
    created_at: h.created_at,
    changedByName: (h.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }));

  return {
    request,
    attachments: signedAttachments,
    messages: chatMessages,
    history: statusHistory,
  };
}
