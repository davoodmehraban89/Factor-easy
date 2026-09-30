# Office Slice C5 — Internal Approval / Attestation Lifecycle Plan

Date: 2026-09-30

**Goal:** Add a server-authoritative internal correspondence approval lifecycle with immutable request/decision evidence and explicit approver authorization, without misrepresenting it as a qualified digital signature.

## Scope
- Request approval for a readable registered correspondence from an active member who has Office `approve` capability and can read the letter.
- One active approval request per correspondence at a time.
- Append-only actions: `approval_requested`, then exactly one terminal `approval_approved` or `approval_rejected`.
- A rejected letter may be reworked through the existing controlled correspondence path and submitted in a new approval request; old evidence remains immutable.
- Only the assigned approver may decide the request.
- Server work queue derives pending/approved/rejected and overdue state.
- UI exposes «تأییدات داخلی», request action, approver queue and decision actions.
- Record authenticated user, timestamp, note and session AAL claim as evidence metadata. AAL is evidence only in C5; C5 does not require MFA or claim qualified signature.

## Security invariants
1. Requester must have active entitlement, `edit` or `refer` capability, and read access to the source correspondence.
2. Approver must be an active member with `approve` capability and independent read access to the source correspondence.
3. Requester cannot assign self as approver.
4. Only assigned approver may approve/reject.
5. Direct client evidence inserts remain blocked by C2 evidence guard.
6. Duplicate active requests and duplicate terminal decisions are rejected.
7. Queue is server-filtered to requester/approver/owner while preserving correspondence access.
8. Internal approval is not a qualified digital signature.
9. All C1-C4, ELI and accounting/Golden gates remain green.

## Delivery
- [ ] RED: C5 static + Real-DOM tests.
- [ ] GREEN: private definer implementation + public invoker wrappers, production migration and archived SQL.
- [ ] Transactional adversarial production verification with rollback.
- [ ] UI queue/request/decision integration.
- [ ] Full Quality/Real-DOM/Security/Pages.
- [ ] Verification doc, gap register and PROJECT_STATE.
