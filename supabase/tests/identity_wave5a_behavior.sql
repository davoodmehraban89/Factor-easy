\set ON_ERROR_STOP on
insert into auth.users(id,email,raw_user_meta_data) values('11111111-1111-1111-1111-111111111111','owner@example.com','{"full_name":"Owner One"}'::jsonb);
do $$
declare v_org uuid;
begin
 if not exists(select 1 from public.profiles where id='11111111-1111-1111-1111-111111111111' and email='owner@example.com') then raise exception 'profile bootstrap missing';end if;
 select id into v_org from public.organizations where owner_user_id='11111111-1111-1111-1111-111111111111';
 if v_org is null then raise exception 'personal organization bootstrap missing';end if;
 if not exists(select 1 from public.organization_members where organization_id=v_org and user_id='11111111-1111-1111-1111-111111111111' and status='active' and is_owner) then raise exception 'owner membership bootstrap missing';end if;
 if not exists(select 1 from public.licenses where user_id='11111111-1111-1111-1111-111111111111' and organization_id=v_org and plan='trial' and status='trial') then raise exception 'organization-bound trial license bootstrap missing';end if;
end $$;
do $$
begin
 begin
  insert into auth.users(id,email,raw_user_meta_data) values('22222222-2222-2222-2222-222222222222',null,'{}'::jsonb);
  raise exception 'email-less signup unexpectedly succeeded';
 exception when others then if position('requires an email identity' in sqlerrm)=0 then raise;end if;end;
 if exists(select 1 from public.profiles where id='22222222-2222-2222-2222-222222222222') then raise exception 'failed signup left partial profile state';end if;
end $$;
