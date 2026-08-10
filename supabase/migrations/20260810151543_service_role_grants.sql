-- service_role is meant to bypass RLS entirely (it's used by admin/backend
-- code — Edge Functions, this app's admin client), but it still needs the
-- underlying SQL grant on each table, same as authenticated did. Tables
-- created via CLI migration don't get Supabase's usual dashboard-managed
-- default grants, so this was missing for service_role too.

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.profiles,
  public.properties,
  public.units,
  public.tenant_units,
  public.tenant_invites
to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
