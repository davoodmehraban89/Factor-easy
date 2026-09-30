# Office Slice C1 — Registered History + Read Evidence Verification

Date: 2026-09-30
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
- Registered correspondence can no longer be deleted after registration.
- Registration identity (`organization_id`, owner, collection/id, `registryId`, `registerNumber`, `registeredAt`) is immutable after registration.
- Registered correspondence status is monotonic across `registered -> submitted -> closed`; backward transitions are rejected.
- Registered correspondence mutations emit organization audit evidence.
- Read evidence is append-only and records the authenticated reader server-side through `office_mark_correspondence_read`.
- The correspondence open flow records read evidence before showing a non-draft letter; if evidence creation fails, display is stopped rather than silently losing the audit event.

## Production migration
`20260930054352 office_registered_history_read_evidence`

The archived repository migration is:
`supabase/migrations/20260930054352_office_registered_history_read_evidence.sql`.

## TDD / implementation evidence
- Plan: `59ebb658a4f284b3d0137bb2289ab8829a4bd381`.
- Server hardening: `20790d5998ef06105d5715864fb4ce2453dc470e`.
- Failing Real-DOM coverage first: `fe7ffd102d9ed03f0d5967447bcecef64485741e`.
- Runtime integration: `15b32367ff9a8154729da27cd581930871b5fb5b`.

## Transactional production adversarial verification
All fixtures and evidence were created inside a transaction and rolled back. Post-test residue counts were zero.

PASS:
1. Protected registration-number mutation is rejected.
2. Registered correspondence cannot move backward to draft.
3. Registered correspondence delete is rejected.
4. Authorized organization owner can create read evidence.
5. Read evidence stores the authenticated principal as `readerUserId`; the caller cannot supply a forged reader.
6. Read evidence update is rejected.
7. Read evidence delete is rejected.
8. A principal from another organization cannot create read evidence for the letter.
9. Registered correspondence mutation produced organization-audit evidence inside the transaction.
10. Rollback left zero correspondence fixture, read-evidence or organization-audit residue.

## GitHub evidence
Verified product head for the C1 runtime: `15b32367ff9a8154729da27cd581930871b5fb5b`.
- Quality run `36674993838`: PASS, including all accounting/Golden, ELI-1/2/3/4, Office C1 invariants and Real-DOM.
- Security run `36674993881`: CodeQL JavaScript PASS. Dependency Review remains skipped because the repository dependency-graph boundary is unchanged.
- Pages run `36674993095`: build/deploy/report PASS.

## Supabase advisor status
- Security advisor still reports authenticated-callable SECURITY DEFINER RPC warnings, including the intentionally exposed `office_mark_correspondence_read`; its negative cross-tenant authorization test passed. This warning remains a review/disposition item rather than being treated as proof of an exploit.
- Leaked-password protection remains disabled.
- Performance advisor reports unused-index informational notices only in the current snapshot.

## Scope boundary / NOT VERIFIED
C1 closes only registered-history immutability and server-authoritative read evidence. It does not claim completion of:
- letter templates/editor;
- approval/signature lifecycle or qualified digital signatures;
- full referral-chain UX, SLA/reminders or reply/related-letter graph;
- archive folders/classification;
- real Persian OCR/full-text quality;
- external email/ECE/API delivery adapters;
- persistent two-real-user production browser E2E.

Those remain later Office Slice C / external-boundary work.
