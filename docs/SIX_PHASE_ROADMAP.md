# Current six-phase execution roadmap

Recovered on 2026-09-28 from the latest project conversation and confirmed
against the existing Phase 1/2/3 redesign modules. This restores numbering;
it does not expand scope or mark untested functionality complete.

Canonical repository: `davoodmehraban89/Factor-easy`; base branch: `main`.
Product: Finora / Factor Easy. Do not switch to Finora-Invoice or Aram.

| Phase | Scope | Current evidence/status |
|---|---|---|
| 1 | Application shell and UX | Implemented in repo; previous completion report exists; no new full device E2E |
| 2 | Accounting foundation, chart, hierarchical analytic dimensions | Implemented in repo; previous completion report exists; production enforcement not reverified |
| 3 | Double-entry accounting and treasury | IN PROGRESS; client defects reproduced and repaired; server and treasury acceptance gaps remain |
| 4 | Projects, contracting, contracts, deductions, guarantees | Future work; existing global project masters do not establish phase completion |
| 5 | Inventory, fixed assets, supplementary accounting | Future work; existing stock summaries do not establish phase completion |
| 6 | Professional reports, controls, reconciliation, migration, release | Future work; existing trial balance/CI do not establish phase completion |

## Acceptance discipline

- Each phase requires implementation, behavioral tests, fixes, retest and a
  persisted handoff. A document title or green source-string checks is not proof.
- Preserve existing operational documents and historical IDs; no silent backfill.
- Dimensions are user-defined, hierarchical, leaf-postable, and have required,
  optional or unavailable account rules. Depth is locked while values exist.
- Referenced/posting history must not be rewritten by CRUD, import, sync or API.
- Database atomicity, permissions and concurrency must be tested independently
  of browser guards before accounting is accepted for production.
- Do not start dependent phases by assuming the current Phase 3 blockers are closed.

Current recovery and safest next action: [handoff/LATEST_HANDOFF.md](handoff/LATEST_HANDOFF.md).
