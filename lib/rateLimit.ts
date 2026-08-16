import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// /api/notifications/process has no auth check (it can't — it's invoked by
// fire-and-forget client fetches right after a mutation, with no session
// requirement of its own) and runs with the service-role key, so an
// unthrottled caller could force real Resend sends / push notifications in
// a loop. Keyed by IP; generous enough that normal chat/status-update
// bursts never come close.
export const notificationsProcessLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:notifications-process",
});

// Tenant invites send a real email via Resend to an address the landlord
// types in — keyed by landlord user id so one landlord's usage can't lock
// out another, generous enough for legitimately onboarding many units at
// once.
export const inviteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  prefix: "ratelimit:invite",
});

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
