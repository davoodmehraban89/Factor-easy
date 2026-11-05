-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

DROP TRIGGER IF EXISTS trg_finora_phase1a_posted_balance ON public.records;

DROP TRIGGER IF EXISTS trg_finora_phase1a_guard_children ON public.records;

DROP TRIGGER IF EXISTS trg_finora_phase1a_journal_server_only ON public.records;

REVOKE ALL ON FUNCTION private.finora_phase1a_guard_journal_children() FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_assert_posted_balance() FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.finora_phase1a_guard_server_journal_fields() FROM PUBLIC,anon,authenticated,service_role;
