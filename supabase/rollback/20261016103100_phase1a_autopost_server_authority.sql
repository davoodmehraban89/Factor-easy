-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

CREATE OR REPLACE FUNCTION private.finora_phase1a_post_core(p_org uuid, p_id text, p_expected_version bigint, p_auto boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;

REVOKE ALL ON FUNCTION private.finora_phase1a_post_core(p_org uuid, p_id text, p_expected_version bigint, p_auto boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.finora_journal_autopost(p_organization_id uuid, p_voucher_id text, p_source_collection text, p_source_id text, p_header jsonb, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_type text:=p_header->>'sourceType';v_collection text;
 v_draft jsonb;v_result jsonb;v_source public.records%rowtype;
 v_source_amount numeric;v_debit numeric;v_credit numeric;
BEGIN
 v_collection:=CASE v_type
  WHEN 'sale' THEN 'invoices' WHEN 'purchase' THEN 'purchases'
  WHEN 'receipt' THEN 'payments' WHEN 'payment' THEN 'payments'
  WHEN 'expense' THEN 'expenses' WHEN 'income' THEN 'expenses'
  WHEN 'contract_statement' THEN 'contractStatements'
  WHEN 'inventory_adjustment' THEN 'stockMovements'
  WHEN 'asset_depreciation' THEN 'assetDepreciations'
  WHEN 'payroll_run' THEN 'payrollRuns'
  WHEN 'employee_benefit_accrual' THEN 'employeeBenefitAccruals'
  WHEN 'petty_cash' THEN 'pettyCashTransactions' ELSE NULL END;
 IF v_collection IS NULL OR p_source_collection<>v_collection OR coalesce(p_source_id,'')=''
  OR p_header->>'sourceId' IS DISTINCT FROM p_source_id THEN
  RAISE EXCEPTION 'FINORA_SOURCE_IDENTITY_INVALID' USING ERRCODE='23514';END IF;
 PERFORM private.finora_phase1a_authorize(p_organization_id,'create',v_type);
 -- Take a share lock on the persisted business record within this transaction.
 SELECT src.* INTO v_source FROM public.records src
 WHERE src.organization_id=p_organization_id AND src.collection=p_source_collection
 AND src.id=p_source_id AND src.data->>'companyId'=p_header->>'companyId'
 AND private.can_access_record(p_organization_id,p_source_collection,
     src.owner_id,src.data,'create')
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'FINORA_SOURCE_NOT_COMMITTED_IN_ORG' USING ERRCODE='23503';
 END IF;
 IF (v_type='sale' AND coalesce(v_source.data->>'kind','') NOT IN ('formal','non_formal'))
 OR (v_type IN ('receipt','payment') AND v_source.data->>'direction'
      IS DISTINCT FROM CASE WHEN v_type='receipt' THEN 'inbound' ELSE 'outbound' END)
 OR (v_type IN ('expense','income') AND v_source.data->>'kind' IS DISTINCT FROM v_type)
 OR (v_source.data ? 'accountingVersion' AND
      v_source.data->>'accountingVersion' IS DISTINCT FROM
        coalesce(p_header->>'sourceVersion','1'))
 THEN RAISE EXCEPTION 'FINORA_SOURCE_TYPE_OR_VERSION_MISMATCH' USING ERRCODE='23514';END IF;
 IF v_type IN ('sale','purchase') THEN
  IF jsonb_typeof(v_source.data->'grandTotal')<>'number'
    OR (v_source.data->>'grandTotal') !~ '^[1-9][0-9]{0,27}$' THEN
   RAISE EXCEPTION 'FINORA_SOURCE_AMOUNT_INVALID' USING ERRCODE='23514';END IF;
  v_source_amount:=(v_source.data->>'grandTotal')::numeric;
 ELSE
  IF jsonb_typeof(v_source.data->'amount')<>'number'
    OR (v_source.data->>'amount') !~ '^[1-9][0-9]{0,27}$' THEN
   RAISE EXCEPTION 'FINORA_SOURCE_AMOUNT_INVALID' USING ERRCODE='23514';END IF;
  v_source_amount:=(v_source.data->>'amount')::numeric;
 END IF;
 IF jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)<2 THEN
  RAISE EXCEPTION 'FINORA_INVALID_LINE_COUNT' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum((l.value->>'debit')::numeric),0),
        coalesce(sum((l.value->>'credit')::numeric),0)
 INTO v_debit,v_credit FROM jsonb_array_elements(p_lines) AS l(value);
 IF v_debit<>v_source_amount OR v_credit<>v_source_amount THEN
  RAISE EXCEPTION 'FINORA_SOURCE_LEDGER_AMOUNT_MISMATCH' USING ERRCODE='23514';
 END IF;
 -- Specific account-profile contract is a separately gated Stage 3 issue.
 v_draft:=private.finora_phase1a_create_core(p_organization_id,p_voucher_id,p_header,p_lines);
 v_result:=private.finora_phase1a_post_core(p_organization_id,p_voucher_id,
  (v_draft#>>'{voucher,version}')::bigint,true);
 RETURN v_result||jsonb_build_object('draftReplayed',coalesce((v_draft->>'replayed')::boolean,false));
END $function$
;

REVOKE ALL ON FUNCTION public.finora_journal_autopost(p_organization_id uuid, p_voucher_id text, p_source_collection text, p_source_id text, p_header jsonb, p_lines jsonb) FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.finora_journal_autopost(p_organization_id uuid, p_voucher_id text, p_source_collection text, p_source_id text, p_header jsonb, p_lines jsonb) TO authenticated;

REVOKE ALL ON FUNCTION private.finora_phase1a_line_set(lines jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_revalidate_autopost(org uuid, v records) FROM PUBLIC,anon,authenticated,service_role;
