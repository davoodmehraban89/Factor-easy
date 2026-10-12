\set ON_ERROR_STOP on
-- Wave5a behavior confirms the owner is provisioned with the trial license.
-- The additional checks ensure user-creation fix did not relax seat limits or privileges.
do $$
declare v_org uuid;v_member_count integer;
begin
  select id into strict v_org from public.organizations
  where owner_user_id='11111111-1111-1111-1111-111111111111';
  select count(*) into v_member_count from public.organization_members
  where organization_id=v_org and status='active';
  if v_member_count<>1 then raise exception 'unexpected initial owner count'; end if;
  if not exists(select 1 from public.licenses where organization_id=v_org and max_users=1) then
    raise exception 'license was not seeded before member enforcement';
  end if;
  if not exists(select 1 from public.profiles where id='11111111-1111-1111-1111-111111111111' and role='user') then
    raise exception 'initial account was elevated to admin';
  end if;
end $$;

-- A second identity receives its own one-seat trial; it must never join
-- the first organization as a second active named user.
insert into auth.users(id,email,raw_user_meta_data)
values('33333333-3333-3333-3333-333333333333','second@example.invalid','{"full_name":"Second QA"}'::jsonb);
do $$
declare v_org uuid;
begin
  select id into strict v_org from public.organizations
  where owner_user_id='11111111-1111-1111-1111-111111111111';
  begin
    insert into public.organization_members(organization_id,user_id,status,is_owner)
    values(v_org,'33333333-3333-3333-3333-333333333333','active',false);
    raise exception 'second active user illegally bypassed named seat limit';
  exception when sqlstate '23514' then
    if position('named-user seat limit exceeded' in sqlerrm)=0 then raise;end if;
  end;
  if exists(select 1 from public.organization_members where organization_id=v_org
        and user_id='33333333-3333-3333-3333-333333333333') then
    raise exception 'failed extra membership was inserted';
  end if;
end $$;

-- The currently deployed bootstrap permits authenticated phone-only identities.
insert into auth.users(id,email,phone,raw_user_meta_data)
values('44444444-4444-4444-4444-444444444444',null,'+989123456789','{"full_name":"Phone QA"}'::jsonb);
do $$
declare v_org uuid;
begin
  select id into strict v_org from public.organizations
  where owner_user_id='44444444-4444-4444-4444-444444444444';
  if not exists(select 1 from public.profiles where id='44444444-4444-4444-4444-444444444444' and phone='+989123456789' and role='user')
    or not exists(select 1 from public.licenses where organization_id=v_org and max_users=1 and status='trial')
    or not exists(select 1 from public.organization_members where organization_id=v_org
        and user_id='44444444-4444-4444-4444-444444444444' and status='active' and is_owner) then
      raise exception 'phone bootstrap regressed';
  end if;
end $$;
