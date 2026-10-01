-- Slice D1: versioned request definitions + server-authorized runtime.
-- Direct mutation is intentionally denied; writes go through RPCs with org RBAC checks.

create table if not exists public.request_type_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (char_length(trim(code)) between 1 and 64),
  title text not null check (char_length(trim(title)) between 1 and 160),
  category text,
  revision bigint not null default 1 check (revision > 0),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.request_type_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_type_id uuid not null references public.request_type_definitions(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  title text not null,
  category text,
  form_schema jsonb not null default '{}'::jsonb,
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique (request_type_id, version_no)
);

create table if not exists public.request_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_type_version_id uuid not null unique references public.request_type_versions(id) on delete restrict,
  workflow_schema jsonb not null default '{}'::jsonb,
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now()
);

create table if not exists public.request_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_type_version_id uuid not null references public.request_type_versions(id) on delete restrict,
  workflow_version_id uuid not null references public.request_workflow_versions(id) on delete restrict,
  requester_user_id uuid not null references public.profiles(id) on delete restrict,
  values_json jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('draft','submitted','approved','rejected','returned','cancelled')),
  revision bigint not null default 1 check (revision > 0),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.request_instance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_instance_id uuid not null references public.request_instances(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  from_status text,
  to_status text not null,
  revision bigint not null check (revision > 0),
  note text,
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists request_type_versions_org_type_idx on public.request_type_versions(organization_id, request_type_id, version_no desc);
create index if not exists request_workflow_versions_org_type_version_idx on public.request_workflow_versions(organization_id, request_type_version_id);
create index if not exists request_instances_org_status_idx on public.request_instances(organization_id, status, updated_at desc);
create index if not exists request_instance_events_instance_idx on public.request_instance_events(organization_id, request_instance_id, revision);

alter table public.request_type_definitions enable row level security;
alter table public.request_type_versions enable row level security;
alter table public.request_workflow_versions enable row level security;
alter table public.request_instances enable row level security;
alter table public.request_instance_events enable row level security;

grant select on public.request_type_definitions, public.request_type_versions, public.request_workflow_versions, public.request_instances, public.request_instance_events to authenticated;
revoke insert, update, delete on public.request_type_definitions, public.request_type_versions, public.request_workflow_versions, public.request_instances, public.request_instance_events from authenticated, anon, public;

drop policy if exists request_type_definitions_read on public.request_type_definitions;
create policy request_type_definitions_read on public.request_type_definitions for select to authenticated
using (organization_id in (select private.current_organization_ids()) and private.organization_has_module_entitlement(organization_id,'requests_workflow',false) and private.has_org_capability(organization_id,'requests_workflow','read'));

drop policy if exists request_type_versions_read on public.request_type_versions;
create policy request_type_versions_read on public.request_type_versions for select to authenticated
using (organization_id in (select private.current_organization_ids()) and private.organization_has_module_entitlement(organization_id,'requests_workflow',false) and private.has_org_capability(organization_id,'requests_workflow','read'));

drop policy if exists request_workflow_versions_read on public.request_workflow_versions;
create policy request_workflow_versions_read on public.request_workflow_versions for select to authenticated
using (organization_id in (select private.current_organization_ids()) and private.organization_has_module_entitlement(organization_id,'requests_workflow',false) and private.has_org_capability(organization_id,'requests_workflow','read'));

drop policy if exists request_instances_read on public.request_instances;
create policy request_instances_read on public.request_instances for select to authenticated
using (organization_id in (select private.current_organization_ids()) and private.organization_has_module_entitlement(organization_id,'requests_workflow',false) and (requester_user_id=(select auth.uid()) or private.has_org_capability(organization_id,'requests_workflow','approve') or private.has_org_capability(organization_id,'requests_workflow','edit')));

drop policy if exists request_instance_events_read on public.request_instance_events;
create policy request_instance_events_read on public.request_instance_events for select to authenticated
using (organization_id in (select private.current_organization_ids()) and private.organization_has_module_entitlement(organization_id,'requests_workflow',false) and exists(select 1 from public.request_instances r where r.id=request_instance_id and r.organization_id=request_instance_events.organization_id));

create or replace function public.request_publish_type_version(
  p_organization_id uuid,
  p_code text,
  p_title text,
  p_category text default null,
  p_form_schema jsonb default '{}'::jsonb,
  p_workflow_schema jsonb default '{}'::jsonb,
  p_expected_definition_revision bigint default null
) returns table(request_type_id uuid, request_type_version_id uuid, workflow_version_id uuid, version_no integer, definition_revision bigint)
language plpgsql security definer set search_path=''
as $$
declare
  v_def public.request_type_definitions%rowtype;
  v_type_version uuid;
  v_workflow_version uuid;
  v_version integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
  if not private.has_org_capability(p_organization_id,'requests_workflow','configure') then raise exception 'requests_workflow configure capability required' using errcode='42501'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_title),'') is null then raise exception 'code and title are required'; end if;
  if jsonb_typeof(coalesce(p_form_schema,'{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_workflow_schema,'{}'::jsonb)) <> 'object' then raise exception 'schemas must be JSON objects'; end if;

  select * into v_def from public.request_type_definitions d
  where d.organization_id=p_organization_id and d.code=upper(trim(p_code))
  for update;

  if not found then
    if p_expected_definition_revision is not null and p_expected_definition_revision <> 0 then raise exception 'stale definition revision'; end if;
    insert into public.request_type_definitions(organization_id,code,title,category,created_by)
    values(p_organization_id,upper(trim(p_code)),trim(p_title),nullif(trim(p_category),''),auth.uid()) returning * into v_def;
  else
    if p_expected_definition_revision is not null and p_expected_definition_revision <> v_def.revision then raise exception 'stale definition revision'; end if;
    update public.request_type_definitions set title=trim(p_title),category=nullif(trim(p_category),''),revision=revision+1,updated_at=now()
    where id=v_def.id returning * into v_def;
  end if;

  select coalesce(max(v.version_no),0)+1 into v_version from public.request_type_versions v where v.request_type_id=v_def.id;
  insert into public.request_type_versions(organization_id,request_type_id,version_no,title,category,form_schema,published_by)
  values(p_organization_id,v_def.id,v_version,v_def.title,v_def.category,coalesce(p_form_schema,'{}'::jsonb),auth.uid()) returning id into v_type_version;
  insert into public.request_workflow_versions(organization_id,request_type_version_id,workflow_schema,published_by)
  values(p_organization_id,v_type_version,coalesce(p_workflow_schema,'{}'::jsonb),auth.uid()) returning id into v_workflow_version;
  return query select v_def.id,v_type_version,v_workflow_version,v_version,v_def.revision;
end $$;

create or replace function public.request_create_instance(
  p_organization_id uuid,
  p_request_type_version_id uuid,
  p_values jsonb,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_existing uuid; v_workflow uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
  if not private.has_org_capability(p_organization_id,'requests_workflow','create') then raise exception 'requests_workflow create capability required' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_idempotency_key,''))) < 8 then raise exception 'idempotency_key is required'; end if;
  select id into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then return v_existing; end if;
  select w.id into v_workflow from public.request_workflow_versions w join public.request_type_versions v on v.id=w.request_type_version_id
    where w.organization_id=p_organization_id and v.organization_id=p_organization_id and v.id=p_request_type_version_id;
  if v_workflow is null then raise exception 'published request type version not found'; end if;
  insert into public.request_instances(organization_id,request_type_version_id,workflow_version_id,requester_user_id,values_json,status,revision,idempotency_key)
  values(p_organization_id,p_request_type_version_id,v_workflow,auth.uid(),coalesce(p_values,'{}'::jsonb),'submitted',1,p_idempotency_key) returning id into v_id;
  insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,idempotency_key)
  values(p_organization_id,v_id,auth.uid(),'create',null,'submitted',1,'create:'||p_idempotency_key);
  return v_id;
