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
| 2026-10-01 | Owner said «ادامه بده» after D1 closure. | **D2 VERIFIED; CONTINUE D3** | D2 server UI/read-model cutover, non-destructive legacy migration, real-DOM tests and FK-index hardening are verified. Continue with bounded D3 workflow semantics/design rather than expanding legacy record-store behavior. |
| 2026-10-01 | Slice D2 — request UI/read-model + legacy cutover. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + REAL-DOM + CI VERIFIED** | `js/request-workflow-d2.js`; migrations `20261001223500`, `20261001224500`; Quality run `36912668369` all three jobs SUCCESS including D2 real-DOM and disposable PostgreSQL assertions. Production reconciliation preserved 2 legacy types + 4 legacy requests and imported 2 definitions + 2 versions + 4 instances + 4 immutable import events. Evidence: `docs/REQUEST_WORKFLOW_D2_CUTOVER_VERIFICATION.md`. |
| 2026-10-01 | Slice D1 — requests/BPMS-lite server foundation. | **IMPLEMENTED / PRODUCTION + DISPOSABLE-DB + CI VERIFIED** | Migrations `20261001204500`, `20261001205500`, `20261001210500`, `20261001211500`; production RLS/RPC/security verified. Quality run `36910187257`: `static-quality`, `c8-policy-database`, and new `d1-request-database` all SUCCESS. The D1 DB test caught an ambiguous PL/pgSQL `revision` reference; it was fixed by qualification and the production private RPC was hardened with the same migration. |
| 2026-10-01 | Office Slice C8: versioned correspondence workflow policy + runtime. | **IMPLEMENTED / PRODUCTION + ADVERSARIAL + CONCURRENCY + REAL-DOM + SECURITY VERIFIED** | Production migrations `20261001173917`, `20261001180610`, `20261001180949`; immutable workflow evidence, pinned policy versions, capability-gated transitions, optimistic revision checks, idempotent request IDs, private runtime tables, SECURITY INVOKER public wrappers, two-session race test and safe correspondence workflow UI. Evidence: `docs/OFFICE_SLICE_C8_WORKFLOW_RUNTIME_VERIFICATION.md` and `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md`. |
| 2026-10-01 | Owner reconfirmed autonomous GitHub + Supabase execution and five-specialist operating model. | **ACTIVE OPERATING DIRECTIVE** | No repeated routine approval requests. Preserve the safety/cost boundaries above. |
| 2026-10-01 | Free-tier-only development/verification. | **ACTIVE OPERATING DIRECTIVE** | No paid Supabase branch or other billable development resource. |
| 2026-10-01 | Live QA: commerce/tax IDs/request builder/personnel/license/floating-detail coding. | **PARTIALLY IMPLEMENTED / FOLLOW-UPS OPEN** | Kardex/tax-ID/request/profile/license/floating-code work landed. Exact Taxpayer-System print layout still waits for owner reference images. Request builder/runtime now uses D1/D2 server model; legacy records remain preserved only for rollback/audit. |
| 2026-09-30—2026-10-01 | Office C1–C7, ELI-1–ELI-4, Slice A/B and accounting phases 1–6. | **VERIFIED WITH DOCUMENTED BOUNDARIES** | See required evidence below; do not redo completed phases without verified regression evidence. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | **IN PROGRESS — BROADER ROADMAP** | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until lifecycle/accounting/permissions/tests exist. |

## Live reconciliation — 2026-10-01 after D2 verification
- Verified D2 code/quality commit: `ef3e9c1c9e580ab273beb6372027523a9aec03ca`; Quality run `36912668369`: `static-quality`, `c8-policy-database`, and `d1-request-database` all SUCCESS. Real DOM smoke includes D2 publish/create/retry/stale-revision/configure-denial coverage.
- Production Supabase project `hcsixhqbyuhpshfwqpjx`: legacy source records remain intact (2 requestTypes, 4 requests); D1/D2 contains 2 migrated definitions, 2 immutable type versions, 4 migrated instances and 4 `legacy_import` events. No destructive legacy cleanup was performed.
- Production request RPCs remain public SECURITY INVOKER wrappers with private privileged implementations. D2 UI uses those RPCs for publish/create and uses D1 tables as its read model.
- Production security advisor after D2: no new request-workflow security warning; pre-existing 20 public SECURITY DEFINER warnings, C8 private RLS informational notices and leaked-password protection warning remain open.
- Production performance advisor initially identified 8 uncovered request-workflow foreign keys; `20261001224500_request_workflow_d2_fk_indexes.sql` was applied and a fresh advisor run eliminated the unindexed-FK findings. Newly created indexes appear only as expected unused-index informational findings on the low-traffic dataset.
- C8 correspondence workflow remains separate from Requests; request workflow state does not replace C1 registration or C5 approval evidence.

