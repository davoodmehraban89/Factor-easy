# Finora Accounting Core Roadmap — v1.x

Date: 2026-09-28
Status: Architecture approved for implementation planning
Baseline: Finora 1.0

## Objective
Move Finora from document/income-expense management to a double-entry accounting system without breaking the current sales, purchase, settlement, cheque, project, print, backup or cloud-sync workflows.

## Core accounting model

### 1. Chart of Accounts
Three fixed account levels:
1. General Ledger / کل
2. Subsidiary / معین
3. Detail Account / تفصیلی

Each account has: id, code, title, parentId, level, normalBalance (debit/credit), nature, postingAllowed, active, companyId, fiscalYearId.

Posting is allowed only to the last configured posting level. Parent accounts aggregate children and never receive direct journal postings.

### 2. Floating detail dimensions
Four configurable floating-detail dimensions are attached to journal lines, not embedded below the account tree.

Default dimension definitions:
- Floating Detail 1: Branch / شعبه
- Floating Detail 2: Counterparty / طرف حساب
- Floating Detail 3: Project / پروژه
- Floating Detail 4: Contract / deduction/payment analytic dimension

The engine must not hard-code those labels. A company can rename/enable/disable dimension types and define which dimensions are allowed or required for each posting account.

Journal line shape:
accountId + debit + credit + floating1Id + floating2Id + floating3Id + floating4Id + documentRef + description.

### 3. Global projects
Projects become first-class company masters, independent from contacts. A project is defined once and can then be linked to any number of counterparties, contracts, invoices, purchases, payments, expenses and journal lines.

Existing contact-owned projects are legacy data and require a controlled migration to global project records. Historical IDs must be preserved or mapped so prior documents remain traceable.

### 4. Counterparties
Contacts remain first-class masters and automatically become values in the Counterparty floating-detail dimension.

Contact role does not itself create a ledger account. Posting profiles determine the control account:
- customer sale -> Accounts Receivable control account
- supplier purchase -> Accounts Payable control account
- both -> the same counterparty dimension can be used under both receivable and payable control accounts.

This prevents duplicate customer/supplier ledgers and preserves one counterparty identity.

### 5. Contracts
Contracts are first-class masters:
contract number, title, employer/contractor counterparty, company, branch, project, start/end date, gross value, currency, status, insurance/tax attributes, retention rules, attachments/references and guarantee links.

Contracts can be linked to sales/purchase invoices, payments, deductions, guarantees and journal entries.

### 6. Deductions
Deduction types are masters rather than free text:
- retention / حسن انجام کار
- insurance deduction / سپرده یا کسر بیمه
- withholding tax / مالیات تکلیفی
- advance recovery / استهلاک پیش‌پرداخت
- penalties / وجه التزام
- other configurable deductions

Each deduction type has a posting profile and can optionally be represented in Floating Detail 4. The financial meaning remains in the deduction record and posting rule; the floating dimension is analytic, not the accounting source of truth.

### 7. Guarantees
Guarantees are first-class masters:
type, issuer/beneficiary, bank/institution, guarantee number, contract/project, issue/expiry dates, amount, status, collateral, extension/release history and document references.

Guarantees should support memorandum/off-balance accounting through dedicated posting profiles where the company uses such accounts.

## Double-entry engine

Every financial source document creates a journal voucher with balanced journal lines. Posted vouchers are immutable; corrections use reversal/amendment rather than destructive edits.

Core entities:
- fiscalYears
- accountGroups (optional presentation layer)
- accounts
- dimensionTypes
- dimensionValues
- accountDimensionRules
- postingProfiles
- journalVouchers
- journalLines
- projects
- projectLinks
- contracts
- contractDeductions
- guarantees

Voucher lifecycle:
draft -> validated -> posted -> reversed.

Hard invariants:
- total debit = total credit
- no posting to inactive/non-posting accounts
- required dimensions must be present
- dimension value must be permitted for the account/company/fiscal year
- posted voucher cannot be silently edited/deleted
- source document can have at most one active posted voucher per posting event
- fiscal-year lock prevents backdated mutation
- all records are owner/company scoped and RLS protected.

## Default posting profiles

Sales invoice:
Dr Accounts Receivable [counterparty, branch, project, contract]
Cr Sales/Revenue [branch, project, contract]
Cr Tax/VAT Payable when applicable

