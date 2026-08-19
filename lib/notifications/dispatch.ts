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

const STATUS_LABELS: Record<string, string> = {
  open: "Maintenance required",
  reopened: "Reopened",
  in_progress: "In progress",
  done: "Complete",
};

function pushBody(
  event: { type: string; payload: unknown },
  requestTitle: string
): string {
  const payload = event.payload as { body?: string; status?: string } | null;
  if (event.type === "new_message" && payload?.body) {
    return payload.body.length > 120 ? `${payload.body.slice(0, 117)}...` : payload.body;
  }
  if (event.type === "status_changed" && payload?.status) {
    const label = STATUS_LABELS[payload.status] ?? payload.status;
    return `${requestTitle}: ${label}`;
  }
  return requestTitle;
}

/**
 * Whether it's currently inside the recipient's configured Do Not Disturb
 * window, evaluated in their own local time (dnd_timezone) so an overnight
 * range like 22:00-07:00 behaves correctly regardless of server timezone.
 * Fails open (returns false) on missing/invalid DND config rather than ever
 * silently blocking push forever.
 */
function isWithinDnd(profile: {
  dnd_enabled: boolean;
  dnd_start_time: string | null;
  dnd_end_time: string | null;
  dnd_timezone: string | null;
}): boolean {
  if (!profile.dnd_enabled || !profile.dnd_start_time || !profile.dnd_end_time || !profile.dnd_timezone) {
    return false;
  }

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  let nowLocal: string;
  try {
    nowLocal = new Intl.DateTimeFormat("en-US", {
      timeZone: profile.dnd_timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
  } catch {
    return false;
  }

  const nowMinutes = toMinutes(nowLocal);
  const startMinutes = toMinutes(profile.dnd_start_time);
  const endMinutes = toMinutes(profile.dnd_end_time);

  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Window wraps past midnight (e.g. 22:00 -> 07:00).
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

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
      .select("role, dnd_enabled, dnd_start_time, dnd_end_time, dnd_timezone")
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

    if (pushStatus === "pending" && recipient && isWithinDnd(recipient)) {
      pushStatus = "skipped";
    } else if (pushStatus === "pending") {
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
              JSON.stringify({
                title: PUSH_TITLES[event.type] ?? "Update",
                body: pushBody(event, title),
                url,
              })
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
