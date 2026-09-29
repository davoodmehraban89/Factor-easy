create or replace function public.admin_extend_license(target uuid, days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if days is null or days < 1 or days > 3650 then raise exception 'invalid days'; end if;
  update public.licenses
     set ends_at = greatest(ends_at, current_date) + days,
         plan = case when plan = 'trial' then 'monthly' else plan end,
         status = 'active',
         updated_at = now()
   where user_id = target and plan <> 'lifetime';
  if not found then raise exception 'user not found or lifetime'; end if;
end $$;

create or replace function public.admin_cancel_license(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.licenses set status = 'cancelled', updated_at = now() where user_id = target;
  if not found then raise exception 'user not found'; end if;
end $$;

revoke all on function public.admin_extend_license(uuid,int) from public, anon;
revoke all on function public.admin_cancel_license(uuid) from public, anon;
grant execute on function public.admin_extend_license(uuid,int) to authenticated;
grant execute on function public.admin_cancel_license(uuid) to authenticated;\n