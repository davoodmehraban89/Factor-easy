-- Slice D3a: versioned sequential/parallel request workflow semantics and server-authorized step decisions.

create table if not exists private.request_step_instances(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_instance_id uuid not null references public.request_instances(id) on delete restrict,
  workflow_version_id uuid not null references public.request_workflow_versions(id) on delete restrict,
  step_key text not null,
  step_title text not null,
  step_index integer not null check(step_index>0),
  mode text not null check(mode in ('sequential','parallel')),
  required_approvals integer not null check(required_approvals>0),
  required_capability text not null default 'approve',
  state text not null check(state in ('pending','active','completed','rejected')),
  activated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(request_instance_id,step_key),
  unique(request_instance_id,step_index)
);
create index if not exists request_step_instances_instance_state_idx on private.request_step_instances(request_instance_id,state,step_index);
create index if not exists request_step_instances_workflow_idx on private.request_step_instances(workflow_version_id);

create table if not exists private.request_step_votes(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  request_instance_id uuid not null references public.request_instances(id) on delete restrict,
  step_instance_id uuid not null references private.request_step_instances(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check(decision in ('approve','reject')),
  note text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(step_instance_id,actor_user_id),
  unique(organization_id,idempotency_key)
);
create index if not exists request_step_votes_instance_idx on private.request_step_votes(request_instance_id,created_at);
create index if not exists request_step_votes_step_idx on private.request_step_votes(step_instance_id,decision);
create index if not exists request_step_votes_actor_idx on private.request_step_votes(actor_user_id);

revoke all on table private.request_step_instances from public,anon,authenticated;
revoke all on table private.request_step_votes from public,anon,authenticated;

create or replace function private.validate_request_workflow_schema(p_schema jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare
  v_version integer;
  v_steps jsonb;
  v_step jsonb;
  v_key text;
  v_mode text;
  v_required integer;
  v_cap text;
  v_seen text[]:=array[]::text[];
begin
  if jsonb_typeof(coalesce(p_schema,'{}'::jsonb))<>'object' then raise exception 'workflow schema must be a JSON object'; end if;
  v_version:=coalesce((p_schema->>'schemaVersion')::integer,1);
  if v_version=1 then return; end if;
  if v_version<>2 then raise exception 'unsupported request workflow schema version'; end if;
  v_steps:=p_schema->'steps';
  if jsonb_typeof(v_steps)<>'array' or jsonb_array_length(v_steps)<1 or jsonb_array_length(v_steps)>50 then raise exception 'D3 workflow requires between 1 and 50 steps'; end if;
  for v_step in select value from jsonb_array_elements(v_steps) loop
    if jsonb_typeof(v_step)<>'object' then raise exception 'workflow step must be an object'; end if;
    v_key:=lower(trim(coalesce(v_step->>'key','')));
    if v_key='' or v_key!~'^[a-z][a-z0-9_]{0,63}$' then raise exception 'workflow step key is invalid'; end if;
    if v_key=any(v_seen) then raise exception 'workflow step keys must be unique'; end if;
    v_seen:=array_append(v_seen,v_key);
    if nullif(trim(v_step->>'title'),'') is null then raise exception 'workflow step title is required'; end if;
    v_mode:=lower(trim(coalesce(v_step->>'mode','sequential')));
    if v_mode not in ('sequential','parallel') then raise exception 'workflow step mode must be sequential or parallel'; end if;
    begin v_required:=coalesce((v_step->>'requiredApprovals')::integer,1); exception when others then raise exception 'requiredApprovals must be an integer'; end;
    if v_required<1 or v_required>20 then raise exception 'requiredApprovals must be between 1 and 20'; end if;
    if v_mode='sequential' and v_required<>1 then raise exception 'sequential step requires exactly one approval'; end if;
    if v_mode='parallel' and v_required<2 then raise exception 'parallel step requires at least two approvals'; end if;
    v_cap:=lower(trim(coalesce(v_step->>'requiredCapability','approve')));
    if v_cap not in ('approve','edit','configure') then raise exception 'workflow step capability is not allowed'; end if;
  end loop;
end $$;
revoke all on function private.validate_request_workflow_schema(jsonb) from public,anon,authenticated;

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
  if jsonb_typeof(coalesce(p_form_schema,'{}'::jsonb))<>'object' or jsonb_typeof(coalesce(p_workflow_schema,'{}'::jsonb))<>'object' then raise exception 'schemas must be JSON objects'; end if;
  perform private.validate_request_workflow_schema(coalesce(p_workflow_schema,'{}'::jsonb));
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
  v_existing uuid; v_workflow uuid; v_id uuid; v_schema jsonb; v_step jsonb; v_ord bigint;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
  if not private.has_org_capability(p_organization_id,'requests_workflow','create') then raise exception 'requests_workflow create capability required' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'idempotency_key is required'; end if;
  select id into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then return v_existing; end if;
  select w.id,w.workflow_schema into v_workflow,v_schema from public.request_workflow_versions w join public.request_type_versions v on v.id=w.request_type_version_id where w.organization_id=p_organization_id and v.organization_id=p_organization_id and v.id=p_request_type_version_id;
  if v_workflow is null then raise exception 'published request type version not found'; end if;
  perform private.validate_request_workflow_schema(coalesce(v_schema,'{}'::jsonb));
  insert into public.request_instances(organization_id,request_type_version_id,workflow_version_id,requester_user_id,values_json,status,revision,idempotency_key) values(p_organization_id,p_request_type_version_id,v_workflow,auth.uid(),coalesce(p_values,'{}'::jsonb),'submitted',1,p_idempotency_key) returning id into v_id;
  insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,idempotency_key) values(p_organization_id,v_id,auth.uid(),'create',null,'submitted',1,'create:'||p_idempotency_key);
  if coalesce((v_schema->>'schemaVersion')::integer,1)=2 then
    for v_step,v_ord in select value,ordinality from jsonb_array_elements(v_schema->'steps') with ordinality loop
      insert into private.request_step_instances(organization_id,request_instance_id,workflow_version_id,step_key,step_title,step_index,mode,required_approvals,required_capability,state,activated_at)
      values(p_organization_id,v_id,v_workflow,lower(trim(v_step->>'key')),trim(v_step->>'title'),v_ord::integer,lower(trim(coalesce(v_step->>'mode','sequential'))),coalesce((v_step->>'requiredApprovals')::integer,1),lower(trim(coalesce(v_step->>'requiredCapability','approve'))),case when v_ord=1 then 'active' else 'pending' end,case when v_ord=1 then now() else null end);
    end loop;
  end if;
  return v_id;
exception when unique_violation then
  select id into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  raise;
end $$;
revoke all on function private.request_create_instance(uuid,uuid,jsonb,text) from public,anon;
grant execute on function private.request_create_instance(uuid,uuid,jsonb,text) to authenticated;

create or replace function private.request_step_decide(p_request_instance_id uuid,p_decision text,p_expected_revision bigint,p_idempotency_key text,p_note text default null)
returns table(request_instance_id uuid,status text,revision bigint,step_key text,step_state text,approvals_received integer,approvals_required integer)
language plpgsql security definer set search_path=''
as $$
declare
  v_row public.request_instances%rowtype; v_step private.request_step_instances%rowtype; v_vote private.request_step_votes%rowtype; v_next private.request_step_instances%rowtype; v_decision text; v_approvals integer; v_status text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'idempotency_key is required'; end if;
  select * into v_vote from private.request_step_votes v where v.request_instance_id=p_request_instance_id and v.idempotency_key=p_idempotency_key;
  if found then
    select * into v_row from public.request_instances r where r.id=p_request_instance_id;
    select * into v_step from private.request_step_instances s where s.id=v_vote.step_instance_id;
    select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';
    return query select v_row.id,v_row.status,v_row.revision,v_step.step_key,v_step.state,v_approvals,v_step.required_approvals; return;
  end if;
  select * into v_row from public.request_instances r where r.id=p_request_instance_id for update;
  if not found then raise exception 'request instance not found'; end if;
  if v_row.organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
  if not private.organization_has_module_entitlement(v_row.organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<>v_row.revision then raise exception 'stale revision'; end if;
  if v_row.status in ('approved','rejected','cancelled') then raise exception 'terminal request cannot transition'; end if;
  select * into v_step from private.request_step_instances s where s.request_instance_id=v_row.id and s.state='active' order by s.step_index limit 1 for update;
  if not found then raise exception 'active workflow step not found'; end if;
  if not private.has_org_capability(v_row.organization_id,'requests_workflow',v_step.required_capability) then raise exception 'active step capability required' using errcode='42501'; end if;
  v_decision:=lower(trim(coalesce(p_decision,'')));
  if v_decision not in ('approve','reject') then raise exception 'unsupported step decision'; end if;
  begin
    insert into private.request_step_votes(organization_id,request_instance_id,step_instance_id,actor_user_id,decision,note,idempotency_key) values(v_row.organization_id,v_row.id,v_step.id,auth.uid(),v_decision,p_note,p_idempotency_key) returning * into v_vote;
  exception when unique_violation then
    if exists(select 1 from private.request_step_votes x where x.step_instance_id=v_step.id and x.actor_user_id=auth.uid()) then raise exception 'actor already decided this step'; end if;
    raise;
  end;
  if v_decision='reject' then
    update private.request_step_instances set state='rejected',completed_at=now() where id=v_step.id returning * into v_step;
    v_status:='rejected';
  else
    select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';
    if v_approvals>=v_step.required_approvals then
      update private.request_step_instances set state='completed',completed_at=now() where id=v_step.id returning * into v_step;
      select * into v_next from private.request_step_instances s where s.request_instance_id=v_row.id and s.state='pending' and s.step_index>v_step.step_index order by s.step_index limit 1 for update;
      if found then update private.request_step_instances set state='active',activated_at=now() where id=v_next.id; v_status:='submitted'; else v_status:='approved'; end if;
    else v_status:='submitted'; end if;
  end if;
  update public.request_instances as ri set status=v_status,revision=ri.revision+1,updated_at=now() where ri.id=v_row.id returning ri.* into v_row;
  insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,note,idempotency_key) values(v_row.organization_id,v_row.id,auth.uid(),'step_'||v_decision||':'||v_step.step_key,'submitted',v_status,v_row.revision,p_note,p_idempotency_key);
  select count(*)::integer into v_approvals from private.request_step_votes x where x.step_instance_id=v_step.id and x.decision='approve';
  return query select v_row.id,v_row.status,v_row.revision,v_step.step_key,v_step.state,v_approvals,v_step.required_approvals;
end $$;
revoke all on function private.request_step_decide(uuid,text,bigint,text,text) from public,anon;
grant execute on function private.request_step_decide(uuid,text,bigint,text,text) to authenticated;

create or replace function public.request_step_decide(p_request_instance_id uuid,p_decision text,p_expected_revision bigint,p_idempotency_key text,p_note text default null)
returns table(request_instance_id uuid,status text,revision bigint,step_key text,step_state text,approvals_received integer,approvals_required integer)
language sql security invoker set search_path=''
as $$ select * from private.request_step_decide(p_request_instance_id,p_decision,p_expected_revision,p_idempotency_key,p_note) $$;
revoke all on function public.request_step_decide(uuid,text,bigint,text,text) from public,anon;
grant execute on function public.request_step_decide(uuid,text,bigint,text,text) to authenticated;
