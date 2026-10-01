# Request Workflow Wave 2 Verification — 2026-10-02

## Scope
F-411 server-side pinned-form value validation; F-413 date/select authoring and runtime fidelity; F-414 create-idempotency command binding; F-417 active/current version enforcement; F-418 schema-bound conditions and fail-closed no-match behavior.

## Durable implementation
- Main squash SHA: `7346910638b6ef9555d4adb5952dd62c8f4c130d` (PR #19).
- Archived migration: `supabase/migrations/20261002023000_request_wave2_integrity_hardening.sql`.
- Behavioral assertions: `supabase/tests/request_wave2_integrity.sql`.
- UI: `js/request-workflow-d2.js`, `js/request-workflow-d3b.js`.
- DOM coverage: `scripts/request-workflow-d2.spec.js`, `scripts/request-workflow-d3b.spec.js`.
- Quality workflow applies the Wave 2 migration in disposable PostgreSQL before D3b/D3c downstream assertions.

## Verification evidence
- PR Quality run `36937247798`: SUCCESS. `d1-request-database` applied the Wave 2 migration and executed all negative assertions successfully. Static-quality passed all accounting behavior checks and the Golden accounting journey, then Playwright completed 37/37 real-DOM tests.
- PR Security run `36937247803`: required `Release and QA safety invariants` and `CodeQL JavaScript` passed. Dependency review still fails on PRs because the GitHub Dependency graph is disabled; this remains an external repository-setting boundary and is not a required protected-main check.
- Main Quality run `36937448157`: SUCCESS.
- Main Security run `36937448101`: SUCCESS.
- Exact-SHA Release gate `36937598497`: SUCCESS for `7346910638...`.
- Gated Pages run `36937616201` was queued at closeout-document creation and must not be called successful until GitHub reports success.

## Production database
Target: Supabase project `hcsixhqbyuhpshfwqpjx` (Finora).
- Applied through the Supabase migration API from the exact archived SQL after protected PR checks passed.
- Live migration history records `20261001225044 request_wave2_integrity_hardening`.
- Read-only/procedural production verification confirmed valid number/date/select payload validation, rejection of string-as-number, rejection of unbound condition fields, and the deployed create function contains command-conflict, latest-version and no-applicable-step fail-closed contracts.
- Existing production request definitions were inspected before deployment: latest `INDENT` and `INVOCE` versions are active schemaVersion 1 definitions with empty fields, so the new validator is compatible with the current production definitions.
- Post-DDL Supabase security advisor showed no new Wave 2-specific finding. Existing private C8 no-policy informational notices, legacy authenticated SECURITY DEFINER warnings, and leaked-password-protection warning remain tracked boundaries.

## Acceptance result
F-411/F-413/F-414/F-417/F-418 are closed at code, disposable-DB, real-DOM, accounting-regression, security and production-database boundaries. The only closeout item still awaiting an external state transition at document creation is the gated Pages deployment run above.
