-- Isolated rollback / re-up preserving financial row data and version.
-- STRICTLY CI/Supabase local; don't execute against Production.
-- Chosen rollback is EXPAND-ONLY: preserve records.version and call counters,
-- avoiding loss of financial records/revision data during emergency rollback.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
VALUES('88888888-8888-4888-8888-888888888888','00000000-0000-0000-0000-000000000000',
'authenticated','authenticated','phase1a-rollback@example.invalid',now(),'{}'::jsonb);
INSERT INTO public.records(organization_id,owner_id,collection,id,data)
SELECT organization_id,'88888888-8888-4888-8888-888888888888','settings','main',
'{"phase1a_rollforward":"persist","revision_marker":"a"}'::jsonb
FROM public.organization_members
WHERE user_id='88888888-8888-4888-8888-888888888888' LIMIT 1;
UPDATE public.records SET data=jsonb_set(data,'{revision_marker}','"b"')
WHERE collection='settings' AND owner_id='88888888-8888-4888-8888-888888888888';
DO $before$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.records WHERE collection='settings'
 AND owner_id='88888888-8888-4888-8888-888888888888'
 AND version=2 AND data->>'revision_marker'='b'
 AND data->>'phase1a_rollforward'='persist') THEN
   RAISE EXCEPTION 'FINORA_ROLLBACK_PRECONDITION_VERSION_2_FAILED';
 END IF;
END $before$;
-- Flush all deferred constraint trigger events before changing table constraints.
SET CONSTRAINTS ALL IMMEDIATE;
-- DOWN: remove phase1A-specific guards, functions and indexes; leave data.
DROP TRIGGER IF EXISTS trg_finora_phase1a_posted_balance ON public.records;
DROP TRIGGER IF EXISTS trg_finora_phase1a_guard_children ON public.records;
DROP TRIGGER IF EXISTS trg_finora_phase1a_journal_server_only ON public.records;
DROP TRIGGER IF EXISTS trg_finora_phase1a_stamp_version ON public.records;
DROP FUNCTION IF EXISTS private.finora_phase1a_assert_posted_balance();
DROP FUNCTION IF EXISTS private.finora_phase1a_guard_journal_children();
DROP FUNCTION IF EXISTS private.finora_phase1a_guard_server_journal_fields();
DROP FUNCTION IF EXISTS private.finora_phase1a_stamp_version();
DROP FUNCTION IF EXISTS public.finora_sync_records_v2(jsonb,jsonb,uuid);
DROP INDEX IF EXISTS public.idx_finora_phase1a_journal_lines_parent;
DROP INDEX IF EXISTS public.idx_finora_phase1a_journal_dimensions_parent;
ALTER TABLE public.records DROP CONSTRAINT IF EXISTS finora_records_version_positive;
-- Recreate original unmodified legacy RPCs from a read-only source snapshot.
\i supabase/tests/phase1a_restore_legacy_sync_for_rollback.sql
DO $downcheck$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.records
 WHERE collection='settings' AND owner_id='88888888-8888-4888-8888-888888888888'
 AND version=2 AND data->>'revision_marker'='b') THEN
  RAISE EXCEPTION 'FINORA_ROLLBACK_DOWN_LOST_DATA';
 END IF;
 IF to_regprocedure('public.finora_sync_records_v2(jsonb,jsonb,uuid)') IS NOT NULL THEN
   RAISE EXCEPTION 'FINORA_ROLLBACK_DOWN_V2_STILL_PRESENT';
 END IF;
END $downcheck$;
-- UP: apply precisely the checked-in 1A migration files again.
\i /tmp/finora-phase1a-migrations/20261016100000_phase1a_server_journal_invariants.sql
\i /tmp/finora-phase1a-migrations/20261016100500_phase1a_optimistic_version_sync.sql
DO $upcheck$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.records
 WHERE collection='settings' AND owner_id='88888888-8888-4888-8888-888888888888'
 AND version=2 AND data->>'revision_marker'='b'
 AND data->>'phase1a_rollforward'='persist') THEN
   RAISE EXCEPTION 'FINORA_ROLLBACK_UP_LOST_DATA';
 END IF;
 IF to_regprocedure('public.finora_sync_records_v2(jsonb,jsonb,uuid)') IS NULL THEN
   RAISE EXCEPTION 'FINORA_ROLLBACK_UP_V2_MISSING';
 END IF;
END $upcheck$;
UPDATE public.records SET data=jsonb_set(data,'{revision_marker}','"c"')
WHERE collection='settings' AND owner_id='88888888-8888-4888-8888-888888888888';
DO $final$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.records WHERE collection='settings'
 AND owner_id='88888888-8888-4888-8888-888888888888'
 AND version=3 AND data->>'revision_marker'='c') THEN
   RAISE EXCEPTION 'FINORA_ROLLBACK_UP_VERSION_NOT_RESUMED';
 END IF;
 RAISE NOTICE 'FINORA_1A_ROLLBACK_UP_DOWN_UP_PASS version 2 preserved, version 3 resumed, zero data loss';
END $final$;
-- Roll back entire test. Other CI tests still see the initial 1A schema.
ROLLBACK;
