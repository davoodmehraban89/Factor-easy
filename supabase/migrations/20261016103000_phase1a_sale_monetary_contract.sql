-- Stage 1 sale/purchase monetary rule v1: fixed SQL, never editable profile templates.
CREATE OR REPLACE FUNCTION private.finora_phase1a_resolve_role(
 p_org uuid,p_company text,p_role text,p_version bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE cfg private.finora_phase1a_account_role_snapshots%rowtype;
 live_fields jsonb; account_id text; latest bigint;
BEGIN
 SELECT max(version) INTO latest FROM private.finora_phase1a_account_role_snapshots
 WHERE organization_id=p_org AND company_id=p_company AND approved;
 IF latest IS NULL THEN RAISE EXCEPTION
  'FINORA_POSTING_ACCOUNT_ROLE_MISSING: حساب نقش % تعریف نشده است',p_role
  USING ERRCODE='23514';END IF;
 IF latest IS DISTINCT FROM p_version THEN
  RAISE EXCEPTION 'FINORA_POSTING_CONTRACT_CHANGED' USING ERRCODE='40001';END IF;
 SELECT * INTO cfg FROM private.finora_phase1a_account_role_snapshots
 WHERE organization_id=p_org AND company_id=p_company AND version=p_version AND approved;
 account_id:=cfg.assignments->>p_role;
 IF coalesce(account_id,'')='' THEN RAISE EXCEPTION
  'FINORA_POSTING_ACCOUNT_ROLE_MISSING: حساب نقش % تعریف نشده است',p_role
  USING ERRCODE='23514';END IF;
 live_fields:=private.finora_phase1a_check_role_account(p_org,p_company,p_role,account_id);
 IF live_fields IS DISTINCT FROM cfg.account_fields->p_role THEN
  RAISE EXCEPTION 'FINORA_POSTING_CONTRACT_CHANGED' USING ERRCODE='40001';END IF;
 RETURN account_id;
END $f$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_rial(p jsonb,k text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=''
AS $f$
BEGIN
 IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' OR (p->>k) !~ '^(0|[1-9][0-9]{0,22})$' THEN
  RAISE EXCEPTION 'FINORA_SOURCE_AMOUNT_INVALID %',k USING ERRCODE='23514';END IF;
 RETURN (p->>k)::numeric;
END $f$;

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

CREATE OR REPLACE FUNCTION private.finora_phase1a_sale_lines(
 org uuid,company text,source jsonb,ver bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE ar text;rev text;vat_acc text;a jsonb;ls jsonb;
BEGIN
 ar:=private.finora_phase1a_resolve_role(org,company,
  CASE WHEN source->>'paymentMethod'='credit' THEN 'receivable_control' ELSE 'cash_default' END,ver);
 rev:=private.finora_phase1a_resolve_role(org,company,'revenue_default',ver);
 a:=private.finora_phase1a_document_amounts(source,'sale');
 IF (a->>'net')::numeric<=0 THEN
  RAISE EXCEPTION 'FINORA_SOURCE_NET_AMOUNT_INVALID' USING ERRCODE='23514';END IF;
 ls:=jsonb_build_array(
  jsonb_build_object('accountId',ar,'debit',(a->>'total')::numeric,'credit',0),
  jsonb_build_object('accountId',rev,'debit',0,'credit',(a->>'net')::numeric));
 IF (a->>'vat')::numeric>0 THEN
  vat_acc:=private.finora_phase1a_resolve_role(org,company,'vat_payable',ver);
  ls:=ls||jsonb_build_array(jsonb_build_object('accountId',vat_acc,'debit',0,'credit',(a->>'vat')::numeric));
 END IF;
 RETURN ls;
END $f$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_expected_lines(
 org uuid,company text,typ text,source jsonb,ver bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$ BEGIN
 IF typ='sale' THEN RETURN private.finora_phase1a_sale_lines(org,company,source,ver);END IF;
 RAISE EXCEPTION 'FINORA_AUTOPOST_CONTRACT_UNSUPPORTED' USING ERRCODE='23514';
END $f$;
REVOKE ALL ON FUNCTION private.finora_phase1a_resolve_role(uuid,text,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_document_amounts(jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_rial(jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_sale_lines(uuid,text,jsonb,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.finora_phase1a_expected_lines(uuid,text,text,jsonb,bigint) FROM PUBLIC,anon,authenticated;
