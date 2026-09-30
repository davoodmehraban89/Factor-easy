# Office Slice C3 — Related-Letter Graph + Archive Classification/Search Plan

Date: 2026-09-30

**Goal:** Add durable reply/related-letter relationships and server-authoritative archive classification/search without claiming OCR or external document-management integrations.

## Scope
- Append-only correspondence relation evidence: `reply_to` and `related`.
- Prevent self-links, duplicate reply parents and reply cycles.
- Append-only archive classification events (folder, classification code, tags) with latest-event semantics.
- Server-filtered archive search over readable correspondence and structured classification metadata.
- Office archive UI for folder/classification filters, classification action and relation creation.
- No OCR-quality claim, no qualified signature, no external archive adapter.

## Security invariants
1. Both ends of a relation must be readable by the caller in the same organization.
2. Relation/classification events are server-created `correspondenceAudit` evidence and inherit the direct-insert guard from C2.
3. `reply_to` has at most one parent per source and cannot form a cycle.
4. Archive classification requires `archive` or `configure` capability and never rewrites registration identity/history.
5. Archive search returns only rows passing entitlement + membership + scope + confidentiality.
6. Existing accounting/Golden, ELI-1/2/3/4 and Office C1/C2 gates remain green.

## Delivery tasks
- [ ] Commit failing C3 static + Real-DOM coverage first.
- [ ] Apply and archive production migration for relations/classification/search.
- [ ] Run rollback adversarial tests for cross-tenant/unreadable links, cycle/duplicate denial, classification authorization and search isolation.
- [ ] Implement archive/relation UI and runtime integration.
- [ ] Run full Quality/Real-DOM/Security/Pages.
- [ ] Write C3 verification evidence and update canonical continuity/gap register.
