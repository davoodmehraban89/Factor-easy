\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.write','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);

create temporary table wave2_ids(k text primary key,v uuid);
insert into wave2_ids
select 'v1',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W2_FORM','Wave 2 form','Integrity',
 '{"schemaVersion":1,"fields":[{"key":"title","label":"Title","type":"text","required":true},{"key":"amount","label":"Amount","type":"number","required":true},{"key":"due","label":"Due","type":"date","required":true},{"key":"note","label":"Note","type":"textarea","required":false},{"key":"kind","label":"Kind","type":"select","required":true,"options":["A","B"]}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"manager","title":"Manager","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","condition":{"field":"amount","op":"gte","value":1000}},{"key":"finance","title":"Finance","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve"}]}'::jsonb,0
);
insert into wave2_ids values('instance_v1',public.request_create_instance(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v1'),
 '{"title":"Laptop","amount":500,"due":"2026-10-10","note":"ok","kind":"A"}'::jsonb,'wave2-create-v1-0001'
));

insert into wave2_ids
select 'v2',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W2_FORM','Wave 2 form v2','Integrity',
 '{"schemaVersion":1,"fields":[{"key":"title","label":"Title","type":"text","required":true},{"key":"amount","label":"Amount","type":"number","required":true},{"key":"due","label":"Due","type":"date","required":true},{"key":"note","label":"Note","type":"textarea","required":false},{"key":"kind","label":"Kind","type":"select","required":true,"options":["A","B"]}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"manager","title":"Manager","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","condition":{"field":"amount","op":"gte","value":1000}},{"key":"finance","title":"Finance","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve"}]}'::jsonb,1
);

do $$ declare a uuid;b uuid;begin
 a=(select v from wave2_ids where k='instance_v1');
 b=public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v1'),'{"title":"Laptop","amount":500,"due":"2026-10-10","note":"ok","kind":"A"}'::jsonb,'wave2-create-v1-0001');
 if a<>b then raise exception 'same-command idempotent replay changed id'; end if;
 begin
  perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v1'),'{"title":"Laptop","amount":999,"due":"2026-10-10","note":"ok","kind":"A"}'::jsonb,'wave2-create-v1-0001');
  raise exception 'F-414 conflicting idempotency payload unexpectedly succeeded';
 exception when unique_violation then null; end;
 begin
  perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v1'),'{"title":"Old","amount":1,"due":"2026-10-10","kind":"A"}'::jsonb,'wave2-old-version-0001');
  raise exception 'F-417 obsolete version unexpectedly accepted';
 exception when object_not_in_prerequisite_state then if position('not current' in sqlerrm)=0 then raise;end if;end;
end $$;

do $$ begin
 begin perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v2'),'{"amount":1,"due":"2026-10-10","kind":"A"}'::jsonb,'wave2-missing-00001');raise exception 'F-411 missing required field accepted';exception when others then if position('required request field title is missing' in sqlerrm)=0 then raise;end if;end;
 begin perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v2'),'{"title":"X","amount":"1","due":"2026-10-10","kind":"A"}'::jsonb,'wave2-number-00001');raise exception 'F-411 string number accepted';exception when others then if position('must be a number' in sqlerrm)=0 then raise;end if;end;
 begin perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v2'),'{"title":"X","amount":1,"due":"2026-02-31","kind":"A"}'::jsonb,'wave2-date-0000001');raise exception 'F-411 invalid date accepted';exception when others then if position('invalid date' in sqlerrm)=0 then raise;end if;end;
 begin perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v2'),'{"title":"X","amount":1,"due":"2026-10-10","kind":"C"}'::jsonb,'wave2-select-00001');raise exception 'F-411 invalid select option accepted';exception when others then if position('unsupported option' in sqlerrm)=0 then raise;end if;end;
 begin perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v2'),'{"title":"X","amount":1,"due":"2026-10-10","kind":"A","ghost":1}'::jsonb,'wave2-unknown-0001');raise exception 'F-411 unknown field accepted';exception when others then if position('unknown field' in sqlerrm)=0 then raise;end if;end;
end $$;

do $$ begin
 begin
  perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W2_BAD_FIELD','Bad field',null,
   '{"schemaVersion":1,"fields":[{"key":"amount","label":"Amount","type":"number","required":true}]}'::jsonb,
   '{"schemaVersion":2,"steps":[{"key":"x","title":"X","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","condition":{"field":"amunt","op":"gte","value":1}}]}'::jsonb,0);
  raise exception 'F-418 unbound condition field unexpectedly published';
 exception when others then if position('does not exist in form schema' in sqlerrm)=0 then raise;end if;end;
 begin
  perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W2_BAD_OPTYPE','Bad type',null,
   '{"schemaVersion":1,"fields":[{"key":"title","label":"Title","type":"text","required":true}]}'::jsonb,
   '{"schemaVersion":2,"steps":[{"key":"x","title":"X","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","condition":{"field":"title","op":"gt","value":"a"}}]}'::jsonb,0);
  raise exception 'F-418 incompatible condition operator unexpectedly published';
 exception when others then if position('requires a number field' in sqlerrm)=0 then raise;end if;end;
end $$;

insert into wave2_ids
select 'no_match',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W2_NO_MATCH','No match','Integrity',
 '{"schemaVersion":1,"fields":[{"key":"amount","label":"Amount","type":"number","required":true}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"manager","title":"Manager","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve","condition":{"field":"amount","op":"gt","value":1000}}]}'::jsonb,0
);
do $$ begin
 begin
  perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='no_match'),'{"amount":500}'::jsonb,'wave2-nomatch-0001');
  raise exception 'F-418 all-false workflow auto-approved';
 exception when object_not_in_prerequisite_state then if position('no applicable approval step' in sqlerrm)=0 then raise;end if;end;
end $$;

reset role;
update public.request_type_definitions set active=false where organization_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and code='W2_FORM';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read,create',false);
do $$ begin
 begin
  perform public.request_create_instance('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave2_ids where k='v2'),'{"title":"X","amount":1,"due":"2026-10-10","kind":"A"}'::jsonb,'wave2-inactive-0001');
  raise exception 'F-417 inactive definition unexpectedly accepted';
 exception when object_not_in_prerequisite_state then if position('inactive' in sqlerrm)=0 then raise;end if;end;
end $$;
reset role;

do $$ begin
 if exists(select 1 from public.request_instances where idempotency_key in ('wave2-missing-00001','wave2-number-00001','wave2-date-0000001','wave2-select-00001','wave2-unknown-0001','wave2-old-version-0001','wave2-nomatch-0001','wave2-inactive-0001')) then
  raise exception 'failed Wave 2 commands left persistent request rows';
 end if;
end $$;
