-- ELI-2: reusable organization roles and effective-permission union.

create table if not exists public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_key text not null check (role_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text,
  is_system boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,role_key)
);

create table if not exists public.organization_role_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_id uuid not null references public.organization_roles(id) on delete cascade,
  module_key text not null check (module_key = any(array[
    'core','full_suite','accounting','commerce','treasury','contracting','inventory','assets',
    'hr_payroll','office_automation','requests_workflow','crm','transport','manufacturing',
    'maintenance','group_consolidation','analytics'
  ]::text[])),
  capabilities text[] not null default array['read']::text[],
  scope_type text not null default 'own' check (scope_type in ('own','unit','branch','company','organization')),
  scope_id text,
  confidentiality_level smallint not null default 0 check (confidentiality_level between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (capabilities <@ array['read','create','edit','delete','approve','register','refer','archive','configure']::text[]),
  check (cardinality(capabilities)>0),
  check ((scope_type in ('own','organization') and scope_id is null) or (scope_type in ('unit','branch','company') and nullif(trim(scope_id),'') is not null)),
  unique nulls not distinct (organization_id,role_id,module_key,scope_type,scope_id)
);

create table if not exists public.organization_member_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.organization_members(id) on delete cascade,
  role_id uuid not null references public.organization_roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,member_id,role_id)
);

create index if not exists organization_roles_org_idx on public.organization_roles(organization_id,active,role_key);
create index if not exists organization_role_permissions_role_idx on public.organization_role_permissions(role_id,module_key);
create index if not exists organization_member_roles_member_idx on public.organization_member_roles(member_id,active);
create index if not exists organization_member_roles_role_idx on public.organization_member_roles(role_id,active);

alter table public.organization_roles enable row level security;
alter table public.organization_role_permissions enable row level security;
alter table public.organization_member_roles enable row level security;

grant select,insert,update,delete on public.organization_roles to authenticated;
grant select,insert,update,delete on public.organization_role_permissions to authenticated;
grant select,insert,update,delete on public.organization_member_roles to authenticated;

create policy organization_roles_select on public.organization_roles for select to authenticated
using (organization_id in (select private.current_organization_ids()));
create policy organization_roles_mutate_insert on public.organization_roles for insert to authenticated
with check (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));
create policy organization_roles_mutate_update on public.organization_roles for update to authenticated
using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'))
with check (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));
create policy organization_roles_mutate_delete on public.organization_roles for delete to authenticated
using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));

create policy organization_role_permissions_select on public.organization_role_permissions for select to authenticated
using (organization_id in (select private.current_organization_ids()));
create policy organization_role_permissions_mutate_insert on public.organization_role_permissions for insert to authenticated
with check (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));
create policy organization_role_permissions_mutate_update on public.organization_role_permissions for update to authenticated
using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'))
with check (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));
create policy organization_role_permissions_mutate_delete on public.organization_role_permissions for delete to authenticated
using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));

create policy organization_member_roles_select on public.organization_member_roles for select to authenticated
using (organization_id in (select private.current_organization_ids()));
create policy organization_member_roles_mutate_insert on public.organization_member_roles for insert to authenticated
with check (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));
create policy organization_member_roles_mutate_update on public.organization_member_roles for update to authenticated
using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'))
with check (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));
create policy organization_member_roles_mutate_delete on public.organization_member_roles for delete to authenticated
using (private.is_org_owner(organization_id) or private.has_org_capability(organization_id,'core','configure'));

create or replace function private.protect_system_organization_role()
returns trigger language plpgsql set search_path=''
as $$
begin
  if tg_op='DELETE' and old.is_system then
    raise exception 'system role cannot be deleted' using errcode='42501';
  end if;
  if tg_op='UPDATE' and old.is_system and (new.role_key<>old.role_key or not new.is_system) then
    raise exception 'system role identity is immutable' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

revoke all on function private.protect_system_organization_role() from public,anon,authenticated;
drop trigger if exists trg_protect_system_organization_role on public.organization_roles;
create trigger trg_protect_system_organization_role
before update or delete on public.organization_roles
for each row execute function private.protect_system_organization_role();

