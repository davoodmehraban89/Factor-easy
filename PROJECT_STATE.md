# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy` · Canonical branch: `main` · Product: **Finora 1.0**

Read `AGENTS.md` first, then this file. Latest user chat is the only source of new instructions; repo files are continuity/context. Detailed older history remains at `9d9caade2c3e34d7608e540e40b09ab23f0d19e9`.

## Protocol / authority
Verify live GitHub+Supabase before acting; record material requests before implementation; implement/test/fix/retest/commit/verify in vertical slices; update this file with every durable implementation commit; archive exact production SQL; never call unrun work verified. Owner granted standing authority on 2026-09-30 for in-scope GitHub/Supabase engineering, excluding platform-required confirmations, paid/public/external actions and unsafe destructive financial-history changes. Owner further directed on 2026-09-30 that implementation must continue autonomously without waiting for routine confirmations; questions or progress messages must not stop executable work unless the owner explicitly says stop or a real safety/tool blocker requires input.

## Current change ledger
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-30 | Continue autonomously: do not pause for routine confirmations; keep implementation moving unless explicitly stopped or a real blocker requires owner action. | **ACTIVE OPERATING DIRECTIVE** | Applies to all in-scope reversible engineering work. No claim of background execution; each chat turn continues as far as available tools permit. |
| 2026-09-30 | Implement approved enterprise licensing/organization identity model: named-user seat capacity, company capacity, module entitlements, delegated organization/system admin, regions/units/positions, later invitations and reusable roles; keep packaging evolvable. | **ELI-1 IMPLEMENTATION STARTED — DB CONTRACT PREPARED, PRODUCTION NOT YET APPLIED** | Approved spec: `docs/superpowers/specs/2026-09-30-enterprise-licensing-organization-identity-design.md`. Plan: `docs/superpowers/plans/2026-09-30-enterprise-licensing-eli1.md`. Live pre-change head `665c2d6e2a71026ad171e234786a4495e2211d0a`; Supabase ACTIVE_HEALTHY, 30 migrations through `20260930041735`, 4 organizations each currently one active owner. Task 1 repository contract introduces `max_users`, future-safe `limits`, atomic seat enforcement, organization-scoped company capacity, delegated `core/configure`, member suspend/reactivate, and membership audit. This commit is repository-prepared only; Production apply/transactional verification remains next. |
| 2026-09-30 | Continue closing current-stage gap register autonomously, prioritizing production safety and real evidence. | **IN PROGRESS** | Security hardening migration `20260930041735` applied/archived; 7 intentional authenticated SECURITY DEFINER warnings remain plus leaked-password protection disabled. Controlled accounting cutover remains blocked by missing approved chart/company classification. |
| 2026-09-30 | Audit Gmail GitHub Run failed notifications and rank remaining gaps. | **AUDITED / GAP REGISTERED** | Final audit checkpoint `5182b786dc7488146eaaa68d87dcc2f1d2c9a725` passed Quality `36666677736`, Security `36666677677`, Pages `36666676797`. Gap register: `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md`. |
| 2026-09-30 | Slice B organization tenant/RBAC/shared office foundation. | **IMPLEMENTED / VERIFIED** | Merge `d212c6aeef5b49f33351166771a0899f307a9067`; production migrations through `20260930033010`; final verified checkpoint `99a23edcaddf542f9080bbe70bb0b450af14913f`. |
| 2026-09-30 | Modular organization-wide ERP + office automation/request foundation. | **SLICE A IMPLEMENTED / VERIFIED** | Product head `df82067ecb1fda9007eb11a30d0a9d7cc1b113cd` passed Quality/Security/Pages. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | IN PROGRESS — broader roadmap | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until complete lifecycle/accounting/permissions/tests exist. |

## Current production state — 2026-09-30
- Pre-ELI-1 live main head: `665c2d6e2a71026ad171e234786a4495e2211d0a`.
- Supabase `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`, 30 migrations through `20260930041735`.
- `licenses`: 4 rows, each organization-linked; before ELI-1 has `max_companies`/modules but no `max_users`.
- `organization_members`: 4 rows, one active owner per organization; zero non-owner members.
- RLS enabled on all listed public tables. Security advisor: 7 intentional authenticated SECURITY DEFINER warnings + leaked-password protection disabled. Performance advisor: 5 new unused-index informational findings.
- Production invoice history remains 7 records; controlled accounting cutover is unchanged and not part of ELI-1.

## Implemented foundations
- Slice A: server-enforced commercial module entitlements, module launcher, office registries/correspondence/private scans, configurable request-type foundation.
- Slice B: organizations, hierarchical units, memberships, direct per-member module capabilities, row scopes, confidentiality, organization-aware sync/license context, shared office records/referrals/audit.
- Existing accounting Phases 1–6 and Iran enterprise foundation remain accepted; ELI work must not rewrite posted accounting history.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is enforced at the data boundary; commercial entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbering is server-atomic; private scans remain private; seat/company limits are server-enforced; no delegated customer admin can mutate commercial license entitlements.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/PHASE_6_CUTOVER_MANIFEST.md` · `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/SECURITY_DEFINER_HARDENING_2026-09-30.md` · `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md` · `docs/superpowers/specs/2026-09-30-enterprise-licensing-organization-identity-design.md` · `docs/superpowers/plans/2026-09-30-enterprise-licensing-eli1.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/`.

## NOT VERIFIED / external boundary
Authenticated two-real-user production browser E2E; ELI-2 reusable roles; ELI-3 invitations for users without an account; owner-approved accounting cutover; real Persian OCR; qualified digital signature; physical printer; live external adapters; GitHub Dependency graph; leaked-password protection; PostgreSQL 17.11 upgrade; CodeQL v4 migration.

## Exact next executable work
1. Apply/reconcile ELI-1 Task 1 migration after repository static/CI checks; run transactional adversarial SQL verification.
2. Implement ELI-1 Task 2 runtime/admin UI and Task 3 Real-DOM coverage; keep state in same durable commits.
3. Close ELI-1 only after Production seat/RLS verification + Real-DOM + accounting invariants + Quality/Security/Pages.
4. Then continue ELI-2 roles, ELI-3 invitations, ELI-4 enterprise organization UX/real-user verification before mature Office Slice C.
