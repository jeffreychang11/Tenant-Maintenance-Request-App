-- Collects the tenant's phone number at invite-signup time (passed through
-- auth signUp metadata, same path full_name already uses) and lets the
-- landlord read a tenant's contact info (email lives only in auth.users,
-- same reason get_landlord_contact exists for the reverse direction).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'tenant'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

create or replace function public.get_tenant_contact(p_tenant_id uuid)
returns table (full_name text, phone text, email text)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, p.phone, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_tenant_id
    and exists (
      select 1
      from public.tenant_units tu
      join public.units un on un.id = tu.unit_id
      join public.properties pr on pr.id = un.property_id
      where tu.tenant_id = p_tenant_id
        and tu.status = 'active'
        and pr.landlord_id = auth.uid()
    );
$$;

grant execute on function public.get_tenant_contact(uuid) to authenticated;
