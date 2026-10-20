# Phase 1A — Migration identifier diff (read-only)

Source baseline `main@bccd474433b4188e43aae345773498ea6fc65209`; Supabase migration history on 2026-10-16. **Filename/version mismatch only:** matching normalized migration names may have equal or unequal SQL content; this report is NOT a complete resulting-schema diff. No production DDL/DML.

- Repo migration files: **81**; Production migration entries: **82**.
- Prod entries missing by exact filename in repo: **25**.
- Repo filenames absent by exact version in Prod history: **24**.
- Confirmed unique-name extra: Production `phone_identity_profile`; repo `iran_enterprise_control_collections`. Production also contains duplicate-name migration entries for several workflow guards.

## Production history entries absent from tracked files

1. `20261001184454_request_workflow_d1_foundation.sql`
2. `20261001184503_request_workflow_d1_transition_evidence.sql`
3. `20261001184545_request_workflow_d1_rpc_security.sql`
4. `20261001185325_request_workflow_d1_revision_qualification.sql`
5. `20261001190938_request_workflow_d2_legacy_cutover.sql`
6. `20261001191221_request_workflow_d2_fk_indexes.sql`
7. `20261001192215_request_workflow_d3a_step_runtime.sql`
8. `20261001192230_request_workflow_d3a_security_hardening.sql`
9. `20261001193827_request_workflow_d3b_conditions_timeline.sql`
10. `20261001195413_request_workflow_d3c_operations.sql`
11. `20261001195424_request_workflow_d3c_escalation_conflict_fix.sql`
12. `20261001195459_request_delegation_to_user_fk_index.sql`
13. `20261001215549_request_wave1_legacy_transition_guard.sql`
14. `20261001215557_request_wave1_legacy_transition_guard.sql`
15. `20261001225044_request_wave2_integrity_hardening.sql`
16. `20261002034311_request_workflow_d4a_work_queue.sql`
17. `20261002063121_request_wave2_duplicate_code_guard.sql`
18. `20261002063123_request_wave3_decision_idempotency.sql`
19. `20261002063523_request_wave2_duplicate_code_guard.sql`
20. `20261002063530_request_wave3_decision_idempotency.sql`
21. `20261002072526_request_wave4b_scheduler_outbox_delivery.sql`
22. `20261002075156_identity_wave5a_bootstrap.sql`
23. `20261003033540_request_wave4_operational_integrity.sql`
24. `20261007165208_phone_identity_profile.sql`
25. `20261012075507_fix_identity_bootstrap_license_before_membership.sql`

## Tracked repo files absent by exact filename from Production history

1. `20260929222000_iran_enterprise_foundation_collections.sql`
2. `20260930222500_iran_enterprise_control_collections.sql`
3. `20260930223000_iran_enterprise_financial_controls.sql`
4. `20261001204500_request_workflow_d1_foundation.sql`
5. `20261001205500_request_workflow_d1_transition_evidence.sql`
6. `20261001210500_request_workflow_d1_rpc_security.sql`
7. `20261001211500_request_workflow_d1_revision_qualification.sql`
8. `20261001223500_request_workflow_d2_legacy_cutover.sql`
9. `20261001224500_request_workflow_d2_fk_indexes.sql`
10. `20261001230000_request_workflow_d3a_step_runtime.sql`
11. `20261001230500_request_workflow_d3a_security_hardening.sql`
12. `20261001233000_request_workflow_d3b_conditions_timeline.sql`
13. `20261001235500_request_workflow_d3c_operations.sql`
14. `20261002000500_request_workflow_d3c_escalation_conflict_fix.sql`
15. `20261002001000_request_delegation_to_user_fk_index.sql`
16. `20261002010000_request_wave1_legacy_transition_guard.sql`
17. `20261002023000_request_wave2_integrity_hardening.sql`
18. `20261002033000_request_workflow_d4a_work_queue.sql`
19. `20261002070000_request_wave2_duplicate_code_guard.sql`
20. `20261002071000_request_wave3_decision_idempotency.sql`
21. `20261002072000_request_wave4_operational_integrity.sql`
22. `20261002073500_request_wave4b_scheduler_outbox_delivery.sql`
23. `20261002080000_identity_wave5a_bootstrap.sql`
24. `20261012080000_fix_identity_bootstrap_license_before_membership.sql`

**Required before migration:** rebuild the full authenticated Supabase stack from tracked sources; reconcile missing historical phone migration and timestamp aliases without re-applying financial changes; compare actual table/function/trigger/policy/grant catalogs with a reproducible schema-only diff. Stop is mandatory until owner approves continuation after this discrepancy report.