Purchase invoice:
Dr Inventory/Expense/Asset [branch, project, contract]
Dr Recoverable VAT when applicable
Cr Accounts Payable [counterparty, branch, project, contract]

Receipt:
Dr Cash/Bank
Cr Accounts Receivable [counterparty/project/contract]

Payment:
Dr Accounts Payable [counterparty/project/contract]
Cr Cash/Bank

Contract deductions use configured receivable/payable/control accounts and retain the same contract/project/counterparty dimensions.

## New four-phase implementation

### Phase 5 — Accounting Foundation and Chart of Accounts
Owner: Architecture/Accounting Core
Deliverables:
- fiscal year master and opening/locking model
- three-level chart of accounts UI and coding validation
- account nature and posting-level rules
- four configurable floating-detail dimensions
- branch master
- counterparty synchronization into floating detail 2
- global project master replacing contact-owned project definition
- account-to-dimension required/allowed rules
- safe migration layer for existing projects/documents
- Supabase collections/RLS/migrations and backup/sync support
Acceptance:
- chart can be created/imported
- global project is defined once and linked to multiple contacts/documents
- contacts appear automatically as dimension values without duplication
- no existing Finora 1.0 document is orphaned.

### Phase 6 — Double-entry Journal and Automatic Posting
Owner: Financial Engine
Deliverables:
- journal voucher/line engine
- debit-credit validation and posting locks
- manual journal UI
- automatic posting profiles for sale, purchase, receipt, payment and expense/income
- account ledger, subsidiary ledger, detail ledger and floating-detail ledger
- opening entries, voucher numbering, reversal
- migration/reconciliation report comparing legacy balances to accounting balances
Acceptance:
- every posted source document generates a balanced voucher
- customer/supplier balances reconcile to control accounts
- trial balance is balanced
- no posted voucher can be destructively edited.

### Phase 7 — Contracts, Deductions, Guarantees and Advanced Analytics
Owner: Contracts/Accounting Integration
Deliverables:
- contracts menu and master
- deduction rules and contract deduction schedules
- guarantees menu and lifecycle
- contract/project/branch/counterparty analytic links
- optional memorandum posting profiles for guarantees
- project and contract profitability, retention/insurance/tax tracking
Acceptance:
- a contract can connect to multiple documents/payments/guarantees
- deductions are traceable from contract to voucher
- guarantees have expiry/status history and accounting references
- reports reconcile to journal data.

### Phase 8 — Professional Accounting Reports, Migration and Release
Owner: QA/Release
Deliverables:
- journal, general ledger, subsidiary ledger, detail ledger
- floating-detail ledgers 1..4
- trial balance 2/4/6/8-column as configured
- account turnover and balance reports
- project/branch/counterparty/contract analytic reports
- balance sheet and profit/loss mapping framework
- period close/lock
- full regression, security, performance and production migration
Acceptance:
- trial balance debit/credit equality
- source-to-voucher drilldown and voucher-to-source drillback
- legacy Finora 1.0 balances reconciled before cutover
- production backup and rollback point created before migration
- all automated quality/security/deployment gates pass.

## Workstream responsibilities
1. Architecture & requirements: accounting model, posting contracts, migration invariants.
2. Implementation: schema, engine, UI, synchronization and source-document integration.
3. UX/UI: chart editor, voucher entry, dimension selectors, contracts/guarantees and reports.
4. QA & verification: balanced-voucher tests, reconciliation, migration fixtures, regression.
5. Security & release: RLS, fiscal locks, immutable posting controls, backups and production rollout.

These are coordinated workstreams; implementation must not claim independent agents unless an actual multi-agent runtime is available.

## Key architectural decisions
- Do not create one project tree inside every counterparty.
- Do not create one ledger account per customer/supplier.
- Do not use floating details as substitutes for double-entry accounts.
- Do not let document totals remain the accounting source of truth after Phase 6; posted journal lines become the accounting ledger.
- Keep operational documents as source documents and link them bidirectionally to vouchers.
- Keep project, contract, branch and counterparty identities global within a company/fiscal context.
- Preserve Finora 1.0 source IDs during migration for auditability.


## 2026-09-28 R&D refinement — fully user-defined floating dimensions

The earlier fixed presets are replaced by a generic hierarchical analytic-dimension engine.

