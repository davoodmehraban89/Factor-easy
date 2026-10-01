-- Office Slice C8 / Task 1: versioned workflow policy publication and catalog.
-- Additive only. No correspondence state is changed by this migration.

create table if not exists private.office_workflow_policy_versions(
  organization_id uuid not null references public.organizations(id) on delete restrict,
  policy_key text not null,
  version integer not null check(version > 0),
  title text not null,
  definition jsonb not null,
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default clock_timestamp(),
  primary key(organization_id,policy_key,version),
  check(policy_key ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$'),
  check(char_length(btrim(title)) between 1 and 160)
);
alter table private.office_workflow_policy_versions enable row level security;
revoke all on private.office_workflow_policy_versions from public,anon,authenticated;

create or replace function private.office_workflow_policy_immutable()
returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  raise exception 'published workflow policy is immutable' using errcode='55000';
end $$;
revoke all on function private.office_workflow_policy_immutable() from public,anon,authenticated;

drop trigger if exists office_workflow_policy_immutable on private.office_workflow_policy_versions;
create trigger office_workflow_policy_immutable
before update or delete on private.office_workflow_policy_versions
for each row execute function private.office_workflow_policy_immutable();

create or replace function private.office_workflow_validate_definition(p_definition jsonb)
returns void
language plpgsql immutable security definer set search_path=''
as $$
declare
  v_stage_count integer;
  v_edge_count integer;
  v_start_id text;
  v_reachable integer;
  v_can_finish integer;
begin
  if p_definition is null or jsonb_typeof(p_definition) <> 'object' then raise exception 'workflow definition must be an object' using errcode='22023'; end if;
  if octet_length(p_definition::text) > 65536 then raise exception 'workflow definition exceeds 64 KiB' using errcode='22023'; end if;
  if p_definition - array['stages','edges']::text[] <> '{}'::jsonb or not (p_definition ? 'stages') or not (p_definition ? 'edges') or jsonb_typeof(p_definition->'stages') <> 'array' or jsonb_typeof(p_definition->'edges') <> 'array' then raise exception 'workflow definition keys are invalid' using errcode='22023'; end if;
  v_stage_count := jsonb_array_length(p_definition->'stages'); v_edge_count := jsonb_array_length(p_definition->'edges');
  if v_stage_count < 2 or v_stage_count > 20 then raise exception 'workflow requires 2 to 20 stages' using errcode='22023'; end if;
  if v_edge_count > 60 then raise exception 'workflow allows at most 60 edges' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_definition->'stages') s where jsonb_typeof(s) <> 'object' or s - array['id','label','start','terminal']::text[] <> '{}'::jsonb or not (s ?& array['id','label','start','terminal']) or jsonb_typeof(s->'id') <> 'string' or jsonb_typeof(s->'label') <> 'string' or jsonb_typeof(s->'start') <> 'boolean' or jsonb_typeof(s->'terminal') <> 'boolean' or coalesce(s->>'id','') !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' or char_length(btrim(coalesce(s->>'label',''))) not between 1 and 160) then raise exception 'invalid workflow stage' using errcode='22023'; end if;
  if (select count(*) from jsonb_array_elements(p_definition->'stages') s where (s->>'start')::boolean) <> 1 then raise exception 'workflow requires exactly one start stage' using errcode='22023'; end if;
  if (select count(*) from jsonb_array_elements(p_definition->'stages') s where (s->>'terminal')::boolean) < 1 then raise exception 'workflow requires a terminal stage' using errcode='22023'; end if;
  if (select count(distinct s->>'id') from jsonb_array_elements(p_definition->'stages') s) <> v_stage_count then raise exception 'workflow stage ids must be unique' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_definition->'edges') e where jsonb_typeof(e) <> 'object' or e - array['id','from','to','label','capability']::text[] <> '{}'::jsonb or not (e ?& array['id','from','to','label','capability']) or jsonb_typeof(e->'id') <> 'string' or jsonb_typeof(e->'from') <> 'string' or jsonb_typeof(e->'to') <> 'string' or jsonb_typeof(e->'label') <> 'string' or jsonb_typeof(e->'capability') <> 'string' or coalesce(e->>'id','') !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' or coalesce(e->>'from','') !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' or coalesce(e->>'to','') !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' or char_length(btrim(coalesce(e->>'label',''))) not between 1 and 160 or coalesce(e->>'capability','') not in ('edit','refer','approve')) then raise exception 'invalid workflow edge' using errcode='22023'; end if;
  if (select count(distinct e->>'id') from jsonb_array_elements(p_definition->'edges') e) <> v_edge_count then raise exception 'workflow edge ids must be unique' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_definition->'edges') e where e->>'from'=e->>'to') then raise exception 'workflow self edge is not allowed' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_definition->'edges') e where not exists(select 1 from jsonb_array_elements(p_definition->'stages') s where s->>'id'=e->>'from') or not exists(select 1 from jsonb_array_elements(p_definition->'stages') s where s->>'id'=e->>'to')) then raise exception 'workflow edge references unknown stage' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_definition->'edges') a join jsonb_array_elements(p_definition->'edges') b on a->>'id' <> b->>'id' and a->>'from'=b->>'from' and a->>'to'=b->>'to') then raise exception 'duplicate workflow edge is not allowed' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_definition->'stages') s where (s->>'terminal')::boolean and exists(select 1 from jsonb_array_elements(p_definition->'edges') e where e->>'from'=s->>'id')) then raise exception 'terminal stage cannot have outgoing edge' using errcode='22023'; end if;
  select s->>'id' into v_start_id from jsonb_array_elements(p_definition->'stages') s where (s->>'start')::boolean;
  with recursive reachable(id) as (select v_start_id union select e->>'to' from reachable r join jsonb_array_elements(p_definition->'edges') e on e->>'from'=r.id) select count(*) into v_reachable from reachable;
  if v_reachable <> v_stage_count then raise exception 'all workflow stages must be reachable from start' using errcode='22023'; end if;
  with recursive can_finish(id) as (select s->>'id' from jsonb_array_elements(p_definition->'stages') s where (s->>'terminal')::boolean union select e->>'from' from can_finish f join jsonb_array_elements(p_definition->'edges') e on e->>'to'=f.id) select count(distinct id) into v_can_finish from can_finish;
  if v_can_finish <> v_stage_count then raise exception 'every workflow stage must be able to reach a terminal stage' using errcode='22023'; end if;
