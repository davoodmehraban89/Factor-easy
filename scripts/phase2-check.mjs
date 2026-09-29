import fs from 'node:fs';
import vm from 'node:vm';
const af=fs.readFileSync('js/accounting-foundation.js','utf8');
const render=fs.readFileSync('js/accounting-foundation-render.js','utf8');
const companies=fs.readFileSync('js/companies.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const core=fs.readFileSync('js/core.js','utf8');
const backup=fs.readFileSync('js/backup.js','utf8');
const journal=fs.readFileSync('js/journal-engine.js','utf8');
const phase4=fs.readFileSync('js/phase4-contracting.js','utf8');
const sync=fs.readFileSync('js/sync.js','utf8');
const must=(src,needles,label)=>{for(const n of needles)if(!src.includes(n))throw new Error(label+' missing '+n)};
must(af,['AF_COMPANY_TYPES','AF_BASE_ACCOUNTS','AF_SPECIAL_ACCOUNTS','afApplyTemplate','afDimensionValuePostable','afDimensionHasValues','afDimensionValueReferenced','postingProfiles','afChangeDimensionDepth','depthLocked','maxDepth','startDate>=endDate','afNormalizeAccountImportRows','afImportAccountsFromExcel','downloadAccountsExcelTemplate',"'CONTRACT','قرارداد / پیمان','contract',1,4",'slot:Number(slot)||0','afAccountTypeForCode','accountType',"['1108','مالیات و عوارض دریافتنی'"],'accounting foundation');
must(render,['afDimensionValuePostable','afChangeDimensionDepth','عمق قفل شده','قابل ثبت','گروه/غیرقابل ثبت','تفصیلی شناور'],'dimension rendering');
must(companies,['company-activity-type','company-accounting-template','afApplyTemplate(newComp.id,activityType)'],'company onboarding');
must(index,['company-activity-type','company-accounting-template','بازرگانی','خدماتی','تولیدی','پیمانکاری','فروشگاهی','پخش','غیرانتفاعی','خدمات حرفه‌ای'],'company activity UI');
must(fs.readFileSync('js/accounting-foundation-ui.js','utf8'),['ورود کدینگ از Excel','نمونه Excel کدینگ','شناور ۱ شعبه','شناور ۴ قرارداد/پیمان','value="contract"','af-account-type','<th>نوع</th>'],'accounting contract UI');
must(journal,["t.sourceEntity==='contract'","contractId:source.contractId||''"],'contract analytic posting context');
must(phase4,['contractId:c.id'],'contracting analytic source context');
for(const coll of ['fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks']){
 if(!core.includes("'"+coll+"'")||!sync.includes(coll)||!backup.includes(coll))throw new Error('Phase 2 persistence missing '+coll);
}
if(!af.includes("(v.depth||1)===Number(t.maxDepth||1)"))throw new Error('Only configured terminal depth may post');
if(!af.includes("if(afDimensionHasValues(id))return alert"))throw new Error('Hierarchy depth must lock after values exist');
if(!af.includes("afDimensionValueReferenced(id)"))throw new Error('Referenced analytic values must be protected');
const ctx={console};vm.createContext(ctx);vm.runInContext(af,ctx);
const imported=vm.runInContext(`afNormalizeAccountImportRows([
 {'کد':'1','عنوان':'دارایی‌ها','سطح':'کل','ماهیت':'بدهکار'},
 {'کد':'11','عنوان':'دارایی جاری','سطح':'معین','کد والد':'1','ماهیت':'بدهکار'},
 {'کد':'1101','عنوان':'بانک','سطح':'تفصیلی','کد والد':'11','ماهیت':'بدهکار'}
])`,ctx);
if(imported.length!==3||imported[2].level!=='detail'||imported[2].parentCode!=='11'||imported[2].normalBalance!=='debit')throw new Error('Chart Excel normalization behavior failed');
let badParent=false;try{vm.runInContext(`afNormalizeAccountImportRows([{'کد':'1101','عنوان':'بانک','سطح':'تفصیلی','کد والد':'99'}])`,ctx)}catch(_){badParent=true}
if(!badParent)throw new Error('Chart import must reject invalid hierarchy');
console.log('Phase 2 accounting foundation invariants passed.');
