\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
VALUES('b9000000-0000-4000-8000-000000000001','wp4-lifecycle@example.invalid',now(),'{}')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claim.sub','b9000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

-- Disposable fixture only: the Auth signup trigger creates owner/organization,
-- license and member records, but does not create a company, fiscal year or
-- posting accounts. Seed the minimum legal draft context in this transaction.
DO $fixture$
DECLARE v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations
   WHERE owner_user_id='b9000000-0000-4000-8000-000000000001' LIMIT 1;
  IF v_org IS NULL THEN RAISE EXCEPTION 'WP4_ORG_NOT_BOOTSTRAPPED'; END IF;
  INSERT INTO public.records(organization_id,owner_id,collection,id,data) VALUES
   (v_org,'b9000000-0000-4000-8000-000000000001','companies','WP4_COMPANY',
     '{"name":"WP4 local fixture company"}'::jsonb),
   (v_org,'b9000000-0000-4000-8000-000000000001','fiscalYears','WP4_FY',
     '{"companyId":"WP4_COMPANY","startDate":"1405/01/01","endDate":"1405/12/29","status":"open"}'::jsonb),
   (v_org,'b9000000-0000-4000-8000-000000000001','accounts','WP4_ACCOUNT_DEBIT',
     '{"companyId":"WP4_COMPANY","code":"WP4D","name":"Debit fixture","postingAllowed":true,"active":true}'::jsonb),
   (v_org,'b9000000-0000-4000-8000-000000000001','accounts','WP4_ACCOUNT_CREDIT',
     '{"companyId":"WP4_COMPANY","code":"WP4C","name":"Credit fixture","postingAllowed":true,"active":true}'::jsonb);
END $fixture$;

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
   -- Existing authoritative delete-draft RPC rejects non-draft rows with
   -- FINORA_DRAFT_DELETE_FORBIDDEN; a lifecycle guard may instead raise
   -- FINORA_POSTED_DOCUMENT_NOT_DELETABLE. Both are SQLSTATE 23514.
   IF sqlerrm NOT IN ('FINORA_DRAFT_DELETE_FORBIDDEN',
      'FINORA_POSTED_DOCUMENT_NOT_DELETABLE') THEN RAISE; END IF;
 END;
 SELECT * INTO v FROM public.records
  WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_MANUAL_1';
 IF NOT FOUND OR v.data->>'status'<>'posted'
   OR v.data->>'numberStatus'<>'posted' THEN
   RAISE EXCEPTION 'WP4_POSTED_VOUCHER_MUTATED_AFTER_DENIED_DELETE';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.finora_journal_document_registry
    WHERE organization_id=org AND voucher_id='WP4_MANUAL_1' AND state='posted')
 THEN RAISE EXCEPTION 'WP4_POSTED_REGISTRY_MUTATED_AFTER_DENIED_DELETE'; END IF;
 IF (SELECT count(*) FROM public.records WHERE organization_id=org
     AND collection='journalLines' AND data->>'voucherId'='WP4_MANUAL_1')<>2
 THEN RAISE EXCEPTION 'WP4_POSTED_LINES_MUTATED_AFTER_DENIED_DELETE'; END IF;

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

-- Read-only diagnostic for Issue248. This extra trigger/function exists ONLY
-- in this disposable test transaction. It returns OLD without altering any
-- record, policy, guard, or existing trigger. The name sorts after
-- finora_journal_document_lifecycle_trg and before trg_finora_guard_posted_source_records.
CREATE FUNCTION public.qa_wp4_trace_source_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $trace$
DECLARE v_status text; v_exists boolean; v_registry_state text; v_locked boolean;
BEGIN
 SELECT r.data->>'status' INTO v_status
 FROM public.records r
 WHERE r.organization_id=OLD.organization_id AND r.owner_id=OLD.owner_id
   AND r.collection='journalVouchers' AND r.id=OLD.data->>'journalVoucherId';
 v_exists:=FOUND;
 SELECT r.state INTO v_registry_state
 FROM public.finora_journal_document_registry r
 WHERE r.organization_id=OLD.organization_id AND r.voucher_id=OLD.data->>'journalVoucherId';
 -- Reconstruct the existing guard's predicate for invoices, including NULL.
 v_locked:=coalesce(OLD.data->>'accountingStatus','')='posted'
    OR v_status IN ('posted','reversed');
 RAISE NOTICE 'WP4_ISSUE248_INTER_TRIGGER_TRACE: %',
   jsonb_build_object('sourceAccountingStatus',OLD.data->>'accountingStatus',
    'sourceDocumentStatus',OLD.data->>'documentStatus',
    'voucherFound',v_exists,'voucherStatus',v_status,
    'registryState',v_registry_state,'guardPredicate',v_locked,
    'triggerDepth',pg_trigger_depth());
 RETURN OLD;
