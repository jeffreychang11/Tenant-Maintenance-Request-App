import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadRequestDetail } from "@/lib/requests";
import { getMessageUsage } from "@/lib/billing/messageLimit";
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

  const [result, usage] = await Promise.all([
    loadRequestDetail(supabase, requestId, user.id),
    getMessageUsage(supabase),
  ]);
  if (!result) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <MarkAsRead requestId={requestId} userId={user.id} />
      <Link
        href="/dashboard"
        aria-label="Back to home"
        className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
      >
        <IconArrowLeft size={20} aria-hidden="true" />
      </Link>
      <RequestDetail
        title={result.request.title}
        category={result.request.category}
        status={result.request.status}
        createdAt={result.request.created_at}
        attachments={result.attachments}
        description={result.request.description}
      />
      <RequestConversation
        requestId={requestId}
        currentUserId={user.id}
        otherUserId={result.otherUserId}
        initialMessages={result.messages}
        initialBlocked={usage.blocked}
        initialInBufferZone={usage.inBufferZone}
        tier={usage.tier}
        initialOtherLastReadAt={result.otherLastReadAt}
      />
      <LandlordStatusControls requestId={requestId} status={result.request.status} />
    </div>
  );
}
