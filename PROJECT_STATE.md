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
| 2026-09-30 | Audit Gmail GitHub `Run failed` notifications, verify/fix any still-live CI defects, and produce a severity-ranked list of remaining gaps needed to make the current Finora stage complete. | **AUDITED / HISTORICAL FAILURES TRIAGED / CI MAINTENANCE APPLIED / GAP REGISTERED** | Gmail failures mapped to intermediate commits: old Real-DOM/request-builder failures were fixed by later browser hardening; Slice-B migration-count invariant was fixed by later archived migrations; Security failures were Dependency Review failing because GitHub Dependency graph is disabled while CodeQL passed. During this audit a CodeQL v4 modernization attempt exposed a repository invariant still pinned to v3 and generated transient main failure emails (`31ef607`, `42d2476`, `7e8e43e`); rather than weaken the gate, CodeQL was restored to supported v3 at `0279c3d`. Quality remains modernized on `checkout@v7` + `setup-node@v7`; security uses `checkout@v7` and CodeQL v3 until the invariant and action are migrated together. On follow-up run `36666564985`, syntax + application + Phase2–6 + Golden + platform + Slice-B invariants all passed before browser-runtime installation; full post-maintenance Quality/CodeQL/Pages completion remains to be observed. Prioritized remaining register: `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md`. |
| 2026-09-30 | Continue from verified Slice A into Slice B: organization tenant, multi-user memberships, module roles/capabilities, row scopes, confidentiality, shared office access/referral foundation and immutable permission/referral audit. | **IMPLEMENTED / MERGED / VERIFIED** | PR #7 merged as `d212c6aeef5b49f33351166771a0899f307a9067`. PR Quality `36664844247` PASS and Security `36664844234` CodeQL PASS. Final main checkpoint `99a23edcaddf542f9080bbe70bb0b450af14913f` also passed Quality `36664994360`, Security/CodeQL `36664994384`, and Pages `36664994039`. Production migrations `20260930031853`, `20260930031942`, `20260930032615`, `20260930032654`, `20260930033010` applied+archived. Production transactional tests PASS for own/org scope, confidentiality, read-only capability, member core read-only context, expired-license read-only, referral/audit immutability and member Storage-path isolation. GitHub Dependency graph remains disabled, so dependency review is not claimed. Evidence: `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md`. |
| 2026-09-30 | Modular organization-wide ERP: office automation/scanned correspondence/secretariat, configurable requests, module managers/permissions, module-select entry, module-by-module/full-suite licensing, future transport/operations; research Barid/ParGar, Chargoon/Didgah, Faragostar. | **SLICE A IMPLEMENTED / VERIFIED** | Request `0b622439`; implementation `d3934690`; read-only expiry hardening `906d78d7`; browser integration hardening `df82067ecb1fda9007eb11a30d0a9d7cc1b113cd`. Production migrations `20260930025546`, `20260930025647`, `20260930030314` applied+archived. Final product-head Quality `36662911587` PASS including syntax, accounting/Phase2–6/Golden, modular-office invariants and Chromium Real-DOM tests; Security `36662911572` PASS; Pages `36662911432` PASS. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | IN PROGRESS — broader roadmap | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until complete lifecycle/accounting/permissions/tests exist. |

## Current production state — 2026-09-30
- Verified Slice B release checkpoint on canonical main: `99a23edcaddf542f9080bbe70bb0b450af14913f`; subsequent commits are continuity/CI-maintenance/gap-documentation changes and require their own green main gates before being called release-verified.
- Supabase `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`, 29 migrations through `20260930033010`.
- 4 existing licenses remain `full_suite`; each license belongs to a backfilled organization whose original account is owner. Production check: 4 organizations, 4 active owners, 0 licenses without organization, 0 records without organization.
- `records` primary identity is `(organization_id, collection, id)`; RLS enforces membership/entitlement/capability/scope/confidentiality. Writes require active organization license; expired/cancelled organizations retain authorized historical reads.
- Active non-owner members receive read-only `core` context for workspace initialization; core writes remain owner-only in Slice B.
- Organization security metadata: `organizations`, `organization_units`, `organization_members`, `member_module_permissions`, immutable `organization_audit`.
- Office registration is organization-aware; referral is server-validated and immutable; new Storage path is organization/uploader/correspondence/file and resolves access through correspondence authorization. Legacy attachment writes are owner-only.
- Live security advisor still reports 7 reviewed authenticated-callable public SECURITY DEFINER helpers and leaked-password protection disabled; these are tracked in the gap register and are not silently called resolved.
- Live performance advisor reports 5 newly-created unused-index informational notices; no unindexed-FK finding is present. Do not remove new indexes before representative workload evidence.
- Production currently has 7 invoice records and no account-master/journal collections; controlled accounting cutover remains a P0 completion gap rather than being auto-posted destructively.

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
- Organization-aware license selection, explicit organization switcher, workspace/module visibility and sync.
- Owner/member access-management surface; module configurators can assign permissions for their module. Adding a member currently requires an already-registered Finora account.
- Shared office records through server RLS, capability-gated draft/register/configure/refer actions, immutable referrals and permission/referral audit.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is data-boundary enforced; commercial module entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbers are server-atomic; binary scans stay in private Storage; roadmap-only modules are not presented as operational.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/SLICE_B_TENANT_RBAC_VERIFICATION.md` · `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/`.

## NOT VERIFIED / external boundary
Authenticated two-real-user production browser E2E; member invitation without a pre-existing account; controlled posting/reconciliation of existing production invoices into initialized accounting masters; real Persian OCR accuracy; qualified digital signature; physical printer; third-party webhook/ECE/email gateways; GitHub Dependency graph/dependency-review availability; Supabase leaked-password protection; formal closure/hardening disposition for 7 public SECURITY DEFINER advisor warnings; PostgreSQL 17.11 platform upgrade; complete post-maintenance Quality/CodeQL/Pages result after the CI runtime changes.

## Exact next executable work
1. Close current-stage P0/P1 register in `docs/CURRENT_STAGE_GAP_REGISTER_2026-09-30.md`, starting with two-real-user authenticated E2E and a non-destructive controlled accounting cutover plan/evidence.
2. Finish CI maintenance cleanly: migrate the CodeQL version invariant and action together to v4 in a tested change; enable GitHub Dependency graph so dependency review becomes real rather than skipped.
3. Slice C: mature office lifecycle — templates/editor, signatures/approval, referral chains/read receipts, SLA/reminders, reply/related-letter graph, archive classification, OCR/full-text and integration adapters.
4. Slice D: versioned workflow engine for configurable requests — steps, conditions, parallel/sequential approval, delegation/substitution, SLA/escalation and immutable action history.
5. Slice E: transport/procurement/service/CRM/manufacturing/maintenance only as complete tested vertical modules with accounting/permissions/reporting integration.
