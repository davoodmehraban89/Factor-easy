// Phase 0 startup: download extension modules concurrently, execute in original order.
// Dynamically inserted classic scripts need async=false BEFORE they are connected:
// browsers may download in parallel but preserve script execution/dependencies.
// Auth starts only once all extensions have finished loading or failed.
const FINORA_EXTENSION_SCRIPTS=[
  "js/organization-rbac.js?v=20260930-slice-b-v1",
  "js/organization-invitations.js?v=20260930-eli3-v1",
  "js/organization-enterprise-ux.js?v=20260930-eli4-v1",
  "js/platform-modules.js?v=20261001-platform-c6-v1",
  "js/office-automation.js?v=20260930-c4-v1",
  "js/request-workflow-d2.js?v=20261001-d2-v1",
  "js/request-workflow-d3b.js?v=20261001-d3b-v1",
  "js/request-workflow-d3c.js?v=20261001-d3c-v1",
  "js/request-workflow-d4a.js?v=20261002-d4a-v1",
  "js/office-rbac.js?v=20260930-slice-b-v1",
  "js/office-mature.js?v=20261001-c7-v2",
  "js/office-workflow.js?v=20261001-c8-task3-v3",
  "js/organization-shell.js?v=20260930-eli4-v1",
  "js/taxpayer-print.js?v=20261003-reference-v2"
];
function finoraLoadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.async=false;
    script.src=src;
    script.onload=()=>resolve(src);
    script.onerror=()=>reject(new Error('Failed to load '+src));
    document.head.appendChild(script);
  });
}
window.addEventListener('DOMContentLoaded',async()=>{
  const started=performance.now();
  const results=await Promise.allSettled(FINORA_EXTENSION_SCRIPTS.map(finoraLoadScript));
  const failed=results.flatMap((r,i)=>r.status==='rejected'?[FINORA_EXTENSION_SCRIPTS[i]]:[]);
  window.FinoraStartupStatus={
    extensionCount:FINORA_EXTENSION_SCRIPTS.length,
    failedExtensionCount:failed.length,
    extensionLoadMs:Math.round(performance.now()-started)
  };
  if(failed.length)console.error('Finora platform extension assets unavailable:',failed);
  // Never start a restored user session against half-loaded application modules.
  if(!currentUser)await initAuthSystem();
});
