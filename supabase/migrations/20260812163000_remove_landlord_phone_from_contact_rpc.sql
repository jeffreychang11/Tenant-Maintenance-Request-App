-- The app's whole premise is that tenant<->landlord communication stays
-- inside the platform, not on the landlord's personal phone. Landlord
-- phone numbers are now collected at signup (for the landlord's own
-- account settings, developer support, and future SMS alerts), but must
-- never be handed to a tenant — drop it from what a tenant can read via
-- the "Contact Landlord" RPC. Return type changes, so this needs a drop +
-- recreate rather than create-or-replace.

drop function if exists public.get_landlord_contact(uuid);

create function public.get_landlord_contact(p_unit_id uuid)
returns table (full_name text, email text)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, u.email
  from public.units un
  join public.properties pr on pr.id = un.property_id
  join public.profiles p on p.id = pr.landlord_id
  join auth.users u on u.id = pr.landlord_id
  where un.id = p_unit_id
    and public.is_tenant_of_unit(p_unit_id);
$$;

grant execute on function public.get_landlord_contact(uuid) to authenticated;
