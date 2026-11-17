-- Regression contract: malformed/unbalanced raw posting and post-hoc child inserts must be rejected.
-- Baseline has no RPC: fixture is explicitly privileged. Green uses the actual posting RPC.
-- All data is synthetic and rolled back. Unexpected exceptions never count as rejection.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('b1000000-0000-4000-8000-000000000001','wp1-direct@example.invalid',now(),'{}');
select set_config('wp1.org',(select id::text from public.organizations where owner_user_id='b1000000-0000-4000-8000-000000000001'),true);
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
insert into public.records(owner_id,organization_id,collection,id,data) values
(auth.uid(),current_setting('wp1.org')::uuid,'companies','WP1_C','{"name":"WP1 synthetic"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'fiscalYears','WP1_Y','{"companyId":"WP1_C","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','WP1_A','{"companyId":"WP1_C","code":"1101","active":true,"postingAllowed":true}'),
(auth.uid(),current_setting('wp1.org')::uuid,'accounts','WP1_B','{"companyId":"WP1_C","code":"4101","active":true,"postingAllowed":true}');
do $$begin
 if to_regclass('private.finora_phase1a_guard_modes') is not null then
  execute 'insert into private.finora_phase1a_guard_modes(organization_id,mode) values($1,''enforce'') on conflict(organization_id) do update set mode=''enforce''' using current_setting('wp1.org')::uuid;
 else
  insert into public.records(owner_id,organization_id,collection,id,data) values
  (auth.uid(),current_setting('wp1.org')::uuid,'journalVouchers','WP1_D2','{"id":"WP1_D2","status":"draft","companyId":"WP1_C","fiscalYearId":"WP1_Y","date":"1405/07/24"}'),
  (auth.uid(),current_setting('wp1.org')::uuid,'journalLines','WP1_D2_L1','{"voucherId":"WP1_D2","companyId":"WP1_C","fiscalYearId":"WP1_Y","lineNo":1,"accountId":"WP1_A","debit":1000,"credit":0}'),
  (auth.uid(),current_setting('wp1.org')::uuid,'journalLines','WP1_D2_L2','{"voucherId":"WP1_D2","companyId":"WP1_C","fiscalYearId":"WP1_Y","lineNo":2,"accountId":"WP1_B","debit":0,"credit":1000}');
  update public.records set data=data||'{"status":"posted","number":2}' where collection='journalVouchers' and id='WP1_D2';
 end if;
end $$;
set local role authenticated;
do $$declare org uuid:=current_setting('wp1.org')::uuid; r jsonb; failed text[]:='{}'; parent_line text;
begin
 if to_regprocedure('public.finora_journal_post(uuid,text,bigint)') is not null then
  r:=public.finora_journal_create_draft(org,'WP1_D2','{"companyId":"WP1_C","fiscalYearId":"WP1_Y","date":"1405/07/24"}',
  '[{"accountId":"WP1_A","debit":1000,"credit":0},{"accountId":"WP1_B","debit":0,"credit":1000}]');
  perform public.finora_journal_post(org,'WP1_D2',(r#>>'{voucher,version}')::bigint);
 end if;
 set constraints all immediate;
 if (select sum((data->>'debit')::numeric-(data->>'credit')::numeric) from public.records where organization_id=org and collection='journalLines' and data->>'voucherId'='WP1_D2')<>0 then raise exception 'WP1_D2_FIXTURE_NOT_BALANCED';end if;
 -- Claim/GUC setters must never constitute posting authority.
 perform set_config('finora.posting','on',true);
 perform set_config('finora.phase1a_posting','on',true);
 perform set_config('finora.phase1a_server','on',true);
 begin
  insert into public.records(owner_id,organization_id,collection,id,data) values
  (auth.uid(),org,'journalVouchers','WP1_D1','{"id":"WP1_D1","status":"posted","number":81,"companyId":"WP1_C","fiscalYearId":"WP1_Y","date":"1405/07/24"}'),
  (auth.uid(),org,'journalLines','WP1_D1_L1','{"voucherId":"WP1_D1","accountId":"WP1_A","debit":1000,"credit":0}'),
  (auth.uid(),org,'journalLines','WP1_D1_L2','{"voucherId":"WP1_D1","accountId":"WP1_B","debit":0,"credit":300}');
  set constraints all immediate;
  raise exception 'WP1_ACCEPTED_D1';
 exception when others then
  if sqlerrm='WP1_ACCEPTED_D1' then failed:=array_append(failed,'D1');
  elsif sqlerrm not like 'FINORA_SERVER_ONLY_JOURNAL_FIELDS%' and sqlerrm not like 'FINORA_UNBALANCED_POSTED_JOURNAL%' then raise;end if;
 end;
 begin
  insert into public.records(owner_id,organization_id,collection,id,data) values
   (auth.uid(),org,'journalLines','WP1_D2_L3','{"voucherId":"WP1_D2","companyId":"WP1_C","fiscalYearId":"WP1_Y","accountId":"WP1_A","debit":5000,"credit":0}');
  set constraints all immediate;
  raise exception 'WP1_ACCEPTED_D2';
 exception when others then
  if sqlerrm='WP1_ACCEPTED_D2' then failed:=array_append(failed,'D2');
  elsif sqlerrm not like 'FINORA_POSTED_JOURNAL_CHILD_IMMUTABLE%' then raise;end if;
 end;
 select id into strict parent_line from public.records where organization_id=org and collection='journalLines' and data->>'voucherId'='WP1_D2' order by id limit 1;
 begin
  insert into public.records(owner_id,organization_id,collection,id,data) values
   (auth.uid(),org,'journalLineDimensions','WP1_D2_DIM',jsonb_build_object('voucherId','WP1_D2','journalLineId',parent_line));
  set constraints all immediate;
  raise exception 'WP1_ACCEPTED_D2_DIMENSION';
 exception when others then
  if sqlerrm='WP1_ACCEPTED_D2_DIMENSION' then failed:=array_append(failed,'D2_DIMENSION');
  elsif sqlerrm not like 'FINORA_POSTED_JOURNAL_CHILD_IMMUTABLE%' then raise;end if;
 end;
 if cardinality(failed)>0 then raise exception 'WP1_REQUIRED_GUARDS_MISSING: %',array_to_string(failed,',');end if;
 raise notice 'WP1_DIRECT_GUARDS_PASS: D1, independent RPC-balanced D2, dimension insert, spoofed GUC';
end $$;

-- Privileged DML isolates trigger enforcement from RLS: moving a posted row from
-- ENFORCE into an AUDIT organization must not downgrade its original protection.
reset role;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('b5000000-0000-4000-8000-000000000001','wp1-move@example.invalid',now(),'{}');
select set_config('wp1.destination',(select id::text from public.organizations where owner_user_id='b5000000-0000-4000-8000-000000000001'),true);
insert into private.finora_phase1a_guard_modes(organization_id,mode) values(current_setting('wp1.destination')::uuid,'audit');
do $$begin
 begin
  update public.records set organization_id=current_setting('wp1.destination')::uuid
   where organization_id=current_setting('wp1.org')::uuid and collection='journalVouchers' and id='WP1_D2';
  set constraints all immediate;
  raise exception 'WP1_POSTED_ORG_MOVE_ACCEPTED';
 exception when check_violation then
  if sqlerrm not like 'FINORA_POSTED_JOURNAL_IDENTITY_IMMUTABLE%' then raise;end if;
 end;
 if not exists(select from public.records where organization_id=current_setting('wp1.org')::uuid and collection='journalVouchers' and id='WP1_D2') then raise exception 'WP1_POSTED_ORIGINAL_LOST';end if;
 raise notice 'WP1_POSTED_ORG_MOVE_PASS: old ENFORCE dominates new AUDIT, original untouched';
end $$;
rollback;
