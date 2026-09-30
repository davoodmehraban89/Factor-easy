-- ELI-1: enterprise named-user seats + delegated organization administration.
-- Additive migration. Does not rewrite accounting history or tenant identities.

alter table public.licenses
  add column if not exists max_users integer not null default 1,
  add column if not exists limits jsonb not null default '{}'::jsonb;

alter table public.licenses drop constraint if exists licenses_max_users_check;
alter table public.licenses add constraint licenses_max_users_check check (max_users between 1 and 100000);

alter table public.licenses drop constraint if exists licenses_limits_object_check;
alter table public.licenses add constraint licenses_limits_object_check check (jsonb_typeof(limits)='object');

update public.licenses l
set max_users = greatest(
  l.max_users,
  coalesce((
    select count(*)::integer
    from public.organization_members m
    where m.organization_id=l.organization_id and m.status='active'
  ),0),
  1
);

alter table public.member_module_permissions
  drop constraint if exists member_module_permissions_module_key_check;
alter table public.member_module_permissions
  add constraint member_module_permissions_module_key_check
  check (module_key = any(array[
    'core','full_suite','accounting','commerce','treasury','contracting','inventory','assets',
    'hr_payroll','office_automation','requests_workflow','crm','transport','manufacturing',
    'maintenance','group_consolidation','analytics'
  ]::text[]));

create or replace function private.organization_active_member_count(p_organization_id uuid)
returns integer
language sql stable security definer set search_path=''
as $$
  select count(*)::integer
  from public.organization_members m
  where m.organization_id=p_organization_id and m.status='active'
$$;

