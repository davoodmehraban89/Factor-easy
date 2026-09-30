# PROJECT STATE — FINORA / FACTOR-EASY

> **MANDATORY CONTINUITY FILE — READ THIS FIRST**
>
> Repository: `davoodmehraban89/Factor-easy` · Canonical branch: `main` · Product: **Finora 1.0**

Read `AGENTS.md` first, then this file. Latest user chat is the only source of new instructions; repo files are continuity/context. Detailed older history remains at `9d9caade2c3e34d7608e540e40b09ab23f0d19e9`.

## Protocol / authority
Verify live GitHub+Supabase before acting; record material requests before implementation; implement/test/fix/retest/commit/verify in vertical slices; update this file with every durable implementation commit; archive exact production SQL; never call unrun work verified. Owner granted standing authority on 2026-09-30 for in-scope GitHub/Supabase engineering, excluding platform-required confirmations, paid/public/external actions and unsafe destructive financial-history changes.

## Current change ledger
| Date | Request / decision | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-30 | Continue from verified Slice A into Slice B: organization tenant, multi-user memberships, module roles/capabilities, row scopes, confidentiality, shared office access/referral foundation and immutable permission/referral audit. | **IMPLEMENTED IN PRODUCTION DB / PR #7 CI PENDING** | Production migrations `20260930031853`, `20260930031942`, `20260930032615`, `20260930032654` applied+archived. Existing accounts backfilled to isolated organizations; records are organization-keyed while creator `owner_id` remains for own-scope. RLS now intersects organization membership + commercial entitlement + capability + row scope + confidentiality. Organization-aware sync/client, member-permission UI, shared office referral and org-aware attachment paths are on `feat/slice-b-tenant-rbac`. Production transactional tests PASS for own/org scope, confidentiality, read-only capability, expired-license read-only, referral/audit immutability. Performance FK findings fixed; security advisor introduced no new exposed SECURITY DEFINER warning. Final merge requires current PR Quality/Security green, then main Pages green. Evidence: `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md`. |
| 2026-09-30 | Modular organization-wide ERP: office automation/scanned correspondence/secretariat, configurable requests, module managers/permissions, module-select entry, module-by-module/full-suite licensing, future transport/operations; research Barid/ParGar, Chargoon/Didgah, Faragostar. | **SLICE A IMPLEMENTED / VERIFIED** | Request `0b622439`; implementation `d3934690`; read-only expiry hardening `906d78d7`; browser integration hardening `df82067ecb1fda9007eb11a30d0a9d7cc1b113cd`. Production migrations `20260930025546`, `20260930025647`, `20260930030314` applied+archived. Final product-head Quality `36662911587` PASS including syntax, accounting/Phase2–6/Golden, modular-office invariants and Chromium Real-DOM tests; Security `36662911572` PASS; Pages `36662911432` PASS. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | IN PROGRESS — broader roadmap | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until complete lifecycle/accounting/permissions/tests exist. |

## Current production state — 2026-09-30
- Canonical main before Slice B merge: `cba507186ac50f1c2771f720bc651eb8d99d490e`; Slice B PR branch head advances independently until CI green.
- Supabase `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`, 28 migrations through `20260930032654`.
- 4 existing licenses remain `full_suite`; each license now belongs to a backfilled organization whose original account is owner.
- `records` primary identity is `(organization_id, collection, id)`; RLS enforces membership/entitlement/capability/scope/confidentiality. Writes require active organization license; expired/cancelled organizations retain authorized historical reads.
- Organization security metadata: `organizations`, `organization_units`, `organization_members`, `member_module_permissions`, immutable `organization_audit`.
- Office registration is organization-aware; referral is server-validated and immutable; new Storage path is organization/uploader/correspondence/file and resolves access through correspondence authorization. Legacy attachment writes are owner-only.
- Security advisor: same 7 reviewed public SECURITY DEFINER warnings from existing admin/license helpers plus leaked-password protection disabled; Slice B added no new exposed SECURITY DEFINER warning.
- Performance advisor: no unindexed-FK finding after `20260930032615`; newly-created indexes currently appear only as unused-index informational notices.

## Implemented Slice A
- Architecture/research: `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md`.
- Server-enforced commercial module entitlements; full suite or explicit module subset independent of duration/company capacity.
- Module-filtered rail/commands, explicit workspace launcher and admin license module picker. Roadmap-only CRM/transport/manufacturing/maintenance disabled for sale.
- Office: secretariat registries, incoming/outgoing/internal metadata, drafts, server-atomic registration number, private scan attachments, archive metadata search, OCR-ready fields.
- Requests: admin-defined request type/field schema + request submission foundation.

## Implemented Slice B
- Organization tenant and membership model with conservative legacy backfill.
- Per-member module capabilities: `read/create/edit/delete/approve/register/refer/archive/configure`.
- Row scopes: own/unit/branch/company/organization; missing scope key does not broaden access.
- Confidentiality clearance independent of generic module read.
- Organization-aware license selection, workspace/module visibility and sync.
- Owner/member access-management surface; module configurators can assign permissions for their module. Adding a member currently requires an already-registered Finora account.
- Shared office records through server RLS, capability-gated draft/register/configure/refer actions, immutable referrals and permission/referral audit.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is data-boundary enforced; commercial module entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbers are server-atomic; binary scans stay in private Storage; roadmap-only modules are not presented as operational.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/`.

## NOT VERIFIED / external boundary
Invitation of users without an existing Finora account; authenticated two-real-user production browser E2E; real Persian OCR accuracy; qualified digital signature; physical printer; third-party webhook/ECE/email gateways; Supabase leaked-password setting; PostgreSQL 17.11 platform upgrade.

## Exact next executable work
1. Finish PR #7 release gate: current Quality/Security green → merge to `main` → verify Pages/main CI and live browser bootstrap.
2. Slice C: mature office lifecycle — templates/editor, signatures/approval, referral chains/read receipts, SLA/reminders, reply/related-letter graph, archive classification, OCR/full-text and integration adapters.
3. Slice D: versioned workflow engine for configurable requests — steps, conditions, parallel/sequential approval, delegation/substitution, SLA/escalation and immutable action history.
4. Slice E: transport/procurement/service/CRM/manufacturing/maintenance only as complete tested vertical modules with accounting/permissions/reporting integration.
