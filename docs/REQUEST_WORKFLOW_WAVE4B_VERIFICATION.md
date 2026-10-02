# Request Workflow Wave 4b Verification

Status: IMPLEMENTED ON BRANCH / CI PENDING

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
Disposable PostgreSQL assertions cover scheduler replay/slot/clock behavior, escalation evidence, stable command identity across retries, stale-claim rejection, retry scheduling, dead-letter transition, replay idempotency and audit dedupe. Production application and external destination consumers are NOT VERIFIED until separately executed.
