# FINORA — Phase 1A isolated Supabase CLI QA checkpoint
Date: 2026-10-16. No Production DDL/DML and no Phase 1B.

## Exact environments and evidence
- Repository: `davoodmehraban89/Factor-easy`; protected main at baseline `bccd474433b4188e43aae345773498ea6fc65209`; all 1A work isolated on `feature/finora-phase1a-supabase-cli-20261016`.
- Supabase Production ref `hcsixhqbyuhpshfwqpjx`: **SELECT-only catalog and aggregate queries**, no migration/history repair, no app data writes, no RLS/grant changes.
- Final Production read-only verification: **608 records, 82 applied migrations, 0 records.version columns, 0 finora_sync_records_v2 functions, 0 phase1A record triggers, 0 finora_post_event functions**. This work did not alter Production.
- Isolated Supabase CLI 2.121.0 boots full Postgres/Auth/PostgREST/RLS stack in GitHub-hosted Docker; no remote project linked.
- Legacy previously applied source migrations **not renamed or altered**; CI corrects literal trailing `\\n` *in its ephemeral checkout only*. The repository history and Production migrations are not repaired or rewritten.

## Required source-versus-Production baseline schema categories
- Original strict version-ID differences: 25 Production-only vs 24 repo-only; mostly retimestamped versions; see `docs/FINORA_PHASE1A_MIGRATION_VERSION_DIFF_2026-10-16.md`. Do not auto-repair ledger or infer schema drift from ID mismatch.
- **(A) Numbering differences**: 23 same-named migrations with different timestamp versions, plus other historical duplicate-version/name cases recorded in the migration diff manifest. Names alone are not proof of bytewise migration equality.
- **(B) Production-only schema objects before bridge**: `public.profiles.phone`, `public.profiles_phone_unique`, `public.update_my_identity_profile(text,text)` and its function grants. Reconstructed by *one idempotent, repository-only* phone identity compatibility bridge, never applied to Production.
- **(C) Repository-only pre-1A baseline objects after phone bridge**: none in the 1069 app catalog objects compared. After **new** 1A migrations are applied in disposable DB, new objects of course exist locally but not Production; do not mistake intentional pending changes for historical drift.
- Scope of catalog snapshot: `public`, `private` and noninternal `auth.users` custom triggers; relations, columns, constraints, indexes, functions, triggers, RLS policies and relation/function grants.
- **Full Supabase CLI baseline parity PASS**: 1069 Production versus 1069 local objects, same nonfunction object hashes; 154 out of 154 function bodies had identical lexical token sequences after ignoring SQL comments/formatting while **preserving quoted SQL literal contents**. Function security flags, signature, volatility, config and grants consistent. Raw `pg_get_functiondef` hashes differed for 30 functions (29 formatting candidates and one comment-only `private.request_transition_instance`); proved equivalent by lexical comparison.
- Baseline successful run: https://github.com/davoodmehraban89/Factor-easy/actions/runs/38889304877

## TDD and security coverage that PASSED in disposable Supabase
- **RED before guards**: 11/11 regression scenarios were failing (10 malicious writes accepted and old 2-arg sync overloaded dispatch ambiguous).
- **GREEN after guards**: 11/11 passed; unauthorised post/status/number/postedAt, child and dimension INSERT under posted, cross-organization parent reference, negative/fractional/string/null JSONB Rial amounts were rejected with FINORA-specific errors. Legacy two-argument RPC callable again.
- Server-side **deferred invariant** independently passed four tests: reject posted INSERT with no lines; reject draft→posted with only one line; reject unequal two lines; **accept** balanced two-line posting.
- CAS version workflow, stale expected_version rejection, winner preservation, and cross-tenant auth test — PASS.
- Synthetic **1,000 postings + 1,000 compensating reversals**, 2,000 posted vouchers, 4,000 lines and zero account net — PASS.
- **10,000 synthetic vouchers, 20,000 journal lines** index benchmark — PASS. Example scoped lookup `EXPLAIN ANALYZE` ~0.037 ms in runner only; not a Production performance guarantee.
- Five private 1A functions checked: **zero** `SECURITY DEFINER` search_path failures and **zero** anon EXECUTE privilege leaks. Authenticated sync-v2 grants also checked — PASS.
- **Up → non-destructive down → up**: old legacy overloads restored from read-only Production function bodies in disposable DB; phase1A triggers and v2 removed/reapplied. Synthetic record payload and version **2** survived; subsequent update correctly reached version **3**, then test transaction rolled back. Expand-only rollback intentionally retains records.version and call-count data to avoid data loss.
- JS `sync.js` syntax — PASS.
- Green rollback/deferred/security run: https://github.com/davoodmehraban89/Factor-easy/actions/runs/38890548772
- Read-only Production aggregate leakage precheck on 608 records: zero rows with missing owner membership, zero cross-org duplicate logical owner/collection/id keys, zero cross-org journal-child parent references. **This is not proof that every API path is leak-free.**

