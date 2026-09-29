import fs from 'node:fs';
import vm from 'node:vm';

// Execute the application modules, replacing only browser/network scheduling.
export function journalFixture({template = true} = {}) {
  const alerts = [];
  const elements = new Map();
  const context = vm.createContext({
    console, Intl, Date, Math, JSON, Map, Set,
    currentUser: {id: 'user-a'}, writable: true,
    canWrite() { return context.writable; },
    requireWrite() { return context.writable; },
    setTimeout() { return 1; }, clearTimeout() {},
    alert(message) { alerts.push(message); }, confirm() { return true; },
    getJalaliNumeric() { return '1405/07/06'; },
    toEnDigits(value) { return String(value).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); },
    document: {addEventListener() {}, getElementById(id) { return elements.get(id) || null; }},
    window: {addEventListener() {}}, renderAccountingFoundation() {}, refreshAllSurfaces() {},
  });
  const run = code => vm.runInContext(code, context);
  for (const path of ['js/sync.js', 'js/accounting-foundation.js', 'js/journal-engine.js']) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, {filename: path});
  }
  run(`datastore.companies.push({id:'company-a',ownerUserId:'user-a'});
    datastore.contacts.push({id:'party-a',ownerUserId:'user-a',name:'Party'});
    getMySettings().default_company_id='company-a'; afSeed();`);
  if (template) run("afApplyTemplate('company-a','trading')");
  return {context, run, alerts, elements, get state() { return run('datastore'); }};
}

export function sale(overrides = {}) {
  return {id:'sale-a',ownerUserId:'user-a',companyId:'company-a',date:'1405/07/06',kind:'formal',paymentMethod:'credit',contactId:'party-a',grandTotal:110,vat:10,...overrides};
}
