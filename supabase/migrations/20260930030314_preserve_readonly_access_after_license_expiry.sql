create or replace function private.has_module_entitlement(module_key text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when module_key = 'core' then true
    else exists (
      select 1 from public.licenses l
      where l.user_id = (select auth.uid())
        and ('full_suite' = any(l.modules) or module_key = any(l.modules))
    )
  end
$$;