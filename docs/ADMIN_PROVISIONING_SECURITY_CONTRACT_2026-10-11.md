# Finora central administrator direct provisioning — security and acceptance

**Owner request (2026-10-11):** A verified system owner/admin can create a **standard** user from the central users/licenses panel **without prior self-registration**, then assign the license from the same admin list.

## Existing infrastructure checked (read-only)
- Live Supabase Finora project `hcsixhqbyuhpshfwqpjx` has trigger `auth.users.on_auth_user_created` executing `public.handle_new_user()` (verified in database read-only). It inserts a `profiles` row with `role='user'`, creates a personal organization/membership, and creates a **trial** license. No migration required for basic email-based provision.
- Already-existing ELI-3 `organization_create_invitation` is separate: it lets a company invite an existing/new account as a *member*, not centrally create credentials. This feature must not impersonate it or silently add cross-organization access.
- Stale PR #58 proposes an admin identity function but cannot be merged as-is; we implement an independently scoped, read-only-admin/role-validated minimal email path.

## Contract and threat boundaries
1. **Caller:** must possess a valid Supabase Auth JWT, verified by `auth.getUser(token)`. JWT verification is enabled at Edge infrastructure **and** the handler verifies current user.
2. **Authorization:** server service-role client reads current caller's `public.profiles.role`; only `admin` can provision. An arbitrary client role flag or request-specified role cannot elevate privileges. The admin cannot choose `admin` as a new account's role.
3. **Secrets:** `SUPABASE_SERVICE_ROLE_KEY` is exclusively read within the Edge runtime; no browser code, static HTML, network response or console log exposes it. CORS origins restricted to `https://factoreasy.ir` and `https://www.factoreasy.ir`.
4. **Validation:** only POST `action=create` accepted. Email required and validated (max 254). Optional username limited to 3–40 safe ASCII characters and full name max 120. Password length 12–128 with uppercase, lowercase, digit and symbol. No password is retained in browser form after request or echoed in response/log. Payload limited to 8 KB.
5. **Provisioning:** server calls `auth.admin.createUser` with `email_confirm:true`; Auth trigger provisions `role='user'` and default trial. Admin adjusts duration from existing license controls. No automatic outbound message is sent by this action; the owner must share initial credentials via a secure, authorized path. User should change password on first sign-in. Initial credential change is a **user instruction**, not a backend-enforced prerequisite in this slice.
6. **Failure:** unauthorized 401, insufficient role 403, bad input 400, wrong method 405, missing server secret 503; no partial client-side profile insertion. Genuine API success and actual license trigger are separate from mocked browser tests.

## Required evidence before operational acceptance
- Isolated Chromium tests: admin form, valid submission, refusal for nonadmin, password clear; invalid email/weak secret no network call. **PASS 2/2 remote Chromium on branch**.
- Static contract: verified Auth token, server role guard, server-only service key, no privilege escalation, password validation. **PASS remote Node**.
- GitHub Quality/Security exact head: must pass before release.
- After deployment: request **without Auth header returns 401**, plus valid non-admin token returns 403 and authorized admin creation of an owner-approved non-real/isolated test identity succeeds with correct ordinary role and trial license, followed by controlled cleanup. **These production-context tests are not yet completed; no actual user must be created without a specifically chosen identity.**
- Current scope excludes phone-only account provision, automated email sending, privileged administrator creation, forced first-login password change and deletion/deactivation workflows. They require further approved design and separate tests.

**Rollback:** revert admin UI PR; undeploy/disable `admin-user-management` Edge function if enabled. Existing user records should never be deleted automatically as part of rollback.
