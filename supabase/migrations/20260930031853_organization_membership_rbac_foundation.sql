create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid references public.organization_units(id) on delete set null,
  code text not null check (char_length(trim(code)) between 1 and 64),
  title text not null check (char_length(trim(title)) between 1 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id,code)
);
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid references public.organization_units(id) on delete set null,
  position_title text,
  status text not null default 'active' check (status in ('active','suspended','left')),
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,user_id)
);
create table public.member_module_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.organization_members(id) on delete cascade,
  module_key text not null check (module_key in ('full_suite','accounting','commerce','treasury','contracting','inventory','assets','hr_payroll','office_automation','requests_workflow','crm','transport','manufacturing','maintenance','group_consolidation','analytics')),
  capabilities text[] not null default array['read']::text[],
  scope_type text not null default 'own' check (scope_type in ('own','unit','branch','company','organization')),
  scope_id text,
  confidentiality_level smallint not null default 0 check (confidentiality_level between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (capabilities <@ array['read','create','edit','delete','approve','register','refer','archive','configure']::text[]),
  check (cardinality(capabilities)>0),
  check ((scope_type in ('own','organization') and scope_id is null) or (scope_type in ('unit','branch','company') and nullif(trim(scope_id),'') is not null)),
  unique nulls not distinct (organization_id,member_id,module_key,scope_type,scope_id)
);
create table public.organization_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.licenses add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.records add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
insert into public.organizations(owner_user_id,name)
select l.user_id,coalesce(nullif(trim(p.full_name),''),nullif(trim(p.username),''),'Finora Organization')
from public.licenses l join public.profiles p on p.id=l.user_id where l.organization_id is null;
update public.licenses l set organization_id=(select o.id from public.organizations o where o.owner_user_id=l.user_id order by o.created_at,o.id limit 1) where l.organization_id is null;
insert into public.organization_members(organization_id,user_id,status,is_owner,position_title)
select l.organization_id,l.user_id,'active',true,'مالک سازمان' from public.licenses l where l.organization_id is not null
on conflict (organization_id,user_id) do update set is_owner=true,status='active',updated_at=now();
update public.records r set organization_id=l.organization_id from public.licenses l where r.organization_id is null and l.user_id=r.owner_id;
do $$ begin
  if exists(select 1 from public.licenses where organization_id is null) then raise exception 'license organization backfill incomplete'; end if;
  if exists(select 1 from public.records where organization_id is null) then raise exception 'record organization backfill incomplete'; end if;
end $$;
alter table public.licenses alter column organization_id set not null;
alter table public.records alter column organization_id set not null;
create unique index licenses_organization_uq on public.licenses(organization_id);
create index organization_members_user_idx on public.organization_members(user_id,organization_id) where status='active';
create index organization_members_org_idx on public.organization_members(organization_id,user_id);
create index member_module_permissions_member_idx on public.member_module_permissions(member_id,module_key);
create index records_organization_collection_idx on public.records(organization_id,collection);
create index organization_audit_org_created_idx on public.organization_audit(organization_id,created_at desc);
alter table public.records drop constraint if exists records_pkey;
alter table public.records add constraint records_pkey primary key (organization_id,collection,id);
create or replace function private.current_organization_ids() returns setof uuid
language sql stable security definer set search_path='' as $$
  select m.organization_id from public.organization_members m where m.user_id=(select auth.uid()) and m.status='active'
$$;
create or replace function private.default_organization_id() returns uuid
language sql stable security definer set search_path='' as $$
  select m.organization_id from public.organization_members m where m.user_id=(select auth.uid()) and m.status='active' order by m.is_owner desc,m.created_at,m.organization_id limit 1