END $trace$;
REVOKE ALL ON FUNCTION public.qa_wp4_trace_source_delete() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER qa_wp4_after_lifecycle_before_guard
 BEFORE DELETE ON public.records FOR EACH ROW
 WHEN (OLD.collection='invoices' AND OLD.id='WP4_INV_B'
       AND OLD.owner_id='b9000000-0000-4000-8000-000000000001'::uuid)
 EXECUTE FUNCTION public.qa_wp4_trace_source_delete();

DO $catalog$
DECLARE names text[];
BEGIN
 SELECT array_agg(t.tgname::text ORDER BY t.tgname::text COLLATE "C") INTO names
 FROM pg_catalog.pg_trigger t
 WHERE t.tgrelid='public.records'::regclass AND NOT t.tgisinternal
   AND t.tgenabled IN ('O','A') AND (t.tgtype::integer & 10)=10;
 RAISE NOTICE 'WP4_ISSUE248_ACTIVE_BEFORE_DELETE_TRIGGER_ORDER: %',to_jsonb(names);
END $catalog$;

-- Source <-> voucher draft deletion is atomic in both directions.
DO $$
DECLARE org uuid; company text; fy text; atf bigint;
 before_source jsonb; before_voucher jsonb; before_registry jsonb; before_audit jsonb;
 after_source jsonb; after_voucher jsonb; after_registry jsonb; after_audit jsonb;
 failure_state text; failure_message text;
