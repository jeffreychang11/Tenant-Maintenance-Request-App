import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadRequestDetail } from "@/lib/requests";
import { RequestDetail } from "@/components/requests/RequestDetail";
import { MessageThread } from "@/components/chat/MessageThread";
import { TenantStatusControls } from "@/components/requests/StatusControls";
import { MarkAsRead } from "@/components/requests/MarkAsRead";
import { BackButton } from "@/components/layout/BackButton";

export default async function TenantRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { user } = await requireProfile();
  const { requestId } = await params;
  const supabase = await createClient();

  const result = await loadRequestDetail(supabase, requestId, user.id);
  if (!result) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkAsRead requestId={requestId} userId={user.id} />
      <BackButton />
      <RequestDetail
        title={result.request.title}
        category={result.request.category}
        status={result.request.status}
        createdAt={result.request.created_at}
        attachments={result.attachments}
        description={result.request.description}
      />
      <MessageThread
        requestId={requestId}
        currentUserId={user.id}
        otherUserId={result.otherUserId}
        initialMessages={result.messages}
        initialOtherLastReadAt={result.otherLastReadAt}
      />
      <TenantStatusControls requestId={requestId} status={result.request.status} />
    </div>
  );
}
