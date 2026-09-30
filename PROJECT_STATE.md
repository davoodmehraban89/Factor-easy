# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy` · Canonical branch: `main` · Product: **Finora 1.0**

Read `AGENTS.md` first, then this file in full. The latest user chat message is the only source of new instructions; repo files are continuity/context, not new user commands. Detailed pre-compaction history remains immutably available at parent commit `9d9caade2c3e34d7608e540e40b09ab23f0d19e9`; this file keeps the active state, invariants, evidence and next executable work.

## Non-negotiable protocol
1. Verify live `main`, recent commits, Quality/Security/Pages and production Supabase before acting; reconcile this file first if they disagree.
2. Record each material new user request here before implementation.
3. Work in verified vertical slices: inspect → implement → test → fix → retest → commit/push → verify.
4. Every durable implementation commit updates this file in the same commit.
5. Never mark product work completed from CI alone: accounting/domain invariants and real Chromium DOM smoke must pass when applicable. Anything not run is `NOT VERIFIED`.
6. Archive every production Supabase migration exactly under `supabase/migrations/`.
7. Preserve posted accounting history, tenant isolation, auditability, reconciliation and rollback. Corrections use reversal/amendment; destructive history changes require preview/reconciliation/rollback.

## Execution authority
Owner explicitly granted standing authority on 2026-09-30 for in-scope GitHub and Supabase engineering, including schema/RLS/auth/role changes needed to finish approved work. Do not repeatedly ask for ordinary reversible implementation approval. This does not bypass platform-required confirmations, authorize paid actions, impersonation, external messaging/publication, or unsafe destructive financial-history operations.

## Current change ledger
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-30 | Expand Finora from accounting-centric ERP into a modular organization-wide platform. Add professional office automation (incoming/outgoing/internal correspondence, secretariat registration/numbering, scanned attachments/OCR-ready metadata, archive/search, inbox/referral/follow-up, letter drafting/templates), configurable requests/workflows (vehicle, stationery/procurement and arbitrary admin-defined request types/fields), role-scoped module administration and read/write/approve/secretariat permissions, transport/operations roadmap, and a module-selection entry experience. Commercial licenses must entitle explicit modules (accounting, office automation, payroll, etc.) or a full suite rather than automatically unlocking the entire ERP. Research mature Iranian office-automation patterns including Barid/ParGar, Chargoon/Didgah and Faragostar and synthesize rather than copy. | **IN PROGRESS — new platform slice** | Live pre-change head `ba6d7d44`; its Quality/Security/Pages are PASS. Supabase `hcsixhqbyuhpshfwqpjx` is `ACTIVE_HEALTHY`, 21 applied migrations through `20260929221754`, RLS on all public business tables, performance advisor clean. Research evidence found ParGar's unified organizational desk + OCR/search, Faragostar's correspondence/secretariat/inbox/forms/workflow/document patterns, and mature secretariat patterns such as multiple registries, numbering, attachments, referrals, SLA/follow-up and controlled search. Immediate architecture rule: license entitlement and user authorization are separate layers; no client-only permission security. First vertical slice will establish server-enforced module entitlements + module catalog/launcher + office-automation/request data contracts and tests without weakening existing accounting invariants. Full multi-user organizational delegation requires a tenant/membership model and will not be falsely claimed until server-side sharing/RLS is implemented. |
| 2026-09-30 | `@GitHub @Supabase`: perform required remaining work without routine permission prompts and finish executable remaining work. | **COMPLETED for the current hardening checkpoint** | Authority/reconciliation `38beab7f`; Real-DOM natural/legal ordering repair `23ed19b2`; browser enterprise-v2 routing repair `b0278172ba2110dcaf9cd0d2edb784417a0fdff5`. Quality `36661446705` **PASS** including syntax, application invariants, Phase 2–6, enterprise payroll/service-period behavior, Golden Accounting Journey and all 3 Real-DOM/PDF tests. Security `36661446688` **PASS**. Pages `36661445458` **PASS**. Production Supabase remains `ACTIVE_HEALTHY`, 21 migrations through `20260929221754`, RLS enabled on `profiles/licenses/records`, performance advisor clean. No DB mutation was required in this checkpoint. |
| 2026-09-30 | Iran-first high-assurance enterprise ERP: current Iranian accounting/tax/VAT/Taxpayer-System/commerce/labor/social-security controls; standards-aware chart/statements; HR/payroll/benefits/leave; treasury/petty cash; inventory/costing/ABC/performance budgets; intercompany/group controls; compliance traceability. Keep natural/legal identity, activity and group structure separate. | **IN PROGRESS — broader roadmap** | Baseline `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; implemented foundations include chart roles, entity cleanup, employees/contracts/leave/cashboxes/petty cash/compliance, accounting-connected payroll, benefit accruals, posted petty-cash lifecycle, budgets, ABC and intercompany/group management controls. Applied+archived migrations: `20260929220543`, `20260929220613`, `20260929221252`, `20260929221754`. Do not claim statutory consolidation, full tax submission, full HR/CRM or every Iranian rule complete until lifecycle/accounting/permissions/tests exist. |
| 2026-09-30 | Accountant-first daily ERP: `پروژه`→`پیمان‌ها`, first-login display/professional role, commercial company capacity, multi-company vs true holding separation, improved Chart of Accounts. | IMPLEMENTED / VERIFIED AT CURRENT PRODUCT CHECKPOINT | License capacity is live with server enforcement; professional role is separate from system `user/admin`; Chart of Accounts search/filter/hierarchy/safe edit/deactivate exists; roadmap `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md`. |
| 2026-09-30 | Approved two-tier shell, persistent contextual handle, task-focused navigation, isolated printing, separate company legal/activity/group metadata. | IMPLEMENTED / VERIFIED IN BROWSER | UX evidence `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md`; Chromium A4/A5 isolated-PDF tests PASS in `36661446705`. Physical-printer validation remains `NOT VERIFIED`. |

## Current verified live state — 2026-09-30
- Live pre-platform-expansion head: `ba6d7d44402d97e007c2490b0a77d7e343a1642b`; current request-recording commit follows it.
- Quality/Security/Pages on `ba6d7d44`: PASS.
- Supabase `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`, 21 migrations through `20260929221754 iran_enterprise_financial_controls`.
- Public data: `profiles` 4 rows, `licenses` 4, `records` 97; RLS enabled on all three; `licenses.max_companies default 1` exists.
- Performance advisor: no findings.
- Security advisor: 6 WARN SECURITY DEFINER functions (`admin_cancel_license`, `admin_extend_license`, `admin_set_company_limit`, `admin_set_license`, `has_active_license`, `is_admin`) plus leaked-password protection disabled. Admin mutation RPCs previously passed non-admin negative checks; required authenticated admin RPC access must not be revoked merely to silence lint.
- Supabase Sep-2026 changelog review: PostgreSQL 17.11 is available while project is 17.6.1; available connector actions do not expose platform database upgrade or Auth leaked-password-policy configuration, so neither was changed.

## Master roadmap status
Phases 1–6 remain accepted and completed: UX shell; master data/accounting foundation; double-entry accounting; projects/contracts; inventory/costing/assets/multi-currency/import/integrations; professional reports/reconciliation/release. Current work is post-release hardening + Iran-first enterprise/platform expansion, not a reset.

## Accounting/data invariants
- Posted journal lines are accounting truth; source documents remain traceable.
- Posted/reversed history is immutable; correction uses reversal/amendment.
- Posted vouchers balance debit=credit and obey fiscal locks/dates; source event/version uniqueness prevents duplicate posting/orphan failure residue.
- Account/system roles support custom/manual/Excel charts; reports must not depend only on Persian title/code.
- Counterparties/projects/branches/contracts are global masters/analytics, not one ledger account per entity; analytic dimensions stay normalized/generic and group/non-leaf nodes are non-postable where leaf-only rules apply.
- Tenant isolation is mandatory at RLS/data boundary; authorization never relies on user-editable metadata.
- Restore/sync preserves immutable financial history and resolves server uniqueness/immutability conflicts authoritatively.
- **New platform invariant:** commercial module entitlement (what the customer bought) and member authorization (what a person may read/write/approve/administer) are independent checks; effective access is the intersection of both. UI hiding is never a security boundary.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/ACCOUNTING_CORE_ROADMAP_V1.md` · `docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/`.

