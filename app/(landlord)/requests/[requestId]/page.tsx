import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadRequestDetail } from "@/lib/requests";
import { RequestDetail } from "@/components/requests/RequestDetail";
import { RequestConversation } from "@/components/chat/RequestConversation";
import { LandlordStatusControls } from "@/components/requests/StatusControls";
import { MarkAsRead } from "@/components/requests/MarkAsRead";

export default async function LandlordRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { user } = await requireProfile();
  const { requestId } = await params;
  const supabase = await createClient();

  const result = await loadRequestDetail(supabase, requestId);
  if (!result) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkAsRead requestId={requestId} userId={user.id} />
      <RequestDetail
        title={result.request.title}
        category={result.request.category}
        status={result.request.status}
        createdAt={result.request.created_at}
        attachments={[]}
      />
      <RequestConversation
        requestId={requestId}
        currentUserId={user.id}
        initialMessages={result.messages}
      />
      <LandlordStatusControls requestId={requestId} status={result.request.status} />
    </div>
  );
}
