-- Disposable-DB reconstruction of the LIVE seat limiter (no production data).
create schema if not exists private;
create or replace function private.enforce_organization_member_seat()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_limit integer;v_active integer;
begin
  if new.status<>'active' then return new; end if;
  if tg_op='UPDATE' and old.status='active' and old.organization_id=new.organization_id then return new; end if;
  select l.max_users into v_limit
  from public.licenses l
  where l.organization_id=new.organization_id
  for update;
  if v_limit is null then raise exception 'organization license not found' using errcode='23503';end if;
  select count(*)::integer into v_active
  from public.organization_members m
  where m.organization_id=new.organization_id
    and m.status='active'
    and (tg_op='INSERT' or m.id<>new.id);
  if v_active>=v_limit then raise exception 'named-user seat limit exceeded' using errcode='23514';end if;
  return new;
end $$;
create trigger trg_organization_member_seat before insert or update of status,organization_id
on public.organization_members for each row execute function private.enforce_organization_member_seat();

-- Reproduce the exact initial failure while original Wave5a function is installed.
-- Nested exception scope rolls back every synthetic Auth/profile/org write.
do $$
begin
  begin
    insert into auth.users(id,email,raw_user_meta_data)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','before-fix@example.invalid','{"full_name":"Before Fix QA"}'::jsonb);
    raise exception 'expected pre-fix bootstrap to fail on missing license';
  exception when sqlstate '23503' then
    if position('organization license not found' in sqlerrm)=0 then raise;end if;
  end;
  if exists(select 1 from auth.users where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    or exists(select 1 from public.profiles where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    raise exception 'failed transaction left partial identity';
  end if;
end $$;
