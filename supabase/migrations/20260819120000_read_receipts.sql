-- Read receipts: let each party of a request see the OTHER party's
-- request_reads row (previously select was self-only, since request_reads
-- existed only to drive each user's own unread-dot badge). There are only
-- ever two rows per request (landlord + tenant), so widening this to "any
-- party of the request" is equivalent to "the other party" from either
-- viewer's perspective.
drop policy "request_reads_select" on public.request_reads;

create policy "request_reads_select" on public.request_reads
  for select using (
    public.is_landlord_of_request(request_id) or public.is_tenant_of_request(request_id)
  );

-- Needed so the chat UI can subscribe to the other party's read-state
-- live (a "Read" receipt appearing the moment they open the thread)
-- instead of only reflecting it after a reload.
alter publication supabase_realtime add table public.request_reads;
