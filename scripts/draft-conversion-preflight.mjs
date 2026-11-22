// Prints aggregates only. The private inventory and owner decisions stay local.
import {readFileSync} from 'node:fs';
import {planDraftConversion} from './lib/draft-conversion-plan.mjs';
try{
  const [inventoryPath,resolutionsPath]=process.argv.slice(2);
  if(!inventoryPath)throw Error('Usage: node scripts/draft-conversion-preflight.mjs PRIVATE_INVENTORY.json [PRIVATE_RESOLUTIONS.json]');
  const inventory=JSON.parse(readFileSync(inventoryPath,'utf8'));
  const options=resolutionsPath?JSON.parse(readFileSync(resolutionsPath,'utf8')):{};
  const result=planDraftConversion(inventory.journals,options);
  const sourceCountFields=["sourcesConsidered","withoutGeneratedVoucher","unlinkedWithGeneratedVoucher","danglingSourceLinks","wrongIdentitySourceLinks","linkedDraftSources","linkedDraftProjectionMismatches","postedProjectionMismatches","duplicateDraftSourceIdentities","orphanGeneratedVouchers","crossScopeGeneratedVouchers"];
  // Only emit hard-coded aggregate counts, never arbitrary private inventory data.
  let sourceIdentityAudit=null;
  if(inventory.sourceIdentityAudit!==undefined){
    const input=inventory.sourceIdentityAudit;
    if(!input||typeof input!=='object'||Array.isArray(input))
      throw Error('invalid source identity aggregate');
    sourceIdentityAudit=Object.fromEntries(sourceCountFields.map(key=>{
      const value=input[key];
      if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)
        throw Error('invalid aggregate count: '+key);
      return [key,value];
    }));
  }
  const sourceIdentityReady=sourceIdentityAudit!==null &&
    sourceCountFields.every(key=>key==='sourcesConsidered'||sourceIdentityAudit[key]===0);
  console.log(JSON.stringify({
    snapshotAt:inventory.snapshotAt, journalCount:inventory.journals.length,
    integrityReady:result.integrityReady, executable:result.executable,
    conversionCandidates:result.candidates.length, retainedCancelledChains:result.cancelledChains.length,
    existingDrafts:result.existingDrafts.length,
    sourceIdentityAudit, sourceIdentityReady,
    blockers:result.blockers.reduce((counts,{code})=>({...counts,[code]:(counts[code]||0)+1}),{}),
    scope:'Journal graph + aggregate sale/purchase financial-source identity; cheque and other source adapters require independent reconciliation.'
  },null,2));
  if(!result.integrityReady||!sourceIdentityReady)process.exitCode=2;
}catch(error){console.error(error.message);process.exitCode=1;}
