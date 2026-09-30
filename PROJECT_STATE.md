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
| 2026-09-30 | Modular organization-wide ERP: office automation/scanned correspondence/secretariat, configurable requests, module managers/permissions, module-select entry, module-by-module/full-suite licensing, future transport/operations; research Barid/ParGar, Chargoon/Didgah, Faragostar. | **SLICE A IMPLEMENTED / FINAL CI PENDING** | Request `0b622439`; initial implementation `d3934690`; read-only expiry hardening `906d78d7`. Production migrations `20260930025546`, `20260930025647`, `20260930030314` applied+archived. Quality `36662546643` proved all static/accounting/Phase2–6/Golden/new platform invariants PASS, then exposed 3 browser-harness/integration issues: auto workspace modal intercepted the legacy DOM smoke; delayed extension bootstrap could rerun auth after a manual smoke login; new request-builder test counted the required checkbox as a text input. This checkpoint removes automatic modal interception while retaining explicit workspace launcher/switching, prevents delayed bootstrap from reinitializing auth when a user is already active, and corrects the test selector to `input.form-control`. Product module gating remains unchanged. Fresh Quality/Security/Pages required. Multi-login tenant/RBAC remains Slice B and is not claimed. |
| 2026-09-30 | Iran-first high-assurance ERP expansion. | IN PROGRESS — broader roadmap | `docs/IRAN_COMPLIANCE_MATRIX_V1.md`; do not claim statutory consolidation/full tax submission/full HR/CRM until complete lifecycle/accounting/permissions/tests exist. |

## Current production state — 2026-09-30
- Pre-fix repo head: `906d78d751c7673196044ff55ba5a2224d6ce7ed`; this checkpoint contains only browser/bootstrap/test integration fixes, no new DB mutation.
- Supabase `hcsixhqbyuhpshfwqpjx`: `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`, 24 migrations through `20260930030314`.
- Existing 4 licenses grandfathered to `full_suite`; `admin_set_license_modules` validates explicit module keys.
- 4/4 records policies include module entitlement; writes and atomic sync additionally require active license. Expired/cancelled users retain read-only access to entitled historical data.
- Private `office-attachments`: max 20 MB, PDF/JPEG/PNG/TIFF, owner+office-module RLS. Secretariat numbering uses server row lock + unique index.
- DB negative tests PASS: non-admin module RPC denied; unlicensed office write denied. Positive transactional registration test advanced registry counter 7→8 then rolled back.
- Performance advisor after migrations: clean. Security advisor: 7 reviewed public SECURITY DEFINER RPC warnings (prior six + `admin_set_license_modules`) plus leaked-password protection disabled; new admin RPC negative-tested 42501 for non-admin.

## Implemented Slice A
- Architecture/research: `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md`.
- Server-enforced commercial module entitlements; full suite or explicit module subset independent of duration/company capacity.
- Module-filtered rail, command routing, explicit workspace launcher and admin license module picker. Roadmap-only CRM/transport/manufacturing/maintenance disabled for sale.
- Office: secretariat registries, incoming/outgoing/internal metadata, drafts, server-atomic registration number, private scan attachments, archive metadata search, OCR-ready fields.
- Requests: admin-defined request type/field schema + request submission foundation.

## Invariants
Posted accounting history is immutable and balanced; tenant isolation is data-boundary enforced; commercial module entitlement and member authorization are independent; UI hiding is never security; expired licenses are read-only; office numbers are server-atomic; binary scans stay in private Storage; roadmap-only modules are not presented as operational.

## Required evidence
`docs/PHASE_1_REDESIGN_VERIFICATION.md` · `docs/PHASE_2_REDESIGN_VERIFICATION.md` · `docs/PHASE_3_REDESIGN_VERIFICATION.md` · `docs/PHASE_4_REDESIGN_VERIFICATION.md` · `docs/PHASE_5_VERIFICATION.md` · `docs/PHASE_6_VERIFICATION.md` · `docs/IRAN_COMPLIANCE_MATRIX_V1.md` · `docs/FINORA_ERP_EXPANSION_ROADMAP_V4.md` · `docs/FINORA_UX_ACCOUNTING_BENCHMARK_V3.md` · `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md` · `docs/PRODUCTION_RUNBOOK.md` · `supabase/migrations/`.

## NOT VERIFIED / external boundary
Multi-login organization membership/module-manager RBAC/shared inbox/referral; real Persian OCR accuracy; authenticated production-user browser E2E; physical printer; third-party webhook/ECE/email gateways; Supabase leaked-password setting; PostgreSQL 17.11 platform upgrade.

## Exact next executable work
1. Run fresh Quality/Security/Pages on this browser-integration fix; no progress to Slice B until green.
2. Recheck Supabase migrations/RLS/storage/advisors.
3. Slice B: organization tenant + memberships + module roles/capabilities + row scopes + confidentiality + immutable permission/referral audit, with positive/negative RLS tests.
4. Slice C: mature office lifecycle (templates/editor/signature/approval/referral/read receipts/SLA/reply graph/archive/OCR/full-text/integration adapters).
5. Slice D/E: versioned workflow engine then transport/procurement/service/CRM/manufacturing/maintenance as complete tested vertical modules.