### Dimension definitions
A company may create any analytic/floating dimension it needs, for example:
- Branch
- Employee
- Cost element
- Department
- Project
- Contract
- Vehicle
- Sales channel
- Bank account identifier
- Product family
- Region

Each dimension definition contains:
- id, companyId, code, title
- maxDepth
- leafOnlyPosting = true by default
- active
- sourceType: manual | entity-backed
- optional sourceEntity: contact | project | branch | employee | bankAccount | contract | custom
- allowMultipleSelectionPerLine = false by default
- hierarchyMode = strict-tree
- defaultApplicability: optional | required | unavailable

### Hierarchical values and leaf enforcement
Dimension values form an arbitrary tree up to the configured maxDepth.

A non-leaf/group node is analytical only and cannot be posted to when leafOnlyPosting is enabled.

Example:
Employees
  -> Operations
     -> Personnel
        -> Employee 10027 - Ali Rezaei

If a node is configured to have/accept children and has actual children, only selectable leaf nodes are valid for journal posting.

If a configured hierarchy requires a deeper level but the user has not created a valid child value yet, the parent remains non-postable and cannot be linked to an account rule.

### Account-to-dimension applicability
Each posting account may reference zero, one, or many dimensions.

For every account + dimension rule:
- applicability: required | optional | unavailable
- allowedValuesMode: all | selected-branches | selected-leaves | expression/range
- defaultValueId optional
- inheritedDefaultSource optional
- effectiveFrom/effectiveTo
- validationPriority

When a journal line account is selected, Finora resolves only the dimensions relevant to that account and prompts the user for the required values. Irrelevant dimensions remain hidden.

This follows the same principle used by enterprise ERPs: the account structure determines which dimensions are valid/required, rather than showing every dimension on every posting.

### Entity-backed dimensions
A dimension can be backed by a master entity instead of manually duplicating values.

Examples:
- Counterparty dimension <- Contacts
- Project dimension <- Projects
- Branch dimension <- Branches
- Employee dimension <- Employees
- Contract dimension <- Contracts
- Bank-account dimension <- Bank Accounts

The source master owns identity and business attributes. The analytic dimension references that identity for posting/reporting.

This prevents duplicate records and preserves one definition usable under many accounts.

### Dimension groups vs posting values
Headers and grouping nodes are never accounting identities by themselves.

Example:
Cost Elements
  -> Administrative & General
     -> Payroll
        -> Base Salary
        -> Overtime
        -> Benefits
     -> Rent
  -> Cost of Sales
     -> Materials
        -> Cable
        -> Copper
        -> Packaging

If “Payroll” or “Materials” has children, the system can be configured so those group nodes cannot be posted. Only terminal values such as Base Salary or Cable are selectable.

### Four-slot compatibility without four-slot limitation
Finora UI may initially expose four fast analytic slots for ease of migration and familiar Iranian workflows, but the storage/validation model must not be limited to four dimensions.

Journal lines store dimension assignments as a normalized collection:
journalLineDimension(lineId, dimensionId, dimensionValueId)

This allows four dimensions today and more later without schema redesign.

## Company-type templates

Finora should offer optional setup templates during company onboarding.

Initial template catalog:
1. Trading / بازرگانی
2. Service / خدماتی
3. Manufacturing / تولیدی
4. Contracting / پیمانکاری
5. Retail / فروشگاهی
6. Distribution / پخش
7. Nonprofit / موسسه غیرانتفاعی
8. Professional services / خدمات حرفه‌ای
9. Holding / multi-company management (later)

The user chooses:
- Apply recommended template
- Start empty

Templates are editable after installation and are not hard-coded business rules.

### Template contents
A template can seed:
- chart of accounts
- account nature/type
- posting profiles
- recommended dimensions
- account-to-dimension applicability
- default document numbering
- default reports
- optional starter branches/projects/cost structures

### Example template behavior

Trading:
- AR/AP, sales, purchases, inventory, cash/bank, VAT
- Counterparty dimension required on AR/AP
- Branch optional/required by company setup
- Project optional

Service:
- service revenue, payroll/contractor expense, admin expenses, AR/AP
- Project/Department/Employee dimensions commonly recommended
- Cost-element dimension for management analysis

Manufacturing:
- raw material, WIP, finished goods, direct labor, overhead, COGS
- Cost Center/Department/Product/Production Order dimensions as recommended
- stricter inventory and costing posting profiles

