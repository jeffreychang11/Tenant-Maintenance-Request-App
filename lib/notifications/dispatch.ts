import "server-only";
import webPush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email/resend";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

if (VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const PUSH_TITLES: Record<string, string> = {
  request_created: "New maintenance request",
  new_message: "New message",
  status_changed: "Status update",
};

/**
 * Processes pending rows in the notification_events outbox: sends web push
 * (when the recipient has subscriptions) and always attempts email — email
 * is the guaranteed fallback and is never conditional on push succeeding.
 */
export async function processPendingNotifications(limit = 20) {
  const admin = createAdminClient();

  const { data: events } = await admin
    .from("notification_events")
    .select("*")
    .or("email_status.eq.pending,push_status.eq.pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!events || events.length === 0) return { processed: 0 };

  for (const event of events) {
    const { data: recipient } = await admin
      .from("profiles")
      .select("role")
      .eq("id", event.recipient_id)
      .single();

    const { data: request } = event.request_id
      ? await admin
          .from("maintenance_requests")
          .select("title")
          .eq("id", event.request_id)
          .single()
      : { data: null };

    const title = request?.title ?? "your request";
    const path = recipient?.role === "landlord" ? "requests" : "my-requests";
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/${path}/${event.request_id}`;

    let emailStatus = event.email_status;
    let pushStatus = event.push_status;

    if (pushStatus === "pending") {
      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", event.recipient_id);

      if (!subs || subs.length === 0) {
        pushStatus = "skipped";
      } else if (VAPID_PUBLIC && VAPID_PRIVATE) {
        let anySent = false;
        for (const sub of subs) {
          try {
            await webPush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title: PUSH_TITLES[event.type] ?? "Update", body: title, url })
            );
            anySent = true;
          } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await admin.from("push_subscriptions").delete().eq("id", sub.id);
            }
          }
        }
        pushStatus = anySent ? "sent" : "failed";
      } else {
        pushStatus = "skipped";
      }
    }

    if (emailStatus === "pending") {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(event.recipient_id);
        const recipientEmail = authUser?.user?.email;
        if (recipientEmail) {
          await sendNotificationEmail({ to: recipientEmail, type: event.type, title, url });
          emailStatus = "sent";
        } else {
          emailStatus = "skipped";
        }
      } catch {
        emailStatus = "failed";
      }
    }

    await admin
      .from("notification_events")
      .update({
        email_status: emailStatus,
        push_status: pushStatus,
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);
  }

  return { processed: events.length };
}
