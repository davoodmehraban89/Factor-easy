# Password recovery implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task by task.

**Goal:** Users reset their own password through emailed recovery links, including links initiated by authorized managers.

**Architecture:** Reuse the existing Auth SDK/Edge entrypoint and authorization model. A small early IIFE owns public recovery state; a mockable Edge handler verifies manager scope and sends only to the server-resolved confirmed identity.

**Tech Stack:** Existing classic JS, Supabase JS, Deno Edge entrypoint, Node tests, Playwright; no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-25-password-recovery-design.md`.

## Global constraints

- Links only for every manager, per owner's explicit choice.
- Preserve normal PKCE, OTP signup, financial behavior, RLS/roles/grants.
- Canonical callback: `https://factoreasy.ir/?finora_recovery=1`.
- No production mail/password/configuration writes during implementation/testing.

## Review focus

- Invalid callback with another user's cached session must not change that user.
- Organization membership cannot authorize a global password takeover.
- Inactive or foreign roles/targets and failed lookups fail closed.
- Pending duplicate clicks and delivery failures cannot report false success.
- Strict-CSP early login readiness and normal onboarding remain intact.

### 1. Server recovery authorization

Files: `supabase/functions/admin-user-management/{index.ts,handler.mjs}`,
`scripts/admin-recovery-handler.spec.mjs`, existing provisioning contract.
Interface: `send_recovery` body carries `user_id` plus optional `organization_id`;
success returns `{ok:true}`, failure returns a bounded error code.

- [x] Write behavioral tests against the old handler and observe recovery RED.
- [x] Extract dependency-injected handler; preserve global-admin creation.
- [x] Implement scoped recovery-only action and reject legacy direct set.
- [x] Run all negative/compatibility tests GREEN; inspect secret-free responses/logs.

### 2. Public recovery and validated callback

Files: `js/password-recovery.js`, minimal `js/core.js` hooks, public `index.html`
controls, necessary cache/build assertions, `scripts/password-recovery.spec.js`.

- [x] Write failing request, callback-isolation and update-state tests.
- [x] Add early capture/session validation, neutral send UI and required new-password panel.
- [x] Keep recovery intent separate from readiness; handle reload and cancellation safely.
- [x] Pass focused tests against source and generated strict-CSP Pages.

### 3. Manager buttons and complete verification

Files: `js/admin.js`, `js/organization-rbac.js`,
`scripts/password-admin-ui.spec.js`, `.github/workflows/quality.yml`, continuity docs.
Interface: `finoraSendUserRecovery(userId, organizationId='')` invokes the Edge
action once, with existing client role guards plus fresh server authorization.

- [x] Add failing global/tenant UI tests for Auth UUID, role guards, duplicate sends and errors.
- [x] Add link-only buttons and shared localized sender with confirmation/pending/cooldown.
- [x] Integrate Node and browser suites into existing CI; preserve prior checks.
- [ ] Run static/Golden/browser, review full diff and exact remote CI; open scoped PR.
- [x] Record files/tests/NOT VERIFIED and concrete activation settings before production approval.

## Verified implementation checkpoint

- Full Quality browser command: **175/175 PASS** (150 existing +17 recovery +8 manager).
- Focused recovery:17/17 source and17/17 generated strict-CSP Pages; manager:8/8 source and8/8 generated Pages.
- 50 Quality pre-browser commands including45/45 server cases and Golden PASS; additional release-safety PASS.
- Independent current-diff security review: no remaining blocker; actual invalid-callback/account-switch/logout race RED cases were corrected.
- Runtime code is complete. Exact remote CI remains the publication checkbox above; no production activation or actual email/password acceptance has occurred.
- Activation instructions: `docs/PASSWORD_RECOVERY_ACTIVATION_2026-10-25.md`.