exception when unique_violation then
  select id into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  raise;
end $$;

create or replace function public.request_transition_instance(
  p_request_instance_id uuid,
  p_action text,
  p_expected_revision bigint,
  p_idempotency_key text,
  p_note text default null
) returns table(request_instance_id uuid, status text, revision bigint)
language plpgsql security definer set search_path=''
as $$
declare v_row public.request_instances%rowtype; v_next text; v_event public.request_instance_events%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select e.* into v_event from public.request_instance_events e join public.request_instances r on r.id=e.request_instance_id
    where e.request_instance_id=p_request_instance_id and e.idempotency_key=p_idempotency_key;
  if found then return query select p_request_instance_id,v_event.to_status,v_event.revision; return; end if;

  select * into v_row from public.request_instances r where r.id=p_request_instance_id for update;
  if not found then raise exception 'request instance not found'; end if;
  if v_row.organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(v_row.organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
  if not (private.has_org_capability(v_row.organization_id,'requests_workflow','approve') or private.has_org_capability(v_row.organization_id,'requests_workflow','edit')) then raise exception 'requests_workflow approve or edit capability required' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision <> v_row.revision then raise exception 'stale revision'; end if;
  if char_length(trim(coalesce(p_idempotency_key,''))) < 8 then raise exception 'idempotency_key is required'; end if;
  v_next := case lower(trim(p_action)) when 'approve' then 'approved' when 'reject' then 'rejected' when 'return' then 'returned' when 'submit' then 'submitted' when 'cancel' then 'cancelled' else null end;
  if v_next is null then raise exception 'unsupported transition action'; end if;
  if v_row.status in ('approved','rejected','cancelled') then raise exception 'terminal request cannot transition'; end if;
  update public.request_instances set status=v_next,revision=revision+1,updated_at=now() where id=v_row.id returning * into v_row;
  insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,note,idempotency_key)
  values(v_row.organization_id,v_row.id,auth.uid(),lower(trim(p_action)),v_row.status,v_next,v_row.revision,p_note,p_idempotency_key);
  return query select v_row.id,v_next,v_row.revision;
end $$;

revoke all on function public.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) from public,anon;
revoke all on function public.request_create_instance(uuid,uuid,jsonb,text) from public,anon;
revoke all on function public.request_transition_instance(uuid,text,bigint,text,text) from public,anon;
grant execute on function public.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) to authenticated;
grant execute on function public.request_create_instance(uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.request_transition_instance(uuid,text,bigint,text,text) to authenticated;
