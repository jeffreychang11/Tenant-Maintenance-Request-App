-- Enforces the monthly message cap at insert time. Messages are inserted
-- directly from the client (components/chat/RequestConversation.tsx,
-- MessageThread.tsx via a raw supabase.from("request_messages").insert()),
-- with no server action/RPC in that path, so this has to live in Postgres.

-- Shared by both the trigger and the get_message_usage() read RPC below,
-- so the enforced cap and the displayed cap can never drift apart.
create or replace function public.effective_message_cap(p_landlord_id uuid)
returns table (tier text, base_cap int, buffer_cap int, bundle_cap int, effective_cap int)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tier text;
  v_status text;
  v_unit_count int;
  v_bundle_cap int;
begin
  select s.tier, s.status into v_tier, v_status
  from public.subscriptions s where s.landlord_id = p_landlord_id;

  -- Trial-only landlords (no real/active Stripe subscription) fall back to
  -- the tier their live unit count would imply — no unlimited-messaging
  -- loophole during the trial month.
  if v_tier is null or v_status is null or v_status not in ('trialing', 'active') then
    select count(*) into v_unit_count
    from public.units u
    join public.properties p on p.id = u.property_id
    where p.landlord_id = p_landlord_id;

    v_tier := case
      when v_unit_count between 1 and 3 then 'tier_1_3'
      when v_unit_count between 4 and 10 then 'tier_4_10'
      else null
    end;
  end if;

  if v_tier is null then
    return; -- no self-serve tier applies (0 units, or >10 on trial-only) — caller fails open
  end if;

  select coalesce(mu.bundle_messages_purchased, 0) into v_bundle_cap
  from public.message_usage mu
  where mu.landlord_id = p_landlord_id and mu.period_month = date_trunc('month', now())::date;
  v_bundle_cap := coalesce(v_bundle_cap, 0);

  return query select
    v_tier,
    case v_tier when 'tier_1_3' then 350 else 1000 end,
    case v_tier when 'tier_1_3' then 50 else 0 end,
    v_bundle_cap,
    (case v_tier when 'tier_1_3' then 350 + 50 else 1000 end) + v_bundle_cap;
end;
$$;

create or replace function public.check_message_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landlord_id uuid;
  v_period date := date_trunc('month', now())::date;
  v_cap record;
  v_used int;
begin
  -- A brand-new request's opening message is always allowed, even if the
  -- landlord is fully capped — a tenant can always report a new issue.
  -- The landlord's reply (and everything after) is still subject to the
  -- cap.
  if not exists (select 1 from public.request_messages where request_id = new.request_id) then
    return new;
  end if;

  select mr.landlord_id into v_landlord_id
  from public.maintenance_requests mr where mr.id = new.request_id;

  select * into v_cap from public.effective_message_cap(v_landlord_id);
  if v_cap is null then
    return new; -- fail open: no tier applies
  end if;

  insert into public.message_usage (landlord_id, period_month)
  values (v_landlord_id, v_period)
  on conflict (landlord_id, period_month) do nothing;

  select message_count into v_used
  from public.message_usage
  where landlord_id = v_landlord_id and period_month = v_period
  for update; -- serializes concurrent sends for this landlord this month

  if v_used >= v_cap.effective_cap then
    raise exception 'message_cap_exceeded';
  end if;

  update public.message_usage
  set message_count = message_count + 1
  where landlord_id = v_landlord_id and period_month = v_period;

  return new;
end;
$$;

create trigger enforce_message_cap
  before insert on public.request_messages
  for each row execute procedure public.check_message_cap();

-- Read-side counterpart for the UI (usage banner, usage page). auth.uid()
-- scoped by design — a landlord can only ever see their own usage.
create or replace function public.get_message_usage()
returns table (
  tier text,
  period_month date,
  messages_used int,
  base_cap int,
  buffer_cap int,
  bundle_cap int,
  effective_cap int,
  in_buffer_zone boolean,
  blocked boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_cap record;
  v_used int;
begin
  select * into v_cap from public.effective_message_cap(auth.uid());
  if v_cap is null then
    return query select null::text, date_trunc('month', now())::date, 0, 0, 0, 0, 0, false, false;
    return;
  end if;

  select coalesce(mu.message_count, 0) into v_used
  from public.message_usage mu
  where mu.landlord_id = auth.uid() and mu.period_month = date_trunc('month', now())::date;
  v_used := coalesce(v_used, 0);

  return query select
    v_cap.tier,
    date_trunc('month', now())::date,
    v_used,
    v_cap.base_cap,
    v_cap.buffer_cap,
    v_cap.bundle_cap,
    v_cap.effective_cap,
    (v_used > v_cap.base_cap),
    (v_used >= v_cap.effective_cap);
end;
$$;

grant execute on function public.get_message_usage() to authenticated;
