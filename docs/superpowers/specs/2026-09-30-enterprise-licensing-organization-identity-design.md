# Enterprise Licensing & Organization Identity — Design

Date: 2026-09-30  
Status: OWNER CONCEPT APPROVED / WRITTEN SPEC AWAITING REVIEW  
Repository: `davoodmehraban89/Factor-easy`

## 1. Purpose

Finora must support enterprise customers in which one commercial customer can have one or more legal companies, many regions/branches/units, and tens or hundreds of named users. The seller must be able to sell a license by duration, enabled modules, company capacity and named-user capacity. The customer must then be able to delegate day-to-day system administration inside its own tenant without receiving Finora platform-admin privileges.

The design must remain evolvable: future packaging may add storage, AI, branch, API or other quotas without redesigning tenant identity/RBAC.

## 2. Existing foundation to preserve

Production already has:

- one `organization_id` on each license;
- hierarchical `organization_units`;
- `organization_members` with user, unit, position, status and owner flag;
- per-member module permissions with capabilities `read/create/edit/delete/approve/register/refer/archive/configure`;
- row scopes `own/unit/branch/company/organization`;
- confidentiality clearance;
- commercial `modules[]` and `max_companies` on licenses;
- organization-aware RLS, office registration/referral and audit.

The new slice extends this model. It must not replace tenant IDs, rewrite posted accounting history, or collapse commercial entitlement and member authorization into one concept.

## 3. Core model

Effective access remains:

`tenant membership ∩ active commercial entitlement ∩ assigned role/permission ∩ row scope ∩ confidentiality`

Commercial packaging and customer authorization stay independent.

### 3.1 Commercial license

A license belongs to exactly one Finora organization/tenant and defines at least:

- duration/plan/status;
- enabled modules or `full_suite`;
- `max_companies`;
- `max_users` (named active-user seats);
- extensible `limits` metadata for future quota types that are not yet enforcement-critical.

`max_users` is a hard server-side entitlement. UI counters are informational only.

Named-user licensing is the default. Shared logins are not a supported licensing or audit model.

### 3.2 Seat consumption

A seat is consumed by an active organization member who can sign in and use the tenant. The organization owner also consumes a seat. Suspended/left members do not consume seats. Pending invitations do not consume seats until accepted, but acceptance must fail atomically if no seat is available at that moment.

Existing organizations are grandfathered safely: initial `max_users` must never be lower than the current active-member count. No existing user is silently deactivated by migration.

Seat enforcement must occur on every path that can activate membership, including invitation acceptance and owner/admin reactivation.

### 3.3 Companies versus organizational structure

A legal/accounting company is not the same thing as a region or unit.

Recommended hierarchy:

`Organization/Tenant → Legal Company → Region/Branch → Unit → Subunit`

A customer with one legal company and ten operating regions consumes one company seat, not ten. A holding/customer with seven independent legal companies consumes seven company seats.

The current hierarchical `organization_units` remains the flexible operational tree. Unit metadata will gain an explicit kind such as `region`, `branch`, `department`, `unit`, `subunit` rather than creating separate tables for every organizational vocabulary.

### 3.4 Customer administrators

Platform admin and customer admin are distinct identities.

- **Finora platform admin:** sells/changes commercial licenses and platform-level settings.
- **Organization owner:** original tenant owner; break-glass/full tenant authority.
- **Organization system admin:** delegated customer administrator. Can manage members, invitations, organizational structure, reusable roles and permissions within that tenant, but cannot change commercial entitlements, license dates, module purchases or platform-admin data.
- **Module admin:** can configure and delegate permissions only for authorized module(s), never enable an unlicensed module.
- **Operational roles:** manager, accountant, petty-cash operator, secretariat operator, viewer, etc.

`core` becomes an explicit authorization domain for delegated organization administration. Commercially, core remains always present; authorization to configure core is not implicit for ordinary members.

## 4. Reusable roles with safe overrides

Direct `member_module_permissions` remain supported for backward compatibility and exceptional overrides, but enterprise administration needs reusable role templates.

Introduce:

- `organization_roles`: tenant-scoped role catalog (`system_admin`, `finance_manager`, `accountant`, `petty_cash`, `secretariat`, custom roles, etc.);
- `organization_role_permissions`: module capability/scope/confidentiality grants belonging to a role;
- `organization_member_roles`: assignments of one or more roles to a member.

Effective member authorization is the union of active role grants plus explicit member grants, constrained by commercial module entitlement. No grant can activate a commercially unlicensed module.

System roles are seeded per organization but remain tenant-owned configuration. The schema must allow adding future role attributes without changing the effective-permission contract.

A user may hold multiple roles, for example `accountant` + `secretariat_viewer`.

## 5. Invitation and onboarding

Customer administrators must be able to invite a person who does not yet have a Finora account.

Introduce tenant-scoped invitations containing:

- normalized email;
- target organization;
- optional target unit and position;
- intended role assignments;
- inviter;
- status (`pending/accepted/revoked/expired`);
- expiry;
- single-use opaque token stored only as a hash server-side;
- immutable audit events.

Acceptance rules:

