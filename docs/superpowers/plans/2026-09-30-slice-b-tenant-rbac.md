# Slice B Tenant RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Finora's single-account record ownership into an organization-aware multi-user authorization boundary with module capabilities, row scopes, confidentiality and auditable office referrals while preserving existing users and accounting invariants.

**Architecture:** Security metadata is relational and server-enforced; business payloads remain in `records`. Every existing account is backfilled into its own organization, licenses attach to that organization without removing the legacy billing owner, and records gain `organization_id` while retaining `owner_id` as creator/own-scope identity. RLS evaluates organization membership, commercial module entitlement, capability, row scope and confidentiality independently.

**Tech Stack:** PostgreSQL 17 / Supabase RLS + Auth + Storage, vanilla JavaScript, GitHub Actions / Node 22 / Playwright.

**Spec:** `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md`

## Global Constraints

- Effective access = commercial module entitlement ∩ organization membership permission ∩ record scope/confidentiality.
- Existing production users and records must be backfilled without data loss; each existing account starts as owner of an isolated organization.
- Posted accounting history remains immutable and balanced.
- Expired/cancelled licenses retain read-only access to entitled history but cannot write.
- UI hiding is never the authorization boundary.
- `SECURITY DEFINER` helpers live in `private`, use `search_path=''`, are schema-qualified and have explicit execute grants.
- New exposed tables use explicit grants plus RLS because Supabase is moving to non-automatic Data API grants.

## Review Focus

- A member of organization A must never read or mutate organization B records.
- A member with `read` but not `edit` must not mutate shared records even if the UI is bypassed.
- Company/unit/branch scoped permissions must deny records missing or mismatching the scope key.
- Confidential correspondence above the member's clearance must be invisible even with module read permission.
- Expired organization license must preserve authorized reads and deny writes/referrals/permission changes.

---

### Task 1: Organization identity and migration-safe authorization schema

**Files:**
- Create: `supabase/migrations/<production-version>_organization_membership_rbac_foundation.sql`
- Create: `scripts/slice-b-rbac-check.mjs`
- Modify: `.github/workflows/quality.yml`

**Interfaces:**
- Produces relational `organizations`, `organization_units`, `organization_members`, `member_module_permissions`, `organization_audit`; `licenses.organization_id`; `records.organization_id`; private authorization helpers; organization-aware RLS and sync RPC.
- Existing clients may continue reading their own backfilled organization during the transition.

- [ ] Write static/invariant tests for schema, backfill, grants, RLS, capability/scope/confidentiality helpers and audit immutability.
- [ ] Run test and verify RED because the migration is absent.
- [ ] Implement the migration with additive/backfill-first DDL and no destructive financial-history rewrite.
- [ ] Run the invariant test and existing static suites; expect PASS.
- [ ] Commit.

### Task 2: Client organization context and capability-aware workspace

**Files:**
- Modify: `js/core.js`
- Modify: `js/sync.js`
- Modify: `js/platform-modules.js`
- Modify: `scripts/slice-b-rbac-check.mjs`

**Interfaces:**
- Produces `currentUser.organizations`, `currentUser.organizationId`, `currentUser.modulePermissions`, `hasFinoraCapability(module, capability)` and organization-aware `pullAll` / `finora_sync_records` calls.
- Consumes Task 1 membership/permission read RPC or tables and organization-aware sync contract.

- [ ] Extend tests first for active organization, module/capability gating and organization-aware sync payload.
- [ ] Verify RED.
- [ ] Implement minimal client context and capability gating while keeping legacy owner-facing helpers compatible.
- [ ] Verify new tests and existing quality checks PASS.
- [ ] Commit.

### Task 3: Office shared inbox, referral and permission administration foundation

**Files:**
- Modify: `js/office-automation.js`
- Modify: `js/platform-modules.js`
- Modify: `scripts/platform-office.spec.js`
- Modify: `scripts/slice-b-rbac-check.mjs`

**Interfaces:**
- Produces capability-gated office actions: ordinary read/draft, secretariat register/archive, module-admin configure, manager refer; referral writes go through server RPC and immutable audit.
- Consumes Task 1 authorization/referral RPCs and Task 2 `hasFinoraCapability`.

- [ ] Add failing DOM/static tests for hidden/disabled actions without capability and referral surface for authorized users.
- [ ] Verify RED.
- [ ] Implement shared inbox/referral and role-aware office controls without enabling unverified OCR/signature features.
- [ ] Verify DOM/static suites PASS.
- [ ] Commit.

### Task 4: Production migration, negative/positive security tests and release evidence

**Files:**
- Archive exact applied SQL under `supabase/migrations/`.
- Modify: `docs/FINORA_MODULAR_ERP_OFFICE_AUTOMATION_V1.md`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- Produces verified production Slice B checkpoint and exact next work for Slice C.

- [ ] Apply the reviewed migration to Supabase production and verify migration history.
- [ ] Run positive/negative SQL checks for cross-tenant isolation, read-vs-edit capability, confidentiality, scope, expired-license write denial, referral audit immutability and legacy-owner backfill.
- [ ] Run Supabase security/performance advisors and fix new material findings.
- [ ] Open/verify PR CI (Quality/Security) and merge only after green; verify Pages on main.
- [ ] Update architecture/state with exact migration, commit, CI and unresolved external boundaries.
