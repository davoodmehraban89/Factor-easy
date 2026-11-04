# WP1 source coverage — current implementation limits

| Source | Candidate server path | Current acceptance |
|---|---|---|
| Manual journal | create/update/post/reverse RPC | Disposable SQL suite PASS; manual UI RPC integration pending |
| Sales invoice | server monetary contract + autopost | Disposable SQL suite PASS; end-to-end UI server path pending |
| Purchase invoice | fixed purchase contract + autopost | Disposable SQL suite PASS; client refuses unsupported ENFORCE correction; complete corrective/cancel transaction pending |
| Receipt/payment | existing staged RPC source allowlist | End-to-end server amount derivation and allocations NOT VERIFIED |
| Cheques | no completed source adapter | Not yet server-enforced |
| Expenses/income | allowlisted staged path | Source-derived amounts/lifecycle not yet fully server-enforced |
| Opening/closing | staged manual guard deliberately rejects | Not yet server-enforced; no false support claim |
| COGS/inventory | existing model needs source-specific contract | Not yet server-enforced |
| Payroll/contracts/assets/petty cash | historical allowlists are not implementation proof | Not yet accepted; no new modules in this scope |

No production UI activation has been made. Candidate capability-safe sync and unconfirmed-save labels are under verification; source-specific posting UI and reconciliation remain required before rollout. An allowlist or balanced caller-provided payload is not proof of authoritative source posting.
