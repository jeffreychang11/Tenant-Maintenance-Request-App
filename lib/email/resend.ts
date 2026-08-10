import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendInviteEmail(opts: {
  to: string;
  inviteUrl: string;
  propertyName: string;
  unitLabel: string;
  landlordName: string;
}) {
  const { to, inviteUrl, propertyName, unitLabel, landlordName } = opts;

  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping invite email to ${to}. Invite URL: ${inviteUrl}`
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to,
    subject: `${landlordName} invited you to ${propertyName}`,
    html: `<p>${landlordName} invited you to report maintenance issues for ${propertyName} ${unitLabel}.</p><p><a href="${inviteUrl}">Accept invite</a></p><p>This link expires in 7 days.</p>`,
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
