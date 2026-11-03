# WP1 source coverage — current implementation limits

| Source | Candidate server path | Current acceptance |
|---|---|---|
| Manual journal | create/update/post/reverse RPC | SQL revalidation in progress; UI integration pending |
| Sales invoice | server monetary contract + autopost | SQL tests in progress; current main client unchanged |
| Purchase invoice | fixed purchase contract + autopost | SQL tests in progress; corrective/cancel ENFORCE flow incomplete |
| Receipt/payment | existing staged RPC source allowlist | End-to-end server amount derivation and allocations NOT VERIFIED |
| Cheques | no completed source adapter | Not yet server-enforced |
| Expenses/income | allowlisted staged path | Source-derived amounts/lifecycle not yet fully server-enforced |
| Opening/closing | staged manual guard deliberately rejects | Not yet server-enforced; no false support claim |
| COGS/inventory | existing model needs source-specific contract | Not yet server-enforced |
| Payroll/contracts/assets/petty cash | historical allowlists are not implementation proof | Not yet accepted; no new modules in this scope |

No UI activation has been made in this WP1 checkpoint. UI state labels and capability detection remain explicit required work before rollout. An allowlist or balanced caller-provided payload is not proof of authoritative source posting.
