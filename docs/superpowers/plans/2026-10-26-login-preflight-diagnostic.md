# Login preflight comparison implementation plan

> For agentic workers: use superpowers:executing-plans for the single implementation task; QA and final review may run independently. Steps use checkboxes for actual progress.

**Goal:** Distinguish a successful simple project-health response from failed ordinary headered probes on the affected PC without changing login.

**Architecture:** Extend checkAuthConnectivity in the existing small classic script. Use the same endpoint/public configuration, five concurrent bounded reads and a fixed privacy-safe report. Existing status branches retain authority.

**Tech Stack:** Classic JavaScript, existing HTML/CSP build and Playwright; no dependencies.

**Spec:** docs/superpowers/specs/2026-10-26-login-preflight-diagnostic-design.md

## Global constraints

No account/password/mail/financial operation, production SQL/Auth/DNS/RLS or dependency change. No authentication bypass or no-cors authentication. Separate12-second deadlines and existing duplicate guard remain. Supplementary success never proves ordinary login. Never expose configured keys, identities, bodies, tokens or raw errors in the report.

## Review focus

1. Supplementary200 with ordinary failure remains failed.
2. Supplementary failure cannot break healthy ordinary probes.
3. Query/error/input sentinels cannot enter the report.
4. Offline/new checks cannot leave an old healthy report.
5. Non-publishable keys cannot enter a supplementary query.

## Task1 — diagnostic and delivery

Files: js/login-connectivity.js; index.html cache tags; scripts/login-connectivity-check.mjs existing cache assertions; scripts/login-connectivity.spec.js; PROJECT_STATE.md and these two documents.

- [x] Add five behavioral regressions for the review focus and query correlation; adjust only URL-routing patterns for new query strings.
- [x] Execute the focused new tests against unchanged runtime; require meaningful RED, no actual network/account request.
- [x] Extend checkAuthConnectivity with id/time/durations, five fixed probes, public-key-only simple request and sanitized report. Keep all real Auth/REST flows unchanged.
- [x] Version diagnostic delivery and its self-probe; update existing cache checks.
- [x] Run focused source and generated strict-CSP suites, existing full Quality command and51 checks including Golden/server/release safety. Inspect every result.
- [x] Obtain independent whole-diff privacy/status review; correct demonstrated defects and rerun affected checks.
- [ ] Update PR183 title/body around final scope, publish exact tested tree, verify exact-head CI, normal protected merge and exact-main/gated Pages, then actual public diagnostic readback.
- [ ] Record NOT VERIFIED affected-PC result/actual login and keep Issue106 open; never infer connectivity repair from this diagnostic release.
