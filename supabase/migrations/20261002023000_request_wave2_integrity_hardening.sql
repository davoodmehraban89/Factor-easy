-- Wave 2: F-411/F-414/F-417/F-418 request integrity hardening.
-- Server-validates pinned form values, binds idempotency to the command,
-- enforces active/latest versions for new commands, and schema-binds workflow conditions.

create or replace function private.validate_request_form_schema(p_schema jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare
  v_fields jsonb; v_field jsonb; v_key text; v_type text; v_seen text[]:=array[]::text[]; v_options jsonb; v_opt jsonb;
begin
  if jsonb_typeof(coalesce(p_schema,'{}'::jsonb))<>'object' then raise exception 'form schema must be a JSON object'; end if;
  if p_schema ? 'schemaVersion' then
    begin
      if (p_schema->>'schemaVersion')::integer<>1 then raise exception 'unsupported request form schema version'; end if;
    exception when invalid_text_representation then raise exception 'form schema version must be an integer';
    end;
  end if;
  v_fields:=coalesce(p_schema->'fields','[]'::jsonb);
  if jsonb_typeof(v_fields)<>'array' or jsonb_array_length(v_fields)>100 then raise exception 'form schema fields must be an array with at most 100 items'; end if;
  for v_field in select value from jsonb_array_elements(v_fields) loop
    if jsonb_typeof(v_field)<>'object' then raise exception 'form field must be an object'; end if;
    v_key:=lower(trim(coalesce(v_field->>'key','')));
    if v_key='' or v_key!~'^[a-z][a-z0-9_]{0,63}$' then raise exception 'form field key is invalid'; end if;
    if v_key=any(v_seen) then raise exception 'form field keys must be unique'; end if;
    v_seen:=array_append(v_seen,v_key);
    v_type:=lower(trim(coalesce(v_field->>'type','text')));
    if v_type not in ('text','textarea','number','date','select') then raise exception 'form field type is not supported'; end if;
    if v_field ? 'required' and jsonb_typeof(v_field->'required')<>'boolean' then raise exception 'form field required must be boolean'; end if;
    if v_type='select' then
      v_options:=v_field->'options';
      if jsonb_typeof(v_options)<>'array' or jsonb_array_length(v_options)<1 or jsonb_array_length(v_options)>100 then raise exception 'select field requires between 1 and 100 options'; end if;
      for v_opt in select value from jsonb_array_elements(v_options) loop
        if jsonb_typeof(v_opt)<>'string' or nullif(trim(v_opt#>>'{}'),'') is null then raise exception 'select options must be non-empty strings'; end if;
      end loop;
      if (select count(*) from jsonb_array_elements_text(v_options))<>(select count(distinct x) from jsonb_array_elements_text(v_options) x) then raise exception 'select options must be unique'; end if;
    end if;
  end loop;
end $$;
revoke all on function private.validate_request_form_schema(jsonb) from public,anon,authenticated;

create or replace function private.validate_request_values(p_schema jsonb,p_values jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare
  v_fields jsonb; v_field jsonb; v_key text; v_type text; v_required boolean; v_value jsonb; v_text text; v_options jsonb;
begin
  perform private.validate_request_form_schema(p_schema);
  if jsonb_typeof(coalesce(p_values,'{}'::jsonb))<>'object' then raise exception 'request values must be a JSON object'; end if;
  v_fields:=coalesce(p_schema->'fields','[]'::jsonb);
  if exists(
    select 1 from jsonb_object_keys(coalesce(p_values,'{}'::jsonb)) k
    where not exists(select 1 from jsonb_array_elements(v_fields) f where lower(trim(f->>'key'))=lower(k))
  ) then raise exception 'request values contain an unknown field'; end if;
  for v_field in select value from jsonb_array_elements(v_fields) loop
    v_key:=lower(trim(v_field->>'key')); v_type:=lower(trim(coalesce(v_field->>'type','text'))); v_required:=coalesce((v_field->>'required')::boolean,false);
    if not (coalesce(p_values,'{}'::jsonb) ? v_key) then
      if v_required then raise exception 'required request field % is missing',v_key; end if;
      continue;
    end if;
    v_value:=p_values->v_key;
    if v_value='null'::jsonb then
      if v_required then raise exception 'required request field % is null',v_key; end if;
      continue;
    end if;
    if v_type in ('text','textarea','date','select') then
      if jsonb_typeof(v_value)<>'string' then raise exception 'request field % must be a string',v_key; end if;
      v_text:=v_value#>>'{}';
      if v_required and nullif(trim(v_text),'') is null then raise exception 'required request field % is empty',v_key; end if;
    end if;
    if v_type='number' and jsonb_typeof(v_value)<>'number' then raise exception 'request field % must be a number',v_key; end if;
    if v_type='date' and nullif(v_text,'') is not null then
      if v_text!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'request field % must use YYYY-MM-DD',v_key; end if;
      begin
        if to_char(v_text::date,'YYYY-MM-DD')<>v_text then raise exception 'request field % contains an invalid date',v_key; end if;
      exception when datetime_field_overflow then raise exception 'request field % contains an invalid date',v_key;
      end;
    end if;
    if v_type='select' and nullif(v_text,'') is not null then
      v_options:=v_field->'options';
      if not exists(select 1 from jsonb_array_elements_text(v_options) x where x=v_text) then raise exception 'request field % contains an unsupported option',v_key; end if;
    end if;
  end loop;
end $$;
revoke all on function private.validate_request_values(jsonb,jsonb) from public,anon,authenticated;

create or replace function private.validate_request_workflow_schema_bound(p_schema jsonb,p_form_schema jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare v_step jsonb; v_condition jsonb; v_field jsonb; v_key text; v_type text; v_op text; v_expected jsonb; v_text text;
begin
  perform private.validate_request_workflow_schema(coalesce(p_schema,'{}'::jsonb));
  perform private.validate_request_form_schema(coalesce(p_form_schema,'{}'::jsonb));
  if coalesce((p_schema->>'schemaVersion')::integer,1)<>2 then return; end if;
  for v_step in select value from jsonb_array_elements(p_schema->'steps') loop
    if not (v_step ? 'condition') or v_step->'condition' is null or v_step->'condition'='null'::jsonb then continue; end if;
    v_condition:=v_step->'condition'; v_key:=lower(trim(v_condition->>'field')); v_op:=lower(trim(v_condition->>'op'));
    select f.value into v_field from jsonb_array_elements(coalesce(p_form_schema->'fields','[]'::jsonb)) f(value) where lower(trim(f.value->>'key'))=v_key limit 1;
    if v_field is null then raise exception 'condition field % does not exist in form schema',v_key; end if;
    v_type:=lower(trim(coalesce(v_field->>'type','text')));
    if v_op in ('gt','gte','lt','lte') and v_type<>'number' then raise exception 'condition operator % requires a number field',v_op; end if;
    if v_op in ('exists','not_exists') then continue; end if;
    v_expected:=v_condition->'value';
    if v_type='number' and jsonb_typeof(v_expected)<>'number' then raise exception 'numeric condition value must be a number'; end if;
    if v_type in ('text','textarea','date','select') and jsonb_typeof(v_expected)<>'string' then raise exception 'condition value for field % must be a string',v_key; end if;
    if v_type='date' then
      v_text:=v_expected#>>'{}';
      if v_text!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'date condition must use YYYY-MM-DD'; end if;
      begin
        if to_char(v_text::date,'YYYY-MM-DD')<>v_text then raise exception 'date condition contains an invalid date'; end if;
      exception when datetime_field_overflow then raise exception 'date condition contains an invalid date';
      end;
    end if;
    if v_type='select' and not exists(select 1 from jsonb_array_elements_text(v_field->'options') x where x=v_expected#>>'{}') then raise exception 'select condition value is not an allowed option'; end if;
  end loop;
end $$;
revoke all on function private.validate_request_workflow_schema_bound(jsonb,jsonb) from public,anon,authenticated;

create or replace function private.request_publish_type_version(
  p_organization_id uuid,p_code text,p_title text,p_category text default null,p_form_schema jsonb default '{}'::jsonb,p_workflow_schema jsonb default '{}'::jsonb,p_expected_definition_revision bigint default null
) returns table(request_type_id uuid,request_type_version_id uuid,workflow_version_id uuid,version_no integer,definition_revision bigint)
language plpgsql security definer set search_path=''
as $$
declare v_def public.request_type_definitions%rowtype; v_type_version uuid; v_workflow_version uuid; v_version integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
  if not private.has_org_capability(p_organization_id,'requests_workflow','configure') then raise exception 'requests_workflow configure capability required' using errcode='42501'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_title),'') is null then raise exception 'code and title are required'; end if;
  perform private.validate_request_workflow_schema_bound(coalesce(p_workflow_schema,'{}'::jsonb),coalesce(p_form_schema,'{}'::jsonb));
  select * into v_def from public.request_type_definitions d where d.organization_id=p_organization_id and d.code=upper(trim(p_code)) for update;
  if not found then
    if p_expected_definition_revision is not null and p_expected_definition_revision<>0 then raise exception 'stale definition revision'; end if;
    insert into public.request_type_definitions(organization_id,code,title,category,created_by) values(p_organization_id,upper(trim(p_code)),trim(p_title),nullif(trim(p_category),''),auth.uid()) returning * into v_def;
  else
    if p_expected_definition_revision is not null and p_expected_definition_revision<>v_def.revision then raise exception 'stale definition revision'; end if;
    update public.request_type_definitions as d set title=trim(p_title),category=nullif(trim(p_category),''),revision=d.revision+1,updated_at=now() where d.id=v_def.id returning d.* into v_def;
  end if;
  select coalesce(max(v.version_no),0)+1 into v_version from public.request_type_versions v where v.request_type_id=v_def.id;
  insert into public.request_type_versions(organization_id,request_type_id,version_no,title,category,form_schema,published_by) values(p_organization_id,v_def.id,v_version,v_def.title,v_def.category,coalesce(p_form_schema,'{}'::jsonb),auth.uid()) returning id into v_type_version;
  insert into public.request_workflow_versions(organization_id,request_type_version_id,workflow_schema,published_by) values(p_organization_id,v_type_version,coalesce(p_workflow_schema,'{}'::jsonb),auth.uid()) returning id into v_workflow_version;
  return query select v_def.id,v_type_version,v_workflow_version,v_version,v_def.revision;
end $$;
revoke all on function private.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) from public,anon;
grant execute on function private.request_publish_type_version(uuid,text,text,text,jsonb,jsonb,bigint) to authenticated;

create or replace function private.request_create_instance(p_organization_id uuid,p_request_type_version_id uuid,p_values jsonb,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_existing public.request_instances%rowtype; v_workflow uuid; v_id uuid; v_workflow_schema jsonb; v_form_schema jsonb;
  v_definition_id uuid; v_definition_active boolean; v_latest_version uuid; v_step jsonb; v_ord bigint; v_match boolean; v_activated integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
  if not private.has_org_capability(p_organization_id,'requests_workflow','create') then raise exception 'requests_workflow create capability required' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'idempotency_key is required'; end if;

  select * into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_type_version_id<>p_request_type_version_id or v_existing.values_json is distinct from coalesce(p_values,'{}'::jsonb) then
      raise exception 'idempotency key conflicts with a different request command' using errcode='23505';
    end if;
    return v_existing.id;
  end if;

  select v.request_type_id,d.active,v.form_schema,w.id,w.workflow_schema
    into v_definition_id,v_definition_active,v_form_schema,v_workflow,v_workflow_schema
  from public.request_type_versions v
  join public.request_type_definitions d on d.id=v.request_type_id and d.organization_id=v.organization_id
  join public.request_workflow_versions w on w.request_type_version_id=v.id and w.organization_id=v.organization_id
  where v.organization_id=p_organization_id and v.id=p_request_type_version_id;
  if v_workflow is null then raise exception 'published request type version not found'; end if;
  if not v_definition_active then raise exception 'request type is inactive' using errcode='55000'; end if;
  select v.id into v_latest_version from public.request_type_versions v where v.organization_id=p_organization_id and v.request_type_id=v_definition_id order by v.version_no desc limit 1;
  if v_latest_version is distinct from p_request_type_version_id then raise exception 'request type version is not current' using errcode='55000'; end if;

  perform private.validate_request_values(coalesce(v_form_schema,'{}'::jsonb),coalesce(p_values,'{}'::jsonb));
  perform private.validate_request_workflow_schema_bound(coalesce(v_workflow_schema,'{}'::jsonb),coalesce(v_form_schema,'{}'::jsonb));

  insert into public.request_instances(organization_id,request_type_version_id,workflow_version_id,requester_user_id,values_json,status,revision,idempotency_key)
  values(p_organization_id,p_request_type_version_id,v_workflow,auth.uid(),coalesce(p_values,'{}'::jsonb),'submitted',1,p_idempotency_key) returning id into v_id;
  insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,idempotency_key)
  values(p_organization_id,v_id,auth.uid(),'create',null,'submitted',1,'create:'||p_idempotency_key);

  if coalesce((v_workflow_schema->>'schemaVersion')::integer,1)=2 then
    for v_step,v_ord in select value,ordinality from jsonb_array_elements(v_workflow_schema->'steps') with ordinality loop
      v_match:=private.evaluate_request_condition(v_step->'condition',coalesce(p_values,'{}'::jsonb));
      insert into private.request_step_instances(organization_id,request_instance_id,workflow_version_id,step_key,step_title,step_index,mode,required_approvals,required_capability,state,activated_at,condition_json,condition_matched)
      values(p_organization_id,v_id,v_workflow,lower(trim(v_step->>'key')),trim(v_step->>'title'),v_ord::integer,lower(trim(coalesce(v_step->>'mode','sequential'))),coalesce((v_step->>'requiredApprovals')::integer,1),lower(trim(coalesce(v_step->>'requiredCapability','approve'))),case when v_match then 'pending' else 'skipped' end,null,v_step->'condition',v_match);
    end loop;
    with first_pending as (select id from private.request_step_instances where request_instance_id=v_id and state='pending' order by step_index limit 1)
    update private.request_step_instances s set state='active',activated_at=now() from first_pending f where s.id=f.id;
    get diagnostics v_activated=row_count;
    if v_activated=0 then raise exception 'workflow has no applicable approval step' using errcode='55000'; end if;
  end if;
  return v_id;
exception when unique_violation then
  select * into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_type_version_id=p_request_type_version_id and v_existing.values_json is not distinct from coalesce(p_values,'{}'::jsonb) then return v_existing.id; end if;
    raise exception 'idempotency key conflicts with a different request command' using errcode='23505';
  end if;
  raise;
end $$;
revoke all on function private.request_create_instance(uuid,uuid,jsonb,text) from public,anon;
grant execute on function private.request_create_instance(uuid,uuid,jsonb,text) to authenticated;
