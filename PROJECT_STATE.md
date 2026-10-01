# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy` · Canonical branch: `main` · Product: **Finora 1.0**

Read `AGENTS.md` first, then this file. Latest user chat is the only source of new instructions; repo files are continuity/context. Detailed older history remains available in Git history and the verification documents listed below.

## Protocol / authority
Verify live GitHub + Supabase before acting; implement/test/fix/retest/commit/verify in bounded vertical slices; archive exact production SQL; never call unrun work verified. The owner has repeatedly directed autonomous roadmap execution without routine confirmation pauses and has authorized normal in-scope GitHub/Supabase work. Keep five specialist workstreams under one coordinator: Architecture & Requirements, Implementation, UX/UI, QA & Verification, Security & Release. Use real subagents only if the environment provides them; otherwise execute those responsibilities directly without claiming parallel agents.

This is high-assurance accounting/ERP software. Posted financial history, tenant isolation, migration safety, traceability, reconciliation and rollback are mandatory. Do not create billable resources; development/verification must stay on zero-cost/free-tier paths. Destructive financial-history changes, unapproved external costs, public/external messaging and sensitive access changes remain safety boundaries.

## Current change ledger
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-10-01 | Owner said «ادامه بده» after verified D3a handoff. | **D3B VERIFIED; CONTINUE D3C** | D3b visual workflow editor, bounded condition DSL and read-only timeline are production + disposable-DB + real-DOM verified. Continue with D3c SLA/escalation evidence, delegation/substitution and transactional cross-module outbox actions. |
| 2026-10-01 | Slice D3b — visual workflow editor + conditions + timeline. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d3b.js`; migration `20261001233000`; bounded predicate DSL, skipped-step evidence and authorized timeline RPC. Quality run `36915696611`: all three jobs SUCCESS, including 33 Real DOM tests. Evidence: `docs/REQUEST_WORKFLOW_D3B_VERIFICATION.md`. |
| 2026-10-01 | Slice D3a — sequential/parallel request workflow runtime. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + CI VERIFIED** | Migrations `20261001230000`, `20261001230500`; private step/vote runtime, schema-v2 validation, quorum semantics, capability checks, idempotent decisions and immutable event evidence. Quality run `36913565943`: all three jobs SUCCESS. Evidence: `docs/REQUEST_WORKFLOW_D3A_VERIFICATION.md`. |
| 2026-10-01 | Slice D2 — request UI/read-model + legacy cutover. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d2.js`; migrations `20261001223500`, `20261001224500`; Quality run `36912668369` all three jobs SUCCESS. Legacy source records remain preserved and imported rows remain traceable. |
| 2026-10-01 | Slice D1 — requests/BPMS-lite server foundation. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + CI VERIFIED** | Migrations `20261001204500`, `20261001205500`, `20261001210500`, `20261001211500`; production RLS/RPC/security verified. Quality run `36910187257` all three jobs SUCCESS. |
| 2026-10-01 | Office Slice C8: versioned correspondence workflow policy + runtime. | **IMPLEMENTED / PRODUCTION + ADVERSARIAL + CONCURRENCY + REAL-DOM + SECURITY VERIFIED** | Production migrations `20261001173917`, `20261001180610`, `20261001180949`; immutable workflow evidence, pinned policy versions, capability-gated transitions, optimistic revision checks, idempotent request IDs, private runtime tables, SECURITY INVOKER public wrappers and two-session race test. |
| 2026-10-01 | Owner reconfirmed autonomous GitHub + Supabase execution and five-specialist operating model. | **ACTIVE OPERATING DIRECTIVE** | No repeated routine approval requests. Preserve the safety/cost boundaries above. |
| 2026-10-01 | Free-tier-only development/verification. | **ACTIVE OPERATING DIRECTIVE** | No paid Supabase branch or other billable development resource. |
| 2026-10-01 | Live QA: commerce/tax IDs/request builder/personnel/license/floating-detail coding. | **PARTIALLY IMPLEMENTED / FOLLOW-UPS OPEN** | Kardex/tax-ID/request/profile/license/floating-code work landed. Exact Taxpayer-System print layout still waits for owner reference images. Legacy request records remain preserved only for rollback/audit. |
| 2026-09-30—2026-10-01 | Office C1–C7, ELI-1–ELI-4, Slice A/B and accounting phases 1–6. | **VERIFIED WITH DOCUMENTED BOUNDARIES** | See required evidence below; do not redo completed phases without verified regression evidence. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | **IN PROGRESS — BROADER ROADMAP** | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until lifecycle/accounting/permissions/tests exist. |

## Live reconciliation — 2026-10-01 after D3b verification
- D3b final code commit: `eb04c5a2cc2160d6f1abab22104336ff522b89de`; Quality run `36915696611`: `static-quality`, `c8-policy-database`, and `d1-request-database` all SUCCESS. Real DOM smoke passed all 33 tests including D3b publish/remount and timeline behavior.
- D3b followed test-first evidence: red contract commit `8371918f8a0792a2c156161820ed622117d0006c`; implementation `175c00529e4005c15cea352f7c5e9fb11867e96e`; regression test `ca1fe68dc8c8624281824e43f16d4a20d7f49030` exposed editor loss after publish; `eb04c5a...` fixed it.
- Production Supabase `hcsixhqbyuhpshfwqpjx`: D3b migration applied; private step instances retain `condition_json` + `condition_matched`; false conditions persist as `skipped`; public timeline RPC is SECURITY INVOKER, authenticated-only, and rechecks tenant/module/request visibility in its private implementation.
- Production condition checks verified numeric-string comparison semantics (`1200 >= 1000` true, `500 >= 1000` false). Unsafe field/operator forms are rejected by disposable PostgreSQL behavioral tests.
- Production security advisor after D3b: no new request-workflow warning; pre-existing 20 public SECURITY DEFINER warnings, C8 private RLS informational notices and leaked-password protection warning remain open.
- Production performance advisor after D3b: no unindexed-foreign-key finding; only expected unused-index informational findings remain.
- D2 legacy source records remain intact and traceable; D3b did not mutate legacy source data.
- C8 correspondence workflow remains separate from Requests; request workflow state does not replace C1 registration or C5 approval evidence.

