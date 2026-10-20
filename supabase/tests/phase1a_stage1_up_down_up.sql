-- Stage 1 UP / conservative DOWN / UP. Disposable Supabase CLI only.
-- DOWN removes exposed APIs and view; PRESERVES accounting/audit/counter rows,
-- unique indexes, and internal rollback-compatible structures to avoid data loss.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES('ffff6666-6666-4666-8666-666666666666','00000000-0000-0000-0000-000000000000',
'authenticated','authenticated','phase1a-rollback-real@example.invalid',now(),'{}'::jsonb);
SELECT set_config('finora_rb.org',(SELECT organization_id::text FROM public.organization_members
WHERE user_id='ffff6666-6666-4666-8666-666666666666' LIMIT 1),true);
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES(current_setting('finora_rb.org')::uuid,'ffff6666-6666-4666-8666-666666666666',
'companies','COMP_RB_REAL','{"name":"Retail Sample Company"}');
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES(current_setting('finora_rb.org')::uuid,'ffff6666-6666-4666-8666-666666666666',
'fiscalYears','FY_RB_REAL','{"companyId":"COMP_RB_REAL","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}');
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
VALUES
(current_setting('finora_rb.org')::uuid,'ffff6666-6666-4666-8666-666666666666','accounts','BANK_REAL',
'{"companyId":"COMP_RB_REAL","code":"1101","title":"بانک جاری","postingAllowed":true,"active":true}'),
(current_setting('finora_rb.org')::uuid,'ffff6666-6666-4666-8666-666666666666','accounts','SALES_REAL',
'{"companyId":"COMP_RB_REAL","code":"4101","title":"درآمد فروش","postingAllowed":true,"active":true}');
INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode)
VALUES(current_setting('finora_rb.org')::uuid,'enforce');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ffff6666-6666-4666-8666-666666666666',true);
SELECT public.finora_journal_create_draft(current_setting('finora_rb.org')::uuid,'RB_REAL_SALE_001',
 '{"companyId":"COMP_RB_REAL","fiscalYearId":"FY_RB_REAL","date":"1405/07/24","description":"فروش کالای نمونه"}',
 '[{"accountId":"BANK_REAL","debit":12340000,"credit":0},{"accountId":"SALES_REAL","debit":0,"credit":12340000}]');
SELECT public.finora_journal_post(current_setting('finora_rb.org')::uuid,'RB_REAL_SALE_001',1);
SELECT public.finora_journal_reverse(current_setting('finora_rb.org')::uuid,'RB_REAL_SALE_001',
'RB_REAL_REVERSAL_001','1405/07/24','برگشت حسابداری نمونه',2,NULL);
RESET ROLE;
DO $snapshot$
BEGIN
 IF (SELECT count(*) FROM public.records WHERE organization_id=current_setting('finora_rb.org')::uuid
  AND collection='journalVouchers' AND id LIKE 'RB_REAL_%')<>2
 OR (SELECT count(*) FROM private.finora_phase1a_journal_audit
  WHERE organization_id=current_setting('finora_rb.org')::uuid AND action IN ('posted','reversed'))<>3
 OR (SELECT last_no FROM private.finora_phase1a_journal_counters
  WHERE organization_id=current_setting('finora_rb.org')::uuid AND fiscal_year_id='FY_RB_REAL')<>2 THEN
   RAISE EXCEPTION 'FINORA_STAGE1_ROLLBACK_INITIAL_DATA_INVALID';
 END IF;
END $snapshot$;
-- DOWN: drop the public exposed surfaces, NOT financial data, audit, or counters.
DROP VIEW public.finora_journal_reversal_status;
DROP FUNCTION public.finora_journal_create_draft(uuid,text,jsonb,jsonb);
DROP FUNCTION public.finora_journal_update_draft(uuid,text,bigint,jsonb,jsonb);
DROP FUNCTION public.finora_journal_post(uuid,text,bigint);
DROP FUNCTION public.finora_journal_delete_draft(uuid,text,bigint);
DROP FUNCTION public.finora_journal_autopost(uuid,text,text,text,jsonb,jsonb);
DROP FUNCTION public.finora_journal_reverse(uuid,text,text,text,text,bigint,jsonb);
DO $down$
BEGIN
 IF to_regprocedure('public.finora_journal_post(uuid,text,bigint)') IS NOT NULL
 OR (SELECT count(*) FROM public.records WHERE organization_id=current_setting('finora_rb.org')::uuid
  AND collection='journalVouchers' AND id LIKE 'RB_REAL_%')<>2
 OR (SELECT count(*) FROM private.finora_phase1a_journal_audit
  WHERE organization_id=current_setting('finora_rb.org')::uuid AND action IN ('posted','reversed'))<>3
 THEN RAISE EXCEPTION 'FINORA_STAGE1_ROLLBACK_DOWN_LOST_DATA_OR_API';END IF;
END $down$;
-- UP again: restores only SQL definitions and grants. Existing records immutable.
\i /tmp/finora-phase1a-migrations/20261016102000_phase1a_journal_rpc_surface.sql
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','ffff6666-6666-4666-8666-666666666666',true);
DO $verify$
DECLARE x jsonb;
BEGIN
 x:=public.finora_journal_post(current_setting('finora_rb.org')::uuid,'RB_REAL_SALE_001',2);
 IF x#>>'{voucher,number}'<>'1' OR x->>'replayed'<>'true'
 THEN RAISE EXCEPTION 'FINORA_STAGE1_ROLLBACK_POST_REPLAY_MISMATCH';END IF;
 IF (SELECT effective_status FROM public.finora_journal_reversal_status
 WHERE organization_id=current_setting('finora_rb.org')::uuid
 AND voucher_id='RB_REAL_SALE_001')<>'reversed'
 THEN RAISE EXCEPTION 'FINORA_STAGE1_ROLLBACK_VIEW_MISMATCH';END IF;
 RAISE NOTICE 'FINORA_STAGE1_UP_DOWN_UP_PASS source=retail_sale amount=12340000 posted_original_immutable audit=preserved counter=preserved';
END $verify$;
RESET ROLE;
ROLLBACK;
