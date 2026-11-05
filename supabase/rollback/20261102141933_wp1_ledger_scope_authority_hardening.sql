-- Disposable-only conservative DOWN: retain counters/history; restore exact prior APIs. No data deletion.

DROP TRIGGER IF EXISTS trg_finora_wp1_moved_header ON public.records;

DROP TRIGGER IF EXISTS trg_finora_wp1_balance_insert ON public.records;

DROP TRIGGER IF EXISTS trg_finora_wp1_balance_update ON public.records;

DROP TRIGGER IF EXISTS trg_finora_wp1_balance_delete ON public.records;

CREATE OR REPLACE FUNCTION private.finora_phase1a_mode(p_org uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $a$
SELECT COALESCE((SELECT mode FROM private.finora_phase1a_guard_modes WHERE organization_id=p_org),'off') $a$;

CREATE OR REPLACE FUNCTION public.finora_journal_set_guard_mode(
 p_organization_id uuid,p_expected_mode text,p_mode text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE before_mode text;v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.organization_members
 WHERE organization_id=p_organization_id AND user_id=v_actor
 AND is_owner=true AND status='active')
 THEN RAISE EXCEPTION 'FINORA_GUARD_MODE_OWNER_ONLY' USING ERRCODE='42501';END IF;
 IF p_expected_mode NOT IN ('off','audit','enforce')
 OR p_mode NOT IN ('off','audit','enforce')
 OR length(trim(coalesce(p_reason,'')))<8 THEN
  RAISE EXCEPTION 'FINORA_GUARD_MODE_INVALID' USING ERRCODE='23514';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('finora-guard-mode:'||p_organization_id::text,20261017));
 SELECT private.finora_phase1a_mode(p_organization_id) INTO before_mode;
 IF before_mode IS DISTINCT FROM p_expected_mode THEN
  RAISE EXCEPTION 'FINORA_GUARD_MODE_CONFLICT' USING ERRCODE='40001'; END IF;
 IF before_mode=p_mode THEN RETURN jsonb_build_object('mode',before_mode,'changed',false);END IF;
 INSERT INTO private.finora_phase1a_guard_modes(organization_id,mode,updated_at)
 VALUES(p_organization_id,p_mode,clock_timestamp())
 ON CONFLICT(organization_id) DO UPDATE SET mode=excluded.mode,updated_at=excluded.updated_at;
 PERFORM private.finora_phase1a_audit_event(
 p_organization_id,NULL,v_actor,'guard_mode_changed',p_reason,
 jsonb_build_object('before',before_mode,'after',p_mode));
 RETURN jsonb_build_object('mode',p_mode,'previous',before_mode,'changed',true);
