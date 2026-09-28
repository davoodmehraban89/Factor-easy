import fs from 'node:fs';
const af=fs.readFileSync('js/accounting-foundation.js','utf8');
const render=fs.readFileSync('js/accounting-foundation-render.js','utf8');
const companies=fs.readFileSync('js/companies.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const core=fs.readFileSync('js/core.js','utf8');
const backup=fs.readFileSync('js/backup.js','utf8');
const sync=fs.readFileSync('js/sync.js','utf8');
const must=(src,needles,label)=>{for(const n of needles)if(!src.includes(n))throw new Error(label+' missing '+n)};
must(af,['AF_COMPANY_TYPES','AF_BASE_ACCOUNTS','AF_SPECIAL_ACCOUNTS','afApplyTemplate','afDimensionValuePostable','afDimensionHasValues','afDimensionValueReferenced','afChangeDimensionDepth','depthLocked','maxDepth','startDate>=endDate'],'accounting foundation');
must(render,['afDimensionValuePostable','afChangeDimensionDepth','عمق قفل شده','قابل ثبت','گروه/غیرقابل ثبت'],'dimension rendering');
must(companies,['company-activity-type','company-accounting-template','afApplyTemplate(newComp.id,activityType)'],'company onboarding');
must(index,['company-activity-type','company-accounting-template','بازرگانی','خدماتی','تولیدی','پیمانکاری','فروشگاهی','پخش','غیرانتفاعی','خدمات حرفه‌ای'],'company activity UI');
for(const coll of ['fiscalYears','accounts','dimensionTypes','dimensionValues','accountDimensionRules','branches','projects','projectLinks']){
 if(!core.includes("'"+coll+"'")||!sync.includes(coll)||!backup.includes(coll))throw new Error('Phase 2 persistence missing '+coll);
}
if(!af.includes("(v.depth||1)===Number(t.maxDepth||1)"))throw new Error('Only configured terminal depth may post');
if(!af.includes("if(afDimensionHasValues(id))return alert"))throw new Error('Hierarchy depth must lock after values exist');
if(!af.includes("afDimensionValueReferenced(id)"))throw new Error('Referenced analytic values must be protected');
console.log('Phase 2 accounting foundation invariants passed.');
