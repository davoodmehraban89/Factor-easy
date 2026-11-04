# WP1 rollout package — NOT READY / DO NOT APPLY

Production G1 is not requested. Stacked work depends on WP0 PR194 and unmerged historical source; no production SQL has run.

Candidate order is the eleven `2026101610*` archived Stage1–3 SQL files, followed by `*_wp1_ledger_scope_authority_hardening.sql`. The initial files are preserved for provenance and must never be applied partially: early guards are strict before later mode definitions. Final production packaging must prove a single transactional UP and all DOWN paths on a complete clone/local stack before approval. Source-derived WP0 fixture excludes unrelated workflow schemas; passing that fixture is not production schema parity.

Required before G1:

- Reconcile24/24historical migration-version drift by SQL content, and verify new columns/indexes/function contracts against the live catalog.
- Red/green tests for all corrective findings; actual concurrent posting;1000event trial balance; all suite and CI results at exact SHA.
- Conservative DOWN/UP for all11prerequisites pluscorrection is now locally proved:71baselinefunctiondefinitions/ACLs andbaseline triggers restored;4postedvouchers/10lines/10auditrows retained byhash; candidate APIs revoked, compatibleindexes/counters retained. Fresh exactheadCI andproductionparity remain gates. This is notpristineschema rollback.
- Capability-safe client candidate is locally tested; final CI and real-service integration remain. Correct purchase correction/cancel transaction; no successful toast without server acknowledgement. Until proven, no enforcement cutover.
- Per-source shadow report including fieldscope/currency/period checks, not only aggregate balance. Existing11posted vouchers had zero anomalies in the limited aggregate audit; that is not full cutover approval.
- Read-only encrypted backup and disposable restore proof (G3secret viaenvironment), ordered verification queries, owner-reviewable G1 checklist.

Do not automatically rewrite historical vouchers. Never enable enforcement merely because migration execution succeeded. No G2–G5 operation is needed for this disposable SQL checkpoint.

Rollback must coordinate the frontend and server: conservative SQL DOWN retains the version column but revokes candidate APIs. The new client deliberately refuses to downgrade a versioned snapshot; revert to the tested previous frontend when rolling the server back. Do not treat a SQL-only DOWN as a complete service rollback.
