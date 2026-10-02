\set ON_ERROR_STOP on
insert into public.profiles(id) values ('88888888-8888-8888-8888-888888888888'),('99999999-9999-9999-9999-999999999999') on conflict do nothing;
insert into public.organization_members(organization_id,user_id,status,is_owner,position_title) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','88888888-8888-8888-8888-888888888888','active',false,'Wave4 delegate A'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','99999999-9999-9999-9999-999999999999','active',false,'Wave4 delegate B')
on conflict(organization_id,user_id) do update set status='active';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('request.jwt.claim.org','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.member_active','true',false);
select set_config('request.jwt.claim.entitled','true',false);
select set_config('request.jwt.claim.capabilities','read,configure,create,edit,approve',false);
do $$ begin begin
 perform * from public.request_publish_type_version('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','W4_DUP_OUTBOX','duplicate outbox',null,
 '{"schemaVersion":1,"fields":[{"key":"subject","label":"Subject","type":"text","required":true}]}'::jsonb,
 '{"schemaVersion":2,"steps":[{"key":"approve","title":"Approve","mode":"sequential","requiredApprovals":1,"requiredCapability":"approve"}],"onApproved":[{"targetModule":"commerce","actionKey":"create_purchase_draft","payload":{"slot":1}},{"targetModule":"COMMERCE","actionKey":"CREATE_PURCHASE_DRAFT","payload":{"slot":2}}]}'::jsonb,0);
 raise exception 'F-420 duplicate outbox identity unexpectedly published';
exception when others then if position('duplicate outbox target/action intent' in sqlerrm)=0 then raise;end if;end;end $$;
create temporary table wave4_ids(k text primary key,v uuid);
insert into wave4_ids values('delegation',public.request_create_delegation(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','88888888-8888-8888-8888-888888888888','approve',
 '2026-10-03T08:00:00Z','2026-10-03T18:00:00Z','wave4 test','wave4-delegation-0001'));
do $$ declare a uuid;b uuid;begin
 a=(select v from wave4_ids where k='delegation');
 b=public.request_create_delegation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','88888888-8888-8888-8888-888888888888','approve','2026-10-03T08:00:00Z','2026-10-03T18:00:00Z','wave4 test','wave4-delegation-0001');
 if a<>b then raise exception 'F-422 idempotent create returned a different delegation';end if;
 if (select count(*) from public.organization_audit where action='request_delegation_created' and entity_id=a::text)<>1 then raise exception 'F-422 idempotent create duplicated audit evidence';end if;
end $$;
do $$ begin begin
 perform public.request_create_delegation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','99999999-9999-9999-9999-999999999999','approve','2026-10-03T08:00:00Z','2026-10-03T18:00:00Z','different command','wave4-delegation-0001');
 raise exception 'F-422 idempotency key accepted a different command';
exception when unique_violation then null;end;end $$;
do $$ begin begin
 perform public.request_create_delegation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','99999999-9999-9999-9999-999999999999','approve','2026-10-03T12:00:00Z','2026-10-03T20:00:00Z','overlap','wave4-delegation-0002');
 raise exception 'F-422 overlapping delegation unexpectedly succeeded';
exception when exclusion_violation then null;end;end $$;
select public.request_revoke_delegation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave4_ids where k='delegation'));
select public.request_revoke_delegation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select v from wave4_ids where k='delegation'));
do $$ declare d uuid;begin d=(select v from wave4_ids where k='delegation');
 if (select count(*) from public.organization_audit where action='request_delegation_revoked' and entity_id=d::text)<>1 then raise exception 'F-422 revoke retry duplicated semantic audit evidence';end if;
end $$;
reset role;
