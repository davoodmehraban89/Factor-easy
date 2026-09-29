# Finora UX / Accounting Benchmark V3 — 2026-09-30

## Why this revision exists
The owner rejected the first-pass accountant UX as too weak. Four current Finora screenshots show two concrete defects: the Accounting Journal workspace leaks below unrelated Inventory/Settings workspaces, and the contextual subsystem panel uses a top close button that disappears with the panel. This revision treats accountant workflow and information architecture as a product contract, not decoration.

## Representative benchmark set
Iran / local-market patterns reviewed: Rahkaran/System Group and Sepidar (module-oriented enterprise/SME accounting), Parmis Star (modular accounting/treasury/inventory/commerce), Mahak (task-oriented commerce/treasury/accounting), plus the prior repository research covering Holoo and Gheyas. International official product structures reviewed: Microsoft Dynamics 365 Finance, Oracle Fusion Cloud Financials, SAP S/4HANA/Fiori, QuickBooks Online, Xero, Zoho Books, Sage Intacct, Acumatica, Odoo Accounting, and NetSuite.

Primary official references:
- Microsoft Dynamics 365 Finance navigation and finance areas: https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/user-interface/page-navigation and https://learn.microsoft.com/en-us/dynamics365/finance/
- Oracle Fusion Financials overview/navigation: https://docs.oracle.com/en/cloud/saas/financials/25d/facsf/overview-of-oracle-financials-cloud.html
- SAP Fiori spaces/pages and S/4HANA finance: https://help.sap.com/docs/btp/sap-fiori-launchpad-for-sap-btp/spaces-and-pages and https://help.sap.com/docs/SAP_S4HANA_CLOUD/0fa84c9d9c634132b7c4abb9ffdd8f06/d230dc878a5e427c88d37db7d7f1cd17-568.html
- QuickBooks navigation/+Create/bookmarks: https://quickbooks.intuit.com/learn-support/en-us/help-article/bookkeeping-processes/understand-navigation-menu-quickbooks-online/L310NeoHY_US_en_US
- Xero web navigation: https://central.xero.com/0/article/Menus-icons-and-tabs-in-Xero
- Zoho Books module model: https://www.zoho.com/us/books/help/accountant/accountant.html
- Sage Intacct core financials: https://www.sage.com/en-us/sage-business-cloud/intacct/product-capabilities/core-financials/
- Acumatica financial management: https://www.acumatica.com/cloud-erp-software/financial-management/
- Odoo chart/accounting structure: https://www.odoo.com/documentation/17.0/applications/finance/accounting/get_started/chart_of_accounts.html
- NetSuite role/navigation model: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4323290738.html
- Sepidar system grouping: https://www.sepidarsystem.com/products/sepidar/
- Parmis Star ERP/module grouping: https://www.parmisit.com/products/parmis-star-erp-solution
- Mahak company-accounting capability grouping: https://www.mahaksoft.com/%D8%AD%D8%B3%D8%A7%D8%A8%D8%AF%D8%A7%D8%B1%DB%8C-%D8%B4%D8%B1%DA%A9%D8%AA%DB%8C/

Apple does not provide a first-party enterprise accounting/ERP suite comparable to Dynamics/SAP/Oracle; therefore Finora must not invent an “Apple accounting” workflow. Apple can be a visual-usability reference, not an accounting-domain source.

## Patterns worth adopting
1. **Stable business domains, contextual tasks:** Dynamics uses dashboard/navigation pane/workspaces/modules; SAP uses role-based spaces/pages; Oracle exposes a global navigation area plus task applications. Finora keeps a narrow stable primary rail and one adjacent contextual task panel.
2. **Never strand navigation:** collapsing a task panel must leave a persistent recovery affordance. Finora uses an edge-mounted handle, not a disappearing ×.
3. **One workspace owns the screen:** unrelated task surfaces must never remain visible. Accounting Journal is a normal view-pane and is hidden when Inventory, Settings, Assets, etc. are active.
4. **Global create + global search:** QuickBooks/Xero/Zoho make frequent creation/search actions reachable without drilling through menus. Finora adds a real quick-create menu using only implemented workflows.
5. **Setup / transactions / reports are distinct:** account structure and dimensions belong to setup; journals and operational documents to transactions; ledgers/statements/aging to reports. Contextual groups follow this mental model.
6. **Legal entity context is not business activity:** Dynamics/Oracle/SAP distinguish legal entity/company context from ledger/accounting configuration. Finora therefore stores person type, ownership/sector and legal form separately from activity type used to seed accounting.
7. **Role/context density over decorative UI:** professional systems optimize for repeatable tasks, drill-down, search, recent/favorite access and clear state. Finora should remain restrained and accountant-first.

## Finora V3 acceptance contract
- Primary rail never expands accordion children beneath itself.
- Contextual panel remains adjacent to the rail and can always be collapsed/reopened from its edge handle.
- No development labels such as “Phase 3” appear in production UI.
- Journal workspace cannot leak into Inventory/Settings/other modules.
- Company master distinguishes: person type; ownership/sector; legal registration form; operational activity type.
- No fake module is exposed. Quick-create routes only to implemented screens.
- Print isolation remains deterministic: formal/pre-invoice A4 landscape; non-formal A5 landscape.
- Real-DOM CI verifies the navigation handle, workspace isolation, company legal-form controls and print PDF page sizes.
