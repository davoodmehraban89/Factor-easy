-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

CREATE OR REPLACE FUNCTION private.finora_phase1a_expected_lines(org uuid, company text, typ text, source jsonb, ver bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN
 IF typ='sale' THEN RETURN private.finora_phase1a_sale_lines(org,company,source,ver);END IF;
 RAISE EXCEPTION 'FINORA_AUTOPOST_CONTRACT_UNSUPPORTED' USING ERRCODE='23514';
END $function$
;

REVOKE ALL ON FUNCTION private.finora_phase1a_expected_lines(org uuid, company text, typ text, source jsonb, ver bigint) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_purchase_lines(org uuid, company text, source jsonb, ver bigint) FROM PUBLIC,anon,authenticated,service_role;
