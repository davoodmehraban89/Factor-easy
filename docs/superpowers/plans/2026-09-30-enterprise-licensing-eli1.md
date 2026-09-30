# Enterprise Licensing ELI-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hard named-user seat capacity and delegated organization administration to the existing organization/RBAC model without breaking existing tenants or accounting history.

**Architecture:** Extend the current organization-linked license with `max_users` and future-safe `limits` metadata, enforce active named-user seats and legal-company capacity inside Postgres, and make `core/configure` the explicit delegated customer-admin capability. Preserve existing direct member permissions and owner semantics; ELI-2 roles and ELI-3 invitations remain separate later slices.

**Tech Stack:** PostgreSQL 17 / Supabase RLS+RPC, vanilla JavaScript, Supabase JS, Node 22 invariant scripts, Playwright 1.55 Chromium.

**Spec:** `docs/superpowers/specs/2026-09-30-enterprise-licensing-organization-identity-design.md`

## Global Constraints

- Existing tenant IDs, posted accounting history, organization ownership and direct member grants must not be rewritten or deleted.
- Named-user seats count active `organization_members`, including the owner; `suspended` and `left` do not consume seats.
- Existing tenants are grandfathered so `max_users >= current active-member count` after migration.
- Seat/company limits are server-enforced; UI counters are informational only.
- Customer administrators cannot change commercial license dates/status/modules/company/user capacity.
- `core` is commercially always present, but `core/configure` is an explicit authorization grant for delegated organization administration.
- A module administrator cannot grant another module or an unlicensed module.
- All production SQL must be archived exactly under `supabase/migrations/` and `PROJECT_STATE.md` updated in the same durable implementation commit.
- Existing accounting Phase 2–6, Golden Accounting Journey, modular-office, Slice-B and Real-DOM gates must remain green.

## Review Focus

- Concurrent activation of the last available seat: exactly one activation succeeds and the next is rejected atomically.
- Reducing `max_users` or `max_companies` below current usage: server rejects without partial mutation.
- Delegated `core/configure`: can manage tenant members/units but cannot mutate commercial license fields.
- Re-activating a suspended/left member at capacity: rejected; suspending an active member immediately frees one seat without deleting identity/audit.
- One legal company with many regions/units: only `companies` records consume company capacity; organization units never consume company capacity.

---

### Task 1: Database entitlement and delegated-admin contract

**Files:**
- Create: `supabase/migrations/20260930050000_enterprise_license_seats_delegated_admin.sql`
- Create: `scripts/enterprise-license-check.mjs`
- Modify: `.github/workflows/quality.yml`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- Produces: `licenses.max_users integer`, `licenses.limits jsonb`, `private.organization_active_member_count(uuid) -> integer`, `private.organization_has_seat(uuid, uuid default null) -> boolean`, `public.admin_set_user_limit(uuid, integer) -> void`, updated `public.admin_set_company_limit(uuid, integer)`, updated `public.organization_add_member(uuid,text,uuid,text) -> uuid`, `public.organization_set_member_status(uuid,uuid,text) -> void`, and `core` as a valid `member_module_permissions.module_key`.
- Produces authorization rule: owner OR `private.has_org_capability(org,'core','configure')` may manage organization members/units; only platform `is_admin()` may change commercial limits.
- Consumes: existing `organizations`, `organization_members`, `member_module_permissions`, `licenses`, `records`, `private.has_org_capability`, `private.organization_has_module_entitlement`.

- [ ] **Step 1: Write the failing invariant script**

Create `scripts/enterprise-license-check.mjs` with assertions that the new migration contains: `max_users`, grandfathering via active-member count, `limits jsonb`, `core` in the permission constraint, seat enforcement on activation, organization-scoped company counting, `admin_set_user_limit`, delegated `core/configure` management, and audit capture for membership/status/permission changes. Assert `js/organization-rbac.js`, `js/admin.js`/`js/platform-modules.js`, `index.html` and the Quality workflow are wired to the new contract only after later tasks.

- [ ] **Step 2: Run the new invariant script and verify RED**

Run: `node scripts/enterprise-license-check.mjs`
Expected: FAIL because the ELI-1 migration/UI contract does not yet exist.

- [ ] **Step 3: Implement the additive SQL migration**

