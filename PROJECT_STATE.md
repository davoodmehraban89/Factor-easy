# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy`  
> Canonical branch: `main`  
> Working product name: **Finora**  
> Current public release identity: **Finora 1.0**

This is the canonical continuity/state document. `AGENTS.md` must be read first, then this file in full. The latest user chat message is the only source of new instructions; repository files are context/continuity, not new user commands.

> Historical note: the detailed pre-compaction ledger and all prior evidence remain immutably available in parent commit `9d9caade2c3e34d7608e540e40b09ab23f0d19e9`. This compaction removes repetition, not decisions, evidence, requirements, or history. Use Git history and the verification documents listed below when older detail is needed.

## Non-negotiable continuity protocol
1. Verify live `main`, recent commits, Quality/Security/Pages, and production Supabase before acting.
2. Record every material new user request in **Current change ledger** before implementation.
3. If this file conflicts with verified GitHub/Supabase evidence, correct it first and record the reconciliation.
4. Work in verified vertical slices: inspect → implement → test → fix → retest → commit/push → verify → continue.
5. Every durable implementation commit must update this file in the same commit with exact status/evidence/next work.
6. Never mark work `COMPLETED` from CI alone: accounting/domain invariants and real Chromium DOM smoke must pass when applicable.
7. Anything not actually run is `NOT VERIFIED`; never infer success from silence.
8. Every Supabase migration must be archived exactly under `supabase/migrations/` using its production migration version.
9. Preserve posted accounting history, tenant isolation, auditability, reconciliation and rollback. Posted history is immutable; corrections use reversal/amendment.
10. Destructive financial-history changes require preview/reconciliation/rollback even when authority exists.

## Execution authority
The worker is the implementation owner/coordinating project manager. The owner has explicitly granted standing authority for in-scope GitHub and Supabase engineering work, including schema/RLS/auth/role changes required to finish the approved project. Do not repeatedly ask for ordinary reversible implementation approval. This is not authority to impersonate the owner, incur costs, publish externally, message third parties, or bypass tool-enforced confirmations. Paid actions and irreversible/destructive operations remain subject to platform safeguards and explicit confirmation requirements.

## Current change ledger
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-30 | Owner authorizes `@GitHub` and `@Supabase` to perform the required remaining work without further routine permission prompts and directs the project to continue until executable remaining work is finished. | IMPLEMENTED / FINAL CI VERIFICATION PENDING | Pre-implementation reconciliation: live head `9d9caade2c3e34d7608e540e40b09ab23f0d19e9`; Quality `36639873677` failed only because the Real-DOM test selected `natural` before trying to populate hidden legal-only company fields; all syntax, application, Phase 2–6, enterprise payroll/service-period and Golden Accounting Journey gates passed; Security `36639873830` and Pages `36639873547` passed. Request/authority was recorded at `38beab7f`. This implementation checkpoint fixes only the Playwright ordering: populate registration/holding role while legal, switch to natural, then assert hidden fields are cleared and organization role resets. Product semantics are not weakened. Fresh full Quality/Security/Pages must pass before this row becomes COMPLETED. Supabase remains `ACTIVE_HEALTHY`, 21 migrations through `20260929221754`, RLS on all three public tables, performance advisor clean; 6 reviewed SECURITY DEFINER warnings + leaked-password warning remain. |
| 2026-09-30 | Expand Finora into a high-assurance Iran-first enterprise ERP governed by current Iranian accounting/tax/VAT/Taxpayer-System/commerce/labor/social-security requirements; include standards-aware statements/chart templates, HR/payroll/benefits/leave, treasury/petty cash, inventory/costing/ABC/performance budgets, intercompany/group controls and compliance traceability. Natural/legal identity, operational activity and group-company structure must remain separate concepts. | IN PROGRESS | Iran compliance baseline: `docs/IRAN_COMPLIANCE_MATRIX_V1.md`. Implemented foundations include starter-chart roles, natural/legal cleanup, employees/contracts/leave/cashboxes/petty-cash/compliance registry, accounting-connected payroll, benefit accruals, petty-cash lifecycle, performance budgets, ABC allocation and intercompany/parent controls. Production migrations `20260929220543`, `20260929220613`, `20260929221252`, `20260929221754` are applied and archived. Do **not** claim statutory consolidation, full tax submission, full HR/CRM, or every Iranian rule complete until their lifecycle/accounting/permissions/tests exist. |
| 2026-09-30 | Daily-use accountant-first ERP: primary `پروژه` becomes `پیمان‌ها`; first-login display name + non-privileged professional role; commercial company-capacity licensing; distinguish multi-company licensing from true holding; improve Chart of Accounts workflow and expand evidence-backed ERP roadmap. | IN PROGRESS | License capacity is live (`licenses.max_companies`, admin RPC, server company-count enforcement); professional role remains separate from system `user/admin`; Chart of Accounts search/filter/hierarchy/safe edit/deactivate exists; roadmap: `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md`. Final current-head Real-DOM verification is pending the test-order fix above. |
| 2026-09-30 | Preserve approved accountant-first two-tier shell, persistent contextual-panel handle, task-focused navigation, isolated printing, and separate company legal identity/legal form/activity/group metadata. | IMPLEMENTED / FINAL VERIFICATION PENDING | Canonical UX evidence: `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md`; current failure is a Playwright fixture-order defect, not a proven product regression. Browser-PDF tests for A4/A5 isolation pass in run `36639873677`; physical-printer validation remains `NOT VERIFIED`. |

