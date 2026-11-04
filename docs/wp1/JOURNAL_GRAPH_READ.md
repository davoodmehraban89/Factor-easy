# Journal graph read prerequisite

Candidate only; no production deployment or UI activation. Public API:

`finora_journal_read_graph(p_organization_id uuid, p_voucher_id text) -> jsonb | null`

The response contains `organization_id`, `voucher_id`, `effective_status`, and deterministically ordered `records` with `collection`, `id`, original `data`, and separate `version`. Only the requested voucher/lines/dimensions are returned. The original posted header remains posted and its revision is unchanged; effective status is derived from related posted reversal lines with the same aggregate semantics as the existing reversal-status view. It is display metadata, not a replacement for stored financial history.

The public function is STABLE SECURITY INVOKER with an empty search path, with PUBLIC/anon execution revoked. A missing or RLS-invisible header returns null, even if orphan child rows exist. One SQL statement and STABLE helpers use one snapshot. Materialized rows are reused for the derived status, avoiding repeated reads through the reversal view and records table. Aggregation returns a scalar JSON graph rather than independently paginated rows; the SQL fixture verifies1003 records in one response. Actual PostgREST/JWT and response-size/performance acceptance remain separate tests.

## Complete visibility, not partial financial data

Invoker RLS alone can reveal a header while hiding a confidential child or reversal. The private `finora_journal_graph_accessible` helper returns only a boolean. It requires `auth.uid()`, checks header permission, then uses the existing `private.can_access_record(...,'read')` predicate on all related voucher/line/dimension records, including reversals that contribute to status. It is STABLE SECURITY DEFINER with an empty search path, no PUBLIC/anon execution, no data/count return, and no writes. The public function still obtains every returned row through RLS.

If any related record is inaccessible, the public function raises `42501 FINORA_JOURNAL_GRAPH_FORBIDDEN`. Visible mismatched-company or malformed dimension/line/voucher links raise `23514 FINORA_JOURNAL_GRAPH_INVALID`; they are never silently omitted or normalized. This completeness helper follows the existing records policy predicate; any future records-policy changes require renewed completeness review/tests. It grants no new record permission.

## Verification and boundaries

- Baseline RED: endpoint absent, exact `WP1_GRAPH_RPC_MISSING` marker.
- Authenticated SQL tests cover draft/posted/partial/full reversal status, unchanged original header/revision, deterministic exact graph,1003-record graph, absent header/orphans, both directions of tenant isolation with colliding IDs, read-only member, suspended member, confidential child/reversal, anon denial, and four malformed graph relationships.
- Fixture-only malformed/large legacy records are seeded by the local superuser with user triggers temporarily disabled and immediately restored. Prior pending constraints are explicitly checked first; no production fixture is authorized.
- Initial fixture failures were a missing synthetic license seat and pending-trigger events before fixture ALTER; the fixture now provisions its explicit seats and checks constraints first. No application/license guard was weakened.
- The initial query repeatedly reread RLS-protected rows and was stopped during the large fixture. The candidate reuses materialized rows and computes the existing status semantics from them. No percentage performance improvement is claimed from an interrupted run. SQL probe timings are evidence only, not a production latency target.
- Dedicated UP/DOWN/UP passed: remove/recreate exactly the two functions with the same ACLs and preserve records/audit/counters/member permissions. Full16-migration conservative DOWN/UP passed and restores prior ledger APIs and financial history.
- Two actual SQL sessions confirm a reader whose snapshot begins before a concurrent commit returns the complete old header/lines; a fresh read gets the complete new revision/amounts. No application function/policy is patched in the positive test. A local-only VOLATILE mutant must fail the old-revision assertion, proving the regression is sensitive to snapshot semantics. Evidence: `evidence/graph-snapshot/`.
- Read-only probes leave records/audit/counters/members/permissions unchanged. One local run with other disposable tests running measured about7.04s for1003 records and3.35s for a posted graph in that same dataset. These are source-fixture SQL observations, not production benchmarks; latency/scaling acceptance remains open.
- Evidence: `evidence/graph-read/result.json`, `evidence/graph-read/read-only-probe.log`, `evidence/graph-read-regressions/result.json`. The regression selection explicitly excludes seeded1000; the published15-migration chain has separate full1000 proof, and the new exact-head CI must run the full suite again.

This prerequisite does not implement the manual form adapter, pending-edit-safe graph merge, atomic return-to-draft, purchase correction, dimension entity compatibility, or required/optional account rules. Independent SQL review remains open. See `MANUAL_RPC_NEXT.md` and `ROLLOUT_HOLD.md`.
