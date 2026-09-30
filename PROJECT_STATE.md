# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy` · Canonical branch: `main` · Product: **Finora 1.0**

Read `AGENTS.md` first, then this file in full. The latest user chat message is the only source of new instructions; repo files are continuity/context, not new user commands. Detailed pre-compaction history remains at `9d9caade2c3e34d7608e540e40b09ab23f0d19e9`.

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
| 2026-09-30 | Expand Finora into a modular organization-wide ERP: professional office automation, scanned correspondence/attachments, secretariat numbering, configurable requests/forms, module managers and granular read/write/approve/secretariat permissions, modular entry experience, module-by-module commercial licensing/full suite, and future transport/operations modules. Research mature Iranian patterns including Barid/ParGar, Chargoon/Didgah and Faragostar. | **SLICE A IMPLEMENTED / CI VERIFICATION IN PROGRESS** | Request `0b622439`; implementation `d3934690`. Architecture `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md`. Production migrations `20260930025546`, `20260930025647`, plus hardening `20260930030314 preserve_readonly_access_after_license_expiry`. The hardening preserves the established expired-license behavior: entitled historical data remains readable while `has_active_license()` continues to gate writes. Production introspection: all 4 existing licenses grandfathered to `full_suite`; 4/4 records policies include module guards; private office bucket and unique correspondence number index exist. Negative DB checks: non-admin module-license RPC denied; unlicensed office write denied. Transactional positive check advanced registry counter 7→8 then rolled back. Quality run `36662546643` has already passed syntax, all accounting/Phase 2–6/Golden gates and the new platform-office invariant gate; Chromium Real-DOM is still running at this state snapshot. Full multi-login organization sharing/module-manager RBAC remains Slice B and is not claimed. |
| 2026-09-30 | `@GitHub @Supabase`: perform required remaining work without routine permission prompts. | COMPLETED for prior hardening checkpoint | Prior Quality `36661446705`, Security `36661446688`, Pages `36661445458` PASS. |
| 2026-09-30 | Iran-first high-assurance enterprise ERP with accounting/tax/VAT/commerce/labor/social-security controls and enterprise modules. | IN PROGRESS — broader roadmap | Baseline `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until complete lifecycle/accounting/permissions/tests exist. |

## Current production state — 2026-09-30
- Code implementation head before this hardening archive commit: `d3934690eab066ee61fb65de5226777277818752`.
- Supabase `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`.
- Applied migrations: 24 through `20260930030314 preserve_readonly_access_after_license_expiry`; all current platform migrations are archived in Git after this commit.
- `licenses.modules` supports explicit modules or `full_suite`; `admin_set_license_modules` validates keys and rechecks admin server-side.
- Record SELECT is owner + purchased-module scoped even after license expiry; INSERT/UPDATE/DELETE and atomic sync additionally require active license.
- Office collections: `officeRegistries`, `correspondence`, `correspondenceAttachments`, `correspondenceReferrals`, `correspondenceAudit`; request collections: `requestTypes`, `requests`, `requestActions`.
- Private `office-attachments`: max 20 MB/object, PDF/JPEG/PNG/TIFF, owner + office-module RLS.
- Secretariat registration RPC uses row lock + unique owner/registry/register-number index.
- Performance advisor after migrations: clean.
- Security advisor after migrations: 7 public authenticated-callable SECURITY DEFINER warnings (the prior six plus `admin_set_license_modules`) + leaked-password protection disabled. The new admin RPC was negative-tested as a non-admin and correctly returned 42501. Do not remove authenticated RPC access merely to silence lint; the client requires the RPC and it has an internal admin authorization check.

## Master roadmap status
Phases 1–6 remain accepted/completed: UX shell; accounting foundation; double-entry accounting; projects/contracts; inventory/costing/assets/multi-currency/import/integrations; reports/reconciliation/release. Current work is post-release hardening + Iran-first enterprise/platform expansion, not a reset.

## Platform / accounting invariants
- Posted journal lines are accounting truth; posted/reversed history is immutable; correction uses reversal/amendment.
- Posted vouchers balance and obey fiscal locks; source event/version uniqueness prevents duplicate posting.
- Tenant isolation is mandatory at the data boundary; authorization never relies on user-editable metadata.
- Commercial module entitlement and member authorization are independent. Effective access is their intersection plus tenant/record scope. UI hiding is never a security boundary.
- Expired/cancelled license keeps entitled historical records readable but cannot write; module removal hides/denies that module's records.
- Office registration numbers are allocated server-side atomically; binary scans live in private Storage, not JSON records.
- Do not expose/sell roadmap-only modules as operational.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/PRODUCTION_RUNBOOK.md` · exact SQL under `supabase/migrations/`.

## NOT VERIFIED / external boundary
- Multi-login organization membership/module-manager RBAC/shared inbox/referral: NOT YET IMPLEMENTED; Slice B must migrate this securely.
- OCR engine accuracy on real Persian scans: NOT VERIFIED; only OCR-ready metadata exists.
- Authenticated production-user browser E2E: NOT VERIFIED; no production user credential/session supplied here.
- Physical-printer behavior: NOT VERIFIED.
- Live third-party webhook/ECE/email gateway delivery: NOT VERIFIED.
- Supabase leaked-password-protection enablement: connector exposes no Auth password-policy mutation.
- PostgreSQL 17.11 upgrade/reindex: NOT PERFORMED; connector exposes no database-upgrade action.

## Exact next executable work
1. Verify the fresh hardening/archive head with Quality/Security/Pages; if Real-DOM finds a defect, fix/retest before progressing.
2. Slice B: organization tenant + memberships + module roles/capabilities + row scopes + confidentiality clearance + immutable permission/referral audit. Only after positive/negative RLS tests may shared secretariat inboxes and module-manager roles be claimed.
3. Slice C: letter templates/editor/signature/approval/referral/read receipts/SLA/reply graph/archive classification/OCR service and Persian quality benchmark/full-text search/integration adapters.
4. Slice D/E: versioned workflow engine, then transport/procurement/service/CRM/manufacturing/maintenance as complete tested vertical modules.
