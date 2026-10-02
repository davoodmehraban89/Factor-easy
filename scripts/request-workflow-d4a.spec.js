const fs=require('fs');
const {test,expect}=require('@playwright/test');
test('D4a renders actionable queue and submits guarded decision',async({page})=>{
 await page.setContent('<div id="view-requests"></div>');
 await page.addScriptTag({content:`
 window.currentUser={id:'11111111-1111-1111-1111-111111111111',organizationId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};
 window.ensureViews=()=>{}; window.esc=v=>String(v??''); window.officeHeader=(a,b)=>'<h1>'+a+'</h1><p>'+b+'</p>'; window.alert=()=>{};
 window.sb={rpc:async(name,args)=>{window.__calls=(window.__calls||[]).concat([[name,args]]);if(name==='request_work_queue')return {data:[{requestInstanceId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',requestTypeTitle:'مرخصی',requestTypeVersion:2,status:'submitted',revision:4,stepKey:'manager',stepTitle:'تأیید مدیر',requiredCapability:'approve',approvalsReceived:0,approvalsRequired:1,dueAt:null,delegatedFromUserId:'cccccccc-cccc-cccc-cccc-cccccccccccc'}],error:null};if(name==='request_step_decide')return {data:[{status:'approved'}],error:null};return {data:null,error:null}};
 window.requestsRender=async()=>{};
 var currentUser=window.currentUser, sb=window.sb, esc=window.esc, officeHeader=window.officeHeader, ensureViews=window.ensureViews;
 `});
 await page.addScriptTag({content:fs.readFileSync('js/request-workflow-d4a.js','utf8')});
 await page.evaluate(()=>window.requestsRender('workqueue'));
 console.log('D4A_DEBUG',await page.locator('#view-requests').innerHTML());
 await expect(page.getByRole('heading',{name:'کارتابل اقدام'})).toBeVisible();
 await expect(page.getByText('جانشینی')).toBeVisible();
 await page.getByRole('button',{name:'تأیید',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__calls.filter(x=>x[0]==='request_step_decide').length)).toBe(1);
 const args=await page.evaluate(()=>window.__calls.find(x=>x[0]==='request_step_decide')[1]);
 expect(args.p_request_instance_id).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
 expect(args.p_expected_revision).toBe(4);
 expect(args.p_decision).toBe('approve');
 expect(args.p_idempotency_key.startsWith('d4a-approve-')).toBeTruthy();
});
