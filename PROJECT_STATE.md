# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy` · Canonical branch: `main` · Product: **Finora 1.0**

Read `AGENTS.md` first, then this file. Latest user chat is the only source of new instructions; repo files are continuity/context. Detailed older history remains available in Git history.

## Protocol / authority
Verify live GitHub + Supabase before acting; implement/test/fix/retest/commit/verify in vertical slices; update this file with durable implementation state; archive exact production SQL; never call unrun work verified. Owner granted standing authority on 2026-09-30 for in-scope GitHub/Supabase engineering, excluding platform-required confirmations, paid/public/external actions and unsafe destructive financial-history changes. Owner explicitly directed that implementation continue autonomously without waiting for routine confirmations; progress messages/questions must not stop executable work unless the owner explicitly says stop or a real safety/tool blocker requires input.

## Current change ledger
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-30 | Continue autonomously without routine confirmation pauses. | **ACTIVE OPERATING DIRECTIVE** | Applies to reversible in-scope engineering. No claim of background execution. |
| 2026-09-30 | ELI-4 enterprise organization UX: typed hierarchy, consolidated capacity dashboard and organization-admin hardening. | **IMPLEMENTED / PRODUCTION + REAL-DOM + SECURITY VERIFIED; PERSISTENT TWO-USER PROD E2E NOT VERIFIED** | Production migration `20260930053652_enterprise_organization_ux`; unit kinds `region/branch/department/unit/subunit`, same-tenant parent/cycle guard, unit audit, owner/core-admin capacity summary, typed tree UI and company/user/module dashboard. Shell admin button now requires owner or `core/configure`, not arbitrary module configure. Transactional rollback verification PASS for ordinary-user denial, delegated core admin, cross-tenant parent rejection, cycle rejection, invalid kind rejection, capacity summary and unit audit. Product head before evidence commit `e88fab7470bb0697652d347d23ca48332a94c6e4`: Quality `36674128792` PASS including all accounting/Golden/ELI + Real-DOM; Security `36674128874` PASS; Pages `36674128102` PASS. Evidence: `docs/ELI_4_ENTERPRISE_ORGANIZATION_UX_VERIFICATION.md`. Persistent two-real-user production browser E2E remains blocked because production has no legitimate persistent non-owner member. |
| 2026-09-30 | ELI-3 secure invitations for named users, bound to email, roles and seat capacity. | **IMPLEMENTED / PRODUCTION + REAL-DOM + SECURITY VERIFIED** | Production migrations `20260930051849_enterprise_invitations`, `20260930052909_eli3_fk_index_hardening`; hash-only token lifecycle, atomic seat-safe acceptance, role assignment, revoke/expire, audit redaction and UI verified. Evidence: `docs/ELI_3_INVITATIONS_VERIFICATION.md`. External automatic email delivery remains NOT VERIFIED. |
| 2026-09-30 | ELI-2 reusable tenant roles; direct member grants remain explicit overrides. | **IMPLEMENTED / PRODUCTION + REAL-DOM + SECURITY VERIFIED** | Production migrations `20260930050542_enterprise_reusable_roles`, `20260930050904_eli2_role_tenant_hardening`; role catalog/permissions/assignments, direct+role union, tenant integrity, commercial entitlement gate, audit and UI verified. Evidence: `docs/ELI_2_REUSABLE_ROLES_VERIFICATION.md`. |
| 2026-09-30 | ELI-1 named-user seats, company capacity and delegated organization admin. | **IMPLEMENTED / PRODUCTION + REAL-DOM + SECURITY VERIFIED** | Production migration `20260930045827_enterprise_license_seats_delegated_admin`; seat/company limits, delegated `core/configure`, suspend/reactivate, audit and UI verified. Evidence: `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md`. |
| 2026-09-30 | Slice B organization tenant/RBAC/shared office foundation. | **IMPLEMENTED / VERIFIED** | Tenant/RBAC verification retained. |
| 2026-09-30 | Modular organization-wide ERP + office automation/request foundation. | **SLICE A IMPLEMENTED / VERIFIED** | Product head `df82067ecb1fda9007eb11a30d0a9d7cc1b113cd` passed Quality/Security/Pages. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | **IN PROGRESS — BROADER ROADMAP** | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until lifecycle/accounting/permissions/tests exist. |

