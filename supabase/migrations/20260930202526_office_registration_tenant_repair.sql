drop function if exists public.office_register_correspondence(text,text,jsonb);

create or replace function public.office_register_correspondence(
  p_id text,
  p_registry_id text,
  p_payload jsonb,
  p_organization_id uuid default null
) returns text
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_org uuid:=coalesce(p_organization_id,private.default_organization_id());
  v_uid uuid:=(select auth.uid());
  registry_row public.records%rowtype;
  next_no integer;
  prefix text;
  assigned text;
  v_template_key text:=nullif(trim(coalesce(p_payload->>'templateKey','')),'');
  v_template_version integer;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if v_org is null
     or not private.organization_has_module_entitlement(v_org,'office_automation',true)
     or not private.has_org_capability(v_org,'office_automation','register')
  then raise exception 'forbidden' using errcode='42501'; end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid correspondence id' using errcode='22023'; end if;
  if p_registry_id is null or p_registry_id !~ '^[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid registry id' using errcode='22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid payload' using errcode='22023'; end if;

  if v_template_key is not null or p_payload ? 'templateVersion' then
    if v_template_key is null or coalesce(p_payload->>'templateVersion','') !~ '^[1-9][0-9]*$'
    then raise exception 'invalid template provenance' using errcode='22023'; end if;
    v_template_version:=(p_payload->>'templateVersion')::integer;
    if not exists(
      select 1 from public.records t
      where t.organization_id=v_org
        and t.collection='correspondenceTemplates'
        and t.data->>'templateKey'=v_template_key
        and (t.data->>'version')::integer=v_template_version
    ) then raise exception 'template version not found in organization' using errcode='42501'; end if;
  end if;

  select * into registry_row
  from public.records r
  where r.organization_id=v_org and r.collection='officeRegistries' and r.id=p_registry_id
  for update;
  if not found then raise exception 'registry not found' using errcode='42501'; end if;

  next_no:=greatest(1,coalesce(nullif(registry_row.data->>'nextNumber','')::integer,1));
  prefix:=trim(coalesce(registry_row.data->>'prefix',''));
  assigned:=case when prefix='' then next_no::text else prefix||'-'||next_no::text end;

  update public.records
  set data=jsonb_set(registry_row.data,'{nextNumber}',to_jsonb(next_no+1),true)
  where organization_id=v_org and collection='officeRegistries' and id=p_registry_id;

  insert into public.records(organization_id,owner_id,collection,id,data)
  values(v_org,v_uid,'correspondence',p_id,
    p_payload || jsonb_build_object(
      'registryId',p_registry_id,'registerNumber',assigned,'status','registered','registeredAt',clock_timestamp()
    ))
  on conflict(organization_id,collection,id) do update
  set owner_id=excluded.owner_id,
      data=case when public.records.data->>'status'='registered' then public.records.data else excluded.data end;

  return assigned;
end $$;

revoke all on function public.office_register_correspondence(text,text,jsonb,uuid) from public,anon;
grant execute on function public.office_register_correspondence(text,text,jsonb,uuid) to authenticated;
