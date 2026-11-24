# FIN-V2 live base manifest — 2026-11-24

Charter V2 fixed SHA: 85438788324ff507eb7305a78dca214fd118b752. Tracking: [#256](https://github.com/davoodmehraban89/Factor-easy/issues/256). Candidate QA only; no merge, release, hosted DB or migration application.

- mainSHA: `dab1a45fcfc4f12e675cfe055e477138cd3e99fa`
- selectedBaseSHA: `98cb670f6d9f03900ce644efdf43df36127e30f8` (PR253; Quality 45352284249, WP1 45352284056, WP2 45352284208, Security 45352284210 all successful; **not accepted for release**).
- repairParentSHA: `99dae75b4b4f7a85ecbccacb5cafc4c2f7aac230` (PR254; Quality 45353885622 failure, WP1/WP2/Security successful). B03 work preserved; do not restart at 234 or 250.
- verified ancestry PR234→251→252→253→254→C01 design; consecutive ahead counts 3,3,5,5,1 with behind=0. Design SHA a7da659efd12e1b5112f54fa6b5e41989f451dd4 is docs only and not the repair parent. PR255 is charter documentation only.
- inclusion: 251 selective transfer of 250, 252, 253; 254 under repair. Exclude wholesale PR249 and PR219, overlapping alternative lifecycle migrations and blanket historical conversion. PR249 is 53 ahead/141 behind selected base, merge base 1d565c4c7f1eb79331f41fe2ff3f48aeb1e13e69.

## Migration manifest (exact Git tree, not deployment approval)

104 inherited migration files at selected base; 104 at repair parent; 0 tree differences. Allowed **only as inherited disposable-test candidate set**, subject to review; zero production migrations authorized. Blob hashes are pinned evidence, not evidence of SQL semantics or hosted schema agreement. Existing main migration edits require drift audit. No new migrations in QA package.

| File | Blob SHA | Inclusion basis |
|---|---|---|
| `20260921082958_finora_core_schema_auth_licenses_rls.sql` | `0c8a7192842dc9ceabc80506adb48f99d5059bb7` | changed vs main; audit required |
| `20260921083540_finora_records_store_replace_relational.sql` | `e36a4cf8bd5e2225f70df6c00f12de3187f7adaf` | changed vs main; audit required |
| `20260921083829_finora_admin_license_rpcs_cancel_and_extend.sql` | `a2f29b4047e2cb054fe377fa2bce42660180f23f` | changed vs main; audit required |
| `20260922035848_decouple_profile_email_add_email_col.sql` | `341076af0b43c6549f4a3d0456efa9a84bca8df5` | changed vs main; audit required |
| `20260922035916_drop_username_unique_and_format_constraints.sql` | `49ec5579b91e37bf19b14d3a05b6dbb20ddc1cac` | changed vs main; audit required |
| `20260923210625_add_full_name_to_profiles.sql` | `c3c1dfa08f88f4f79facabecc4ddc72fc904c490` | changed vs main; audit required |
| `20260928025331_allow_purchases_collection.sql` | `6c7c69b47af6ee0d66b609717a9e348779c9e005` | changed vs main; audit required |
| `20260928113755_allow_payment_settlement_records.sql` | `57d11f93e6371527da447e869665e7d07eeab174` | changed vs main; audit required |
| `20260928115233_repair_legacy_invoice_contact_ids.sql` | `195aa6404d3470fc00fc26959ca6b9f5f5eeb912` | changed vs main; audit required |
| `20260928115616_restrict_internal_license_helpers.sql` | `d1e18648a251d048dae71c50b0de4e39fc47eb9a` | changed vs main; audit required |
| `20260928141512_allow_accounting_foundation_collections.sql` | `52b0e4116379f36a4d8ac954949bb8b54d01d7bf` | changed vs main; audit required |
| `20260928145306_allow_phase3_double_entry_collections.sql` | `6175972560db05c8c3bff94a69eeca7f1ea17fae` | changed vs main; audit required |
| `20260929083130_phase3_hardening_atomic_sync_and_ledger_guards.sql` | `2a2b1a4b563c2a49d2dd5cbf41ad32ccd8e895c9` | changed vs main; audit required |
| `20260929091743_phase4_contracting_collections.sql` | `5c6ba6864d8322222da77baab958360f0efa42fb` | changed vs main; audit required |
| `20260929172129_phase5_complementary_erp_collections.sql` | `4894698eb5c52e67be4e6034372801fdaa4b5bbb` | same as main |
| `20260929193348_posted_source_immutability_guard.sql` | `3e8071a9757349d17479eb02187440b699bf1143` | same as main |
| `20260929193357_accounting_master_uniqueness.sql` | `af4ad7ea18781211fda58fc22fcae1e174c11512` | same as main |
| `20260929220543_license_company_capacity.sql` | `aab706923e38c979ba3e10fea904f4d129c38a22` | same as main |
| `20260929220613_restrict_company_limit_rpc.sql` | `e3e3814ef5819b9d505495b84e564b50c8b0781d` | same as main |
| `20260929221252_iran_enterprise_foundation_collections.sql` | `dcb5d40876a42d87e2e72f3357db283280c69cb4` | same as main |
| `20260929221754_iran_enterprise_financial_controls.sql` | `6769d34d436feb4951c35d51625754470ea51172` | same as main |
| `20260929222000_iran_enterprise_foundation_collections.sql` | `86014dd738652882820ba27fcb8c6b727dc65d64` | changed vs main; audit required |
| `20260930025546_modular_entitlements_office_automation_foundation.sql` | `c272baec523f03ca484dcfed78dfdb184494f3db` | same as main |
| `20260930025647_office_secretariat_atomic_registration.sql` | `50d62298d72a5ad83c4ae92047088475320b8117` | same as main |
| `20260930030314_preserve_readonly_access_after_license_expiry.sql` | `5cd0a007f03eca133db443bc1e9459c548e8cf05` | same as main |
| `20260930031853_organization_membership_rbac_foundation.sql` | `50382ebbb73809f70120f82df2a7b6f598dd6be8` | same as main |
| `20260930031942_office_shared_rbac_and_referrals.sql` | `b0944852cead835c2633cc4a607412c6c641bc79` | same as main |
| `20260930032615_slice_b_rbac_fk_indexes.sql` | `7fe5b168dbc9c25079b4310d340b94425b1a54d7` | same as main |
| `20260930032654_harden_legacy_office_storage_member_writes.sql` | `5ea9196c1f1ed64ece32d3334b8e0e75c8cc6a8d` | same as main |
| `20260930033010_allow_member_core_read_context.sql` | `845703c0f7b39a7f27f2ea6be901de8f706d0908` | same as main |
| `20260930041735_harden_public_security_definer_rpc_grants_search_path.sql` | `2cea961ce85396b6c1879ec00f5fa6c0020afd7b` | same as main |
| `20260930045827_enterprise_license_seats_delegated_admin.sql` | `8014ed4245f9c8c23186ca94bd63c2687f24ab7c` | same as main |
| `20260930050542_enterprise_reusable_roles.sql` | `157ec69c425315cdbbd6ad8f0cddb83d5fff0d17` | same as main |
| `20260930050904_eli2_role_tenant_hardening.sql` | `0884fc4f599b678940f81a2566ad0b1eefef5171` | same as main |
| `20260930051849_enterprise_invitations.sql` | `e40498ed965b151f9ddd8ada6e17bb0500b8d4ac` | same as main |
| `20260930052909_eli3_fk_index_hardening.sql` | `a601b9a6edf5ab232a84c30eed3170407837dcf7` | same as main |
| `20260930053652_enterprise_organization_ux.sql` | `5cfa3fa72ddc08aee442ddf79093004094976c89` | same as main |
| `20260930054352_office_registered_history_read_evidence.sql` | `da3efdaba628597a63afa34f42c3de44e425619c` | same as main |
| `20260930152500_office_slice_c2_actionable_referrals_sla.sql` | `251d823c028fcf42c03e065a7acbc0f0f8e3e257` | same as main |
| `20260930153000_office_evidence_insert_hardening.sql` | `54c6fb1deee1d3ce393ebb731767504df5bed2fd` | same as main |
| `20260930154625_office_slice_c3_related_archive.sql` | `5d6abb3567366415ea44a43951e8a4231325de79` | same as main |
| `20260930154720_office_c3_event_time_ordering.sql` | `67886a18e394550b68fd856c92c20e48cbff393d` | same as main |
| `20260930202526_office_registration_tenant_repair.sql` | `ec95048502f8f55b2bbcf4bef5cf62ddfcb7b9b3` | same as main |
| `20260930202701_office_slice_c4_versioned_templates.sql` | `61c4d4148984ecc4868144497fb0f0c34ce69934` | same as main |
| `20260930203456_office_slice_c5_internal_approval.sql` | `a8a2799e2ee86cf42fa846ccba8ae79774e40466` | same as main |
| `20260930203620_office_slice_c5_internal_approval.sql` | `cdd402275c7397264d62c61972b18a771d8be5d1` | same as main |
| `20260930203709_office_c5_decision_event_order_fix.sql` | `1139e32d9bfb8e67f7dc430dab5788cc21855e9f` | same as main |
| `20260930203839_office_c5_content_digest_hardening.sql` | `5baad2fbde1437933097402e43cf52ce47aa5a27` | same as main |
| `20260930204536_office_slice_c6_sla_reminder_escalation.sql` | `e1f44d0ce6ea05abe4dcbf0252464dbdb87e141d` | same as main |
| `20260930205309_office_slice_c7_fulltext_ocr_provenance.sql` | `f36a5ad8c8f816eba4f85b17e085f33806a0ac10` | same as main |
| `20260930205325_office_slice_c7_searchable_archive_ocr_provenance.sql` | `73a45f59171615d715a543af4ae3b3b43cdde82e` | same as main |
| `20260930205347_office_c7_search_input_guard.sql` | `fdf652d34b7c362e1d1c8d5e12b72ea06d6ba2f0` | same as main |
| `20260930205753_office_c7_remove_abandoned_duplicate_api.sql` | `dfb85774d0dffb3b88f852768c527d8ede665b8b` | same as main |
| `20260930205919_office_c7_bind_ocr_source_attachment.sql` | `2b42ab42b6b10ef66952ae86ec4c34e621577421` | same as main |
| `20260930222500_iran_enterprise_control_collections.sql` | `623af5a832f9addd9ed69bc5c3c1b4518ef10c4a` | changed vs main; audit required |
| `20260930223000_iran_enterprise_financial_controls.sql` | `60fb49a2e09f7a80de9338c6e3b568b0eb012c7b` | same as main |
| `20261001173917_office_slice_c8_workflow_policy.sql` | `9042b01a3ac9e2f14422d6a99fb2ec6f9a485901` | same as main |
| `20261001180610_office_slice_c8_workflow_runtime.sql` | `aa5c8a386ce6e7935dedca707328702a8083f63b` | same as main |
| `20261001180949_office_c8_policy_publisher_fk_index.sql` | `71471436b245dcd071eb345246b8ee8e942705d8` | same as main |
| `20261001204500_request_workflow_d1_foundation.sql` | `cefc607e9a1a4e7b4fa04a9d55479e660c757456` | same as main |
| `20261001205500_request_workflow_d1_transition_evidence.sql` | `1a745bf779ba11b645666d81fa2528571adcfc28` | same as main |
| `20261001210500_request_workflow_d1_rpc_security.sql` | `4605818b7b1e24b3edebf6b3823a069cf9f3a132` | same as main |
| `20261001211500_request_workflow_d1_revision_qualification.sql` | `47b773014c811569b27358093af4c0a9bf3f2844` | same as main |
| `20261001223500_request_workflow_d2_legacy_cutover.sql` | `86a7869cc7755b471601775686ae85c3dfbdcd5e` | same as main |
| `20261001224500_request_workflow_d2_fk_indexes.sql` | `214e4570127eb07851259b5fa6ca32f62d1be450` | same as main |
| `20261001230000_request_workflow_d3a_step_runtime.sql` | `48b2d2b9db39ce4fcf33e17be38c2adec1012335` | same as main |
| `20261001230500_request_workflow_d3a_security_hardening.sql` | `420b1a2b0a881e77e0991ca471407a737c264fcc` | same as main |
| `20261001233000_request_workflow_d3b_conditions_timeline.sql` | `a98422673e861c4caf0ef5b5e8a8fe28d2baea06` | same as main |
| `20261001235500_request_workflow_d3c_operations.sql` | `522131ff771a6511253dd2ab91469a1d82591a22` | same as main |
| `20261002000500_request_workflow_d3c_escalation_conflict_fix.sql` | `dccfc475b11dfec31db2297a76b810be5dd006da` | same as main |
| `20261002001000_request_delegation_to_user_fk_index.sql` | `30f7f9156acadaa32ad54f09b1282a7cf3a05338` | same as main |
| `20261002010000_request_wave1_legacy_transition_guard.sql` | `da79f2241ed8ecfe79b161a49bff4d56b9d1196c` | same as main |
| `20261002023000_request_wave2_integrity_hardening.sql` | `f2717da1142b967543171fb2f84a55a9f333d337` | same as main |
| `20261002033000_request_workflow_d4a_work_queue.sql` | `a5c0890e0769141aaea4b8406c13ab093342d0ec` | same as main |
| `20261002070000_request_wave2_duplicate_code_guard.sql` | `8bc0d8ce590b631e3a82bc597c3c7f41514653e0` | same as main |
| `20261002071000_request_wave3_decision_idempotency.sql` | `a99c20081286527f89774220b4c2a9b31fe69934` | same as main |
| `20261002072000_request_wave4_operational_integrity.sql` | `7e644afd2387d328056356314ebfdeed272963ab` | same as main |
| `20261002073500_request_wave4b_scheduler_outbox_delivery.sql` | `3a561c18dd857b91b0886602675285b63e6edd86` | same as main |
| `20261002080000_identity_wave5a_bootstrap.sql` | `bcc0b9da759df81eed014eab09c24de6f8f6f030` | same as main |
| `20261007165208_phone_identity_profile.sql` | `1d9ec2cb7aa7484f8c86e0e629ca3ac68acce9d8` | added vs main |
| `20261011174445_posted_source_idempotency_index.sql` | `018f00b94715e0100ae82bf7c68087128077019a` | same as main |
| `20261012080000_fix_identity_bootstrap_license_before_membership.sql` | `58bd2e95a7c9d6529d291c29984217b369cda786` | same as main |
| `20261016100000_phase1a_server_journal_invariants.sql` | `1af8dc2db30065287075b1e27e262094b7b91027` | added vs main |
| `20261016100500_phase1a_optimistic_version_sync.sql` | `71f2af3a4bda5a262b43157ba1435d5d6798513b` | added vs main |
| `20261016101000_phase1a_guard_modes_audit.sql` | `64f6fe563fd15645f786d8b23ac9d96e0a3b5ef3` | added vs main |
| `20261016101500_phase1a_journal_core.sql` | `0721e29ce1136bd9344b7a0043082d7e0e3d49ed` | added vs main |
| `20261016102000_phase1a_journal_rpc_surface.sql` | `277af28692bf25577b465967e99d50e63139e2e6` | added vs main |
| `20261016102500_phase1a_account_role_protection.sql` | `9b4b52d26949de0e1cb275234bba03ab5d20f05b` | added vs main |
| `20261016103000_phase1a_sale_monetary_contract.sql` | `6a2a0141a94c30b6b1017589ffe22e780e82f6f2` | added vs main |
| `20261016103100_phase1a_autopost_server_authority.sql` | `813653283b630925a13cdad9ab6990649acafc52` | added vs main |
| `20261016103500_phase1a_purchase_fixed_contract.sql` | `fbcac55136fe2ff85d55b239f85070f292c4b179` | added vs main |
| `20261016104000_stage22_manual_guard_owner_mode.sql` | `8ab93519ea92bdec4a206305b1e288a8260091e9` | added vs main |
| `20261016104500_stage3_posted_source_immutable.sql` | `33d05b84fe5bfb2a8537fcc563ea2594c48ec320` | added vs main |
| `20261102141933_wp1_ledger_scope_authority_hardening.sql` | `b9b896a4bf93f30ce994f0871867929351f03e31` | added vs main |
| `20261104020908_wp1_reversal_dimensions.sql` | `7e6a0253bd82d4be46bdff281a2de21f20dd8fe5` | added vs main |
| `20261104072719_wp1_manual_update_guards.sql` | `939657a0e780a04151f841647a2fcb338d0f6ea8` | added vs main |
| `20261104214503_wp1_null_revision_guards.sql` | `1fb4c717f1fd7764ae864bdc49c51494f045f9d2` | added vs main |
| `20261104220102_wp1_journal_graph_read.sql` | `ff78bda7d68b5dde2e92135f6f4ade1021bc7004` | added vs main |
| `20261115130000_wp1_guard_audit_tenant_scope.sql` | `d490b2389c0537d655529d804ad9b3a8c9100551` | added vs main |
| `20261115140000_wp1_dimension_value_type_scope.sql` | `bc4c764892baa047da1edde044b4d66bea221aff` | added vs main |
| `20261115150000_wp1_scope_move_audit_source_tenant.sql` | `c650f1d245b5fcb48bad029f9c8ce9833032f9db` | added vs main |
| `20261117110000_wp1_autopost_source_link_atomic.sql` | `b68452f91b352d97a88a05aa6f8e70c6650ce058` | added vs main |
| `20261117120000_wp1_stage3_canonical_source_link_projection.sql` | `1dc25e0e094fbe69239bf1e8af1141fdb30676bb` | added vs main |
| `20261117130000_wp1_autopost_payment_method_guard.sql` | `c8d700f7b849adb26e3f69db755a948bf7bb0342` | added vs main |

### Excluded PR249 migration variants
- `supabase/migrations/20261118100000_journal_document_lifecycle.sql` (`c18f1f52ba6bd23b162ff657130c976983db2abe`): absent; exclude wholesale PR249/219 migration, pending independent review.
- `supabase/migrations/20261124110000_wp4_guarded_draft_delete_order.sql` (`ff965e8bf0851682af9248446bbe41708d6d87e3`): absent; exclude wholesale PR249/219 migration, pending independent review.

Other competing lifecycle branches are excluded wholesale pending independent comparison; not yet exhaustively enumerated. Do not execute historical conversion or change production schema.

## FIN-B03-R2-QA checkpoint
Owner: isolated QA workstream only; Codex-main integration/review. Existing implementation ownership preserved; no shared runtime file claim. Two browser failures verified in job 138306850399 (259 passed/2 failed). Commit 9213f60d9af62ceccb0399e9a03e28cffc9f9d1e scopes C8 status locator to its own root, same assertions. Commit 8a20875e6edc87e4ae09f59760857e1c48d691c9 preserves original conflict-recovery state requirement, adds collection-only diff evidence and post-debounce zero-RPC assertion. No test execution of these commits yet. Source trace: conflict-review publishes validated snapshot then invokes refreshAllSurfaces; renderAccountingFoundation calls afSeed and afMigrateLegacyProjects, both can schedule save. This is a source-supported hypothesis for pending=true, not proof of actual failing call. Do not simply clear pending, disable accounting seeding globally, or weaken assertion. Need trace actual synthetic fixture, separate read-only rendering from explicit initialization, and rerun full exact-head gates. Runtime implementation remains with existing workstream until recorded handoff.

Open: conflict review actual-server browser acceptance, authorized operation/role coverage, full owner-request traceability, C/D (#229), #245/#246, #248, #238, #223, migration audit and Codex review. No phase accepted or release claimed.
