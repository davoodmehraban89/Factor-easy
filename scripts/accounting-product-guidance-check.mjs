import fs from'node:fs';function ok(v,m){if(!v)throw new Error(m)}
const html=fs.readFileSync('index.html','utf8'),af=fs.readFileSync('js/accounting-foundation.js','utf8'),ui=fs.readFileSync('js/accounting-foundation-ui.js','utf8'),p=fs.readFileSync('js/products.js','utf8'),inv=fs.readFileSync('js/invoices.js','utf8'),ux=fs.readFileSync('js/ux-hardening-r2.js','utf8'),help=fs.readFileSync('js/context-help.js','utf8');
ok(ui.includes('کد سیستمی')&&ui.includes('value="خودکار" readonly'),'Floating-detail codes must not be user-entered.');
ok(af.includes('afNextDimensionCode')&&af.includes('afNextDimensionValueCode'),'Dimension type/value codes must be generated.');
ok(help.includes('راهنمای تفصیلی شناور')&&help.includes('راهنمای کدینگ کالا و خدمت'),'Contextual accounting/product guidance must exist.');
ok(!html.includes('id="prod-internal-id-input"')&&!html.includes('id="quick-p-internal-id"'),'Duplicate product internal-id inputs must be removed.');
ok(inv.includes("prod.code||intEl?.value"),'Electronic-document internal item ID must derive from product code.');
ok(p.includes('nextProductCode')&&p.includes("padStart(4,'0')")&&p.includes('subcategory'),'New product code generator must use stable group/subgroup prefix plus four-digit sequence.');
ok(html.includes('id="prod-subcategory-input"')&&html.includes('id="prod-code-input" class="form-control" placeholder="خودکار پس از ثبت" readonly'),'Product group/subgroup coding must be explicit while product code stays system-generated.');
ok(ux.includes('searchNorm')&&ux.includes('tokens.every'),'Search must normalize Persian/Arabic forms and match all typed fragments.');
ok(html.includes('finora-commercial-head')&&html.includes("finoraShowGuide('invoices')"),'Sale workspace must use the stable commercial header and contextual guide.');
const pur=fs.readFileSync('js/purchases.js','utf8');ok(pur.includes('finora-commercial-head')&&!pur.includes("data-view=\"view-purchases\""),'Purchase workspace must share the stable commercial header without injecting a duplicate sidebar route.');
ok(html.includes('aria-hidden="true"')&&html.includes('قالب داخلی سند'),'Internal invoice-kind control must not duplicate the public commercial document selector.');
console.log('Accounting/product guidance invariants passed.');
