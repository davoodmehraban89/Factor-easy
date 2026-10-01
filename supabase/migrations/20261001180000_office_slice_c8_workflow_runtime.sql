-- Office Slice C8 / Task 2: transactional workflow attach, transition, read and immutable evidence.
-- Additive only. Existing correspondence status/content, C5 approval evidence and financial history are not modified.

create table private.office_workflow_instances(
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  correspondence_collection text not null default 'correspondence' check(correspondence_collection='correspondence'),
  correspondence_id text not null,
  policy_key text not null,
  policy_version integer not null check(policy_version>0),
  stage_id text not null check(stage_id ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$'),
  revision bigint not null default 0 check(revision>=0),
  attached_by uuid not null references public.profiles(id) on delete restrict,
  attached_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(organization_id,id),
  unique(organization_id,correspondence_collection,correspondence_id),
  foreign key(organization_id,correspondence_collection,correspondence_id)
    references public.records(organization_id,collection,id) on delete restrict,
  foreign key(organization_id,policy_key,policy_version)
    references private.office_workflow_policy_versions(organization_id,policy_key,version) on delete restrict
);
create index office_workflow_instances_policy_idx on private.office_workflow_instances(organization_id,policy_key,policy_version);
create index office_workflow_instances_attached_by_idx on private.office_workflow_instances(attached_by);
alter table private.office_workflow_instances enable row level security;
revoke all on private.office_workflow_instances from public,anon,authenticated;

create table private.office_workflow_events(
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  instance_id uuid not null,
  revision bigint not null check(revision>=0),
  request_id uuid not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check(event_type in ('attach','transition')),
  edge_id text,
  edge_label text,
  from_stage_id text,
  from_stage_label text,
  to_stage_id text not null,
  to_stage_label text not null,
  note text check(note is null or char_length(note)<=2000),
  request_payload jsonb not null,
  result_payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(organization_id,instance_id)
    references private.office_workflow_instances(organization_id,id) on delete restrict,
  unique(instance_id,revision),
  unique(organization_id,request_id)
);
create index office_workflow_events_instance_page_idx on private.office_workflow_events(organization_id,instance_id,revision);
create index office_workflow_events_actor_idx on private.office_workflow_events(organization_id,actor_id,created_at desc);
create index office_workflow_events_actor_fk_idx on private.office_workflow_events(actor_id);
alter table private.office_workflow_events enable row level security;
revoke all on private.office_workflow_events from public,anon,authenticated;

create or replace function private.office_workflow_event_immutable()
returns trigger language plpgsql security definer set search_path=''
as $$ begin raise exception 'workflow event history is immutable' using errcode='55000'; end $$;
revoke all on function private.office_workflow_event_immutable() from public,anon,authenticated;
create trigger office_workflow_event_immutable before update or delete on private.office_workflow_events
for each row execute function private.office_workflow_event_immutable();

create or replace function private.office_workflow_instance_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='DELETE' then raise exception 'workflow instance cannot be deleted' using errcode='55000'; end if;
  if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
     or new.correspondence_collection is distinct from old.correspondence_collection
     or new.correspondence_id is distinct from old.correspondence_id
     or new.policy_key is distinct from old.policy_key or new.policy_version is distinct from old.policy_version
     or new.attached_by is distinct from old.attached_by or new.attached_at is distinct from old.attached_at
  then raise exception 'workflow instance identity and policy are immutable' using errcode='55000'; end if;
  return new;
end $$;
revoke all on function private.office_workflow_instance_guard() from public,anon,authenticated;
create trigger office_workflow_instance_guard before update or delete on private.office_workflow_instances
for each row execute function private.office_workflow_instance_guard();

create or replace function private.office_workflow_attach_impl(
  p_organization_id uuid,p_correspondence_id text,p_policy_key text,p_policy_version integer,p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid());
  v_source public.records%rowtype;
  v_policy private.office_workflow_policy_versions%rowtype;
  v_existing private.office_workflow_events%rowtype;
  v_instance_id uuid:=pg_catalog.gen_random_uuid();
  v_event_id uuid:=pg_catalog.gen_random_uuid();
  v_stage_id text; v_stage_label text; v_payload jsonb; v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_request_id is null or p_organization_id is null or p_correspondence_id is null or p_policy_key is null or p_policy_version is null or p_policy_version<=0 then raise exception 'invalid workflow attach input' using errcode='22023'; end if;
  if p_organization_id not in (select private.current_organization_ids()) or not private.organization_has_module_entitlement(p_organization_id,'office_automation',true) then raise exception 'workflow attach permission required' using errcode='42501'; end if;
  select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id for update;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read') or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'refer') then raise exception 'correspondence not found or not permitted' using errcode='42501'; end if;
  if coalesce(v_source.data->>'status','') not in ('registered','submitted') then raise exception 'correspondence state does not allow workflow attach' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('op','attach','correspondence_id',p_correspondence_id,'policy_key',p_policy_key,'policy_version',p_policy_version);
  select * into v_existing from private.office_workflow_events e where e.organization_id=p_organization_id and e.request_id=p_request_id;
  if found then
    if v_existing.actor_id<>v_uid then raise exception 'request key belongs to another actor' using errcode='42501'; end if;
    if v_existing.request_payload<>v_payload then raise exception 'request key reused with different payload' using errcode='23505'; end if;
    return v_existing.result_payload;
  end if;
  select * into v_policy from private.office_workflow_policy_versions p where p.organization_id=p_organization_id and p.policy_key=p_policy_key and p.version=p_policy_version;
  if not found then raise exception 'workflow policy not found' using errcode='22023'; end if;
  select s->>'id',s->>'label' into v_stage_id,v_stage_label from jsonb_array_elements(v_policy.definition->'stages') s where (s->>'start')::boolean;
  if exists(select 1 from private.office_workflow_instances i where i.organization_id=p_organization_id and i.correspondence_collection='correspondence' and i.correspondence_id=p_correspondence_id) then raise exception 'correspondence already has a workflow' using errcode='23505'; end if;
  insert into private.office_workflow_instances(id,organization_id,correspondence_collection,correspondence_id,policy_key,policy_version,stage_id,revision,attached_by) values(v_instance_id,p_organization_id,'correspondence',p_correspondence_id,p_policy_key,p_policy_version,v_stage_id,0,v_uid);
  v_result:=jsonb_build_object('instance_id',v_instance_id,'stage_id',v_stage_id,'revision',0,'event_id',v_event_id);
  insert into private.office_workflow_events(id,organization_id,instance_id,revision,request_id,actor_id,event_type,to_stage_id,to_stage_label,request_payload,result_payload) values(v_event_id,p_organization_id,v_instance_id,0,p_request_id,v_uid,'attach',v_stage_id,v_stage_label,v_payload,v_result);
  return v_result;
end $$;
revoke all on function private.office_workflow_attach_impl(uuid,text,text,integer,uuid) from public,anon;
grant execute on function private.office_workflow_attach_impl(uuid,text,text,integer,uuid) to authenticated;

create or replace function public.office_workflow_attach(p_organization_id uuid,p_correspondence_id text,p_policy_key text,p_policy_version integer,p_request_id uuid) returns jsonb
language sql security invoker set search_path=''
as $$ select private.office_workflow_attach_impl(p_organization_id,p_correspondence_id,p_policy_key,p_policy_version,p_request_id) $$;
revoke all on function public.office_workflow_attach(uuid,text,text,integer,uuid) from public,anon;
grant execute on function public.office_workflow_attach(uuid,text,text,integer,uuid) to authenticated;

create or replace function private.office_workflow_transition_impl(p_organization_id uuid,p_instance_id uuid,p_edge_id text,p_expected_revision bigint,p_request_id uuid,p_note text) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid()); v_locator private.office_workflow_instances%rowtype; v_instance private.office_workflow_instances%rowtype;
  v_source public.records%rowtype; v_policy private.office_workflow_policy_versions%rowtype; v_existing private.office_workflow_events%rowtype;
  v_edge jsonb; v_from_label text; v_to_label text; v_capability text; v_payload jsonb; v_result jsonb; v_event_id uuid:=pg_catalog.gen_random_uuid();
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_organization_id is null or p_instance_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_edge_id is null or p_edge_id !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' or (p_note is not null and char_length(p_note)>2000) then raise exception 'invalid workflow transition input' using errcode='22023'; end if;
  if p_organization_id not in (select private.current_organization_ids()) or not private.organization_has_module_entitlement(p_organization_id,'office_automation',true) then raise exception 'workflow transition permission required' using errcode='42501'; end if;
  select * into v_locator from private.office_workflow_instances i where i.organization_id=p_organization_id and i.id=p_instance_id;
  if not found then raise exception 'workflow instance not visible' using errcode='42501'; end if;
  select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=v_locator.correspondence_id for update;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read') then raise exception 'correspondence not visible' using errcode='42501'; end if;
  if coalesce(v_source.data->>'status','') not in ('registered','submitted') then raise exception 'correspondence state does not allow workflow transition' using errcode='22023'; end if;
  select * into v_instance from private.office_workflow_instances i where i.organization_id=p_organization_id and i.id=p_instance_id for update;
  if not found then raise exception 'workflow instance not visible' using errcode='42501'; end if;
  select * into v_policy from private.office_workflow_policy_versions p where p.organization_id=p_organization_id and p.policy_key=v_instance.policy_key and p.version=v_instance.policy_version;
  if not found then raise exception 'pinned workflow policy missing' using errcode='22023'; end if;
  select e into v_edge from jsonb_array_elements(v_policy.definition->'edges') e where e->>'id'=p_edge_id;
  if v_edge is null then raise exception 'workflow edge not found' using errcode='22023'; end if;
  v_capability:=v_edge->>'capability';
  if not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,v_capability) then raise exception 'workflow edge permission required' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('op','transition','instance_id',p_instance_id,'edge_id',p_edge_id,'expected_revision',p_expected_revision,'note',p_note);
  select * into v_existing from private.office_workflow_events e where e.organization_id=p_organization_id and e.request_id=p_request_id;
  if found then
    if v_existing.actor_id<>v_uid then raise exception 'request key belongs to another actor' using errcode='42501'; end if;
    if v_existing.request_payload<>v_payload then raise exception 'request key reused with different payload' using errcode='23505'; end if;
    return v_existing.result_payload;
  end if;
  if v_instance.revision<>p_expected_revision then raise exception 'stale workflow revision' using errcode='40001'; end if;
  if v_edge->>'from'<>v_instance.stage_id then raise exception 'workflow edge is not allowed from current stage' using errcode='22023'; end if;
  select s->>'label' into v_from_label from jsonb_array_elements(v_policy.definition->'stages') s where s->>'id'=v_instance.stage_id;
  select s->>'label' into v_to_label from jsonb_array_elements(v_policy.definition->'stages') s where s->>'id'=v_edge->>'to';
  v_result:=jsonb_build_object('instance_id',v_instance.id,'stage_id',v_edge->>'to','revision',v_instance.revision+1,'event_id',v_event_id);
  update private.office_workflow_instances set stage_id=v_edge->>'to',revision=v_instance.revision+1,updated_at=clock_timestamp() where id=v_instance.id;
  insert into private.office_workflow_events(id,organization_id,instance_id,revision,request_id,actor_id,event_type,edge_id,edge_label,from_stage_id,from_stage_label,to_stage_id,to_stage_label,note,request_payload,result_payload)
  values(v_event_id,p_organization_id,v_instance.id,v_instance.revision+1,p_request_id,v_uid,'transition',p_edge_id,v_edge->>'label',v_instance.stage_id,v_from_label,v_edge->>'to',v_to_label,p_note,v_payload,v_result);
  return v_result;
