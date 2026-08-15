-- Lets a tenant mark their own request complete (or "no longer needed"),
-- in case the landlord fixed it in person and forgot to update the status.
-- Previously tenants could only reopen a done request.

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

-- Mirrors the existing tenant-reopened case: notify the landlord too, not
-- just the (self-)acting tenant, when the tenant is the one marking the
-- request done.
create or replace function public.enqueue_status_changed_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notification_events (type, request_id, actor_id, recipient_id, payload)
    values ('status_changed', new.id, auth.uid(), new.tenant_id, jsonb_build_object('status', new.status));

    -- Also notify the landlord when the tenant is the one who changed it
    -- (reopened it, or resolved it themselves).
    if new.status in ('reopened', 'done') and auth.uid() = new.tenant_id then
      insert into public.notification_events (type, request_id, actor_id, recipient_id, payload)
      values ('status_changed', new.id, auth.uid(), new.landlord_id, jsonb_build_object('status', new.status));
    end if;
  end if;
  return new;
end;
$$;
