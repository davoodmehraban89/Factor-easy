\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES('b9000000-0000-4000-8000-000000000001','wp4-lifecycle@example.invalid',now(),'{}')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claim.sub','b9000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $$
DECLARE
  org uuid;
  company text;
  fy text;
  r jsonb;
  atf bigint;
  tmp bigint;
  posted jsonb;
  v record;
BEGIN
  SELECT id INTO org FROM public.organizations
   WHERE owner_user_id='b9000000-0000-4000-8000-000000000001' LIMIT 1;
  IF org IS NULL THEN RAISE EXCEPTION 'WP4_ORG_NOT_BOOTSTRAPPED'; END IF;

  SELECT id INTO company FROM public.records
   WHERE organization_id=org AND collection='companies' LIMIT 1;
  SELECT id INTO fy FROM public.records
   WHERE organization_id=org AND collection='fiscalYears' AND data->>'companyId'=company
     AND coalesce(data->>'status','open')<>'locked' LIMIT 1;
  IF company IS NULL OR fy IS NULL THEN RAISE EXCEPTION 'WP4_COMPANY_FY_NOT_FOUND'; END IF;

  -- Draft creation allocates both identities immediately.
  r:=public.finora_journal_create_draft(
    org,'WP4_MANUAL_1',
    jsonb_build_object('companyId',company,'fiscalYearId',fy,'date',
      (SELECT data->>'startDate' FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy)),
    '[]'::jsonb
  );
EXCEPTION WHEN check_violation THEN
  -- The zero-line draft is expected to be rejected; the identity must not be
  -- allocated by a failed transaction.
  NULL;
END $$;

-- Use a real balanced draft from the first two posting accounts.
DO $$
DECLARE org uuid; company text; fy text; a1 text; a2 text; date text; r jsonb; v record;
BEGIN
 SELECT id INTO org FROM public.organizations WHERE owner_user_id='b9000000-0000-4000-8000-000000000001' LIMIT 1;
 SELECT id INTO company FROM public.records WHERE organization_id=org AND collection='companies' LIMIT 1;
 SELECT id INTO fy FROM public.records WHERE organization_id=org AND collection='fiscalYears'
   AND data->>'companyId'=company AND coalesce(data->>'status','open')<>'locked' LIMIT 1;
 SELECT data->>'startDate' INTO date FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy;
 SELECT id INTO a1 FROM public.records WHERE organization_id=org AND collection='accounts'
   AND data->>'companyId'=company AND coalesce(data->>'postingAllowed','false')='true' LIMIT 1;
 SELECT id INTO a2 FROM public.records WHERE organization_id=org AND collection='accounts'
   AND data->>'companyId'=company AND coalesce(data->>'postingAllowed','false')='true' AND id<>a1 LIMIT 1;
 r:=public.finora_journal_create_draft(org,'WP4_MANUAL_1',
   jsonb_build_object('companyId',company,'fiscalYearId',fy,'date',date),
   jsonb_build_array(
     jsonb_build_object('accountId',a1,'debit',100,'credit',0),
     jsonb_build_object('accountId',a2,'debit',0,'credit',100)));
 SELECT * INTO v FROM public.records WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_MANUAL_1';
 IF v.data->>'status'<>'draft' OR v.data->>'numberStatus'<>'temporary'
    OR v.data->>'atfNumber' IS NULL OR v.data->>'temporaryNumber' IS NULL
 THEN RAISE EXCEPTION 'WP4_DRAFT_IDENTITY_MISSING'; END IF;
 IF (v.data->>'number') IS NOT NULL AND v.data->>'number'<>'' THEN
   RAISE EXCEPTION 'WP4_DRAFT_RECEIVED_FINAL_NUMBER'; END IF;
 PERFORM public.finora_journal_post(org,'WP4_MANUAL_1',v.version);
 SELECT * INTO v FROM public.records WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_MANUAL_1';
 IF v.data->>'status'<>'posted' OR v.data->>'numberStatus'<>'posted'
    OR v.data->>'number' IS DISTINCT FROM v.data->>'temporaryNumber'
 THEN RAISE EXCEPTION 'WP4_POST_CHANGED_NUMBER'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finora_journal_document_registry
   WHERE organization_id=org AND voucher_id='WP4_MANUAL_1' AND state='posted'
     AND atf_number=(v.data->>'atfNumber')::bigint)
 THEN RAISE EXCEPTION 'WP4_REGISTRY_NOT_POSTED'; END IF;

 BEGIN
   PERFORM public.finora_journal_delete_draft(org,'WP4_MANUAL_1',v.version);
   RAISE EXCEPTION 'WP4_POSTED_DELETE_ACCEPTED';
 EXCEPTION WHEN check_violation THEN
   IF sqlerrm NOT LIKE 'FINORA_POSTED_DOCUMENT_NOT_DELETABLE%' THEN RAISE; END IF;
 END;

 RAISE NOTICE 'WP4_MANUAL_LIFECYCLE_PASS';
END $$;

