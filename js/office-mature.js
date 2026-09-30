/* Office Slice C1 mature correspondence read evidence. */
(function(){
window.officeReadEvidenceFor=function(correspondenceId){return (datastore.correspondenceAudit||[]).filter(x=>x.event==='read'&&x.correspondenceId===correspondenceId)};
window.officeMarkReadEvidence=async function(correspondenceId){
  if(!currentUser?.organizationId||!correspondenceId)return false;
  const {error}=await sb.rpc('office_mark_correspondence_read',{p_organization_id:currentUser.organizationId,p_correspondence_id:correspondenceId});
  if(error){console.error('office read evidence failed',error);return false}
  try{await pullAll()}catch(e){console.error('office read evidence refresh failed',e)}
  return true;
};
const baseOfficeOpenRecord=window.officeOpenRecord;
window.officeOpenRecord=async function(id){
  const x=(datastore.correspondence||[]).find(r=>r.id===id);if(!x)return;
  if(x.status!=='draft'){
    const ok=await window.officeMarkReadEvidence(id);
    if(!ok)return alert('ثبت مشاهده نامه در سرور انجام نشد؛ برای حفظ صحت سابقه، نمایش نامه متوقف شد.');
  }
  return baseOfficeOpenRecord(id);
};
})();
