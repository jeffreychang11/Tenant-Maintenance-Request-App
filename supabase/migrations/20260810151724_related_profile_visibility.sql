-- Landlords need to see their tenants' display names (unit tenant lists,
-- and later chat), and tenants need to see their landlord's name. Rather
-- than a blanket "any authenticated user can read any profile" policy,
-- scope visibility strictly to actual landlord-tenant relationships via an
-- active tenant_units link.

create policy "profiles_select_as_landlord_of_tenant" on public.profiles
  for select using (
    exists (
      select 1
      from public.tenant_units tu
      join public.units u on u.id = tu.unit_id
      join public.properties p on p.id = u.property_id
      where tu.tenant_id = profiles.id
        and tu.status = 'active'
        and p.landlord_id = auth.uid()
    )
  );

create policy "profiles_select_as_tenant_of_landlord" on public.profiles
  for select using (
    exists (
      select 1
      from public.tenant_units tu
      join public.units u on u.id = tu.unit_id
      join public.properties p on p.id = u.property_id
      where p.landlord_id = profiles.id
        and tu.tenant_id = auth.uid()
        and tu.status = 'active'
    )
  );
