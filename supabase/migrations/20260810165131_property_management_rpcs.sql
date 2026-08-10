-- Landlord property/tenant management: deleting a property (cascades to
-- everything under it, including Storage attachments, which aren't FK-linked
-- so wouldn't be cleaned up by the DB cascade alone) and removing a tenant
-- from a unit (so a new tenant can be invited when one moves out). Both run
-- security definer so the whole operation — including the FK cascade —
-- executes as the table owner rather than depending on RLS/grants existing
-- on every cascaded child table.

create or replace function public.delete_property(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.properties where id = p_property_id and landlord_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  delete from storage.objects
  where bucket_id = 'request-attachments'
    and (storage.foldername(name))[1]::uuid in (
      select mr.id
      from public.maintenance_requests mr
      join public.units u on u.id = mr.unit_id
      where u.property_id = p_property_id
    );

  delete from public.properties where id = p_property_id;
end;
$$;

grant execute on function public.delete_property(uuid) to authenticated;

create or replace function public.remove_tenant_from_unit(p_tenant_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
begin
  select unit_id into v_unit_id from public.tenant_units where id = p_tenant_unit_id;
  if v_unit_id is null then
    raise exception 'tenant link not found';
  end if;

  if not public.is_landlord_of_unit(v_unit_id) then
    raise exception 'not authorized';
  end if;

  update public.tenant_units
  set status = 'inactive', moved_out_at = now()
  where id = p_tenant_unit_id;
end;
$$;

grant execute on function public.remove_tenant_from_unit(uuid) to authenticated;
