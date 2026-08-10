-- Phase 4: status transition history, the update_request_status RPC that
-- enforces the transition table, an activity-bump trigger for new
-- messages, and per-user read tracking for unread badges.

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid not null references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index idx_request_status_history_request_id_created_at
  on public.request_status_history(request_id, created_at);

create table public.request_reads (
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

-- ============================================================
-- Triggers
-- ============================================================

-- History is recorded by a trigger (not just the RPC below) so it can
-- never drift from the actual column value, even under a future direct
-- DB edit or admin tool.
create or replace function public.record_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.request_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger record_maintenance_request_status_change
  after update of status on public.maintenance_requests
  for each row execute procedure public.record_status_change();

create or replace function public.bump_request_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.maintenance_requests set last_activity_at = now() where id = new.request_id;
  return new;
end;
$$;

create trigger bump_activity_on_message
  after insert on public.request_messages
  for each row execute procedure public.bump_request_activity();

-- ============================================================
-- Status transition RPC
-- ============================================================

create or replace function public.update_request_status(
  p_request_id uuid,
  p_new_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_is_landlord boolean;
  v_is_tenant boolean;
begin
  select status into v_current from public.maintenance_requests where id = p_request_id;
  if v_current is null then
    raise exception 'request not found';
  end if;

  v_is_landlord := public.is_landlord_of_request(p_request_id);
  v_is_tenant := public.is_tenant_of_request(p_request_id);

  if not (v_is_landlord or v_is_tenant) then
    raise exception 'not authorized';
  end if;

  -- Tenants may only reopen a done request; landlords move freely through
  -- the rest of the lifecycle. A landlord who is also somehow the tenant
  -- (shouldn't happen in practice) gets the more permissive landlord path.
  if v_is_landlord then
    if not (
      (v_current = 'open' and p_new_status in ('in_progress', 'done'))
      or (v_current = 'in_progress' and p_new_status in ('open', 'done'))
      or (v_current = 'done' and p_new_status = 'reopened')
      or (v_current = 'reopened' and p_new_status in ('in_progress', 'done'))
    ) then
      raise exception 'invalid status transition from % to %', v_current, p_new_status;
    end if;
  elsif v_is_tenant then
    if not (v_current = 'done' and p_new_status = 'reopened') then
      raise exception 'tenants can only reopen a done request';
    end if;
  end if;

  update public.maintenance_requests
  set status = p_new_status, last_activity_at = now()
  where id = p_request_id;

  if p_note is not null then
    update public.request_status_history
    set note = p_note
    where id = (
      select id from public.request_status_history
      where request_id = p_request_id and to_status = p_new_status
      order by created_at desc
      limit 1
    );
  end if;
end;
$$;

grant execute on function public.update_request_status(uuid, text, text) to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.request_status_history enable row level security;
alter table public.request_reads enable row level security;

create policy "request_status_history_select" on public.request_status_history
  for select using (
    public.is_landlord_of_request(request_id) or public.is_tenant_of_request(request_id)
  );

create policy "request_reads_select" on public.request_reads
  for select using (user_id = auth.uid());

create policy "request_reads_insert" on public.request_reads
  for insert with check (
    user_id = auth.uid()
    and (public.is_landlord_of_request(request_id) or public.is_tenant_of_request(request_id))
  );

create policy "request_reads_update" on public.request_reads
  for update using (user_id = auth.uid());

grant select, insert, update, delete on
  public.request_status_history,
  public.request_reads
to authenticated, service_role;
