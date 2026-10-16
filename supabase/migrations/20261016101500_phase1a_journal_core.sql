-- FINORA Phase 1A stage 1: trusted SQL core. Test branch + disposable CLI ONLY.
CREATE TABLE IF NOT EXISTS private.finora_phase1a_journal_counters(
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 fiscal_year_id text NOT NULL,
 last_no bigint NOT NULL CHECK(last_no>=0 AND last_no<9223372036854775807),
 PRIMARY KEY(organization_id,fiscal_year_id));
REVOKE ALL ON private.finora_phase1a_journal_counters FROM PUBLIC,anon,authenticated;

-- Historic unique source-version guard must exclude reversal vouchers.
-- Multiple partial reversals of one posted original must coexist; unique
-- reversal voucher IDs and aggregate remaining-line checks prevent replay/overrun.
-- The original journal row and its posted lines are never changed.
DROP INDEX IF EXISTS public.ux_finora_journal_source_version;
CREATE UNIQUE INDEX ux_finora_journal_source_version ON public.records
 (owner_id,(data->>'companyId'),(data->>'sourceType'),(data->>'sourceId'),
  ((coalesce(data->>'sourceVersion','1'))::integer))
WHERE collection='journalVouchers'
 AND data->>'status' IN ('posted','reversed')
 AND coalesce(data->>'sourceId','')<>''
 AND data->>'sourceType'<>'reversal';

-- Historic vouchers remain unchanged. Covers original posted identifiers too,
-- so posting corrected data requires a NEW business source ID.
CREATE UNIQUE INDEX IF NOT EXISTS ux_finora_phase1a_active_source
ON public.records(organization_id,(data->>'sourceType'),(data->>'sourceId'))
WHERE collection='journalVouchers' AND data->>'status'='posted'
AND coalesce(data->>'sourceId','')<>'' AND data->>'sourceType'<>'reversal';
CREATE UNIQUE INDEX IF NOT EXISTS ux_finora_phase1a_posted_org_fiscal_number
ON public.records(organization_id,(data->>'fiscalYearId'),(data->>'number'))
WHERE collection='journalVouchers' AND data->>'status' IN ('posted','reversed')
AND coalesce(data->>'number','')<>'';

CREATE OR REPLACE FUNCTION private.finora_phase1a_authorize(
 p_org uuid,p_cap text,p_source_type text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_module text:='accounting';
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_members
  WHERE organization_id=p_org AND user_id=auth.uid() AND status='active') THEN
  RAISE EXCEPTION 'FINORA_ORG_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF coalesce(p_source_type,'') NOT IN ('','manual','reversal') THEN
  v_module:=CASE p_source_type
   WHEN 'sale' THEN 'commerce' WHEN 'purchase' THEN 'commerce'
   WHEN 'receipt' THEN 'treasury' WHEN 'payment' THEN 'treasury'
   WHEN 'contract_statement' THEN 'contracting'
   WHEN 'expense' THEN 'accounting' WHEN 'income' THEN 'accounting'
   WHEN 'payroll_run' THEN 'hr_payroll'
   WHEN 'employee_benefit_accrual' THEN 'hr_payroll'
   WHEN 'petty_cash' THEN 'treasury'
   WHEN 'asset_depreciation' THEN 'assets'
   WHEN 'inventory_adjustment' THEN 'inventory'
   ELSE NULL END;
  IF v_module IS NULL THEN RAISE EXCEPTION 'FINORA_SOURCE_TYPE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 END IF;
 IF NOT private.organization_has_module_entitlement(p_org,v_module,true)
    OR NOT private.has_org_capability(p_org,v_module,p_cap) THEN
  RAISE EXCEPTION 'FINORA_PERMISSION_REQUIRED module=% capability=%',v_module,p_cap USING ERRCODE='42501';
 END IF;
END $fn$;

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
 IF NOT EXISTS(SELECT 1 FROM public.records fy
  WHERE fy.organization_id=p_org AND fy.collection='fiscalYears'
  AND fy.id=v_fy AND fy.data->>'companyId'=v_company
  AND coalesce(fy.data->>'status','open')<>'locked') THEN
  RAISE EXCEPTION 'FINORA_FISCAL_YEAR_LOCKED_OR_MISSING' USING ERRCODE='23514';
 END IF;
 PERFORM private.finora_phase1a_validate_saved(p_org,p_id,v_company);
 -- Read the existing locked counter first: scanning all historic vouchers on
 -- EVERY posting is quadratic for a long journal batch. Bootstrap once only;
 -- competing first writers serialize via the unique counter row.
 SELECT last_no INTO v_no FROM private.finora_phase1a_journal_counters
 WHERE organization_id=p_org AND fiscal_year_id=v_fy FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO private.finora_phase1a_journal_counters(organization_id,fiscal_year_id,last_no)
  SELECT p_org,v_fy,coalesce(max((d.data->>'number')::bigint),0)
  FROM public.records d WHERE d.organization_id=p_org
   AND d.collection='journalVouchers' AND d.data->>'fiscalYearId'=v_fy
   AND d.data->>'status' IN ('posted','reversed')
   AND d.data->>'number' ~ '^[0-9]{1,17}
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

REVOKE ALL ON FUNCTION private.finora_phase1a_authorize(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_validate_line(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_validate_saved(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_write_lines(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_create_core(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_post_core(uuid,text,bigint,boolean) FROM PUBLIC,anon,authenticated;

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

REVOKE ALL ON FUNCTION private.finora_phase1a_authorize(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_validate_line(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_validate_saved(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_write_lines(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_create_core(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_post_core(uuid,text,bigint,boolean) FROM PUBLIC,anon,authenticated;
