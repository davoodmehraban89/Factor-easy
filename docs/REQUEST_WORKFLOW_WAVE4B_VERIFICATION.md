# Request Workflow Wave 4b Verification

Status: **MERGED / HISTORICAL CI VERIFIED / LIVE MIGRATION RECORDED / EXTERNAL CONSUMERS NOT VERIFIED**.

## 2026-10-12 read-only live reconciliation (Phase 0 F0-08)
- Historical implementation [PR #27](https://github.com/davoodmehraban89/Factor-easy/pull/27) merged at `41aff95d11a66c67e2c64df3eac11a122f94dfd7`. Historic PR Quality `36975854976`, Security `36975855052`; protected-main Quality `36975968198`, Security `36975968108`, Release `36976087514`, gated Pages `36976115600` are recorded in the original unmerged [PR #28](https://github.com/davoodmehraban89/Factor-easy/pull/28) evidence. These describe that historical SHA, **not** a fresh 2026-10-12 live workflow acceptance test.
- **Unlike the historic PR #28 claim that the production migration was not yet applied**, the Supabase project `hcsixhqbyuhpshfwqpjx` migration ledger **now** includes `20261002072526 request_wave4b_scheduler_outbox_delivery`. Independent read-only live PostgreSQL catalog queries confirm `private.request_run_sla_scheduler`, `private.request_claim_outbox`, `private.request_complete_outbox`, `private.request_fail_outbox` and their public RPC entrypoints. This verifies schema/function presence on 2026-10-12; it does not identify when consumer adapters became active or show successful real-world delivery.
- **D4c destination adapters / external outbox consumer processing, real scheduler scheduling and actual target-system delivery remain NOT VERIFIED.** Their activation requires an authorized scoped integration and deduplication check using `destination_command_key`; do not infer this from the migration ledger.
- Safe disposition: archive unique useful historic QA evidence here, do not merge the stale PR #28's false current-production status into main. No SQL, customer data or outbound messages changed in this reconciliation.


## Scope
- SLA escalation scheduler policy: five-minute schedule slots, server-authoritative clock, durable run identity, replay binding, bounded batches and row claims with `FOR UPDATE SKIP LOCKED`.
- Scheduler evidence: durable private run/run-item records plus system audit entries; no fake human actor is recorded.
- Outbox delivery contract: stable destination command key, lease-style claim token, stale-claim recovery, bounded exponential retry, dead-letter state, idempotent operator replay and dispatch evidence.
- Service worker entry points are not granted to `anon` or `authenticated`; production `service_role` grant is conditional at migration time.
- D4c destination consumers remain disabled. A real destination adapter must enforce the supplied `destination_command_key` before D4c can be called end-to-end verified.

## Clock / claim policy
The database server clock is authoritative. Scheduler callers provide only a five-minute schedule slot; slots too far from the server clock are rejected. A committed slot is unique per organization/job. Step claims use row locks with skip-locked semantics and only rows still active, due, and not already escalated can transition.

## Retry / replay policy
Outbox claims expire after ten minutes. Delivery attempts are capped at five; retry delay is server-derived exponential backoff capped at one hour. The fifth failed attempt enters `dead_letter`. Authorized workflow configurators can replay a dead letter with an idempotency key; the stable destination command key is never regenerated.

## Verification gate
Disposable PostgreSQL assertions cover scheduler replay/slot/clock behavior, escalation evidence, stable command identity across retries, stale-claim rejection, retry scheduling, dead-letter transition, replay idempotency and audit dedupe. The migration and scheduler/outbox SQL functions are now present on production (as independently read-only verified 2026-10-12); external destination consumers, scheduling operations and real deliveries remain NOT VERIFIED without separate execution and end-to-end proof.
