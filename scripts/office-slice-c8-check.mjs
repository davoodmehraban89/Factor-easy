import fs from 'node:fs';
const src=fs.readFileSync('js/office-workflow.js','utf8');
const required=['officeWorkflowPolicies','officeWorkflowPublish','officeWorkflowMountAdmin','office_workflow_catalog','office_workflow_publish','textContent','replaceChildren'];
for(const token of required){if(!src.includes(token))throw new Error('C8 UI contract missing: '+token)}
if(/\.innerHTML\s*=/.test(src))throw new Error('C8 UI must not render workflow content through innerHTML');
if(!src.includes("['edit','refer','approve']"))throw new Error('C8 capability allowlist drift');
if(!src.includes('مرحله گردش، جایگزین ثبت دبیرخانه یا تأیید داخلی نامه نیست.'))throw new Error('C8 status/workflow separation notice missing');
console.log('Office Slice C8 policy UI contract: PASS');