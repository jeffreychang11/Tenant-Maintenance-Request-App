-- Phase 1: core identity schema — profiles, properties, units, tenant_units,
-- tenant_invites — plus the RLS helper functions and policies that keep
-- landlords and tenants scoped to their own data.

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('landlord', 'tenant')),
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  created_at timestamptz not null default now()
);

create index idx_properties_landlord_id on public.properties(landlord_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (property_id, label)
);

create index idx_units_property_id on public.units(property_id);

create table public.tenant_units (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  moved_in_at timestamptz not null default now(),
  moved_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_tenant_units_tenant_id on public.tenant_units(tenant_id);
create index idx_tenant_units_unit_id on public.tenant_units(unit_id);
-- A tenant can only have one *active* link to a given unit at a time,
-- but can have historical inactive links (past tenancies).
create unique index idx_tenant_units_active_unique on public.tenant_units(unit_id, tenant_id)
  where status = 'active';

create table public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  email text not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id)
);

create index idx_tenant_invites_token on public.tenant_invites(token);
create index idx_tenant_invites_email on public.tenant_invites(lower(email));
-- Re-inviting the same email to the same unit replaces the pending invite
-- rather than creating a duplicate.
create unique index idx_tenant_invites_pending_unique on public.tenant_invites(unit_id, lower(email))
  where status = 'pending';

-- ============================================================
-- Helper functions (used by RLS policies below)
-- ============================================================

create or replace function public.is_landlord_of_property(p_property_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.properties
    where id = p_property_id and landlord_id = auth.uid()
  );
$$;

create or replace function public.is_landlord_of_unit(p_unit_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.units u
    join public.properties p on p.id = u.property_id
    where u.id = p_unit_id and p.landlord_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_of_unit(p_unit_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenant_units
    where unit_id = p_unit_id and tenant_id = auth.uid() and status = 'active'
  );
$$;

-- ============================================================
-- New-user provisioning: auto-create a profile row on signup.
-- Role comes from signup metadata (landlord self-signup sets it directly;
-- tenant signup via an invite link sets it to 'tenant').
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'tenant'),
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenant_units enable row level security;
alter table public.tenant_invites enable row level security;

-- profiles: a user can only see/update their own row. No insert policy —
-- rows are created exclusively by the security-definer handle_new_user
-- trigger, which runs as the table owner and bypasses RLS.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- properties: fully owned by the landlord.
create policy "properties_landlord_all" on public.properties
  for all using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

-- units: landlord has full control; a linked tenant can read their unit.
create policy "units_landlord_all" on public.units
  for all using (public.is_landlord_of_property(property_id))
  with check (public.is_landlord_of_property(property_id));

create policy "units_tenant_select" on public.units
  for select using (public.is_tenant_of_unit(id));

-- tenant_units: landlord can see links for their properties; tenant can
-- see their own links. No client insert/update/delete policy — rows are
-- only written by the security-definer accept_invite RPC (Phase 2).
create policy "tenant_units_landlord_select" on public.tenant_units
  for select using (public.is_landlord_of_unit(unit_id));

create policy "tenant_units_tenant_select" on public.tenant_units
  for select using (tenant_id = auth.uid());

-- tenant_invites: only the inviting landlord can see/manage their invites.
-- No select policy for tenants/anonymous users — invite lookup by token
-- happens through a security-definer RPC (Phase 2), not a direct table read.
create policy "tenant_invites_landlord_select" on public.tenant_invites
  for select using (invited_by = auth.uid());

create policy "tenant_invites_landlord_insert" on public.tenant_invites
  for insert with check (invited_by = auth.uid() and public.is_landlord_of_unit(unit_id));

create policy "tenant_invites_landlord_update" on public.tenant_invites
  for update using (invited_by = auth.uid());
