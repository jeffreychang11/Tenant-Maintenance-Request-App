import "server-only";
import { Resend } from "resend";
import { buildInviteMessage } from "@/lib/inviteMessage";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(str: string): string {
  return str.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

// The email itself is the landlord's own pre-filled message (buildInviteMessage,
// shared with CopyInviteMessage's clipboard version so both channels read the
// same) rather than a generic "you've been invited" notice.
export async function sendInviteMessageEmail(opts: {
  to: string;
  firstName: string;
  inviteUrl: string;
  // The landlord's own email (the one they signed up with) — set as
  // reply-to so a tenant hitting "Reply" reaches the landlord directly,
  // not the platform's own from-address, which nobody reads.
  replyTo?: string;
}) {
  const { to, firstName, inviteUrl, replyTo } = opts;
  const message = buildInviteMessage(firstName, inviteUrl);

  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping invite email to ${to}: ${message}`);
    return;
  }

  const escapedMessage = escapeHtml(message).replace(
    escapeHtml(inviteUrl),
    `<a href="${inviteUrl}">${escapeHtml(inviteUrl)}</a>`
  );

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to,
    subject: "A message from your landlord",
    html: `<p>A message from your landlord:</p><p>"${escapedMessage}"</p>`,
    ...(replyTo ? { replyTo } : {}),
  });
  // The Resend SDK resolves with { error } on API failures rather than
  // throwing, so callers checking only for a thrown exception would never
  // see a failed send — surface it explicitly instead.
  if (error) throw new Error(error.message);
}

const SUBJECTS: Record<string, (title: string) => string> = {
  request_created: (title) => `New maintenance request: ${title}`,
  new_message: (title) => `New reply on "${title}"`,
  status_changed: (title) => `Status update: ${title}`,
};

export async function sendNotificationEmail(opts: {
  to: string;
  type: string;
  title: string;
  url: string;
}) {
  const { to, type, title, url } = opts;
  const subject = SUBJECTS[type]?.(title) ?? `Update on "${title}"`;

  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping notification email to ${to} (${subject})`);
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to,
    subject,
    html: `<p>${subject}</p><p><a href="${url}">View request</a></p>`,
  });
  if (error) throw new Error(error.message);
}
