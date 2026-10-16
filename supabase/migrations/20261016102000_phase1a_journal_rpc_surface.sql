-- Phase 1A stage 1 — public journal lifecycle surface. SQL-only, test branch.
-- All original posted voucher rows and lines remain UNMODIFIED on reversal.
CREATE OR REPLACE FUNCTION public.finora_journal_create_draft(
 p_organization_id uuid,p_voucher_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 PERFORM private.finora_phase1a_authorize(p_organization_id,'create',NULL);
 IF coalesce(p_header->>'sourceType','manual')<>'manual' OR coalesce(p_header->>'sourceId','')<>'' THEN
  RAISE EXCEPTION 'FINORA_MANUAL_DRAFT_ONLY' USING ERRCODE='42501';
 END IF;
 RETURN private.finora_phase1a_create_core(p_organization_id,p_voucher_id,p_header,p_lines);
END $fn$;

CREATE OR REPLACE FUNCTION public.finora_journal_update_draft(
 p_organization_id uuid,p_voucher_id text,p_expected_version bigint,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v public.records%rowtype;v_actor uuid:=auth.uid();v_fp text;
BEGIN
 PERFORM private.finora_phase1a_authorize(p_organization_id,'edit',NULL);
 IF jsonb_typeof(p_header)<>'object' OR p_header ?| ARRAY[
 'status','number','postedAt','postedBy','reversedAt','reversalVoucherId','sourceType','sourceId','sourceVersion']
 THEN RAISE EXCEPTION 'FINORA_INVALID_DRAFT_UPDATE' USING ERRCODE='23514';END IF;
 SELECT * INTO v FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalVouchers' AND id=p_voucher_id FOR UPDATE;
 IF NOT FOUND OR v.data->>'status'<>'draft' OR coalesce(v.data->>'sourceType','manual')<>'manual'
 THEN RAISE EXCEPTION 'FINORA_MANUAL_DRAFT_REQUIRED' USING ERRCODE='23514';END IF;
 IF v.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF p_header ? 'companyId' AND p_header->>'companyId'<>v.data->>'companyId'
 OR p_header ? 'fiscalYearId' AND p_header->>'fiscalYearId'<>v.data->>'fiscalYearId'
 THEN RAISE EXCEPTION 'FINORA_DRAFT_SCOPE_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.records fy WHERE fy.organization_id=p_organization_id
  AND fy.collection='fiscalYears' AND fy.id=v.data->>'fiscalYearId'
  AND coalesce(fy.data->>'status','open')<>'locked') THEN
   RAISE EXCEPTION 'FINORA_FISCAL_YEAR_LOCKED' USING ERRCODE='23514';END IF;
 DELETE FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalLineDimensions' AND data->>'voucherId'=p_voucher_id;
 DELETE FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalLines' AND data->>'voucherId'=p_voucher_id;
 PERFORM private.finora_phase1a_write_lines(p_organization_id,v_actor,p_voucher_id,v.data->>'companyId',p_lines);
 PERFORM private.finora_phase1a_validate_saved(p_organization_id,p_voucher_id,v.data->>'companyId');
 v_fp:=md5(jsonb_build_object('header',p_header,'lines',p_lines)::text);
 UPDATE public.records SET data=(v.data||jsonb_build_object(
  'date',coalesce(p_header->>'date',v.data->>'date'),
  'description',coalesce(p_header->>'description',v.data->>'description'),
  'reference',coalesce(p_header->>'reference',v.data->>'reference'),
  'voucherType',coalesce(p_header->>'voucherType',v.data->>'voucherType'),
  'requestFingerprint',v_fp,'editedBy',v_actor,'editedAt',clock_timestamp()))
 WHERE organization_id=p_organization_id AND collection='journalVouchers' AND id=p_voucher_id
 RETURNING * INTO v;
 PERFORM private.finora_phase1a_audit_event(p_organization_id,p_voucher_id,v_actor,'draft_updated','',jsonb_build_object('version',v.version));
 RETURN jsonb_build_object('voucher',v.data||jsonb_build_object('id',v.id,'version',v.version));
END $fn$;

CREATE OR REPLACE FUNCTION public.finora_journal_post(
 p_organization_id uuid,p_voucher_id text,p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 RETURN private.finora_phase1a_post_core(p_organization_id,p_voucher_id,p_expected_version,false);
END $fn$;

CREATE OR REPLACE FUNCTION public.finora_journal_delete_draft(
 p_organization_id uuid,p_voucher_id text,p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v public.records%rowtype;
BEGIN
 PERFORM private.finora_phase1a_authorize(p_organization_id,'edit',NULL);
 SELECT * INTO v FROM public.records WHERE organization_id=p_organization_id
 AND collection='journalVouchers' AND id=p_voucher_id FOR UPDATE;
 IF NOT FOUND OR v.data->>'status'<>'draft' OR coalesce(v.data->>'sourceType','manual')<>'manual'
 THEN RAISE EXCEPTION 'FINORA_DRAFT_DELETE_FORBIDDEN' USING ERRCODE='23514';END IF;
 IF v.version<>p_expected_version THEN RAISE EXCEPTION 'FINORA_VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalLineDimensions' AND data->>'voucherId'=p_voucher_id;
 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalLines' AND data->>'voucherId'=p_voucher_id;
 DELETE FROM public.records WHERE organization_id=p_organization_id
  AND collection='journalVouchers' AND id=p_voucher_id;
 PERFORM private.finora_phase1a_audit_event(p_organization_id,p_voucher_id,auth.uid(),'draft_deleted','',jsonb_build_object('lastVersion',v.version));
 RETURN jsonb_build_object('deleted',true,'voucherId',p_voucher_id);
END $fn$;

-- Source must already be committed (source data is never re-invented by the
-- journal RPC). Draft creation and posting are ATOMIC within this call.
CREATE OR REPLACE FUNCTION public.finora_journal_autopost(
 p_organization_id uuid,p_voucher_id text,p_source_collection text,
 p_source_id text,p_header jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
END $fn$;

-- A full reversal is made by NULL allocations. Partial reversal lists
-- {lineId,amount} for the original line; the server swaps debit and credit.
-- Two transactions serialise using FOR UPDATE on the immutable original row.
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

-- Read-only, RLS-invoker view: status of original derived from all posted
-- inverse lines; original posted row, line amounts and version NEVER change.
CREATE OR REPLACE VIEW public.finora_journal_reversal_status
WITH (security_invoker=true) AS
WITH orig AS (
 SELECT organization_id,id,data FROM public.records
 WHERE collection='journalVouchers' AND data->>'status'='posted'
 AND coalesce(data->>'sourceType','')<>'reversal'
), forward AS (
 SELECT o.organization_id,o.id voucher_id,l.id line_id,
  greatest((l.data->>'debit')::numeric,(l.data->>'credit')::numeric) amount
 FROM orig o JOIN public.records l ON l.organization_id=o.organization_id
  AND l.collection='journalLines' AND l.data->>'voucherId'=o.id
), reverse_lines AS (
 SELECT rv.organization_id,rv.data->>'sourceId' voucher_id,
  rl.data->>'reversesLineId' line_id,
  sum(greatest((rl.data->>'debit')::numeric,(rl.data->>'credit')::numeric)) reversed_amount
 FROM public.records rv JOIN public.records rl ON rl.organization_id=rv.organization_id
  AND rl.collection='journalLines' AND rl.data->>'voucherId'=rv.id
 WHERE rv.collection='journalVouchers' AND rv.data->>'sourceType'='reversal'
   AND rv.data->>'status'='posted'
 GROUP BY rv.organization_id,rv.data->>'sourceId',rl.data->>'reversesLineId'
)
SELECT f.organization_id,f.voucher_id,
 CASE WHEN sum(coalesce(r.reversed_amount,0))=0 THEN 'posted'
 WHEN bool_and(coalesce(r.reversed_amount,0)=f.amount) THEN 'reversed'
 ELSE 'partially_reversed' END AS effective_status,
 sum(f.amount) AS original_line_amount_total,
 sum(coalesce(r.reversed_amount,0)) AS reversed_line_amount_total
FROM forward f LEFT JOIN reverse_lines r ON r.organization_id=f.organization_id
 AND r.voucher_id=f.voucher_id AND r.line_id=f.line_id
GROUP BY f.organization_id,f.voucher_id;
REVOKE ALL ON public.finora_journal_reversal_status FROM PUBLIC,anon;
GRANT SELECT ON public.finora_journal_reversal_status TO authenticated;

-- Reject accidental default PUBLIC and anon EXECUTE (schema public is exposed).
REVOKE ALL ON FUNCTION public.finora_journal_create_draft(uuid,text,jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finora_journal_update_draft(uuid,text,bigint,jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finora_journal_post(uuid,text,bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finora_journal_delete_draft(uuid,text,bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finora_journal_autopost(uuid,text,text,text,jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finora_journal_reverse(uuid,text,text,text,text,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finora_journal_create_draft(uuid,text,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_update_draft(uuid,text,bigint,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_post(uuid,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_delete_draft(uuid,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_autopost(uuid,text,text,text,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finora_journal_reverse(uuid,text,text,text,text,bigint,jsonb) TO authenticated;
