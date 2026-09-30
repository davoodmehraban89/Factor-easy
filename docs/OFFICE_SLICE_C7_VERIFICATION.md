# Office Slice C7 — Searchable Archive + OCR Provenance Verification

Date: 2026-10-01
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
- PostgreSQL full-text archive search across correspondence metadata, body, archive classification/tags and latest OCR text.
- Server-side tenant/RBAC/confidentiality filtering remains authoritative.
- Append-only OCR capture evidence records source reference, provider label, language, optional confidence, raw provider text, actor and timestamp.
- Human OCR correction is a separate append-only event; raw provider output is preserved while latest correction becomes searchable.
- Search results expose `match_source` plus OCR provenance/correction state.
- Query length is capped at 200 characters and result count at 200.
- UI exposes OCR evidence/correction controls and clearly labels the OCR boundary.
- OCR provenance is now bound to a real `correspondenceAttachments` record in the same organization and correspondence; arbitrary/nonexistent or cross-letter source references are rejected server-side.

## Production verification
Transactional adversarial verification: PASS.
- Persian metadata/body/OCR terms were found through server full-text search.
- Corrected OCR text replaced raw OCR text for latest searchable content while raw evidence remained immutable.
- Match source correctly distinguished metadata/body/OCR.
- Oversized query was rejected after the C7 search-input guard.
- Cross-tenant search returned no rows and cross-tenant OCR evidence write was rejected.
- Rollback residue: zero.
- Follow-up adversarial binding test rejected a nonexistent attachment ID and an attachment belonging to another correspondence, accepted the correct attachment, persisted its server-derived storage path in evidence, preserved OCR search, and rolled back with zero residue.

## Migrations
- `20260930205325 office_slice_c7_searchable_archive_ocr_provenance`
- `20260930205347 office_c7_search_input_guard`
- `20260930205309 office_slice_c7_fulltext_ocr_provenance` is an abandoned concurrent API surface retained only for exact migration-history continuity.
- `20260930205753 office_c7_remove_abandoned_duplicate_api` removes that duplicate experimental API.
- `20260930205919 office_c7_bind_ocr_source_attachment` binds OCR provenance to a real same-letter attachment and stores the server-derived storage path. All five C7 production migration entries are archived in Git; production history was not rewritten.

## CI
Base C7 head `c307422eae508b57e448a3c9b4b3e3506836f3e2` passed Quality/Real-DOM, CodeQL and Pages. Attachment-binding follow-up merged as `b1c800c540e1181ffbe3efc32998c77e0c8f9fd1`.
- Quality `36776969154`: PASS including C7 invariant and Real-DOM.
- Security `36776969247`: CodeQL JavaScript PASS. Push dependency review is skipped by design; PR #10 executed the dependency-review action but the workflow's unavailable-graph warning also ran, so Dependency Graph is still not treated as verified.
- Pages `36776967625`: PASS.

## Advisor status
C7 uses public SECURITY INVOKER wrappers over private authorization-checked implementations; authenticated-callable public SECURITY DEFINER warning count remains 20. Leaked-password protection remains disabled. Performance advisor remains informational unused-index notices.

## Explicit boundary
C7 **does not perform OCR** and **does not verify real Persian OCR accuracy**. Real Persian OCR remains unverified until a real OCR provider and representative Persian scans are connected and measured. Qualified digital signature and external delivery adapters remain outside C7.