END $f$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_validate_line(
 p_org uuid,p_company text,p_line jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE d numeric;c numeric; account text;
BEGIN
 IF jsonb_typeof(p_line)<>'object' THEN RAISE EXCEPTION 'FINORA_INVALID_LINE' USING ERRCODE='23514'; END IF;
 IF jsonb_typeof(p_line->'debit')<>'number' OR jsonb_typeof(p_line->'credit')<>'number'
 OR (p_line->>'debit') !~ '^(0|[1-9][0-9]{0,27})$'
 OR (p_line->>'credit') !~ '^(0|[1-9][0-9]{0,27})$' THEN
  RAISE EXCEPTION 'FINORA_INVALID_RIAL_AMOUNT' USING ERRCODE='23514';
 END IF;
 d:=(p_line->>'debit')::numeric;c:=(p_line->>'credit')::numeric;
 IF (d=0 AND c=0) OR (d>0 AND c>0) THEN
  RAISE EXCEPTION 'FINORA_INVALID_DEBIT_CREDIT_LINE' USING ERRCODE='23514';
 END IF;
 account:=p_line->>'accountId';
 IF NOT EXISTS(SELECT 1 FROM public.records
  WHERE organization_id=p_org AND collection='accounts' AND id=account
  AND data->>'companyId'=p_company
  AND coalesce(data->>'postingAllowed','false')='true'
  AND coalesce(data->>'active','true')<>'false') THEN
  RAISE EXCEPTION 'FINORA_ACCOUNT_OUT_OF_SCOPE' USING ERRCODE='23503';
 END IF;
END $fn$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_validate_saved(
 p_org uuid,p_voucher text,p_company text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE x record; n integer:=0; debit_total numeric:=0;credit_total numeric:=0;
BEGIN
 FOR x IN SELECT id,data FROM public.records
 WHERE organization_id=p_org AND collection='journalLines'
 AND data->>'voucherId'=p_voucher ORDER BY id LOOP
  PERFORM private.finora_phase1a_validate_line(p_org,p_company,x.data);
  IF EXISTS(SELECT 1 FROM public.records dim
  WHERE dim.organization_id=p_org AND dim.collection='journalLineDimensions'
  AND dim.data->>'voucherId'=p_voucher AND dim.data->>'journalLineId'=x.id
  AND (NOT EXISTS(SELECT 1 FROM public.records t WHERE t.organization_id=p_org
        AND t.collection='dimensionTypes' AND t.id=dim.data->>'dimensionTypeId'
        AND t.data->>'companyId'=p_company)
     OR NOT EXISTS(SELECT 1 FROM public.records v WHERE v.organization_id=p_org
        AND v.collection='dimensionValues' AND v.id=dim.data->>'dimensionValueId'
        AND v.data->>'companyId'=p_company))) THEN
   RAISE EXCEPTION 'FINORA_DIMENSION_OUT_OF_SCOPE' USING ERRCODE='23503';
  END IF;
  n:=n+1;debit_total:=debit_total+(x.data->>'debit')::numeric;
  credit_total:=credit_total+(x.data->>'credit')::numeric;
 END LOOP;
 IF n<2 OR debit_total<=0 OR debit_total<>credit_total THEN
  RAISE EXCEPTION 'FINORA_UNBALANCED_POSTED_JOURNAL count=% debit=% credit=%',n,debit_total,credit_total USING ERRCODE='23514';
 END IF;
END $fn$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_write_lines(
 p_org uuid,p_actor uuid,p_voucher text,p_company text,p_lines jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE l jsonb; d jsonb; row_id text; n integer:=0;
BEGIN
 IF jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)<2 OR jsonb_array_length(p_lines)>500 THEN
   RAISE EXCEPTION 'FINORA_INVALID_LINE_COUNT' USING ERRCODE='23514';
 END IF;
 FOR l IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  PERFORM private.finora_phase1a_validate_line(p_org,p_company,l);
  n:=n+1;
  row_id:=COALESCE(NULLIF(l->>'id',''),gen_random_uuid()::text);
  INSERT INTO public.records(organization_id,owner_id,collection,id,data)
  VALUES(p_org,p_actor,'journalLines',row_id,
    jsonb_build_object('voucherId',p_voucher,'companyId',p_company,'lineNo',n,
      'accountId',l->>'accountId','debit',(l->>'debit')::numeric,
      'credit',(l->>'credit')::numeric,'description',coalesce(l->>'description',''),
      'reversesLineId',coalesce(l->>'reversesLineId','')));
  IF jsonb_typeof(coalesce(l->'dimensions','[]'::jsonb))<>'array' THEN
    RAISE EXCEPTION 'FINORA_INVALID_DIMENSION_LIST' USING ERRCODE='23514';
  END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(coalesce(l->'dimensions','[]'::jsonb)) LOOP
   IF NOT EXISTS(SELECT 1 FROM public.records t WHERE t.organization_id=p_org
     AND t.collection='dimensionTypes' AND t.id=d->>'dimensionTypeId' AND t.data->>'companyId'=p_company)
    OR NOT EXISTS(SELECT 1 FROM public.records v WHERE v.organization_id=p_org
     AND v.collection='dimensionValues' AND v.id=d->>'dimensionValueId' AND v.data->>'companyId'=p_company) THEN
    RAISE EXCEPTION 'FINORA_DIMENSION_OUT_OF_SCOPE' USING ERRCODE='23503';
   END IF;
   INSERT INTO public.records(organization_id,owner_id,collection,id,data)
   VALUES(p_org,p_actor,'journalLineDimensions',gen_random_uuid()::text,
    jsonb_build_object('voucherId',p_voucher,'journalLineId',row_id,
    'companyId',p_company,'dimensionTypeId',d->>'dimensionTypeId',
    'dimensionValueId',d->>'dimensionValueId'));
  END LOOP;
 END LOOP;
END $fn$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_create_core(
 p_org uuid,p_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();v_fy text:=p_header->>'fiscalYearId';
 v_company text:=p_header->>'companyId';v_date text:=p_header->>'date';
 v_src text:=coalesce(p_header->>'sourceType','manual');
 v_fp text:=md5(jsonb_build_object('header',p_header,'lines',p_lines)::text);
 v_existing public.records%rowtype; v_current public.records%rowtype;
BEGIN
 IF v_actor IS NULL OR length(coalesce(p_id,''))<5 OR length(p_id)>160
  OR jsonb_typeof(p_header)<>'object' OR p_header ?| array['status','number','postedAt','postedBy','reversedAt','reversalVoucherId']
 THEN RAISE EXCEPTION 'FINORA_DRAFT_INVALID_HEADER' USING ERRCODE='23514';END IF;
 SELECT * INTO v_existing FROM public.records
 WHERE organization_id=p_org AND collection='journalVouchers' AND id=p_id FOR UPDATE;
 IF FOUND THEN
  IF v_existing.data->>'requestFingerprint'=v_fp THEN
   RETURN jsonb_build_object('voucher',v_existing.data||jsonb_build_object('id',v_existing.id,'version',v_existing.version),
    'replayed',true);
  END IF;
  RAISE EXCEPTION 'FINORA_DRAFT_REQUEST_CONFLICT' USING ERRCODE='40001';
 END IF;
 IF v_fy IS NULL OR v_company IS NULL OR v_date IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.records fy WHERE fy.organization_id=p_org
    AND fy.collection='fiscalYears' AND fy.id=v_fy AND fy.data->>'companyId'=v_company
    AND coalesce(fy.data->>'status','open')<>'locked'
    AND v_date>=fy.data->>'startDate' AND v_date<=fy.data->>'endDate')
  OR NOT EXISTS(SELECT 1 FROM public.records c WHERE c.organization_id=p_org
    AND c.collection='companies' AND c.id=v_company) THEN
  RAISE EXCEPTION 'FINORA_FISCAL_OR_COMPANY_INVALID' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.records(organization_id,owner_id,collection,id,data)
 VALUES(p_org,v_actor,'journalVouchers',p_id,
   jsonb_build_object('companyId',v_company,'fiscalYearId',v_fy,
    'date',v_date,'description',coalesce(p_header->>'description',''),
    'reference',coalesce(p_header->>'reference',''),
    'voucherType',coalesce(p_header->>'voucherType','manual'),
    'sourceType',v_src,'sourceId',coalesce(p_header->>'sourceId',''),
    'sourceVersion',coalesce(p_header->>'sourceVersion','1'),
    'reversalReason',coalesce(p_header->>'reversalReason',''),
    'reversalAllocations',coalesce(p_header->'reversalAllocations','null'::jsonb),
    'status','draft','createdAt',clock_timestamp(),'createdBy',v_actor,
    'requestFingerprint',v_fp))
 ON CONFLICT (organization_id,collection,id) DO NOTHING;
 -- Two simultaneous requests with the SAME client ID must both resolve to
 -- the SAME draft, never leak a unique-key error or create duplicate lines.
 IF NOT FOUND THEN
  SELECT * INTO v_existing FROM public.records WHERE organization_id=p_org
   AND collection='journalVouchers' AND id=p_id FOR UPDATE;
  IF FOUND AND v_existing.data->>'requestFingerprint'=v_fp THEN
   RETURN jsonb_build_object('voucher',
    v_existing.data||jsonb_build_object('id',v_existing.id,'version',v_existing.version),
    'replayed',true);
  END IF;
  RAISE EXCEPTION 'FINORA_DRAFT_REQUEST_CONFLICT' USING ERRCODE='40001';
 END IF;
 PERFORM private.finora_phase1a_write_lines(p_org,v_actor,p_id,v_company,p_lines);
 PERFORM private.finora_phase1a_validate_saved(p_org,p_id,v_company);
 PERFORM private.finora_phase1a_audit_event(p_org,p_id,v_actor,'draft_created','',
   jsonb_build_object('sourceType',v_src));
 SELECT * INTO v_current FROM public.records WHERE organization_id=p_org
 AND collection='journalVouchers' AND id=p_id;
 RETURN jsonb_build_object('voucher',v_current.data||jsonb_build_object('id',p_id,'version',v_current.version),'replayed',false);
END $fn$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_post_core(
 p_org uuid,p_id text,p_expected_version bigint,p_auto boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v public.records%rowtype;v_fy text;v_company text;v_src text;v_original_src text;
 v_no bigint;v_actor uuid:=auth.uid();v_at timestamptz:=clock_timestamp();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_members
 WHERE organization_id=p_org AND user_id=v_actor AND status='active') THEN
  RAISE EXCEPTION 'FINORA_ORG_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v FROM public.records WHERE organization_id=p_org AND collection='journalVouchers' AND id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_JOURNAL_NOT_FOUND' USING ERRCODE='23503';END IF;
 v_fy:=v.data->>'fiscalYearId';v_company:=v.data->>'companyId';v_src:=coalesce(v.data->>'sourceType','manual');
 IF p_auto THEN
  IF v_src='reversal' THEN
   SELECT data->>'sourceType' INTO v_original_src FROM public.records
    WHERE organization_id=p_org AND collection='journalVouchers' AND id=v.data->>'sourceId';
   IF coalesce(v_original_src,'manual')='manual' THEN
    PERFORM private.finora_phase1a_authorize(p_org,'approve',NULL);
   ELSE
    PERFORM private.finora_phase1a_authorize(p_org,'create',v_original_src);
   END IF;
  ELSIF v_src IN ('manual','') THEN
    RAISE EXCEPTION 'FINORA_INVALID_AUTOMATIC_SOURCE' USING ERRCODE='42501';
  ELSE
   PERFORM private.finora_phase1a_authorize(p_org,'create',v_src);
  END IF;
 ELSE
  PERFORM private.finora_phase1a_authorize(p_org,'approve',NULL);
 END IF;
 IF v.data->>'status'='posted' THEN
  RETURN jsonb_build_object('voucher',v.data||jsonb_build_object('id',v.id,'version',v.version),'replayed',true);
 END IF;
 IF v.data->>'status'<>'draft' THEN RAISE EXCEPTION 'FINORA_JOURNAL_NOT_DRAFT' USING ERRCODE='23514';END IF;
 IF v.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF v_src IN ('sale','purchase') THEN
  PERFORM private.finora_phase1a_revalidate_autopost(p_org,v);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.records fy
  WHERE fy.organization_id=p_org AND fy.collection='fiscalYears'
  AND fy.id=v_fy AND fy.data->>'companyId'=v_company
  AND coalesce(fy.data->>'status','open')<>'locked') THEN
  RAISE EXCEPTION 'FINORA_FISCAL_YEAR_LOCKED_OR_MISSING' USING ERRCODE='23514';
 END IF;
 PERFORM private.finora_phase1a_validate_saved(p_org,p_id,v_company);
 -- First lock the persisted fiscal-year counter; only the first posting
 -- initializes it from the maximum historic number. This avoids O(N^2)
 -- scanning during a 1000-document batch and retains transactional rollback.
 SELECT last_no INTO v_no FROM private.finora_phase1a_journal_counters
 WHERE organization_id=p_org AND fiscal_year_id=v_fy FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO private.finora_phase1a_journal_counters(organization_id,fiscal_year_id,last_no)
  SELECT p_org,v_fy,coalesce(max((d.data->>'number')::bigint),0)
  FROM public.records d WHERE d.organization_id=p_org
   AND d.collection='journalVouchers' AND d.data->>'fiscalYearId'=v_fy
   AND d.data->>'status' IN ('posted','reversed')
   AND d.data->>'number' ~ '^[0-9]{1,17}$'
  ON CONFLICT (organization_id,fiscal_year_id) DO NOTHING;
  SELECT last_no INTO v_no FROM private.finora_phase1a_journal_counters
  WHERE organization_id=p_org AND fiscal_year_id=v_fy FOR UPDATE;
 END IF;
 v_no:=v_no+1;
 UPDATE private.finora_phase1a_journal_counters SET last_no=v_no
 WHERE organization_id=p_org AND fiscal_year_id=v_fy;
 UPDATE public.records SET data=v.data||jsonb_build_object(
  'status','posted','number',v_no::text,'postedAt',v_at,
  'postedBy',v_actor)
 WHERE organization_id=p_org AND collection='journalVouchers' AND id=p_id
 RETURNING * INTO v;
 PERFORM private.finora_phase1a_audit_event(p_org,p_id,v_actor,'posted','',
    jsonb_build_object('number',v_no,'sourceType',v_src,'sourceId',v.data->>'sourceId'));
 RETURN jsonb_build_object('voucher',v.data||jsonb_build_object('id',v.id,'version',v.version),'replayed',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.finora_journal_reverse(
 p_organization_id uuid,p_original_id text,p_reversal_id text,
 p_date text,p_reason text,p_expected_version bigint,p_allocations jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE original public.records%rowtype; v_actor uuid:=auth.uid();l record;
 v_request jsonb:='[]'::jsonb;v_amount numeric;v_prior numeric;
 v_src text;v_lines jsonb;v_result jsonb;v_sum_d numeric:=0;v_sum_c numeric:=0;
 v_alloc jsonb;v_seen integer;v_used integer:=0;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_members
 WHERE organization_id=p_organization_id AND user_id=v_actor AND status='active') THEN
   RAISE EXCEPTION 'FINORA_ORG_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF coalesce(length(trim(p_reason)),0)<4 OR p_original_id=p_reversal_id THEN
  RAISE EXCEPTION 'FINORA_REVERSAL_REASON_REQUIRED' USING ERRCODE='23514';END IF;
 SELECT * INTO original FROM public.records
 WHERE organization_id=p_organization_id AND collection='journalVouchers' AND id=p_original_id FOR UPDATE;
 IF NOT FOUND OR original.data->>'status'<>'posted' THEN
  RAISE EXCEPTION 'FINORA_ORIGINAL_NOT_POSTED' USING ERRCODE='23514';END IF;
 -- Exact replay only: a changed request for the SAME reversal ID is a conflict.
 IF EXISTS(SELECT 1 FROM public.records x WHERE x.organization_id=p_organization_id
  AND x.collection='journalVouchers' AND x.id=p_reversal_id) THEN
  IF EXISTS(SELECT 1 FROM public.records x WHERE x.organization_id=p_organization_id
    AND x.collection='journalVouchers' AND x.id=p_reversal_id
    AND x.data->>'status'='posted' AND x.data->>'sourceType'='reversal'
    AND x.data->>'sourceId'=p_original_id AND x.data->>'date'=p_date
    AND x.data->>'reversalReason'=p_reason
    AND x.data->'reversalAllocations' IS NOT DISTINCT FROM coalesce(p_allocations,'null'::jsonb)) THEN
    RETURN jsonb_build_object('replayed',true,'originalVoucherId',p_original_id,
     'voucher',(SELECT data||jsonb_build_object('id',id,'version',version)
      FROM public.records WHERE organization_id=p_organization_id
       AND collection='journalVouchers' AND id=p_reversal_id));
  END IF;
  RAISE EXCEPTION 'FINORA_REVERSAL_RETRY_CONFLICT' USING ERRCODE='40001';
 END IF;
 v_src:=coalesce(original.data->>'sourceType','manual');
 IF v_src IN ('manual','reversal','') THEN
   PERFORM private.finora_phase1a_authorize(p_organization_id,'approve',NULL);
 ELSE
   PERFORM private.finora_phase1a_authorize(p_organization_id,'create',v_src);
 END IF;
 IF original.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF p_allocations IS NOT NULL AND jsonb_typeof(p_allocations)<>'array' THEN
  RAISE EXCEPTION 'FINORA_INVALID_REVERSAL_ALLOCATIONS' USING ERRCODE='23514';END IF;
 IF p_allocations IS NOT NULL AND EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_allocations) a
  GROUP BY a.value->>'lineId' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'FINORA_DUPLICATE_REVERSAL_LINE' USING ERRCODE='23514'; END IF;
 -- Date must belong to the original fiscal year; period-change reversal
 -- is reserved for 1B.
 IF NOT EXISTS(SELECT 1 FROM public.records fy WHERE fy.organization_id=p_organization_id
   AND fy.collection='fiscalYears' AND fy.id=original.data->>'fiscalYearId'
   AND coalesce(fy.data->>'status','open')<>'locked'
   AND p_date BETWEEN fy.data->>'startDate' AND fy.data->>'endDate') THEN
  RAISE EXCEPTION 'FINORA_REVERSAL_FISCAL_DATE_INVALID' USING ERRCODE='23514'; END IF;
 FOR l IN SELECT id,data FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalLines' AND data->>'voucherId'=p_original_id ORDER BY id LOOP
  IF p_allocations IS NULL THEN
   v_amount:=greatest(coalesce((l.data->>'debit')::numeric,0),coalesce((l.data->>'credit')::numeric,0));
  ELSE
   SELECT a.value INTO v_alloc FROM jsonb_array_elements(p_allocations) a
    WHERE a.value->>'lineId'=l.id;
   IF NOT FOUND THEN CONTINUE; END IF;
   IF jsonb_typeof(v_alloc->'amount')<>'number' OR (v_alloc->>'amount') !~ '^[1-9][0-9]{0,27}$'
   THEN RAISE EXCEPTION 'FINORA_INVALID_REVERSAL_AMOUNT' USING ERRCODE='23514';END IF;
   v_amount:=(v_alloc->>'amount')::numeric;v_used:=v_used+1;
  END IF;
  SELECT coalesce(sum(greatest((rl.data->>'debit')::numeric,(rl.data->>'credit')::numeric)),0)
  INTO v_prior FROM public.records rv JOIN public.records rl
  ON rl.organization_id=rv.organization_id AND rl.collection='journalLines'
   AND rl.data->>'voucherId'=rv.id AND rl.data->>'reversesLineId'=l.id
  WHERE rv.organization_id=p_organization_id AND rv.collection='journalVouchers'
   AND rv.data->>'status'='posted' AND rv.data->>'sourceType'='reversal'
   AND rv.data->>'sourceId'=p_original_id;
  IF v_amount<=0 OR v_prior+v_amount>greatest((l.data->>'debit')::numeric,(l.data->>'credit')::numeric) THEN
   RAISE EXCEPTION 'FINORA_REVERSAL_OVER_ALLOCATION' USING ERRCODE='23514';END IF;
  v_request:=v_request||jsonb_build_array(jsonb_build_object(
    'accountId',l.data->>'accountId','debit',CASE WHEN (l.data->>'credit')::numeric>0 THEN v_amount ELSE 0 END,
    'credit',CASE WHEN (l.data->>'debit')::numeric>0 THEN v_amount ELSE 0 END,
    'reversesLineId',l.id,'description','برگشت: '||coalesce(l.data->>'description','')));
  v_sum_d:=v_sum_d+CASE WHEN (l.data->>'credit')::numeric>0 THEN v_amount ELSE 0 END;
  v_sum_c:=v_sum_c+CASE WHEN (l.data->>'debit')::numeric>0 THEN v_amount ELSE 0 END;
 END LOOP;
 IF v_used<>coalesce(jsonb_array_length(p_allocations),v_used) OR
  jsonb_array_length(v_request)<2 OR v_sum_d<>v_sum_c OR v_sum_d=0 THEN
  RAISE EXCEPTION 'FINORA_REVERSAL_UNBALANCED_OR_MISSING_LINES' USING ERRCODE='23514';
 END IF;
 v_lines:=v_request;
 v_result:=private.finora_phase1a_create_core(p_organization_id,p_reversal_id,
  jsonb_build_object('companyId',original.data->>'companyId',
    'fiscalYearId',original.data->>'fiscalYearId','date',p_date,
    'description','برگشت سند '||coalesce(original.data->>'number',p_original_id),
    'voucherType','reversal','sourceType','reversal','sourceId',p_original_id,
    'reversalReason',p_reason,'reversalAllocations',coalesce(p_allocations,'null'::jsonb)),v_lines);
 -- Reversal permissions checked against the original source in post_core.
 v_result:=private.finora_phase1a_post_core(p_organization_id,p_reversal_id,
  (v_result#>>'{voucher,version}')::bigint,true);
 PERFORM private.finora_phase1a_audit_event(p_organization_id,p_reversal_id,v_actor,
  'reversed',p_reason,jsonb_build_object('originalVoucherId',p_original_id,
    'amount',v_sum_d,'reversedBy',v_actor));
 RETURN v_result||jsonb_build_object('originalVoucherId',p_original_id,
   'reversedBy',v_actor,'reason',p_reason);
END $fn$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_guard_server_journal_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 v_finora_mode text;
 v_finora_org uuid;
 v_finora_msg text;
 v_finora_state text;
 v_is_server boolean := current_user IN ('postgres','supabase_admin','service_role');
 v_new_status text;
BEGIN
 v_finora_org:=CASE WHEN TG_OP='DELETE' THEN old.organization_id ELSE new.organization_id END;
 v_finora_mode:=private.finora_phase1a_mode(v_finora_org);
 IF v_finora_mode='off' THEN RETURN new; END IF;
 IF TG_OP NOT IN ('INSERT','UPDATE') OR new.collection<>'journalVouchers' THEN RETURN new; END IF;
 v_new_status:=new.data->>'status';
 IF NOT v_is_server THEN
   IF TG_OP='INSERT' THEN
      IF new.data ?| ARRAY['status','number','postedAt','postedBy','reversedAt','reversalVoucherId'] THEN
        RAISE EXCEPTION 'FINORA_SERVER_ONLY_JOURNAL_FIELDS' USING ERRCODE='P0001';
      END IF;
   ELSIF (new.data->'status') IS DISTINCT FROM (old.data->'status')
      OR (new.data->'number') IS DISTINCT FROM (old.data->'number')
      OR (new.data->'postedAt') IS DISTINCT FROM (old.data->'postedAt')
      OR (new.data->'postedBy') IS DISTINCT FROM (old.data->'postedBy')
      OR (new.data->'reversedAt') IS DISTINCT FROM (old.data->'reversedAt')
      OR (new.data->'reversalVoucherId') IS DISTINCT FROM (old.data->'reversalVoucherId') THEN
      RAISE EXCEPTION 'FINORA_SERVER_ONLY_JOURNAL_FIELDS' USING ERRCODE='P0001';
   END IF;
 END IF;
 -- Even privileged administrative DML may not fabricate an invalid status.
 IF v_new_status IS NOT NULL AND v_new_status NOT IN ('draft','posted','reversed') THEN
   RAISE EXCEPTION 'FINORA_INVALID_JOURNAL_STATUS' USING ERRCODE='23514';
 END IF;
 RETURN new;
EXCEPTION WHEN OTHERS THEN
 IF v_finora_mode='audit' THEN
   GET STACKED DIAGNOSTICS v_finora_msg=MESSAGE_TEXT,v_finora_state=RETURNED_SQLSTATE;
   PERFORM private.finora_phase1a_log_guard(v_finora_org,
     CASE WHEN TG_OP='DELETE' THEN old.id ELSE new.id END,v_finora_msg,v_finora_state);
   RETURN new;
 END IF;
 RAISE;
END
$fn$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_guard_journal_children()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_finora_mode text;
 v_finora_org uuid;
 v_finora_msg text;
 v_finora_state text;
 x record;
 v_voucher_id text;
 v_parent_status text;
 v_org uuid;
 v_line_id text;
 v_debit numeric;
 v_credit numeric;
BEGIN
 v_finora_org:=CASE WHEN TG_OP='DELETE' THEN old.organization_id ELSE new.organization_id END;
 v_finora_mode:=private.finora_phase1a_mode(v_finora_org);
 IF v_finora_mode='off' THEN RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END; END IF;
 IF TG_OP='DELETE' THEN
    IF old.collection NOT IN ('journalLines','journalLineDimensions') THEN RETURN old; END IF;
 ELSE
    IF new.collection NOT IN ('journalLines','journalLineDimensions')
       AND (TG_OP='INSERT' OR old.collection NOT IN ('journalLines','journalLineDimensions')) THEN
      RETURN new;
    END IF;
 END IF;
 -- Check both old and new voucher, so a malicious UPDATE cannot move a
 -- line/dimension away from a posted document.
 FOR x IN
  SELECT old.organization_id AS org,old.collection AS coll,old.data AS doc WHERE TG_OP<>'INSERT'
  UNION ALL
  SELECT new.organization_id AS org,new.collection AS coll,new.data AS doc WHERE TG_OP<>'DELETE'
 LOOP
    IF x.coll NOT IN ('journalLines','journalLineDimensions') THEN CONTINUE; END IF;
    v_org:=x.org; v_voucher_id:=nullif(x.doc->>'voucherId','');
    IF v_voucher_id IS NULL THEN RAISE EXCEPTION 'FINORA_CHILD_PARENT_REQUIRED' USING ERRCODE='23514'; END IF;
    IF x.coll='journalLines' AND TG_OP<>'DELETE' AND x.doc=new.data THEN
       IF jsonb_typeof(x.doc->'debit') IS DISTINCT FROM 'number'
          OR jsonb_typeof(x.doc->'credit') IS DISTINCT FROM 'number'
          OR coalesce(x.doc->>'debit','') !~ '^(0|[1-9][0-9]{0,27})$'
          OR coalesce(x.doc->>'credit','') !~ '^(0|[1-9][0-9]{0,27})$' THEN
          RAISE EXCEPTION 'FINORA_INVALID_RIAL_AMOUNT' USING ERRCODE='23514';
       END IF;
       v_debit:=(x.doc->>'debit')::numeric;
       v_credit:=(x.doc->>'credit')::numeric;
       IF (v_debit=0 AND v_credit=0) OR (v_debit>0 AND v_credit>0) THEN
          RAISE EXCEPTION 'FINORA_INVALID_RIAL_LINE' USING ERRCODE='23514';
       END IF;
    END IF;
    -- Row lock serializes this child's insertion and concurrent posting.
    SELECT v.data->>'status' INTO v_parent_status
    FROM public.records v WHERE v.organization_id=v_org
      AND v.collection='journalVouchers' AND v.id=v_voucher_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FINORA_CHILD_PARENT_NOT_FOUND' USING ERRCODE='23503'; END IF;
    IF v_parent_status IN ('posted','reversed') THEN
        RAISE EXCEPTION 'FINORA_POSTED_JOURNAL_CHILD_IMMUTABLE' USING ERRCODE='P0001';
    END IF;
    IF x.coll='journalLineDimensions' THEN
       v_line_id:=nullif(x.doc->>'journalLineId','');
       IF v_line_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.records l WHERE l.organization_id=v_org
          AND l.collection='journalLines' AND l.id=v_line_id
          AND l.data->>'voucherId'=v_voucher_id
       ) THEN
          RAISE EXCEPTION 'FINORA_DIMENSION_LINE_PARENT_MISMATCH' USING ERRCODE='23503';
       END IF;
    END IF;
 END LOOP;
 RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END;
EXCEPTION WHEN OTHERS THEN
 IF v_finora_mode='audit' THEN
   GET STACKED DIAGNOSTICS v_finora_msg=MESSAGE_TEXT,v_finora_state=RETURNED_SQLSTATE;
   PERFORM private.finora_phase1a_log_guard(v_finora_org,
     CASE WHEN TG_OP='DELETE' THEN old.id ELSE new.id END,v_finora_msg,v_finora_state);
   RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END;
 END IF;
 RAISE;
END
$fn$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_assert_posted_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_finora_mode text;
 v_finora_org uuid;
 v_finora_msg text;
 v_finora_state text;
 v_org uuid;
 v_id text;
 v_status text;
 v_count integer;
 v_invalid integer;
 v_debit numeric;
 v_credit numeric;
BEGIN
 v_finora_org:=CASE WHEN TG_OP='DELETE' THEN old.organization_id ELSE new.organization_id END;
 v_finora_mode:=private.finora_phase1a_mode(v_finora_org);
 IF v_finora_mode='off' THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' THEN RETURN NULL; END IF;
 IF new.collection<>'journalVouchers' THEN RETURN NULL; END IF;
 v_org:=new.organization_id;v_id:=new.id;
 SELECT v.data->>'status' INTO v_status FROM public.records v
 WHERE v.organization_id=v_org AND v.collection='journalVouchers' AND v.id=v_id;
 IF NOT FOUND OR v_status NOT IN ('posted','reversed') THEN RETURN NULL; END IF;
 SELECT count(*)::integer,
  count(*) FILTER(WHERE jsonb_typeof(l.data->'debit') IS DISTINCT FROM 'number'
    OR jsonb_typeof(l.data->'credit') IS DISTINCT FROM 'number'
    OR coalesce(l.data->>'debit','') !~ '^(0|[1-9][0-9]{0,27})$'
    OR coalesce(l.data->>'credit','') !~ '^(0|[1-9][0-9]{0,27})$')::integer,
  coalesce(sum(CASE WHEN coalesce(l.data->>'debit','') ~ '^(0|[1-9][0-9]{0,27})$' THEN (l.data->>'debit')::numeric ELSE 0 END),0),
  coalesce(sum(CASE WHEN coalesce(l.data->>'credit','') ~ '^(0|[1-9][0-9]{0,27})$' THEN (l.data->>'credit')::numeric ELSE 0 END),0)
 INTO v_count,v_invalid,v_debit,v_credit
 FROM public.records l WHERE l.organization_id=v_org AND l.collection='journalLines' AND l.data->>'voucherId'=v_id;
 IF v_invalid<>0 THEN RAISE EXCEPTION 'FINORA_INVALID_RIAL_AMOUNT' USING ERRCODE='23514'; END IF;
 IF v_count<2 OR v_debit<>v_credit THEN
   RAISE EXCEPTION 'FINORA_UNBALANCED_POSTED_JOURNAL' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
EXCEPTION WHEN OTHERS THEN
 IF v_finora_mode='audit' THEN
   GET STACKED DIAGNOSTICS v_finora_msg=MESSAGE_TEXT,v_finora_state=RETURNED_SQLSTATE;
   PERFORM private.finora_phase1a_log_guard(v_finora_org,
     CASE WHEN TG_OP='DELETE' THEN old.id ELSE new.id END,v_finora_msg,v_finora_state);
   RETURN NULL;
 END IF;
 RAISE;
END
$fn$;

DROP TRIGGER IF EXISTS trg_finora_phase1a_journal_server_only ON public.records;

CREATE TRIGGER trg_finora_phase1a_journal_server_only BEFORE INSERT OR UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION private.finora_phase1a_guard_server_journal_fields();

DROP TRIGGER IF EXISTS trg_finora_phase1a_posted_balance ON public.records;

CREATE CONSTRAINT TRIGGER trg_finora_phase1a_posted_balance AFTER INSERT OR UPDATE ON public.records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.finora_phase1a_assert_posted_balance();
