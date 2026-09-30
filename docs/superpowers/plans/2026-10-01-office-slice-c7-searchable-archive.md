# Office Slice C7 — Searchable Archive + OCR Provenance

Date: 2026-10-01

**Goal:** Mature the archive into a server-searchable, tenant-safe text index over correspondence metadata/body plus explicitly sourced OCR text. C7 records OCR provenance and human correction but does **not** claim real Persian OCR accuracy or perform OCR itself.

## Scope
- Server-maintained search document for correspondence using PostgreSQL full-text primitives.
- Search covers register/external numbers, subject, counterparty, body, archive folder/classification/tags, and latest OCR text.
- OCR evidence is append-only: raw text, source attachment/object reference, provider label, language, confidence (optional), captured time, actor.
- Human OCR correction is a separate append-only event referencing the OCR evidence; latest correction is searchable while raw provider output remains preserved.
- Tenant/RBAC/confidentiality filters are applied before rows are returned.
- Search returns match source metadata (metadata/body/ocr) and OCR provenance/correction state.
- No claim that C7 performs OCR, and no claim of Persian OCR accuracy until representative real scans/provider output are tested.

## Security / integrity
1. Only users with Office archive/configure capability and read access to the source correspondence may add OCR evidence/corrections.
2. OCR source correspondence and attachment/object reference are tenant-bound.
3. Raw OCR evidence cannot be overwritten; corrections never destroy provider output.
4. Cross-tenant or unreadable correspondence never appears in search.
5. Search uses bounded query length and bounded result count.
6. C1-C6, ELI and accounting/Golden gates remain green.

## Delivery
- RED static + Real-DOM gates.
- Production migration archived in Git.
- Transactional adversarial verification with rollback.
- Archive UI shows search source/provenance and OCR correction action.
- Full Quality/Real-DOM/Security/Pages.
- Verification doc + PROJECT_STATE handoff.
