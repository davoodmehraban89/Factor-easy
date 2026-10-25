# Cold login investigation — 2026-10-24

Owner request: investigate the recurring slow login page, failed early password
attempts and the screenshot `SITE_JS_OK | MANIFEST_OK | AUTH_TIMEOUT | REST_TIMEOUT`.
Baseline: live protected main `bccd474433b4188e43aae345773498ea6fc65209`.
This repair is independent of navigation PR #174 and settings PR #175.

## Reproduced defects and corrections

| Defect proved on the baseline | Correction | Regression evidence |
| --- | --- | --- |
| Auth fetch's 12-second timer ended when headers arrived. The actual bundled SDK could then wait indefinitely for an incomplete JSON body. | Keep the deadline and upstream cancellation active through a cloned response body; return the original unread Response. Non-Auth requests retain their original streaming semantics. | Real SDK password operation with immediate headers and stalled body fails with a retryable transport error; expired-session refresh recovers; complete invalid-credentials response remains distinct. |
| An early successful password attempt spent the 25-second account-read deadline waiting for parser-blocking Pages bundles and the organization adapter. | Give workspace assets a separate bounded 45-second stage, then start the existing 25-second profile/company-read deadline. Keep the successful-auth progress message accurate. | Generated strict-CSP Pages with business/accounting downloads held for 26 simulated seconds remains pending, then opens once with the correct organization and lifetime entitlement. |
| Cached-session hydration did not own `authBusy`; early manual login could run a competing hydration. Password authentication could also start while SDK initialization still held up session-token reads. | Claim busy ownership during automatic entry; queue one manual click behind the shared initial session check. | Restored-session/manual overlap and a held initial session check each produce one profile/records hydration, without a second click or writes. |
| The 213 KB production extension bundle was only requested after DOMContentLoaded, after all blocking workspace groups. | Preload the identical content-hashed local bundle while those groups download; execution stays in the original dependency order. | Request observed before a held accounting bundle is released; exactly one request/execution and all 14 extensions complete. |
| Diagnostic classification checked a shared abort signal after all probes settled. An immediate network rejection became a misleading TIMEOUT when another probe later timed out. | Each probe owns its deadline and records its own outcome. Cancel unused response bodies after header evidence. | Immediate Auth/site-JS network failures retain their original codes when a different probe stalls. |

Failed or expired asset waits remain fail-closed: no partial financial workspace,
no profile or company read before readiness, and no late automatic entry after
expiry. After downloads recover, a fresh click succeeds. Missing required bundles
still show `BOOT_APP_ASSETS_FAILED`.

## Service observations and their limits

Read-only Supabase management metadata reported `ACTIVE_HEALTHY`. Read-only log
stream inspection covered the then-current 24-hour window; it did not query the
production Postgres database or customer records. Five password `/token` responses
were successful and two were HTTP 400 `invalid_credentials`. The failed responses
were in the 2026-10-23 18:00 UTC hour, along with four successful password responses;
one earlier successful response was in the 17:00 UTC hour.

The server logs do not identify which browser-side stage the screenshot captured.
They cannot establish that the two rejected attempts were the friend's attempts,
or distinguish an unknown account from a wrong password. A request that never
reaches the service cannot appear in its Auth logs. The screenshot is a transport
diagnostic, not a password check. No claim is made that the user's network is now
repaired or that waiting longer would make an invalid password succeed.

No real sign-in, Auth configuration change, SQL, migration, role/grant, RLS,
financial write, dependency change or production deployment was performed.

## Verification and release gate

The new failures were observed before their corresponding fixes. Local RED/GREEN
logs are `/tmp/finora-login-auth-transport-{red,green}.log`,
`/tmp/finora-login-diagnostic-{red,green}.log`,
`/tmp/finora-login-readiness-red.log`,
`/tmp/finora-login-assets-recovery-red.log`, and
`/tmp/finora-login-initial-session-red.log`.

Full-suite results and exact-head remote CI are recorded in `PROJECT_STATE.md`
and the associated PR description. Two new browser suites are explicitly included
in the existing Quality workflow; no existing assertion or accounting expectation
was relaxed. Independent read-only application/security review found no remaining
findings. Reverting this PR restores the previous client/build behavior.

**NOT VERIFIED:** cold login on the owner's/friend's actual ISP and browser;
the exact historical failed identity/request; real OTP/Google delivery;
physical printing; authenticated production concurrency. Issue #106 remains open.
Customer acceptance requires a released exact SHA and the affected-device check;
green synthetic tests alone do not close it.

## Authorized release continuation — 2026-10-25

The earlier no-deployment statement records the investigation checkpoint.
The owner subsequently authorized testing and protected release of both repairs.
After settings PR175, login PR176's strict up-to-date head
`b90e005bc20fa0d38dbe2d8ce8f46564fb9736cd` passed Quality40122904814:
**150 browser tests (2.9m)**, Golden Accounting and all three disposable
Postgres jobs. Security40122904736 passed CodeQL and release-safety checks;
conditional Dependency Review was skipped. PR176 merged without bypass as
`0ced2316f743817c9528152a0214656133323561`.

The fresh actual-browser run reached the login gate without credentials; no
real authenticated save/reload or logout/re-entry result is claimed.

Final main passed Quality40154558971 (**150 tests, 3.3m**, Golden and all three
disposable DB jobs), Security40154559079, Release gate40154827728 and
Pages40154873796. Public HTML and 13 relevant assets matched its fresh generated
build byte-for-byte, including the new core/diagnostic and extension preload.
An unauthenticated fresh-context public Playwright run in the cloud/proxy measured
form/session-check readiness at 543ms and full extension readiness at 817ms,
with no required-script failure or page error. No credentials were submitted;
no Supabase request or financial read/write was observed. This is cloud-browser
startup evidence only. Affected-device/ISP and real-account acceptance remain
pending; Issue106 stays open.
