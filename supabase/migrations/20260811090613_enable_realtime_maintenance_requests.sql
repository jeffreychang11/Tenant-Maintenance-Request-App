-- Adds maintenance_requests to the supabase_realtime publication so the
-- landlord dashboard can subscribe to live status changes (e.g. marking a
-- request in progress/done on the detail page updating the property tile's
-- badge without a full page reload). Tables created outside the dashboard
-- aren't added to this publication automatically.
alter publication supabase_realtime add table public.maintenance_requests;
