@AGENTS.md

# Home Maintenance Request App

Web app where tenants submit maintenance requests (photo/video + message) to
their landlord; landlord and tenant chat on the request and track it through
a status lifecycle (Open → In Progress → Done → Reopened). Multi-landlord
SaaS: each landlord manages their own properties/units and invites their own
tenants. Full architecture rationale is in the original plan file (local to
the machine that built this, not in git):
`~/.claude/plans/i-want-to-build-giggly-gadget.md`.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind) on Vercel + Supabase (Postgres,
Auth, Storage, Realtime) + Resend (email) + Web Push (VAPID).

## Status: Phases 1–5 complete, Phase 6 (polish/deploy) remaining

1. ✅ Auth + core data model + RLS (profiles, properties, units, tenant_units, tenant_invites)
2. ✅ Property/unit management + tenant invite flow (email + accept RPC)
3. ✅ Maintenance requests + photo/video attachments (Storage) + both dashboards
4. ✅ Realtime chat + status lifecycle RPC + history + reopen
5. ✅ Notification outbox (push + email), triggered from DB events
6. ⬜ Mobile responsive pass, empty/error states, rate limiting, production Resend domain, Vercel deploy

## Environment setup (`.env.local`, gitignored — not in this repo)

Copy `.env.local.example` and fill in:
- Supabase: project URL + anon key + service_role key from
  `supabase.com/dashboard/project/lbjuszkwvvjxsvjrcqav/settings/api` (this
  project already exists — don't create a new one)
- `SUPABASE_ACCESS_TOKEN`: personal access token for the Supabase CLI
  (`supabase.com/dashboard/account/tokens`), needed for `supabase db push`
  and `supabase gen types`
- Resend: API key from `resend.com/api-keys` (account already exists).
  `RESEND_FROM_EMAIL=onboarding@resend.dev` works but Resend's sandbox mode
  only delivers to the Resend account owner's own email — verify a custom
  domain to email arbitrary recipients in production.
- VAPID keys: already generated for this project, ask the user if they need
  them again or regenerate with `npx web-push generate-vapid-keys`
  (regenerating invalidates any existing push subscriptions)

## Test accounts (in the live Supabase project)

- Landlord: `jeffreychang129+landlord@gmail.com` / `TestPassword123!`
- Tenant: `jeffreychang129+tenant@gmail.com` / `TestPassword123!` — linked to
  "123 Main St" / "Unit 2B" (owned by the landlord account above)

## Database migrations

All schema changes go in `supabase/migrations/*.sql`, applied with:
```
set -a && source .env.local && set +a && npx supabase db push
```
Regenerate types after any schema change:
```
set -a && source .env.local && set +a && npx supabase gen types typescript --linked > lib/supabase/types.ts
```
`supabase db push` prints a Docker warning — harmless, it's only about local
dev-stack caching; the push to the remote project still applies.

## Known gotchas hit while building this

- **Tables created via CLI migration do NOT get Supabase's usual
  dashboard-managed default grants.** Every new table needs an explicit
  `grant select, insert, update, delete on public.<table> to authenticated,
  service_role;` (see `20260810150347_grants.sql` and
  `20260810151543_service_role_grants.sql`) or every query silently fails
  with "permission denied" even though RLS policies look correct — this
  caused a real login↔redirect loop bug during Phase 1.
- **The Resend SDK resolves `{ error }` on API failures instead of
  throwing.** Code that only wraps `resend.emails.send()` in try/catch and
  never checks `.error` will silently treat failed sends as successful. Both
  `sendInviteEmail` and `sendNotificationEmail` in `lib/email/resend.ts` now
  explicitly check and throw — don't regress this if touching that file.
- **`profiles` RLS is intentionally narrow** (self-select only, plus two
  "related party" policies added in `20260810151724_related_profile_visibility.sql`
  for landlord↔tenant name visibility via an active `tenant_units` link).
  Don't add a blanket "any authenticated user can read any profile" policy.
- Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts` (exported
  function renamed `proxy`) — this repo already uses the new convention.
- The middleware's route-protection logic excludes `/api/*` from the
  login-redirect check (`lib/supabase/middleware.ts`) — API routes must
  handle their own auth (or intentionally have none, like
  `/api/notifications/process`, which only touches an already-access-controlled
  outbox via the service-role client).

## Notification architecture note

The original plan called for a Supabase Edge Function + Database Webhook for
notification dispatch, but this environment has no local Docker for Edge
Function bundling. Instead: DB triggers write to the `notification_events`
outbox table (unchanged from the plan — this is what gives the reliability
guarantee), and a Next.js route (`/api/notifications/process`) processes
pending rows, fired via a fire-and-forget `fetch()` right after the mutation
that enqueued them (`lib/notifications/trigger.ts`). If revisiting this for
production, consider a real cron/queue instead of relying on client-triggered
processing as the only trigger.
