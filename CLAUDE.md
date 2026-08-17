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
Auth, Storage, Realtime) + Resend (email) + Web Push (VAPID) + Stripe
(landlord subscription billing).

## Status: Phases 1–5 complete + substantial UI/UX polish, Phase 6 (deploy) remaining

1. ✅ Auth + core data model + RLS (profiles, properties, units, tenant_units, tenant_invites)
2. ✅ Property/unit management + tenant invite flow (email + accept RPC)
3. ✅ Maintenance requests + photo/video attachments (Storage) + both dashboards
4. ✅ Realtime chat + status lifecycle RPC + history + reopen
5. ✅ Notification outbox (push + email), triggered from DB events
6. ✅ Vercel deploy is live and verified, rate limiting is done, and the
   Resend production domain is verified — `NEXT_PUBLIC_APP_URL` and
   `RESEND_FROM_EMAIL` now point at `simpleroost.com` in production (see
   below). Nothing known to be blocking left in this phase.

**Vercel deploy is live**, `https://maintenanceapp-six.vercel.app`
(project `jeffrey-chang/maintenanceapp`; the first import/deploy from a
prior session had already succeeded via the Vercel web UI by the time this
session picked it up). Finished in a later session with no local Vercel
plugin MCP available (it requires an OAuth flow that can't run in a
non-interactive session) — used the raw `vercel` CLI instead, invoked via
`npx vercel@latest` since a global `npm i -g vercel` hit `EACCES` (no sudo
in this environment). `vercel login <email>` prints a
`https://vercel.com/oauth/device?user_code=...` URL — pasting that in chat
for the user to open/confirm is enough, no browser control needed on this
end. `vercel link --yes --project maintenanceapp` linked this checkout to
the existing project (writes a fresh `VERCEL_OIDC_TOKEN` into `.env.local`,
harmless/gitignored).

Two known-bad env vars (see prior paragraph history) were confirmed bad
exactly as predicted, then fixed and redeployed:
- `NEXT_PUBLIC_APP_URL` had pasted in as `http://localhost:3000` — replaced
  with the real `https://maintenanceapp-six.vercel.app` via
  `vercel env rm/add ... production`.
- `STRIPE_WEBHOOK_SECRET` was still the local `stripe listen` CLI secret —
  replaced with a real webhook endpoint's secret, created directly via the
  Stripe API (`POST /v1/webhook_endpoints`, using the test-mode
  `STRIPE_SECRET_KEY` already in `.env.local`) pointed at
  `https://maintenanceapp-six.vercel.app/api/stripe/webhook`, subscribed to
  the same 5 events already coded for (see the billing section below).
  Endpoint id `we_1U4b3wPQVF1eQR3XcViJFXI1`, test mode.

Redeployed with `vercel deploy --prod` after the env var fixes (re-aliases
to the same stable `maintenanceapp-six.vercel.app` URL automatically).
Verified live end-to-end, not just "build succeeded": logged into
production as the test landlord account through an actual browser session
and confirmed real property/tenant/request data renders correctly, and
fired a real Stripe test event (`stripe trigger checkout.session.completed`
via the CLI at `~/bin/stripe`, from the earlier session's local setup) at
the new webhook endpoint, then confirmed via `vercel logs` that
`POST /api/stripe/webhook` was received and returned success with no
errors — the signature verification and Supabase writes are working
against real production env vars, not just the route being reachable.

### UI/UX redesign pass (post-Phase-5, done in a later session)

Both roles now use a hamburger menu (`components/layout/TenantNavBar.tsx`,
`LandlordNavBar.tsx`) instead of inline nav links:
- **Tenant**: Home, Requests (`/my-requests`, lists all their requests with a
  "landlord responded" indicator), Contact Landlord (`/contact-landlord`,
  via the `get_landlord_contact` RPC since email lives in `auth.users` not
  `profiles`), Settings, Sign out.
- **Landlord**: Home (`/dashboard`), Manage Properties (`/manage-properties`
  — add/delete property, invite/remove tenants; delete uses `delete_property`
  RPC which also cleans up Storage attachments since those aren't
  FK-cascaded), Support (`/support`, static mailto to the developer),
  Settings, Sign out.

Landlord dashboard property tiles (`components/properties/PropertyTile.tsx`):
animated slide-down expand (CSS grid-rows transition, not native
`<details>`), a left status color bar (red/yellow/green) scoped to just the
summary row via `overflow-hidden` on the outer tile, and a category
icon+label matching whichever request is driving the status badge.

Request detail page (landlord only, `app/(landlord)/requests/[requestId]`):
now a **ticket-then-chat** conversation
(`components/chat/RequestConversation.tsx`). Before the landlord's first
reply it shows just the tenant's message + attachments (click a photo for a
full-screen lightbox; video autoplays with controls) and a Reply button — no
chat UI. Once the landlord replies, it becomes a live chat thread with the
tenant's original message+attachments as the first bubble. This required
`create_maintenance_request` to return the initial message's id (not just
the request id) so attachments can be tagged with the correct `message_id` —
see `20260811090612_create_request_returns_message_id.sql`. The status
history timeline was removed from this page; Mark in progress / Mark done
buttons are amber/green outlined and sit below the chat, not above it.

### Landlord property/tenant management pass (post-redesign session)

**Client-side freshness for back/forward navigation.** Next.js intentionally
serves a frozen cached snapshot on browser back/forward navigation and
ignores server-side `revalidatePath` calls in that case (confirmed against
this repo's vendored Next.js docs — not configurable via `staleTimes`). This
was surfacing as stale status badges / stale property or tenant lists after
clicking a landlord's new `BackButton` (below). Fixed by converting the
dashboard and Manage Properties lists into client components
(`components/properties/DashboardPropertyList.tsx`,
`components/properties/ManagePropertiesList.tsx`) that re-fetch their data
in a `useEffect` on mount, in addition to keeping a `useEffect` that syncs
local state whenever the server-passed props change (needed separately,
since a same-page form action's automatic post-action refresh updates props
but doesn't itself reset `useState`'s initial value). `DashboardPropertyList`
also holds a `postgres_changes` Realtime subscription on
`maintenance_requests` (table added to the publication in
`20260811090613_enable_realtime_maintenance_requests.sql`) so status changes
made on other tabs/sessions reflect live, not just on refetch.

**Property tile ↔ request detail consistency.** The dashboard's expanded
tile preview and its "Details" link used to show whichever request was
*most recently created*, independent of which request was actually driving
the status badge — clicking into a property with a Kitchen/In-progress badge
could land you on an unrelated newest request instead. Fixed in
`DashboardPropertyList`: the expanded preview and link now always point at
the same `relevantRequest` the badge itself is computed from, falling back
to the newest request only when nothing is open/in-progress.

**Chat timestamp dividers** (`components/chat/RequestConversation.tsx`, via
`lib/formatMessageDivider.ts`): iMessage-style centered gray dividers
("Today 2:34 PM" / "Yesterday 8:28 AM" / "Aug 5 2:34 PM") appear above a
message when it's the first one or when there's a same-day gap ≥ 1 hour or a
day boundary since the previous message — not on every message.

**`BackButton`** (`components/layout/BackButton.tsx`, client, uses
`router.back()`) is on every landlord page reached by clicking *into*
something (Add property, property detail, unit detail, request detail) —
deliberately **not** on the four main-menu destinations reached from the
hamburger nav (`/dashboard`, `/manage-properties`, `/support`, `/settings`),
since those already have their own primary navigation. `/settings` is shared
with tenants; the back button there is landlord-only
(`role === "landlord" && <BackButton />`).

**Tenant phone number + contact info.** Invite signup
(`components/properties/InviteSignupForm.tsx`) now also collects a required
phone number, passed through `supabase.auth.signUp` metadata the same way
`full_name` already was. `handle_new_user()` (core schema trigger) was
updated to also write `phone` from that metadata, and a new
`get_tenant_contact(p_tenant_id)` RPC
(`20260811100000_tenant_phone_and_contact_rpc.sql`) lets a landlord read a
tenant's email (lives only in `auth.users`, same reasoning as the existing
`get_landlord_contact`) — gated by an active `tenant_units` link back to one
of the landlord's properties. On the unit detail page,
`components/properties/TenantRow.tsx` slides down (same grid-rows pattern as
`PropertyTile`) on click to reveal email + phone; "Remove tenant" is a
separate, non-toggling action.

**Confirmation modals.** `components/properties/ConfirmButton.tsx` no longer
uses the native `window.confirm()` — it renders an in-app modal (dimmed
backdrop, Cancel + a destructive red confirm button) for both "Delete
property" and "Remove tenant". Same external API (`action`, `confirmMessage`,
now also `confirmLabel` for the button text), so call sites barely changed.

**Vacant property indicators.** A property with no active tenant across any
unit shows "Vacant" instead of the tenant's name: no left color bar and
"Vacant" above the address on the dashboard tile
(`components/properties/PropertyTile.tsx`), "Vacant · Add a tenant" in light
grey below the address on Manage Properties. Both link to whichever unit
lacks a tenant when there's exactly one unit, or the property page otherwise
(so the landlord can pick/add one). The dashboard tile's expanded slide-down
also has an "Add tenant" CTA for vacant properties in place of the usual
request preview.

**Add-property form** (`app/(landlord)/properties/new/page.tsx`) has an
optional "Unit number" field between street address and city/state —
`createProperty` creates that unit inline (in the same action) when
provided, skipping it when left blank. No more forced trip through a
separate "add unit" page for the common one-unit-per-property case.

**Property detail page redesign**
(`app/(landlord)/properties/[propertyId]/page.tsx`): the standalone
"Add unit" form was removed entirely from this page. Each unit without a
tenant now shows an inline email input + "Send invite" button directly (same
`createInvite` action the unit detail page uses) — reached via the
dashboard/Manage-Properties "Add tenant" link when a property has zero units
or more than one, it used to dead-end on a bare unit list with no way to
actually invite anyone. **Superseded later in the same session** — see
"Edit property page" below: unit creation no longer lives here or on Manage
Properties either; it moved to the new dedicated edit page.

**Manage Properties button styling**: per-unit action links are solid black
pills (white text, `rounded-full bg-black`) matching the "Send invite"
button — "Add tenant" for a vacant unit, "Manage →" once one has been added
— instead of the earlier plain text link.

### Tenant-side polish + ticket/chat unification pass (later same session)

