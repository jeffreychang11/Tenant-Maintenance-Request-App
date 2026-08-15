-- Phase: landlord subscription billing (Stripe). One row per landlord,
-- created automatically at signup with a 1-month free trial — signup never
-- touches the Stripe API. A real Stripe Customer/Subscription only gets
-- attached the first time a landlord actually completes Checkout. Access
-- lock status is never stored; it's computed fresh from (trial_ends_at,
-- status) wherever it's needed (see lib/billing/subscription.ts).

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null unique references public.profiles(id) on delete cascade,

  -- Local trial tracking, set once at signup, never touched by Stripe.
  trial_ends_at timestamptz not null,

  -- Populated only once a real Stripe subscription exists (via webhook).
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  tier text check (tier in ('tier_1_3', 'tier_4_10')),
  billing_interval text check (billing_interval in ('month', 'year')),

  -- Raw Stripe subscription status, stored verbatim (not translated) so it
  -- can never drift out of sync with what Stripe actually thinks. Null
  -- means no Stripe subscription exists yet (still trial-only).
  status text check (status in (
    'trialing', 'active', 'past_due', 'canceled',
    'incomplete', 'incomplete_expired', 'unpaid'
  )),

  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_stripe_subscription_id
  on public.subscriptions(stripe_subscription_id);

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Landlord can read their own billing status. No insert/update/delete
-- policy: the initial row comes from the security-definer handle_new_user
-- trigger, and every later write comes from the Stripe webhook route or
-- the proration sync — both via the service-role admin client. Mirrors
-- notification_events' "no user-facing write policy" pattern.
create policy "subscriptions_select_own" on public.subscriptions
  for select using (landlord_id = auth.uid());

grant select, insert, update, delete on public.subscriptions to authenticated, service_role;

-- ============================================================
-- handle_new_user(): also seed a trial subscription row for landlords
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'tenant');

  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    v_role,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  );

  if v_role = 'landlord' then
    insert into public.subscriptions (landlord_id, trial_ends_at)
    values (new.id, now() + interval '1 month');
  end if;

  return new;
end;
$$;

-- Backfill: every landlord who already exists gets a fresh 1-month trial
-- starting from this deploy, rather than being permanently exempt — keeps
-- the access-status logic free of a "grandfathered" special case.
insert into public.subscriptions (landlord_id, trial_ends_at)
select p.id, now() + interval '1 month'
from public.profiles p
where p.role = 'landlord'
  and not exists (select 1 from public.subscriptions s where s.landlord_id = p.id);

-- ============================================================
-- update_request_status(): block a locked-out landlord from acting.
-- update_request_status is called directly from the browser (no Next.js
-- server action in that path), so this check has to live here rather than
-- in a JS guard. Tenants are never gated — this only touches the landlord
-- branch.
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

  if v_is_landlord and not exists (
    select 1 from public.subscriptions
    where landlord_id = auth.uid()
      and (
        status in ('trialing', 'active')
        or (status is null and trial_ends_at > now())
      )
  ) then
    raise exception 'subscription_required';
  end if;

  -- Tenants may reopen a done request, or resolve one themselves (mark
  -- complete / no longer needed) if it isn't done yet; landlords move
  -- freely through the rest of the lifecycle. A landlord who is also
  -- somehow the tenant (shouldn't happen in practice) gets the more
  -- permissive landlord path.
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
    if not (
      (v_current = 'done' and p_new_status = 'reopened')
      or (v_current in ('open', 'in_progress', 'reopened') and p_new_status = 'done')
    ) then
      raise exception 'tenants can only reopen a done request or mark an open one complete';
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
