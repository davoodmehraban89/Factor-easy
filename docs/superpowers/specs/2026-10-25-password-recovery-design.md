# Password recovery through user-owned links

The owner requested Forgot Password on login and assistance from user, license
and access administration. They explicitly chose **recovery links for every
authorized manager**: only the recipient enters the new password.

## Approaches and decision

Direct administrator password entry uses an existing global-admin Edge action,
but extending it to organization managers would permit taking over a global
identity shared by multiple companies. Global-admin direct reset plus company
manager links was offered; the owner instead selected links for all managers.
The unused direct-set action will reject requests; existing account creation
retains its existing global-admin-only contract.

## Scope and authorization

Add a link button in central users/licenses and in eligible active organization
member rows. The browser passes Auth user UUID and, for tenant administration,
organization UUID; membership UUID and company-record ID are different values.
Fresh server verification authorizes global profiles.admin, or an active actor
membership with is_owner or active core/full_suite configure grants. Assigned
roles and permissions must belong to that same organization and be active.
Tenant targets must be active members of that organization. Email is resolved
from the current confirmed Auth identity, never browser input or stale profile.
No role, grant, database policy, financial record or schema changes are needed.

Recovery sends through Supabase Auth's existing email delivery. The callback is
fixed at `https://factoreasy.ir/?finora_recovery=1`; no arbitrary recipient or
redirect input is accepted. Responses and audit logs contain no token, link,
password or email address. Existing Auth/provider limits remain authoritative;
browser pending/cooldown checks suppress accidental repeated sends.

## Login and callback behavior

Forgot Password validates email and presents an account-neutral result. Delivery
errors/rate limits use bounded Persian messages. The recipient gets a dedicated
new-password/confirmation panel with existing password-strength rules and no
optional password-skip action. Ordinary OTP onboarding stays separate.

The pinned browser SDK uses PKCE for normal authentication and rejects implicit
callback fragments in that mode. Preserve normal PKCE: the small early recovery
module captures genuine recovery fragments before createClient, scrubs them,
then calls the public setSession API after SDK initialization. Only a validated
recovery session enables password editing. A marker or an unrelated cached
session does not authorize recovery. A tab-local, nonsecret proof bound to the
verified user/session and a deadline may resume a consumed callback after reload;
fresh invalid callbacks discard that proof. No passwords or tokens are persisted
by the helper or logged. Successful update clears fields/proof and enters that
same verified account once. No tenant records load before password completion.

The request-only email sender uses an ephemeral implicit client with persistence,
refresh and URL detection disabled; this supports links opened in another browser
without changing normal OAuth PKCE. SDK requests use the existing bounded Auth
transport. Generated Pages retains local scripts and strict CSP.

## Verification and activation

Use meaningful offline handler tests and Playwright with production transport
blocked: permission spoofing, foreign/inactive membership/roles, recipient and
redirect injection, failed lookups, legacy direct reset rejection, ordinary
creation regression, callback races, invalid link with another cached account,
validation, duplicate submits, update failure and generated Pages.

Run existing static, Golden, browser, security and disposable-DB checks without
weakening expectations. Production Edge deployment, callback allowlist/SMTP and
actual mail delivery/password changes are separate activation/acceptance steps;
prepare concrete files/tests/settings first. No real mail or password change is
part of synthetic verification. Previous owner-ISP/real settings QA remains open.
