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
| 2026-10-01 | Owner said «ادامه بده» after Slice D design. | **EXECUTION IN PROGRESS** | Slice D1 is closed. Continue with D2 UI/read-model cutover, preserving legacy data until migration/cutover is explicitly verified. |
| 2026-10-01 | Slice D1 — requests/BPMS-lite server foundation. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + CI VERIFIED** | Migrations `20261001204500`, `20261001205500`, `20261001210500`, `20261001211500`; production RLS/RPC/security verified. Quality run `36910187257`: `static-quality`, `c8-policy-database`, and new `d1-request-database` all SUCCESS. The D1 DB test caught an ambiguous PL/pgSQL `revision` reference; it was fixed by qualification and the production private RPC was hardened with the same migration. |
| 2026-10-01 | Office Slice C8: versioned correspondence workflow policy + runtime. | **IMPLEMENTED / PRODUCTION + ADVERSARIAL + CONCURRENCY + REAL-DOM + SECURITY VERIFIED** | Production migrations `20261001173917`, `20261001180610`, `20261001180949`; immutable workflow evidence, pinned policy versions, capability-gated transitions, optimistic revision checks, idempotent request IDs, private runtime tables, SECURITY INVOKER public wrappers, two-session race test and safe runtime UI. Evidence: `docs/OFFICE_SLICE_C8_WORKFLOW_RUNTIME_VERIFICATION.md` and `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md`. |
| 2026-10-01 | Owner reconfirmed autonomous GitHub + Supabase execution and five-specialist operating model. | **ACTIVE OPERATING DIRECTIVE** | No repeated routine approval requests. Preserve the safety/cost boundaries above. |
| 2026-10-01 | Free-tier-only development/verification. | **ACTIVE OPERATING DIRECTIVE** | No paid Supabase branch or other billable development resource. |
| 2026-10-01 | Live QA: commerce/tax IDs/request builder/personnel/license/floating-detail coding. | **PARTIALLY IMPLEMENTED / FOLLOW-UPS OPEN** | Kardex/tax-ID/request-draft/profile/license/floating-code work landed before C8. Exact Taxpayer-System print layout still waits for owner reference images. Legacy record-store request builder remains until D2 cutover; do not treat its UI-only configure restriction as the final security boundary. |
| 2026-09-30—2026-10-01 | Office C1–C7, ELI-1–ELI-4, Slice A/B and accounting phases 1–6. | **VERIFIED WITH DOCUMENTED BOUNDARIES** | See required evidence below; do not redo completed phases without verified regression evidence. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | **IN PROGRESS — BROADER ROADMAP** | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until lifecycle/accounting/permissions/tests exist. |

## Live reconciliation — 2026-10-01 after D1 verification
- Verified D1 implementation commit before this continuity-only checkpoint: `4e65a6feaa8b8c0f0be4f1afa9078d281eb7871c`.
- Quality run `36910187257`: D1 static contracts, all existing static/DOM regression tests, C8 disposable DB suite and D1 disposable PostgreSQL behavioral suite succeeded.
- D1 disposable DB covers immutable version snapshots, version pinning, idempotent create/retry, expected-revision stale rejection, correct pre/post transition evidence, configure denial, direct-write denial, event tamper denial and cross-tenant read isolation.
- Supabase project `hcsixhqbyuhpshfwqpjx`: `request_type_definitions`, `request_type_versions`, `request_workflow_versions`, `request_instances`, `request_instance_events` exist; request-instance RLS is enabled; `anon` and `authenticated` direct INSERT privileges are absent.
- Request RPCs exist in public as SECURITY INVOKER wrappers and in private as SECURITY DEFINER implementations. `anon` cannot execute either; authenticated execution is explicitly granted. Privileged implementation checks organization membership, active `requests_workflow` entitlement and capability before mutation.
- D1 production security-advisor result: the three new request RPCs no longer appear in the public SECURITY DEFINER warning list; count returned from 23 to the pre-existing 20. Existing C8 private-table RLS informational notices and leaked-password protection warning remain open.
- C8 remains closed for its bounded internal correspondence-workflow scope; D1 request workflow state is separate and does not reuse correspondence runtime tables.