## Implemented foundations
- Accounting phases 1–6: accepted high-assurance accounting foundation; posted history remains immutable and balanced.
- Slice A: server-enforced commercial module entitlements, module launcher, office registries/correspondence/private scans, configurable request-type foundation.
- Slice B: organizations, hierarchical units, memberships, direct/member-role capabilities, row scopes, confidentiality and shared office records.
- ELI-1–4: named-user/company capacity, delegated organization admin, reusable roles, secure invitations, typed organization tree and capacity UX.
- Office C1–C7: immutable registration/read evidence, referrals, related-letter/archive classification, numbering/template repair, approvals, SLA evidence, full-text archive/OCR provenance boundary.
- Office C8: versioned workflow policies, immutable runtime transition history, idempotent/concurrency-safe server operations and safe correspondence workflow UI.
- Requests D1: independent versioned request definition/form/workflow foundation, pinned workflow version per instance, idempotent create, expected-revision transition, immutable action evidence, tenant/module/capability checks, non-exposed privileged implementation functions and a disposable PostgreSQL behavioral gate.
- Requests D2: server-backed request builder/runtime UI, immutable version publishing, retry-safe create, stale-revision recovery, capability-gated configure UI, non-destructive legacy import and traceability.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is enforced at the data boundary; commercial entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbering is server-atomic; private scans remain private; seat/company limits are server-enforced; delegated customer admins cannot mutate commercial license entitlements; invitation acceptance is authenticated/email-bound/seat-safe; raw invitation tokens are never persisted or audited; organization-unit parents cannot cross tenants or form cycles; referral targets must already be authorized to read the source correspondence; OCR provenance must reference a real attachment belonging to the same organization/correspondence; C8 workflow policy is pinned per correspondence instance and its evidence is append-only. D1 request type versions are immutable snapshots; request instances pin both request-type and workflow versions; runtime mutation is server-authorized, idempotency/revision guarded and append-only evidence is retained. D2 legacy import is non-destructive/idempotent/traceable. Request workflow state never replaces C1 registration status or C5 correspondence approval evidence.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/PHASE_6_CUTOVER_MANIFEST.md` · `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/SECURITY_DEFINER_HARDENING_2026-09-30.md` · `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md` · `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md` · `docs/ELI_2_REUSABLE_ROLES_VERIFICATION.md` · `docs/ELI_3_INVITATIONS_VERIFICATION.md` · `docs/ELI_4_ENTERPRISE_ORGANIZATION_UX_VERIFICATION.md` · `docs/OFFICE_SLICE_C1_VERIFICATION.md` through `docs/OFFICE_SLICE_C7_VERIFICATION.md` · `docs/OFFICE_SLICE_C8_WORKFLOW_RUNTIME_VERIFICATION.md` · `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md` · `docs/REQUEST_WORKFLOW_D2_CUTOVER_VERIFICATION.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/` · `supabase/tests/request_d1_bootstrap.sql` · `supabase/tests/request_d1_behavior.sql` · `supabase/tests/request_d2_legacy_seed.sql` · `supabase/tests/request_d2_legacy_behavior.sql`.

## NOT VERIFIED / external boundary
D3 visual/parallel workflow semantics and multi-user approval journey are not yet implemented. Authenticated two-real-user production browser E2E with a persistent legitimate non-owner member; automatic external invitation email delivery; owner-approved accounting cutover; real Persian OCR accuracy/provider; qualified digital signature; physical printer; live external adapters; GitHub Dependency graph/enforceable dependency review; leaked-password protection; PostgreSQL upgrade; CodeQL v4 migration; external BPM/provider integration remain outside verified scope.

## Exact next executable work
1. D3a: define and validate versioned sequential/parallel request workflow step semantics and server-side transition authorization without duplicating C8 correspondence state.
2. D3b: add visual workflow editor/read-only runtime timeline plus condition DSL with safe validation/evaluation boundaries.
3. D3c: add SLA/escalation evidence, delegation/substitution and transactional cross-module outbox actions.
4. Keep qualified digital signature, external delivery/BPM adapters and real OCR provider outside verified scope until real providers are connected and tested.
5. Continue compliance/accounting roadmap only with sourced legal/tax/accounting evidence and controlled cutover safeguards.

## Live QA open items
- Exact Taxpayer-System print redesign: waiting for the two owner reference images; do not guess the official visual form.
- Legacy request records are preserved for rollback/audit after D2; new request configuration/runtime must not be routed back through record-store writes.
- Floating-detail defaults for new records: 8-digit semantic codes currently use slot/category/sequence (Branch `11xxxxxx`, Counterparty `21xxxxxx`, Project `31xxxxxx`); historical codes are not rewritten and account-chart coding stays independent.
- Product/service deletion must continue to fail closed whenever operational references exist.
