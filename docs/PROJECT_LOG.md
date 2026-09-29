# Project log

## 2026-09-28 — Connection recovery and live server audit

User authorized ongoing commits/pushes and relevant tool use without repeated
permission questions. GitHub identity and PR #6 were verified. Both GitHub and
Supabase plugins are already installed; no extra connector was needed for reads.

Correction: the earlier access blocker was inferred from an incomplete project
list. Direct lookup of `hcsixhqbyuhpshfwqpjx` and metadata SQL succeeded. Its
organization differs from the organization returned by list discovery; the reason
for the inconsistent results is unknown. This does not prove an OAuth change.

Observed SQL role: `supabase_read_only_user`; transaction read-only; no CREATE on
public. No write/DDL, role escalation, production mutation or credential extraction
was attempted. Phase 3 collection migration and owner/license RLS are verified.
No server accounting validation trigger, ledger uniqueness index or public
transactional accounting RPC was found. An executable metadata-only audit query
and evidence report are included; no customer rows or identities are published.

Next: use a writable development environment for transactional server work,
then verify concurrency, rollback and authenticated E2E before production rollout.
Dependency graph configuration remains a separate repository administration issue.
See docs/PHASE_3_CONNECTION_AUDIT.md; the old unavailable statement below records
the earlier conclusion and is superseded by this entry.

## 2026-09-28 — Phase 3 recovery

Owner: coordinating implementer. Independent integration QA and server/persistence
review performed by separate agents; final integration checks by the coordinator.

Input: user's contradictory handoff (unfinished Phase 3) versus baseline
`8761d21189d9c4058c3019ea6e42d4103fc83556` completion report.

Decision: reopen Phase 3; recover the approved six-phase sequence; repair
reproducible client defects without production financial-data writes.

Result: 55 behavioral tests pass. Baseline tests only checked source strings and
missed operational defects. Tests cover actual ledger arithmetic, rollback,
source versioning, dates, import guards and form integration. Full server E2E is
not implied. Reviewer's final full-diff verdict was interrupted by a usage limit.

Files: journal engine/UI, accounting-foundation rule guard, operational source
handlers, sync import/backup, cache versions, CI behavioral gate, test fixtures,
current roadmap/status/handoff documentation.

Scope exclusion: no rewrite of the ERP, no new Phase 4-6 implementation, no
production migration, no change to auth/RLS or public release acceptance.

Historical blocker (corrected above): configured project absent from list discovery.
Historical next step: reconnect exact project, verify database rules and implement/test server
transaction boundary before phase acceptance. Continue complete cheque accounting
and authenticated E2E after that boundary is established.
