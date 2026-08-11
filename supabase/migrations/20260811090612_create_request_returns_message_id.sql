-- The landlord's request detail page now needs to associate the initial
-- photo/video attachments with the specific chat message they belong to
-- (so they render inside that message's bubble once the thread becomes a
-- real chat), rather than only knowing the request_id. Change
-- create_maintenance_request to return both ids instead of just request_id.

drop function if exists public.create_maintenance_request(uuid, text, text, text);

create or replace function public.create_maintenance_request(
  p_unit_id uuid,
  p_title text,
  p_description text,
  p_category text
)
returns table (request_id uuid, message_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_message_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_tenant_of_unit(p_unit_id) then
    raise exception 'not authorized for this unit';
  end if;

  insert into public.maintenance_requests (unit_id, tenant_id, title, description, category)
  values (p_unit_id, auth.uid(), p_title, p_description, p_category)
  returning id into v_request_id;

  insert into public.request_messages (request_id, sender_id, body)
  values (v_request_id, auth.uid(), p_description)
  returning id into v_message_id;

  return query select v_request_id, v_message_id;
end;
$$;

grant execute on function public.create_maintenance_request(uuid, text, text, text) to authenticated;
