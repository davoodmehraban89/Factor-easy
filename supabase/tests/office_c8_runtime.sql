-- Office C8 Task 2 transactional behavior. Entire fixture rolls back.
begin;

do $$
begin
  if to_regclass('private.office_workflow_instances') is null then raise exception 'C8 runtime instances table missing'; end if;
  if to_regclass('private.office_workflow_events') is null then raise exception 'C8 runtime events table missing'; end if;
  if to_regprocedure('public.office_workflow_attach(uuid,text,text,integer,uuid)') is null then raise exception 'C8 attach RPC missing'; end if;
  if to_regprocedure('public.office_workflow_transition(uuid,uuid,text,bigint,uuid,text)') is null then raise exception 'C8 transition RPC missing'; end if;
  if to_regprocedure('public.office_workflow_read(uuid,text,bigint,integer)') is null then raise exception 'C8 read RPC missing'; end if;
end $$;

insert into public.profiles(id) values
 ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222') on conflict do nothing;
insert into public.organizations(id,owner_user_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222') on conflict do nothing;
insert into public.records(organization_id,owner_id,collection,id,data) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','correspondence','LETTER_OK','{"status":"registered","subject":"نامه آزمون"}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','correspondence','LETTER_DRAFT','{"status":"draft"}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','correspondence','LETTER_CLOSED','{"status":"closed"}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','correspondence','LETTER_NULL','{}'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','correspondence','LETTER_REPLAY','{"status":"submitted"}')
on conflict do nothing;
insert into private.office_workflow_policy_versions(organization_id,policy_key,version,title,definition,published_by)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','basic',1,'گردش <آزمون>',
 '{"stages":[{"id":"start","label":"شروع <امن>","start":true,"terminal":false},{"id":"review","label":"بررسی","start":false,"terminal":false},{"id":"done","label":"پایان","start":false,"terminal":true}],"edges":[{"id":"to_review","from":"start","to":"review","label":"ارجاع \"بررسی\"","capability":"refer"},{"id":"to_done","from":"review","to":"done","label":"تأیید نهایی","capability":"approve"}]}'::jsonb,
 '11111111-1111-4111-8111-111111111111');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claim.member_active','true',true);
select set_config('request.jwt.claim.entitled','true',true);
select set_config('request.jwt.claim.write','true',true);
select set_config('request.jwt.claim.readable','true',true);
select set_config('request.jwt.claim.capabilities','read,refer,edit,approve,configure',true);

do $$
declare a jsonb; t jsonb; r jsonb; iid uuid; eid uuid;
begin
  a:=public.office_workflow_attach('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK','basic',1,'00000000-0000-4000-8000-000000000001');
  if a->>'stage_id'<>'start' or (a->>'revision')::bigint<>0 then raise exception 'attach result mismatch: %',a; end if;
  iid:=(a->>'instance_id')::uuid; eid:=(a->>'event_id')::uuid;
  if (select count(*) from private.office_workflow_events where instance_id=iid)<>1 then raise exception 'attach must create exactly one event'; end if;
  if public.office_workflow_attach('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK','basic',1,'00000000-0000-4000-8000-000000000001')<>a then raise exception 'attach retry must return original result'; end if;
  if (select count(*) from private.office_workflow_events where instance_id=iid)<>1 then raise exception 'attach retry duplicated event'; end if;

  t:=public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_review',0,'00000000-0000-4000-8000-000000000002','برای بررسی');
  if t->>'stage_id'<>'review' or (t->>'revision')::bigint<>1 then raise exception 'transition result mismatch: %',t; end if;
  if public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_review',0,'00000000-0000-4000-8000-000000000002','برای بررسی')<>t then raise exception 'transition retry must return original result'; end if;
  if (select count(*) from private.office_workflow_events where instance_id=iid and revision=1)<>1 then raise exception 'transition retry duplicated revision'; end if;

  begin perform public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_review',0,'00000000-0000-4000-8000-000000000003','stale'); raise exception 'stale revision accepted'; exception when serialization_failure then null; end;
  begin perform public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_review',1,'00000000-0000-4000-8000-000000000004','illegal'); raise exception 'illegal edge accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_done',null,'00000000-0000-4000-8000-000000000005','null revision'); raise exception 'null revision accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_done',-1,'00000000-0000-4000-8000-000000000006','negative'); raise exception 'negative revision accepted'; exception when invalid_parameter_value then null; end;

  t:=public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_done',1,'00000000-0000-4000-8000-000000000007','تمام');
  if t->>'stage_id'<>'done' or (t->>'revision')::bigint<>2 then raise exception 'terminal transition mismatch'; end if;
  r:=public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK',-1,100);
  if (r->'instance'->>'policy_key')<>'basic' or (r->'instance'->>'policy_version')::int<>1 or jsonb_array_length(r->'events')<>3 then raise exception 'read history mismatch: %',r; end if;
  if r->'events'->0->>'to_stage_label'<>'شروع <امن>' then raise exception 'historical stage label lost'; end if;
  if coalesce(r->'events'->1->>'edge_label','')<>'ارجاع "بررسی"' then raise exception 'historical edge label lost'; end if;