create or replace function private.role_permission_allowed(
  p_organization_id uuid,
  p_module_key text
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select case
    when p_module_key='core' then true
    when p_module_key='full_suite' then private.organization_has_module_entitlement(p_organization_id,'full_suite',false)
    else private.organization_has_module_entitlement(p_organization_id,p_module_key,false)
  end
$$;

revoke all on function private.role_permission_allowed(uuid,text) from public,anon;
grant execute on function private.role_permission_allowed(uuid,text) to authenticated;

create or replace function public.organization_upsert_role(
  p_organization_id uuid,
  p_role_key text,
  p_title text,
  p_description text default null,
  p_active boolean default true
)
returns uuid
language plpgsql security invoker set search_path=''
as $$
declare v_id uuid;
begin
  if not (private.is_org_owner(p_organization_id) or private.has_org_capability(p_organization_id,'core','configure')) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_role_key is null or p_role_key !~ '^[a-z][a-z0-9_]{1,63}$' then raise exception 'invalid role key'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'role title required'; end if;

  insert into public.organization_roles(organization_id,role_key,title,description,active,created_by)
  values(p_organization_id,p_role_key,trim(p_title),nullif(trim(p_description),''),coalesce(p_active,true),(select auth.uid()))
  on conflict(organization_id,role_key) do update
    set title=excluded.title,
        description=excluded.description,
        active=excluded.active,
        updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.organization_upsert_role(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.organization_upsert_role(uuid,text,text,text,boolean) to authenticated;

create or replace function public.organization_set_role_permission(
  p_organization_id uuid,
  p_role_id uuid,
  p_module_key text,
  p_capabilities text[],
  p_scope_type text default 'organization',
  p_scope_id text default null,
  p_confidentiality_level smallint default 0
)
returns uuid
language plpgsql security invoker set search_path=''
as $$
declare v_id uuid;
begin
  if not (private.is_org_owner(p_organization_id) or private.has_org_capability(p_organization_id,'core','configure')) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if not exists(select 1 from public.organization_roles r where r.id=p_role_id and r.organization_id=p_organization_id and r.active) then
    raise exception 'role not found';
  end if;
  if not private.role_permission_allowed(p_organization_id,p_module_key) then
    raise exception 'module not licensed' using errcode='42501';
  end if;

  insert into public.organization_role_permissions(
    organization_id,role_id,module_key,capabilities,scope_type,scope_id,confidentiality_level
  )
  values(
    p_organization_id,p_role_id,p_module_key,p_capabilities,p_scope_type,p_scope_id,p_confidentiality_level
  )
  on conflict(organization_id,role_id,module_key,scope_type,scope_id) do update
    set capabilities=excluded.capabilities,
        confidentiality_level=excluded.confidentiality_level,
        updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.organization_set_role_permission(uuid,uuid,text,text[],text,text,smallint) from public,anon;
grant execute on function public.organization_set_role_permission(uuid,uuid,text,text[],text,text,smallint) to authenticated;

create or replace function public.organization_assign_member_role(
  p_organization_id uuid,
  p_member_id uuid,
  p_role_id uuid,
  p_active boolean default true
)
returns uuid
language plpgsql security invoker set search_path=''
as $$
declare v_id uuid;
begin
  if not (private.is_org_owner(p_organization_id) or private.has_org_capability(p_organization_id,'core','configure')) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if not exists(select 1 from public.organization_members m where m.id=p_member_id and m.organization_id=p_organization_id and not m.is_owner) then
    raise exception 'member not found or owner role is implicit';
  end if;
  if not exists(select 1 from public.organization_roles r where r.id=p_role_id and r.organization_id=p_organization_id and r.active) then
    raise exception 'role not found';
  end if;

  insert into public.organization_member_roles(organization_id,member_id,role_id,assigned_by,active)
  values(p_organization_id,p_member_id,p_role_id,(select auth.uid()),coalesce(p_active,true))
  on conflict(organization_id,member_id,role_id) do update
    set active=excluded.active,assigned_by=(select auth.uid()),updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.organization_assign_member_role(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.organization_assign_member_role(uuid,uuid,uuid,boolean) to authenticated;

-- Role grants augment direct member grants. Commercial entitlement remains a separate gate.
create or replace function private.has_org_capability(p_organization_id uuid,p_module_key text,p_capability text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.organization_members m
    where m.organization_id=p_organization_id
      and m.user_id=(select auth.uid())
      and m.status='active'
      and (
        (p_module_key='core' and p_capability='read')
        or m.is_owner
        or exists(
          select 1 from public.member_module_permissions p
          where p.organization_id=p_organization_id and p.member_id=m.id
            and (p.module_key=p_module_key or p.module_key='full_suite')
            and p_capability=any(p.capabilities)
        )
        or exists(
          select 1
          from public.organization_member_roles mr
          join public.organization_roles r on r.id=mr.role_id and r.organization_id=mr.organization_id and r.active
          join public.organization_role_permissions rp on rp.role_id=r.id and rp.organization_id=r.organization_id
          where mr.organization_id=p_organization_id and mr.member_id=m.id and mr.active
            and (rp.module_key=p_module_key or rp.module_key='full_suite')
            and p_capability=any(rp.capabilities)
        )
      )
  )
$$;

create or replace function private.record_in_member_scope(p_organization_id uuid,p_module_key text,p_owner_id uuid,p_data jsonb,p_capability text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active'
      and (
        (p_module_key='core' and p_capability='read')
        or m.is_owner
        or exists(
          select 1 from (
            select p.scope_type,p.scope_id,p.module_key,p.capabilities
            from public.member_module_permissions p
            where p.organization_id=p_organization_id and p.member_id=m.id
            union all
            select rp.scope_type,rp.scope_id,rp.module_key,rp.capabilities
            from public.organization_member_roles mr
            join public.organization_roles r on r.id=mr.role_id and r.organization_id=mr.organization_id and r.active
            join public.organization_role_permissions rp on rp.role_id=r.id and rp.organization_id=r.organization_id
            where mr.organization_id=p_organization_id and mr.member_id=m.id and mr.active
          ) g
          where (g.module_key=p_module_key or g.module_key='full_suite')
            and p_capability=any(g.capabilities)
            and (
              g.scope_type='organization'
              or (g.scope_type='own' and p_owner_id=(select auth.uid()))
              or (g.scope_type='company' and g.scope_id=coalesce(p_data->>'companyId',p_data->>'company_id'))
              or (g.scope_type='branch' and g.scope_id=coalesce(p_data->>'branchId',p_data->>'branch_id'))
              or (g.scope_type='unit' and g.scope_id=coalesce(p_data->>'unitId',p_data->>'unit_id'))
            )
        )
      )
  )
$$;

create or replace function private.record_confidentiality_allowed(p_organization_id uuid,p_module_key text,p_data jsonb)
returns boolean
language sql stable security definer set search_path=''
as $$
  select case when p_module_key='core' then p_organization_id in (select private.current_organization_ids()) else exists(
    select 1 from public.organization_members m
    where m.organization_id=p_organization_id and m.user_id=(select auth.uid()) and m.status='active'
      and (
        m.is_owner
        or coalesce((
          select max(x.confidentiality_level)
          from (
            select p.confidentiality_level,p.module_key
            from public.member_module_permissions p
            where p.organization_id=p_organization_id and p.member_id=m.id
            union all
            select rp.confidentiality_level,rp.module_key
            from public.organization_member_roles mr
            join public.organization_roles r on r.id=mr.role_id and r.organization_id=mr.organization_id and r.active
            join public.organization_role_permissions rp on rp.role_id=r.id and rp.organization_id=r.organization_id
            where mr.organization_id=p_organization_id and mr.member_id=m.id and mr.active
          ) x
          where x.module_key=p_module_key or x.module_key='full_suite'
        ),-1) >= (
          case lower(coalesce(p_data->>'confidentiality','normal'))
            when 'محرمانه' then 1 when 'confidential' then 1
            when 'خیلی محرمانه' then 2 when 'very_confidential' then 2
            when 'سری' then 3 when 'secret' then 3 else 0 end
        )
      )
  ) end
$$;

-- Seed reusable starter roles. They grant nothing unless assigned.
insert into public.organization_roles(organization_id,role_key,title,description,is_system,active)
select o.id,x.role_key,x.title,x.description,true,true
from public.organizations o
cross join (values
  ('system_admin','مدیر سیستم سازمان','مدیریت ساختار و کاربران سازمان'),
  ('finance_manager','مدیر مالی','مدیریت و تأیید عملیات مالی'),
  ('accountant','حسابدار','ثبت و ویرایش عملیات حسابداری'),
  ('petty_cash','تنخواه‌گردان','عملیات پایه خزانه و تنخواه'),
  ('secretariat','کاربر دبیرخانه','ثبت، ارجاع و بایگانی مکاتبات'),
  ('viewer','مشاهده‌گر','نقش پایه مشاهده')
) as x(role_key,title,description)
on conflict(organization_id,role_key) do nothing;

insert into public.organization_role_permissions(organization_id,role_id,module_key,capabilities,scope_type,scope_id,confidentiality_level)
select r.organization_id,r.id,'core',array['read','configure']::text[],'organization',null,3
from public.organization_roles r where r.role_key='system_admin'
on conflict(organization_id,role_id,module_key,scope_type,scope_id) do nothing;

insert into public.organization_role_permissions(organization_id,role_id,module_key,capabilities,scope_type,scope_id,confidentiality_level)
select r.organization_id,r.id,'accounting',array['read','create','edit','approve']::text[],'organization',null,1
from public.organization_roles r
join public.licenses l on l.organization_id=r.organization_id
where r.role_key='finance_manager' and ('full_suite'=any(l.modules) or 'accounting'=any(l.modules))
on conflict(organization_id,role_id,module_key,scope_type,scope_id) do nothing;

insert into public.organization_role_permissions(organization_id,role_id,module_key,capabilities,scope_type,scope_id,confidentiality_level)
select r.organization_id,r.id,'treasury',array['read','create','edit','approve']::text[],'organization',null,1
from public.organization_roles r
join public.licenses l on l.organization_id=r.organization_id
where r.role_key='finance_manager' and ('full_suite'=any(l.modules) or 'treasury'=any(l.modules))
on conflict(organization_id,role_id,module_key,scope_type,scope_id) do nothing;

insert into public.organization_role_permissions(organization_id,role_id,module_key,capabilities,scope_type,scope_id,confidentiality_level)
select r.organization_id,r.id,'accounting',array['read','create','edit']::text[],'organization',null,0
from public.organization_roles r
join public.licenses l on l.organization_id=r.organization_id
where r.role_key='accountant' and ('full_suite'=any(l.modules) or 'accounting'=any(l.modules))
on conflict(organization_id,role_id,module_key,scope_type,scope_id) do nothing;

insert into public.organization_role_permissions(organization_id,role_id,module_key,capabilities,scope_type,scope_id,confidentiality_level)
select r.organization_id,r.id,'treasury',array['read','create']::text[],'organization',null,0
from public.organization_roles r
join public.licenses l on l.organization_id=r.organization_id
where r.role_key='petty_cash' and ('full_suite'=any(l.modules) or 'treasury'=any(l.modules))
on conflict(organization_id,role_id,module_key,scope_type,scope_id) do nothing;

insert into public.organization_role_permissions(organization_id,role_id,module_key,capabilities,scope_type,scope_id,confidentiality_level)
select r.organization_id,r.id,'office_automation',array['read','create','register','refer','archive']::text[],'organization',null,1
from public.organization_roles r
join public.licenses l on l.organization_id=r.organization_id
where r.role_key='secretariat' and ('full_suite'=any(l.modules) or 'office_automation'=any(l.modules))
on conflict(organization_id,role_id,module_key,scope_type,scope_id) do nothing;

insert into public.organization_role_permissions(organization_id,role_id,module_key,capabilities,scope_type,scope_id,confidentiality_level)
select r.organization_id,r.id,'core',array['read']::text[],'organization',null,0
from public.organization_roles r where r.role_key='viewer'
on conflict(organization_id,role_id,module_key,scope_type,scope_id) do nothing;

create or replace function private.organization_role_audit_capture()
returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_org uuid; v_id text;
begin
  v_org:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;
  v_id:=case when tg_op='DELETE' then old.id::text else new.id::text end;
  insert into public.organization_audit(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
  values(
    v_org,(select auth.uid()),lower(tg_table_name||'_'||tg_op),tg_table_name,v_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

revoke all on function private.organization_role_audit_capture() from public,anon,authenticated;

drop trigger if exists organization_roles_audit on public.organization_roles;
create trigger organization_roles_audit after insert or update or delete on public.organization_roles
for each row execute function private.organization_role_audit_capture();

drop trigger if exists organization_role_permissions_audit on public.organization_role_permissions;
create trigger organization_role_permissions_audit after insert or update or delete on public.organization_role_permissions
for each row execute function private.organization_role_audit_capture();

drop trigger if exists organization_member_roles_audit on public.organization_member_roles;
create trigger organization_member_roles_audit after insert or update or delete on public.organization_member_roles
for each row execute function private.organization_role_audit_capture();
