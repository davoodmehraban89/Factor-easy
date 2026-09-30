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

## Production verification
Transactional adversarial verification: PASS.
- Persian metadata/body/OCR terms were found through server full-text search.
- Corrected OCR text replaced raw OCR text for latest searchable content while raw evidence remained immutable.
- Match source correctly distinguished metadata/body/OCR.
- Oversized query was rejected after the C7 search-input guard.
- Cross-tenant search returned no rows and cross-tenant OCR evidence write was rejected.
- Rollback residue: zero.

## Migrations
- `20260930205325 office_slice_c7_searchable_archive_ocr_provenance`
- `20260930205347 office_c7_search_input_guard`
- Production migration history also contains `20260930205309 office_slice_c7_fulltext_ocr_provenance`; it produced no remaining C7-named callable function in the inspected live schema. This migration-history entry must remain preserved; do not rewrite production history.

## CI
Verified head: `c307422eae508b57e448a3c9b4b3e3506836f3e2`.
- Quality `36776208848`: PASS including C7 invariant and Real-DOM.
- Security `36776208767`: CodeQL JavaScript PASS; Dependency Review skipped because repository Dependency Graph is not enabled.
- Pages `36776208873`: PASS.

## Advisor status
C7 uses public SECURITY INVOKER wrappers over private authorization-checked implementations; authenticated-callable public SECURITY DEFINER warning count remains 20. Leaked-password protection remains disabled. Performance advisor remains informational unused-index notices.

## Explicit boundary
C7 **does not perform OCR** and **does not verify real Persian OCR accuracy**. Real Persian OCR remains unverified until a real OCR provider and representative Persian scans are connected and measured. Qualified digital signature and external delivery adapters remain outside C7.
