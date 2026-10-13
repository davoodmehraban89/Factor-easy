# Finora Phase 1 — Live permission and SECURITY DEFINER read-only audit
**Observed:** 2026-10-13 · **Scope:** independent, metadata-only Phase 1 slice while owner defers F0-01 startup slowness. **Status:** READ-ONLY METADATA VERIFIED; AUTHENTICATED NEGATIVE TESTS OPEN; PHASE 1 NOT ACCEPTED.

## Authority and version
- Owner explicitly prioritizes continuing Finora phases now; Phase 0 login slowness remains open and deferred, **not accepted**.
- Canonical protected main at audit start: `1fa5cf99be9eb790d1192b7597d2dbf65cc9d3fa`. GitHub same SHA Quality `38357143810`, Security `38357143834`, Release `38357450781`, gated Pages `38357495885` SUCCESS. Exact production user-login stability is unresolved and separate.
- Production Supabase project `hcsixhqbyuhpshfwqpjx` was **ACTIVE_HEALTHY**, PostgreSQL 17.6.1.166, **82 migration ledger records**, last `20261012075507 fix_identity_bootstrap_license_before_membership`. This audit does not authorize schema changes or infer migration SQL equivalence.

## Directly verified live catalog metadata
| Control | Observed | Interpretation |
|---|---|---|
| Public tables with RLS enabled | **18/18** | All inspected public base tables use RLS; no assurance policy bodies cannot be bypassed |
| Private tables with RLS enabled | **3/10** | Seven private tables do not enable RLS; needs threat-model/privilege review |
| Direct SELECT on private tables by `anon` or `authenticated` | **0/10** | No direct table SELECT grants found for either role, regardless of RLS |
| Private schema USAGE | `anon=false`, `authenticated=true` | Do not equate table-grant absence with all possible RPC/function paths being inaccessible |
| Public SECURITY DEFINER functions | **27** total; **21** executable by `authenticated`, **0** by `anon` | Matches the 21 authenticated-callable function advisor warnings; these are review candidates, not 21 proven exploits |
| Private SECURITY DEFINER functions | **66** total; **43** executable by `authenticated`, **0** by `anon` | Private helper execution policy and schemas require separate API exposure/capability review |
| Explicit function search_path | **93/93** public+private SECURITY DEFINER | Fixed search_path is present, but not a sufficient authorization proof |

This is a snapshot of catalog metadata from live queries, **not** an exhaustive adversarial user simulation. Count of `SECURITY DEFINER` includes trigger/helpers; only public `authenticated`-callable functions are the 21 directly reported API-exposure warnings.

## Source-level sample (not an authorization penetration test)
- Six `public.admin_*license*`/user-capacity mutators inspected via `pg_get_functiondef` enforce `public.is_admin()` and validate inputs. The checker itself relies on `auth.uid()` and `public.profiles.role='admin'`. A compromised global admin role or missing tenant constraints elsewhere is **not** ruled out by source review.
- Sampled `public.organization_create_invitation`, `organization_accept_invitation` and `office_refer_correspondence_v2` include `auth.uid()`, organizational ownership/capability checks and membership checks. Real two-identity negative tests remain mandatory.
- Supabase security advisor flags `rls_enabled_no_policy` for three private office-workflow tables and `auth_leaked_password_protection` as a separate warning. Warnings are actionable review inputs; enabling protection or changing RLS/Auth configuration requires explicit owner approval.

## Executable repeatable read-only check
File: `supabase/tests/phase1_permissions_readonly.sql`. It reads only `pg_catalog`, `has_table_privilege`, and `has_function_privilege`. Status `PASS` means the listed *metadata contract* holds, `FAIL` means drift/violation needing investigation, and `REVIEW` is intentionally not a failure or a vulnerability claim. It does not query real tenant tables, authenticate users, or mutate data.

Expected initial run: `PUBLIC_ALL_RLS PASS (18/18)`; `PRIVATE_NO_CLIENT_DIRECT_READ PASS (0 of 10)`; `PUBLIC_DEFINER_NO_ANON_EXEC PASS (0 of 27)`; `DEFINER_EXPLICIT_SEARCH_PATH PASS (93/93)`; `PUBLIC_AUTHENTICATED_DEFINER_REVIEW REVIEW (21)`; `PRIVATE_RLS_COVERAGE_REVIEW REVIEW (3/10)`. Counts reflect this deployment and should not be hard-coded as invariants.

