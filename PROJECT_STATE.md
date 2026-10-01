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
| 2026-10-01 | Owner authorized starting the canonical remediation pack after external full-system audit. | **WAVE 0 IN PROGRESS** | Execute release/QA safety gate first: F-406, F-423, F-424, F-407/F-402/F-403. Do not proceed to D4 while release safety and legacy request security blockers remain open. |
| 2026-10-01 | Owner said «ادامه بده» after D3a handoff. | **D3B + D3C VERIFIED** | D3b visual editor/conditions/timeline and D3c SLA/delegation/outbox are production + disposable-DB + real-DOM verified. Remediation audit supersedes roadmap ordering: Wave 0 then Wave 1 before D4. |
| 2026-10-01 | Slice D3c — SLA/escalation, delegation/substitution, transactional outbox. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d3c.js`; migrations `20261001235500`, `20261002000500`, `20261002001000`; Quality run `36917772952` all three jobs SUCCESS. Evidence: `docs/REQUEST_WORKFLOW_D3C_VERIFICATION.md`. |
| 2026-10-01 | Slice D3b — visual workflow editor + conditions + timeline. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d3b.js`; migration `20261001233000`; bounded predicate DSL, skipped-step evidence and authorized timeline RPC. Quality run `36915696611` all three jobs SUCCESS. Evidence: `docs/REQUEST_WORKFLOW_D3B_VERIFICATION.md`. |
| 2026-10-01 | Slice D3a — sequential/parallel request workflow runtime. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + CI VERIFIED** | Migrations `20261001230000`, `20261001230500`; private step/vote runtime, quorum semantics, capability checks, idempotent decisions and immutable evidence. Quality run `36913565943` all three jobs SUCCESS. |
| 2026-10-01 | Slice D2 — request UI/read-model + legacy cutover. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d2.js`; migrations `20261001223500`, `20261001224500`; Quality run `36912668369` all three jobs SUCCESS. Legacy source records remain preserved and imported rows traceable. |
| 2026-10-01 | Slice D1 — requests/BPMS-lite server foundation. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + CI VERIFIED** | Migrations `20261001204500`, `20261001205500`, `20261001210500`, `20261001211500`; Quality run `36910187257` all three jobs SUCCESS. |
| 2026-10-01 | Office Slice C8 workflow policy/runtime. | **IMPLEMENTED / PRODUCTION + ADVERSARIAL + CONCURRENCY + REAL-DOM + SECURITY VERIFIED** | Immutable workflow evidence, pinned policy versions, capability-gated transitions, optimistic revision checks, idempotency, private runtime tables and SECURITY INVOKER public wrappers. |
| 2026-10-01 | Owner reconfirmed autonomous GitHub + Supabase execution and free-tier-only development. | **ACTIVE OPERATING DIRECTIVE** | No repeated routine approval requests; no paid development resource. Preserve safety/cost boundaries. |
| 2026-10-01 | Live QA: commerce/tax IDs/request builder/personnel/license/floating-detail coding. | **PARTIALLY IMPLEMENTED / FOLLOW-UPS OPEN** | Kardex/tax-ID/request/profile/license/floating-code work landed. Exact Taxpayer-System print layout still waits for owner reference images. |
| 2026-09-30—2026-10-01 | Office C1–C7, ELI-1–ELI-4, Slice A/B and accounting phases 1–6. | **VERIFIED WITH DOCUMENTED BOUNDARIES** | See required evidence; do not redo completed phases without verified regression evidence. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | **IN PROGRESS — BROADER ROADMAP** | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until lifecycle/accounting/permissions/tests exist. |

## Live reconciliation — 2026-10-01 after external audit handoff
- Live main before Wave 0: `b5d97ec48efcd4e8e88c5657fbdd3f9336709f9c`; `main` is not protected and has no required status checks/rulesets.
- Manual QA workflow is currently fail-open: live/all can skip missing credentials, test execution has `continue-on-error: true`, free-form `BASE_URL` is accepted, and menu click failures are swallowed.
- Security dependency review currently uses `continue-on-error: true`; CodeQL remains mandatory.
- External audit/remediation pack is now the execution-order authority for open remediation: Wave 0 release/QA safety, then Wave 1 legacy request security blockers, before D4 consumers.
- GitHub connector can read branch/ruleset state and edit repository files, but repository-administration mutation for branch protection/rulesets/Pages source is not exposed in this environment. Any such control remains NOT VERIFIED until enforceable repository settings are actually changed and re-read.

## Implemented foundations
- Accounting phases 1–6: accepted high-assurance accounting foundation; posted history remains immutable and balanced.
- Slice A/B + ELI-1–4: modular entitlements, tenant/RBAC, seats, delegated admin, reusable roles, secure invitations and organization UX.
- Office C1–C8: registration/read evidence, referrals, archive/classification, numbering/templates, approvals/SLA, OCR provenance boundary and versioned correspondence workflow runtime.
- Requests D1/D2: independent versioned request definitions/forms/workflows, pinned versions, idempotent create/transition, immutable evidence, server authorization, server-backed UI/read model and non-destructive legacy cutover.
- Requests D3a: ordered sequential/parallel approval steps, quorum voting, per-step capability authorization and private runtime state.
- Requests D3b: visual ordered-step editor, bounded server condition predicates, skipped-step evidence and authorized runtime timeline.
- Requests D3c: step SLA/deadline/escalation evidence, explicit time-bounded delegation with provenance, and transactional approved-request outbox intents.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is enforced at the data boundary; commercial entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbering is server-atomic; private scans remain private; seat/company limits are server-enforced; delegated customer admins cannot mutate commercial license entitlements; invitation acceptance is authenticated/email-bound/seat-safe; raw invitation tokens are never persisted or audited; organization-unit parents cannot cross tenants or form cycles. Request type/workflow versions are immutable snapshots; request instances pin both versions; runtime mutation is server-authorized, idempotency/revision guarded and append-only evidence is retained. D2 legacy import is non-destructive/idempotent/traceable. D3a votes require distinct actors for parallel quorum. D3b conditions are bounded server-validated predicates and skipped results remain evidence. D3c delegation never impersonates the source actor, source capability is revalidated, SLA escalation appends evidence, and approved cross-module effects are queued transactionally rather than directly executed. Request workflow state never replaces C1 registration or C5 correspondence approval evidence.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` through `docs/PHASE_6_VERIFICATION.md` · `docs/PHASE_6_CUTOVER_MANIFEST.md` · `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/SECURITY_DEFINER_HARDENING_2026-09-30.md` · `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md` · `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md` through `docs/ELI_4_ENTERPRISE_ORGANIZATION_UX_VERIFICATION.md` · `docs/OFFICE_SLICE_C1_VERIFICATION.md` through `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md` · `docs/REQUEST_WORKFLOW_D2_CUTOVER_VERIFICATION.md` · `docs/REQUEST_WORKFLOW_D3A_VERIFICATION.md` · `docs/REQUEST_WORKFLOW_D3B_VERIFICATION.md` · `docs/REQUEST_WORKFLOW_D3C_VERIFICATION.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/` · `supabase/tests/request_d1_behavior.sql` · `supabase/tests/request_d2_legacy_behavior.sql` · `supabase/tests/request_d3a_workflow_behavior.sql` · `supabase/tests/request_d3b_condition_timeline.sql` · `supabase/tests/request_d3c_operations.sql`.

