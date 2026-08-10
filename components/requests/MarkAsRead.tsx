"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function MarkAsRead({ requestId, userId }: { requestId: string; userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("request_reads")
      .upsert(
        { request_id: requestId, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: "request_id,user_id" }
      )
      .then();
  }, [requestId, userId]);

  return null;
}
