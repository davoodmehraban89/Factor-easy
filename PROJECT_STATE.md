# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy` · Canonical branch: `main` · Product: **Finora 1.0**

Read `AGENTS.md` first, then this file. Latest user chat is the only source of new instructions; repo files are continuity/context. Detailed older history remains available in Git history and the verification documents listed below.

## Protocol / authority
Verify live GitHub + Supabase before acting; implement/test/fix/retest/commit/verify in bounded vertical slices; archive exact production SQL; never call unrun work verified. The owner has repeatedly directed autonomous roadmap execution without routine confirmation pauses and has authorized normal in-scope GitHub/Supabase work. Keep five specialist workstreams under one coordinator: Architecture & Requirements, Implementation, UX/UI, QA & Verification, Security & Release. Use real subagents only when the environment provides them; otherwise execute those responsibilities directly without claiming parallel agents.

This is high-assurance accounting/ERP software. Posted financial history, tenant isolation, migration safety, traceability, reconciliation and rollback are mandatory. Do not create billable resources; development/verification must stay on zero-cost/free-tier paths. Destructive financial-history changes, unapproved external costs, public/external messaging and sensitive access changes remain safety boundaries.

## Current change ledger
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-10-02 | Owner completed the GitHub `Protect main` ruleset and directed autonomous continuation to fully remediate the audited defects. | **IN PROGRESS — REMEDIATION CONTINUATION** | Live ruleset `24334764` verified ACTIVE on the default branch with deletion + non-fast-forward protection, PR-only updates, strict required checks `static-quality`, `Release and QA safety invariants`, and `CodeQL JavaScript`; bypass list empty. First bounded slice: reconcile/fix public Live QA findings and close remaining Wave 0 deployment gate evidence, then Wave 1 F-409/F-410. |
| 2026-10-01 | Owner authorized starting the canonical remediation pack after external full-system audit. | **WAVE 0 CODE-SIDE VERIFIED / ADMIN DEPLOY GATE OPEN** | F-406/F-423/F-424 code contracts hardened; dependency review fail-open removed; exact-SHA Quality+Security+DB promotion evidence added. F-402/F-403/F-407 remain OPEN because Pages still deploys from unprotected main before CI and repository-admin mutation is unavailable in the connected GitHub tool. |
| 2026-10-01 | Owner said «ادامه بده» after D3a handoff. | **D3B + D3C VERIFIED** | D3b visual editor/conditions/timeline and D3c SLA/delegation/outbox are production + disposable-DB + real-DOM verified. Remediation audit supersedes roadmap ordering: Wave 0 then Wave 1 before D4. |
| 2026-10-01 | Slice D3c — SLA/escalation, delegation/substitution, transactional outbox. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d3c.js`; migrations `20261001235500`, `20261002000500`, `20261002001000`; Quality run `36917772952` all three jobs SUCCESS. Evidence: `docs/REQUEST_WORKFLOW_D3C_VERIFICATION.md`. |
| 2026-10-01 | Slice D3b — visual workflow editor + conditions + timeline. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d3b.js`; migration `20261001233000`; bounded predicate DSL, skipped-step evidence and authorized timeline RPC. Quality run `36915696611` all three jobs SUCCESS. Evidence: `docs/REQUEST_WORKFLOW_D3B_VERIFICATION.md`. |
| 2026-10-01 | Slice D3a — sequential/parallel request workflow runtime. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + CI VERIFIED** | Migrations `20261001230000`, `20261001230500`; private step/vote runtime, quorum semantics, capability checks, idempotent decisions and immutable evidence. Quality run `36913565943` all three jobs SUCCESS. |
| 2026-10-01 | Slice D2 — request UI/read-model + legacy cutover. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d2.js`; migrations `20261001223500`, `20261001224500`; Quality run `36912668369` all three jobs SUCCESS. Legacy source records remain preserved and imported rows traceable. |
| 2026-10-01 | Slice D1 — requests/BPMS-lite server foundation. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + CI VERIFIED** | Migrations `20261001204500`, `20261001205500`, `20261001210500`, `20261001211500`; Quality run `36910187257` all three jobs SUCCESS. |
| 2026-10-01 | Office Slice C8 workflow policy/runtime. | **IMPLEMENTED / PRODUCTION + ADVERSARIAL + CONCURRENCY + REAL-DOM + SECURITY VERIFIED** | Immutable workflow evidence, pinned policy versions, capability-gated transitions, optimistic revision checks, idempotency, private runtime tables and SECURITY INVOKER public wrappers. |
| 2026-10-01 | Owner reconfirmed autonomous GitHub + Supabase execution and free-tier-only development. | **ACTIVE OPERATING DIRECTIVE** | No repeated routine approval requests; no paid development resource. Preserve safety/cost boundaries. |
| 2026-10-01 | Live QA: commerce/tax IDs/request builder/personnel/license/floating-detail coding. | **PARTIALLY IMPLEMENTED / FOLLOW-UPS OPEN** | Kardex/tax-ID/request/profile/license/floating-code work landed. Exact Taxpayer-System print layout owner reference is now available and has regression coverage. |
| 2026-09-30—2026-10-01 | Office C1–C7, ELI-1–ELI-4, Slice A/B and accounting phases 1–6. | **VERIFIED WITH DOCUMENTED BOUNDARIES** | See required evidence; do not redo completed phases without verified regression evidence. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | **IN PROGRESS — BROADER ROADMAP** | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until lifecycle/accounting/permissions/tests exist. |

## Wave 0 checkpoint — 2026-10-01
- Code head verified before this state update: `6b5296471073197c99a0cd13cb4bc334f61ccc5a`.
- Manual QA no longer uses `continue-on-error`; live/all require credentials; live credential-bearing runs reject non-allowlisted origins before secrets are injected into the test step; authenticated browser origin is rechecked before/after login/navigation; menu click errors are no longer swallowed and each navigated item must change observable UI state.
- QA evidence retention reduced to 3 days and screenshots changed to failure-only.
- Security dependency review no longer uses `continue-on-error`. Security now runs `scripts/release-safety-check.mjs` to prevent regression of Wave 0 code contracts.
- Exact-SHA `Release gate` workflow now requires successful Quality + Security for the same SHA and explicitly checks `static-quality`, `c8-policy-database`, and `d1-request-database` before emitting bounded promotion evidence.
- Quality run `36922018463`: SUCCESS; Real DOM, accounting/Golden, C8 DB and D1/D2/D3 DB jobs all passed.
- Security run `36922018405`: SUCCESS; CodeQL and Release/QA safety invariant job passed.
- Release gate run `36922270418`: SUCCESS for exact SHA `6b529647...`.
- Gmail check after the Wave 0 code changes found no failure notification for the new Wave 0 SHA; visible failure emails were older historical runs.
- **Enforcement blocker remains:** Pages run `36922017645` for the same SHA completed SUCCESS at `20:30:56Z`, while Quality completed at `20:31:23Z` and Security at `20:32:01Z`. Therefore F-403/F-407 are still reproduced: production deployment can finish before required gates. `main` remains unprotected and rulesets remain empty, so F-402 remains open.
- The connected GitHub tool exposes repository content/workflow edits and branch/ruleset reads but no repository-administration mutation for branch protection/rulesets/Pages source. Do not mark Wave 0 fully closed until Pages is switched to gated Actions deployment (or equivalent) and `main` has enforceable required checks, then re-run an exact-SHA negative deployment test.

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
1. **Administrative Wave 0 gate:** switch GitHub Pages away from automatic branch deployment to an exact-SHA gated deployment path and enforce required checks/ruleset on `main`; repository-admin mutation is not exposed by the current connector.
2. After the administrative gate is verifiably enforced, run a deliberate failing test SHA and prove it cannot deploy; only then close F-402/F-403/F-407 and Wave 0.
3. Wave 1: remediate F-409/F-410 legacy request transition authorization/bypass with adversarial disposable-DB tests before production migration.
4. Only after Waves 0–1 gates, resume D4 approver/delegate work queue and bounded outbox-consumer contracts.
5. Continue compliance/accounting roadmap only with sourced legal/tax/accounting evidence and controlled cutover safeguards.

## Live QA open items
- Exact Taxpayer-System print redesign: owner reference images were received in chat and implementation was reported complete; retain regression coverage and do not silently redesign away from the approved reference.
- Legacy request records are preserved for rollback/audit after D2; new request configuration/runtime must not be routed back through record-store writes.
- Floating-detail defaults for new records: 8-digit semantic codes currently use slot/category/sequence (Branch `11xxxxxx`, Counterparty `21xxxxxx`, Project `31xxxxxx`); historical codes are not rewritten and account-chart coding stays independent.
- Product/service deletion must continue to fail closed whenever operational references exist.