## NOT VERIFIED / external boundary
Automatic background scheduling for SLA scans; delivery/dispatch consumers for D3c outbox intents; authenticated two-real-user production browser E2E with a persistent legitimate non-owner member; automatic external invitation email delivery; owner-approved accounting cutover; real Persian OCR accuracy/provider; qualified digital signature; physical printer; live external adapters; GitHub Dependency graph/enforceable dependency review; leaked-password protection; PostgreSQL upgrade; CodeQL v4 migration; external BPM/provider integration remain outside verified scope.

## Exact next executable work
1. Wave 0: harden manual QA fail-closed behavior, credential-origin safety, menu navigation assertions, security workflow fail-open behavior, and exact-SHA release evidence.
2. Enforce branch/ruleset/Pages deployment gating when repository-administration capability is available; until then keep F-402/F-403/F-407 OPEN and explicitly NOT VERIFIED.
3. Wave 1: remediate F-409/F-410 legacy request transition authorization/bypass with adversarial disposable-DB tests before production migration.
4. Only after Waves 0–1 gates, resume D4 approver/delegate work queue and bounded outbox-consumer contracts.
5. Continue compliance/accounting roadmap only with sourced legal/tax/accounting evidence and controlled cutover safeguards.

## Live QA open items
- Exact Taxpayer-System print redesign: owner reference images were received in chat and implementation was reported complete; retain regression coverage and do not silently redesign away from the approved reference.
- Legacy request records are preserved for rollback/audit after D2; new request configuration/runtime must not be routed back through record-store writes.
- Floating-detail defaults for new records: 8-digit semantic codes currently use slot/category/sequence (Branch `11xxxxxx`, Counterparty `21xxxxxx`, Project `31xxxxxx`); historical codes are not rewritten and account-chart coding stays independent.
- Product/service deletion must continue to fail closed whenever operational references exist.