end $$;
revoke all on function private.office_workflow_validate_definition(jsonb) from public,anon,authenticated;

create or replace function private.office_workflow_publish_impl(p_organization_id uuid,p_policy_key text,p_title text,p_definition jsonb) returns integer
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid()); v_key text := btrim(coalesce(p_policy_key,'')); v_title text := btrim(coalesce(p_title,'')); v_version integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_organization_id is null or p_organization_id not in (select private.current_organization_ids()) or not private.organization_has_module_entitlement(p_organization_id,'office_automation',true) or not private.has_org_capability(p_organization_id,'office_automation','configure') then raise exception 'workflow configure permission required' using errcode='42501'; end if;
  if v_key !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' then raise exception 'invalid policy key' using errcode='22023'; end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid policy title' using errcode='22023'; end if;
  perform private.office_workflow_validate_definition(p_definition);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':office-workflow:'||v_key,0));
  select coalesce(max(p.version),0)+1 into v_version from private.office_workflow_policy_versions p where p.organization_id=p_organization_id and p.policy_key=v_key;
  insert into private.office_workflow_policy_versions(organization_id,policy_key,version,title,definition,published_by,published_at) values(p_organization_id,v_key,v_version,v_title,p_definition,v_uid,clock_timestamp());
  return v_version;
end $$;
revoke all on function private.office_workflow_publish_impl(uuid,text,text,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.office_workflow_publish_impl(uuid,text,text,jsonb) to authenticated;

create or replace function public.office_workflow_publish(p_organization_id uuid,p_policy_key text,p_title text,p_definition jsonb) returns integer
language sql security invoker set search_path=''
as $$ select private.office_workflow_publish_impl(p_organization_id,p_policy_key,p_title,p_definition) $$;
revoke all on function public.office_workflow_publish(uuid,text,text,jsonb) from public,anon;
grant execute on function public.office_workflow_publish(uuid,text,text,jsonb) to authenticated;

create or replace function private.office_workflow_catalog_impl(p_organization_id uuid) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid()); v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_organization_id is null or p_organization_id not in (select private.current_organization_ids()) or not private.organization_has_module_entitlement(p_organization_id,'office_automation',false) or not private.has_org_capability(p_organization_id,'office_automation','read') then raise exception 'workflow catalog permission required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('policy_key',x.policy_key,'version',x.version,'title',x.title,'definition',x.definition) order by x.policy_key),'[]'::jsonb) into v_result from (select distinct on(p.policy_key) p.policy_key,p.version,p.title,p.definition from private.office_workflow_policy_versions p where p.organization_id=p_organization_id order by p.policy_key,p.version desc) x;
  return v_result;
end $$;
revoke all on function private.office_workflow_catalog_impl(uuid) from public,anon;
grant execute on function private.office_workflow_catalog_impl(uuid) to authenticated;

create or replace function public.office_workflow_catalog(p_organization_id uuid) returns jsonb
language sql stable security invoker set search_path=''
as $$ select private.office_workflow_catalog_impl(p_organization_id) $$;
revoke all on function public.office_workflow_catalog(uuid) from public,anon;
grant execute on function public.office_workflow_catalog(uuid) to authenticated;
