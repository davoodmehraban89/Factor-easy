-- Revert only the trigger topology introduced by Issue248 correction.
-- Does not resurrect deleted drafts, change registry/audit, or rewrite history.
DROP TRIGGER IF EXISTS zz_finora_wp4_guarded_draft_delete_trg ON public.records;
DROP TRIGGER IF EXISTS finora_journal_document_lifecycle_trg ON public.records;
CREATE TRIGGER finora_journal_document_lifecycle_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.finora_journal_document_lifecycle_trigger();
DROP FUNCTION IF EXISTS private.finora_wp4_guarded_draft_delete();
