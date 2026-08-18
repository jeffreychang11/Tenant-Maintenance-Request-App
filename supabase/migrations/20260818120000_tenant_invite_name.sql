-- Landlord now enters the tenant's name when creating an invite, so the
-- pre-filled invite message can greet them by first name instead of a
-- literal "[Name]" placeholder. Nullable since existing invite rows were
-- created before this column existed.
alter table public.tenant_invites add column tenant_name text;
