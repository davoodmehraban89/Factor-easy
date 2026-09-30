alter function public.admin_cancel_license(uuid) set search_path = '';
alter function public.admin_extend_license(uuid, integer) set search_path = '';
alter function public.admin_set_company_limit(uuid, integer) set search_path = '';
alter function public.admin_set_license(uuid, text, integer, text) set search_path = '';
alter function public.admin_set_license_modules(uuid, text[]) set search_path = '';
alter function public.has_active_license() set search_path = '';
alter function public.is_admin() set search_path = '';

revoke execute on function public.admin_cancel_license(uuid) from public, anon;
revoke execute on function public.admin_extend_license(uuid, integer) from public, anon;
revoke execute on function public.admin_set_company_limit(uuid, integer) from public, anon;
revoke execute on function public.admin_set_license(uuid, text, integer, text) from public, anon;
revoke execute on function public.admin_set_license_modules(uuid, text[]) from public, anon;
revoke execute on function public.has_active_license() from public, anon;
revoke execute on function public.is_admin() from public, anon;

grant execute on function public.admin_cancel_license(uuid) to authenticated, service_role;
grant execute on function public.admin_extend_license(uuid, integer) to authenticated, service_role;
grant execute on function public.admin_set_company_limit(uuid, integer) to authenticated, service_role;
grant execute on function public.admin_set_license(uuid, text, integer, text) to authenticated, service_role;
grant execute on function public.admin_set_license_modules(uuid, text[]) to authenticated, service_role;
grant execute on function public.has_active_license() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
