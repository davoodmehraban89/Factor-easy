import fs from'node:fs';function ok(v,m){if(!v)throw new Error(m)}
const html=fs.readFileSync('index.html','utf8'),af=fs.readFileSync('js/accounting-foundation.js','utf8'),ui=fs.readFileSync('js/accounting-foundation-ui.js','utf8'),p=fs.readFileSync('js/products.js','utf8'),inv=fs.readFileSync('js/invoices.js','utf8'),ux=fs.readFileSync('js/ux-hardening-r2.js','utf8'),help=fs.readFileSync('js/context-help.js','utf8');
ok(ui.includes('کد سیستمی')&&ui.includes('value="خودکار" readonly'),'Floating-detail codes must not be user-entered.');
ok(af.includes('afNextDimensionCode')&&af.includes('afNextDimensionValueCode'),'Dimension type/value codes must be generated.');
ok(help.includes('راهنمای تفصیلی شناور')&&help.includes('راهنمای کدینگ کالا و خدمت'),'Contextual accounting/product guidance must exist.');
ok(!html.includes('id="prod-internal-id-input"')&&!html.includes('id="quick-p-internal-id"'),'Duplicate product internal-id inputs must be removed.');
ok(inv.includes("prod.code||intEl?.value"),'Electronic-document internal item ID must derive from product code.');
ok(p.includes('nextProductCode')&&p.includes("padStart(4,'0')"),'New product code generator must use group prefix plus four-digit sequence.');
ok(ux.includes('searchNorm')&&ux.includes('tokens.every'),'Search must normalize Persian/Arabic forms and match all typed fragments.');
console.log('Accounting/product guidance invariants passed.');
