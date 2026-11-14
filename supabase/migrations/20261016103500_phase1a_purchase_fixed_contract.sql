-- FINORA Stage1 fixed purchase-v1: debit purchase cost and recoverable VAT,
-- credit selected cash or payable. Never infer accounts from title/code.
CREATE OR REPLACE FUNCTION private.finora_phase1a_purchase_lines(
 org uuid,company text,source jsonb,ver bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE cost_account text;credit_account text;tax_account text;
 amounts jsonb;result jsonb;v_net numeric;v_tax numeric;v_total numeric;
BEGIN
 cost_account:=private.finora_phase1a_resolve_role(org,company,'purchase_default',ver);
 credit_account:=private.finora_phase1a_resolve_role(org,company,
  CASE WHEN source->>'paymentMethod'='credit' THEN 'payable_control' ELSE 'cash_default' END,ver);
 amounts:=private.finora_phase1a_document_amounts(source,'purchase');
 v_net:=(amounts->>'net')::numeric;
 v_tax:=(amounts->>'vat')::numeric;
 v_total:=(amounts->>'total')::numeric;
 IF v_net<=0 THEN RAISE EXCEPTION 'FINORA_SOURCE_NET_AMOUNT_INVALID' USING ERRCODE='23514';END IF;
 result:=jsonb_build_array(jsonb_build_object(
  'accountId',cost_account,'debit',v_net,'credit',0));
 IF v_tax>0 THEN
  tax_account:=private.finora_phase1a_resolve_role(org,company,'vat_recoverable',ver);
  result:=result||jsonb_build_array(jsonb_build_object(
    'accountId',tax_account,'debit',v_tax,'credit',0));
 END IF;
 result:=result||jsonb_build_array(jsonb_build_object(
   'accountId',credit_account,'debit',0,'credit',v_total));
 RETURN result;
END $f$;

CREATE OR REPLACE FUNCTION private.finora_phase1a_expected_lines(
 org uuid,company text,typ text,source jsonb,ver bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
BEGIN
 IF typ='sale' THEN RETURN private.finora_phase1a_sale_lines(org,company,source,ver);END IF;
 IF typ='purchase' THEN RETURN private.finora_phase1a_purchase_lines(org,company,source,ver);END IF;
 RAISE EXCEPTION 'FINORA_AUTOPOST_CONTRACT_UNSUPPORTED' USING ERRCODE='23514';
END $f$;
REVOKE ALL ON FUNCTION private.finora_phase1a_purchase_lines(uuid,text,jsonb,bigint)
FROM PUBLIC,anon,authenticated;
