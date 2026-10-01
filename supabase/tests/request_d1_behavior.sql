\set ON_ERROR_STOP on
insert into public.profiles(id) values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222') on conflict do nothing;
insert into public.organizations(id,owner_user_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.write','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);

create temporary table d1_ids(k text primary key,v uuid);
insert into d1_ids select 'type_v1',request_type_version_id from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','leave','مرخصی','HR','{"fields":[{"key":"days"}]}'::jsonb,'{"steps":[{"key":"manager"}]}'::jsonb,0);
insert into d1_ids select 'type_v2',request_type_version_id from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','leave','مرخصی سالانه','HR','{"fields":[{"key":"days"},{"key":"reason"}]}'::jsonb,'{"steps":[{"key":"manager"},{"key":"hr"}]}'::jsonb,1);
do $$ begin
  if (select count(*) from public.request_type_versions where organization_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')<>2 then raise exception 'expected two immutable request type versions'; end if;
  if (select revision from public.request_type_definitions where organization_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and code='LEAVE')<>2 then raise exception 'definition revision did not advance'; end if;
end $$;

insert into d1_ids values('instance1',public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d1_ids where k='type_v1'),'{"days":2}'::jsonb,'create-00000001'));
do $$ declare a uuid; b uuid; begin
  a=(select v from d1_ids where k='instance1'); b=public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d1_ids where k='type_v1'),'{"days":999}'::jsonb,'create-00000001');
  if a<>b then raise exception 'idempotent create returned a different instance'; end if;
  if (select request_type_version_id from public.request_instances where id=a)<>(select v from d1_ids where k='type_v1') then raise exception 'instance did not pin type version'; end if;
end $$;

select * from public.request_transition_instance((select v from d1_ids where k='instance1'),'approve',1,'transition-000001','ok');
do $$ declare i uuid; begin
  i=(select v from d1_ids where k='instance1');
  if (select status from public.request_instances where id=i)<>'approved' then raise exception 'approve transition failed'; end if;
  if (select revision from public.request_instances where id=i)<>2 then raise exception 'revision did not advance'; end if;
  if not exists(select 1 from public.request_instance_events where request_instance_id=i and action='approve' and from_status='submitted' and to_status='approved' and revision=2) then raise exception 'immutable transition evidence is incorrect'; end if;
end $$;
select * from public.request_transition_instance((select v from d1_ids where k='instance1'),'approve',1,'transition-000001','retry');

insert into d1_ids values('instance2',public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from d1_ids where k='type_v2'),'{"days":1}'::jsonb,'create-00000002'));
do $$ begin
  begin perform * from public.request_transition_instance((select v from d1_ids where k='instance2'),'approve',99,'transition-000002','stale'); raise exception 'stale revision unexpectedly succeeded'; exception when others then if position('stale revision' in sqlerrm)=0 then raise; end if; end;
end $$;

select set_config('request.jwt.claim.capabilities','read,create',false);
do $$ begin
  begin perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','purchase','خرید',null,'{}','{}',0); raise exception 'publish without configure unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;

do $$ begin
  begin insert into public.request_instances(organization_id,request_type_version_id,workflow_version_id,requester_user_id,idempotency_key) select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v.id,w.id,'11111111-1111-1111-1111-111111111111','direct-00000001' from public.request_type_versions v join public.request_workflow_versions w on w.request_type_version_id=v.id limit 1; raise exception 'direct instance insert unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;

do $$ begin
  begin update public.request_instance_events set note='tamper' where request_instance_id=(select v from d1_ids where k='instance1'); raise exception 'event update unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.org','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
do $$ begin if exists(select 1 from public.request_type_definitions) then raise exception 'cross-tenant request type leakage'; end if; if exists(select 1 from public.request_instances) then raise exception 'cross-tenant request instance leakage'; end if; end $$;
reset role;
