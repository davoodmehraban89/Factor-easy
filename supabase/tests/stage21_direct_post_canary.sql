\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('stage21.phase', :'stage21phase',true);
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES('dddd4444-4444-4444-8444-444444444444','00000000-0000-0000-0000-000000000000',
'authenticated','authenticated','stage21-local@example.invalid',now(),'{}'::jsonb);
SELECT set_config('stage21.org',(SELECT organization_id::text FROM public.organization_members
WHERE user_id='dddd4444-4444-4444-8444-444444444444' LIMIT 1),true);
INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES
(current_setting('stage21.org')::uuid,'dddd4444-4444-4444-8444-444444444444','companies',
'COMP_CANARY','{"name":"Isolated company"}'::jsonb),
(current_setting('stage21.org')::uuid,'dddd4444-4444-4444-8444-444444444444','fiscalYears',
'FY_CANARY','{"companyId":"COMP_CANARY","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'::jsonb),
(current_setting('stage21.org')::uuid,'dddd4444-4444-4444-8444-444444444444','accounts',
'ACC_CASH_CANARY','{"companyId":"COMP_CANARY","code":"1101","title":"Cash","accountType":"asset","normalBalance":"debit","postingAllowed":true,"active":true,"level":"detail"}'::jsonb),
(current_setting('stage21.org')::uuid,'dddd4444-4444-4444-8444-444444444444','accounts',
'ACC_REVENUE_CANARY','{"companyId":"COMP_CANARY","code":"4101","title":"Revenue","accountType":"revenue","normalBalance":"credit","postingAllowed":true,"active":true,"level":"detail"}'::jsonb);
INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode)
VALUES(current_setting('stage21.org')::uuid,'enforce');
DO $t$ BEGIN
 IF private.finora_phase1a_mode(current_setting('stage21.org')::uuid)<>'enforce' THEN
  RAISE EXCEPTION 'FINORA_STAGE21_GUARD_NOT_ENFORCE';END IF;
 RAISE NOTICE 'STAGE21_GUARD_ENFORCE_PROVED';
END $t$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','dddd4444-4444-4444-8444-444444444444',true);
SELECT public.finora_journal_create_draft(current_setting('stage21.org')::uuid,'CANARY_MANUAL_01',
'{"companyId":"COMP_CANARY","fiscalYearId":"FY_CANARY","date":"1405/07/26","sourceType":"manual"}'::jsonb,
'[{"accountId":"ACC_CASH_CANARY","debit":100,"credit":0},
{"accountId":"ACC_REVENUE_CANARY","debit":0,"credit":100}]'::jsonb);
DO $t$
DECLARE org uuid:=current_setting('stage21.org')::uuid;
BEGIN
 BEGIN
  PERFORM public.finora_sync_records_v2(jsonb_build_array(jsonb_build_object(
  'collection','journalVouchers','id','CANARY_MANUAL_01','expected_version',1,
  'data',(SELECT data||'{"status":"posted","number":"999","postedAt":"fake"}'::jsonb
   FROM public.records WHERE organization_id=org AND collection='journalVouchers'
   AND id='CANARY_MANUAL_01'))),'[]'::jsonb,org);
  RAISE EXCEPTION 'STAGE21_UNSAFE_STATUS_WRITE_ACCEPTED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%FINORA_SERVER_ONLY_JOURNAL_FIELDS%' THEN RAISE;END IF;
 END;
 IF (SELECT data->>'status' FROM public.records WHERE organization_id=org
  AND collection='journalVouchers' AND id='CANARY_MANUAL_01')<>'draft'
 THEN RAISE EXCEPTION 'STAGE21_UNSAFE_WRITE_CHANGED_RECORD';END IF;
 RAISE NOTICE 'STAGE21_DIRECT_STATUS_POST_BLOCKED: FINORA_SERVER_ONLY_JOURNAL_FIELDS';
 IF current_setting('stage21.phase')='red' THEN
  RAISE EXCEPTION 'STAGE21_EXPECTED_RED_AFTER_PROVING_REJECTION';
 END IF;
END $t$;
DO $t$
DECLARE r jsonb;
BEGIN
 r:=public.finora_journal_post(current_setting('stage21.org')::uuid,'CANARY_MANUAL_01',1);
 IF r#>>'{voucher,status}'<>'posted'
 OR (r#>>'{voucher,version}')::integer<2
 OR coalesce(r#>>'{voucher,number}','')=''
 OR coalesce(r#>>'{voucher,postedAt}','')=''
 THEN RAISE EXCEPTION 'STAGE21_AUTHORIZED_RPC_FAILED';END IF;
 RAISE NOTICE 'STAGE21_AUTHORIZED_RPC_PASS status=% version=%',
  r#>>'{voucher,status}',r#>>'{voucher,version}';
END $t$;
RESET ROLE;
DO $t$
DECLARE org uuid:=current_setting('stage21.org')::uuid;
BEGIN
 IF (SELECT count(*) FROM public.records WHERE organization_id=org
 AND collection='journalVouchers' AND id='CANARY_MANUAL_01' AND data->>'status'='posted')<>1
 OR (SELECT count(*) FROM public.records WHERE organization_id=org
 AND collection='journalLines' AND data->>'voucherId'='CANARY_MANUAL_01')<>2
 THEN RAISE EXCEPTION 'STAGE21_DATABASE_STATE_INVALID';END IF;
 RAISE NOTICE 'STAGE21_DATABASE_LINES_STATUS_VERIFIED';
END $t$;
ROLLBACK;
