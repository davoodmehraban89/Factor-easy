/* Phase 2 accounting foundation rendering */
function afChip(text,fn){return '<span class="af-chip">'+text+(fn?' <button onclick="'+fn+'">×</button>':'')+'</span>'}
function renderAccountingFoundation(){
 ensureAccountingFoundationView();if(!currentUser)return;afSeed();afMigrateLegacyProjects();
 const A=getMyAccounts().slice().sort((a,b)=>String(a.code).localeCompare(String(b.code),'fa',{numeric:true})),D=getMyDimensionTypes(),B=getMyBranches(),P=getMyGlobalProjects(),C=getMyContacts();
 const ab=document.getElementById('af-accounts-body');if(ab)ab.innerHTML=A.length?A.map(a=>'<tr><td>'+esc(a.code)+'</td><td>'+esc(a.title)+'</td><td>'+AF_LEVELS[a.level]+'</td><td>'+AF_NATURE[a.normalBalance]+'</td><td>'+(a.postingAllowed?'بله':'خیر')+'</td><td><button class="btn btn-danger btn-inline" onclick="afDeleteAccount(\''+a.id+'\')">حذف</button></td></tr>').join(''):'<tr><td colspan="6" class="af-empty">حسابی تعریف نشده است.</td></tr>';afParents();
 const ra=document.getElementById('af-rule-account');if(ra)ra.innerHTML=A.filter(x=>x.postingAllowed).map(x=>'<option value="'+x.id+'">'+esc(x.code)+' — '+esc(x.title)+'</option>').join('');
 const rd=document.getElementById('af-rule-dimension');if(rd)rd.innerHTML=D.map(x=>'<option value="'+x.id+'">'+esc(x.title)+'</option>').join('');
 const rl=document.getElementById('af-rules-list');if(rl)rl.innerHTML=getMyAccountDimensionRules().map(r=>{const a=A.find(x=>x.id===r.accountId),d=D.find(x=>x.id===r.dimensionTypeId);return a&&d?afChip(esc(a.code)+' / '+esc(d.title)+' : '+(r.applicability==='required'?'الزامی':r.applicability==='optional'?'اختیاری':'غیرمجاز'),"afDeleteRule('"+r.id+"')"):''}).join('')||'<span class="af-hint">قاعده‌ای ثبت نشده است.</span>';
 const dl=document.getElementById('af-dimensions-list');if(dl)dl.innerHTML=D.map(d=>'<div class="af-master-row"><div><b>'+esc(d.title)+'</b><small>'+esc(d.code)+' · '+(d.sourceEntity==='manual'?'دستی':'متصل به '+d.sourceEntity)+' · '+afResolvedValues(d).length.toLocaleString('fa-IR')+' مقدار</small></div><span class="badge badge-success">فعال</span></div>').join('');
 const vd=document.getElementById('af-value-dim');if(vd){const old=vd.value;vd.innerHTML=D.filter(x=>x.sourceEntity==='manual').map(x=>'<option value="'+x.id+'">'+esc(x.title)+'</option>').join('');if([...vd.options].some(o=>o.value===old))vd.value=old}
 const V=getMyDimensionValues().filter(x=>x.dimensionTypeId===vd?.value),vp=document.getElementById('af-value-parent');if(vp)vp.innerHTML='<option value="">— ریشه —</option>'+V.map(x=>'<option value="'+x.id+'">'+esc(x.code)+' — '+esc(x.title)+'</option>').join('');
 const vl=document.getElementById('af-values-list');if(vl)vl.innerHTML=V.map(x=>afChip(esc(x.code)+' — '+esc(x.title),"afDeleteValue('"+x.id+"')")).join('')||'<span class="af-hint">مقداری ثبت نشده است.</span>';
 const fl=document.getElementById('af-fiscal-list');if(fl)fl.innerHTML=getMyFiscalYears().map(x=>'<div class="af-master-row"><div><b>'+esc(x.title)+'</b><small>'+esc(x.startDate)+' تا '+esc(x.endDate)+'</small></div><button class="btn btn-secondary btn-inline" onclick="afToggleFiscal(\''+x.id+'\')">'+(x.status==='locked'?'بازکردن':'قفل')+'</button></div>').join('');
 const bl=document.getElementById('af-branches-list');if(bl)bl.innerHTML=B.map(x=>'<div class="af-master-row"><div><b>'+esc(x.name)+'</b><small>'+esc(x.code)+'</small></div><button class="btn btn-danger btn-inline" onclick="afDeleteBranch(\''+x.id+'\')">حذف</button></div>').join('')||'<span class="af-hint">شعبه‌ای ثبت نشده است.</span>';
 const pp=document.getElementById('af-project-parent');if(pp)pp.innerHTML='<option value="">— پروژه اصلی —</option>'+P.map(x=>'<option value="'+x.id+'">'+esc(x.code)+' — '+esc(x.name)+'</option>').join('');
 const pb=document.getElementById('af-project-branch');if(pb)pb.innerHTML='<option value="">— بدون شعبه —</option>'+B.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
 const pc=document.getElementById('af-project-contacts');if(pc)pc.innerHTML=C.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
 const pl=document.getElementById('af-projects-list');if(pl)pl.innerHTML=P.map(x=>{const pa=P.find(z=>z.id===x.parentId),br=B.find(z=>z.id===x.branchId),cn=(x.linkedContactIds||[]).map(id=>C.find(z=>z.id===id)?.name).filter(Boolean).join('، ');return '<div class="af-master-row"><div><b>'+esc(x.code||x.id)+' — '+esc(x.name)+'</b><small>'+(pa?'زیرپروژه '+esc(pa.name)+' · ':'')+(br?'شعبه '+esc(br.name)+' · ':'')+esc(cn||'بدون طرف‌حساب')+'</small></div><button class="btn btn-danger btn-inline" onclick="afDeleteProject(\''+x.id+'\')">حذف</button></div>'}).join('')||'<span class="af-hint">پروژه‌ای ثبت نشده است.</span>';
}

function afProjectsForContact(contactId,direction){
 return getMyGlobalProjects().filter(p=>p.active!==false&&(!(p.linkedContactIds||[]).length||(p.linkedContactIds||[]).includes(contactId))&&(p.direction||'both')!==(direction==='sale'?'purchase':'sale'));
}
window.handleInvoiceContactChange=function(){
 const cid=document.getElementById('invoice-contact-id')?.value,row=document.getElementById('box-invoice-project-row'),sel=document.getElementById('invoice-project-id');if(!row||!sel)return;
 const ps=afProjectsForContact(cid,'sale');sel.innerHTML=ps.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');row.style.display=ps.length?'flex':'none';
};
window.purRefreshProjects=function(){
 const sup=document.getElementById('pur-supplier'),sel=document.getElementById('pur-costcenter');if(!sup||!sel)return;const old=sel.value,ps=afProjectsForContact(sup.value,'purchase');
 sel.innerHTML='<option value="">بدون پروژه (هزینه عمومی)</option>'+ps.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');if([...sel.options].some(o=>o.value===old))sel.value=old;
};
window.refreshExpenseProjects=function(){
 const c=document.getElementById('trx-contact-select'),sel=document.getElementById('trx-project-select');if(!c||!sel)return;const old=sel.value,ps=afProjectsForContact(c.value,'both');
 sel.innerHTML='<option value="">بدون پروژه</option>'+ps.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');if([...sel.options].some(o=>o.value===old))sel.value=old;
};