end $$;
revoke all on function private.office_workflow_transition_impl(uuid,uuid,text,bigint,uuid,text) from public,anon;
grant execute on function private.office_workflow_transition_impl(uuid,uuid,text,bigint,uuid,text) to authenticated;

create or replace function public.office_workflow_transition(p_organization_id uuid,p_instance_id uuid,p_edge_id text,p_expected_revision bigint,p_request_id uuid,p_note text) returns jsonb
language sql security invoker set search_path=''
as $$ select private.office_workflow_transition_impl(p_organization_id,p_instance_id,p_edge_id,p_expected_revision,p_request_id,p_note) $$;
revoke all on function public.office_workflow_transition(uuid,uuid,text,bigint,uuid,text) from public,anon;
grant execute on function public.office_workflow_transition(uuid,uuid,text,bigint,uuid,text) to authenticated;

create or replace function private.office_workflow_read_impl(p_organization_id uuid,p_correspondence_id text,p_after_revision bigint,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_uid uuid:=(select auth.uid()); v_source public.records%rowtype; v_instance private.office_workflow_instances%rowtype;
  v_policy private.office_workflow_policy_versions%rowtype; v_allowed jsonb:='[]'::jsonb; v_events jsonb:='[]'::jsonb; v_next bigint:=p_after_revision; v_instance_json jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_organization_id is null or p_correspondence_id is null or p_after_revision is null or p_after_revision < -1 or p_limit is null or p_limit<1 or p_limit>100 then raise exception 'invalid workflow read input' using errcode='22023'; end if;
  if p_organization_id not in (select private.current_organization_ids()) or not private.organization_has_module_entitlement(p_organization_id,'office_automation',false) then raise exception 'workflow read permission required' using errcode='42501'; end if;
  select * into v_source from public.records r where r.organization_id=p_organization_id and r.collection='correspondence' and r.id=p_correspondence_id;
  if not found or not private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,'read') then raise exception 'correspondence not visible' using errcode='42501'; end if;
  select * into v_instance from private.office_workflow_instances i where i.organization_id=p_organization_id and i.correspondence_collection='correspondence' and i.correspondence_id=p_correspondence_id;
  if not found then return jsonb_build_object('instance',null,'allowed_edges','[]'::jsonb,'events','[]'::jsonb,'next_after_revision',p_after_revision); end if;
  select * into v_policy from private.office_workflow_policy_versions p where p.organization_id=p_organization_id and p.policy_key=v_instance.policy_key and p.version=v_instance.policy_version;
  if not found then raise exception 'pinned workflow policy missing' using errcode='22023'; end if;
  if private.organization_has_module_entitlement(p_organization_id,'office_automation',true) then
    select coalesce(jsonb_agg(e order by e->>'id'),'[]'::jsonb) into v_allowed from jsonb_array_elements(v_policy.definition->'edges') e where e->>'from'=v_instance.stage_id and private.can_access_record(p_organization_id,'correspondence',v_source.owner_id,v_source.data,e->>'capability');
  end if;
  select coalesce(jsonb_agg(x.obj order by x.revision),'[]'::jsonb),coalesce(max(x.revision),p_after_revision) into v_events,v_next
  from (select e.revision,jsonb_build_object('event_id',e.id,'revision',e.revision,'event_type',e.event_type,'edge_id',e.edge_id,'edge_label',e.edge_label,'from_stage_id',e.from_stage_id,'from_stage_label',e.from_stage_label,'to_stage_id',e.to_stage_id,'to_stage_label',e.to_stage_label,'actor_id',e.actor_id,'note',e.note,'created_at',e.created_at) obj from private.office_workflow_events e where e.organization_id=p_organization_id and e.instance_id=v_instance.id and e.revision>p_after_revision order by e.revision limit p_limit) x;
  v_instance_json:=jsonb_build_object('instance_id',v_instance.id,'policy_key',v_instance.policy_key,'policy_version',v_instance.policy_version,'policy_title',v_policy.title,'stage_id',v_instance.stage_id,'stage_label',(select s->>'label' from jsonb_array_elements(v_policy.definition->'stages') s where s->>'id'=v_instance.stage_id),'revision',v_instance.revision);
  return jsonb_build_object('instance',v_instance_json,'allowed_edges',v_allowed,'events',v_events,'next_after_revision',v_next);
end $$;
revoke all on function private.office_workflow_read_impl(uuid,text,bigint,integer) from public,anon;
grant execute on function private.office_workflow_read_impl(uuid,text,bigint,integer) to authenticated;

create or replace function public.office_workflow_read(p_organization_id uuid,p_correspondence_id text,p_after_revision bigint,p_limit integer) returns jsonb
language sql stable security invoker set search_path=''
as $$ select private.office_workflow_read_impl(p_organization_id,p_correspondence_id,p_after_revision,p_limit) $$;
revoke all on function public.office_workflow_read(uuid,text,bigint,integer) from public,anon;
grant execute on function public.office_workflow_read(uuid,text,bigint,integer) to authenticated;
