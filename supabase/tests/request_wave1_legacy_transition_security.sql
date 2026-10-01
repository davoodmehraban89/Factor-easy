\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.write','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);

create temporary table wave1_ids(k text primary key,v uuid);
insert into wave1_ids
select 'legacy_type',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W1_LEGACY','Legacy security',null,
 '{"schemaVersion":1,"fields":[]}'::jsonb,
 '{"schemaVersion":1}'::jsonb,
 0
);
insert into wave1_ids values(
 'legacy_instance',
 public.request_create_instance(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select v from wave1_ids where k='legacy_type'),
  '{}'::jsonb,
  'wave1-create-legacy-0001'
 )
);
select * from public.request_transition_instance(
 (select v from wave1_ids where k='legacy_instance'),
 'approve',1,'wave1-transition-legacy-0001','first authorized transition'
);
-- Authorized replay remains stable even though the supplied expected revision is stale.
select * from public.request_transition_instance(
 (select v from wave1_ids where k='legacy_instance'),
 'approve',1,'wave1-transition-legacy-0001','authorized retry'
);

-- F-409: a caller who no longer has transition capability must not learn/replay
-- a prior successful idempotency result.
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select set_config('request.jwt.claim.capabilities','read',false);
do $$
begin
  begin
    perform * from public.request_transition_instance(
      (select v from wave1_ids where k='legacy_instance'),
      'approve',1,'wave1-transition-legacy-0001','unauthorized replay'
    );
    raise exception 'F-409: unauthorized idempotent replay unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

-- F-410: even a fully-authorized approver cannot bypass D3 step/quorum state
-- through the legacy transition endpoint.
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
insert into wave1_ids
select 'd3_type',request_type_version_id from public.request_publish_type_version(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W1_D3','D3 bypass guard',null,
 '{"schemaVersion":1,"fields":[]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"manager","title":"Manager","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve"}]}'::jsonb,
 0
);
insert into wave1_ids values(
 'd3_instance',
 public.request_create_instance(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (select v from wave1_ids where k='d3_type'),
  '{}'::jsonb,
  'wave1-create-d3-0000001'
 )
);
do $$
begin
  begin
    perform * from public.request_transition_instance(
      (select v from wave1_ids where k='d3_instance'),
      'approve',1,'wave1-legacy-bypass-0001','must fail'
    );
    raise exception 'F-410: D3 request bypassed step runtime through legacy transition';
  exception when object_not_in_prerequisite_state then
    if position('D3 workflow requires request_step_decide' in sqlerrm)=0 then raise; end if;
  end;
end $$;

reset role;
do $$
declare legacy_id uuid; d3_id uuid;
begin
  legacy_id=(select v from wave1_ids where k='legacy_instance');
  d3_id=(select v from wave1_ids where k='d3_instance');
  if (select status from public.request_instances where id=legacy_id)<>'approved' then raise exception 'legacy transition status drifted'; end if;
  if (select revision from public.request_instances where id=legacy_id)<>2 then raise exception 'legacy replay mutated revision'; end if;
  if (select count(*) from public.request_instance_events where request_instance_id=legacy_id and idempotency_key='wave1-transition-legacy-0001')<>1 then raise exception 'legacy replay duplicated evidence'; end if;
  if (select status from public.request_instances where id=d3_id)<>'submitted' then raise exception 'D3 bypass attempt mutated request status'; end if;
  if (select revision from public.request_instances where id=d3_id)<>1 then raise exception 'D3 bypass attempt mutated revision'; end if;
  if not exists(select 1 from private.request_step_instances where request_instance_id=d3_id and state='active') then raise exception 'D3 active step missing after bypass attempt'; end if;
end $$;
