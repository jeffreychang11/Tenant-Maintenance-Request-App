-- Phase 3: maintenance requests, chat messages, attachments, and the
-- private Storage bucket + policies backing photo/video uploads.

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id),
  -- Denormalized from units->properties by a trigger below, purely so RLS
  -- policies and the landlord dashboard query are a single indexed
  -- equality check instead of a join through units/properties every time.
  landlord_id uuid not null references public.profiles(id),
  title text not null,
  description text,
  category text not null check (category in (
    'kitchen', 'bathroom', 'appliances', 'plumbing', 'electrical', 'hvac',
    'pool', 'living_room', 'bedroom', 'exterior', 'garage', 'other'
  )),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'reopened')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index idx_maintenance_requests_unit_id on public.maintenance_requests(unit_id);
create index idx_maintenance_requests_tenant_id on public.maintenance_requests(tenant_id);
create index idx_maintenance_requests_landlord_id on public.maintenance_requests(landlord_id);
create index idx_maintenance_requests_status on public.maintenance_requests(status);

create table public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text,
  created_at timestamptz not null default now()
);

create index idx_request_messages_request_id_created_at
  on public.request_messages(request_id, created_at);

create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  message_id uuid references public.request_messages(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id),
  storage_path text not null,
  file_type text not null check (file_type in ('image', 'video')),
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index idx_request_attachments_request_id on public.request_attachments(request_id);
create index idx_request_attachments_message_id on public.request_attachments(message_id);

-- ============================================================
-- Helpers + triggers
-- ============================================================

create or replace function public.is_landlord_of_request(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.maintenance_requests
    where id = p_request_id and landlord_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_of_request(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.maintenance_requests
    where id = p_request_id and tenant_id = auth.uid()
  );
$$;

create or replace function public.set_request_landlord_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.landlord_id into new.landlord_id
  from public.units u
  join public.properties p on p.id = u.property_id
  where u.id = new.unit_id;
  return new;
end;
$$;

create trigger set_maintenance_requests_landlord_id
  before insert on public.maintenance_requests
  for each row execute procedure public.set_request_landlord_id();

create trigger set_maintenance_requests_updated_at
  before update on public.maintenance_requests
  for each row execute procedure public.set_updated_at();

-- Atomically creates a request plus its first chat message (the tenant's
-- initial description), so the thread always has full history without the
-- UI having to special-case "message #0".
create or replace function public.create_maintenance_request(
  p_unit_id uuid,
  p_title text,
  p_description text,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_tenant_of_unit(p_unit_id) then
    raise exception 'not authorized for this unit';
  end if;

  insert into public.maintenance_requests (unit_id, tenant_id, title, description, category)
  values (p_unit_id, auth.uid(), p_title, p_description, p_category)
  returning id into v_request_id;

  insert into public.request_messages (request_id, sender_id, body)
  values (v_request_id, auth.uid(), p_description);

  return v_request_id;
end;
$$;

grant execute on function public.create_maintenance_request(uuid, text, text, text) to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.maintenance_requests enable row level security;
alter table public.request_messages enable row level security;
alter table public.request_attachments enable row level security;

create policy "requests_tenant_select" on public.maintenance_requests
  for select using (tenant_id = auth.uid());

create policy "requests_tenant_insert" on public.maintenance_requests
  for insert with check (tenant_id = auth.uid() and public.is_tenant_of_unit(unit_id));

create policy "requests_landlord_select" on public.maintenance_requests
  for select using (landlord_id = auth.uid());

create policy "requests_landlord_update" on public.maintenance_requests
  for update using (landlord_id = auth.uid());

create policy "request_messages_select" on public.request_messages
  for select using (
    public.is_landlord_of_request(request_id) or public.is_tenant_of_request(request_id)
  );

create policy "request_messages_insert" on public.request_messages
  for insert with check (
    sender_id = auth.uid()
    and (public.is_landlord_of_request(request_id) or public.is_tenant_of_request(request_id))
  );

create policy "request_attachments_select" on public.request_attachments
  for select using (
    public.is_landlord_of_request(request_id) or public.is_tenant_of_request(request_id)
  );

create policy "request_attachments_insert" on public.request_attachments
  for insert with check (
    uploader_id = auth.uid()
    and (public.is_landlord_of_request(request_id) or public.is_tenant_of_request(request_id))
  );

-- ============================================================
-- Grants (tables created via CLI migration don't inherit Supabase's
-- dashboard-managed default grants — see the Phase 1/2 grants migrations).
-- ============================================================

grant select, insert, update, delete on
  public.maintenance_requests,
  public.request_messages,
  public.request_attachments
to authenticated, service_role;

-- ============================================================
-- Storage: private bucket for request photo/video attachments.
-- Object path convention: {request_id}/{uuid}-{filename}, so policies can
-- check access via the request_id embedded in the path without a join.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-attachments',
  'request-attachments',
  false,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do nothing;

create policy "request_attachments_storage_select" on storage.objects
  for select using (
    bucket_id = 'request-attachments'
    and (
      public.is_landlord_of_request(((storage.foldername(name))[1])::uuid)
      or public.is_tenant_of_request(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "request_attachments_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'request-attachments'
    and (
      public.is_landlord_of_request(((storage.foldername(name))[1])::uuid)
      or public.is_tenant_of_request(((storage.foldername(name))[1])::uuid)
    )
  );
