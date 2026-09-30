create table if not exists private.correspondence_template_versions(
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null,
  version integer not null check(version>0),
  name text not null,
  subject_template text not null default '',
  body_template text not null default '',
  active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(organization_id,template_key,version),
  check(template_key ~ '^[A-Z0-9_-]{2,64}$'),
  check(length(name) between 1 and 160),
  check(length(subject_template)<=500),
  check(length(body_template)<=200000)
);
revoke all on private.correspondence_template_versions from public,anon,authenticated;

create or replace function private.office_create_template_version_impl(
  p_organization_id uuid,p_template_key text,p_name text,p_subject_template text,p_body_template text,p_active boolean
) returns integer
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_key text:=upper(trim(coalesce(p_template_key,''))); v_name text:=trim(coalesce(p_name,'')); v_version integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'office_automation',true)
     or not private.has_org_capability(p_organization_id,'office_automation','configure')
  then raise exception 'template configure permission required' using errcode='42501'; end if;
  if v_key !~ '^[A-Z0-9_-]{2,64}$' then raise exception 'invalid template key' using errcode='22023'; end if;
  if length(v_name) not between 1 and 160 then raise exception 'invalid template name' using errcode='22023'; end if;
  if length(coalesce(p_subject_template,''))>500 or length(coalesce(p_body_template,''))>200000
  then raise exception 'template content too long' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':office-template:'||v_key,0));
  select coalesce(max(t.version),0)+1 into v_version from private.correspondence_template_versions t
  where t.organization_id=p_organization_id and t.template_key=v_key;
  insert into private.correspondence_template_versions(
    organization_id,template_key,version,name,subject_template,body_template,active,created_by,created_at
  ) values(p_organization_id,v_key,v_version,v_name,coalesce(p_subject_template,''),coalesce(p_body_template,''),coalesce(p_active,true),v_uid,clock_timestamp());
  return v_version;
end $$;
revoke all on function private.office_create_template_version_impl(uuid,text,text,text,text,boolean) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.office_create_template_version_impl(uuid,text,text,text,text,boolean) to authenticated;

create or replace function public.office_create_template_version(
  p_organization_id uuid,p_template_key text,p_name text,p_subject_template text,p_body_template text,p_active boolean default true
) returns integer language sql security invoker set search_path=''
as $$ select private.office_create_template_version_impl(p_organization_id,p_template_key,p_name,p_subject_template,p_body_template,p_active) $$;
revoke all on function public.office_create_template_version(uuid,text,text,text,text,boolean) from public,anon;
grant execute on function public.office_create_template_version(uuid,text,text,text,text,boolean) to authenticated;

create or replace function private.office_template_catalog_impl(p_organization_id uuid,p_include_inactive boolean)
returns table(template_key text,version integer,name text,subject_template text,body_template text,active boolean,created_by uuid,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
  select x.template_key,x.version,x.name,x.subject_template,x.body_template,x.active,x.created_by,x.created_at
  from (
    select distinct on(t.template_key) t.template_key,t.version,t.name,t.subject_template,t.body_template,t.active,t.created_by,t.created_at
    from private.correspondence_template_versions t
    where t.organization_id=p_organization_id
    order by t.template_key,t.version desc
  ) x
  where (p_include_inactive or x.active)
    and (select auth.uid()) is not null
    and p_organization_id in (select private.current_organization_ids())
    and private.organization_has_module_entitlement(p_organization_id,'office_automation',false)
    and private.has_org_capability(p_organization_id,'office_automation','read')
  order by x.name,x.template_key
$$;
revoke all on function private.office_template_catalog_impl(uuid,boolean) from public,anon;
grant execute on function private.office_template_catalog_impl(uuid,boolean) to authenticated;

create or replace function public.office_template_catalog(p_organization_id uuid,p_include_inactive boolean default false)
returns table(template_key text,version integer,name text,subject_template text,body_template text,active boolean,created_by uuid,created_at timestamptz)
language sql stable security invoker set search_path=''
as $$ select * from private.office_template_catalog_impl(p_organization_id,p_include_inactive) $$;
revoke all on function public.office_template_catalog(uuid,boolean) from public,anon;
grant execute on function public.office_template_catalog(uuid,boolean) to authenticated;

create or replace function private.office_template_version_exists(p_organization_id uuid,p_template_key text,p_version integer)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from private.correspondence_template_versions t where t.organization_id=p_organization_id and t.template_key=upper(trim(p_template_key)) and t.version=p_version) $$;
revoke all on function private.office_template_version_exists(uuid,text,integer) from public,anon;
grant execute on function private.office_template_version_exists(uuid,text,integer) to authenticated;

create or replace function public.office_register_correspondence(
  p_id text,p_registry_id text,p_payload jsonb,p_organization_id uuid default null
) returns text
language plpgsql security invoker set search_path=''
as $$
declare
  v_org uuid:=coalesce(p_organization_id,private.default_organization_id()); v_uid uuid:=(select auth.uid());
  registry_row public.records%rowtype; next_no integer; prefix text; assigned text;
  v_template_key text:=nullif(trim(coalesce(p_payload->>'templateKey','')),''); v_template_version integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if v_org is null or not private.organization_has_module_entitlement(v_org,'office_automation',true)
     or not private.has_org_capability(v_org,'office_automation','register')
  then raise exception 'forbidden' using errcode='42501'; end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid correspondence id' using errcode='22023'; end if;
  if p_registry_id is null or p_registry_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid registry id' using errcode='22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid payload' using errcode='22023'; end if;
  if v_template_key is not null or p_payload ? 'templateVersion' then
    if v_template_key is null or coalesce(p_payload->>'templateVersion','') !~ '^[1-9][0-9]*$'
    then raise exception 'invalid template provenance' using errcode='22023'; end if;
    v_template_version:=(p_payload->>'templateVersion')::integer;
    if not private.office_template_version_exists(v_org,v_template_key,v_template_version)
    then raise exception 'template version not found in organization' using errcode='42501'; end if;
  end if;
  select * into registry_row from public.records r where r.organization_id=v_org and r.collection='officeRegistries' and r.id=p_registry_id for update;
  if not found then raise exception 'registry not found' using errcode='42501'; end if;
  next_no:=greatest(1,coalesce(nullif(registry_row.data->>'nextNumber','')::integer,1));
  prefix:=trim(coalesce(registry_row.data->>'prefix',''));
  assigned:=case when prefix='' then next_no::text else prefix||'-'||next_no::text end;
  update public.records set data=jsonb_set(registry_row.data,'{nextNumber}',to_jsonb(next_no+1),true)
  where organization_id=v_org and collection='officeRegistries' and id=p_registry_id;
  insert into public.records(organization_id,owner_id,collection,id,data)
  values(v_org,v_uid,'correspondence',p_id,p_payload||jsonb_build_object('registryId',p_registry_id,'registerNumber',assigned,'status','registered','registeredAt',clock_timestamp()))
  on conflict(organization_id,collection,id) do update
  set owner_id=excluded.owner_id,data=case when public.records.data->>'status'='registered' then public.records.data else excluded.data end;
  return assigned;
end $$;
revoke all on function public.office_register_correspondence(text,text,jsonb,uuid) from public,anon;
grant execute on function public.office_register_correspondence(text,text,jsonb,uuid) to authenticated;
