/* Phase 2: accounting foundation — safety-first master data */
const AF_LEVELS={gl:'کل',subsidiary:'معین',detail:'تفصیلی'},AF_NATURE={debit:'بدهکار',credit:'بستانکار',both:'دوماهیتی'};
const AF_COMPANY_TYPES={
 trading:'بازرگانی',service:'خدماتی',manufacturing:'تولیدی',contracting:'پیمانکاری',
 retail:'فروشگاهی',distribution:'پخش',nonprofit:'غیرانتفاعی',professional:'خدمات حرفه‌ای'
};
const AF_BASE_ACCOUNTS=[
 ['1','دارایی‌ها','gl','debit',''],['11','دارایی‌های جاری','subsidiary','debit','1'],['1101','صندوق و بانک','detail','debit','11'],['1102','حساب‌های دریافتنی','detail','debit','11'],['1103','موجودی کالا و مواد','detail','debit','11'],['1104','پیش‌پرداخت‌ها','detail','debit','11'],
 ['2','بدهی‌ها','gl','credit',''],['21','بدهی‌های جاری','subsidiary','credit','2'],['2101','حساب‌های پرداختنی','detail','credit','21'],['2102','مالیات و عوارض پرداختنی','detail','credit','21'],['2103','سپرده‌ها و کسورات پرداختنی','detail','credit','21'],
 ['3','حقوق مالکانه','gl','credit',''],['31','سرمایه و اندوخته‌ها','subsidiary','credit','3'],['3101','سرمایه','detail','credit','31'],['3102','سود و زیان انباشته','detail','credit','31'],
 ['4','درآمدها','gl','credit',''],['41','درآمد عملیاتی','subsidiary','credit','4'],['4101','فروش / درآمد خدمات','detail','credit','41'],['42','سایر درآمدها','subsidiary','credit','4'],['4201','سایر درآمدهای عملیاتی و غیرعملیاتی','detail','credit','42'],
 ['5','بهای تمام‌شده','gl','debit',''],['51','بهای تمام‌شده عملیات','subsidiary','debit','5'],['5101','بهای تمام‌شده کالای فروش‌رفته / خدمات','detail','debit','51'],
 ['6','هزینه‌ها','gl','debit',''],['61','هزینه‌های اداری و عمومی','subsidiary','debit','6'],['6101','حقوق و دستمزد','detail','debit','61'],['6102','اجاره و خدمات محل','detail','debit','61'],['6103','هزینه‌های عمومی','detail','debit','61']
];
const AF_SPECIAL_ACCOUNTS={
 manufacturing:[['52','تولید و ساخت','subsidiary','debit','5'],['5201','مواد مستقیم مصرفی','detail','debit','52'],['5202','دستمزد مستقیم','detail','debit','52'],['5203','سربار تولید','detail','debit','52'],['5204','کالای در جریان ساخت','detail','debit','52']],
 contracting:[['43','درآمد پیمان','subsidiary','credit','4'],['4301','درآمد صورت‌وضعیت پیمان','detail','credit','43'],['53','هزینه پیمان','subsidiary','debit','5'],['5301','هزینه مستقیم پیمان','detail','debit','53'],['5302','پیمانکاران جزء','detail','debit','53'],['1105','مطالبات حسن انجام کار','detail','debit','11'],['2104','سپرده حسن انجام کار','detail','credit','21']],
 retail:[['4102','فروش خرده‌فروشی','detail','credit','41'],['6104','تخفیفات و پروموشن','detail','debit','61']],
 distribution:[['4103','فروش پخش','detail','credit','41'],['6105','هزینه توزیع و حمل','detail','debit','61']],
 nonprofit:[['4104','کمک‌ها و درآمدهای غیرانتفاعی','detail','credit','41'],['6106','هزینه برنامه‌ها و مأموریت','detail','debit','61']],
 professional:[['4105','درآمد خدمات حرفه‌ای','detail','credit','41'],['6107','حق‌الزحمه همکاران و متخصصان','detail','debit','61']],
 service:[['4106','درآمد خدمات','detail','credit','41'],['6108','هزینه ارائه خدمات','detail','debit','61']],
 trading:[['4107','فروش کالا','detail','credit','41'],['5102','خرید و بهای کالای فروش‌رفته','detail','debit','51']]
};
function afCompanyId(){const s=getMySettings(),c=getMyCompanies();return s.default_company_id||c[0]?.id||'';}
function afOwned(k){const cid=afCompanyId();return(datastore[k]||[]).filter(x=>x.ownerUserId===currentUser?.id&&(!x.companyId||x.companyId===cid));}
function getMyFiscalYears(){return afOwned('fiscalYears')} function getMyAccounts(){return afOwned('accounts')}
function getMyDimensionTypes(){return afOwned('dimensionTypes')} function getMyDimensionValues(){return afOwned('dimensionValues')}
function getMyAccountDimensionRules(){return afOwned('accountDimensionRules')} function getMyBranches(){return afOwned('branches')}
function getMyGlobalProjects(){return afOwned('projects')}
function afId(p){return p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function afCode(v){return String(v||'').trim().replace(/\s+/g,'-').slice(0,32)}
function afNeedCompany(){const id=afCompanyId();if(!id)alert('ابتدا یک شرکت تعریف و فعال کنید.');return id}
function afProjectUsed(id){return (typeof getMyContracts==='function'&&getMyContracts().some(x=>x.projectId===id))||getMyInvoices().some(x=>x.projectId===id)||getMyPurchases().some(x=>x.projectId===id||x.costCenterId===id)||getMyExpenses().some(x=>x.projectId===id)||getMyPayments().some(x=>x.projectId===id)}
function afResolvedValues(t){if(t.sourceEntity==='contact')return getMyContacts().map(x=>({id:x.id,title:x.name,depth:1,postable:true}));if(t.sourceEntity==='project')return getMyGlobalProjects().map(x=>({id:x.id,title:x.name,depth:1,postable:true}));if(t.sourceEntity==='branch')return getMyBranches().map(x=>({id:x.id,title:x.name,depth:1,postable:true}));return getMyDimensionValues().filter(x=>x.dimensionTypeId===t.id).map(x=>({...x,postable:afDimensionValuePostable(x,t)}))}
function afDimensionValuePostable(v,t){return !!v&&!!t&&v.active!==false&&(v.depth||1)===Number(t.maxDepth||1)&&!getMyDimensionValues().some(x=>x.dimensionTypeId===t.id&&x.parentId===v.id&&x.active!==false)}
function afDimensionHasValues(typeId){return getMyDimensionValues().some(x=>x.dimensionTypeId===typeId)}
function afDimensionValueReferenced(id){return Object.keys(datastore).some(k=>k!=='dimensionValues'&&(datastore[k]||[]).some(r=>{try{return JSON.stringify(r).includes('"'+id+'"')}catch(_){return false}}))}
function afSeed(){
 if(!currentUser||!afCompanyId())return;let ch=false,cid=afCompanyId();
 if(!getMyFiscalYears().length){const y=toEnDigits(String(getJalaliNumeric()).split('/')[0]);datastore.fiscalYears.push({id:afId('FY'),ownerUserId:currentUser.id,companyId:cid,title:'سال مالی '+y,startDate:y+'/01/01',endDate:y+'/12/29',status:'open',createdAt:new Date().toISOString()});ch=true}
 if(ch)saveDatastore();
}
function afMigrateLegacyProjects(){
 if(!currentUser||!afCompanyId())return;const s=getMySettings();const key='accountingFoundationMigrationV2_'+afCompanyId();if(s[key])return;let ch=false;
 getMyContacts().forEach(c=>(c.projects||[]).forEach(p=>{let g=datastore.projects.find(x=>x.id===p.id&&x.ownerUserId===currentUser.id);if(!g){g={id:p.id,ownerUserId:currentUser.id,companyId:afCompanyId(),code:p.id,name:p.name,parentId:'',direction:p.direction||'both',linkedContactIds:[c.id],active:true,legacy:true};datastore.projects.push(g);ch=true}else if(!(g.linkedContactIds||[]).includes(c.id)){g.linkedContactIds=[...(g.linkedContactIds||[]),c.id];ch=true}(p.subprojects||[]).forEach(z=>{let q=datastore.projects.find(x=>x.id===z.id&&x.ownerUserId===currentUser.id);if(!q){datastore.projects.push({id:z.id,ownerUserId:currentUser.id,companyId:afCompanyId(),code:z.id,name:z.name,parentId:p.id,direction:z.direction||p.direction||'both',linkedContactIds:[c.id],active:true,legacy:true});ch=true}})}));
 s[key]={completedAt:new Date().toISOString(),mode:'copy-preserve-ids'};if(ch||!s[key])saveDatastore();else saveDatastore();
}
function afCreateDimension(cid,code,title,sourceEntity,maxDepth=1){
 if(getMyDimensionTypes().some(x=>x.code===code))return getMyDimensionTypes().find(x=>x.code===code);
 const d={id:afId('DIM'),ownerUserId:currentUser.id,companyId:cid,code,title,maxDepth:Number(maxDepth),depthLocked:false,leafOnlyPosting:true,active:true,sourceType:sourceEntity==='manual'?'manual':'entity-backed',sourceEntity};
 datastore.dimensionTypes.push(d);return d;
}
function afApplyTemplate(companyId,type){
 if(!requireWrite()||!companyId)return false;const company=getMyCompanies().find(x=>x.id===companyId);if(!company)return false;
 if(getMyAccounts().some(x=>x.companyId===companyId)){alert('برای این شرکت کدینگ وجود دارد؛ قالب روی کدینگ موجود اعمال نشد.');return false}
 const previous=getMySettings().default_company_id;getMySettings().default_company_id=companyId;
 try{
  const rows=[...AF_BASE_ACCOUNTS,...(AF_SPECIAL_ACCOUNTS[type]||[])],byCode={};
  rows.forEach(r=>{const [code,title,level,normalBalance,parentCode]=r;const a={id:afId('ACC'),ownerUserId:currentUser.id,companyId,code,title,level,parentId:parentCode?(byCode[parentCode]?.id||''):'',normalBalance,postingAllowed:level==='detail',active:true,template:type};datastore.accounts.push(a);byCode[code]=a});
  const branch=afCreateDimension(companyId,'BRANCH','شعبه','branch',1);
  const party=afCreateDimension(companyId,'COUNTERPARTY','طرف حساب','contact',1);
  const project=afCreateDimension(companyId,'PROJECT','پروژه','project',1);
  const cost=afCreateDimension(companyId,'COST_ELEMENT','عناصر هزینه','manual',3);
  const addRule=(code,d,app)=>{const a=byCode[code];if(a&&!datastore.accountDimensionRules.some(x=>x.accountId===a.id&&x.dimensionTypeId===d.id))datastore.accountDimensionRules.push({id:afId('ADR'),ownerUserId:currentUser.id,companyId,accountId:a.id,dimensionTypeId:d.id,applicability:app,allowedValuesMode:'all',active:true})};
  ['1102','2101'].forEach(c=>addRule(c,party,'required'));['1101','4101','5101','6101','6102','6103'].forEach(c=>addRule(c,branch,'optional'));
  if(type==='contracting'){['4301','5301','5302','1105','2104'].forEach(c=>addRule(c,project,'required'))}
  if(['service','manufacturing','contracting','professional'].includes(type)){['6101','6102','6103','5101'].forEach(c=>addRule(c,cost,'optional'))}
  company.activityType=type;company.accountingTemplate={type,appliedAt:new Date().toISOString(),version:1};saveDatastore();return true;
 }finally{getMySettings().default_company_id=companyId;saveDatastore()}
}
function afSaveAccount(){
 if(!requireWrite())return;const cid=afNeedCompany();if(!cid)return;
 const level=document.getElementById('af-account-level').value,code=afCode(document.getElementById('af-account-code').value),title=document.getElementById('af-account-title').value.trim(),normalBalance=document.getElementById('af-account-nature').value,parentId=document.getElementById('af-account-parent').value;
 if(!code||!title)return alert('کد و عنوان حساب الزامی است.');if(getMyAccounts().some(x=>x.code===code))return alert('کد حساب تکراری است.');
 const need=level==='subsidiary'?'gl':level==='detail'?'subsidiary':'';if(need&&!getMyAccounts().some(x=>x.id===parentId&&x.level===need))return alert('حساب والد معتبر انتخاب کنید.');
 datastore.accounts.push({id:afId('ACC'),ownerUserId:currentUser.id,companyId:cid,code,title,level,parentId:parentId||'',normalBalance,postingAllowed:level==='detail',active:true});saveDatastore();renderAccountingFoundation();
}
function afDeleteAccount(id){if(!requireWrite())return;if((datastore.journalLines||[]).some(x=>x.accountId===id))return alert('این حساب در دفتر حسابداری استفاده شده و قابل حذف نیست؛ فقط غیرفعال‌سازی مجاز است.');if(getMyAccounts().some(x=>x.parentId===id))return alert('حساب دارای زیرحساب است.');if(getMyAccountDimensionRules().some(x=>x.accountId===id))return alert('ابتدا قواعد تفصیلی حساب را حذف کنید.');if(confirm('حساب حذف شود؟')){datastore.accounts=datastore.accounts.filter(x=>x.id!==id);saveDatastore();renderAccountingFoundation()}}
function afSaveRule(){if(!requireWrite())return;const cid=afNeedCompany(),accountId=document.getElementById('af-rule-account').value,dimensionTypeId=document.getElementById('af-rule-dimension').value,applicability=document.getElementById('af-rule-app').value,a=getMyAccounts().find(x=>x.id===accountId),d=getMyDimensionTypes().find(x=>x.id===dimensionTypeId);if(!cid||!a?.postingAllowed||!d?.active)return alert('حساب ثبت‌پذیر و تفصیلی فعال انتخاب کنید.');let r=getMyAccountDimensionRules().find(x=>x.accountId===accountId&&x.dimensionTypeId===dimensionTypeId);if(r)r.applicability=applicability;else datastore.accountDimensionRules.push({id:afId('ADR'),ownerUserId:currentUser.id,companyId:cid,accountId,dimensionTypeId,applicability,allowedValuesMode:'all',active:true});saveDatastore();renderAccountingFoundation()}
function afDeleteRule(id){if(!requireWrite())return;const rule=getMyAccountDimensionRules().find(x=>x.id===id);if(rule&&(datastore.journalLines||[]).some(l=>l.accountId===rule.accountId))return alert('این حساب دارای سابقه دفتر است؛ تغییر ساختار تفصیلی باید از مسیر نسخه‌بندی/دوره جدید انجام شود.');datastore.accountDimensionRules=datastore.accountDimensionRules.filter(x=>x.id!==id);saveDatastore();renderAccountingFoundation()}
function afSaveDimension(){if(!requireWrite())return;const cid=afNeedCompany(),code=afCode(document.getElementById('af-dim-code').value).toUpperCase(),title=document.getElementById('af-dim-title').value.trim(),sourceEntity=document.getElementById('af-dim-source').value,maxDepth=Math.max(1,Math.min(8,+document.getElementById('af-dim-depth').value||1));if(!cid||!code||!title)return alert('کد و عنوان الزامی است.');if(getMyDimensionTypes().some(x=>x.code===code))return alert('کد تکراری است.');if(sourceEntity!=='manual'&&maxDepth!==1)return alert('تفصیلی متصل به داده پایه در این فاز عمق ۱ دارد؛ برای ساختار چندسطحی نوع «دستی» را انتخاب کنید.');datastore.dimensionTypes.push({id:afId('DIM'),ownerUserId:currentUser.id,companyId:cid,code,title,maxDepth,depthLocked:false,leafOnlyPosting:true,active:true,sourceType:sourceEntity==='manual'?'manual':'entity-backed',sourceEntity});saveDatastore();renderAccountingFoundation()}
function afChangeDimensionDepth(id){
 if(!requireWrite())return;const t=getMyDimensionTypes().find(x=>x.id===id);if(!t||t.sourceEntity!=='manual')return alert('عمق تفصیلی متصل به داده پایه ثابت است.');
 if(afDimensionHasValues(id))return alert('تا وقتی حتی یک مقدار در این تفصیلی وجود دارد، عمق ساختار قابل تغییر نیست. ابتدا مقادیر بدون ارجاع را حذف کنید.');
 const raw=prompt('عمق جدید ساختار را از ۱ تا ۸ وارد کنید:',String(t.maxDepth||1));if(raw===null)return;const n=Number(toEnDigits(raw));if(!Number.isInteger(n)||n<1||n>8)return alert('عمق باید عدد صحیح بین ۱ تا ۸ باشد.');
 t.maxDepth=n;t.depthLocked=false;t.updatedAt=new Date().toISOString();saveDatastore();renderAccountingFoundation();
}
function afDeleteDimension(id){
 if(!requireWrite())return;if(afDimensionHasValues(id))return alert('این تفصیلی دارای مقدار است و قابل حذف نیست.');if(getMyAccountDimensionRules().some(x=>x.dimensionTypeId===id))return alert('این تفصیلی به حساب‌ها متصل است؛ ابتدا قواعد حساب را حذف کنید.');
 const t=getMyDimensionTypes().find(x=>x.id===id);if(!t)return;if(confirm('تفصیلی «'+t.title+'» حذف شود؟')){datastore.dimensionTypes=datastore.dimensionTypes.filter(x=>x.id!==id);saveDatastore();renderAccountingFoundation()}
}
function afSaveDimensionValue(){if(!requireWrite())return;const cid=afNeedCompany(),dimensionTypeId=document.getElementById('af-value-dim').value,t=getMyDimensionTypes().find(x=>x.id===dimensionTypeId);if(!cid||t?.sourceEntity!=='manual')return alert('فقط تفصیلی دستی مقدار مستقل می‌پذیرد.');const code=afCode(document.getElementById('af-value-code').value),title=document.getElementById('af-value-title').value.trim(),parentId=document.getElementById('af-value-parent').value;let depth=1;if(parentId){const p=getMyDimensionValues().find(x=>x.id===parentId&&x.dimensionTypeId===dimensionTypeId);if(!p)return alert('والد معتبر نیست.');if((p.depth||1)>=Number(t.maxDepth||1))return alert('این گره در آخرین سطح ساختار است و نمی‌تواند زیرشاخه داشته باشد.');depth=(p.depth||1)+1}if(!code||!title||depth>t.maxDepth)return alert('کد، عنوان یا عمق معتبر نیست.');if(getMyDimensionValues().some(x=>x.dimensionTypeId===dimensionTypeId&&x.code===code))return alert('کد مقدار در این تفصیلی تکراری است.');datastore.dimensionValues.push({id:afId('DV'),ownerUserId:currentUser.id,companyId:cid,dimensionTypeId,code,title,parentId:parentId||'',depth,active:true,createdAt:new Date().toISOString()});t.depthLocked=true;saveDatastore();renderAccountingFoundation()}
function afDeleteValue(id){if(!requireWrite())return;const v=getMyDimensionValues().find(x=>x.id===id);if(!v)return;if(getMyDimensionValues().some(x=>x.parentId===id))return alert('این مقدار زیرمجموعه دارد.');if(afDimensionValueReferenced(id))return alert('این مقدار در رکورد دیگری استفاده شده و برای حفظ تاریخچه قابل حذف نیست؛ در فاز ثبت اسناد فقط غیرفعال‌سازی مجاز خواهد بود.');datastore.dimensionValues=datastore.dimensionValues.filter(x=>x.id!==id);const t=getMyDimensionTypes().find(x=>x.id===v.dimensionTypeId);if(t&&!afDimensionHasValues(t.id))t.depthLocked=false;saveDatastore();renderAccountingFoundation()}
function afSaveFiscal(){if(!requireWrite())return;const cid=afNeedCompany(),title=document.getElementById('af-fy-title').value.trim(),startDate=toEnDigits(document.getElementById('af-fy-start').value),endDate=toEnDigits(document.getElementById('af-fy-end').value);if(!cid||!title||!/^\d{4}\/\d{2}\/\d{2}$/.test(startDate)||!/^\d{4}\/\d{2}\/\d{2}$/.test(endDate)||startDate>=endDate)return alert('عنوان و بازه تاریخ شمسی معتبر وارد کنید.');if(getMyFiscalYears().some(x=>!(endDate<x.startDate||startDate>x.endDate)))return alert('بازه سال مالی با سال مالی موجود هم‌پوشانی دارد.');datastore.fiscalYears.push({id:afId('FY'),ownerUserId:currentUser.id,companyId:cid,title,startDate,endDate,status:'open',createdAt:new Date().toISOString()});saveDatastore();renderAccountingFoundation()}
function afToggleFiscal(id){if(!requireWrite())return;const f=getMyFiscalYears().find(x=>x.id===id);if(!f)return;if(f.status==='locked'&&!confirm('بازکردن دوره مالی یک عملیات کنترلی حساس است. ادامه می‌دهید؟'))return;f.status=f.status==='locked'?'open':'locked';f.lockedAt=f.status==='locked'?new Date().toISOString():'';saveDatastore();renderAccountingFoundation()}
function afSaveBranch(){if(!requireWrite())return;const cid=afNeedCompany(),code=afCode(document.getElementById('af-branch-code').value),name=document.getElementById('af-branch-name').value.trim();if(!cid||!code||!name)return alert('کد و نام شعبه الزامی است.');if(getMyBranches().some(x=>x.code===code))return alert('کد شعبه تکراری است.');datastore.branches.push({id:afId('BR'),ownerUserId:currentUser.id,companyId:cid,code,name,active:true});saveDatastore();renderAccountingFoundation()}
function afDeleteBranch(id){if(!requireWrite())return;if(getMyGlobalProjects().some(x=>x.branchId===id))return alert('شعبه در پروژه استفاده شده است.');if(afDimensionValueReferenced(id))return alert('شعبه در رکورد دیگری استفاده شده و قابل حذف نیست.');datastore.branches=datastore.branches.filter(x=>x.id!==id);saveDatastore();renderAccountingFoundation()}
function afSaveProject(){if(!requireWrite())return;const cid=afNeedCompany(),code=afCode(document.getElementById('af-project-code').value),name=document.getElementById('af-project-name').value.trim(),parentId=document.getElementById('af-project-parent').value,branchId=document.getElementById('af-project-branch').value;if(!cid||!code||!name)return alert('کد و نام پروژه الزامی است.');if(getMyGlobalProjects().some(x=>x.code===code))return alert('کد پروژه تکراری است.');if(parentId&&!getMyGlobalProjects().some(x=>x.id===parentId))return alert('پروژه والد معتبر نیست.');const linkedContactIds=[...document.getElementById('af-project-contacts').selectedOptions].map(x=>x.value);datastore.projects.push({id:afId('PRJ'),ownerUserId:currentUser.id,companyId:cid,code,name,parentId:parentId||'',branchId:branchId||'',linkedContactIds,direction:'both',active:true});saveDatastore();renderAccountingFoundation()}
function afDeleteProject(id){if(!requireWrite())return;if(getMyGlobalProjects().some(x=>x.parentId===id))return alert('پروژه زیرمجموعه دارد.');if(afProjectUsed(id)||afDimensionValueReferenced(id))return alert('پروژه در رکورد مالی/عملیاتی استفاده شده و قابل حذف نیست.');datastore.projects=datastore.projects.filter(x=>x.id!==id);saveDatastore();renderAccountingFoundation()}
