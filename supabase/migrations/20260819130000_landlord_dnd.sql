-- Do Not Disturb: a landlord-configurable daily time-of-day window during
-- which push notifications are suppressed (email still always goes out —
-- see lib/notifications/dispatch.ts's existing "email is the guaranteed
-- fallback" design). Stored on profiles (not a new table) since it's a
-- handful of simple per-user settings covered by the existing
-- profiles_update_own RLS policy with no changes needed there.
--
-- dnd_start_time/dnd_end_time are wall-clock times in the landlord's own
-- dnd_timezone (an IANA name like 'America/Los_Angeles', captured
-- client-side via Intl.DateTimeFormat at save time) — NOT UTC — so an
-- overnight range like 22:00-07:00 is interpreted in local time regardless
-- of server timezone. Nullable/false by default: nobody has DND until they
-- opt in.
alter table public.profiles
  add column dnd_enabled boolean not null default false,
  add column dnd_start_time time,
  add column dnd_end_time time,
  add column dnd_timezone text;