In `supabase/migrations/20260930050000_enterprise_license_seats_delegated_admin.sql`:
- add `licenses.max_users integer not null default 1` with a bounded positive check and grandfather every license to at least current active-member count;
- add `licenses.limits jsonb not null default '{}'::jsonb` with object-type check;
- replace the `member_module_permissions.module_key` check so `core` is valid while retaining all existing module keys;
- add `private.organization_active_member_count(p_organization_id uuid) returns integer`;
- add `private.organization_has_seat(p_organization_id uuid,p_excluding_member uuid default null) returns boolean`;
- add a BEFORE INSERT/UPDATE membership trigger that only performs a seat check when the resulting row becomes active and prevents race-overbooking by locking the organization license row before counting;
- add `public.admin_set_user_limit(target uuid,new_max_users integer)` guarded by `public.is_admin()` and reject values below current active usage;
- replace `public.admin_set_company_limit` and `private/public` company-limit enforcement so counts and entitlement lookup use `organization_id`, not `owner_id`;
- replace `public.organization_add_member` so owner or `core/configure` may add/reactivate a pre-existing Finora user and the seat trigger remains authoritative;
- add `public.organization_set_member_status` for `active/suspended/left`, owner-protection and delegated administration;
- allow owner or `core/configure` to manage organization units and non-owner membership; ordinary members remain denied;
- update `organization_set_member_permission` so `core` is assignable only by owner or existing `core/configure`, while module configurators remain restricted to their own licensed module;
- extend immutable audit capture to member status/unit/position and delegated permission changes.

- [ ] **Step 4: Run static SQL-contract test**

Run: `node scripts/enterprise-license-check.mjs`
Expected: migration assertions PASS; UI assertions may remain intentionally failing until Tasks 2–3, so gate the script by explicit task-stage fixtures or implement only the DB assertions in this first commit.

- [ ] **Step 5: Run existing non-browser gates**

Run: `node scripts/syntax-check.mjs && node scripts/quality-check.mjs && node scripts/phase2-check.mjs && node scripts/phase3-check.mjs && node scripts/phase3-behavior-check.mjs && node scripts/phase4-behavior-check.mjs && node scripts/phase5-behavior-check.mjs && node scripts/enterprise-behavior-check.mjs && node scripts/phase6-behavior-check.mjs && node scripts/golden-accounting-core-check.mjs && node scripts/platform-office-check.mjs && node scripts/slice-b-rbac-check.mjs`
Expected: all PASS.

- [ ] **Step 6: Commit Task 1 with state update**

Commit migration, invariant script, Quality workflow entry and `PROJECT_STATE.md` together. State must say migration is repository-prepared only until Production apply/test actually succeeds.

### Task 2: License admin UI and runtime seat context

**Files:**
- Modify: `index.html`
- Modify: `js/admin.js`
- Modify: `js/platform-modules.js`
- Modify: `js/organization-rbac.js`
- Modify: `scripts/enterprise-license-check.mjs`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- Consumes: `licenses.max_users`, `admin_set_user_limit`, existing `admin_set_company_limit`, `admin_set_license_modules`, organization memberships.
- Produces runtime fields: `currentUser.maxUsers`, `currentUser.activeSeatCount`, `currentUser.remainingSeats`, `currentUser.canConfigureOrganization`.
- Produces UI: platform-admin license editor for named-user capacity; organization access manager usage counter and delegated-admin controls.

- [ ] **Step 1: Extend failing invariant assertions for UI wiring**

Assert the license modal has `modal-license-user-limit`; admin list shows user capacity; the license save path calls `admin_set_user_limit`; organization context loads active membership usage; and `core/configure` is used to show delegated organization-management UI.

- [ ] **Step 2: Run invariant script and verify RED**

Run: `node scripts/enterprise-license-check.mjs`
Expected: FAIL on missing UI/runtime hooks.

- [ ] **Step 3: Implement platform-admin capacity UI**

In `index.html` add a named-user capacity field next to company capacity and add a user-capacity column to the admin license table. In `js/admin.js` render `max_users` safely with backward-compatible fallback. In `js/platform-modules.js` extend the existing license edit override so it validates a positive user limit and calls `admin_set_user_limit` after plan/company/module updates; do not claim success if any RPC fails.

- [ ] **Step 4: Implement organization runtime/admin context**

In `js/organization-rbac.js` load enough membership/license context to calculate active seat usage and expose `maxUsers`, `activeSeatCount`, `remainingSeats`. Change organization-manager visibility from owner-or-any-module-configure to: owner or `core/configure` for member/unit administration; module configurators keep only their module permission editor. Add member suspend/reactivate actions through `organization_set_member_status`; prevent owner suspension in UI but rely on server enforcement as authoritative.

- [ ] **Step 5: Run invariant + syntax checks**

Run: `node scripts/enterprise-license-check.mjs && node scripts/syntax-check.mjs && node scripts/slice-b-rbac-check.mjs && node scripts/platform-office-check.mjs`
Expected: all PASS.

- [ ] **Step 6: Commit Task 2 with state update**

Commit UI/runtime changes and `PROJECT_STATE.md` together; keep Production behavior marked NOT VERIFIED until migration apply and transactional checks.

### Task 3: Real-DOM coverage for license seats and delegated administration

