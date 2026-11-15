-- WP1 correction: dimension type/value links must be internally consistent.
-- Reject wrong-company, mismatched type/value and inactive dimensions before draft/post.
CREATE OR REPLACE FUNCTION private.finora_phase1a_validate_saved(
 p_org uuid,p_voucher text,p_company text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE x record; n integer:=0; debit_total numeric:=0;credit_total numeric:=0; v_year text;
BEGIN
 SELECT data->>'fiscalYearId' INTO STRICT v_year FROM public.records
 WHERE organization_id=p_org AND collection='journalVouchers' AND id=p_voucher;
 FOR x IN SELECT id,data FROM public.records
 WHERE organization_id=p_org AND collection='journalLines'
 AND data->>'voucherId'=p_voucher ORDER BY id LOOP
  IF x.data->>'companyId' IS DISTINCT FROM p_company
   OR x.data->>'fiscalYearId' IS DISTINCT FROM v_year THEN
   RAISE EXCEPTION 'FINORA_LINE_SCOPE_MISMATCH' USING ERRCODE='23514';
  END IF;
  PERFORM private.finora_phase1a_validate_line(p_org,p_company,x.data);
  IF EXISTS(SELECT 1 FROM public.records dim
   WHERE dim.organization_id=p_org AND dim.collection='journalLineDimensions'
    AND dim.data->>'voucherId'=p_voucher AND dim.data->>'journalLineId'=x.id
    AND (dim.data->>'companyId' IS DISTINCT FROM p_company
     OR NOT EXISTS(SELECT 1 FROM public.records t
      WHERE t.organization_id=p_org AND t.collection='dimensionTypes'
       AND t.id=dim.data->>'dimensionTypeId' AND t.data->>'companyId'=p_company
       AND coalesce(t.data->>'active','true')='true')
     OR NOT EXISTS(SELECT 1 FROM public.records v
      WHERE v.organization_id=p_org AND v.collection='dimensionValues'
       AND v.id=dim.data->>'dimensionValueId' AND v.data->>'companyId'=p_company
       AND v.data->>'dimensionTypeId'=dim.data->>'dimensionTypeId'
       AND coalesce(v.data->>'active','true')='true'))) THEN
   RAISE EXCEPTION 'FINORA_DIMENSION_OUT_OF_SCOPE' USING ERRCODE='23503';
  END IF;
  n:=n+1;
  debit_total:=debit_total+(x.data->>'debit')::numeric;
  credit_total:=credit_total+(x.data->>'credit')::numeric;
 END LOOP;
 IF n<2 OR debit_total<=0 OR debit_total<>credit_total THEN
  RAISE EXCEPTION 'FINORA_UNBALANCED_POSTED_JOURNAL count=% debit=% credit=%',
   n,debit_total,credit_total USING ERRCODE='23514';
 END IF;
END $fn$;
