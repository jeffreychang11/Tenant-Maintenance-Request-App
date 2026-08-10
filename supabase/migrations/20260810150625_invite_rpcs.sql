-- Phase 2: invite lookup + acceptance RPCs. These run security definer so
-- an unauthenticated visitor can resolve a token into display info, and so
-- acceptance can atomically validate + link + mark-accepted without ever
-- exposing tenant_invites rows via a direct table SELECT policy.

create or replace function public.get_invite_by_token(p_token text)
returns table (
  invite_id uuid,
  unit_id uuid,
  unit_label text,
  property_name text,
  email text,
  status text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select ti.id, ti.unit_id, u.label, p.name, ti.email, ti.status, ti.expires_at
  from public.tenant_invites ti
  join public.units u on u.id = ti.unit_id
  join public.properties p on p.id = u.property_id
  where ti.token = p_token;
$$;

create or replace function public.accept_invite(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_invite from public.tenant_invites where token = p_token for update;

  if not found then
    raise exception 'invite not found';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'invite is no longer valid';
  end if;

  if v_invite.expires_at < now() then
    update public.tenant_invites set status = 'expired' where id = v_invite.id;
    raise exception 'invite has expired';
  end if;

  select email into v_email from auth.users where id = v_uid;

  if v_email is null or lower(v_email) <> lower(v_invite.email) then
    raise exception 'this invite was sent to a different email address';
  end if;

  update public.profiles set role = 'tenant' where id = v_uid and role is distinct from 'tenant';

  insert into public.tenant_units (unit_id, tenant_id, status)
  values (v_invite.unit_id, v_uid, 'active')
  on conflict (unit_id, tenant_id) where status = 'active' do nothing;

  update public.tenant_invites
  set status = 'accepted', accepted_at = now(), accepted_by = v_uid
  where id = v_invite.id;
end;
$$;

grant execute on function public.get_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;
