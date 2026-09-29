# Phase 5 — Complementary ERP & Integrations

Scope implemented as vertical slices:
- warehouse master, immutable posted stock movements, transfers, stock count adjustments and derived purchase/sale movements
- weighted-average inventory valuation
- fixed-asset register and straight-line periodic depreciation with balanced journal posting
- currency master, dated exchange rates and deterministic conversion rule
- cost-center master prepared as an entity-backed accounting dimension
- full v5 backup payload plus non-destructive restore validation/preview and import audit batches
- integration connection metadata and durable outbox; browser stores no integration secrets
- Phase 5 audit collection and production guards/indexes

Accounting boundaries:
- posted journal remains accounting truth
- posted stock/count/depreciation records are immutable at the database boundary
- stock transfers do not create value-changing journal entries
- depreciation posts debit 6201 / credit 1502 after required accounts are created
- purchase/sale quantities feed operational stock only for the configured default warehouse; explicit warehouse selection on source documents is a future enhancement
- external webhook delivery is intentionally server-side architecture only; browser outbox export is available, but live third-party delivery is NOT VERIFIED

Verification requires syntax/static checks, Phase 5 behavioral scenarios, real-DOM smoke, Supabase migration/RLS/advisors, and final-head CI.