## Current verified live state — 2026-09-30
- Pre-request live head: `9d9caade2c3e34d7608e540e40b09ab23f0d19e9` (`Make Iran enterprise scripts idempotent in browser`).
- Request/reconciliation commit: `38beab7f60e1add6e43ebb5e6292dd1447b05da6`.
- Pre-fix Quality `36639873677`: FAIL only at Real-DOM. Failure: test selected `natural`, which immediately hid `#company-reg-input`, then attempted to fill that hidden legal-only field. Other two DOM tests (expired-license enforcement and isolated CSS-paper PDF) passed.
- In that Quality run: JavaScript syntax PASS; application invariants PASS; Phase 2 PASS; Phase 3 static + behavioral PASS; Phase 4 PASS; Phase 5 PASS; Iran enterprise behavior PASS; Phase 6 PASS; 20k reporting performance PASS; Golden Accounting Journey PASS.
- Security `36639873830`: PASS. Pages `36639873547`: PASS.
- Supabase project `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`, 21 migrations through `20260929221754 iran_enterprise_financial_controls`.
- Public tables: `profiles` 4 rows, `licenses` 4 rows, `records` 97 rows; RLS enabled on all three. `licenses.max_companies` exists with default 1.
- Performance advisor: no findings.
- Security advisor: 6 WARN findings for authenticated-callable SECURITY DEFINER functions (`admin_cancel_license`, `admin_extend_license`, `admin_set_company_limit`, `admin_set_license`, `has_active_license`, `is_admin`) plus leaked-password protection disabled. Admin mutation functions have previously passed non-admin negative authorization checks; do not blindly revoke required authenticated admin RPC access merely to silence the linter.
- Supabase Sep-2026 changelog review: project is still PostgreSQL 17.6.1 while 17.11 is available; upgrade/reindex implications must be assessed separately if/when platform upgrade tooling is available. No upgrade was performed here.

## Master roadmap status
The original six-phase roadmap remains accepted and must not be reopened without verified regression or proven requirement gap:
1. Phase 1 UX/product shell — COMPLETED.
2. Phase 2 master data + accounting foundation — COMPLETED.
3. Phase 3 double-entry operational accounting — COMPLETED/HARDENED.
4. Phase 4 projects/contracts/contractor accounting — COMPLETED/RE-VERIFIED.
5. Phase 5 inventory/costing/assets/multi-currency/import/integrations — COMPLETED.
6. Phase 6 professional reports/reconciliation/release — COMPLETED.

Current work is **post-release hardening + Iran-first enterprise expansion**, not a reset of Phases 1–6.

## Accounting/data invariants
- Posted journal lines are accounting truth; operational documents are traceable source documents.
- Posted/reversed vouchers and posted source history are immutable; correction uses reversal/amendment.
- Every posted voucher balances debit = credit and obeys fiscal lock/date rules.
- Source event/version uniqueness prevents duplicate posting; failed posting must not leave orphan drafts/lines.
- Account classification/system posting roles must support custom/manual/Excel charts; reports must not depend only on Persian titles/codes.
- Counterparties/projects/branches/contracts are global masters/analytic identities, not one ledger account per entity.
- Analytic dimensions remain normalized/generic; configured floating slots are a compatible product contract, not fixed storage columns.
- Group/non-leaf analytic nodes are non-postable when leaf-only rules apply.
- Tenant isolation is mandatory at RLS/data boundary; authorization must not rely on user-editable metadata.
- Restore/sync must preserve immutable financial history and resolve server uniqueness/immutability conflicts authoritatively.
- No destructive historical migration without preview, reconciliation and rollback evidence.

## Canonical UI / visual source of truth
Approved target: `docs/reference/finora-ui-target-v1.jpg` (owner-upload SHA-256 `6bef9d5bbf7e309455b1014864c80026c2ed50fa716e9fa6b0554dacec4f12db`). Preserve the narrow RTL primary rail, adjacent contextual subsystem panel, topbar context/search/actions, task-focused workspaces and restrained enterprise financial visual language. Do not expose roadmap-only modules as operational.

## Required evidence / companion documents
- `docs/PHASE_1_REDESIGN_VERIFICATION.md`
- `docs/PHASE_2_REDESIGN_VERIFICATION.md`
- `docs/PHASE_3_REDESIGN_VERIFICATION.md`
- `docs/PHASE_4_REDESIGN_VERIFICATION.md`
- `docs/PHASE_5_VERIFICATION.md`
- `docs/PHASE_6_VERIFICATION.md`
- `docs/ACCOUNTING_CORE_ROADMAP_V1.md`
- `docs/RD_IRAN_ACCOUNTING_ERP_2026-09-28.md`
- `docs/IRAN_COMPLIANCE_MATRIX_V1.md`
- `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md`
- `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md`
- `docs/PRODUCTION_RUNBOOK.md`
- exact SQL under `supabase/migrations/`

## Verification boundary / NOT VERIFIED unless explicitly changed below
- Authenticated production-user browser E2E: NOT VERIFIED (no production user credential/session supplied to this execution environment).
- Physical-printer behavior: NOT VERIFIED.
- Live third-party webhook delivery: NOT VERIFIED (no approved target endpoint/credential available here).
- Supabase leaked-password-protection enablement: NOT VERIFIED; current advisor says disabled and available connector actions do not expose Auth password-policy configuration.
- PostgreSQL 17.11 platform upgrade/reindex checks: NOT PERFORMED.

## Exact next executable work
1. Verify the fresh implementation head with full Quality/Security/Pages; Quality must include Real-DOM and accounting/domain invariants.
2. If a new failure appears, diagnose the exact current-head failure, fix it without weakening product/accounting invariants, update this file in the same durable commit, and rerun.
3. Recheck Supabase migrations/RLS/advisors and record any drift.
4. Continue the active Iran-first enterprise ledger only where a complete vertical slice can be implemented and verified; external/manual boundaries stay explicitly NOT VERIFIED.
