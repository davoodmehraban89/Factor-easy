revoke execute on function public.has_active_license() from anon, public;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.has_active_license() to authenticated;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.admin_cancel_license(uuid) from anon, public;
revoke execute on function public.admin_extend_license(uuid, integer) from anon, public;
revoke execute on function public.admin_set_license(uuid, text, integer, text) from anon, public;
grant execute on function public.admin_cancel_license(uuid) to authenticated;
grant execute on function public.admin_extend_license(uuid, integer) to authenticated;
grant execute on function public.admin_set_license(uuid, text, integer, text) to authenticated;\n