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
| 2026-10-01 | Owner said «ادامه بده» after C8 Task 3 verification. | **EXECUTION IN PROGRESS** | Reconciled live `main` at `398e044eb6570345bff1b34c858d0e6089ab770a`; Quality `36907314330`, Security `36907314457`, Pages `36907313039` all PASS. C8 is now closed for its bounded internal-workflow scope. Next roadmap subsystem is Slice D (requests/BPMS-lite); architectural design approval remains the next product-development gate. |
| 2026-10-01 | Office Slice C8: versioned correspondence workflow policy + runtime. | **IMPLEMENTED / PRODUCTION + ADVERSARIAL + CONCURRENCY + REAL-DOM + SECURITY VERIFIED** | Production migrations `20261001173917`, `20261001180610`, `20261001180949`; immutable workflow evidence, pinned policy versions, capability-gated transitions, optimistic revision checks, idempotent request IDs, private runtime tables, SECURITY INVOKER public wrappers, two-session race test and safe runtime UI. Final main `398e044`; Quality/DB/DOM, CodeQL and Pages PASS. Evidence: `docs/OFFICE_SLICE_C8_WORKFLOW_RUNTIME_VERIFICATION.md` and `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md`. |
| 2026-10-01 | Owner reconfirmed autonomous GitHub + Supabase execution and five-specialist operating model. | **ACTIVE OPERATING DIRECTIVE** | No repeated routine approval requests. Preserve the safety/cost boundaries above. |
| 2026-10-01 | Free-tier-only development/verification. | **ACTIVE OPERATING DIRECTIVE** | No paid Supabase branch or other billable development resource. |
| 2026-10-01 | Live QA: commerce/tax IDs/request builder/personnel/license/floating-detail coding. | **PARTIALLY IMPLEMENTED / FOLLOW-UPS OPEN** | Kardex/tax-ID/request-draft/profile/license/floating-code work landed before C8. Exact Taxpayer-System print layout still waits for owner reference images. Server-side `requestTypes` configure-only enforcement remains open; UI/nav restriction alone is not a security boundary. |
| 2026-09-30—2026-10-01 | Office C1–C7, ELI-1–ELI-4, Slice A/B and accounting phases 1–6. | **VERIFIED WITH DOCUMENTED BOUNDARIES** | See required evidence below; do not redo completed phases without verified regression evidence. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | **IN PROGRESS — BROADER ROADMAP** | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until lifecycle/accounting/permissions/tests exist. |

## Live reconciliation — 2026-10-01 after C8 closure
- `main`: `398e044eb6570345bff1b34c858d0e6089ab770a` (`C8 workflow runtime UI integration`).
- Quality run `36907314330`: PASS. Static/accounting/Golden/ELI/C1-C8 gates passed; disposable C8 PostgreSQL policy/runtime/security/concurrency job passed; real-DOM suite passed including C8 runtime UI.
- Security run `36907314457`: CodeQL JavaScript PASS; dependency review was skipped because the repository dependency-graph boundary remains unresolved.
- Pages run `36907313039`: PASS.
- Supabase project `hcsixhqbyuhpshfwqpjx`: live migrations now include C8 `20261001173917 office_slice_c8_workflow_policy`, `20261001180610 office_slice_c8_workflow_runtime`, `20261001180949 office_c8_policy_publisher_fk_index`.
- Post-C8 persistent workflow residue: zero workflow instances, zero workflow events and zero workflow policy versions in the checked production state.
- Supabase performance advisor: unused-index informational notices only; no unindexed-FK finding at the C8 closure check.
- Supabase security advisor: three private C8 tables have RLS enabled with no policies because direct client table access is revoked and access is mediated by checked RPCs; 20 pre-existing authenticated-callable public SECURITY DEFINER warnings remain; leaked-password protection remains disabled. These warnings are not silently treated as resolved.

