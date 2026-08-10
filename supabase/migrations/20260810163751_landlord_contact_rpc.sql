-- Lets a tenant look up their landlord's contact info (email lives only in
-- auth.users by design, not duplicated into profiles) for the "contact
-- landlord" entry in the tenant nav menu. Security definer so it can read
-- auth.users; access is still gated by is_tenant_of_unit so a tenant can
-- only resolve contact info for a landlord of a unit they're actually
-- linked to.

create or replace function public.get_landlord_contact(p_unit_id uuid)
returns table (full_name text, phone text, email text)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, p.phone, u.email
  from public.units un
  join public.properties pr on pr.id = un.property_id
  join public.profiles p on p.id = pr.landlord_id
  join auth.users u on u.id = pr.landlord_id
  where un.id = p_unit_id
    and public.is_tenant_of_unit(p_unit_id);
$$;

grant execute on function public.get_landlord_contact(uuid) to authenticated;
