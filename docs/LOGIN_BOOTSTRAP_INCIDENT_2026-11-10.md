# Login bootstrap incident — 2026-11-10

## Goal and observed boundary

Owner reports password login and connectivity buttons inert after HTML finishes loading, with the initial preparing-form message still displayed. The immediate task is to recover this path before returning to navigation utility placement and WP1. No new login screenshot was attached to this report.

Baseline remote main: `4416794682d29a17976c901d866d182627f63c29`. A fresh public Chromium visit from the execution environment completed bootstrap, enabled both buttons and recorded no JS error or failed resource. This does **not** reproduce the owner's network, authenticate their account or establish a service-wide outage.

The reproducible defect is dependency coupling: initial HTML deliberately disables controls; failure of the separate SDK or core/handler scripts prevents initialization. Diagnostics previously depended on core configuration and generated click handlers, so the recovery control could be inert at the same time.

## Repair

- Generated Pages carries the existing vendored SDK, recovery sanitizer and core in one content-versioned entrypoint. SDK client creation still follows recovery URL sanitization. No new dependency or provider configuration.
- Diagnostics binds independently before core/static handlers and reads only public publishable configuration. Unknown/private configuration fails before any request. It probes the actual content-versioned core (including its preload when the parser has not reached the script tag).
- Missing/execution-failed core and failed handlers produce fixed, credential-free error codes. A six-second incomplete-bootstrap message explains delay without pretending login succeeded. Late successful readiness clears the recovery action and retains typed input.
- A separately bound reload button calls `location.reload()`: no copied callback credentials, and pending recovery fragments survive until the sanitizer can consume them. A core fallback binds reload if the diagnostic script itself is unavailable.
- No automatic reload, password logging, Auth configuration change, customer record mutation, migration or financial behavior change.

## Verification ledger

- Three new failure scenarios initially failed against the old implementation: separate SDK unavailable, core unavailable, generated handlers unavailable.
- Focused generated/source browser run: **62/62 PASS**, including recovery ownership, reload, network timeouts, exactly-once synthetic password submission, healthy mobile/tall/short desktop hiding, recovery callback preservation and early versioned diagnostic probing.
- All 51 existing pre-browser/static/server/release commands passed before final review; syntax, diagnostic, static quality and release safety were rerun successfully after review corrections.
- Independent initial review found three P2 defects in the candidate (hidden CSS media scope, callback fragment loss, unversioned early probe). All three corrected and covered by browser assertions. Follow-up independent review could not run because its provider quota was exhausted; no independent final approval claimed.
- Earlier focused failures remain accounted for: fixed retained handler failure classification; updated fixture expectations for report version/probed core; replaced VM fixture with browser fail-closed private-key check. A Pages diagnostic fixture matched only a query-free Auth URL and left REST live; both endpoints are now explicitly mocked while retaining the 2.5-second limit and early-login assertions.
- Full canonical browser suite and exact-head remote CI/release: pending at this documentation checkpoint. Deployment identifiers and public artifact comparison belong in the linked release PR after they actually exist.

## Remaining work and rollback

Owner-device/ISP and real-account acceptance remain unverified. TinyFish is connected, but its profile listing currently records no signed-in factoreasy.ir session. Do not collect passwords in chat or infer authenticated acceptance from public/bootstrap tests.

After urgent release: move the module launcher above Logout into the topbar, and access administration below Logout into a discoverable authorized Settings entry. That navigation task is still planned, not implemented. Resume the separate WP1 graph-to-client adapter afterward, preserving financial release gates. PR193 addresses different account-hydration errors and remains separate.

Rollback: revert this frontend/build PR through normal protected release. No database rollback is involved.
