-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

DROP TRIGGER IF EXISTS trg_finora_phase1a_account_mapping_sync ON public.records;

DROP TRIGGER IF EXISTS trg_finora_phase1a_role_snapshots_immutable ON private.finora_phase1a_account_role_snapshots;

DROP TRIGGER IF EXISTS trg_finora_phase1a_role_audit_immutable ON private.finora_phase1a_account_role_audit;

REVOKE ALL ON FUNCTION private.finora_phase1a_role_immutable() FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_account_fields(p jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_guard_account_mapping_sync() FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.finora_phase1a_publish_role_assignments(p_organization_id uuid, p_company_id text, p_assignments jsonb, p_expected_version bigint, p_reason text) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_check_role_account(p_org uuid, p_company text, p_role text, p_account text) FROM PUBLIC,anon,authenticated,service_role;
