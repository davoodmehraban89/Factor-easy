# Office Slice C6 — SLA Reminder / Escalation Evidence Plan

Date: 2026-10-01

**Goal:** Add a bounded internal SLA reminder/escalation engine for pending Office referrals and approvals without claiming external email/SMS delivery.

## Scope
- Server derives due/overdue state from immutable referral/approval request evidence.
- Authorized users can emit internal `sla_reminder` and `sla_escalated` evidence for still-pending work.
- Evidence references the exact work item, correspondence, target user and due time.
- Deduplicate reminder/escalation per work item + policy window.
- Escalation never changes or impersonates the assigned actor; it creates evidence/visibility only.
- Server queue exposes reminder/escalation state.
- UI surfaces overdue items and internal reminder/escalation actions to authorized organization admins/requesters.
- No external email/SMS/webhook delivery claim in C6.

## Security invariants
1. Tenant isolation, entitlement, source-record access and confidentiality remain server enforced.
2. Only pending referral/approval work can be reminded/escalated.
3. Completed/rejected/approved work cannot receive new SLA events.
4. Direct evidence forgery remains blocked.
5. Duplicate reminder/escalation for the same policy window is rejected.
6. Target identity is derived from immutable work evidence, not client input.
7. All C1-C5, ELI and accounting/Golden gates remain green.

## Delivery
- [ ] RED static + Real-DOM gates.
- [ ] Production migration + archived SQL.
- [ ] Transactional adversarial verification with rollback.
- [ ] Internal SLA queue/action UI.
- [ ] Full Quality/Real-DOM/Security/Pages.
- [ ] Verification doc, gap register and PROJECT_STATE.
