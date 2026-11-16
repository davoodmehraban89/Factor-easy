-- WP1 additive repair. Created with Supabase CLI 2.121.0 migration new.
-- G1 HOLD: disposable proof only, not Production authorization.
-- Existing function signature, authority, ACLs and posted history are preserved.
CREATE OR REPLACE FUNCTION public.finora_journal_reverse(
 p_organization_id uuid,p_original_id text,p_reversal_id text,
 p_date text,p_reason text,p_expected_version bigint,p_allocations jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE original public.records%rowtype; v_actor uuid:=auth.uid();l record;
 v_request jsonb:='[]'::jsonb;v_amount numeric;v_prior numeric;
 v_src text;v_lines jsonb;v_result jsonb;v_sum_d numeric:=0;v_sum_c numeric:=0;
 v_alloc jsonb;v_seen integer;v_used integer:=0;v_dimensions jsonb;
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
 v_src:=coalesce(original.data->>'sourceType','manual');
 IF v_src IN ('manual','reversal','') THEN
   PERFORM private.finora_phase1a_authorize(p_organization_id,'approve',NULL);
 ELSE
   PERFORM private.finora_phase1a_authorize(p_organization_id,'create',v_src);
 END IF;
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
  -- Dimensions are categorical type/value links, not independently allocated
  -- amounts. Copy every link on the selected source line for full or partial
  -- reversal; write_lines assigns new child IDs and the new voucher/line scope.
  -- Do not silently drop malformed legacy links or normalize their company.
  IF EXISTS(SELECT 1 FROM public.records dim
   WHERE dim.organization_id=p_organization_id AND dim.collection='journalLineDimensions'
    AND dim.data->>'journalLineId'=l.id
    AND (dim.data->>'voucherId' IS DISTINCT FROM p_original_id
      OR dim.data->>'companyId' IS DISTINCT FROM original.data->>'companyId')) THEN
   RAISE EXCEPTION 'FINORA_DIMENSION_OUT_OF_SCOPE' USING ERRCODE='23503';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'dimensionTypeId',dim.data->>'dimensionTypeId',
    'dimensionValueId',dim.data->>'dimensionValueId') ORDER BY dim.id),'[]'::jsonb)
   INTO v_dimensions FROM public.records dim
   WHERE dim.organization_id=p_organization_id AND dim.collection='journalLineDimensions'
    AND dim.data->>'voucherId'=p_original_id AND dim.data->>'journalLineId'=l.id
    AND dim.data->>'companyId'=original.data->>'companyId';
  v_request:=v_request||jsonb_build_array(jsonb_build_object(
    'accountId',l.data->>'accountId','debit',CASE WHEN (l.data->>'credit')::numeric>0 THEN v_amount ELSE 0 END,
    'credit',CASE WHEN (l.data->>'debit')::numeric>0 THEN v_amount ELSE 0 END,
    'reversesLineId',l.id,'dimensions',v_dimensions,'description','برگشت: '||coalesce(l.data->>'description','')));
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
