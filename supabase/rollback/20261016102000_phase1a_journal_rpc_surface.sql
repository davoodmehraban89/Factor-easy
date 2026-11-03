-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

REVOKE ALL ON FUNCTION public.finora_journal_create_draft(p_organization_id uuid, p_voucher_id text, p_header jsonb, p_lines jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.finora_journal_post(p_organization_id uuid, p_voucher_id text, p_expected_version bigint) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.finora_journal_delete_draft(p_organization_id uuid, p_voucher_id text, p_expected_version bigint) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.finora_journal_update_draft(p_organization_id uuid, p_voucher_id text, p_expected_version bigint, p_header jsonb, p_lines jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.finora_journal_autopost(p_organization_id uuid, p_voucher_id text, p_source_collection text, p_source_id text, p_header jsonb, p_lines jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.finora_journal_reverse(p_organization_id uuid, p_original_id text, p_reversal_id text, p_date text, p_reason text, p_expected_version bigint, p_allocations jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON public.finora_journal_reversal_status FROM PUBLIC,anon,authenticated,service_role;
