-- Restore the exact pre-correction document amount contract.
CREATE OR REPLACE FUNCTION private.finora_phase1a_document_amounts(s jsonb,k text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=''
AS $f$
DECLARE x jsonb; sub numeric:=0;disc numeric;inp numeric;
 tax numeric;total numeric; rate numeric;expected numeric; qty numeric; price numeric;
BEGIN
 IF jsonb_typeof(s->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'items')=0 THEN
  RAISE EXCEPTION 'FINORA_SOURCE_ITEMS_REQUIRED' USING ERRCODE='23514';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(s->'items') LOOP
  IF jsonb_typeof(x->'qty') IS DISTINCT FROM 'number' OR (x->>'qty') !~ '^[1-9][0-9]{0,8}$' THEN
   RAISE EXCEPTION 'FINORA_SOURCE_ITEM_QUANTITY_INVALID' USING ERRCODE='23514';END IF;
  qty:=(x->>'qty')::numeric;price:=private.finora_phase1a_rial(x,'price');
  IF private.finora_phase1a_rial(x,'lineTotal')<>qty*price THEN
   RAISE EXCEPTION 'FINORA_SOURCE_ITEM_TOTAL_MISMATCH' USING ERRCODE='23514';END IF;
  sub:=sub+qty*price;
 END LOOP;
 IF sub<=0 OR sub<>private.finora_phase1a_rial(s,'subtotal') THEN
  RAISE EXCEPTION 'FINORA_SOURCE_SUBTOTAL_MISMATCH' USING ERRCODE='23514';END IF;
 disc:=private.finora_phase1a_rial(s,'discount');
 inp:=private.finora_phase1a_rial(s,'discountInput');
 IF s->>'discountType'='percent' AND inp<=100 THEN expected:=round(sub*inp/100);
 ELSIF s->>'discountType'='fixed' THEN expected:=inp;
 ELSE RAISE EXCEPTION 'FINORA_SOURCE_DISCOUNT_RULE_INVALID' USING ERRCODE='23514';END IF;
 IF disc IS DISTINCT FROM least(expected,sub) THEN
  RAISE EXCEPTION 'FINORA_SOURCE_DISCOUNT_MISMATCH' USING ERRCODE='23514';END IF;
 tax:=private.finora_phase1a_rial(s,'vat');
 IF s->>'vatMode'='none' THEN expected:=0;
 ELSIF s->>'vatMode'='with_vat' THEN
  rate:=private.finora_phase1a_rial(s,'vatRate');
  IF s->>'vatType'='percent' AND rate<=100 THEN expected:=round((sub-disc)*rate/100);
  ELSIF s->>'vatType'='fixed' THEN expected:=rate;
  ELSE RAISE EXCEPTION 'FINORA_SOURCE_VAT_RULE_INVALID' USING ERRCODE='23514';END IF;
 ELSE RAISE EXCEPTION 'FINORA_SOURCE_VAT_RULE_INVALID' USING ERRCODE='23514';END IF;
 IF expected<>tax OR (k='sale' AND s->>'kind'='non_formal' AND tax<>0) THEN
  RAISE EXCEPTION 'FINORA_SOURCE_VAT_MISMATCH' USING ERRCODE='23514';END IF;
 total:=private.finora_phase1a_rial(s,'grandTotal');
 IF total<=0 OR total<>sub-disc+tax THEN
  RAISE EXCEPTION 'FINORA_SOURCE_LEDGER_AMOUNT_MISMATCH' USING ERRCODE='23514';END IF;
 IF s->>'paymentMethod' NOT IN ('cash','credit')
   OR coalesce(s->>'currencyCode','IRR')<>'IRR' THEN
  RAISE EXCEPTION 'FINORA_SOURCE_METHOD_OR_CURRENCY_UNSUPPORTED' USING ERRCODE='23514';END IF;
 RETURN jsonb_build_object('net',sub-disc,'vat',tax,'total',total);
END $f$;