1. token is valid, pending and unexpired;
2. authenticated email matches invitation email unless a future explicit identity-provider policy says otherwise;
3. organization/license is active for new writes;
4. a named-user seat is available;
5. membership creation/reactivation, role assignment, invitation acceptance and seat check happen atomically;
6. duplicate acceptance is idempotent and cannot create duplicate membership/roles.

Email delivery is an adapter boundary. The first vertical slice may generate/manage invitations without claiming external email delivery until a real provider is connected and verified.

## 6. License administration

Finora platform admin must be able to set, independently:

- plan/duration/status;
- modules;
- maximum legal companies;
- maximum named users.

Changing a limit below current usage must be rejected server-side. Reducing modules must preserve historical authorized reads according to existing expiry/history rules and must not destructively delete tenant data.

Future quota dimensions should be addable without changing the membership/RBAC tables. Enforcement-critical quotas should graduate from generic metadata to typed columns/functions when introduced.

## 7. Organization administration UX

The customer-facing administration area should show:

- license summary: modules, expiry, company usage/capacity, user usage/capacity;
- organization tree with unit type, parent and active state;
- members with status, unit, position, roles and effective modules;
- invitations with pending/expired/revoked states;
- reusable role catalog and role permission editor;
- direct per-user overrides as an advanced action;
- audit trail for membership, role, permission and invitation changes.

The UI must never imply that a permission is effective when the corresponding commercial module is not licensed.

## 8. Server-side enforcement and security

Mandatory invariants:

1. Seat and company limits are enforced in Postgres/RPC, never only in JavaScript.
2. A customer administrator cannot alter `licenses.modules`, duration, status, `max_companies` or `max_users`.
3. An organization administrator can act only inside organizations in which they hold active delegated core administration.
4. A module admin cannot grant capabilities outside their module or beyond commercial entitlement.
5. Invitations cannot cross tenants and cannot be replayed.
6. Role assignment cannot create access to an unlicensed module.
7. Suspending a member removes effective tenant access without deleting historical actor identity/audit references.
8. Posted accounting history remains immutable; role/license changes never rewrite financial history.
9. Every membership, role, permission, invitation and delegated-admin mutation is auditable.
10. Existing owner-only organizations continue working after migration.

## 9. Backward compatibility and migration strategy

The migration is additive and reversible at the application level:

- add `max_users` with a conservative grandfather value at or above current active members;
- add extensible license-limit metadata without moving existing `modules`/`max_companies` immediately;
- add unit kind with a neutral default;
- add role/invitation tables;
- seed an organization-admin role and useful starter roles without assigning them automatically except where explicitly safe;
- preserve direct member permissions and include them in effective authorization;
- expand the module permission constraint to include `core`;
- replace owner-only organization-management policies with owner OR delegated `core/configure` checks;
- fix any company-limit enforcement that is still owner-user scoped so it is organization/license scoped.

No production membership is deleted or silently broadened.

## 10. Vertical delivery slices

### ELI-1 — License seats + delegated organization admin

Deliver `max_users`, server seat enforcement, `core/configure`, organization-admin delegation, organization-scoped company-limit enforcement, admin license UI for user capacity, usage counters, RLS/negative tests and migration archive.

This is the first implementation slice because all later onboarding depends on it.

### ELI-2 — Reusable role catalog

Deliver role tables, role permission editor, member role assignment, effective-permission union and starter role templates. Preserve direct member grants as overrides.

### ELI-3 — Invitations

Deliver secure invitation lifecycle, acceptance RPC, seat-safe atomic acceptance, revoke/expire/idempotency behavior and customer UI. External email sending remains NOT VERIFIED until a real provider is connected.

### ELI-4 — Enterprise organization UX + real-user verification

Deliver organization-tree unit kinds, consolidated administration screens, seat/company/module usage dashboard, and authenticated two-real-user browser E2E using legitimate test principals. This slice closes the current real-user E2E blocker if suitable principals exist.

## 11. Acceptance criteria

The feature is not complete until all of the following are proven:

- a platform admin can sell a license such as `Annual / 5 companies / 300 named users / Accounting + Treasury + Office`;
- the 301st active member is rejected atomically;
- suspended/left members free seats without deleting audit identity;
- invitation acceptance cannot exceed seat capacity;
- a delegated organization admin can manage users/units/roles but cannot alter the commercial license;
- a module admin cannot grant or use an unlicensed module;
- one legal company with ten regions consumes one company capacity;
- multi-company tenants remain isolated by tenant and company scope;
- existing owner-only tenants continue to work without manual repair;
- production migration SQL is archived under `supabase/migrations/`;
- accounting invariants and existing Phase/Golden tests remain green;
- Real-DOM tests cover the new admin/license flows;
- any real-user or external-email test not actually run is explicitly reported as NOT VERIFIED.

## 12. Explicit non-goals for this slice

- concurrent-session licensing;
- SSO/SCIM enterprise provisioning;
- billing/payment collection;
- automatic email provider integration without a verified provider;
- per-device licensing;
- rewriting the existing tenant model;
- destructive conversion of historical accounting data.

These can be added later without changing the core contract: organization owns the license; license defines commercial capacity; named people join the organization; roles/permissions define what each person can do.
