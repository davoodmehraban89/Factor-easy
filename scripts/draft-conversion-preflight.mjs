// Prints aggregates only. The private inventory and owner decisions stay local.
import {readFileSync} from 'node:fs';
import {planDraftConversion} from './lib/draft-conversion-plan.mjs';
try{
  const [inventoryPath,resolutionsPath]=process.argv.slice(2);
  if(!inventoryPath)throw Error('Usage: node scripts/draft-conversion-preflight.mjs PRIVATE_INVENTORY.json [PRIVATE_RESOLUTIONS.json]');
  const inventory=JSON.parse(readFileSync(inventoryPath,'utf8'));
  const options=resolutionsPath?JSON.parse(readFileSync(resolutionsPath,'utf8')):{};
  const result=planDraftConversion(inventory.journals,options);
  console.log(JSON.stringify({
    snapshotAt:inventory.snapshotAt, journalCount:inventory.journals.length,
    integrityReady:result.integrityReady, executable:result.executable,
    conversionCandidates:result.candidates.length, retainedCancelledChains:result.cancelledChains.length,
    existingDrafts:result.existingDrafts.length,
    blockers:result.blockers.reduce((counts,{code})=>({...counts,[code]:(counts[code]||0)+1}),{}),
    scope:'Journal graph only; source-only legacy documents and unlinked cheques need separate source-adapter reconciliation.'
  },null,2));
  if(!result.integrityReady)process.exitCode=2;
}catch(error){console.error(error.message);process.exitCode=1;}
