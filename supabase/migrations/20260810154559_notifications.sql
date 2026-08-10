-- Phase 5: push subscriptions + the notification_events outbox. DB
-- triggers enqueue rows here on the events that matter (new request, new
-- message, status change) so notification delivery is decoupled from the
-- user action that caused it — the action can never fail because a push
-- send or email hiccuped. Dispatch itself happens in application code
-- (see /api/notifications/process), not a DB-level webhook, since this
-- environment has no local Docker for Edge Function bundling.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('request_created', 'new_message', 'status_changed')),
  request_id uuid references public.maintenance_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  payload jsonb,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  push_status text not null default 'pending' check (push_status in ('pending', 'sent', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_notification_events_pending on public.notification_events(created_at)
  where email_status = 'pending' or push_status = 'pending';

-- ============================================================
-- Outbox triggers
-- ============================================================

create or replace function public.enqueue_request_created_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_events (type, request_id, actor_id, recipient_id, payload)
  values ('request_created', new.id, new.tenant_id, new.landlord_id, jsonb_build_object('title', new.title));
  return new;
end;
$$;

create trigger enqueue_request_created
  after insert on public.maintenance_requests
  for each row execute procedure public.enqueue_request_created_notification();

create or replace function public.enqueue_new_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_landlord_id uuid;
  v_recipient uuid;
begin
  select tenant_id, landlord_id into v_tenant_id, v_landlord_id
  from public.maintenance_requests where id = new.request_id;

  v_recipient := case when new.sender_id = v_tenant_id then v_landlord_id else v_tenant_id end;

  insert into public.notification_events (type, request_id, actor_id, recipient_id, payload)
  values ('new_message', new.request_id, new.sender_id, v_recipient, jsonb_build_object('body', new.body));
  return new;
end;
$$;

create trigger enqueue_new_message
  after insert on public.request_messages
  for each row execute procedure public.enqueue_new_message_notification();

create or replace function public.enqueue_status_changed_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notification_events (type, request_id, actor_id, recipient_id, payload)
    values ('status_changed', new.id, auth.uid(), new.tenant_id, jsonb_build_object('status', new.status));

    -- Also notify the landlord when the tenant is the one who reopened it.
    if new.status = 'reopened' and auth.uid() = new.tenant_id then
      insert into public.notification_events (type, request_id, actor_id, recipient_id, payload)
      values ('status_changed', new.id, auth.uid(), new.landlord_id, jsonb_build_object('status', new.status));
    end if;
  end if;
  return new;
end;
$$;

create trigger enqueue_status_changed
  after update of status on public.maintenance_requests
  for each row execute procedure public.enqueue_status_changed_notification();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.push_subscriptions enable row level security;
alter table public.notification_events enable row level security;

create policy "push_subscriptions_own" on public.push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- notification_events has no policies at all — fully inaccessible to
-- anon/authenticated, service_role only (dispatch runs with the admin
-- client, and outbox rows are written by security-definer triggers which
-- run as the table owner regardless of RLS).

grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;
grant select, insert, update, delete on public.notification_events to service_role;
