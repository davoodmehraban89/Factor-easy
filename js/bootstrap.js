// Phase 0 startup: download extension modules concurrently, execute in original order.
// Dynamically inserted classic scripts need async=false BEFORE they are connected:
// browsers may download in parallel but preserve script execution/dependencies.
// Auth starts only once all extensions have finished loading or failed.
const FINORA_EXTENSION_SCRIPTS=[
  "js/organization-rbac.js?v=20261023-phase-a-navigation-v1",
  "js/organization-invitations.js?v=20260930-eli3-v1",
  "js/organization-enterprise-ux.js?v=20260930-eli4-v1",
  "js/platform-modules.js?v=20261023-phase-a-navigation-v1",
  "js/office-automation.js?v=20260930-c4-v1",
  "js/request-workflow-d2.js?v=20261001-d2-v1",
  "js/request-workflow-d3b.js?v=20261001-d3b-v1",
  "js/request-workflow-d3c.js?v=20261001-d3c-v1",
  "js/request-workflow-d4a.js?v=20261002-d4a-v1",
  "js/office-rbac.js?v=20260930-slice-b-v1",
  "js/office-mature.js?v=20261001-c7-v2",
  "js/office-workflow.js?v=20261001-c8-task3-v3",
  "js/organization-shell.js?v=20261023-phase-a-navigation-v1",
  "js/taxpayer-print.js?v=20261003-reference-v2"
];
const FINORA_EXTENSION_BUNDLE_URL=null;
const FINORA_EXTENSION_WAIT_MS=6500;
const FINORA_EXTENSION_MAX_ATTEMPTS=2;
function finoraLoadScriptOnce(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.async=false;
    script.src=src;
    let complete=false;
    const finish=(error)=>{
      if(complete)return;
      complete=true;clearTimeout(timeout);
      script.onload=null;script.onerror=null;
      if(error){script.remove();reject(new Error('FINORA_EXTENSION_LOAD_FAILED'));}
      else resolve(src);
    };
    const timeout=setTimeout(()=>finish(true),FINORA_EXTENSION_WAIT_MS);
    script.onload=()=>finish(false);
    script.onerror=()=>finish(true);
    document.head.appendChild(script);
  });
}
async function finoraLoadScript(src){
  for(let attempt=1;attempt<=FINORA_EXTENSION_MAX_ATTEMPTS;attempt++){
    try{return await finoraLoadScriptOnce(src);}
    catch(error){
      if(attempt===FINORA_EXTENSION_MAX_ATTEMPTS)throw error;
    }
  }
}
// Optional remote font must never block authentication or application scripts.
// This handler is installed from a local JS file because Pages strips inline
// HTML event handlers under its strict CSP. Tahoma remains a usable fallback.
const finoraFontLink=document.getElementById('finora-optional-font');
if(finoraFontLink){
  const applyFont=()=>{finoraFontLink.media='all'};
  finoraFontLink.addEventListener('load',applyFont,{once:true});
  if(finoraFontLink.sheet)applyFont();
}
window.addEventListener('DOMContentLoaded',async()=>{
  const started=performance.now();
  const sources=FINORA_EXTENSION_BUNDLE_URL?[FINORA_EXTENSION_BUNDLE_URL]:FINORA_EXTENSION_SCRIPTS;
  const results=await Promise.allSettled(sources.map(finoraLoadScript));
  const failed=results.flatMap((r,i)=>r.status==='rejected'?[sources[i]]:[]);
  Object.assign(window.FinoraStartupStatus,{
    extensionCount:FINORA_EXTENSION_SCRIPTS.length,
    failedExtensionCount:FINORA_EXTENSION_BUNDLE_URL&&failed.length?FINORA_EXTENSION_SCRIPTS.length:failed.length,
    extensionBundle:!!FINORA_EXTENSION_BUNDLE_URL,
    extensionLoadMs:Math.round(performance.now()-started),
    extensionRetryEnabled:true,
    extensionsReady:true
  });
  if(failed.length){
    console.warn('Finora workspace assets unavailable; partial ERP is blocked.');
    window.finoraMarkAppAssetsFailed();
  }else{
    window.finoraMarkAppAssetsReady();
  }
  // Login controls remain usable even when workspace modules fail.
  if(window.FinoraStartupStatus.authSessionChecked)window.FinoraStartupStatus.authChecked=true;
});
