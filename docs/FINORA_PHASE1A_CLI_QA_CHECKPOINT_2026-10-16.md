# FINORA Phase 1A — Supabase CLI QA checkpoint (2026-10-16)

## Scope and isolation
- Owner approved Phase 1A test-branch implementation and Supabase CLI testing only.
- Production Supabase ref `hcsixhqbyuhpshfwqpjx`: **read-only SELECT/catalog/aggregates only**. No Production DDL, DML, migrations, history repair, or 1B.
- Protected main baseline SHA `bccd474433b4188e43aae345773498ea6fc65209`; unmerged work solely on `feature/finora-phase1a-supabase-cli-20261016`.
- Source migrations previously applied remain unrenamed. CI normalizes terminal literal backslash-n in its *ephemeral checkout only*.

## Verified isolated CI evidence
**GitHub Actions run 38889304877: completed SUCCESS.**
https://github.com/davoodmehraban89/Factor-easy/actions/runs/38889304877

- Full Supabase CLI Docker stack booted; auth/role/RLS integration available.
- Production fingerprint snapshot: 1069 catalog objects. Repository baseline after one idempotent phone-identity compatibility bridge: 1069 objects.
- SQL-function definition comparison: 154 functions; previously reported 30 formatting/comment-sensitive hashes were reconciled by lexical token comparison preserving quoted SQL string contents. Non-function catalog object identities and hashes matched. This is schema *baseline* matching, not a claim that production is updated to Phase 1A.
- Red-before-fix: 11/11 original test scenarios failed (10 unauthorized financial operations accepted, plus 2-arg sync ambiguous).
- After Phase 1A migrations: 11/11 passed (10 forbidden operations blocked with FINORA errors, 2-arg legacy sync operational).
- CAS test: create version 1, update version 2, reject stale version, preserve winner, reject cross-tenant write — PASS.
- Synthetic 1000 postings plus 1000 compensating reversals; 2000 posted vouchers / 4000 lines; aggregate accounts net zero — PASS.
- 10,000 vouchers / 20,000 journal lines index benchmark — PASS; one exemplar scoped lookup execution time ~0.037 ms on GitHub-hosted disposable DB (not a production latency measurement).
- JavaScript syntax check of `js/sync.js` — PASS.
- Existing 2-arg and 3-arg legacy sync signatures remain distinguishable; new `finora_sync_records_v2` uses expected_version. Sunset coded 2027-02-01 in test branch.

## Important NOT VERIFIED / release blockers
1. Browser-side journal UI `js/journal-engine.js` still constructs `status:'draft'` and `number` on direct client draft creation and changes `status/postedAt` via `saveDatastore()`, while Phase 1A DB rejects these fields on authenticated writes. A green adverse-write test **does not prove the legitimate journal creation/posting workflow**. Requires explicit authorized server-side workflow RPC and real non-production UI integration proof; never try CRUD in Production.
2. Rollback/up–down–up preservation of actual prior records has **not been executed yet**; synthetic transaction rollbacks for test data are not the same.
3. Actual concurrent multi-session races and two-actor browser flows with a hosted staging URL are NOT VERIFIED. JS `sync.js` only passed syntax, not end-to-end compatibility and merge/reload UX.
4. Need independent SECURITY DEFINER search_path, function EXECUTE grants, anon denial, direct PostgREST bypass and tenant-bound behavior audit across all new SQL functions.
5. Benchmark alone does not demonstrate performance under production-size data or realistic multi-tenant load.
6. Historic anomaly report is still required as read-only aggregate.
7. Root `main` and Production must remain untouched until later explicit release permission.

**Acceptance status: IN PROGRESS / not production ready. Phase 1B not started.**
