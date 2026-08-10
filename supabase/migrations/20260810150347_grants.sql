-- Table-level GRANTs. RLS policies only take effect once a role already
-- has the underlying SQL privilege on a table — this project's tables were
-- created via CLI migrations rather than the dashboard table editor, so the
-- default anon/authenticated grants Supabase normally auto-applies weren't
-- present, and every authenticated query was failing with "permission
-- denied" before RLS was ever evaluated.

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on
  public.profiles,
  public.properties,
  public.units,
  public.tenant_units,
  public.tenant_invites
to authenticated;

-- Apply the same grants automatically to tables created by future
-- migrations, so this doesn't have to be repeated per-table.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
