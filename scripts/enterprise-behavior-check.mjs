import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync('js/enterprise-iran-v2.js','utf8');
const ctx={window:{enterpriseRender:()=>{}},console,Math,Number,String,Date,Infinity,datastore:{enterpriseAudit:[]},currentUser:{id:'U1'},getJalaliNumeric:()=> '1405/07/08',entCid:()=> 'C1',entRows:()=>[],getMyCompanies:()=>[],getMyAccounts:()=>[],saveDatastore:()=>{},alert:()=>{},requireWrite:()=>true,enterpriseEndServiceEstimate:()=>0};vm.createContext(ctx);vm.runInContext(code,ctx);
const tax=vm.runInContext('entSalaryTax1405(900000000)',ctx);if(tax!==55000000)throw new Error('salary tax 1405 boundary mismatch '+tax);
if(vm.runInContext('entSalaryTax1405(400000000)',ctx)!==0)throw new Error('salary tax exemption mismatch');
if(vm.runInContext('entSalaryTax1405(800000000)',ctx)!==40000000)throw new Error('salary tax first bracket mismatch');
const years=vm.runInContext("entServiceYears('1400/07/01','1405/07/01')",ctx);if(Math.abs(years-5)>1e-9)throw new Error('Jalali service years mismatch '+years);
const partial=vm.runInContext("entServiceYears('1404/01/01','1405/07/01')",ctx);if(Math.abs(partial-1.5)>0.01)throw new Error('partial service mismatch '+partial);
console.log('Enterprise Iran behavior PASS');
