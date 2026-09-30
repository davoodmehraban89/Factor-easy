# Office Slice C7 — Full-text Archive + OCR Provenance/Correction Plan

Date: 2026-10-01

**Goal:** Add tenant-safe server-side full-text archive search and append-only OCR-text provenance/correction without claiming real Persian OCR accuracy.

## Scope
- Weighted PostgreSQL full-text search over correspondence identity, subject, counterparty, body, archive metadata and latest effective OCR text.
- `simple` text-search configuration, validated against Persian tokens in Production.
- Append-only `ocr_text_recorded` evidence with provider-output provenance and human-correction lineage.
- Human correction must reference and preserve the prior raw OCR payload.
- Latest OCR RPC for controlled correction UI.
- Archive UI shows OCR state/version/source and uses ranked server search.
- No OCR engine/provider is connected in C7; accuracy remains unverified until representative real scans are processed and measured.

## Security invariants
1. Tenant isolation, entitlement, confidentiality and source-record read access remain server-authoritative.
2. Only Office archive/configure authority may record OCR text or corrections.
3. Direct audit-evidence forgery remains blocked.
4. Human correction requires prior OCR evidence and cannot replace raw provider output.
5. Public RPC wrappers are SECURITY INVOKER; privileged implementations remain private with empty search_path.
6. C1-C6, ELI, accounting and Golden gates remain green.
