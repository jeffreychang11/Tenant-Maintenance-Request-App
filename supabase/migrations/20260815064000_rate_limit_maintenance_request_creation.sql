-- create_maintenance_request is called directly from the browser (client
-- calls the Supabase RPC, no Next.js server action in the path), so it
-- can't be throttled by the app-level Upstash rate limiter added alongside
-- this migration. Add an equivalent DB-side cap instead: a tenant can't
-- create more than 20 requests in a rolling hour. Generous for legitimate
-- use (filing several distinct issues in one sitting) while blocking a
-- scripted/compromised session from flooding a landlord's dashboard and
-- Storage usage.

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
  v_recent_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_tenant_of_unit(p_unit_id) then
    raise exception 'not authorized for this unit';
  end if;

  select count(*) into v_recent_count
  from public.maintenance_requests
  where tenant_id = auth.uid()
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 20 then
    raise exception 'You''ve submitted a lot of requests recently — please try again in a bit.';
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
