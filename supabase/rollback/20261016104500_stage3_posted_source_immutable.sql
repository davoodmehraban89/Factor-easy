-- Conservative WP1 DOWN: restore prior definitions/ACLs; retain records, audit, counters, version columns and compatible indexes.

-- Generated from the source-derived disposable baseline. Production schema parity remains a separate gate.

DROP TRIGGER IF EXISTS trg_finora_stage3_posted_source_immutable ON public.records;

REVOKE ALL ON FUNCTION private.finora_stage3_guard_posted_source() FROM PUBLIC,anon,authenticated,service_role;
