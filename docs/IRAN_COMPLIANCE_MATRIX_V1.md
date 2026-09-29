# Finora — Iran Compliance Matrix v1

Date: 2026-09-30  
Scope: product/accounting architecture for Iran-first ERP. This is an engineering compliance baseline, not a substitute for professional legal/tax/audit sign-off.

## Design rule
Finora must never encode volatile legal/tax parameters as timeless constants. Every rate, threshold, deadline, exemption and tax schema that can change by fiscal year/circular must be effective-dated, source-referenced and auditable. Posted history keeps the rule version used at posting time.

## Accounting standards baseline
- AS 1 — presentation of financial statements; AS 2 — cash-flow statement.
- AS 4 — provisions, contingent liabilities and contingent assets: recognition/measurement/disclosure boundary; material time-value effects require present-value measurement.
- AS 8 — inventories: inventory measurement/costing and NRV control belong to the inventory/costing domain.
- AS 16 (revised 1400) — effects of changes in foreign exchange rates: foreign-currency transactions/operations require controlled FX measurement and reporting.
- AS 18/20/38/39/40/41 — separate financial statements, associates/joint arrangements, business combinations, consolidated financial statements and interests in other entities. A parent/subsidiary flag alone is not consolidation.
- AS 33 — retirement benefits. Important: the Iranian standard explicitly excludes termination benefits from its own scope; Finora must not falsely label statutory end-of-service benefit as “AS 33 compliant”.
- AS 34 — accounting policies, changes in estimates and errors: corrections/versioning must preserve audit history.
- AS 35 — income taxes.
- AS 36/37 — financial instruments presentation/disclosure.
- AS 42 — fair-value measurement.
- AS 43 — revenue from contracts with customers, mandatory for financial periods beginning 1404/01/01 and later. Revenue architecture must therefore migrate away from obsolete hard-coded assumptions from replaced standards when AS 43 applies.

## Labor / payroll / social security
- Labor Law Article 24 baseline: on qualifying contract termination, one month of last salary per year of service is the statutory end-of-service baseline. The system must preserve service history and the wage basis used; settlement rules remain effective-dated because later statutes/rulings may affect edge cases.
- Labor Law Article 66: annual leave carry-forward is capped at 9 days. Current-year accrued/used leave and year-end carry-forward are distinct fields.
- Social Security Law Article 28: employee/social-security shares have statutory bases; unemployment insurance is separately governed. Standard employment payroll must distinguish employee deduction, employer expense and government share rather than netting them.
- Unemployment Insurance Law Article 5: 3% of insured wage is employer-funded for covered workers.
- Payroll tax is annual-budget-sensitive. For 1405 the general salary-tax exemption/brackets must be stored as an effective-dated rule set rather than compiled into journal logic.

## Tax / VAT / Taxpayer System
- VAT Law 1400 is the base statute; annual budget and special goods/services can alter applicable rates. General 1405 VAT is 10%, but special/exempt categories must not inherit the general rate blindly.
- Taxpayer System/POS law: electronic invoice lifecycle, unique tax identity, original/correction/return relationships and submission status must be first-class. Article 22 contains material penalties, so Finora must not describe a locally prepared invoice as “submitted to the Taxpayer System” unless a real acknowledged submission exists.
- Article 25 evidentiary consequences make submission/acknowledgement traceability and immutable payload hashes high priority.
- Direct Tax Law rent withholding (Article 53 note 9) applies to specified legal-person payers; the rule/deadline must be versioned to current law and never inferred merely from a generic expense title.
- Income/payroll/rent tax calculations must retain legal-rule version, taxable base, exemptions, calculation trace and payment/submission reference.

## Company / commerce law
- Natural person and legal entity are different identity models. A natural person has no company registration number and is not itself a “holding parent/subsidiary” legal entity.
- Commercial Code Article 20 enumerates commercial company forms; Finora legal-form options must be separate from operational activity (trading/service/manufacturing/etc.) and from group position (standalone/parent/subsidiary).
- Corporate/group structure is modeled on legal entities; management reporting can span companies, but statutory consolidation requires AS 39 controls, mapping, eliminations, NCI and consistent policies/periods.

## ERP control architecture required
1. HR master + employment contracts + payroll + insurance/tax + leave + end-of-service/benefit obligations.
2. Treasury: bank/cash masters, rial/foreign-currency cashboxes, branch cashboxes, petty-cash custodians, advances/settlements, cash forecasting.
3. Cost accounting: cost centers, cost objects, direct/indirect cost elements, drivers, ABC allocation, production/service/contract cost, variance and reconciliation to GL.
4. Budget/performance: versioned budgets, responsibility centers, performance measures, actual-vs-budget and approved revisions. ABB is supported as a planning method, not misrepresented as an accounting standard.
5. Group/holding: legal entity graph, intercompany transaction identity, reciprocal matching, balances, eliminations, FX translation, consolidation runs and parent-level liquidity/inventory controls.
6. Management reporting: company/subsidiary/group drill-down, liquidity, inventory, AR/AP, cash forecast, budget variance, contract profitability and control exceptions.
7. Compliance registry: every rule has jurisdiction=IR, source, effectiveFrom/effectiveTo, version, status and review date. Financial records store the rule version actually used.

## Source register used for this baseline
- Iranian accounting-standard lists/texts published from Audit Organization material; cross-checked against Jihad Daneshgahi Sharif and current professional reproductions. AS 43 current effective date cross-checked as 1404/01/01.
- Iran Labor Law text (ILO NATLEX copy), Articles 24 and 66.
- Social Security Law Article 28; Unemployment Insurance Law Article 5.
- VAT Law approved 1400/03/02 and current 1405 general-rate references.
- POS/Taxpayer System Law 1398/07/21 with later amendments, especially Articles 22 and 25.
- Direct Tax Law Article 53 note 9.
- Commercial Code Article 20 and 1347 amendment for joint-stock companies.

## Engineering acceptance
A compliance feature is not COMPLETE because a menu/form exists. Completion requires: versioned rule source; domain validation; accounting posting where applicable; immutable posted history; reversal/amendment; permissions/RLS; report/reconciliation; negative tests; real-DOM workflow; and migration/rollback evidence.
