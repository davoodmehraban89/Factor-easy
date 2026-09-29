revoke all on function public.admin_set_company_limit(uuid, integer) from public, anon;
grant execute on function public.admin_set_company_limit(uuid, integer) to authenticated;
