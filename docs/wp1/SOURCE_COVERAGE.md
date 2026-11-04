# WP1 source coverage — current implementation limits

| Source | Candidate server path | Current acceptance |
|---|---|---|
| Manual journal | create/update/post/reverse RPC | Disposable SQL suite PASS; date/type guards and preserved reversal dimensions added; NULL revision proof and complete 15-migration local suite PASS; exact-head CI pending; manual UI RPC integration pending |
| Sales invoice | server monetary contract + autopost | Disposable SQL suite PASS; end-to-end UI server path pending |
| Purchase invoice | fixed purchase contract + autopost | Disposable SQL suite PASS; client refuses unsupported ENFORCE correction; complete corrective/cancel transaction pending |
| Receipt/payment | existing staged RPC source allowlist | End-to-end server amount derivation and allocations NOT VERIFIED |
| Cheques | no completed source adapter | Not yet server-enforced |
| Expenses/income | allowlisted staged path | Source-derived amounts/lifecycle not yet fully server-enforced |
| Opening/closing | staged manual guard deliberately rejects | Not yet server-enforced; no false support claim |
| COGS/inventory | existing model needs source-specific contract | Not yet server-enforced |
| Payroll/contracts/assets/petty cash | historical allowlists are not implementation proof | Not yet accepted; no new modules in this scope |

No production UI activation has been made. Capability-safe sync and unconfirmed-save labels passed exact-head CI at56818d8; source-specific posting UI and reconciliation remain required before rollout. An allowlist or balanced caller-provided payload is not proof of authoritative source posting.

Analytical dimensions: reversal now preserves existing type/value tags. Required/optional accountDimensionRules are not yet enforced server-side; entity-backed contact/project values need an explicit compatibility contract. These remain blockers to claiming full manual source acceptance.