## Implemented foundations
- Accounting phases 1–6: accepted high-assurance accounting foundation; posted history remains immutable and balanced.
- Slice A/B + ELI-1–4: modular entitlements, tenant/RBAC, seats, delegated admin, reusable roles, secure invitations and organization UX.
- Office C1–C8: registration/read evidence, referrals, archive/classification, numbering/templates, approvals/SLA, OCR provenance boundary and versioned correspondence workflow runtime.
- Requests D1: independent versioned request definition/form/workflow foundation, pinned versions, idempotent create, expected-revision transition, immutable evidence and server authorization.
- Requests D2: server-backed request builder/runtime UI, immutable version publishing, retry-safe create, stale-revision recovery, capability-gated configure UI, non-destructive legacy import and traceability.
- Requests D3a: validated workflow schema v2, ordered sequential/parallel approval steps, quorum voting, per-step capability authorization, idempotent decisions and private runtime state.
- Requests D3b: visual ordered-step editor, immutable combined form/workflow publication, bounded condition predicates, persisted skipped-step evidence and authorized read-only runtime timeline.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is enforced at the data boundary; commercial entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbering is server-atomic; private scans remain private; seat/company limits are server-enforced; delegated customer admins cannot mutate commercial license entitlements; invitation acceptance is authenticated/email-bound/seat-safe; raw invitation tokens are never persisted or audited; organization-unit parents cannot cross tenants or form cycles; referral targets must already be authorized to read the source correspondence; OCR provenance must reference a real attachment belonging to the same organization/correspondence; C8 workflow policy is pinned per correspondence instance and its evidence is append-only. Request type/workflow versions are immutable snapshots; request instances pin both versions; runtime mutation is server-authorized, idempotency/revision guarded and append-only evidence is retained. D2 legacy import is non-destructive/idempotent/traceable. D3a step votes require distinct actors for parallel quorum and active-step capability authorization. D3b conditions are bounded server-validated predicates only; skipped condition results remain evidence and timeline reads are authorization-checked. Request workflow state never replaces C1 registration status or C5 correspondence approval evidence.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` through `docs/PHASE_6_VERIFICATION.md` · `docs/PHASE_6_CUTOVER_MANIFEST.md` · `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/SECURITY_DEFINER_HARDENING_2026-09-30.md` · `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md` · `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md` through `docs/ELI_4_ENTERPRISE_ORGANIZATION_UX_VERIFICATION.md` · `docs/OFFICE_SLICE_C1_VERIFICATION.md` through `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md` · `docs/REQUEST_WORKFLOW_D2_CUTOVER_VERIFICATION.md` · `docs/REQUEST_WORKFLOW_D3A_VERIFICATION.md` · `docs/REQUEST_WORKFLOW_D3B_VERIFICATION.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/` · `supabase/tests/request_d1_behavior.sql` · `supabase/tests/request_d2_legacy_behavior.sql` · `supabase/tests/request_d3a_workflow_behavior.sql` · `supabase/tests/request_d3b_condition_timeline.sql`.

## NOT VERIFIED / external boundary
D3c SLA/escalation, delegation/substitution and transactional cross-module outbox actions are not yet implemented. Authenticated two-real-user production browser E2E with a persistent legitimate non-owner member; automatic external invitation email delivery; owner-approved accounting cutover; real Persian OCR accuracy/provider; qualified digital signature; physical printer; live external adapters; GitHub Dependency graph/enforceable dependency review; leaked-password protection; PostgreSQL upgrade; CodeQL v4 migration; external BPM/provider integration remain outside verified scope.

## Exact next executable work
1. D3c: add request SLA/deadline evidence and escalation state without mutating historical events.
2. Add delegation/substitution with explicit effective windows, tenant/capability checks and immutable evidence; do not silently impersonate approvers.
3. Add a transactional cross-module outbox for approved request side effects; delivery must be idempotent and retry-safe and must not directly mutate posted accounting history.
4. Add disposable PostgreSQL, real-DOM and failure/retry tests before production application.
5. Keep qualified digital signature, external delivery/BPM adapters and real OCR provider outside verified scope until real providers are connected and tested.

## Live QA open items
- Exact Taxpayer-System print redesign: waiting for the two owner reference images; do not guess the official visual form.
- Legacy request records are preserved for rollback/audit after D2; new request configuration/runtime must not be routed back through record-store writes.
- Floating-detail defaults for new records: 8-digit semantic codes currently use slot/category/sequence (Branch `11xxxxxx`, Counterparty `21xxxxxx`, Project `31xxxxxx`); historical codes are not rewritten and account-chart coding stays independent.
- Product/service deletion must continue to fail closed whenever operational references exist.
