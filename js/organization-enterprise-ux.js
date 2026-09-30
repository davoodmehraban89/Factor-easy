/* ELI-4 enterprise organization dashboard + typed hierarchy. */
(function(){
const KIND_LABELS={region:'منطقه',branch:'شعبه',department:'دپارتمان',unit:'واحد',subunit:'زیرواحد'};
function unitKindLabel(k){return KIND_LABELS[k]||KIND_LABELS.unit}
window.renderEnterpriseOrganizationTree=function(units){
  const xs=Array.isArray(units)?units:[],byParent=new Map();
  for(const u of xs){const key=u.parent_id||'root';if(!byParent.has(key))byParent.set(key,[]);byParent.get(key).push(u)}
  for(const arr of byParent.values())arr.sort((a,b)=>String(a.title).localeCompare(String(b.title),'fa'));
  const seen=new Set();
  function branch(parent,depth){return (byParent.get(parent)||[]).map(u=>{if(seen.has(u.id))return '';seen.add(u.id);return '<div class="org-tree-node" style="margin-right:'+(depth*18)+'px;padding:7px 9px;border-right:2px solid var(--border);margin-top:5px"><b>'+esc(u.title)+'</b> <span class="af-hint">'+esc(unitKindLabel(u.unit_kind))+' · '+esc(u.code)+(u.active?'':' · غیرفعال')+'</span>'+branch(u.id,depth+1)+'</div>'}).join('')}
  const html=branch('root',0);return html||'<p class="af-hint">هنوز ساختار سازمانی ثبت نشده است.</p>';
};
async function enterpriseOrganizationData(){
  const [{data:summary,error:se},{data:units,error:ue}]=await Promise.all([
    sb.rpc('organization_capacity_summary',{p_organization_id:currentUser.organizationId}),
    sb.from('organization_units').select('id,parent_id,code,title,unit_kind,active').eq('organization_id',currentUser.organizationId).order('title')
  ]);
  if(se)throw se;if(ue)throw ue;return {summary,units:units||[]};
}
function capacityCard(title,used,max){const pct=max?Math.min(100,Math.round((Number(used||0)/Number(max))*100)):0;return '<div style="padding:12px;border:1px solid var(--border);border-radius:10px;min-width:170px;flex:1"><b>'+esc(title)+'</b><div style="font-size:1.25rem;margin:6px 0">'+toPersianDigits(used)+' / '+toPersianDigits(max)+'</div><div style="height:7px;background:var(--surface-2);border-radius:8px;overflow:hidden"><span style="display:block;height:100%;width:'+pct+'%;background:var(--primary)"></span></div></div>'}
function enhanceUnitForm(){
  const title=document.getElementById('org-unit-title');if(!title||document.getElementById('org-unit-kind'))return;
  const group=document.createElement('div');group.className='form-group';group.innerHTML='<label>نوع واحد</label><select id="org-unit-kind" class="form-control"><option value="region">منطقه</option><option value="branch">شعبه</option><option value="department">دپارتمان</option><option value="unit" selected>واحد</option><option value="subunit">زیرواحد</option></select>';
  title.closest('.form-group')?.after(group);
}
window.organizationCreateUnitFromUi=async function(){
  if(!window.finoraCanManageOrganization?.())return;
  const code=String(document.getElementById('org-unit-code')?.value||'').trim(),title=String(document.getElementById('org-unit-title')?.value||'').trim(),parent=document.getElementById('org-unit-parent')?.value||null,kind=document.getElementById('org-unit-kind')?.value||'unit';
  if(!code||!title)return alert('کد و عنوان واحد الزامی است.');
  const {error}=await sb.from('organization_units').insert({organization_id:currentUser.organizationId,parent_id:parent||null,code,title,unit_kind:kind,active:true});
  if(error)return alert('ثبت واحد انجام نشد: '+error.message);await showOrganizationAccessManager();
};
window.refreshEnterpriseOrganizationDashboard=async function(){
  if(!window.finoraCanManageOrganization?.())return;
  const modal=document.getElementById('finora-org-access-modal'),card=modal?.querySelector('.modal-card');if(!card)return;
  modal.querySelector('#enterprise-org-dashboard')?.remove();enhanceUnitForm();
  try{
    const {summary,units}=await enterpriseOrganizationData(),mods=summary?.modules||[];
    const html='<div class="card" id="enterprise-org-dashboard"><h4>نمای سازمانی و ظرفیت‌ها</h4><div style="display:flex;gap:10px;flex-wrap:wrap">'+capacityCard('کاربران فعال',summary.active_users,summary.max_users)+capacityCard('شرکت‌های حقوقی',summary.company_count,summary.max_companies)+'</div><p class="af-hint" style="margin-top:10px">پلن: '+esc(summary.plan||'—')+' · وضعیت: '+esc(summary.status||'—')+' · ماژول‌ها: '+esc(mods.join('، ')||'—')+'</p><h4 style="margin-top:16px">درخت سازمانی</h4>'+window.renderEnterpriseOrganizationTree(units)+'</div>';
    const first=card.querySelector('.card');if(first)first.insertAdjacentHTML('beforebegin',html);else card.insertAdjacentHTML('beforeend',html);
  }catch(e){console.error('enterprise organization dashboard failed',e)}
};
const baseShowEnterprise=window.showOrganizationAccessManager;
window.showOrganizationAccessManager=async function(){const r=await baseShowEnterprise();await window.refreshEnterpriseOrganizationDashboard();return r};
})();