## Implemented foundations
- Accounting phases 1–6: accepted high-assurance accounting foundation; posted history remains immutable and balanced.
- Slice A: server-enforced commercial module entitlements, module launcher, office registries/correspondence/private scans, configurable request-type foundation.
- Slice B: organizations, hierarchical units, memberships, direct/member-role capabilities, row scopes, confidentiality and shared office records.
- ELI-1–4: named-user/company capacity, delegated organization admin, reusable roles, secure invitations, typed organization tree and capacity UX.
- Office C1–C7: immutable registration/read evidence, referrals, related-letter/archive classification, numbering/template repair, approvals, SLA evidence, full-text archive/OCR provenance boundary.
- Office C8: versioned workflow policies, immutable runtime transition history, idempotent/concurrency-safe server operations and safe correspondence workflow UI.
- Requests D1: independent versioned request definition/form/workflow foundation, pinned workflow version per instance, idempotent create, expected-revision transition, immutable action evidence, tenant/module/capability checks, non-exposed privileged implementation functions and a disposable PostgreSQL behavioral gate.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is enforced at the data boundary; commercial entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbering is server-atomic; private scans remain private; seat/company limits are server-enforced; delegated customer admins cannot mutate commercial license entitlements; invitation acceptance is authenticated/email-bound/seat-safe; raw invitation tokens are never persisted or audited; organization-unit parents cannot cross tenants or form cycles; referral targets must already be authorized to read the source correspondence; OCR provenance must reference a real attachment belonging to the same organization/correspondence; C8 workflow policy is pinned per correspondence instance and its evidence is append-only. D1 request type versions are immutable snapshots; request instances pin both request-type and workflow versions; runtime mutation is server-authorized, idempotency/revision guarded and append-only evidence is retained. Request workflow state never replaces C1 registration status or C5 correspondence approval evidence.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/PHASE_6_CUTOVER_MANIFEST.md` · `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/SECURITY_DEFINER_HARDENING_2026-09-30.md` · `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md` · `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md` · `docs/ELI_2_REUSABLE_ROLES_VERIFICATION.md` · `docs/ELI_3_INVITATIONS_VERIFICATION.md` · `docs/ELI_4_ENTERPRISE_ORGANIZATION_UX_VERIFICATION.md` · `docs/OFFICE_SLICE_C1_VERIFICATION.md` through `docs/OFFICE_SLICE_C7_VERIFICATION.md` · `docs/OFFICE_SLICE_C8_WORKFLOW_RUNTIME_VERIFICATION.md` · `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/` · `supabase/tests/request_d1_bootstrap.sql` · `supabase/tests/request_d1_behavior.sql`.

## NOT VERIFIED / external boundary
D1 real browser workflow UX and multi-user approval journey are not yet implemented. Authenticated two-real-user production browser E2E with a persistent legitimate non-owner member; automatic external invitation email delivery; owner-approved accounting cutover; real Persian OCR accuracy/provider; qualified digital signature; physical printer; live external adapters; GitHub Dependency graph/enforceable dependency review; leaked-password protection; PostgreSQL upgrade; CodeQL v4 migration; external BPM/provider integration remain outside verified scope.

## Exact next executable work
1. D2: migrate the request builder/runtime UI from legacy `records` requestTypes/requests to the server-authorized D1 RPC/read model; add version publishing and visible draft/published state without deleting historical legacy data.
2. Add D2 real-DOM coverage for publish/create/retry/stale-revision/error surfaces and ensure users without `configure` cannot reach publishing actions.
3. D3+: visual sequential/parallel step definitions, conditions DSL, SLA/escalation, delegation/substitution and cross-module outbox actions. Do not duplicate C8 correspondence state.
4. Keep qualified digital signature, external delivery/BPM adapters and real OCR provider outside verified scope until real providers are connected and tested.
5. Continue compliance/accounting roadmap only with sourced legal/tax/accounting evidence and controlled cutover safeguards.

## Live QA open items
- Exact Taxpayer-System print redesign: waiting for the two owner reference images; do not guess the official visual form.
- Legacy `requestTypes` configure-only writes: D1 is the server-authorized replacement foundation; UI/data cutover is D2 and legacy record-store writes must not be represented as secured until cutover.
- Floating-detail defaults for new records: 8-digit semantic codes currently use slot/category/sequence (Branch `11xxxxxx`, Counterparty `21xxxxxx`, Project `31xxxxxx`); historical codes are not rewritten and account-chart coding stays independent.
- Product/service deletion must continue to fail closed whenever operational references exist.