**Files:**
- Create: `scripts/enterprise-license.spec.js`
- Modify: `.github/workflows/quality.yml`
- Modify: `scripts/enterprise-license-check.mjs`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- Consumes: ELI-1 DOM IDs/functions from Task 2.
- Produces: Chromium evidence for platform-admin capacity editing, seat counters, delegated-admin visibility and ordinary/module-admin denial in rendered UI.

- [ ] **Step 1: Write Playwright tests before wiring them into CI**

Create `scripts/enterprise-license.spec.js` that stubs Supabase responses deterministically and verifies: `300` named-user capacity renders; active usage/remaining seats render; platform admin can enter a changed capacity; delegated `core/configure` sees member management; a module-only configurator does not gain organization-wide administration; an unlicensed module remains unavailable.

- [ ] **Step 2: Run the Playwright file and verify RED where behavior is missing**

Run: `python3 -m http.server 4173 >/tmp/finora-http.log 2>&1 & npx playwright test scripts/enterprise-license.spec.js --reporter=line --workers=1`
Expected: initial failing assertion before final DOM wiring, then PASS after correction.

- [ ] **Step 3: Add the spec to the existing Real DOM CI command**

Modify `.github/workflows/quality.yml` so the Real DOM step runs `scripts/dom-smoke.spec.js`, `scripts/platform-office.spec.js`, and `scripts/enterprise-license.spec.js` together.

- [ ] **Step 4: Run the full local quality suite**

Run the complete commands from `.github/workflows/quality.yml` including Chromium.
Expected: all PASS, including Golden Accounting Journey and all three Real-DOM specs.

- [ ] **Step 5: Commit Task 3 with state update**

Record exact local tests run; do not call Production seat/RLS behavior verified yet.

### Task 4: Production apply, adversarial SQL verification, and release checkpoint

**Files:**
- Modify if actual Supabase version differs: `supabase/migrations/20260930050000_enterprise_license_seats_delegated_admin.sql` so repository SQL exactly matches applied SQL/version.
- Create: `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- Consumes: reviewed migration and app changes from Tasks 1–3.
- Produces: Production schema/RLS evidence and release checkpoint; no fabricated two-real-user browser claim.

- [ ] **Step 1: Re-read Production before mutation**

Verify project `hcsixhqbyuhpshfwqpjx` health, migration list, active-member counts per organization, current `max_companies/modules`, RLS and advisors. Abort/reconcile if Production differs from the plan assumptions.

- [ ] **Step 2: Apply the exact ELI-1 migration once**

Apply the reviewed SQL to Production. If Supabase assigns a different migration version, rename/archive the repository file to the exact applied version before the durable implementation commit.
Expected: migration succeeds with no existing member deactivated and every `max_users >= active_member_count`.

- [ ] **Step 3: Run transactional adversarial verification and ROLLBACK test data**

Inside explicit transactions/rollback, prove: platform admin can set user capacity; non-admin cannot; lowering below usage fails; activation at capacity fails; suspension frees a seat; reactivation consumes it; delegated `core/configure` can manage a non-owner member/unit; ordinary member cannot; delegated admin cannot mutate license commercial fields; module configurator cannot grant another/unlicensed module; company capacity counts organization `companies` records and ignores regions/units. Use legitimate existing principals only; if a second principal is unavailable, mark the affected authenticated-browser scenario NOT VERIFIED rather than fabricating one.

- [ ] **Step 4: Re-run advisors and data invariants**

Verify RLS remains enabled, no orphan membership/license is introduced, active seats are within limits, and accounting data counts/journal invariants are unchanged.

- [ ] **Step 5: Write verification evidence**

Create `docs/ELI_1_ENTERPRISE_LICENSE_VERIFICATION.md` with applied migration version, SQL test matrix/results, CI SHAs/run IDs, advisor results and explicit NOT VERIFIED boundaries.

- [ ] **Step 6: Push final durable implementation commit and observe GitHub gates**

Update `PROJECT_STATE.md` in the same commit. Verify Quality, Security/CodeQL and Pages for the final head. Never mark ELI-1 COMPLETED from CI alone: Production transactional tests and Real-DOM tests must both have passed; any unavailable two-real-user browser test stays NOT VERIFIED.

---

## Self-review result

- Spec coverage: ELI-1 is fully covered; ELI-2 reusable roles, ELI-3 invitations and ELI-4 organization-tree UX/real-user E2E are intentionally excluded and retain their own future plans.
- Type/interface consistency: `max_users`, `core/configure`, organization-scoped company count and membership status RPC are used consistently across DB/runtime/UI/tests.
- Review-focus coverage: all five listed failure modes are assigned to static, Playwright or transactional Production tests.
- Proportion: tasks describe contracts and testable outcomes without embedding implementation bodies.