## Production migration archive discrepancy, held for review
- Live migration `20261007165208 phone_identity_profile` is recorded in Supabase.
- Current `main` has **no** archived file for that operation; stale [PR #58](https://github.com/davoodmehraban89/Factor-easy/pull/58) includes `supabase/migrations/20261007163500_phone_identity_profile.sql`, a *different migration timestamp*, bundled with historical admin/frontend/Auth changes and presently unmerged. **No proof of SQL-body parity**, and **no authority** to rename, reapply or merge PR #58 unreviewed.
- Required next audit: recover verified executed SQL text/metadata from appropriate production migration source and compare exact semantics/recorded ledger version to PR archive offline. Do not execute historical DDL against production.

## Acceptance boundaries / next safely executable slices
1. Independently check all 21 public authenticated-callable SECURITY DEFINER functions for authorization, organization ID spoofing, parameter validation and search_path; classify each with evidence.
2. Build isolated two-user read-only/negative tests for tenant separation, offboarding/revocation and access to invitation/office/request functions; **requires separately authorized durable test users**. Never use live production financial rows for disposable tests.
3. Verify recovery/backup in isolated approved scope and reconciliation of 82 live migrations against repository archives. Password-leak protection, Auth/RLS/role/schema changes and privileged probes require separate approval.
4. Continue independent Phase 2 accounting invariant review after approved Phase 1 contracts; do not authorize historical cutover or financial writes yet.

**No runtime change, database migration, Auth/RLS/grant change, new users, or financial record mutation in this slice.** Rollback of deliverables is a docs/test-file-only revert. F0-01, Phase 0 and overall Phase 1 acceptance remain OPEN.

## Independently executed SQL fixture — observed results (same day)
The repository SQL file `supabase/tests/phase1_permissions_readonly.sql` was **fetched back from the Phase 1 branch** and executed using the authorized production Supabase connector's read-only SQL operation. It returned **4 PASS, 2 REVIEW, 0 FAIL**:

| Check ID | Result | Actual output |
|---|---|---|
| `PUBLIC_ALL_RLS` | PASS | 18/18 |
| `PRIVATE_NO_CLIENT_DIRECT_READ` | PASS | 0 of 10 have direct client SELECT |
| `PUBLIC_DEFINER_NO_ANON_EXEC` | PASS | 0 of 27 callable by anon |
| `DEFINER_EXPLICIT_SEARCH_PATH` | PASS | 93/93 |
| `PUBLIC_AUTHENTICATED_DEFINER_REVIEW` | REVIEW | 21 callable by authenticated |
| `PRIVATE_RLS_COVERAGE_REVIEW` | REVIEW | 3/10 enabled |

This audit does not inspect arbitrary RPC parameter exploitability, PostgREST exposed schema configuration, service-role access or real revoked-user session tokens. A healthy direct-privilege snapshot alone does not establish secure cross-tenant application behavior.

### Review roster of 21 public authenticated-callable routines
The live advisor's exact 21 names were matched against the live catalog's 21 public definer functions callable by `authenticated` and `pg_get_functiondef` was inspected **without executing any of them**.

- **Six license/admin mutators:** `admin_cancel_license`, `admin_extend_license`, `admin_set_company_limit`, `admin_set_license`, `admin_set_license_modules`, `admin_set_user_limit`. Their SQL bodies explicitly check `public.is_admin()`; inspect global admin lifecycle/tenant-scoped targeting with authenticated negative tests before accepting.
- **Two read predicates:** `has_active_license`, `is_admin`. The `is_admin` body binds to `auth.uid()`; `has_active_license` invokes private entitlement logic. These are not a proof that every downstream RPC rejects a revoked user.
- **Seven office RPCs:** `office_act_on_referral`, `office_archive_search`, `office_classify_correspondence`, `office_link_correspondence`, `office_mark_correspondence_read`, `office_refer_correspondence_v2`, `office_referral_work_queue`. Each sampled source includes an organizational entitlement/capability check; select cases reference `auth.uid()`. An attacker-controlled organization ID still requires real cross-tenant negative testing.
- **Five organizational/invitation RPCs:** `organization_accept_invitation`, `organization_capacity_summary`, `organization_create_invitation`, `organization_expire_invitations`, `organization_revoke_invitation`. Their definitions use private organization permission/entitlement predicates; the acceptance handler separately checks `auth.uid()` and token/email correspondence.
- **One identity RPC:** `update_my_identity_profile`. Source checks `auth.uid()` and updates the caller's own profile; cross-user mutation and username collision need isolated negative tests.

**Review outcome:** An explicit guard or search_path constraint was located in source paths, but **no routine is certified immune to parameter spoofing or privilege escalation** by this static exercise. These are **reviewed for source-level guard presence**, not safely pentested or resolved as warnings.

### Concrete PR #58 signup ordering incompatibility
The old PR #58 archive `supabase/migrations/20261007163500_phone_identity_profile.sql` defines `public.handle_new_user()` such that it inserts into `public.organization_members` **before** `public.licenses`. The **live production function**, independently read from `pg_get_functiondef('public.handle_new_user()'::regprocedure)`, inserts `public.licenses` **before** `public.organization_members` and explicitly documents the preceding seat-capacity trigger dependency. Therefore re-applying the old PR function as-is would risk undoing the 2026-10-12 signup safeguard. A fresh all-migrations replay may subsequently override the old function, but **order-specific correctness and historical migration parity are not demonstrated**. Do not merge/reapply old PR #58 as a blanket fix; extract and reconcile individual historical SQL bodies first under owner-approved migration procedure.
