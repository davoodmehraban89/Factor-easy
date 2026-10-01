-- Slice D2: non-destructive legacy request cutover into the D1 server model.
-- Legacy records remain in public.records for rollback/audit; imported rows are traceable and idempotent.

alter table public.request_type_definitions add column if not exists legacy_record_id text;
alter table public.request_instances add column if not exists legacy_record_id text;
alter table public.request_instances add column if not exists legacy_number text;

create unique index if not exists request_type_definitions_org_legacy_record_uidx
  on public.request_type_definitions(organization_id,legacy_record_id) where legacy_record_id is not null;
create unique index if not exists request_instances_org_legacy_record_uidx
  on public.request_instances(organization_id,legacy_record_id) where legacy_record_id is not null;

insert into public.request_type_definitions(
  id,organization_id,code,title,category,revision,active,created_by,created_at,updated_at,legacy_record_id
)
select
  md5('legacy-request-type:'||r.organization_id::text||':'||r.id)::uuid,
  r.organization_id,
  upper(trim(r.data->>'code')),
  trim(r.data->>'title'),
  nullif(trim(r.data->>'category'),''),
  1,
  coalesce((r.data->>'active')::boolean,true),
  r.owner_id,
  coalesce(nullif(r.data->>'createdAt','')::timestamptz,now()),
  coalesce(nullif(r.data->>'createdAt','')::timestamptz,now()),
  r.id
from public.records r
where r.collection='requestTypes'
  and nullif(trim(r.data->>'code'),'') is not null
  and nullif(trim(r.data->>'title'),'') is not null
on conflict do nothing;

insert into public.request_type_versions(
  id,organization_id,request_type_id,version_no,title,category,form_schema,published_by,published_at
)
select
  md5('legacy-request-version:'||r.organization_id::text||':'||r.id)::uuid,
  r.organization_id,
  d.id,
  1,
  d.title,
  d.category,
  jsonb_build_object('schemaVersion',1,'fields',case when jsonb_typeof(r.data->'fields')='array' then r.data->'fields' else '[]'::jsonb end,'legacyImported',true),
  r.owner_id,
  coalesce(nullif(r.data->>'createdAt','')::timestamptz,now())
from public.records r
join public.request_type_definitions d
  on d.organization_id=r.organization_id
 and (d.legacy_record_id=r.id or d.code=upper(trim(r.data->>'code')))
where r.collection='requestTypes'
on conflict do nothing;

insert into public.request_workflow_versions(
  id,organization_id,request_type_version_id,workflow_schema,published_by,published_at
)
select
  md5('legacy-request-workflow:'||r.organization_id::text||':'||r.id)::uuid,
  r.organization_id,
  v.id,
  case when jsonb_typeof(r.data->'workflow')='object' then (r.data->'workflow')||jsonb_build_object('schemaVersion',1,'legacyImported',true) else jsonb_build_object('schemaVersion',1,'mode','single_owner','steps','[]'::jsonb,'legacyImported',true) end,
  r.owner_id,
  coalesce(nullif(r.data->>'createdAt','')::timestamptz,now())
from public.records r
join public.request_type_definitions d
  on d.organization_id=r.organization_id
 and (d.legacy_record_id=r.id or d.code=upper(trim(r.data->>'code')))
join public.request_type_versions v on v.request_type_id=d.id and v.version_no=1
where r.collection='requestTypes'
on conflict do nothing;

insert into public.request_instances(
  id,organization_id,request_type_version_id,workflow_version_id,requester_user_id,values_json,status,revision,idempotency_key,created_at,updated_at,legacy_record_id,legacy_number
)
select
  md5('legacy-request-instance:'||r.organization_id::text||':'||r.id)::uuid,
  r.organization_id,
  v.id,
  w.id,
  r.owner_id,
  case when jsonb_typeof(r.data->'values')='object' then r.data->'values' else '{}'::jsonb end,
  case when lower(coalesce(r.data->>'status','submitted')) in ('draft','submitted','approved','rejected','returned','cancelled') then lower(coalesce(r.data->>'status','submitted')) else 'submitted' end,
  1,
  'legacy:'||md5(r.organization_id::text||':'||r.id),
  coalesce(nullif(r.data->>'createdAt','')::timestamptz,now()),
  coalesce(nullif(r.data->>'submittedAt','')::timestamptz,nullif(r.data->>'createdAt','')::timestamptz,now()),
  r.id,
  nullif(trim(r.data->>'number'),'')
from public.records r
join public.records rt
  on rt.organization_id=r.organization_id
 and rt.collection='requestTypes'
 and rt.id=r.data->>'requestTypeId'
join public.request_type_definitions d
  on d.organization_id=rt.organization_id
 and (d.legacy_record_id=rt.id or d.code=upper(trim(rt.data->>'code')))
join public.request_type_versions v on v.request_type_id=d.id and v.version_no=1
join public.request_workflow_versions w on w.request_type_version_id=v.id
where r.collection='requests'
on conflict do nothing;

insert into public.request_instance_events(
  id,organization_id,request_instance_id,actor_user_id,action,from_status,to_status,revision,note,idempotency_key,created_at
)
select
  md5('legacy-request-event:'||r.organization_id::text||':'||r.id)::uuid,
  r.organization_id,
  i.id,
  r.owner_id,
  'legacy_import',
  null,
  i.status,
  1,
  'Imported non-destructively from legacy records collection',
  'legacy-event:'||md5(r.organization_id::text||':'||r.id),
  i.created_at
from public.records r
join public.request_instances i
  on i.organization_id=r.organization_id and i.legacy_record_id=r.id
where r.collection='requests'
on conflict do nothing;
