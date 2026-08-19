-- One-time "welcome tutorial" shown to a landlord right after they first
-- sign up (chat, status updates, property/tenant management, Do Not
-- Disturb, support). Existing landlords already know the app, so they're
-- backfilled as already-seen — only new signups (column defaults to null)
-- get shown it going forward. Covered by the existing profiles_update_own
-- RLS policy, no changes needed there (same reasoning as the DND columns
-- added in 20260819130000_landlord_dnd.sql).
alter table public.profiles
  add column onboarding_tutorial_seen_at timestamptz;

update public.profiles set onboarding_tutorial_seen_at = now();
