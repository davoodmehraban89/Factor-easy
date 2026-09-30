# Office Slice C2 — Actionable Referrals + SLA Work Queue Verification

Date: 2026-09-30
Project: `hcsixhqbyuhpshfwqpjx`

## Delivered
- Referral creation now verifies server-side that the target is an active member who is already authorized to read the source correspondence under scope and confidentiality rules.
- New referrals are bound to the target member/user rather than trusting client ownership.
- Referral progress is append-only: `acknowledged` must precede `completed`; duplicate/invalid transitions are rejected.
- `office_referral_work_queue` returns a server-filtered sender/target/owner queue with derived state and overdue status.
- Office UI now exposes «ارجاعات و پیگیری», target actions and optional due time.
- Direct authenticated inserts into `correspondenceReferrals` and `correspondenceAudit` are blocked; evidence must be produced by authorized server operations.

## Production migrations
- `20260930152500 office_slice_c2_actionable_referrals_sla`
- `20260930153000 office_evidence_insert_hardening`

Archived SQL:
- `supabase/migrations/20260930152500_office_slice_c2_actionable_referrals_sla.sql`
- `supabase/migrations/20260930153000_office_evidence_insert_hardening.sql`

## TDD / implementation evidence
- Plan: `8538918d33c7c408dfcc4132a8c013bfe9ed5812`.
- Failing C2 invariant coverage: `e58cebf3833c5ebf4bc8ad563f211b80484e4857`.
- Failing C2 Real-DOM coverage: `706d289b3b9221de186ab21e10d4ccf71e82d910`.
- Production migration archive: `46e527db2b63d254a7c44bbeb5d6203964a63a42`.
- Work-queue/action UI: `e6278172703d2a60d818fe6298b2528b59d83716`.
- Office navigation/runtime refresh: `d1d15d428173e5db747aa78a10219b0b0906f091`, `66b0fd6add3de424b6d594c0f0aa2d9f35f82a87`.
- Direct evidence-forgery regression gate: `4c102b5b814445cc989f1489088d6983d6e27fd5`.
- Evidence insert hardening: `7626a023f16b546ffce6ec5a9d23aa58b1749213`.

## Transactional production adversarial verification
All multi-user fixtures, temporary seat expansion, referral/action evidence and test correspondence were rolled back.

PASS:
1. Referral to a target without source-letter read authorization is rejected.
2. After an explicit temporary read grant, the same target can receive the referral.
3. Referral ownership/identity is bound to the target user.
4. Original referral mutation is rejected.
5. Sender queue sees its overdue sent referral.
6. Sender cannot impersonate the target and acknowledge the referral.
7. Target queue sees the assigned referral.
8. Completion before acknowledgement is rejected.
9. Target acknowledgement succeeds; duplicate acknowledgement is rejected.
10. Referral-action evidence mutation is rejected.
11. Completion after acknowledgement succeeds and clears overdue state.
12. Cross-tenant principal receives no queue rows.
13. Direct authenticated forged `correspondenceAudit` insert is rejected.
14. Direct authenticated forged `correspondenceReferrals` insert is rejected.
15. Authorized server read-evidence RPC still succeeds after the insert guard.
16. Authorized referral RPC still succeeds after the insert guard.
17. Rollback residue is zero; temporary target membership is absent and the exercised license returned to `max_users=1`.

## GitHub evidence
Verified product head before this evidence commit: `7626a023f16b546ffce6ec5a9d23aa58b1749213`.
- Quality `36737229597`: PASS including JavaScript syntax, accounting/Golden, ELI-1/2/3/4, Office C1/C2 invariants and Real-DOM.
- Security `36737229678`: CodeQL JavaScript PASS. Dependency Review remains skipped because GitHub Dependency graph is still not enabled.
- Pages `36737229045`: build/deploy/report PASS.

## Supabase advisor status
- Security advisor reports 17 authenticated-callable SECURITY DEFINER warnings, including the three intentionally exposed C2 RPCs. C2 has explicit entitlement/membership/scope/confidentiality checks plus negative adversarial tests; the warnings remain tracked for exposure review rather than treated as proof of exploitability.
- Leaked-password protection remains disabled.
- Performance advisor reports 12 unused-index informational notices and no new critical performance finding in the current snapshot.

## Scope boundary / NOT VERIFIED
C2 does not claim persistent two-real-user production browser E2E because production still has zero persistent non-owner members. It also does not claim templates/editor, approval/signature, qualified digital signature, related-letter graph, archive classification, real Persian OCR/full-text quality, external delivery adapters or physical-printer validation.