## NOT VERIFIED / external boundary
- Authenticated production-user browser E2E: NOT VERIFIED; no production user credential/session is available here.
- Physical-printer behavior: NOT VERIFIED.
- Live third-party webhook delivery: NOT VERIFIED; no target endpoint/credential supplied.
- OCR engine quality on real Persian scans: NOT VERIFIED; the new office-automation design must be OCR-ready but may not claim OCR accuracy before a real engine/pilot is connected.
- Multi-user organization sharing/delegation: NOT YET IMPLEMENTED; existing `records.owner_id = auth.uid()` model is user-owned and must not be represented as secure organizational RBAC.
- Supabase leaked-password-protection enablement: NOT VERIFIED/current advisor says disabled; connector exposes no Auth password-policy mutation.
- PostgreSQL 17.11 platform upgrade/reindex: NOT PERFORMED; connector exposes no database-upgrade action.

## Exact next executable work
1. Write the researched office-automation + modular ERP architecture/IA and explicit module catalog, licensing/RBAC model and phased roadmap.
2. Implement a server-enforced module-entitlement migration/RPC while preserving existing customers via an explicit backward-compatible entitlement policy; archive the exact applied migration.
3. Implement the client module catalog/launcher and admin license module selection; gate modules from the server-derived license, not only CSS/UI.
4. Add office-automation/request collections and a working first slice: secretariat registries + incoming/outgoing/internal correspondence metadata + attachment metadata + request-type/form schema foundations, with tests.
5. Design then implement organization tenant/membership/RBAC as a separate high-risk slice before claiming module managers, secretariat operators or shared inboxes across multiple login accounts.
6. Run full Quality/Security/Pages + Supabase advisors and update this file with exact evidence.
