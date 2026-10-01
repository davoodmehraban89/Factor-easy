-- Slice D3b: bounded condition DSL, skipped-step evidence and authorized read-only runtime timeline.

alter table private.request_step_instances add column if not exists condition_json jsonb;
alter table private.request_step_instances add column if not exists condition_matched boolean not null default true;
alter table private.request_step_instances drop constraint if exists request_step_instances_state_check;
alter table private.request_step_instances add constraint request_step_instances_state_check check(state in ('pending','active','completed','rejected','skipped'));

create or replace function private.validate_request_condition(p_condition jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare v_field text; v_op text; v_type text;
begin
 if p_condition is null or p_condition='null'::jsonb then return; end if;
 if jsonb_typeof(p_condition)<>'object' then raise exception 'condition must be an object'; end if;
 if exists(select 1 from jsonb_object_keys(p_condition) as k(key) where key not in ('field','op','value')) then raise exception 'condition contains unsupported keys'; end if;
 v_field:=lower(trim(coalesce(p_condition->>'field','')));
 if v_field='' or v_field!~'^[a-z][a-z0-9_]{0,63}$' then raise exception 'condition field is invalid'; end if;
 v_op:=lower(trim(coalesce(p_condition->>'op','')));
 if v_op not in ('eq','neq','gt','gte','lt','lte','exists','not_exists') then raise exception 'condition operator is not allowed'; end if;
 if v_op not in ('exists','not_exists') and not (p_condition ? 'value') then raise exception 'condition value is required'; end if;
 if v_op not in ('exists','not_exists') then
  v_type:=jsonb_typeof(p_condition->'value');
  if v_type not in ('string','number','boolean','null') then raise exception 'condition value must be scalar'; end if;
 end if;
end $$;
revoke all on function private.validate_request_condition(jsonb) from public,anon,authenticated;

create or replace function private.evaluate_request_condition(p_condition jsonb,p_values jsonb)
returns boolean language plpgsql immutable security invoker set search_path=''
as $$
declare v_field text; v_op text; v_actual jsonb; v_expected jsonb; a text; b text;
begin
 if p_condition is null or p_condition='null'::jsonb then return true; end if;
 perform private.validate_request_condition(p_condition);
 v_field:=lower(trim(p_condition->>'field'));v_op:=lower(trim(p_condition->>'op'));
 if v_op='exists' then return coalesce(p_values,'{}'::jsonb) ? v_field and coalesce(p_values->v_field,'null'::jsonb)<>'null'::jsonb; end if;
 if v_op='not_exists' then return not (coalesce(p_values,'{}'::jsonb) ? v_field) or coalesce(p_values->v_field,'null'::jsonb)='null'::jsonb; end if;
 if not (coalesce(p_values,'{}'::jsonb) ? v_field) then return false; end if;
 v_actual:=p_values->v_field;v_expected:=p_condition->'value';a:=v_actual#>>'{}';b:=v_expected#>>'{}';
 if v_op='eq' then return a is not distinct from b; end if;
 if v_op='neq' then return a is distinct from b; end if;
 if a is null or b is null or a!~'^[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$' or b!~'^[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$' then return false; end if;
 if v_op='gt' then return a::numeric>b::numeric; elsif v_op='gte' then return a::numeric>=b::numeric; elsif v_op='lt' then return a::numeric<b::numeric; elsif v_op='lte' then return a::numeric<=b::numeric; end if;
 return false;
end $$;
revoke all on function private.evaluate_request_condition(jsonb,jsonb) from public,anon,authenticated;

create or replace function private.validate_request_workflow_schema(p_schema jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare v_version integer;v_steps jsonb;v_step jsonb;v_key text;v_mode text;v_required integer;v_cap text;v_seen text[]:=array[]::text[];
begin
 if jsonb_typeof(coalesce(p_schema,'{}'::jsonb))<>'object' then raise exception 'workflow schema must be a JSON object'; end if;
 begin v_version:=coalesce((p_schema->>'schemaVersion')::integer,1); exception when others then raise exception 'workflow schema version must be an integer'; end;
 if v_version=1 then return; end if;
 if v_version<>2 then raise exception 'unsupported request workflow schema version'; end if;
 v_steps:=p_schema->'steps';
 if jsonb_typeof(v_steps)<>'array' or jsonb_array_length(v_steps)<1 or jsonb_array_length(v_steps)>50 then raise exception 'D3 workflow requires between 1 and 50 steps'; end if;
 for v_step in select value from jsonb_array_elements(v_steps) loop
  if jsonb_typeof(v_step)<>'object' then raise exception 'workflow step must be an object'; end if;
  v_key:=lower(trim(coalesce(v_step->>'key','')));if v_key='' or v_key!~'^[a-z][a-z0-9_]{0,63}$' then raise exception 'workflow step key is invalid'; end if;if v_key=any(v_seen) then raise exception 'workflow step keys must be unique'; end if;v_seen:=array_append(v_seen,v_key);
  if nullif(trim(v_step->>'title'),'') is null then raise exception 'workflow step title is required'; end if;
  v_mode:=lower(trim(coalesce(v_step->>'mode','sequential')));if v_mode not in ('sequential','parallel') then raise exception 'workflow step mode must be sequential or parallel'; end if;
  begin v_required:=coalesce((v_step->>'requiredApprovals')::integer,1); exception when others then raise exception 'requiredApprovals must be an integer'; end;if v_required<1 or v_required>20 then raise exception 'requiredApprovals must be between 1 and 20'; end if;if v_mode='sequential' and v_required<>1 then raise exception 'sequential step requires exactly one approval'; end if;if v_mode='parallel' and v_required<2 then raise exception 'parallel step requires at least two approvals'; end if;
  v_cap:=lower(trim(coalesce(v_step->>'requiredCapability','approve')));if v_cap not in ('approve','edit','configure') then raise exception 'workflow step capability is not allowed'; end if;
  if v_step ? 'condition' then perform private.validate_request_condition(v_step->'condition'); end if;
 end loop;
end $$;
revoke all on function private.validate_request_workflow_schema(jsonb) from public,anon,authenticated;

create or replace function private.request_create_instance(p_organization_id uuid,p_request_type_version_id uuid,p_values jsonb,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_existing uuid;v_workflow uuid;v_id uuid;v_schema jsonb;v_step jsonb;v_ord bigint;v_match boolean;v_activated integer;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 if p_organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
 if not private.organization_has_module_entitlement(p_organization_id,'requests_workflow',true) then raise exception 'active requests_workflow entitlement required' using errcode='42501'; end if;
 if not private.has_org_capability(p_organization_id,'requests_workflow','create') then raise exception 'requests_workflow create capability required' using errcode='42501'; end if;
 if char_length(trim(coalesce(p_idempotency_key,'')))<8 then raise exception 'idempotency_key is required'; end if;
 select id into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;if found then return v_existing;end if;
 select w.id,w.workflow_schema into v_workflow,v_schema from public.request_workflow_versions w join public.request_type_versions v on v.id=w.request_type_version_id where w.organization_id=p_organization_id and v.organization_id=p_organization_id and v.id=p_request_type_version_id;if v_workflow is null then raise exception 'published request type version not found';end if;
 perform private.validate_request_workflow_schema(coalesce(v_schema,'{}'::jsonb));
 insert into public.request_instances(organization_id,request_type_version_id,workflow_version_id,requester_user_id,values_json,status,revision,idempotency_key) values(p_organization_id,p_request_type_version_id,v_workflow,auth.uid(),coalesce(p_values,'{}'::jsonb),'submitted',1,p_idempotency_key) returning id into v_id;
 insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,idempotency_key) values(p_organization_id,v_id,auth.uid(),'create',null,'submitted',1,'create:'||p_idempotency_key);
 if coalesce((v_schema->>'schemaVersion')::integer,1)=2 then
  for v_step,v_ord in select value,ordinality from jsonb_array_elements(v_schema->'steps') with ordinality loop
   v_match:=private.evaluate_request_condition(v_step->'condition',coalesce(p_values,'{}'::jsonb));
   insert into private.request_step_instances(organization_id,request_instance_id,workflow_version_id,step_key,step_title,step_index,mode,required_approvals,required_capability,state,activated_at,condition_json,condition_matched)
   values(p_organization_id,v_id,v_workflow,lower(trim(v_step->>'key')),trim(v_step->>'title'),v_ord::integer,lower(trim(coalesce(v_step->>'mode','sequential'))),coalesce((v_step->>'requiredApprovals')::integer,1),lower(trim(coalesce(v_step->>'requiredCapability','approve'))),case when v_match then 'pending' else 'skipped' end,null,v_step->'condition',v_match);
  end loop;
  with first_pending as (select id from private.request_step_instances where request_instance_id=v_id and state='pending' order by step_index limit 1) update private.request_step_instances s set state='active',activated_at=now() from first_pending f where s.id=f.id;
  get diagnostics v_activated=row_count;
  if v_activated=0 then
   update public.request_instances set status='approved',revision=2,updated_at=now() where id=v_id;
   insert into public.request_instance_events(organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,idempotency_key) values(p_organization_id,v_id,auth.uid(),'workflow_auto_complete','submitted','approved',2,'auto:'||p_idempotency_key);
  end if;
 end if;
 return v_id;
exception when unique_violation then
 select id into v_existing from public.request_instances where organization_id=p_organization_id and idempotency_key=p_idempotency_key;if v_existing is not null then return v_existing;end if;raise;
end $$;
revoke all on function private.request_create_instance(uuid,uuid,jsonb,text) from public,anon;
grant execute on function private.request_create_instance(uuid,uuid,jsonb,text) to authenticated;

create or replace function private.request_workflow_timeline(p_request_instance_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_row public.request_instances%rowtype;v_steps jsonb;v_events jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 select * into v_row from public.request_instances r where r.id=p_request_instance_id;if not found then raise exception 'request instance not found';end if;
 if v_row.organization_id not in (select private.current_organization_ids()) then raise exception 'organization access denied' using errcode='42501'; end if;
 if not private.organization_has_module_entitlement(v_row.organization_id,'requests_workflow',false) then raise exception 'requests_workflow entitlement required' using errcode='42501'; end if;
 if v_row.requester_user_id<>auth.uid() and not private.has_org_capability(v_row.organization_id,'requests_workflow','approve') and not private.has_org_capability(v_row.organization_id,'requests_workflow','edit') then raise exception 'request timeline access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('key',s.step_key,'title',s.step_title,'index',s.step_index,'mode',s.mode,'state',s.state,'requiredApprovals',s.required_approvals,'approvalsReceived',(select count(*) from private.request_step_votes v where v.step_instance_id=s.id and v.decision='approve'),'requiredCapability',s.required_capability,'condition',s.condition_json,'conditionMatched',s.condition_matched,'activatedAt',s.activated_at,'completedAt',s.completed_at) order by s.step_index),'[]'::jsonb) into v_steps from private.request_step_instances s where s.request_instance_id=v_row.id;
 select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'fromStatus',e.from_status,'toStatus',e.to_status,'revision',e.revision,'note',e.note,'createdAt',e.created_at) order by e.revision,e.created_at),'[]'::jsonb) into v_events from public.request_instance_events e where e.request_instance_id=v_row.id and e.organization_id=v_row.organization_id;
 return jsonb_build_object('request',jsonb_build_object('id',v_row.id,'status',v_row.status,'revision',v_row.revision,'createdAt',v_row.created_at,'updatedAt',v_row.updated_at),'steps',v_steps,'events',v_events);
end $$;
revoke all on function private.request_workflow_timeline(uuid) from public,anon;
grant execute on function private.request_workflow_timeline(uuid) to authenticated;

create or replace function public.request_workflow_timeline(p_request_instance_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select private.request_workflow_timeline(p_request_instance_id) $$;
revoke all on function public.request_workflow_timeline(uuid) from public,anon;
grant execute on function public.request_workflow_timeline(uuid) to authenticated;
