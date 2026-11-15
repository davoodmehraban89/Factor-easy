-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

REVOKE ALL ON FUNCTION private.finora_phase1a_resolve_role(p_org uuid, p_company text, p_role text, p_version bigint) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_expected_lines(org uuid, company text, typ text, source jsonb, ver bigint) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_sale_lines(org uuid, company text, source jsonb, ver bigint) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_document_amounts(s jsonb, k text) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_rial(p jsonb, k text) FROM PUBLIC,anon,authenticated,service_role;