Contracting:
- project/contract revenue and cost
- retention, insurance deposits, advances, guarantees, subcontractors
- Project and Contract dimensions required on relevant accounts
- Counterparty required on employer/subcontractor control accounts

Retail:
- cash/POS/bank, sales, VAT, inventory, discounts, COGS
- Branch/Store dimension recommended
- Counterparty optional for anonymous retail sales

## Bank design clarification

Do not model every physical bank account as a duplicated chart node unless the customer explicitly prefers that structure.

Finora supports both approaches:

A. account-based:
Cash & Bank -> Banks -> Bank Melli

B. dimension-based:
Cash & Bank -> Bank
+ Bank Account dimension -> Melli / Account 0101...
+ optional Branch dimension

Recommended default for scalable setups is a stable ledger account plus a Bank Account master/dimension. This avoids chart explosion when a company has many accounts in the same bank and permits the same bank-account identity to participate in treasury reconciliation, payments and accounting.

## Posting UX

When the user selects an account during a journal entry:
1. Resolve the active account structure/rules.
2. Show only required/optional dimensions for that account.
3. Pre-fill defaults from source masters/document context when valid.
4. Prevent group/non-leaf dimension nodes from selection.
5. Validate allowed combinations before posting.
6. Show the composed accounting string as a readable preview, but store account and dimensions separately.

For RTL/Persian usability, Finora should display account and analytic segments as separate controls by default and optionally show a composed code string for power users.

## Governance and lifecycle

Dimension structure changes must be versioned/effective-dated after accounting activity exists.

Do not silently repurpose an existing posted dimension value.

Allowed lifecycle:
draft -> active -> inactive/closed

Historical journal lines retain the original identity and label snapshot/reference.

Account-structure changes affecting required dimensions must pass a validation/migration preview before activation.



## 2026-11-22 — Phase 6/8 CI reconciliation register (worker handoff, not a new phase)

This register maps execution stages A/B to the **existing** accounting Phase 6 (journal/source integration) and Phase 8 (QA/release); it does not supersede the approved roadmap. Exact integration candidate is PR218 `bcd8d4e` stacked on PR212 `1d565c4`, not deployed. Main `dab1a45` remains the last released SHA.