## Implemented foundations
- Accounting phases 1–6: accepted high-assurance accounting foundation; posted history remains immutable and balanced.
- Slice A: server-enforced commercial module entitlements, module launcher, office registries/correspondence/private scans, configurable request-type foundation.
- Slice B: organizations, hierarchical units, memberships, direct/member-role capabilities, row scopes, confidentiality and shared office records.
- ELI-1–4: named-user/company capacity, delegated organization admin, reusable roles, secure invitations, typed organization tree and capacity UX.
- Office C1: immutable registered correspondence/read evidence.
- Office C2: actionable referrals, target authorization, immutable actions and SLA work queue.
- Office C3: related-letter graph and structured archive classification/search.
- Office C4: tenant-safe registration repair and versioned correspondence templates.
- Office C5: content-bound internal approval/attestation lifecycle.
- Office C6: server-derived SLA reminder/escalation evidence.
- Office C7: tenant-safe full-text archive search with append-only OCR provenance/correction evidence; no real OCR-engine claim.
- Office C8: versioned workflow policies, immutable runtime transition history, idempotent/concurrency-safe server operations and safe correspondence workflow UI. C8 is internal workflow only, not external BPM/provider integration.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is enforced at the data boundary; commercial entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbering is server-atomic; private scans remain private; seat/company limits are server-enforced; delegated customer admins cannot mutate commercial license entitlements; invitation acceptance is authenticated/email-bound/seat-safe; raw invitation tokens are never persisted or audited; organization-unit parents cannot cross tenants or form cycles; referral targets must already be authorized to read the source correspondence; only the bound target may acknowledge/complete a referral; referral/audit evidence can only be inserted by authorized server operations; OCR provenance must reference a real attachment belonging to the same organization/correspondence; C8 workflow policy is pinned per instance, workflow evidence is append-only, transitions require server-authorized capability and expected revision, and workflow stage never replaces C1 registration status or C5 approval evidence.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/PHASE_6_CUTOVER_MANIFEST.md` · `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/SECURITY_DEFINER_HARDENING_2026-09-30.md` · `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md` · `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md` · `docs/ELI_2_REUSABLE_ROLES_VERIFICATION.md` · `docs/ELI_3_INVITATIONS_VERIFICATION.md` · `docs/ELI_4_ENTERPRISE_ORGANIZATION_UX_VERIFICATION.md` · `docs/OFFICE_SLICE_C1_VERIFICATION.md` through `docs/OFFICE_SLICE_C7_VERIFICATION.md` · `docs/OFFICE_SLICE_C8_WORKFLOW_RUNTIME_VERIFICATION.md` · `docs/OFFICE_SLICE_C8_RUNTIME_UI_VERIFICATION.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/`.

## NOT VERIFIED / external boundary
Authenticated two-real-user production browser E2E with a persistent legitimate non-owner member; automatic external invitation email delivery; owner-approved accounting cutover; real Persian OCR accuracy/provider; qualified digital signature; physical printer; live external adapters; GitHub Dependency graph/enforceable dependency review; leaked-password protection; PostgreSQL 17.11 upgrade; CodeQL v4 migration; external BPM/provider integration.

## Exact next executable work
1. Close documentation drift from C8: keep the gap register and continuity evidence aligned with C8 being complete for its bounded internal scope.
2. Next product subsystem is **Slice D — requests/BPMS-lite** from `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md`: versioned request schemas/forms, visual step definitions, conditions, sequential/parallel approvals, SLA/escalation, delegation/substitution, immutable action history and cross-module actions. This is architectural work; explore the existing request foundation first and produce the design/spec/plan before implementation.
3. Do not duplicate C8 correspondence workflow inside Slice D. Reuse its proven patterns (version pinning, immutable evidence, idempotency, optimistic concurrency, capability checks) while keeping request workflow state separate from correspondence state.
4. Keep qualified digital signature, external delivery/BPM adapters and real OCR provider outside verified scope until real providers are connected and tested.
5. Two-real-user production browser verification remains blocked until a legitimate persistent non-owner principal exists; do not fabricate one.
6. Continue compliance/accounting roadmap only with sourced legal/tax/accounting evidence and controlled cutover safeguards.

## Live QA open items
- Exact Taxpayer-System print redesign: waiting for the two owner reference images; do not guess the official visual form.
- `requestTypes` configure-only writes: UI/nav restriction exists, but server-side enforcement remains open and must be designed into Slice D authorization rather than treated as already secure.
- Floating-detail defaults for new records: 8-digit semantic codes currently use slot/category/sequence (Branch `11xxxxxx`, Counterparty `21xxxxxx`, Project `31xxxxxx`); historical codes are not rewritten and account-chart coding stays independent.
- Product/service deletion must continue to fail closed whenever operational references exist.