## BLOCKER: positive legacy JavaScript client compatibility is RED (release-blocking)
**Latest exact-sha run 38891056286 FAILURE**: https://github.com/davoodmehraban89/Factor-easy/actions/runs/38891056286

Three *legitimate* scenarios tested with role `authenticated` and real Supabase RLS:
1. Existing browser-created draft with `status:'draft'` and client-chosen `number` — **FAIL**, `FINORA_SERVER_ONLY_JOURNAL_FIELDS`.
2. Same batched voucher + journalLines — **FAIL**, `FINORA_CHILD_PARENT_NOT_FOUND`. The versioned sync currently orders by collection text, causing journalLines to be inserted before journalVouchers.
3. Existing `jePost` browser mutation to `status:'posted'`/`postedAt` — **FAIL**, `FINORA_SERVER_ONLY_JOURNAL_FIELDS`.

These failures correctly prove that the server security checks work but current manual/source journal UI would be broken if Phase1A were deployed as-is. **Do not loosen DB guards to force a green test.**

Further user-visible and security release blockers:
- Introduce **Phase1A-specific server-authorized draft/create, post and reversal action contracts**, with organization entitlement checks, version CAS, atomic parent→line→dimension ordering, and safe server-owned number/status/timestamps. Do not implement Phase1B gapless numbering, fiscal-source locking, audit hash chain, or `finora_post_event`.
- Update `js/journal-engine.js` and all synchronous callers in `js/journal-ui.js`, `js/phase4-contracting.js`, `js/phase5-enterprise.js`, and source posting flows, so the browser cannot directly write protected fields. Never display a premature save/post success.
- Replace blind conflict reset with clear Persian **compare / reload / merge** UX that preserves unsaved edits safely; verify non-owner org members and real multi-session concurrent writes.
- Test full PostgREST HTTP dispatch for two legacy overloads and new RPC; add source status bypass and direct CRUD tests. The existing psql `SET ROLE` tests exercise real database roles/RLS but are **not HTTP browser E2E**.
- A separate hosted **staging app pointing only to disposable/non-Production Supabase** is required before TinyFish write tests. TinyFish Production session has been inspected read-only only.
- No PR merge, Production rollout, Phase1A acceptance or Phase1B work until all blockers fixed, retested and separately authorized where necessary.

## Files (major)
- `supabase/migrations/20261007170000_phase1a_phone_identity_compat_bridge.sql`
- `supabase/migrations/20261016100000_phase1a_server_journal_invariants.sql`
- `supabase/migrations/20261016100500_phase1a_optimistic_version_sync.sql`
- `js/sync.js`
- `.github/workflows/phase1a-supabase-parity.yml`
- `scripts/phase1a-adversarial-red.mjs`, `scripts/phase1a-deferred-posting-test.mjs`, `scripts/phase1a-positive-client-contract.mjs`, `scripts/phase1a-classify-function-drift.mjs`, `scripts/phase1a-lexical-compare.mjs`
- `supabase/tests/phase1a_cas_rls_behavior.sql`, `phase1a_property_1000.sql`, `phase1a_10000_voucher_index_benchmark.sql`, `phase1a_security_grants.sql`, `phase1a_rollback_up_down_up.sql`, `phase1a_restore_legacy_sync_for_rollback.sql`, and non-PII schema/function fingerprint fixtures.

**STATUS: Phase1A isolated DB regression PASS; existing-client integration FAIL; release/production STOP. Phase1B not started.**