| شناسه | هدف | مسئول | وابستگی | وضعیت | معیار پذیرش | PR/SHA | شاهد | اقدام بعدی |
|---|---|---|---|---|---|---|---|---|
| FIN-QA-218-01 | تطبیق کاردکس و موجودی خرید اصلاحی | QA مستقل (پیاده‌سازی محدود) / Codex اصلی (بازبین نهایی) | وضعیت خرید، شرکت فعال، برگشت و اصلاح | پذیرفته‌شده در تست | یکسانی کاردکس/موجودی در سناریوی خرید قطعی/برگشتی/اصلاحی، حفظ انتظارهای اصلی | PR221 / 14a88586 | [RED 44949211793](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44949211793) موجودی۲/کاردکس۰؛ [GREEN 44956627612](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44956627612) مرورگر ۲۵۱/۲۵۱ | بازبینی مستقل، ادغام انتخابی؛ منتشرنشده |
| FIN-QA-218-02 | حفظ کنترل عضویت و جلوگیری از انسداد آزمون مجاز | QA مستقل (fixture) / Codex اصلی (بازبین نهایی) | اعتبار عضویت واقعی، پاسخ شبیه‌سازی شده | پذیرفته‌شده در تست | کاربر آزمایشی مجاز بتواند ادامه دهد؛ لغو عضویت همچنان داده/نشست را قفل کند | PR221 / 14a88586 | [Quality 44956627612](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44956627612) شامل آزمون مثبت و منفی | تأیید مستقل guard، آزمون سرویس واقعی؛ منتشرنشده |
| FIN-QA-218-03 | نوسازی کالا در ردیف پیش‌فرض فاکتور بدون از دست‌دادن فرم | QA مستقل (پیاده‌سازی محدود) / Codex اصلی (بازبین نهایی) | بارگذاری محصولات، فرم فاکتور و combo موجود | پذیرفته‌شده در تست | موجود بودن QA_PROD بعد ورود و حفظ شماره/تعداد/قیمت واردشده؛ ردیف بازسازی نشود | PR221 / 14a88586 | [Quality 44956627612](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44956627612) ۲۵۱/۲۵۱ شامل تست جدید حفظ ورودی | بررسی مستقل + پذیرش با کاربر واقعی؛ منتشرنشده |
| FIN-EDIT-OWNER | حفظ ویرایش حین await و ACK دیررس | Codex اصلی | PR218 CAS/version و شاخه اصلاح فعال اصلی | در پیاده‌سازی | RED/GREEN، بازبینی مستقل، CI دقیق | PR220 audit / PR218 base | ممیزی docs/audits/EXTERNAL_WORK_RECONCILIATION_2026-11-21_FA.md؛ نتیجهٔ جدید از مالک دریافت نشده | دریافت SHA و آزمون مالک؛ بدون بازنویسی موازی |
| FIN-LIFE-216 | چرخه سند موقت، شماره عطف و حذف مستند | Codex اصلی و مسئول مالی منتخب | PR206/207/210/211/212/218؛ ADR216 | در پیاده‌سازی | تراکنش واقعی، idempotency، رقابت، rollback، مجوز و DB واقعی | Issue216 / PR218 | ADR0216 و SQL candidate؛ چرخه مالی کامل تأیید نشده | قرارداد واحد و یکپارچه‌سازی انتخابی پس از تحویل مالک |
| FIN-CI-218 | گیت‌های منتخب بدون ادعای انتشار | Codex اصلی (پذیرش مستقل) / QA (شاهد) | اصلاحات PR221 و WP2 | پذیرفته‌شده در تست برای Quality/WP1/Security؛ WP2 باز | Quality، WP1، Security، WP2 و بازبینی مستقل روی SHA یکسان قبل پذیرش نهایی | PR221 / 14a88586 | [Quality 44956627612](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44956627612)، [WP1 44956627606](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44956627606)، [Security 44956627615](https://github.com/davoodmehraban89/Factor-easy/actions/runs/44956627615) موفق؛ Dependency review skipped | کنترل گیت روی SHA نهایی مستندات، بررسی WP2 و بازبینی Codex اصلی |

| FIN-CI-218-WP2 | تکمیل گیت WP2 برای تغییرات source مالی PR221 با فیلتر کمینه | QA مستقل؛ پذیرش نهایی با Codex اصلی | PR218/PR212، PR221 head 44b697b4، مسیر WP2 | در بررسی (تا پایان CI exact-head) | WP2 واقعاً اجرا و موفق شود؛ کیفیت/WP1/امنیت روی همان SHA تأیید؛ بازبینی اصلی جدا | QA successor PR (stacked on PR221) | PR221 docs-head: Quality 44978932775 SUCCESS, Security 44978932790 SUCCESS؛ WP1 44978932846 هنگام ثبت هنوز در حال اجرا؛ WP2 اجرا نشده | بررسی exact-head WP2 و گیت‌ها؛ سپس تحویل به Codex اصلی، بدون merge/deploy |

| FIN-QA-POSITIVE-RPC | احراز آزمون مثبت ثبت و قطعی‌کردن سند دستی با JWT واقعی | QA مستقل؛ سرور/مالی نزد Codex اصلی | PR222 و WP2 disposable؛ RPC موجود | در پیاده‌سازی / منتظر CI | واقعی بودن JWT، create→replay→post، تراز و نسخه/شماره، rollback خطا، همهٔ گیت‌ها | QA follow-on stacked on PR222 | پیش از این تغییر فقط آزمون منفی `scripts/wp3-financial-tenant-e2e.mjs` وجود داشت؛ اجرا هنوز ادعا نشده | اجرای WP2 و Quality/WP1/Security روی SHA جدید؛ خروجی واقعی در همین ردیف ثبت شود |

| FIN-QA-SOURCE-JWT-ATOMIC | اثبات واقعی پیوند تراکنشی منبع از قبل ثبت‌شده، rollback و retry | QA مستقل؛ پذیرش Codex اصلی | PR218 migration `20261117110000` و PR224 CI موفق | در بررسی / در پیاده‌سازی | JWT مثبت فروش، پیوند اتمیک، رقابت دو اتصال، replay با شناسه دیگر، برگشت شمارنده/سند در شکستِ پیوند، CI SHA نهایی | QA successor stacked on PR224 | PR224 `6f16c00b` چهار گیت موفق؛ WP2 روی 3f8e8a9c موفق (44982073582) و Security موفق (44982073480)؛ کنترل audit تکمیلی برای SHA بعدی افزوده شد | بررسی WP2/Quality/WP1/Security؛ بررسی مستقل، بدون merge یا تغییر مالی |

| FIN-QA-ATF-CONCURRENCY | اثبات هم‌زمانی شماره عطف دائمی در کاندیدای موجود | QA مستقل؛ یکپارچه‌سازی Codex اصلی | ADR0216، `supabase/candidates/0216_attachment_registry.sql`، WP1 | در بررسی / منتظر CI | دو اتصال واقعی با شناسه مشترک/مستقل، عدم جابه‌جایی شرکت، rollback/tombstone/tenant | QA successor stacked on PR225 | WP1 تک‌نشستی روی PR225 موفق؛ آزمون دو‌نشستی جدید هنوز اجرا نشده | WP1 روی SHA جدید، بازبینی Codex اصلی؛ **فقط کاندیدا، نه محصول** |

| FIN-QA-POSTED-SOURCE-GUARD | منع تغییر و حذف سند منشأ قطعی از JWT واقعی | QA مستقل؛ تصمیم نهایی Codex اصلی | PR225 source-autopost و Stage3 guard موجود | در بررسی / منتظر CI | رد صریح PATCH/DELETE، جعل پیوند، سطر دفتر کل و حذف voucher؛ بدون تغییر داده/audit | QA successor stacked on PR226 | PR226 سه گیت موفق؛ WP2 برای SHA جدید باید اجرا شود | آزمون و بازبینی مستقل، بدون تغییر محصول |

| FIN-QA-PURCHASE-JWT | تأیید JWT واقعی خرید اعتباری در کنار فروش | QA مستقل؛ مالک یکپارچه‌سازی Codex اصلی | SQL purchase-v1 و PR227 گرین | در بررسی / منتظر CI | ثبت خرید با حساب هزینه/پرداختنی، لینک، replay، audit، شماره، منع جعل و حذف | QA successor stacked on PR227 | SQL خرید قبلاً موفق؛ خرید JWT روی شاخهٔ جدید هنوز در حال آزمون | WP2 و سایر گیت‌های همان SHA و بازبینی مستقل |

**Release boundary:** successful Pages run 43606173842 applies only to `main dab1a45`; no candidate above is `منتشرشده`. Competing PR214/215/217/219 are alternative implementations, not sequential milestones. This worker changes documentation only; Codex main owns integration and release decisions.


**2026-11-22 correction of earlier roadmap checkpoint:** The prior sentence “this worker changes documentation only” described the initial assignment, not the final PR221. PR221 also contains the two scoped code fixes and three QA fixture changes above. Earlier red CI figures remain historical; they are superseded for the tested code SHA by the exact-head 251/251 PASS. No financial core merge, independent approval, production release, historical conversion or real-service posting acceptance follows from this pass. This register remains attached to the approved Phase 6/8 roadmap, not a new phase.


### FIN-P0-229-AUTHZ — Issue229 real-JWT approval boundary (Phase 6 / 8; QA only)

| شناسه | هدف | مسئول | وابستگی | وضعیت | معیار پذیرش | PR/SHA | شاهد | اقدام بعدی |
|---|---|---|---|---|---|---|---|---|
| FIN-P0-229-AUTHZ | اثبات عملی جدانبودن مجوز ثبت منبع و قطعی‌سازی در autopost موجود | QA مستقل؛ بازبین/مالک کد مالی Codex اصلی | PR230→PR228→PR218/PR212، Issue229 و ADR0216 | در پیاده‌سازی (CI دقیق لازم است) | تست JWT غیرمالک فقط commerce:create و بدون accounting:approve از سرویس واقعی؛ تأیید source+posted voucher+خطوط+audit+counter؛ گزارش صریح expected-RED، بدون اعلام رفع نقص | شاخه qa/issue229-approval-boundary-jwt-20261122، SHA نهایی پس از CI | `scripts/wp2-source-approval-boundary-jwt-e2e.mjs` و `.github/workflows/free-supabase-local-e2e.yml` (نتیجه CI هنوز بررسی نشده) | اجرای واقعی WP2 و سایر گیت‌ها روی SHA نهایی؛ کد مالی/ادغام/انتشار فقط با مالک |