$$;
create or replace function private.is_org_owner(p_organization_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.is_owner)
$$;
create or replace function private.organization_has_module_entitlement(p_organization_id uuid,p_module_key text,p_require_active boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
  select case when p_module_key='core' and not p_require_active then true else exists(
    select 1 from public.licenses l where l.organization_id=p_organization_id
      and (p_module_key='core' or 'full_suite'=any(l.modules) or p_module_key=any(l.modules))
      and (not p_require_active or (l.status in ('trial','active') and (l.plan='lifetime' or l.ends_at >= (now() at time zone 'Asia/Tehran')::date)))
  ) end
$$;
create or replace function private.has_org_capability(p_organization_id uuid,p_module_key text,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active' and (m.is_owner or exists(select 1 from public.member_module_permissions p where p.organization_id=p_organization_id and p.member_id=m.id and (p.module_key=p_module_key or p.module_key='full_suite') and p_capability=any(p.capabilities))))
$$;
create or replace function private.record_in_member_scope(p_organization_id uuid,p_module_key text,p_owner_id uuid,p_data jsonb,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active' and (m.is_owner or exists(select 1 from public.member_module_permissions p where p.organization_id=p_organization_id and p.member_id=m.id and (p.module_key=p_module_key or p.module_key='full_suite') and p_capability=any(p.capabilities) and (p.scope_type='organization' or (p.scope_type='own' and p_owner_id=(select auth.uid())) or (p.scope_type='company' and p.scope_id=coalesce(p_data->>'companyId',p_data->>'company_id')) or (p.scope_type='branch' and p.scope_id=coalesce(p_data->>'branchId',p_data->>'branch_id')) or (p.scope_type='unit' and p.scope_id=coalesce(p_data->>'unitId',p_data->>'unit_id'))))))
$$;
create or replace function private.record_confidentiality_allowed(p_organization_id uuid,p_module_key text,p_data jsonb) returns boolean
language sql stable security definer set search_path='' as $$
  with required as (select case lower(coalesce(p_data->>'confidentiality','normal')) when 'محرمانه' then 1 when 'confidential' then 1 when 'خیلی محرمانه' then 2 when 'very_confidential' then 2 when 'سری' then 3 when 'secret' then 3 else 0 end as lvl)
  select exists(select 1 from public.organization_members m,required r where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active' and (m.is_owner or coalesce((select max(p.confidentiality_level) from public.member_module_permissions p where p.organization_id=p_organization_id and p.member_id=m.id and (p.module_key=p_module_key or p.module_key='full_suite')),-1)>=r.lvl))
$$;
create or replace function private.can_access_record(p_organization_id uuid,p_collection text,p_owner_id uuid,p_data jsonb,p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_organization_id in (select private.current_organization_ids()) and private.organization_has_module_entitlement(p_organization_id,private.collection_module(p_collection),false) and private.has_org_capability(p_organization_id,private.collection_module(p_collection),p_capability) and private.record_in_member_scope(p_organization_id,private.collection_module(p_collection),p_owner_id,p_data,p_capability) and private.record_confidentiality_allowed(p_organization_id,private.collection_module(p_collection),p_data)
$$;
create or replace function private.has_any_configure(p_organization_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_org_owner(p_organization_id) or exists(select 1 from public.organization_members m join public.member_module_permissions p on p.member_id=m.id and p.organization_id=m.organization_id where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active' and 'configure'=any(p.capabilities))
$$;
revoke all on function private.current_organization_ids() from public,anon;
revoke all on function private.default_organization_id() from public,anon;
revoke all on function private.is_org_owner(uuid) from public,anon;
revoke all on function private.organization_has_module_entitlement(uuid,text,boolean) from public,anon;
revoke all on function private.has_org_capability(uuid,text,text) from public,anon;
revoke all on function private.record_in_member_scope(uuid,text,uuid,jsonb,text) from public,anon;
revoke all on function private.record_confidentiality_allowed(uuid,text,jsonb) from public,anon;
revoke all on function private.can_access_record(uuid,text,uuid,jsonb,text) from public,anon;
revoke all on function private.has_any_configure(uuid) from public,anon;
grant execute on function private.current_organization_ids() to authenticated;
grant execute on function private.default_organization_id() to authenticated;
grant execute on function private.is_org_owner(uuid) to authenticated;
grant execute on function private.organization_has_module_entitlement(uuid,text,boolean) to authenticated;
grant execute on function private.has_org_capability(uuid,text,text) to authenticated;
grant execute on function private.record_in_member_scope(uuid,text,uuid,jsonb,text) to authenticated;
grant execute on function private.record_confidentiality_allowed(uuid,text,jsonb) to authenticated;
grant execute on function private.can_access_record(uuid,text,uuid,jsonb,text) to authenticated;
grant execute on function private.has_any_configure(uuid) to authenticated;
create or replace function private.has_module_entitlement(module_key text) returns boolean
language sql stable security definer set search_path='' as $$
  select case when module_key='core' then true else exists(select 1 from private.current_organization_ids() org_id where private.organization_has_module_entitlement(org_id,module_key,false)) end
$$;
create or replace function public.has_active_license() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.current_organization_ids() org_id where private.organization_has_module_entitlement(org_id,'core',true))
$$;
alter table public.organizations enable row level security;
alter table public.organization_units enable row level security;
alter table public.organization_members enable row level security;
alter table public.member_module_permissions enable row level security;
alter table public.organization_audit enable row level security;
grant select on public.organizations to authenticated;
grant select on public.organization_units to authenticated;
grant insert,update,delete on public.organization_units to authenticated;
grant select on public.organization_members to authenticated;
grant insert,update on public.organization_members to authenticated;
grant select on public.member_module_permissions to authenticated;
grant insert,update,delete on public.member_module_permissions to authenticated;
grant select on public.organization_audit to authenticated;
create policy organizations_select on public.organizations for select to authenticated using (id in (select private.current_organization_ids()));
create policy organization_units_select on public.organization_units for select to authenticated using (organization_id in (select private.current_organization_ids()));
create policy organization_units_insert on public.organization_units for insert to authenticated with check (private.is_org_owner(organization_id));
create policy organization_units_update on public.organization_units for update to authenticated using (private.is_org_owner(organization_id)) with check (private.is_org_owner(organization_id));
create policy organization_units_delete on public.organization_units for delete to authenticated using (private.is_org_owner(organization_id));
create policy organization_members_select on public.organization_members for select to authenticated using (organization_id in (select private.current_organization_ids()));
create policy organization_members_insert on public.organization_members for insert to authenticated with check (private.is_org_owner(organization_id));
create policy organization_members_update on public.organization_members for update to authenticated using (private.is_org_owner(organization_id)) with check (private.is_org_owner(organization_id));
create policy member_module_permissions_select on public.member_module_permissions for select to authenticated using (organization_id in (select private.current_organization_ids()));
create policy member_module_permissions_insert on public.member_module_permissions for insert to authenticated with check (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,module_key,'configure'));
create policy member_module_permissions_update on public.member_module_permissions for update to authenticated using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,module_key,'configure')) with check (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,module_key,'configure'));
create policy member_module_permissions_delete on public.member_module_permissions for delete to authenticated using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,module_key,'configure'));
create policy organization_audit_select on public.organization_audit for select to authenticated using (private.is_org_owner(organization_id) or private.has_any_configure(organization_id));
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.organization_members target where target.user_id=public.profiles.id and target.organization_id in (select private.current_organization_ids())));
drop policy if exists licenses_select on public.licenses;
create policy licenses_select on public.licenses for select to authenticated using (user_id=(select auth.uid()) or organization_id in (select private.current_organization_ids()) or public.is_admin());
drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;
create policy records_select on public.records for select to authenticated using (private.can_access_record(organization_id,collection,owner_id,data,'read'));
create policy records_insert on public.records for insert to authenticated with check (private.organization_has_module_entitlement(organization_id,private.collection_module(collection),true) and (private.can_access_record(organization_id,collection,owner_id,data,'create') or (collection='correspondence' and private.can_access_record(organization_id,collection,owner_id,data,'register')) or (collection='correspondenceReferrals' and private.can_access_record(organization_id,collection,owner_id,data,'refer'))));
create policy records_update on public.records for update to authenticated using (private.organization_has_module_entitlement(organization_id,private.collection_module(collection),true) and (private.can_access_record(organization_id,collection,owner_id,data,'edit') or (collection='officeRegistries' and private.can_access_record(organization_id,collection,owner_id,data,'register')))) with check (private.organization_has_module_entitlement(organization_id,private.collection_module(collection),true) and (private.can_access_record(organization_id,collection,owner_id,data,'edit') or (collection='officeRegistries' and private.can_access_record(organization_id,collection,owner_id,data,'register'))));
create policy records_delete on public.records for delete to authenticated using (private.organization_has_module_entitlement(organization_id,private.collection_module(collection),true) and private.can_access_record(organization_id,collection,owner_id,data,'delete'));
create or replace function public.finora_sync_records(p_upserts jsonb default '[]'::jsonb,p_deletes jsonb default '[]'::jsonb,p_organization_id uuid default null) returns void
language plpgsql security invoker set search_path='' as $$
declare v_org uuid:=coalesce(p_organization_id,private.default_organization_id());
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if v_org is null or v_org not in (select private.current_organization_ids()) then raise exception 'organization membership required' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(v_org,'core',true) then raise exception 'active license required' using errcode='42501'; end if;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) as x(collection text,id text,data jsonb) where not private.organization_has_module_entitlement(v_org,private.collection_module(x.collection),true)) or exists(select 1 from jsonb_to_recordset(coalesce(p_deletes,'[]'::jsonb)) as d(collection text,id text) where not private.organization_has_module_entitlement(v_org,private.collection_module(d.collection),true)) then raise exception 'module entitlement required' using errcode='42501'; end if;
  insert into public.records(organization_id,owner_id,collection,id,data) select v_org,(select auth.uid()),x.collection,x.id,x.data from jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) as x(collection text,id text,data jsonb) on conflict (organization_id,collection,id) do update set data=excluded.data;
  delete from public.records r using jsonb_to_recordset(coalesce(p_deletes,'[]'::jsonb)) as d(collection text,id text) where r.organization_id=v_org and r.collection=d.collection and r.id=d.id;
end $$;
revoke all on function public.finora_sync_records(jsonb,jsonb,uuid) from public,anon;
grant execute on function public.finora_sync_records(jsonb,jsonb,uuid) to authenticated;
create or replace function private.organization_audit_capture() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_action text; v_entity text; v_entity_id text;
begin
  v_org:=coalesce(new.organization_id,old.organization_id);
  v_action:='permission_'||lower(tg_op);
  v_entity:='member_module_permission';
  v_entity_id:=coalesce(new.id,old.id)::text;
  insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
  values(v_org,(select auth.uid()),v_action,v_entity,v_entity_id,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.organization_audit_capture() from public,anon,authenticated;
create trigger member_module_permissions_audit after insert or update or delete on public.member_module_permissions for each row execute function private.organization_audit_capture();
create or replace function private.organization_audit_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'organization audit is immutable' using errcode='42501'; end $$;
revoke all on function private.organization_audit_immutable() from public,anon,authenticated;
create trigger organization_audit_immutable before update or delete on public.organization_audit for each row execute function private.organization_audit_immutable();