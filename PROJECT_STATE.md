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
| 2026-09-30 | Expand Finora into a modular organization-wide ERP: professional office automation, scanned correspondence/attachments, secretariat numbering, configurable requests/forms, module managers and granular read/write/approve/secretariat permissions, modular entry experience, module-by-module commercial licensing/full suite, and future transport/operations modules. Research mature Iranian patterns including Barid/ParGar, Chargoon/Didgah and Faragostar. | **SLICE A IMPLEMENTED / CI VERIFICATION PENDING** | Request recorded at `0b622439`. Research/architecture: `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md`. Production migrations applied: `20260930025546 modular_entitlements_office_automation_foundation` and `20260930025647 office_secretariat_atomic_registration`; both are archived exactly in this implementation commit. `licenses.modules` supports explicit modules or `full_suite`; existing users are grandfathered to full suite. RLS + atomic sync enforce module entitlement. Private `office-attachments` bucket has owner/module policies. Office slice includes secretariat registries, incoming/outgoing/internal metadata, draft + server-atomic registration number, private PDF/image attachments, archive metadata search and OCR-ready fields. Requests slice includes admin-defined request types/fields and submission. Module launcher and admin license module picker are implemented; unimplemented CRM/transport/manufacturing/maintenance are visible only in architecture/catalog and disabled for sale. Full multi-login organization sharing/module-manager RBAC is deliberately **not claimed** until tenant membership/RLS Slice B. Fresh Quality/Security/Pages required before marking verified. |
| 2026-09-30 | `@GitHub @Supabase`: perform required remaining work without routine permission prompts and finish executable remaining work. | COMPLETED for prior hardening checkpoint | Quality `36661446705` PASS; Security `36661446688` PASS; Pages `36661445458` PASS on prior product checkpoint. |
| 2026-09-30 | Iran-first high-assurance enterprise ERP with accounting/tax/VAT/commerce/labor/social-security controls and enterprise modules. | IN PROGRESS — broader roadmap | Baseline `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; production enterprise migrations through `20260929221754` remain applied and archived. Do not claim statutory consolidation/full tax submission/full HR/CRM until complete lifecycle/accounting/permissions/tests exist. |

## Current production state — 2026-09-30
- Pre-slice repo head: `0b622439fb03b64b029cbc7b0c7987c55160ad0c`; new implementation commit is pending creation/CI in this file version.
- Supabase `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`.
- Applied migrations: 23 through `20260930025647 office_secretariat_atomic_registration`.
- `licenses.modules` exists, default `['full_suite']`; `admin_set_license_modules` exists.
- `records` RLS now includes server module-entitlement checks; `finora_sync_records` rejects unentitled collection writes.
- Office collections allowed: `officeRegistries`, `correspondence`, `correspondenceAttachments`, `correspondenceReferrals`, `correspondenceAudit`.
- Request collections allowed: `requestTypes`, `requests`, `requestActions`.
- Private Storage bucket `office-attachments`: max 20 MB/object; PDF/JPEG/PNG/TIFF; owner + office-module RLS.
- Secretariat registration RPC uses row lock on registry counter plus unique owner/registry/register-number index.
- Performance advisor before this slice: clean. Security advisor before this slice: 6 public SECURITY DEFINER warnings + leaked-password protection disabled. Recheck after CI.

## Master roadmap status
Phases 1–6 remain accepted/completed: UX shell; accounting foundation; double-entry accounting; projects/contracts; inventory/costing/assets/multi-currency/import/integrations; reports/reconciliation/release. Current work is post-release hardening + Iran-first enterprise/platform expansion, not a reset.

## Platform / accounting invariants
- Posted journal lines are accounting truth; posted/reversed history is immutable; correction uses reversal/amendment.
- Posted vouchers balance and obey fiscal locks; source event/version uniqueness prevents duplicate posting.
- Tenant isolation is mandatory at the data boundary; authorization never relies on user-editable metadata.
- Commercial module entitlement and member authorization are independent. Effective access is their intersection plus tenant/record scope. UI hiding is never a security boundary.
- Office registration numbers are allocated server-side atomically; binary scans live in private Storage, not JSON records.
- Do not expose/sell roadmap-only modules as operational.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/PRODUCTION_RUNBOOK.md` · exact SQL under `supabase/migrations/`.

## NOT VERIFIED / external boundary
- Multi-login organization membership/module-manager RBAC/shared inbox/referral: NOT YET IMPLEMENTED. Existing business record ownership is still user-owned; Slice B must migrate this securely.
- OCR engine accuracy on real Persian scans: NOT VERIFIED; only OCR-ready metadata exists.
- Authenticated production-user browser E2E: NOT VERIFIED; no production user credential/session supplied here.
- Physical-printer behavior: NOT VERIFIED.
- Live third-party webhook/ECE/email gateway delivery: NOT VERIFIED.
- Supabase leaked-password-protection enablement: current platform connector exposes no Auth password-policy mutation.
- PostgreSQL 17.11 upgrade/reindex: NOT PERFORMED; connector exposes no database-upgrade action.

## Exact next executable work
1. Commit this Slice A code/docs/migration archive and run full Quality/Security/Pages, including the new platform-office static check and Chromium test.
2. Recheck production migrations, RLS/storage policies and Supabase advisors; fix any current-head defect before moving on.
3. Slice B: design/migrate organization tenant + memberships + module roles/capabilities + row scopes + confidentiality clearance + immutable permission/referral audit. Only after positive/negative RLS tests may shared secretariat inboxes and module-manager roles be claimed.
4. Slice C: letter templates/editor/signature/approval/referral/read receipts/SLA/reply graph/archive classification/OCR service and quality benchmark/full-text search/integration adapters.
5. Slice D/E: versioned workflow engine, then transport/procurement/service/CRM/manufacturing/maintenance as complete tested vertical modules.
