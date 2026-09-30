# Office Slice C5 — Internal Approval / Attestation Verification

Date: 2026-10-01
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
- Server-authoritative internal approval requests for registered correspondence.
- Assigned approver must be an active organization member with both Office `approve` and `read` access to the exact source letter.
- Requester cannot self-approve; only the bound approver can decide.
- Approval evidence is append-only in the protected Office audit channel.
- One active request per correspondence; terminal decisions are exactly `approved` or `rejected`.
- Rejection permits a later fresh approval request while preserving prior evidence.
- Request and decision record authenticated user, timestamp, note and JWT AAL metadata.
- Each request stores a SHA-256 `contentDigest` of the correspondence JSON. A decision is rejected if the letter changed after the request; the queue exposes `content_changed`.
- UI exposes «تأییدات داخلی», request, queue, approve/reject and stale-content indication.
- This is internal authenticated attestation only and is **not a qualified digital signature**.

## Production migrations
- `20260930203456 office_slice_c5_internal_approval` — initial C5 foundation.
- `20260930203620 office_slice_c5_internal_approval` — content-bound attestation hardening and queue expansion.
- `20260930203709 office_c5_decision_event_order_fix` — corrected decision request ordering to use immutable event time stored in JSON rather than a nonexistent records column.

All three production SQL steps are archived under `supabase/migrations/`.

## Adversarial production verification
Transactional verification used existing legitimate principals and rolled back all temporary state.

PASS:
1. Member without approval/read authorization cannot be assigned.
2. Requester cannot assign self as approver.
3. Authorized target can receive an approval request.
4. Request evidence contains a 64-character SHA-256 content digest, AAL evidence and an explicit `qualifiedDigitalSignature=false` boundary.
5. Duplicate active request is rejected.
6. Requester cannot decide the request.
7. Queue reports pending/overdue state.
8. Mutating letter content after request makes `content_changed=true`.
9. Changed content cannot be approved; server requires a fresh request.
10. After restoring the exact requested content, assigned approver can reject.
11. A new request after rejection can be approved.
12. Duplicate terminal decision is rejected.
13. Cross-tenant principal receives no approval queue rows.
14. Rollback residue is zero; temporary member is absent and temporary seat expansion returned to `max_users=1`.

## CI evidence
Verified C5 runtime/hardening head: `02f76f18c7685a4da88de68972113d32b30a21fb`.
- Quality `36774255459`: PASS including JavaScript syntax, all accounting/Golden/ELI/C1-C5 invariants and Real-DOM.
- Security `36774255463`: CodeQL JavaScript PASS. Dependency Review remains skipped because repository Dependency Graph is not enabled.
- Pages `36774253349`: build/deploy/report PASS.

## Advisor status
- C5 uses public SECURITY INVOKER wrappers over private authorization-checked implementation functions, so the current external SECURITY DEFINER warning count did not increase because of C5.
- Existing advisor warnings remain: 20 authenticated-callable SECURITY DEFINER functions elsewhere and leaked-password protection disabled.
- Performance advisor reports 12 unused-index informational notices.

## Scope boundary
C5 does not claim qualified digital signature, external certificate/timestamp authority, persistent two-real-user browser E2E, OCR/full-text quality or external delivery adapters.