end $$;

-- Invalid source states fail closed.
do $$ begin
  begin perform public.office_workflow_attach('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_DRAFT','basic',1,'00000000-0000-4000-8000-000000000010'); raise exception 'draft attach accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.office_workflow_attach('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_CLOSED','basic',1,'00000000-0000-4000-8000-000000000011'); raise exception 'closed attach accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.office_workflow_attach('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_NULL','basic',1,'00000000-0000-4000-8000-000000000012'); raise exception 'null status attach accepted'; exception when invalid_parameter_value then null; end;
end $$;

-- Expired/read-only entitlement preserves read but blocks writes and replay leakage.
do $$ declare a jsonb; iid uuid; t jsonb; begin
  a:=public.office_workflow_attach('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_REPLAY','basic',1,'00000000-0000-4000-8000-000000000020'); iid:=(a->>'instance_id')::uuid;
  t:=public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_review',0,'00000000-0000-4000-8000-000000000021','first');
  perform set_config('request.jwt.claim.write','false',true);
  if public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_REPLAY',-1,10)->'instance' is null then raise exception 'expired read-only access lost history'; end if;
  if jsonb_array_length(public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_REPLAY',-1,10)->'allowed_edges')<>0 then raise exception 'expired read returned executable edges'; end if;
  begin perform public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_review',0,'00000000-0000-4000-8000-000000000021','first'); raise exception 'expired replay leaked prior result'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.write','true',true);
  perform set_config('request.jwt.claim.capabilities','read',true);
  begin perform public.office_workflow_transition('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',iid,'to_review',0,'00000000-0000-4000-8000-000000000021','first'); raise exception 'revoked capability replay leaked prior result'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.capabilities','read,refer,edit,approve,configure',true);
end $$;

-- Membership/tenant/visibility/auth denial.
do $$ begin
  perform set_config('request.jwt.claim.member_active','false',true);
  begin perform public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK',-1,10); raise exception 'suspended member read accepted'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.member_active','true',true);
  perform set_config('request.jwt.claim.org','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
  begin perform public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK',-1,10); raise exception 'foreign tenant read accepted'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.org','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  perform set_config('request.jwt.claim.readable','false',true);
  begin perform public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK',-1,10); raise exception 'unreadable record read accepted'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.readable','true',true);
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK',-1,10); raise exception 'anonymous read accepted'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
end $$;

-- Direct client DML is closed; immutable evidence/policy binding survives privileged attempts.
do $$ declare iid uuid; begin
  if has_table_privilege('authenticated','private.office_workflow_instances','INSERT') then raise exception 'authenticated can insert instances directly'; end if;
  if has_table_privilege('authenticated','private.office_workflow_events','INSERT') then raise exception 'authenticated can insert events directly'; end if;
  select id into iid from private.office_workflow_instances where correspondence_id='LETTER_OK';
  begin update private.office_workflow_events set note='forged' where instance_id=iid and revision=1; raise exception 'event update accepted'; exception when object_not_in_prerequisite_state then null; end;
  begin delete from private.office_workflow_events where instance_id=iid and revision=1; raise exception 'event delete accepted'; exception when object_not_in_prerequisite_state then null; end;
  begin update private.office_workflow_instances set policy_version=99 where id=iid; raise exception 'pinned policy mutation accepted'; exception when object_not_in_prerequisite_state then null; end;
end $$;

-- Cursor and request-key validation.
do $$ begin
  begin perform public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK',-2,10); raise exception 'invalid cursor accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.office_workflow_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_OK',-1,0); raise exception 'invalid limit accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.office_workflow_attach('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_DRAFT','basic',1,null); raise exception 'null request id accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.office_workflow_attach('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LETTER_REPLAY','basic',1,'00000000-0000-4000-8000-000000000020'); raise exception 'reused request key with different payload accepted'; exception when unique_violation then null; end;
end $$;

rollback;
