-- Adds request_messages to the supabase_realtime publication so the chat
-- thread can subscribe to live inserts. Tables created outside the
-- dashboard aren't added to this publication automatically.
alter publication supabase_realtime add table public.request_messages;
