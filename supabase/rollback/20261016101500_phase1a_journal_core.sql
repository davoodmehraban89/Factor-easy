-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

REVOKE ALL ON FUNCTION private.finora_phase1a_post_core(p_org uuid, p_id text, p_expected_version bigint, p_auto boolean) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_validate_line(p_org uuid, p_company text, p_line jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_validate_saved(p_org uuid, p_voucher text, p_company text) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_write_lines(p_org uuid, p_actor uuid, p_voucher text, p_company text, p_lines jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_authorize(p_org uuid, p_cap text, p_source_type text) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_create_core(p_org uuid, p_id text, p_header jsonb, p_lines jsonb) FROM PUBLIC,anon,authenticated,service_role;
