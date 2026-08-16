import { NextResponse } from "next/server";
import { processPendingNotifications } from "@/lib/notifications/dispatch";
import { notificationsProcessLimiter, getClientIp } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const { success } = await notificationsProcessLimiter.limit(getClientIp(request));
  if (!success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await processPendingNotifications();
  return NextResponse.json(result);
}
