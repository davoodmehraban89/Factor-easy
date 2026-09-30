# Office Slice C2 — Actionable Referrals + SLA Work Queue Plan

Date: 2026-09-30

**Goal:** Turn the existing immutable referral event into a secure, actionable work lifecycle with target authorization, append-only acknowledgement/completion evidence and an SLA-aware shared work queue.

## Scope
- Harden referral creation so a sender cannot refer a letter to a member who is not authorized to read that correspondence.
- Preserve referrals as immutable events; never mutate the original referral to represent workflow progress.
- Add append-only referral actions (`acknowledged`, `completed`) as correspondence audit evidence.
- Add a server-authoritative queue RPC that returns only referrals the caller may legitimately see (sender, target, or organization owner) with derived state and overdue status.
- Add a real Office “ارجاعات و پیگیری” work surface and action buttons.
- Keep templates/editor, signatures/approval, related-letter graph, OCR and external adapters out of C2.

## Security invariants
1. Effective access remains entitlement ∩ active membership/capability ∩ record scope ∩ confidentiality.
2. Referral target eligibility is checked server-side against the source correspondence, not trusted from the UI.
3. A referral recipient is bound to an active organization member and user.
4. Only the referral target may acknowledge/complete it; organization ownership does not impersonate the recipient.
5. Completion cannot precede acknowledgement and duplicate terminal actions are rejected.
6. Referral/action evidence is append-only.
7. Queue output is server-filtered; UI hiding is not authorization.
8. Existing accounting/Golden, ELI-1/2/3/4 and Office C1 gates must remain green.

## Delivery tasks
- [x] Commit failing C2 static + Real-DOM coverage first.
- [x] Add production migration with target-access helper, hardened referral v2 RPC, referral-action RPC and queue RPC.
- [x] Run transactional adversarial verification in Production and rollback all fixtures.
- [x] Archive the exact production migration in the repository.
- [x] Implement work-queue UI and referral action flow.
- [x] Run full Quality/Real-DOM/Security/Pages.
- [x] Write `docs/OFFICE_SLICE_C2_VERIFICATION.md`, update gap register and `PROJECT_STATE.md`.