## Current production state — 2026-09-30
- Supabase project `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`, **36 migrations through `20260930053652 enterprise_organization_ux`**.
- Four organization-linked licenses with server-enforced `max_companies`, `max_users`, modules and future-safe `limits`; no license is below current active seat/company usage.
- Persistent production membership remains four active owners and zero non-owner members. All ELI adversarial multi-user tests used existing legitimate principals inside transactions and rolled back.
- ELI-2 persistent seeded state: 24 system roles across four organizations, 28 starter role-permission rows, zero persistent member-role assignments.
- ELI-3 persistent state after tests: zero invitations, zero invitation-role links, zero non-owner members and zero role assignments.
- ELI-4 persistent organization-unit count remains zero after rollback verification; no test hierarchy residue exists.
- RLS is enabled on public tenant tables. Security advisor reports intentional authenticated SECURITY DEFINER RPC warnings plus leaked-password protection disabled; negative authorization tests for ELI RPCs passed.
- Performance advisor reports only unused-index informational notices; no unindexed foreign-key findings remain.
- Production invoice history remains unchanged; controlled accounting cutover is not part of ELI work.

## Implemented foundations
- Slice A: server-enforced commercial module entitlements, module launcher, office registries/correspondence/private scans, configurable request-type foundation.
- Slice B: organizations, hierarchical units, memberships, direct per-member module capabilities, row scopes, confidentiality, organization-aware sync/license context, shared office records/referrals/audit.
- ELI-1: named-user seats, company capacity, delegated customer admin and member lifecycle.
- ELI-2: reusable roles, role permissions, multi-role assignment, direct+role effective authorization and role audit.
- ELI-3: secure hash-only invitations, email binding, role-bound acceptance, atomic seat enforcement, revoke/expire lifecycle, invitation UI and URL acceptance.
- ELI-4: typed organization tree, tenant/cycle integrity, capacity dashboard and strict core-admin shell gating.
- Existing accounting Phases 1–6 and Iran enterprise foundation remain accepted; ELI work must not rewrite posted accounting history.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is enforced at the data boundary; commercial entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbering is server-atomic; private scans remain private; seat/company limits are server-enforced; delegated customer admins cannot mutate commercial license entitlements; invitation acceptance is authenticated, email-bound and seat-safe; raw invitation tokens are never persisted or audited; organization-unit parents cannot cross tenants or form cycles.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/PHASE_6_CUTOVER_MANIFEST.md` · `docs/PRODUCTION_ACCOUNTING_CUTOVER_READINESS_2026-09-30.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/SECURITY_DEFINER_HARDENING_2026-09-30.md` · `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md` · `docs/superpowers/specs/2026-09-30-enterprise-licensing-organization-identity-design.md` · `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md` · `docs/ELI_2_REUSABLE_ROLES_VERIFICATION.md` · `docs/ELI_3_INVITATIONS_VERIFICATION.md` · `docs/ELI_4_ENTERPRISE_ORGANIZATION_UX_VERIFICATION.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/`.

## NOT VERIFIED / external boundary
Authenticated two-real-user production browser E2E with a persistent legitimate non-owner member; automatic external invitation email delivery; owner-approved accounting cutover; real Persian OCR; qualified digital signature; physical printer; live external adapters; GitHub Dependency graph; leaked-password protection; PostgreSQL 17.11 upgrade; CodeQL v4 migration.

## Exact next executable work
1. Resume mature Office Slice C on the finalized ELI-1/2/3/4 enterprise identity/RBAC model; preserve all accounting/Golden and ELI gates.
2. Authenticated two-real-user production browser verification remains blocked until a legitimate persistent non-owner principal is intentionally available; do not fabricate or permanently cross-add one.
3. External invitation email delivery remains an adapter boundary; do not claim it until a real provider is connected and tested.
4. Continue compliance/accounting roadmap only with sourced legal/tax/accounting evidence and owner-approved destructive cutovers.