**Edit property page** (`app/(landlord)/properties/[propertyId]/edit/page.tsx`,
new, plus `updateProperty` action in
`app/(landlord)/properties/actions.ts`). Manage Properties' per-property
"Add unit" form was removed too — a pencil "Edit" icon button now sits left
of the delete (minus) button on each property card and routes here. This
page is the *only* place `address_line1`/`city`/`state`/`postal_code` and
unit creation live now; **`name` is deliberately not editable anywhere** —
`updateProperty` never touches that column. Field order was a specific ask:
Street address → Units (list + "Add unit") → City/State → ZIP → Save. Since
a `<form>` can't contain another `<form>` and the Units block needed to sit
*between* two halves of the same save-form, the city/state/zip inputs and
the Save button live outside the `<form>` tag and are re-associated to it
via the HTML `form="edit-property-form"` attribute rather than DOM nesting
— confirmed this still submits every field together as one `FormData`.
`updateProperty` redirects to `/manage-properties` on success (unlike
`createUnit`, which doesn't redirect, to let the landlord keep adding units).

**Dashboard vacant-property "Add tenant" CTA**
(`components/properties/PropertyTile.tsx` /
`components/properties/DashboardPropertyList.tsx`): the expanded slide-down
for a vacant property now shows "No tenant yet." + an "Add tenant" button
using the same smart-routing `addTenantHref` logic Manage Properties already
had (straight to the unit if there's exactly one, else the property page).

**Settings page** (`app/settings/page.tsx`): Name/Email values changed from
`font-bold` to `text-base font-medium` with `text-xs` grey labels — pop via
size/color contrast instead of boldness. Added a third "Phone" row
(`profile.phone || "—"`). `components/settings/PushToggle.tsx` restyled to a
solid black pill (was outlined) — its enable/disable toggle behavior already
existed (`enabled ? "Disable..." : "Enable..."`), just wasn't obviously a
button before.

**Landlord phone number.** `app/(auth)/signup/page.tsx` now also collects a
required phone number the same way `InviteSignupForm` already does for
tenants (feeds the same `handle_new_user()` trigger, no new migration
needed for that half). **Deliberately not exposed to tenants** — the whole
point of this app is keeping tenant↔landlord contact inside the platform
instead of a personal phone number. `get_landlord_contact` was dropped and
recreated (return-type change, can't `create or replace`) in
`20260812163000_remove_landlord_phone_from_contact_rpc.sql` to return only
`full_name, email` — confirmed via a raw client-side `supabase.rpc()` call
from an authenticated tenant session that phone truly isn't reachable, not
just hidden in the UI. The landlord's own phone still shows on their own
Settings page (reads `profiles.phone` directly, unrelated code path).
`components/layout/TenantNavBar.tsx`'s local `LandlordContact` type had its
now-stale `phone` field removed to match.

**Tenant reopen button** (`components/requests/StatusControls.tsx`,
`TenantReopenControl`): "This isn't fixed — reopen" → "This isn't fixed -
Reopen", styled red (`border-red-400 text-red-700`) instead of the neutral
black outline, since it's a destructive-ish/attention action.

**New request form redesign** (`components/requests/NewRequestForm.tsx`,
`app/(tenant)/my-requests/new/page.tsx`): the Unit and Category `<select>`
dropdowns are gone entirely — a tenant only ever has one unit in practice, so
`unitId` is just `units[0]?.id` with no picker, and the category (passed via
`?category=` from the home page's grid) is baked into the page heading as
`New request - {categoryLabel}` instead of being a changeable field. The
photo/video input is a square dashed-border dropzone with a centered plus
icon (a styled `<label htmlFor="files">` wrapping a `sr-only` file input, so
the browser's native picker still opens on click) instead of the bare native
file input. Field order: Title → Photo/video → Message. Spacing above the
form is `mt-4` (was `mt-8`) and the submit button no longer has its own
extra `mt-2`, so Title/Photo/Message/Submit are all equally gapped via the
form's `gap-4` alone.

**`StatusTimeline` deleted.** It was already removed from the landlord's
request page in the earlier redesign pass; this session removed the last
usage (tenant's request page) and deleted the component + the
`request_status_history` query in `lib/requests.ts`'s `loadRequestDetail`
(was fetched but nothing rendered it anymore).

**Tenant home page category grid shadow** (`app/(tenant)/home/page.tsx`):
changed from a directional offset shadow (`shadow-[5px_5px_...]`, visible
only bottom-right) to a centered one
(`shadow-[0_2px_8px_rgba(0,0,0,0.08)]`), matching the shadow style already
used on `PropertyTile`.

**`BackButton` added to tenant pages** reached by clicking into something —
`my-requests/new`, `my-requests/[requestId]` — same component/rule as the
landlord side (not on the four tenant main-menu pages: Home, Requests,
Contact Landlord, Settings).

**Ticket-vs-chat unification (tenant and landlord).** Both
`components/chat/MessageThread.tsx` (tenant) and
`components/chat/RequestConversation.tsx` (landlord) were changed so the
*opening* message (whoever created the request) never appears as a chat
bubble and the chatbox doesn't exist at all until the other party actually
replies:
- Tenant page (`app/(tenant)/my-requests/[requestId]/page.tsx`): the
  opening message's text now renders via `RequestDetail`'s new optional
  `description` prop (plain `text-black dark:text-white`, not grey — a
  follow-up fix after it first shipped grey and read as low-contrast) right
  below the photo/video attachments, permanently, instead of as the first
  chat bubble. `MessageThread` now receives the *full* `initialMessages`
  array (not pre-sliced) and internally computes `hasReply` = some message
  has a different `sender_id` than the first one; if false it renders
  `null` (no heading, no box, no input at all); if true it renders only
  `messages.slice(1)`, so the landlord's reply is bubble #1. The realtime
  subscription stays mounted regardless of `hasReply` specifically so the
  chatbox can appear live the moment a reply lands, not just after a
  reload.
- Landlord page (`RequestConversation.tsx`): already had a ticket/chat
  split from the original redesign pass, but the tenant's opening message
  used to become chat bubble #1 once the landlord replied. Restructured so
  the ticket header (tenant's message + attachments) renders
  unconditionally above, and the "Reply" button / "Messages" chatbox below
  it are what toggle on `hasReply` — the chatbox (when present) uses
  `messages.slice(1)` the same way, so the landlord's own first reply is
  what they see as bubble #1 too. Timestamp dividers
  (`shouldShowDivider`/`formatMessageDivider`) now key off adjacency within
  that sliced reply list, not the full list.

**Landlord ticket header now matches the tenant's big-attachment style.**
`app/(landlord)/requests/[requestId]/page.tsx` passes
`attachments={result.attachments}` and `description={result.request.description}`
into `<RequestDetail>` (previously `attachments={[]}` and no description, so
the landlord never saw the photo/video at all above the chat).
`RequestConversation.tsx`'s own ticket-header block (a bordered div with
`firstMessage?.body` + a small 3-column `AttachmentGrid`) was deleted, since
`RequestDetail` renders that content now. `firstMessage`/`hasReply` are still
computed there (needed for the Reply-button/chatbox gating), and the
`AttachmentGrid` function + lightbox are still used, just for attachments on
*reply* messages inside chat bubbles, which stay small/compact. Verified live
as the landlord: a fresh no-reply request (submitted with a photo as the
tenant) shows the big attachment + description text with just a "Reply"
button below, and after replying it shows that same header plus a "Messages"
chatbox whose first bubble is the landlord's own reply — matching the tenant
side exactly.

### Dashboard property ordering pass (later session)

**Landlord dashboard property list is now ordered by most recent request
activity, not property creation date.** Previously
`components/properties/DashboardPropertyList.tsx` just rendered `properties`
in the server-passed order (property `created_at desc`); a brand-new
maintenance request had no effect on where its property sat in the list.
Now the component builds a `withRequests` array (each property + its own
requests sorted newest-first) and derives `orderedProperties` via a stable
sort keyed on each property's newest request's `created_at` — properties
with no requests at all fall through to the end, keeping their original
(property-creation-date) relative order since the sort is stable. The
realtime subscription (previously only listening for `UPDATE` on
`maintenance_requests`, which only kept status badges live) now also listens
for `INSERT` and prepends the new row into `requests` state, so a brand-new
request from any tenant moves that property to the top of the landlord's
dashboard live, without a reload — verified via a direct DB insert (service
role, bypassing the UI) while the dashboard tab stayed mounted, confirming a
lower-ranked property jumped straight to #1.

**Vacant properties always sort last, and a 24h "Complete" badge on the
tile.** Both in `components/properties/DashboardPropertyList.tsx`:
- The `orderedProperties` sort now checks `isVacant` first — vacant
  properties (no active tenant on any unit) always sort after every
  occupied one, regardless of any stale request history they might have
  (e.g. a tenant who moved out after a request was filed); ties among
  vacant properties keep the original creation-date order, same as before.
- A new `doneAt: Record<requestId, isoTimestamp>` piece of state, sourced
  from `request_status_history` (filtered to `to_status = 'done'` within
  the last 24h) — **not** `maintenance_requests.updated_at`, which also
  gets bumped by unrelated chat messages via `bump_request_activity()` and
  would make the 24h window drift. `app/(landlord)/dashboard/page.tsx`
  fetches this the same way it fetches `properties`/`requests`, and the
  component's on-mount refetch and `useEffect` prop-sync both cover it too,
  matching the existing freshness pattern. When a property has no
  open/in-progress request but does have a `done` request whose `doneAt`
  is under 24h old, `badgeStatus` becomes `"done"` and
  `components/properties/PropertyTile.tsx` renders a green "Complete" pill
  (not the shared `StatusBadge` component, to avoid changing that
  component's "Done" wording used elsewhere) instead of the category
  icon/badge row; past 24h (or once reopened) it silently reverts to a
  plain tile with a green left bar and nothing on the right, same as before
  this existed.
- The existing `maintenance_requests` `UPDATE` realtime handler also now
  sets/clears `doneAt` live when a status change arrives. **Verified data
  correctness is solid on load/reload** (confirmed both the sort and the
  "Complete" pill), but live delivery of that specific `UPDATE` event to an
  already-open dashboard tab was unreliable during testing — a raw
  service-role UPDATE hits the same `record_status_change` trigger's
  `changed_by` not-null constraint (it requires `auth.uid()`, i.e. a real
  authenticated session, so it can't be used to isolate the issue further),
  and clicking "Mark done" through the real UI/RPC as the landlord did not
  always push the change to a separate already-open dashboard tab without a
  reload. This matches the same "transient realtime-timing UI glitch"
  already noted below under Problem Solving from an earlier session (chat
  replies briefly reverting) — treated as a pre-existing characteristic of
  this app's realtime reliability, not a regression from this change, and
  not something to chase further without an explicit ask.

**"Mark done" renamed to "Mark complete"** in
`components/requests/StatusControls.tsx` (`LANDLORD_TRANSITIONS`, all three
occurrences), for wording consistency with the dashboard tile's "Complete"
badge — the underlying status value is still `"done"` (RPC, DB check
constraint, `StatusBadge` label elsewhere all untouched), only this
button's label text changed.

**Dashboard sort is five tiers, mirroring the tile's own color bar —
most urgent first:**
1. Red (`open`/`reopened`)
2. Yellow (`in_progress`)
3. Green "Complete" (`done`, within the 24h window)
4. Plain green, nothing to show (no requests ever, or an old resolved one)
5. Vacant — always last, since no one lives there and no requests will be
   filed for the time being.

Within a tier, whichever property has the most recently created request
rises to the top (unchanged from before). `DashboardPropertyList.tsx`'s
`withRequests` step computes each property's `badgeStatus` up front
(previously computed later, inside the render `.map()`) specifically so a
small `tierRank()` helper can map `isVacant`/`badgeStatus` straight to
0–4 for the sort comparator.

**Expired-done properties no longer show a stale preview in the
dropdown.** In `DashboardPropertyList.tsx`, `newest` used to fall back to
`propertyRequests[0]` (the property's single most recent request,
regardless of status) whenever nothing was open/in-progress/recently-done —
so a property whose only request was `done` but past the 24h "Complete"
window still showed that old request's title/description/Details link in
the tile's expanded dropdown, even though the header no longer shows any
status badge for it. `newest` is now just `relevantRequest` (no fallback),
so once a done request ages out of the 24h window the dropdown shows "No
requests yet." like a property that never had one — consistent with there
being no live status left to point at. Only affects the badge-less tier;
the "Complete" tier (done, still within 24h) is unchanged and still shows
its description.

**Tenant reopen removed.** The "This isn't fixed - Reopen" button
(`TenantReopenControl`) has been deleted from
`components/requests/StatusControls.tsx`, and its usage removed from
`app/(tenant)/my-requests/[requestId]/page.tsx`. Rationale: reusing an old
`done` request for a recurrence was more confusing for the landlord than
helpful — a tenant who needs the same thing fixed again now just picks the
category on their home page and files a fresh request, same as any other
issue. Scoped to the tenant side only: the DB still supports a `reopened`
status (`update_request_status` RPC, `StatusBadge`'s `"Reopened"` label,
the landlord's `LANDLORD_TRANSITIONS.reopened` branch) for any legacy rows
or future direct use, but there is no longer any UI path that can create
one — tenants have zero status-changing actions on a `done` request now.

**"Complete" tiles now show their category icon too**, matching
open/in-progress tiles — a reminder of what was just fixed, not just that
something was. `DashboardPropertyList.tsx`'s `categoryValue` prop used to
only populate for `badgeStatus === "open" || "in_progress"`; simplified to
`badgeStatus ? relevantRequest?.category ?? null : null`, so it also shows
during the "Complete" tier. Once the 24h window lapses, `badgeStatus`
becomes `null` and both the category and the (already-fixed, see above)
description disappear together, leaving a plain green tile.

**Tenant request lists sorted red → yellow → green.** New
`lib/statusRank.ts` (`statusUrgencyRank`) maps `open`/`reopened` → 0,
`in_progress` → 1, `done` → 2, anything else → 3. Both
`app/(tenant)/home/page.tsx` ("Your recent requests", the 5 most recent)
and `app/(tenant)/my-requests/page.tsx` ("Your requests", the full list)
now sort their fetched requests through this before rendering — a stable
sort, so requests within the same tier keep their existing recency order
(`created_at`/`last_activity_at` desc, from the DB query) unchanged. Mirrors
the color-bar priority already used for the landlord's dashboard tiers.

**"Done" → "Complete" everywhere.** `components/requests/StatusBadge.tsx`'s
`LABELS.done` changed from `"Done"` to `"Complete"` — this is the one
shared component every `done`-status display goes through (tenant/landlord
request detail pages, tenant home page's recent requests, the full
tenant "Your requests" list), so the one-line change covers all of them.
Now consistent with the landlord dashboard's own "Complete" pill on
`PropertyTile.tsx`, which already used that wording (a separate, custom
element, not `StatusBadge` — see the 24h-Complete-badge entry above).

**Tenant can now mark their own request complete.** In case the landlord
fixed something in person and forgot to update the status, the tenant no
longer has to wait — `components/requests/StatusControls.tsx` gained
`TenantStatusControls`, rendered on
`app/(tenant)/my-requests/[requestId]/page.tsx` below `MessageThread`
(mirrors where `LandlordStatusControls` sits on the landlord's page — below
the chat). Two buttons, `open`/`in_progress`/`reopened` only (hidden once
already `done`): "Mark complete" and "No longer needed" — both are
functionally identical, just call `update_request_status` → `done`; there's
no UI anywhere that surfaces *why*, so no separate status/note was added,
just two buttons for the tenant's own clarity about which applies.
Required a new migration,
`supabase/migrations/20260814120000_tenant_can_mark_request_done.sql`
(`create or replace` on the existing function, not a new one):
- `update_request_status`'s tenant branch previously only allowed
  `done → reopened`; now also allows
  `(open | in_progress | reopened) → done`.
- `enqueue_status_changed_notification` previously only cc'd the landlord
  on a tenant's *reopen* (`new.status = 'reopened' and auth.uid() = tenant`)
  — otherwise a tenant-initiated change only notified the tenant themself
  (a no-op). Extended the same special-case to `new.status = 'done'` too,
  so the landlord actually finds out. Verified via direct
  `notification_events` query after a live test: a tenant-initiated
  "No longer needed" click inserted two rows, one to the tenant (self,
  as with every status change) and a new second one to the landlord.

**Unit label removed from the tenant's "Your requests" list**
(`app/(tenant)/my-requests/page.tsx`) — a tenant only ever has one unit in
practice (same reasoning as the new-request form's dropped unit picker), so
each row's second line is now just `{category} · {time}` (+ "Landlord
responded" when relevant), no more `Unit 1 ·` prefix. The `units(label,
properties(name))` join was dropped from the query entirely, not just
hidden in the UI.

**Landlord's "Move back to open" removed too.** Same reasoning as the
tenant reopen removal above: the landlord's status controls now only ever
offer "Mark in progress" (from `open`) and "Mark complete" (from `open` or
`in_progress`) — `LANDLORD_TRANSITIONS.in_progress` in
`components/requests/StatusControls.tsx` dropped its
`{ to: "open", label: "Move back to open" }` entry, now just
`[{ to: "done", label: "Mark complete" }]`. `LANDLORD_TRANSITIONS.reopened`
was left as-is (`Mark in progress` / `Mark complete`) since it already only
contained those same two actions — nothing to remove there. The DB RPC
(`update_request_status`) itself still technically permits
`in_progress → open` for the landlord; only the UI button was removed, same
precedent as leaving `reopened` supported at the DB level after deleting
the tenant's reopen button.

**Confirmed: tenant-marked-complete already updates the landlord's
dashboard live, no code change needed.** The earlier "live delivery of
`UPDATE` events is unreliable" note (under the 24h-Complete-badge entry
above) turned out to be a testing-environment artifact, not a real product
bug: this browser tool's tabs all share one cookie jar/localStorage, so
signing in as a different role on one tab silently disrupts the *other*
tab's already-open realtime connection too — there's no way to hold two
simultaneous distinct sessions across tabs in this tool. Verified properly
this time by keeping the landlord's dashboard tab logged in and mounted the
entire time, and driving the tenant side from a standalone Node script
(`supabase-js` + `signInWithPassword`, no browser involved at all) to call
`update_request_status`. Result: the property tile flipped live from amber
"In progress" straight to green "Complete" (with its category icon) with
zero reload — the existing `postgres_changes` `UPDATE` subscription in
`DashboardPropertyList.tsx` already handles this correctly regardless of
which role triggered the change, since Postgres replication doesn't care
who ran the statement.

**Tenant request tiles now have the same red/yellow/green left color bar
as the landlord's `PropertyTile`.** New `statusBarColorClass(status)` in
`lib/statusRank.ts` (red for `open`/`reopened`, amber for `in_progress`,
green for `done`). Applied to both
`app/(tenant)/home/page.tsx` ("Your recent requests") and
`app/(tenant)/my-requests/page.tsx` ("Your requests") — each `<li>` now
wraps its `<Link>` the same two-element way `PropertyTile` does (outer
`overflow-hidden rounded-xl border`, inner `Link` gets `border-l-4` +
the color class) rather than combining `border` and `border-l-4` on one
element, since combining them risks a Tailwind class-order/specificity
conflict on which one wins for the left edge — the existing `PropertyTile`
pattern already sidesteps this by splitting across two elements, so this
reuses that same proven structure instead of risking it on one.

### Client-side attachment compression (later session)

**Photos and videos are compressed entirely in the browser before upload**,
to keep Supabase Storage costs down — no server-side processing, no new
dependencies. Wired into `components/requests/NewRequestForm.tsx`'s
`handleFileChange` (now async): after the existing type/size validation,
each selected file is compressed immediately (at selection time, not
submit time, so redoing a failed submit doesn't recompress), with a
"Compressing..." label shown and the submit button disabled meanwhile. The
upload loop in `handleSubmit` didn't need to change at all — it already
just reads `file.type`/`file.size` off whatever's in `files` state, which
now holds the already-compressed `File` objects.

- **Photos** — `lib/media/compressImage.ts`. Canvas API only (no library):
  decode via `createImageBitmap(file, { imageOrientation: "from-image" })`
  (handles EXIF rotation for free), downscale so the longer edge is ≤1280px,
  then `canvas.toBlob` to WebP (falls back to JPEG if the browser can't
  encode WebP — checked once via a cached `canvas.toDataURL` probe),
  stepping down through quality levels `[0.82, 0.7, 0.6, 0.5, 0.4, 0.3]`
  until under a 150KB target or the steps run out. Verified live: a 15.1MB
  synthetic 3000×2250 test photo came out at 93KB WebP.
- **Videos** — `lib/media/compressVideo.ts`. Deliberately native-only
  (MediaRecorder + canvas capture), **not** ffmpeg.wasm — that was an
  explicit choice (asked the user directly): ffmpeg.wasm gives more
  precise/consistent output but means a ~25-30MB one-time WASM download on
  a tenant's mobile data, which fights the whole point of this feature.
  Downscales to ≤640px wide by redrawing the source `<video>` onto a
  canvas every frame, feeds `canvas.captureStream(30)` (+ the original
  audio track, if any, from `video.captureStream()`) into `MediaRecorder`
  with `videoBitsPerSecond` set to hit ~5MB over 15s, and stops recording
  at 15s or when the source ends, whichever's first — this is the actual
  trim-to-15-seconds mechanism. Picks the first supported output
  `mimeType` from a candidate list (`video/mp4;codecs=avc1` down to plain
  `video/webm`) via `MediaRecorder.isTypeSupported`. **Because capture is
  tied to real-time playback, compressing a video takes roughly as long as
  the trimmed clip's own duration** (a 15s clip takes ~15s to process) —
  an accepted trade-off for staying dependency-free, per the same
  decision. Verified live: an 8s/1280×720/1.8MB synthetic test video came
  out at 350KB `video/mp4` (this dev Chromium happened to support MP4
  output directly via `MediaRecorder.isTypeSupported`).
- **Graceful degradation everywhere**: every failure path in both modules
  (unsupported browser, decode error, `MediaRecorder` constructor
  throwing, etc.) resolves to the *original, uncompressed* file rather
  than throwing — a tenant's upload should never be blocked by a
  compression failure, just occasionally larger than ideal.
- No Supabase Storage bucket/migration changes were needed — the
  `request-attachments` bucket's `allowed_mime_types` (in
  `20260810152031_requests_schema.sql`) already included `image/webp`,
  `video/webm`, and `video/mp4` from Phase 3, so the compressed output
  formats were already permitted.

**HEIC photos now convert to a universally-viewable format, not just
compress.** `lib/media/compressImage.ts` detects HEIC/HEIF (by MIME type or
`.heic`/`.heif` extension, since some browsers report it generically) and
decodes it to JPEG first via `heic-to` (dynamically imported, so it only
loads when a HEIC file is actually selected) before the existing
downscale-to-WebP pipeline runs — so the stored/displayed file is always a
normal JPEG/WebP regardless of what the tenant's phone captured. This
matters because Canvas can't decode HEIC at all outside Apple's own WebKit,
so an unconverted HEIC photo would previously upload uncompressed *and*
show as a broken image to any landlord not on Safari/iOS.

Tried `heic2any` (the more commonly recommended package) first — it failed
on a real iPhone photo with `ERR_LIBHEIF format not supported`, because its
bundled libheif build is old/incomplete for the HEVC encoding modern
iPhones actually use. Swapped to `heic-to`, which tracks current libheif
releases and decoded the same file correctly. Verified live end-to-end with
a real iPhone `.HEIC` file (not a synthetic test image): 1.9MB HEIC → 57KB
WebP, confirmed via direct DB query and confirmed the photo actually
renders (no broken-image icon) in this dev environment's Chromium browser —
a fair stand-in for "landlord on a non-Apple device," which is exactly what
showed the broken icon before this fix.

**Click a photo/video to expand it full-screen — added to `RequestDetail`,
the shared ticket-header component.** This is the "big attachment" display
both the tenant's and landlord's request detail pages use (see the earlier
"Landlord ticket header now matches the tenant's big-attachment style"
entry) — one fix covers both, since it's the same component. Converted
`components/requests/RequestDetail.tsx` to a client component (it was a
plain server-rendered component before) and gave it the same lightbox
pattern `RequestConversation.tsx` already used for reply-message
attachments: click an image thumbnail (or a video thumbnail, which now
shows a static muted frame + a play-icon overlay instead of raw inline
`controls`) to open a full-screen dark overlay with the media at full size;
video autoplays with controls once expanded. Click the backdrop or the ✕
button to close. Verified live on both the tenant's and landlord's request
detail pages.

### Landlord subscription billing (Stripe, later session)

**Two tiers, priced by total unit count across all a landlord's
properties**: 1-3 units = $9.99/mo; 4-10 units = $24.99/mo or $239.88/yr
(no annual option for the 1-3 tier). Every new landlord gets a **1-month
free trial, no card required upfront** — signup never touches the Stripe
API at all. `trial_ends_at` is a plain Postgres timestamp set by
`handle_new_user()` (`supabase/migrations/20260814130000_add_landlord_subscriptions.sql`),
independent of Stripe; a real Stripe Customer/Subscription is only created
the first time a landlord actually completes Checkout (proactively during
the trial, or after being locked out). Existing landlords were backfilled
with a fresh 1-month trial starting at deploy, not grandfathered in, so the
access-status logic never needs a special case.

**New `public.subscriptions` table**, one row per landlord (unique
`landlord_id`). Stores Stripe's raw subscription `status` string verbatim
(`trialing`/`active`/`past_due`/`canceled`/`incomplete`/`incomplete_expired`/`unpaid`)
rather than a translated app-level status, so it can't drift out of sync
with what Stripe actually thinks. "Is this landlord locked out" is never
stored — `lib/billing/subscription.ts`'s `computeAccessStatus()` derives it
fresh every time from `(trial_ends_at, status)`.

**Read-only lockout** when the trial ends or a payment fails with no active
subscription: the landlord can still view all their existing data, but
can't create or edit anything. Enforced two ways, because not every
landlord mutation goes through a Next.js server action:
- `lib/billing/guard.ts`'s `requireActiveSubscription()` is called first
  (same position as the existing `if (!user) redirect("/login")`) in all 7
  functions in `app/(landlord)/properties/actions.ts` — `redirect()`s to
  `/billing?locked=1` rather than throwing, matching that file's existing
  convention.
- `update_request_status` (the one mutation called directly from a client
  component — `components/requests/StatusControls.tsx` — straight to the
  Postgres RPC via the browser Supabase client, no server-action boundary
  to guard) has the same check written directly into the SQL function's
  landlord branch, `raise exception 'subscription_required'`.
  `LandlordStatusControls` catches that specific error string and routes
  to `/billing` instead of showing it as a generic error. Tenants are
  never gated — the check only touches the `v_is_landlord` branch.
- **Known, deliberately-unfixed v1 gap**: `properties`/`units` RLS is
  `for all using (landlord_id = auth.uid())`, so a technically-savvy
  locked-out landlord could still bypass the server action entirely via
  `supabase.from(...).insert()` from devtools. Closing this fully means
  folding the same check into those RLS policies too — left as a follow-up
  since the blast radius is "a locked-out landlord edits their own
  already-visible data slightly early," not a cross-tenant issue.

**Automatic proration** when a landlord's unit count crosses the 3↔4
boundary, for **monthly** subscriptions only —
`lib/billing/syncPlan.ts`'s `syncPlanForUnitCount()`, called (best-effort,
try/caught, never fails the underlying mutation) from the end of
`createProperty`, `createUnit`, and `deleteProperty`. Judgment calls, not
explicitly specified by the user:
- **Annual (4-10 tier) subscriptions are never force-downgraded mid-term**
  if units drop to ≤3 — standard practice for a prepaid annual term. The
  correct tier is re-evaluated at renewal instead, via the
  `invoice.payment_succeeded` webhook handler checking
  `billing_reason === "subscription_cycle"` (a real renewal, not the
  first purchase) and calling `syncPlanForUnitCount` again with
  `{ allowAnnual: true, prorationBehavior: "none" }` — prospective only,
  doesn't touch the invoice that was just paid at the old price.
- **11+ units**: no tier fits, so no automatic price change is attempted —
  the landlord just keeps paying whatever they're already on. The
  `/billing` page shows "Have more than 10 units? Contact us for custom
  enterprise pricing." (mailto link) below the two tier cards instead of a
  hard block; applying a custom price for an 11+ unit landlord is a manual
  step in the Stripe Dashboard, not something the app does automatically.

**Webhook route** `app/api/stripe/webhook/route.ts` — Stripe's signature
*is* the auth here (no Supabase session involved at all), which is why
it's correctly under `/api/*` (already excluded from `proxy.ts`'s
login-redirect check per the existing documented convention). Reads the
raw body with `req.text()` exactly once and passes it straight into
`stripe.webhooks.constructEvent()` — Next 16's App Router route handlers
have no global body-parser to fight (unlike the old Pages API), but
calling `req.json()` first and reconstructing the string would still break
signature verification, since `JSON.stringify` won't reproduce Stripe's
exact byte formatting. Subscribed events: `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_failed`, `invoice.payment_succeeded` — logic lives in
`lib/billing/webhookHandlers.ts` (route itself is a thin wrapper, mirroring
`app/api/notifications/process/route.ts`'s existing shape).
`checkout.session.completed` is how a landlord ID ever reaches the webhook
at all: `session.client_reference_id` is set to `user.id` when creating
the Checkout Session (`app/(landlord)/billing/actions.ts`), since the
webhook has no Supabase auth context whatsoever.

**Stripe SDK v22 gotcha hit while building this**: `current_period_end` is
**not** a top-level field on `Stripe.Subscription` in current API
versions — it moved to each `Stripe.SubscriptionItem`
(`sub.items.data[0].current_period_end`) as part of Stripe's
multi-item-subscription billing changes. Similarly `Stripe.Invoice` no
longer has a flat `subscription` field — it's
`invoice.parent?.subscription_details?.subscription`. Confirmed both by
reading the installed SDK's actual `.d.ts` files rather than assuming
older Stripe docs/examples still apply; typecheck one file at a time when
touching Stripe objects rather than trusting anything from memory.

**One-time setup script** `scripts/stripe-setup.mjs` (plain `.mjs`, not
`.ts` — no `tsx`/`ts-node` dependency exists in this repo and one wasn't
worth adding for a single-use script) creates the 3 Stripe Products/Prices
via the API and prints the resulting price IDs to paste into `.env.local`.
Run once per Stripe account (once for test mode, again when going live):
```
set -a && source .env.local && set +a && node scripts/stripe-setup.mjs
```

**Verified live against a real Stripe test-mode account** (the user
provided a real `sk_test_...` key mid-session). `scripts/stripe-setup.mjs`
ran for real and created the 3 actual Products/Prices; those price IDs are
in `.env.local`. Clicking "Subscribe monthly"/"Subscribe yearly" on
`/billing` redirects to genuine Stripe-hosted Checkout pages showing the
correct price for each tier. Confirmed the `subscription_data.trial_end`
carryover works exactly as designed: Checkout displayed "30 days free,
then $24.99 per month starting September 14, 2026" — matching this
landlord's actual `trial_ends_at` — so subscribing early doesn't cost any
remaining trial time. One click-testing gotcha hit along the way: a raw
coordinate click landed on the wrong pricing button after a scroll
position shifted between screenshot and click; switched to ref-based
clicks (`read_page` → click by `ref`) for reliability instead of
recalculating pixel coordinates by hand.

**Local webhook forwarding set up via the Stripe CLI, no Homebrew needed.**
This dev environment has no Homebrew, so the CLI binary was downloaded
directly from `stripe/stripe-cli`'s GitHub releases (`mac-os_arm64` tarball)
to `~/bin/stripe` rather than installed via `brew install stripe/stripe-cli/stripe`.
Authenticated non-interactively with `stripe login --api-key "$STRIPE_SECRET_KEY"`
(the CLI still prints an OAuth pairing URL/code even with `--api-key`
passed to `login` itself — that flag only matters on other commands).
The actual unlock was `stripe listen --print-secret --api-key "$STRIPE_SECRET_KEY"`,
which returns a stable webhook signing secret with zero browser
interaction; saved as `STRIPE_WEBHOOK_SECRET`. Then
`stripe listen --forward-to localhost:3000/api/stripe/webhook --api-key "$STRIPE_SECRET_KEY"`
run in the background forwards real events from the account to the local
route — this is the local-dev equivalent of a Dashboard-configured webhook
endpoint and needs to be running for local webhook delivery to work at
all; re-run it (same command) any time it's not already running.

**Verified live, full loop**: a real test-mode purchase, using Stripe's
`4242 4242 4242 4242` test card through actual Checkout. Every forwarded
webhook event returned `200`, including the two the app actually acts on
(`checkout.session.completed`, `invoice.payment_succeeded`) — confirmed via
both the `stripe listen` log and a direct query of the `subscriptions`
row, which came back with a real `stripe_customer_id`, `stripe_subscription_id`,
correctly reverse-mapped `tier`/`billing_interval` from the price ID, and
`status: "trialing"`.

**Real bug this test caught**: `lib/billing/subscription.ts`'s
`computeAccessStatus()` only computed `daysLeftInTrial` for the
no-Stripe-subscription-yet case (using our local `trial_ends_at`) — once a
real Stripe subscription exists with `status: "trialing"`, that branch
returned `daysLeftInTrial: null`, and `/billing` silently rendered "days
left in your free trial." with no number. Fixed by branching on
`status === "trialing"` specifically and computing the countdown from
`current_period_end` instead (which, for a trialing subscription, *is* the
trial end) — `trial_ends_at` stops being the source of truth the moment a
real subscription exists. A concrete example of why "complete a real
purchase" was worth doing rather than stopping at synthetic webhook
events: this gap only surfaces with a real Stripe subscription object in
hand, not from hand-constructed test payloads.

**Billing page states the next charge explicitly, not just a countdown.**
Previously "X days left in your free trial" gave no indication of *what*
would be charged or *when* — a landlord who'd already subscribed during
their trial (real Stripe subscription, `status: "trialing"`) had no way to
see that from `/billing`. Now shows "Then $24.99/mo, starting 9/14/2026"
appended to the trial countdown whenever a real subscription exists, and
the post-trial "You're on the ... plan" line now also states the exact
price, not just the tier name — both via a new `planPriceLabel(tier,
interval)` in `lib/stripe/plans.ts`, which safely handles `tier`/
`billing_interval` coming back from Supabase as plain nullable `text`
(not the narrowed `Tier`/`BillingInterval` union types) rather than
needing an unsafe cast at the call site.

### Billing UX polish (plan descriptions, yearly savings %, upgrade nudge)

**Plan descriptions**, `lib/stripe/plans.ts`'s `PLAN_DESCRIPTIONS`, shown
as an italicized quote on each pricing card on `/billing`: 1-3 units → "I
just want tenants to stop texting my personal cell phone."; 4-10 units →
"I run a small business and need a professional dashboard." — meant to let
a landlord self-select by matching their own voice, not just unit count.

**Yearly savings percentage** is computed, not hand-typed —
`TIER_4_10_YEARLY_SAVINGS_PERCENT` in `lib/stripe/plans.ts` derives from
the same raw cent amounts as the displayed prices
(`(monthly×12 − yearly) / (monthly×12)`, rounded), currently 20%. Storing
it as a computed constant instead of writing "save 20%" directly into the
JSX means it can't silently go stale if either price ever changes.

**Congratulatory upgrade nudge with confetti** when a landlord's unit
count crosses from 3 to 4 (whichever action does it — `createProperty`
with an inline unit, or `createUnit` on an existing property, both in
`app/(landlord)/properties/actions.ts`): a short-lived cookie
(`celebrate_unit_upgrade`, 15s `maxAge`) is set the moment the crossing is
detected, then read by `app/(landlord)/layout.tsx` on the very next render
and passed into `components/billing/UpgradeCelebrationModal.tsx`, which
fires `canvas-confetti` and shows "🎉 Looks like your business is growing!
Upgrade to our Professional Tier for up to 10 units." with a link to
`/billing`. The short cookie lifetime is what makes this a one-time flash
rather than something that reappears on every refresh — Server Components
can only *read* cookies, not clear them mid-render, so letting it expire
on its own (rather than trying to explicitly delete it) is the mechanism.
Chose `canvas-confetti` (a few KB, purpose-built for exactly this) over
hand-rolling a canvas animation — small and single-purpose enough that it
doesn't conflict with this project's general preference for avoiding heavy
dependencies (the same reasoning that ruled out ffmpeg.wasm elsewhere in
this file is about avoiding *tens of megabytes* for something native APIs
could mostly do, not about avoiding small libraries that do one thing
well). Verified live by setting the cookie directly via `document.cookie`
and reloading a landlord page — confetti fired, the modal rendered with
the exact copy above, and "Dismiss" closed it correctly. The unit-count
crossing arithmetic itself (`beforeCount <= 3 && afterCount >= 4`) is
simple enough to trust from code review plus the existing `determineTier`
boundary-case testing already covering the same logic.

### Unit-limit enforcement + ask-first upgrades (later session)

**A landlord's actual unit count is now kept in lockstep with the tier
they're subscribed to, by asking rather than silently switching.**
Previously `syncPlanForUnitCount` auto-upgraded/downgraded a landlord's
Stripe subscription the moment their unit count crossed the 3↔4 boundary,
with no confirmation — a landlord could go from 3 to 4 units and only find
out their bill changed by later checking `/billing`. Growing past the
current tier's ceiling now blocks the mutation and asks first, with a live
Stripe-computed prorated cost; only shrinking (deleting a property) still
auto-adjusts silently, since that only ever lowers the bill and crediting
back automatically is the friendlier default.

**New `lib/billing/unitLimit.ts`**, `checkUnitLimit(supabase, landlordId,
addingCount)`, called from `createProperty` and `createUnit`
(`app/(landlord)/properties/actions.ts`) before any insert happens. A
trial-only landlord (no real Stripe subscription yet) isn't gated at all —
they haven't chosen a plan to hold them to. Once subscribed, it returns one
of three outcomes:
- **`ok`** — fits the current tier, insert proceeds normally.
- **`needs_upgrade`** — would cross the ceiling but a next tier exists
  (1-3 → 4-10). Nothing is inserted yet; returns `{ targetTier, interval,
  amountDueCents }`, where `amountDueCents` comes from a real
  `stripe.invoices.createPreview()` call simulating the subscription-item
  swap with `proration_behavior: "create_prorations"` — not a hand-rolled
  proration calculation, so it's exactly what Stripe would actually charge
  (correctly $0 for a landlord still mid-trial, since nothing is due yet).
- **`blocked`** — no next tier fits (11th+ unit on the 4-10 plan, or a
  batch add that would overshoot even the next tier) — same "contact us for
  custom enterprise pricing" framing as the existing 11+ messaging
  elsewhere, just now actually enforced instead of silently allowed.

**The two creation forms became client components so they can show a
confirmation modal instead of just redirecting**
(`components/properties/NewPropertyForm.tsx`,
`components/properties/AddUnitForm.tsx`, replacing plain
`<form action={createProperty}>` / `<form action={createUnitForProperty}>`
in `app/(landlord)/properties/new/page.tsx` and the edit-property page).
Both call the server action directly as a function (not via `useActionState`
— simpler, since `redirect()` inside a server action works identically
whether it's invoked as a form action or called directly from a client
component, so the "ok" path needed no changes at all). On a `needs_upgrade`
result they show `components/billing/UnitUpgradeModal.tsx` (styled like the
existing `ConfirmButton` dialog) and, on confirm, resubmit the same
`FormData` with `confirmed=1` appended. The server never trusts that flag's
implied tier/cost — `resolveUnitLimit()` in actions.ts always recomputes
`checkUnitLimit` fresh on the confirmed submission too; `confirmed` only
grants permission to proceed with whatever the server itself just
determined is needed.

**`applyTierChange()` extracted out of `syncPlanForUnitCount`** in
`lib/billing/syncPlan.ts` — the actual "call `stripe.subscriptions.update`
with the new price, mirror it onto the `subscriptions` row" logic is now
shared between the automatic shrink-only sync and the new
`applyConfirmedUpgrade()` in unitLimit.ts (called once the landlord
confirms). `createProperty`/`createUnit` no longer call
`syncPlanForUnitCount` at all — by the time either reaches its insert, the
unit-limit gate has already handled any tier change that was needed, so the
old blind post-insert sync would only ever be redundant there.
`deleteProperty` is unchanged and still calls `syncPlanForUnitCount`
directly.

**Checkout itself also validates unit count against the requested tier**
(`app/(landlord)/billing/actions.ts`'s `createCheckoutSession`) — a
landlord with, say, 5 units can no longer subscribe to the 1-3 plan from
`/billing`; throws the same way other validation failures in that file
already do. No lower-bound check (subscribing to 4-10 with only 1 unit is
allowed) — paying for more than currently needed isn't the failure mode
being guarded against, only paying for less than actually in use.

**The "🎉 upgrade" celebration modal is now tied to a confirmed upgrade
actually happening**, not just unit count crossing 4 — `flagCelebration()`
is called from `resolveUnitLimit()` right after a confirmed
`applyConfirmedUpgrade()` succeeds, replacing the old
`flagCelebrationIfCrossedTo4Units(beforeCount, afterCount)` threshold check
(which made sense when the upgrade happened silently and the modal was the
landlord's only signal it occurred; now the `UnitUpgradeModal` itself
already announced the upgrade with its real cost before the landlord
confirmed, so the confetti modal reads as a genuine congratulations rather
than the first notice).

**Verified live against the real Stripe test account**: built a second
tier_1_3 subscription (via direct Stripe API calls, `pm_card_visa` test
payment method) for the `+demolandlord` test account, added 3 units, then
added a 4th through the real `/properties/[id]/edit` UI — the modal showed
"Upgrading to the 4-10 units plan costs a prorated $0.00 today, then
$24.99/mo going forward" (correctly $0 mid-trial), and confirming it
flipped both the DB row (`tier: "tier_4_10"`) and the actual Stripe
subscription's price item to `price_...4iEFgKsg` ✓. Separately, on the
primary landlord test account (already at 11 units on the 4-10 plan from
earlier ad hoc testing), attempting a 12th unit correctly returned
`blocked` with "You're at the 10-unit maximum for your plan. Contact us for
custom enterprise pricing before adding more." and inserted nothing.

### Progressive Web App (installable on iOS/Android home screens, later session)

**`app/manifest.ts`** (Next's App Router metadata-file convention, served at
`/manifest.webmanifest`) declares `name`/`short_name: "Maintenance"`,
`display: "standalone"`, and three icon entries. App name was previously
still the literal create-next-app placeholder (`title: "Create Next App"`,
tab title, etc.) — this session gave it a real one for the first time
("Home Maintenance"); rename it in `app/manifest.ts` + `app/layout.tsx`'s
`metadata` if a different product name is wanted later, both are the only
two places it's hardcoded.

**All PWA icons are code-generated, not designer assets** — `lib/pwaIcon.tsx`'s
`houseIcon(size, scale)` renders a plain black-background/white-house glyph
via `next/og`'s `ImageResponse`, reused across `app/icon.tsx` (32×32
favicon), `app/apple-icon.tsx` (180×180, Next auto-wires the
`apple-touch-icon` link tag), and three dedicated Route Handlers —
`app/pwa-icons/{192,512,512-maskable}/route.tsx` — referenced explicitly by
`manifest.ts` (192 and 512 regular, plus a 512 `purpose: "maskable"` variant
using a smaller `scale` so the glyph survives Android's circle/squircle
safe-zone cropping). The old default `app/favicon.ico` (Next's generic logo)
was deleted so it can't shadow the new `icon.tsx`-generated one.

**Real gotcha hit building the glyph**: the classic CSS "zero-size div +
transparent border-left/border-right + solid border-bottom" triangle trick
does not render as a triangle under Satori (the renderer `next/og`'s
`ImageResponse` uses) — it came out as a plain rectangle with two small
corner notches, not a roof. Fixed by switching to a raw inline `<svg>`
`<polygon>`/`<rect>` inside the JSX instead, which Satori does support
directly and renders crisply at every size — confirmed by rendering
`/pwa-icons/512`, `/pwa-icons/512-maskable`, and `/apple-icon` directly in
the browser before and after the fix.

**Root layout metadata** (`app/layout.tsx`): `appleWebApp: { title, statusBarStyle:
"default" }` (emits `mobile-web-app-capable` + `apple-mobile-web-app-title`
+ `apple-mobile-web-app-status-bar-style`), plus a manual `other:
{ "apple-mobile-web-app-capable": "yes" }` — older iOS versions specifically
look for that exact legacy key, which `appleWebApp` alone doesn't emit. A
new `viewport` export sets `themeColor: "#000000"`; deliberately did **not**
touch `width`/`initial-scale` or add `user-scalable=no` — disabling
pinch-zoom is an accessibility regression, especially given this app's
stated goal (see the earlier "colors/style" discussion) of staying usable
for elderly/low-tech-fluency landlords.

**Service worker is now registered unconditionally on every page load**,
not just when a user opts into push notifications. `lib/push/register.ts`'s
`subscribeToPush()` used to be the only caller of
`navigator.serviceWorker.register("/sw.js")`; new
`components/pwa/ServiceWorkerRegister.tsx` (mounted in `app/layout.tsx`,
renders `null`) registers it in a `useEffect` on mount regardless. Reasoning:
iOS's "Add to Home Screen" doesn't need a service worker at all (just the
manifest + apple-touch-icon), but Chrome/Android's automatic install-prompt
eligibility does look for an active one as a standard installability
signal — without this, a landlord/tenant who never touched push
notifications would be missing that signal entirely. `sw.js` itself is
unchanged (still only handles `push`/`notificationclick`, no `fetch`
handler) — deliberately did not add offline caching/response interception
in the same pass, since caching API responses in a data-driven app like
this risks landlords/tenants seeing stale request statuses, which wasn't
asked for and is a meaningfully separate feature with its own risk profile.

**Middleware gotcha**: `lib/supabase/middleware.ts` redirects any
unauthenticated request to a non-public route to `/login` — which would
have broken PWA installability entirely, since the OS/browser fetches
`/manifest.webmanifest` and the icon routes directly (not via normal
navigation) regardless of login state, and a redirect hands back login HTML
instead of the actual JSON/image. Added `isPwaMetadataRoute` (matches
`/manifest.webmanifest`, `/icon`, `/apple-icon`, and `/pwa-icons/*`) to the
existing `isPublicRoute` check. Verified live, logged out: `/manifest.webmanifest`
and `/pwa-icons/192` both returned real content instead of a redirect.

**Not done / left for later**: no `beforeinstallprompt` custom install
button or banner (relies entirely on the browser/OS's native install UI —
Chrome's omnibox/menu install option, Safari's manual Share → Add to Home
Screen) — a custom in-app install prompt is a separate, optional UX layer
on top of what's here, not required for basic installability, and wasn't
asked for.

### Rate limiting (Upstash Redis, later session)

Provisioned **Upstash for Redis** via the Vercel Marketplace
(`vercel integration add upstash/upstash-kv --non-interactive` — needed a
one-time browser step to accept Upstash's marketplace terms first). Env
vars (`KV_REST_API_URL`/`KV_REST_API_TOKEN`) auto-injected into
Development/Preview/Production; `@upstash/redis`'s `Redis.fromEnv()`
already falls back to those exact names, so no manual wiring needed.
New `lib/rateLimit.ts` exports two sliding-window limiters
(`@upstash/ratelimit`):
- `notificationsProcessLimiter` (30/1min by IP) on
  `app/api/notifications/process/route.ts` — this route has no auth check
  by design (fire-and-forget client nudges after a mutation) and runs with
  the service-role key, so it was the clearest unthrottled-abuse surface.
- `inviteLimiter` (20/1hr by landlord id) on `createInvite` in
  `app/(landlord)/properties/actions.ts` — caps real Resend email sends to
  an address the landlord types in.

Maintenance request creation is a third throttled surface, but it's
enforced at the **DB level** instead
(`supabase/migrations/20260815064000_rate_limit_maintenance_request_creation.sql`,
inline `select count(*)` + `raise exception` inside the
`create_maintenance_request` RPC, 20/rolling-hour per tenant) — that path
is called directly from the browser (`supabase.rpc(...)`, no Next.js
server action in between), so Upstash (only reachable from server code)
can't intercept it. This same "client calls Postgres directly, so
enforcement has to live in Postgres" pattern recurs for chat messages
below.

Verified live in production: 31 rapid `POST /api/notifications/process`
requests returned `200` until the limit, then `429`.

### Custom domain: simpleroost.com (later session)

App is rebranded and now live at **`https://simpleroost.com`**
(`www.simpleroost.com` also live, same Vercel project, both with valid
SSL) — the original `maintenanceapp-six.vercel.app` still works too,
Vercel doesn't remove old deployment aliases.

- Domain purchased on Namecheap. DNS stayed on Namecheap (Custom DNS /
  "Mail Settings → Custom MX", not delegated to Vercel's nameservers) —
  simpler than migrating everything, and avoids re-adding the Resend
  records (below) inside a different DNS provider.
- Added to the Vercel project via `vercel domains add simpleroost.com
  maintenanceapp` (+ `www.` as a second domain) — recommended DNS: two
  plain **A records** (`@` and `www`, both → `76.76.21.21`), not CNAME.
  SSL issues automatically a few minutes after the A record resolves.
- **Resend domain verification cleared on its own** (checked via
  `GET https://api.resend.com/domains` — `simpleroost.com`, id
  `e51fe858-363a-482d-8209-c52293fbf7e7`, now `"status":"verified"`) after
  being stuck on `pending` for DKIM/SPF for an extended period (see prior
  paragraph history in git blame for the full stuck-state investigation —
  DNS was independently confirmed correct throughout; this looks to have
  been resolved entirely on Resend's platform side, nothing changed on the
  DNS/app side to unstick it).
- `NEXT_PUBLIC_APP_URL` and `RESEND_FROM_EMAIL` production env vars have
  been moved off the Vercel `.vercel.app` URL now that verification
  cleared: `NEXT_PUBLIC_APP_URL=https://simpleroost.com`,
  `RESEND_FROM_EMAIL=notifications@simpleroost.com` (removed + re-added via
  `vercel env rm/add ... production`, then `vercel deploy --prod` to pick
  them up — same pattern as the earlier env var fixes in the Vercel-deploy
  section above). Verified live: `simpleroost.com` still resolves/aliases
  correctly and the dashboard renders with existing session data intact
  post-redeploy. **Fully verified end-to-end in a follow-up session**: sent
  a real email via a direct `POST https://api.resend.com/emails` call
  (`from: notifications@simpleroost.com`, not routed through the app's
  invite/notification code paths) to the user's own inbox
  (`jeffreychang129@gmail.com`) — Resend accepted it (returned a message
  id) and the user confirmed receipt. The `simpleroost.com` sending domain
  is confirmed fully working, not just "verified" per the API.
- The three DNS records Resend needs (already live on Namecheap): DKIM
  TXT at `resend._domainkey`, SPF MX at `send` (→
  `feedback-smtp.us-east-1.amazonses.com`, priority 10), SPF TXT at `send`
  (`v=spf1 include:amazonses.com ~all`). Namecheap only shows a bare "MX
  Record" option in its Add Record type dropdown after "Mail Settings" is
  switched from the default to "Custom MX" — otherwise it silently
  manages MX itself and the option doesn't appear.

### Branding: "SimpleRoost" (later session)

Renamed the app from the placeholder "Home Maintenance" to **SimpleRoost**
(landlord-appeal naming exercise — short, no "landlord"/"tenant" baked
into the literal brand since both roles see it, memorable, `.com`
available — see the domain purchase above).
- **Nav bar wordmark**: new `components/layout/Logo.tsx`, plain text (no
  icon — a bird-in-circle logo mark was explored and mocked up but the
  user asked for text-only in the nav), rendered top-left in both
  `TenantNavBar.tsx` and `LandlordNavBar.tsx` (both changed their header
  from `justify-end` to `justify-between` to make room), linking to
  `/home` (tenant) or `/dashboard` (landlord). Styled as two spans —
  `"Simple"` in `font-serif italic`, `"Roost"` in `font-sans font-bold` —
  deliberately mismatched fonts per the user's explicit ask to visually
  distinguish the two halves of the compound name.
- **Browser tab title + PWA manifest name**: `app/layout.tsx`'s
  `metadata.title`/`appleWebApp.title` and `app/manifest.ts`'s
  `name`/`short_name` all changed from `"Home Maintenance"`/`"Maintenance"`
  to `"SimpleRoost"` — these were the only two hardcoded spots (confirmed
  via repo-wide grep for the old name after the change, zero hits left).

### PropertyTile hover-tint bug fix (later session)

A landlord dashboard tile with a **plain green left bar and no status
badge** (an occupied property with no open/in-progress request, and no
`done` request within the 24h "Complete" window either) didn't light up
on hover/tap, unlike every red/amber/genuinely-`done`-badged tile.
Root cause in `components/properties/PropertyTile.tsx`: the left bar's
color and the hover-tint lookup (`statusInteractiveClass` in
`lib/statusRank.ts`) used to be computed separately — the bar fell back to
green whenever `badgeStatus` wasn't `"open"`/`"in_progress"` (including
`null`), but the tint lookup passed raw `badgeStatus` straight through,
and `statusInteractiveClass(null, ...)` has nothing to match so it
silently returns no tint at all. Fixed by computing a single `tone`
variable once (mirroring the bar's exact fallback-to-green logic) and
feeding *that* into both the bar color and the tint lookup, so they can
never disagree again. Verified live: hovering a plain-green tile now
tints green exactly like the other status colors already did.

### Tier rename + monthly chat-message caps (later session)

Subscription tiers renamed for display only: **Basic** (was "1-3 units")
and **Premium** (was "4-10 units") — `lib/stripe/plans.ts`'s
`PLAN_LABELS` values changed, `app/(landlord)/billing/page.tsx` now reads
from `PLAN_LABELS` instead of its own hardcoded ternaries, and
`UpgradeCelebrationModal.tsx`'s stray "Professional Tier" copy fixed to
say "Premium". The underlying `tier` union values (`"tier_1_3"`/
`"tier_4_10"`), Stripe price env var names, and the `subscriptions.tier`
check constraint are all unchanged — purely a label swap, no migration
needed for it.

**New monthly chat-message caps, tied to tier** — protects margins against
unbounded notification volume, since every `request_messages` insert
triggers a real Resend/push send via `triggerNotificationProcessing()`.
Basic: 350 messages/month + a 50-message emergency buffer (400 hard
stop). Premium: 1000/month, with a **$5 one-time purchase for 200 more**
once over (stackable, no cap on repeat purchases). A "message" is every
row in `request_messages` — landlord's and tenant's combined, across all
of a landlord's threads — resetting on the **calendar month** (1st of
every month for everyone, not per-landlord billing-cycle anniversaries).
Trial-only landlords (no real Stripe subscription yet) are capped too,
using the tier their live unit count would imply (same mapping as
`determineTier()`) — no unlimited-messaging loophole during the trial.

**Enforcement lives entirely in Postgres**, same reasoning as the
maintenance-request rate limit above: both `RequestConversation.tsx`
(landlord) and `MessageThread.tsx` (tenant) insert
directly via `supabase.from("request_messages").insert(...)`, no server
action in the path. Two new migrations:
- `20260816090000_message_usage_schema.sql` — `public.message_usage`
  (one row per landlord per calendar month, `message_count` +
  `bundle_messages_purchased`, incrementally maintained — not computed by
  scanning history, since `request_messages` has no `landlord_id` of its
  own) and `public.message_bundle_purchases` (append-only ledger, exists
  purely so the Stripe webhook can be idempotent on the $5 purchase — a
  replayed `checkout.session.completed` fails the unique constraint on
  `stripe_checkout_session_id` instead of double-crediting).
- `20260816090100_message_cap_trigger_and_rpc.sql` — `effective_message_cap()`
  (shared helper: resolves a landlord's tier, falling back to unit-count
  for trial-only landlords, and computes `base_cap`/`buffer_cap`/
  `bundle_cap`/`effective_cap`), a `BEFORE INSERT` trigger
  `enforce_message_cap` on `request_messages` that increments/checks a
  `message_usage` row and `raise exception 'message_cap_exceeded'` once
  over, and `get_message_usage()` (an `auth.uid()`-scoped RPC the UI
  reads from, so displayed numbers can never drift from what's actually
  enforced — both read the same `effective_message_cap()`). **A brand-new
  request's opening message is always exempted** (the trigger checks `not
  exists (select 1 from request_messages where request_id = new.request_id)`
  and allows it unconditionally) — otherwise a fully-capped landlord would
  make it look like tenants can't report anything at all; only the
  landlord's reply and everything after is subject to the cap.

**Client-side wiring**: `error.message.includes("message_cap_exceeded")`
in both chat components' `handleSend` (same string-matching precedent as
`StatusControls.tsx`'s existing `subscription_required` check) sets a
`blocked` state that swaps the send form for an inline notice. The
landlord's request-detail page additionally fetches `get_message_usage()`
server-side and passes `initialBlocked` into `RequestConversation` so the
input is pre-disabled on page load, not just after a wasted submit —
tenants don't get this proactive check (RLS restricts `message_usage`/
`get_message_usage()` to the landlord, an intentional asymmetry), only the
reactive one, with neutral copy that doesn't expose the landlord's
billing state ("Your landlord has reached their monthly message limit").

**UI surfaces**:
- `components/billing/MessageUsageBanner.tsx` — persistent, account-wide
  (rendered in `app/(landlord)/layout.tsx` next to the existing
  `TrialBanner`), red when fully blocked, amber when in the
  buffer/purchased-extra zone. The amber copy is **tier-aware** — Basic
  says "using your emergency buffer", Premium says "using your purchased
  extra messages" (a real bug caught during live testing: the generic
  copy said "emergency buffer" even for Premium, which has no buffer
  concept — Premium's overage protection is the $5 bundle, not a buffer).
- `components/billing/MessageCapWarningPopup.tsx` — a one-time modal
  popup that fires at **80% of the base cap** (280/350 Basic, 800/1000
  Premium), exact copy: "Your account has used 80% of its monthly
  maintenance texts. No action is needed right now, but you can track
  usage in your dashboard." Only fires before the harder buffer/blocked
  states (a "no action needed" message would be misleading once actually
  restricted). Dismissal remembered via `localStorage` keyed by calendar
  month (`message_cap_warning_dismissed_<period>`) — simplest way to make
  it "once a month" without new DB schema just for a seen-flag.
- `components/billing/MessageUsageBar.tsx` — visual bar on the
  **Settings page** (`app/settings/page.tsx`, landlord-only section,
  titled "Monthly maintenance message allowance"), green below 60% of
  base cap, amber 60–80%, red 80%+ (matching the popup's own threshold).
  Same page shows `MessageCapUpgradeButton` once blocked — a real
  permanent prorated upgrade to Premium for Basic (reuses the existing
  `UnitUpgradeModal` unchanged, since it was already generic on
  `targetTier`/`interval`/`amountDueCents`), or the $5/200-message buy
  button for Premium.
- **Basic→Premium upgrade-on-cap** (`lib/billing/messageLimit.ts`,
  `checkMessageCapUpgrade`/`applyConfirmedMessageCapUpgrade`) mirrors
  `lib/billing/unitLimit.ts`'s exact "preview a real Stripe-computed
  prorated cost via `stripe.invoices.createPreview` → user confirms →
  `applyTierChange`" shape, just triggered by message volume instead of
  unit count. This is a genuine, permanent tier change (stays Premium
  going forward), not a one-cycle reversion — same mechanics already
  proven live for the unit-count upgrade flow.

**New one-time (non-subscription) Stripe payment** — the app's first,
previously only `mode: "subscription"` Checkout existed. New
`lib/billing/messageBundle.ts`'s `createMessageBundleCheckoutSession`
uses `mode: "payment"` with inline `price_data` (no pre-created Stripe
Price/env var, since it's a fixed ad hoc $5 item), metadata
`{ landlord_id, kind: "message_bundle", bundle_message_count }`. Webhook
branch added to `handleCheckoutSessionCompleted` in
`lib/billing/webhookHandlers.ts` (checks `session.mode === "payment" &&
session.metadata?.kind === "message_bundle"` before falling through to
the existing subscription-only logic) → `handleMessageBundlePurchase`
credits `message_usage.bundle_messages_purchased` only after a successful
(non-conflicting) insert into `message_bundle_purchases`.

**Verified live against the real Stripe test account, full loop**:
manually pushed a test landlord's `message_usage` to 65%/85%/100% via
direct DB writes to check the bar colors and the 80% popup (both fired
correctly, popup didn't reappear after dismissal), confirmed the
persistent blocked banner and pre-disabled chat input at 100%, then ran
an actual test-mode Stripe Checkout purchase (`4242 4242 4242 4242`) for
the $5 bundle — required starting `stripe listen --forward-to
localhost:3000/api/stripe/webhook` locally first (a purchase attempt
before the forwarder was running completed on Stripe's side but never
reached the local webhook route, confirming forwarding — not app logic —
was the gap). With the forwarder running, the webhook delivered, credited
exactly once (confirmed via the `message_bundle_purchases` ledger, one
row, matching the unique-constraint idempotency design), the bar updated
to reflect the +200 purchased messages, the blocked state cleared, and a
real chat message sent successfully immediately after. All test data
(`message_usage`, `message_bundle_purchases`, the test chat message)
cleaned up afterward.

### Billing page feature lists + polish (later session)

Each pricing card on `/billing` now shows a bullet feature list (with a
Tabler check icon per line) between the plan's quote and its price —
`planFeatures(tier)` in `lib/stripe/plans.ts`, card order is Name → Price
→ Quote → Features → Subscribe buttons. The message-cap number in the
list (`350`/`1,000`) is interpolated from a new exported
`BASE_MESSAGE_CAP: Record<Tier, number>` constant rather than hardcoded
text, so it can't silently drift from what the SQL trigger actually
enforces — the constant's comment says exactly which migration to keep it
in sync with. Also: `Logo.tsx` got a small `mr-0.5` gap between "Simple"
and "Roost" (deliberately less than a full space).

### New-request back-button fix (later session)

After a tenant submits a new request, `NewRequestForm.tsx` used
`router.push()` to the new request's detail page — this stacks the detail
page on top of the (now-empty, stale) form in browser history, so
pressing back landed a tenant back on the form instead of home. Changed
to `router.replace()`, which swaps out the form's history entry instead
of stacking on it, so back correctly goes to wherever the tenant came
from (home). Verified live: submit → detail page → back → lands on home,
not the form.

### Dashboard "Multiple requests" property state (later session)

Root-caused two things the user thought were bugs and turned out not to
be, while building this: (1) a "picture goes blank" report traced to a
single leftover **raw, unconverted `.HEIC` attachment** from a session
before this app's automatic HEIC→JPEG/WebP conversion existed — browsers
other than Safari/WebKit can't decode HEIC at all, so it was broken
before the status change and unrelated to it. (2) a "status doesn't
update" report traced to a property having **several other requests still
sitting in `open` status** from old test sessions — the dashboard tile
correctly stays red whenever *any* request on a property is open,
regardless of what happens to one specific other request. Both were
leftover test-data debris (deleted, along with their Storage objects, via
the service-role client — see the cleanup pattern below) rather than app
bugs, but investigating them surfaced a real, previously-unhandled case:
a property with multiple simultaneously-active requests had no dedicated
treatment, just whichever single request happened to be picked as
"relevant."

New **"Multiple requests" property state** (blue) on the landlord
dashboard, added properly this time:
- `badgeStatus` (`DashboardPropertyList.tsx`, `PropertyTile.tsx`) gained a
  fourth value alongside `open`/`in_progress`/`done`: `"multiple"`. Left
  bar and hover/select tint are blue (`lib/statusRank.ts`'s
  `INTERACTIVE_TINT.multiple`), ranked as the single most urgent tier
  (above plain `open`) in the dashboard's sort order.
- **Sticky, not live-computed** — this was a specific, deliberate choice
  confirmed with the user over live-count-based alternatives: once a
  property has 2+ requests needing attention at the same time, it stays
  "Multiple requests" even as they're resolved one by one, only clearing
  once *every* request from that wave is done. A lone remaining request
  still counts as part of a wave if some other request on the property
  was marked done *after* this one was created (i.e. they were genuinely
  open together at some point, not just two unrelated issues months
  apart). This needed widening the done-transition query
  (`request_status_history`, `to_status = 'done'`) in both
  `app/(landlord)/dashboard/page.tsx` and `DashboardPropertyList.tsx`'s
  client re-fetch from a 24h window to unbounded — the existing `doneAt`
  map already supported this shape (it's keyed by request id →
  done-timestamp), the 24h check for the separate "Complete" pill logic
  is just applied at the point of use instead of baked into the query.
- **Category icon row**: one icon per distinct category among the
  property's currently-active (non-done) requests, with a small `×N`
  suffix only when more than one active request shares that category —
  two Kitchen issues show one fork icon with `×2`; a lone Bathroom issue
  just shows its icon, no text labels anywhere in this row. This is
  deliberately based on *current* need, separate from the sticky badge
  text above — after 2 of 3 requests resolve, the icon row can shrink to
  just the one remaining category while the badge still says "Multiple
  requests".
- **Expanded dropdown** shows every request in the current wave (title,
  its own `StatusBadge` — "Maintenance required"/"In progress"/"Complete"
  — category, time, description, Details link), separated by a divider
  line (`divide-y`) between entries, when badgeStatus is `"multiple"` —
  reuses the same row shape as the existing single-request preview, just
  with a per-row status badge added. This list is `waveRequests`
  (`DashboardPropertyList.tsx`), not just `nonDoneRequests` — it
  deliberately includes the qualifying already-done siblings too (the
  same ones keeping the sticky "Multiple requests" state alive), so a
  landlord can see the full picture of what happened, not just what's
  still outstanding. `categorySummary`'s icon row stays based on
  `nonDoneRequests` only, unaffected — current-need icons vs.
  full-wave-history dropdown are deliberately different scopes.
- Verified live with a controlled 3-request scenario (2 Kitchen + 1
  Bathroom on one property): confirmed the icon grouping/count, the full
  dropdown list, that marking one request in-progress kept the blue state
  and correct icons, that resolving 2 of 3 (leaving only the Bathroom one
  active) correctly *stayed* "Multiple requests" per the sticky rule
  instead of falling back to plain red/amber, and that resolving the
  final one flipped the tile to green "Complete" as normal. Separately
  verified the per-row status badges + dividers with a mixed-status
  scenario (one open, one in-progress, one done-and-still-in-wave) —
  confirmed each row showed the correct color/label
  (red/amber/green) and a visible divider line between every pair of
  rows.

**Multi-row dropdown extended to the all-done case too.** Once every
request in a wave is marked complete, the tile itself reverts to the
plain single-request green "Complete" pill (not "Multiple requests" —
that text is specifically for the still-active state), but the dropdown
still lists every request that was part of the wave, each with its own
"Complete" `StatusBadge` and a divider between rows — not just one. In
`DashboardPropertyList.tsx`, `recentlyDoneRequests` (plural, replacing
the old single `recentlyDone`) filters ALL done requests within the
existing 24h `doneAt` window, and `waveRequests`/`dropdownRequests` is
populated from it whenever there are 2+ (for exactly 1 — the ordinary
single-request case — it stays `null` and `PropertyTile` falls back to
its plain single-preview block unchanged, so nothing regressed there).
`PropertyTile`'s dropdown condition changed from `badgeStatus ===
"multiple" && waveRequests` to just `waveRequests` (truthy check alone),
since the same multi-row list is now correct for both the active-wave
and finished-wave cases. The 24h expiry itself needed no new code — it's
the same `doneAt`-window filter already driving the single-request
Complete pill, just now also gating the list's population; once every
member ages past 24h, `recentlyDoneRequests` empties, `badgeStatus` falls
through to `null`, and the tile reverts to a plain green bar with "No
requests yet." — pre-existing behavior, unchanged. Verified live: two
requests marked complete on one property showed the plain green
"Complete" tile with both listed (individually badged, divided) in the
dropdown.

**Completed multi-request wave now stays icons-only, and each dropdown
row shows its own icon too (later session).** The finished-wave "Complete"
tile above used to fall back to `PropertyTile`'s single-category
text+icon label once every request in a wave was done, even though the
still-active "Multiple requests" state right next to it is icons-only —
inconsistent. `DashboardPropertyList.tsx`'s `categorySummary` (previously
computed only when `badgeStatus === "multiple"`, from `nonDoneRequests`)
now also computes for the finished-wave case (`badgeStatus === "done"`
with 2+ requests done together), summarizing `recentlyDoneRequests`
instead since there's no "current need" left to distinguish once
everything's done. `PropertyTile`'s header-row condition changed from
`badgeStatus === "multiple" && categorySummary` to just `categorySummary`,
so it renders icons-only for either source. Separately, each row inside
the expanded multi-row dropdown (`waveRequests.map(...)`) now looks up
and renders that row's own category icon immediately to the left of its
`StatusBadge`, rather than only stating the category in the small text
line below — applies to both the active-wave and finished-wave dropdown
lists, since they share the same row markup.

**Dropdown pill buttons give hover/tap feedback (later session).** The
plain white/outlined "Details" and "Add tenant" buttons inside
`PropertyTile.tsx`'s expanded dropdown had no visual affordance that they
were tappable/clickable at rest — nothing distinguished them from plain
text until you were already on top of one. All three instances
(vacant-property "Add tenant", per-row "Details" in the multi-row wave
list, single-request "Details") now share one `pillButtonClass` constant
with `hover:bg-black hover:text-white` and the same on `active:`, so a
mouse hover previews it and a mobile tap gets the same feedback via
`:active` (no JS touch handling needed, unlike the tile row's own
hover-tint mechanism above — these are plain navigating links, not toggle
buttons, so CSS `:active` alone is enough). **First shipped black, then
changed to silver** (`hover:bg-[#C0C0C0] hover:text-black`, same in both
themes, so the `dark:hover:*` variants were dropped — silver is light
either way and needs the same dark text) per explicit follow-up feedback.

**A production deploy briefly served stale CSS after this shipped** — a
plain `vercel deploy --prod` reused Vercel's remote build cache, and the
cached Tailwind build hadn't picked up the new `hover:bg-black`/
`hover:text-white`/`active:*` utility classes even though a clean local
`npm run build` had them from the start (confirmed by diffing the actual
compiled CSS between a local build and the live production bundle via
curl). Fixed by `vercel deploy --prod --force`, which forces a fresh
remote build bypassing that cache — worth reaching for again if a styling
change looks correct locally but doesn't show up live. (A `--prebuilt`
deploy using a local `vercel build` was tried first as an alternative fix
but doesn't work in this repo: `vercel build` can only pull sensitive env
vars as a masked `[SENSITIVE]` placeholder, which broke the build on
`VAPID_SUBJECT` not being a real URL.)

**Billing moved to third in the landlord hamburger menu**
(`LandlordNavBar.tsx`), between Manage Properties and Support — was
previously last before the sign-out divider.

**Manage Properties' "Manage →" / "Add tenant" pills lift and scale on
hover/tap.** These are the one remaining plain solid-black pill on that
page (Edit/Delete are already filled circles with their own hover tint) —
rather than switching them to the dropdown's white+silver treatment,
which would have stripped their current visual prominence as the primary
per-unit action, added `hover:scale-110 hover:shadow-md active:scale-95`
(+ `transition-transform`) in `ManagePropertiesList.tsx` so the color
stays black but the button visibly lifts toward the cursor and presses
down on tap — demoed to the user as an interactive widget mockup before
building it. **Tailwind v4 gotcha hit verifying this**: `scale-*`
utilities set the native CSS `scale` property, not `transform` — checking
`getComputedStyle(el).transform` after a real hover looked like the class
wasn't applying (`"none"`) until switching the check to `cs.scale`, which
correctly showed `"1.1"`. Don't reach for `.transform` when verifying any
Tailwind v4 `scale-*`/rotate/translate utility in this repo.

**Billing plan-card checkmarks are green** (`app/(landlord)/billing/page.tsx`,
the `IconCheck` in `planFeatures(tier).map(...)`) — was `text-zinc-400`,
now `text-green-600 dark:text-green-500`. One line covers both the
regular `/billing` view and the post-signup `?welcome=1` view, since
they're the same page component — signup itself
(`app/(auth)/signup/page.tsx`) redirects to `/billing?welcome=1` after
email confirmation rather than rendering its own separate plan cards.

**Rooster-run animation on the Settings page message meter**
(`components/billing/MessageUsageBar.tsx`, now a client component). Every
time the landlord lands on Settings, a 🐓 runs from the left edge of the
bar to the current usage point, waddling (`animate-rooster-waddle`, a
`rotate(-14deg)`↔`rotate(14deg)` keyframe added to `app/globals.css`)
while it moves, then settling still once it arrives. Deliberately driven
by a manual `requestAnimationFrame` loop (`RUN_DURATION_MS = 1400`, cubic
ease-out) rather than a CSS `transition` on `width` — a plain CSS
transition would jump straight to the final `barColorClass` the instant
React sets state, but recomputing `barColorClass(percent)` every animation
frame is what makes the bar visibly shift green → amber → red mid-run if
the landlord's usage crosses those thresholds, not just land on the final
color. Skips straight to the final position (no animation) under
`prefers-reduced-motion: reduce`. Tested by temporarily writing
`message_usage.message_count = 850` for the test landlord directly via
the service-role client (reverted after) to get a red-zone bar to look at,
since the real account normally sits at 0. **Testing note, not a product
bug**: this session's automated browser pane reports `document.hidden =
true`, which makes `requestAnimationFrame` never fire until a screenshot
forces a repaint (standard background-tab throttling per spec) — so the
run always appeared to jump straight to its final frame when checked
here, even though the DOM/CSS/class output was confirmed correct at every
step. A real foreground tab does not have this problem; if this ever
needs re-verifying in this environment, that's the harness, not the code.

**Billing's "Contact us for custom enterprise pricing" now routes to
`/support`** (`app/(landlord)/billing/page.tsx`) instead of being its own
separate `mailto:` link — was duplicating (with a slightly different
subject line) what the Support page's mailto link already does. One
fewer place hardcoding the developer's email address if it ever changes.

**Subscribe buttons get the same pop animation as Manage
Properties.** All four Subscribe buttons on `/billing` (monthly + yearly,
both tiers) gained the same `hover:scale-110 hover:shadow-md
active:scale-95` treatment as the Manage Properties pills, per explicit
follow-up ask for consistency.

**Rooster redrawn as a custom SVG, not the 🐓 emoji, and moved onto the
bar itself.** `MessageUsageBar.tsx`'s `RoosterIcon` replaces the emoji
with plain SVG shapes (ellipse body, circle head, two curved tail-feather
paths, a scalloped comb, a wattle, a beak, two leg lines) — necessary
because emoji glyphs have platform-fixed color and orientation that CSS
can't reliably override, and the ask was specifically for a *particular*
color (brown: `#8b5a2b` body/head) and a *particular* facing direction
(right, matching the direction it runs — beak/comb sit at the high-x end
of the `0 0 40 32` viewBox, tail trails at the low-x end). Positioning
changed from an absolutely-positioned span floating `-top-6` above the
bar to sitting `bottom-1` inside a wrapper the track itself is pinned to
the bottom of (`absolute bottom-0`), so it visually stands/walks on the
bar's surface instead of hovering separately above it — the waddle
keyframes (`translateX(-50%) rotate(...)`) needed no changes since the
positioning axis they operate on didn't change, only the vertical anchor
did.

**Rooster refined further and re-centered on the bar (later session)** —
two follow-up asks. (1) More detail added to `RoosterIcon`'s `viewBox`
(now `0 0 44 36`, rendered slightly larger at 32×26): three layered tail
feathers instead of two, a folded-wing shape overlapping the body, a
lighter breast/belly patch for a two-tone look, a jagged 4-point comb
instead of a smooth scallop, small forked feet, and an eye highlight dot.
(2) Repositioning — the previous `bottom-1`-anchored version still read
as "standing above" the bar rather than centered on it, so both the
track and the rooster are now anchored via `top-1/2` +
`-translate-y-1/2` off a shared wrapper instead of the track being
`bottom-0`-pinned, putting the rooster's vertical center exactly on the
bar's vertical center. The waddle keyframes in `globals.css` changed
from `translateX(-50%) rotate(...)` to `translate(-50%, -50%)
rotate(...)` to match — this **does** need to change in lockstep any
time the resting-state inline `transform` on `RoosterIcon` changes,
unlike the previous bottom-anchored version where only the horizontal
axis was transform-driven.

**Plan-card copy**: "Instant, lightweight video previews..." →
"Instant, lightweight video/photo attachments..." in
`lib/stripe/plans.ts`'s `planFeatures()` — the old wording undersold it
by implying video-only, when photo attachments work the same way.

**"Property name" field removed from the add-property form** — street
address is now the only identifying field a landlord enters, matching
the explicit ask that only the address (and what's below it) matters.
`properties.name` is still `text not null` at the DB level (no migration
— didn't want to touch a column other flows already treat as
deliberately immutable, see the earlier "Edit property page" entry
above), so `createProperty` in
`app/(landlord)/properties/actions.ts` now derives `name` straight from
`address_line1` instead of reading a separate form field, and
`address_line1` itself gained the `required` attribute in
`NewPropertyForm.tsx` (it was optional before, back when `name` was the
required field carrying the address). Verified live: creating a property
with just a street address + city redirected correctly and showed the
right label on both the property detail page and Manage Properties.

**Add-property form now requires city/state/ZIP too (later session)** —
`NewPropertyForm.tsx` added `required` to those three inputs, and
`createProperty` (`app/(landlord)/properties/actions.ts`) gained matching
server-side checks (`if (!city) throw...`, same for state/postal_code)
since HTML `required` alone doesn't stop a direct POST. **Unit number
deliberately stays optional** — asked the user directly rather than
guessing, since forcing a unit at creation would break the existing
"add units later from the property page" flow multi-unit properties rely
on elsewhere. Display is unchanged: property listings still only show
address/city/state (`p.name, p.city, p.state`), same as before — the ZIP
is now always collected but was never part of what's shown in tiles/lists
anyway, so nothing needed to change there.

**"Enable/Disable push notifications" button gets the same pop
animation** (`components/settings/PushToggle.tsx`) as the other solid
black pills — `hover:scale-110 hover:shadow-md active:scale-95`. This
component is shared by both the landlord and tenant Settings pages, so
one change covers both roles.

**Add-property form validation no longer shows the native browser
"Please fill out this field" bubble** — `NewPropertyForm.tsx` dropped the
`required` attributes in favor of `noValidate` on the `<form>` plus
manual validation in the submit handler: on submit, any empty required
field (`address_line1`/`city`/`state`/`postal_code`) is added to an
`invalidFields` state Set, which drives a red border on just that input
(cleared on its own `onChange` as soon as the landlord types something)
— submission is blocked client-side the same as before, just with a
quieter highlight instead of a popup. The server-side `createProperty`
checks added for the required-fields change above are unaffected by
this — they're the real enforcement, this is purely presentational.

**Magic-link sign-in removed from `/login`** (`components/auth/LoginForm.tsx`)
— was a password/magic-link toggle, now password-only, per explicit ask
("I don't think that is useful"). Deliberately left `/auth/callback`
(`app/(auth)/auth/callback/route.ts`) and its middleware public-route
allowance untouched — that route is shared infrastructure, also used by
the signup email-confirmation redirect and the tenant invite-signup
flow's `emailRedirectTo`, so removing it would have broken both of those.
Verified live: `/login` now shows only email/password with no mode
toggle, and signing in with the test landlord's password still redirects
to `/dashboard` correctly.

**"Log in" button gets the same pop animation, "Sign up" link underlines
on hover/tap** (`components/auth/LoginForm.tsx`) — `Log in` matches the
`hover:scale-110 hover:shadow-md active:scale-95` treatment used
everywhere else; the `Sign up` link (inline text, not a pill) instead
gets `hover:underline active:underline`, since underline is the
appropriate affordance for plain inline link text rather than a button
fill/scale change.

**The scale/shadow "pop" was removed from every button that had it, per
explicit follow-up feedback that it read as too intense** — replaced
with a plain color-shift on hover/tap instead, `transition-colors`
instead of `transition-transform`, no size change at all. Five spots
touched: `components/settings/PushToggle.tsx`, `components/auth/LoginForm.tsx`
("Log in"), `components/properties/ManagePropertiesList.tsx`
("Manage →"/"Add tenant"), and both Subscribe buttons on
`app/(landlord)/billing/page.tsx`. Two variants depending on the
button's base look:
- **Solid black/white pills** (Push toggle, Log in, Manage/Add tenant,
  Subscribe monthly): `hover:bg-zinc-800 active:bg-zinc-700` in light
  mode, `dark:hover:bg-zinc-200 dark:active:bg-zinc-300` in dark —
  darkens/lightens the fill slightly rather than inverting or moving.
- **Outlined pills** (Subscribe yearly): `hover:bg-black/5
  active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15` — a
  faint tint fill, matching the same light-touch hover treatment already
  used elsewhere in the app for plain bordered rows (e.g. the hamburger
  nav menu items).

Deliberately left the dropdown pill buttons' silver-on-hover treatment
(`PropertyTile.tsx`'s `pillButtonClass`, see above) and the tile-row
hover tint (`statusInteractiveClass`) alone — this feedback was
specifically about the scale/shadow pop pattern, not every hover effect
in the app, and those two were never part of that pattern to begin with.

**The subtle color-shift hover/active treatment was extended to every
remaining button across both the landlord and tenant sides** (later
session, explicit follow-up: "put that for the other buttons on the
app"). Most of these previously had *no* hover or active state at all —
this wasn't just about matching the pop-removal above, it closed a much
larger consistency gap. Same two variants as above (solid black/white →
`hover:bg-zinc-800 active:bg-zinc-700` / `dark:hover:bg-zinc-200
dark:active:bg-zinc-300`; outlined → `hover:bg-black/5 active:bg-black/10`
/ `dark:hover:bg-white/10 dark:active:bg-white/15`), plus two narrower
variants for buttons with their own established color (added `active:`
one step past their existing `hover:` in the same hue rather than
switching to zinc): status-colored outlines (amber/green in
`StatusControls.tsx`) and icon-circle buttons that already had a tinted
hover (zinc for Edit, red for Delete in `ManagePropertiesList.tsx`, the
add-property `+` buttons on `dashboard/page.tsx` and
`manage-properties/page.tsx`). Plain-text links (not pills) got
`hover:underline active:underline` instead, matching the `Sign
up`/`Log in` treatment from earlier. Touched, non-exhaustively: `Accept
invite` (`app/invite/[token]/page.tsx`), `Send invite` (both the unit
detail and property detail pages), `Save changes` (edit-property page),
`WelcomeChooser.tsx`'s Continue button/back-arrow/role cards/Log in link,
`signup/page.tsx`'s Sign up button/Log in link, both chat `Send` buttons
and the `Reply` button (`MessageThread.tsx`, `RequestConversation.tsx`),
both lightbox close buttons (`RequestConversation.tsx`,
`RequestDetail.tsx`), `ConfirmButton.tsx`'s Cancel/destructive-confirm
pair (used by Delete property and Remove tenant), every billing modal's
buttons (`MessageCapUpgradeButton.tsx`, `UnitUpgradeModal.tsx`,
`UpgradeCelebrationModal.tsx`, `MessageCapWarningPopup.tsx`), `Manage
billing` on `/billing`, `InviteSignupForm.tsx`'s Create account,
`AddUnitForm.tsx`'s Add unit, `NewRequestForm.tsx`'s Submit request and
its photo/video dropzone, `NewPropertyForm.tsx`'s Create property
(missed in the required-fields pass earlier — caught by a repo-wide grep
for `rounded-full` classes lacking `hover:`), `BackButton.tsx` (shared by
both roles), both hamburger nav menus in full (`LandlordNavBar.tsx`,
`TenantNavBar.tsx` — every item plus the toggle button), and
`TenantRow.tsx`'s Remove tenant link. Deliberately left alone: the
brand wordmark (`Logo.tsx` — not an action button), and
`MessageUsageBanner.tsx`/`TrialBanner.tsx`'s links (already
permanently-underlined at rest, which is its own sufficient affordance —
adding a hover state on top wasn't part of what was asked and risked
looking inconsistent with that established "underlined banner CTA"
style). Verified via a repo-wide grep for `rounded-full` classNames
missing `hover:` (down to zero real hits after this pass) and live
spot-checks on both the landlord test account (Manage Properties,
Billing, hamburger menu) and the tenant test account (hamburger menu,
new-request form + dropzone, Settings push toggle, request-detail status
buttons).

## Environment setup

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
- Stripe: **no account exists yet** — this is a hard blocker for anything
  beyond what's already built (see the billing section above). Create one
  at `stripe.com`, get `STRIPE_SECRET_KEY` from
  `dashboard.stripe.com/apikeys` (test mode), run
  `node scripts/stripe-setup.mjs` to create the 3 Products/Prices and get
  `STRIPE_PRICE_TIER_*` values, then add a webhook endpoint in the
  Dashboard pointing at `<NEXT_PUBLIC_APP_URL>/api/stripe/webhook`
  (subscribed to `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`, `invoice.payment_succeeded`) to get
  `STRIPE_WEBHOOK_SECRET`. Local webhook testing without the Stripe CLI
  (not installed in this environment) is possible using
  `Stripe.webhooks.generateTestHeaderString()` to synthesize a
  validly-signed event — see the billing section above.

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
- **Turbopack's dev cache goes stale after several edits in one session** —
  the browser console/server log starts citing a runtime error at a line
  number whose content doesn't match the current file on disk (e.g. a
  variable or JSX tag that was already removed). This isn't a real bug in
  the edit; `tsc --noEmit` will show clean. Fix: stop the dev server,
  `rm -rf .next`, restart. Don't spend time debugging the phantom error
  itself — go straight to the cache clear.

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
