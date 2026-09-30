const {test,expect}=require('@playwright/test');

test('ELI-3 exposes invitation UI actions and URL acceptance hook',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.finoraCanManageOrganization==='function');
  expect(await page.evaluate(()=>typeof window.organizationCreateInvitationFromUi)).toBe('function');
  expect(await page.evaluate(()=>typeof window.organizationRevokeInvitationFromUi)).toBe('function');
  expect(await page.evaluate(()=>typeof window.processFinoraInvitationFromUrl)).toBe('function');
  expect(errs.filter(x=>!x.includes('ResizeObserver'))).toEqual([]);
});

test('ELI-3 invitation URL processor accepts token once and removes it from address bar',async({page})=>{
  await page.goto('http://127.0.0.1:4173/index.html?invite=eli3-test-token',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.processFinoraInvitationFromUrl==='function');
  const result=await page.evaluate(async()=>{
    const calls=[];
    const oldRpc=sb.rpc.bind(sb);
    sb.rpc=async(name,args)=>{calls.push({name,args});return {data:'member-id',error:null}};
    const oldAlert=window.alert;window.alert=()=>{};
    try{await window.processFinoraInvitationFromUrl();}
    finally{sb.rpc=oldRpc;window.alert=oldAlert;}
    return {calls,search:location.search};
  });
  expect(result.calls).toEqual([{name:'organization_accept_invitation',args:{p_token:'eli3-test-token'}}]);
  expect(result.search).not.toContain('invite=');
});