create or replace function private.organization_has_seat(
  p_organization_id uuid,
  p_excluding_member uuid default null
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select coalesce((
    select (
      select count(*)
      from public.organization_members m
      where m.organization_id=p_organization_id
        and m.status='active'
        and (p_excluding_member is null or m.id<>p_excluding_member)
    ) < l.max_users
    from public.licenses l
    where l.organization_id=p_organization_id
  ), false)
$$;

revoke all on function private.organization_active_member_count(uuid) from public,anon;
revoke all on function private.organization_has_seat(uuid,uuid) from public,anon;
grant execute on function private.organization_active_member_count(uuid) to authenticated;
grant execute on function private.organization_has_seat(uuid,uuid) to authenticated;

create or replace function private.enforce_organization_member_seat()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_limit integer; v_active integer;
begin
  if new.status<>'active' then return new; end if;
  if tg_op='UPDATE' and old.status='active' and old.organization_id=new.organization_id then return new; end if;

  select l.max_users into v_limit
  from public.licenses l
  where l.organization_id=new.organization_id
  for update;

  if v_limit is null then
    raise exception 'organization license not found' using errcode='23503';
  end if;

  select count(*)::integer into v_active
  from public.organization_members m
  where m.organization_id=new.organization_id
    and m.status='active'
    and (tg_op='INSERT' or m.id<>new.id);

  if v_active >= v_limit then
    raise exception 'named-user seat limit exceeded' using errcode='23514';
  end if;
  return new;
end $$;

revoke all on function private.enforce_organization_member_seat() from public,anon,authenticated;

drop trigger if exists trg_organization_member_seat on public.organization_members;
create trigger trg_organization_member_seat
before insert or update of status,organization_id on public.organization_members
for each row execute function private.enforce_organization_member_seat();

create or replace function public.admin_set_user_limit(target uuid,new_max_users integer)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_active integer;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if new_max_users is null or new_max_users<1 or new_max_users>100000 then raise exception 'invalid user limit'; end if;

  select l.organization_id into v_org
  from public.licenses l where l.user_id=target
  for update;
  if v_org is null then raise exception 'user/license not found'; end if;

  select count(*)::integer into v_active
  from public.organization_members m
  where m.organization_id=v_org and m.status='active';

  if new_max_users<v_active then raise exception 'user limit below active member count'; end if;

  update public.licenses
  set max_users=new_max_users,updated_at=now()
  where user_id=target;
end $$;

revoke all on function public.admin_set_user_limit(uuid,integer) from public,anon;
grant execute on function public.admin_set_user_limit(uuid,integer) to authenticated,service_role;

create or replace function public.admin_set_company_limit(target uuid,new_max_companies integer)
returns void
language plpgsql security definer set search_path=''
as $$
declare v_org uuid; existing_count integer;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if new_max_companies is null or new_max_companies<1 or new_max_companies>1000 then raise exception 'invalid company limit'; end if;

  select l.organization_id into v_org
  from public.licenses l where l.user_id=target
  for update;
  if v_org is null then raise exception 'user/license not found'; end if;

  select count(*)::integer into existing_count
  from public.records r
  where r.organization_id=v_org and r.collection='companies';

  if existing_count>new_max_companies then raise exception 'company limit below existing company count'; end if;

  update public.licenses
  set max_companies=new_max_companies,updated_at=now()
  where user_id=target;
end $$;

alter function public.admin_set_company_limit(uuid,integer) set search_path='';
revoke all on function public.admin_set_company_limit(uuid,integer) from public,anon;
grant execute on function public.admin_set_company_limit(uuid,integer) to authenticated,service_role;

create or replace function public.finora_enforce_company_license_limit()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare allowed_count integer; actual_count integer;
begin
  if new.collection<>'companies' then return new; end if;

  select l.max_companies into allowed_count
  from public.licenses l
  where l.organization_id=new.organization_id
  for update;

  if allowed_count is null then raise exception 'organization license not found' using errcode='23503'; end if;

  select count(*)::integer into actual_count
  from public.records r
  where r.organization_id=new.organization_id and r.collection='companies';

  if actual_count>allowed_count then
    raise exception 'company license limit exceeded' using errcode='23514';
  end if;
  return new;
end $$;

revoke all on function public.finora_enforce_company_license_limit() from public,anon,authenticated;

create or replace function public.organization_add_member(
  p_organization_id uuid,
  p_email text,
  p_unit_id uuid default null,
  p_position_title text default null
)
returns uuid
language plpgsql security invoker set search_path=''
as $$
declare v_user uuid; v_member uuid;
begin
  if not (
    private.is_org_owner(p_organization_id)
    or private.has_org_capability(p_organization_id,'core','configure')
  ) then raise exception 'forbidden' using errcode='42501'; end if;

  v_user:=private.profile_id_by_email(p_email);
  if v_user is null then raise exception 'Finora user not found for email'; end if;

  if p_unit_id is not null and not exists(
    select 1 from public.organization_units u
    where u.id=p_unit_id and u.organization_id=p_organization_id and u.active
  ) then raise exception 'invalid organization unit'; end if;

  insert into public.organization_members(organization_id,user_id,unit_id,position_title,status,is_owner)
  values(p_organization_id,v_user,p_unit_id,nullif(trim(p_position_title),''),'active',false)
  on conflict(organization_id,user_id) do update
    set unit_id=excluded.unit_id,
        position_title=excluded.position_title,
        status='active',
        updated_at=now()
    where not public.organization_members.is_owner
  returning id into v_member;

  if v_member is null then raise exception 'owner membership cannot be replaced'; end if;
  return v_member;
end $$;

revoke all on function public.organization_add_member(uuid,text,uuid,text) from public,anon;
grant execute on function public.organization_add_member(uuid,text,uuid,text) to authenticated;

create or replace function public.organization_set_member_status(
  p_organization_id uuid,
  p_member_id uuid,
  p_status text
)
returns void
language plpgsql security invoker set search_path=''
as $$
begin
  if p_status not in ('active','suspended','left') then raise exception 'invalid member status'; end if;
  if not (
    private.is_org_owner(p_organization_id)
    or private.has_org_capability(p_organization_id,'core','configure')
  ) then raise exception 'forbidden' using errcode='42501'; end if;

  update public.organization_members m
  set status=p_status,updated_at=now()
  where m.id=p_member_id and m.organization_id=p_organization_id and not m.is_owner;

  if not found then raise exception 'member not found or owner status is protected'; end if;
end $$;

revoke all on function public.organization_set_member_status(uuid,uuid,text) from public,anon;
grant execute on function public.organization_set_member_status(uuid,uuid,text) to authenticated;

create or replace function public.organization_set_member_permission(
  p_organization_id uuid,
  p_member_id uuid,
  p_module_key text,
  p_capabilities text[],
  p_scope_type text default 'own',
  p_scope_id text default null,
  p_confidentiality_level smallint default 0
)
returns uuid
language plpgsql security invoker set search_path=''
as $$
declare v_id uuid; v_allowed boolean:=false;
begin
  if p_module_key='core' then
    v_allowed:=private.is_org_owner(p_organization_id)
      or private.has_org_capability(p_organization_id,'core','configure');
  elsif p_module_key='full_suite' then
    v_allowed:=private.is_org_owner(p_organization_id)
      and private.organization_has_module_entitlement(p_organization_id,'full_suite',false);
  else
    v_allowed:=(private.is_org_owner(p_organization_id)
      or private.has_org_capability(p_organization_id,p_module_key,'configure'))
      and private.organization_has_module_entitlement(p_organization_id,p_module_key,false);
  end if;

  if not v_allowed then raise exception 'forbidden' using errcode='42501'; end if;

  if not exists(
    select 1 from public.organization_members m
    where m.id=p_member_id and m.organization_id=p_organization_id and not m.is_owner
  ) then raise exception 'member not found or owner permission is implicit'; end if;

  insert into public.member_module_permissions(
    organization_id,member_id,module_key,capabilities,scope_type,scope_id,confidentiality_level
  )
  values(
    p_organization_id,p_member_id,p_module_key,p_capabilities,p_scope_type,p_scope_id,p_confidentiality_level
  )
  on conflict(organization_id,member_id,module_key,scope_type,scope_id) do update
    set capabilities=excluded.capabilities,
        confidentiality_level=excluded.confidentiality_level,
        updated_at=now()
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.organization_set_member_permission(uuid,uuid,text,text[],text,text,smallint) from public,anon;
grant execute on function public.organization_set_member_permission(uuid,uuid,text,text[],text,text,smallint) to authenticated;

drop policy if exists organization_units_insert on public.organization_units;
drop policy if exists organization_units_update on public.organization_units;
drop policy if exists organization_units_delete on public.organization_units;
create policy organization_units_insert on public.organization_units for insert to authenticated
with check (
  private.is_org_owner(organization_id)
  or private.has_org_capability(organization_id,'core','configure')
);
create policy organization_units_update on public.organization_units for update to authenticated
using (
  private.is_org_owner(organization_id)
  or private.has_org_capability(organization_id,'core','configure')
)
with check (
  private.is_org_owner(organization_id)
  or private.has_org_capability(organization_id,'core','configure')
);
create policy organization_units_delete on public.organization_units for delete to authenticated
using (
  private.is_org_owner(organization_id)
  or private.has_org_capability(organization_id,'core','configure')
);

drop policy if exists organization_members_insert on public.organization_members;
drop policy if exists organization_members_update on public.organization_members;
create policy organization_members_insert on public.organization_members for insert to authenticated
with check (
  not is_owner
  and (
    private.is_org_owner(organization_id)
    or private.has_org_capability(organization_id,'core','configure')
  )
);
create policy organization_members_update on public.organization_members for update to authenticated
using (
  not is_owner
  and (
    private.is_org_owner(organization_id)
    or private.has_org_capability(organization_id,'core','configure')
  )
)
with check (
  not is_owner
  and (
    private.is_org_owner(organization_id)
    or private.has_org_capability(organization_id,'core','configure')
  )
);

create or replace function private.organization_audit_capture()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_action text; v_entity text; v_entity_id text;
begin
  if tg_table_name='member_module_permissions' then
    v_org:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;
    v_action:='permission_'||lower(tg_op);
    v_entity:='member_module_permission';
    v_entity_id:=case when tg_op='DELETE' then old.id::text else new.id::text end;
  elsif tg_table_name='organization_members' then
    v_org:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;
    v_action:='membership_'||lower(tg_op);
    v_entity:='organization_member';
    v_entity_id:=case when tg_op='DELETE' then old.id::text else new.id::text end;
  elsif tg_table_name='records' then
    v_org:=new.organization_id;
    v_action:='referral_insert';
    v_entity:='correspondence_referral';
    v_entity_id:=new.id;
  else
    if tg_op='DELETE' then return old; else return new; end if;
  end if;

  insert into public.organization_audit(
    organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data
  )
  values(
    v_org,(select auth.uid()),v_action,v_entity,v_entity_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  if tg_op='DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists organization_members_audit on public.organization_members;
create trigger organization_members_audit
after insert or update on public.organization_members
for each row execute function private.organization_audit_capture();

-- Existing member-module and referral audit triggers continue to use the replaced capture function.
