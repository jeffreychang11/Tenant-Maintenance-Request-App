-- Monthly chat-message caps, tied to subscription tier (Basic/Premium,
-- still stored as tier_1_3/tier_4_10 — see lib/stripe/plans.ts for the
-- display-only rename). One row per landlord per calendar month,
-- incrementally maintained by the enforcement trigger added in the next
-- migration rather than computed by scanning request_messages history,
-- since that table has no landlord_id of its own.

create table public.message_usage (
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  period_month date not null,             -- always the 1st of the month
  message_count int not null default 0,   -- landlord + tenant combined
  bundle_messages_purchased int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (landlord_id, period_month)
);

create trigger set_message_usage_updated_at
  before update on public.message_usage
  for each row execute procedure public.set_updated_at();

alter table public.message_usage enable row level security;

create policy "message_usage_select_own" on public.message_usage
  for select using (landlord_id = auth.uid());

grant select, insert, update, delete on public.message_usage to authenticated, service_role;

-- Append-only ledger of completed $5/200-message bundle purchases
-- (Premium only). Exists purely so the Stripe webhook can be idempotent —
-- a replayed checkout.session.completed event fails the unique constraint
-- on stripe_checkout_session_id instead of double-crediting the landlord.
create table public.message_bundle_purchases (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  period_month date not null,
  stripe_checkout_session_id text not null unique,
  message_count int not null default 200,
  amount_cents int not null default 500,
  created_at timestamptz not null default now()
);

alter table public.message_bundle_purchases enable row level security;

create policy "message_bundle_purchases_select_own" on public.message_bundle_purchases
  for select using (landlord_id = auth.uid());

grant select, insert, update, delete on public.message_bundle_purchases to authenticated, service_role;