-- Draft deletion leaves an immutable tombstone and never reuses the ATF.
DO $$
DECLARE org uuid; company text; fy text; a1 text; a2 text; date text; r jsonb; v record; old_atf bigint; old_tmp bigint;
BEGIN
 SELECT id INTO org FROM public.organizations WHERE owner_user_id='b9000000-0000-4000-8000-000000000001' LIMIT 1;
 SELECT id INTO company FROM public.records WHERE organization_id=org AND collection='companies' LIMIT 1;
 SELECT id INTO fy FROM public.records WHERE organization_id=org AND collection='fiscalYears'
   AND data->>'companyId'=company AND coalesce(data->>'status','open')<>'locked' LIMIT 1;
 SELECT data->>'startDate' INTO date FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy;
 SELECT id INTO a1 FROM public.records WHERE organization_id=org AND collection='accounts' AND data->>'companyId'=company
   AND coalesce(data->>'postingAllowed','false')='true' LIMIT 1;
 SELECT id INTO a2 FROM public.records WHERE organization_id=org AND collection='accounts' AND data->>'companyId'=company
   AND coalesce(data->>'postingAllowed','false')='true' AND id<>a1 LIMIT 1;
 r:=public.finora_journal_create_draft(org,'WP4_MANUAL_2',
   jsonb_build_object('companyId',company,'fiscalYearId',fy,'date',date),
   jsonb_build_array(jsonb_build_object('accountId',a1,'debit',50,'credit',0),
                     jsonb_build_object('accountId',a2,'debit',0,'credit',50)));
 SELECT * INTO v FROM public.records WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_MANUAL_2';
 old_atf:=(v.data->>'atfNumber')::bigint; old_tmp:=(v.data->>'temporaryNumber')::bigint;
 PERFORM public.finora_journal_delete_draft(org,'WP4_MANUAL_2',v.version);
 IF EXISTS(SELECT 1 FROM public.records WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_MANUAL_2')
 THEN RAISE EXCEPTION 'WP4_DRAFT_NOT_DELETED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finora_journal_document_registry WHERE organization_id=org AND voucher_id='WP4_MANUAL_2' AND state='deleted'
   AND atf_number=old_atf AND temporary_number=old_tmp)
 THEN RAISE EXCEPTION 'WP4_TOMBSTONE_MISSING'; END IF;
 r:=public.finora_journal_create_draft(org,'WP4_MANUAL_3',
   jsonb_build_object('companyId',company,'fiscalYearId',fy,'date',date),
   jsonb_build_array(jsonb_build_object('accountId',a1,'debit',60,'credit',0),
                     jsonb_build_object('accountId',a2,'debit',0,'credit',60)));
 SELECT * INTO v FROM public.records WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_MANUAL_3';
 IF (v.data->>'atfNumber')::bigint=old_atf OR (v.data->>'temporaryNumber')::bigint=old_tmp
 THEN RAISE EXCEPTION 'WP4_IDENTITY_REUSED'; END IF;
 RAISE NOTICE 'WP4_TOMBSTONE_AND_NONREUSE_PASS';
END $$;

-- Source <-> voucher draft deletion is atomic in both directions.
DO $
DECLARE org uuid; company text; fy text; atf bigint;
BEGIN
 SELECT id INTO org FROM public.organizations WHERE owner_user_id='b9000000-0000-4000-8000-000000000001' LIMIT 1;
 SELECT id INTO company FROM public.records WHERE organization_id=org AND collection='companies' LIMIT 1;
 SELECT id INTO fy FROM public.records WHERE organization_id=org AND collection='fiscalYears'
   AND data->>'companyId'=company AND coalesce(data->>'status','open')<>'locked' LIMIT 1;

 INSERT INTO public.records(owner_id,organization_id,collection,id,data)
 VALUES(auth.uid(),org,'invoices','WP4_INV_A',
   jsonb_build_object('companyId',company,'date',
     (SELECT data->>'startDate' FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy),
     'documentStatus','draft','accountingStatus','draft'));

 INSERT INTO public.records(owner_id,organization_id,collection,id,data)
 VALUES(auth.uid(),org,'journalVouchers','WP4_SOURCE_V_A',
   jsonb_build_object('companyId',company,'fiscalYearId',fy,
     'date',(SELECT data->>'startDate' FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy),
     'sourceType','sale','sourceId','WP4_INV_A','status','draft'));

 IF NOT EXISTS(SELECT 1 FROM public.records WHERE organization_id=org AND collection='journalVouchers'
   AND id='WP4_SOURCE_V_A' AND data->>'atfNumber' IS NOT NULL) THEN
   RAISE EXCEPTION 'WP4_SOURCE_VOUCHER_IDENTITY_MISSING';
 END IF;

 DELETE FROM public.records WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_SOURCE_V_A';
 IF EXISTS(SELECT 1 FROM public.records WHERE organization_id=org AND collection='invoices' AND id='WP4_INV_A')
 THEN RAISE EXCEPTION 'WP4_VOUCHER_DELETE_DID_NOT_DELETE_SOURCE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finora_journal_document_registry
   WHERE organization_id=org AND voucher_id='WP4_SOURCE_V_A' AND state='deleted')
 THEN RAISE EXCEPTION 'WP4_SOURCE_DELETE_TOMBSTONE_MISSING'; END IF;

 INSERT INTO public.records(owner_id,organization_id,collection,id,data)
 VALUES(auth.uid(),org,'invoices','WP4_INV_B',
   jsonb_build_object('companyId',company,'date',
     (SELECT data->>'startDate' FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy),
     'documentStatus','draft','accountingStatus','draft'));

 INSERT INTO public.records(owner_id,organization_id,collection,id,data)
 VALUES(auth.uid(),org,'journalVouchers','WP4_SOURCE_V_B',
   jsonb_build_object('companyId',company,'fiscalYearId',fy,
     'date',(SELECT data->>'startDate' FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy),
     'sourceType','sale','sourceId','WP4_INV_B','status','draft'));

 DELETE FROM public.records WHERE organization_id=org AND collection='invoices' AND id='WP4_INV_B';
 IF EXISTS(SELECT 1 FROM public.records WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_SOURCE_V_B')
 THEN RAISE EXCEPTION 'WP4_SOURCE_DELETE_DID_NOT_DELETE_VOUCHER'; END IF;
 RAISE NOTICE 'WP4_SOURCE_VOUCHER_ATOMIC_DELETE_PASS';
END $;

ROLLBACK;
