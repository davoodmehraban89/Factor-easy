-- Two fiscal years, immutable legacy numbers and transaction rollback gaplessness.
-- 100% disposable Supabase CLI; every fixture is rolled back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES('12345678-aaaa-4aaa-8aaa-123456789012','00000000-0000-0000-0000-000000000000',
'authenticated','authenticated','phase1a-counter-fy@example.invalid',now(),'{}'::jsonb);
SELECT set_config('phase1a_counter.org',(SELECT organization_id::text FROM public.organization_members
 WHERE user_id='12345678-aaaa-4aaa-8aaa-123456789012' LIMIT 1),true);
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES(current_setting('phase1a_counter.org')::uuid,'12345678-aaaa-4aaa-8aaa-123456789012',
 'companies','COMP_COUNTER','{"name":"Two-year Counter Company"}');
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES
(current_setting('phase1a_counter.org')::uuid,'12345678-aaaa-4aaa-8aaa-123456789012',
 'fiscalYears','FY_FIRST','{"companyId":"COMP_COUNTER","startDate":"1405/01/01","endDate":"1405/06/31","status":"open"}'),
(current_setting('phase1a_counter.org')::uuid,'12345678-aaaa-4aaa-8aaa-123456789012',
 'fiscalYears','FY_SECOND','{"companyId":"COMP_COUNTER","startDate":"1405/07/01","endDate":"1405/12/29","status":"open"}');
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES
(current_setting('phase1a_counter.org')::uuid,'12345678-aaaa-4aaa-8aaa-123456789012',
 'accounts','COUNTER_DEBIT','{"companyId":"COMP_COUNTER","postingAllowed":true,"active":true}'),
(current_setting('phase1a_counter.org')::uuid,'12345678-aaaa-4aaa-8aaa-123456789012',
 'accounts','COUNTER_CREDIT','{"companyId":"COMP_COUNTER","postingAllowed":true,"active":true}');
-- Historic pre-1A numbered posted vouchers: deliberately seeded while mode off.
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES
(current_setting('phase1a_counter.org')::uuid,'12345678-aaaa-4aaa-8aaa-123456789012','journalVouchers',
 'OLD_FIRST_40','{"companyId":"COMP_COUNTER","fiscalYearId":"FY_FIRST","status":"posted","number":"40","date":"1405/03/01"}'),
(current_setting('phase1a_counter.org')::uuid,'12345678-aaaa-4aaa-8aaa-123456789012','journalVouchers',
 'OLD_SECOND_11','{"companyId":"COMP_COUNTER","fiscalYearId":"FY_SECOND","status":"posted","number":"11","date":"1405/09/01"}');
INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode)
VALUES(current_setting('phase1a_counter.org')::uuid,'enforce');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','12345678-aaaa-4aaa-8aaa-123456789012',true);
SELECT public.finora_journal_create_draft(current_setting('phase1a_counter.org')::uuid,'NEW_FIRST_41',
 '{"companyId":"COMP_COUNTER","fiscalYearId":"FY_FIRST","date":"1405/05/01"}',
 '[{"accountId":"COUNTER_DEBIT","debit":9900,"credit":0},{"accountId":"COUNTER_CREDIT","debit":0,"credit":9900}]');
SELECT public.finora_journal_create_draft(current_setting('phase1a_counter.org')::uuid,'NEW_SECOND_12',
 '{"companyId":"COMP_COUNTER","fiscalYearId":"FY_SECOND","date":"1405/10/01"}',
 '[{"accountId":"COUNTER_DEBIT","debit":18000,"credit":0},{"accountId":"COUNTER_CREDIT","debit":0,"credit":18000}]');
-- Consume and ROLLBACK an allocated number: the counter must roll back too.
SAVEPOINT rollback_number;
SELECT public.finora_journal_post(current_setting('phase1a_counter.org')::uuid,'NEW_FIRST_41',1);
ROLLBACK TO SAVEPOINT rollback_number;
SELECT public.finora_journal_post(current_setting('phase1a_counter.org')::uuid,'NEW_FIRST_41',1);
SELECT public.finora_journal_post(current_setting('phase1a_counter.org')::uuid,'NEW_SECOND_12',1);
DO $test$
DECLARE v_first text;v_second text;counter_first bigint;counter_second bigint;
BEGIN
 SELECT data->>'number' INTO v_first FROM public.records
 WHERE organization_id=current_setting('phase1a_counter.org')::uuid
 AND collection='journalVouchers' AND id='NEW_FIRST_41';
 SELECT data->>'number' INTO v_second FROM public.records
 WHERE organization_id=current_setting('phase1a_counter.org')::uuid
 AND collection='journalVouchers' AND id='NEW_SECOND_12';
 SELECT last_no INTO counter_first FROM private.finora_phase1a_journal_counters
 WHERE organization_id=current_setting('phase1a_counter.org')::uuid AND fiscal_year_id='FY_FIRST';
 SELECT last_no INTO counter_second FROM private.finora_phase1a_journal_counters
 WHERE organization_id=current_setting('phase1a_counter.org')::uuid AND fiscal_year_id='FY_SECOND';
 IF v_first<>'41' OR v_second<>'12' OR counter_first<>41 OR counter_second<>12 THEN
   RAISE EXCEPTION 'FINORA_STAGE1_COUNTER_BOOTSTRAP_OR_ROLLBACK_FAILED first=% second=% counters=%,%',
   v_first,v_second,counter_first,counter_second;END IF;
 RAISE NOTICE 'FINORA_STAGE1_COUNTER_PASS years=2 first_legacy=40 next=41 second_legacy=11 next=12 rollback_consumed=0';
END $test$;
RESET ROLE;
ROLLBACK;