BEGIN
 SELECT id INTO org FROM public.organizations WHERE owner_user_id='b9000000-0000-4000-8000-000000000001' LIMIT 1;
 SELECT id INTO company FROM public.records WHERE organization_id=org AND collection='companies' LIMIT 1;
 SELECT id INTO fy FROM public.records WHERE organization_id=org AND collection='fiscalYears'
   AND data->>'companyId'=company AND coalesce(data->>'status','open')<>'locked' LIMIT 1;

 INSERT INTO public.records(owner_id,organization_id,collection,id,data)
 VALUES(auth.uid(),org,'invoices','WP4_INV_A',
   jsonb_build_object('companyId',company,'date',
     (SELECT data->>'startDate' FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy),
     'documentStatus','draft','accountingStatus','draft',
     'journalVoucherId','WP4_SOURCE_V_A'));

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
     'documentStatus','draft','accountingStatus','draft',
     'journalVoucherId','WP4_SOURCE_V_B'));

 INSERT INTO public.records(owner_id,organization_id,collection,id,data)
 VALUES(auth.uid(),org,'journalVouchers','WP4_SOURCE_V_B',
   jsonb_build_object('companyId',company,'fiscalYearId',fy,
     'date',(SELECT data->>'startDate' FROM public.records WHERE organization_id=org AND collection='fiscalYears' AND id=fy),
     'sourceType','sale','sourceId','WP4_INV_B','status','draft'));

 -- Strict positive preconditions: both *persisted* linked records are
 -- genuinely draft before testing source -> voucher atomic deletion.
 IF NOT EXISTS (
   SELECT 1 FROM public.records s JOIN public.records v
     ON v.organization_id=s.organization_id
     AND v.collection='journalVouchers'
     AND v.id=s.data->>'journalVoucherId'
   WHERE s.organization_id=org AND s.collection='invoices' AND s.id='WP4_INV_B'
     AND s.data->>'documentStatus'='draft'
     AND s.data->>'accountingStatus'='draft'
     AND s.data->>'journalVoucherId'='WP4_SOURCE_V_B'
     AND v.data->>'status'='draft'
     AND v.data->>'sourceType'='sale' AND v.data->>'sourceId'='WP4_INV_B'
 ) THEN RAISE EXCEPTION 'WP4_LINKED_DRAFT_PRECONDITIONS_MISSING'; END IF;
 RAISE NOTICE 'WP4_LINKED_SOURCE_AND_VOUCHER_ARE_DRAFT_PASS';
 SELECT to_jsonb(r) INTO STRICT before_source FROM public.records r
  WHERE r.organization_id=org AND r.collection='invoices' AND r.id='WP4_INV_B';
 SELECT to_jsonb(r) INTO STRICT before_voucher FROM public.records r
  WHERE r.organization_id=org AND r.collection='journalVouchers' AND r.id='WP4_SOURCE_V_B';
 SELECT to_jsonb(r) INTO STRICT before_registry FROM public.finora_journal_document_registry r
  WHERE r.organization_id=org AND r.voucher_id='WP4_SOURCE_V_B';
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]'::jsonb)
  INTO before_audit FROM public.finora_journal_document_audit a
  WHERE a.organization_id=org AND a.voucher_id='WP4_SOURCE_V_B';

 -- Observe rollback of the actual failing DELETE, without swallowing its
 -- error. The exception handler is a SQL subtransaction; original failure
 -- is rethrown after exact row/registry/audit comparisons.
 BEGIN
   DELETE FROM public.records WHERE organization_id=org AND collection='invoices' AND id='WP4_INV_B';
 EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS failure_state=RETURNED_SQLSTATE,failure_message=MESSAGE_TEXT;
   SELECT to_jsonb(r) INTO after_source FROM public.records r
    WHERE r.organization_id=org AND r.collection='invoices' AND r.id='WP4_INV_B';
   SELECT to_jsonb(r) INTO after_voucher FROM public.records r
    WHERE r.organization_id=org AND r.collection='journalVouchers' AND r.id='WP4_SOURCE_V_B';
   SELECT to_jsonb(r) INTO after_registry FROM public.finora_journal_document_registry r
    WHERE r.organization_id=org AND r.voucher_id='WP4_SOURCE_V_B';
   SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]'::jsonb)
    INTO after_audit FROM public.finora_journal_document_audit a
    WHERE a.organization_id=org AND a.voucher_id='WP4_SOURCE_V_B';
   IF before_source IS DISTINCT FROM after_source
      OR before_voucher IS DISTINCT FROM after_voucher
      OR before_registry IS DISTINCT FROM after_registry
      OR before_audit IS DISTINCT FROM after_audit
   THEN RAISE EXCEPTION 'WP4_ISSUE248_DELETE_FAILURE_ROLLBACK_MISMATCH: original SQLSTATE %',failure_state; END IF;
   RAISE NOTICE 'WP4_ISSUE248_FAILED_DELETE_ROLLBACK_PASS: source, voucher, registry and audit snapshots unchanged; SQLSTATE=%; error=%',
      failure_state,failure_message;
   RAISE;
 END;
 IF EXISTS(SELECT 1 FROM public.records WHERE organization_id=org AND collection='invoices' AND id='WP4_INV_B')
 THEN RAISE EXCEPTION 'WP4_SOURCE_DELETE_DID_NOT_DELETE_SOURCE'; END IF;
 IF EXISTS(SELECT 1 FROM public.records WHERE organization_id=org AND collection='journalVouchers' AND id='WP4_SOURCE_V_B')
 THEN RAISE EXCEPTION 'WP4_SOURCE_DELETE_DID_NOT_DELETE_VOUCHER'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.finora_journal_document_registry
    WHERE organization_id=org AND voucher_id='WP4_SOURCE_V_B' AND state='deleted'
      AND atf_number=(before_registry->>'atf_number')::bigint)
 THEN RAISE EXCEPTION 'WP4_SOURCE_DELETE_TOMBSTONE_MISSING'; END IF;
 RAISE NOTICE 'WP4_SOURCE_VOUCHER_ATOMIC_DELETE_PASS';
END $$;

ROLLBACK;
