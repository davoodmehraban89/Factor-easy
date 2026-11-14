// Pure, read-only preflight. This module intentionally has no database/network or
// write capability. A graph candidate is NOT an executable accounting change.
const scopeMatches = (a,b) => ['owner','organization','company'].every(k=>a[k]===b[k]);
const money = value => {
  if(typeof value==='number' && !Number.isSafeInteger(value))throw Error('unsafe numeric input');
  if(!/^(0|[1-9]\d*)$/.test(String(value)))throw Error('invalid integer amount');
  return BigInt(value);
};
function journalContent(v) {
  if(!Array.isArray(v.lines)||v.lines.length<2)throw Error('missing lines');
  const net=new Map();let debit=0n,credit=0n;
  for(const l of v.lines){
    if(!l.account||!Array.isArray(l.dimensions)||l.dimensions.some(d=>typeof d!=='string'))throw Error('invalid analytical identity');
    const dr=money(l.debit),cr=money(l.credit);
    if((dr===0n)===(cr===0n))throw Error('one positive side required');
    const key=JSON.stringify([l.account,l.counterparty||'',l.project||'',[...l.dimensions].sort()]);
    net.set(key,(net.get(key)||0n)+dr-cr); debit+=dr;credit+=cr;
  }
  if(debit!==credit||debit===0n)throw Error('unbalanced journal');
  return {net,debit,credit};
}
function opposite(a,b) {
  return [...new Set([...a.keys(),...b.keys()])].every(k=>(a.get(k)||0n)+(b.get(k)||0n)===0n);
}

export function planDraftConversion(snapshot, {sourceCompanyResolutions={}}={}) {
  if(!Array.isArray(snapshot))throw TypeError('Expected complete journal inventory array');
  const result={executable:false,integrityReady:false,candidates:[],cancelledChains:[],existingDrafts:[],blockers:[]};
  const block=(code,key)=>{if(!result.blockers.some(b=>b.code===code&&b.key===key))result.blockers.push({code,key});};
  const byKey=new Map(),contents=new Map(),children=new Map();
  for(const v of snapshot){
    if(!v||typeof v.key!=='string'||!v.key) {block('MISSING_KEY','');continue;}
    if(byKey.has(v.key)){block('DUPLICATE_KEY',v.key);continue;}
    byKey.set(v.key,v);
    if(['owner','organization','company'].some(k=>!v[k]))block('MISSING_SCOPE',v.key);
    if(v.status==='draft'){result.existingDrafts.push(v.key);continue;}
    if(!['posted','reversed'].includes(v.status)){block('UNKNOWN_STATUS',v.key);continue;}
    if(v.fiscalOpen!==true)block('FISCAL_SCOPE_NOT_OPEN',v.key);
    if(v.childrenScopeValid!==true)block('CHILD_SCOPE_MISMATCH',v.key);
    try {
      const c=journalContent(v);contents.set(v.key,c);
      if(money(v.totalDebit)!==c.debit||money(v.totalCredit)!==c.credit)block('HEADER_TOTAL_MISMATCH',v.key);
    }catch{block('INVALID_JOURNAL_LINES',v.key);}
    if(v.sourceType==='reversal'){
      const list=children.get(v.parent)||[];list.push(v.key);children.set(v.parent,list);
    }
  }
  for(const v of byKey.values()){
    if(!['posted','reversed'].includes(v.status))continue;
    if(v.status==='reversed'&&!v.reversal)block('REVERSED_WITHOUT_COMPENSATOR',v.key);
    if(v.status==='posted'&&v.reversal)block('POSTED_WITH_COMPENSATOR',v.key);
    if(v.sourceType==='reversal'){
      const parent=byKey.get(v.parent);
      if(!parent)block('REVERSAL_PARENT_MISSING',v.key);
      else if(parent.reversal!==v.key)block('REVERSAL_BACKLINK_MISMATCH',v.key);
    }
    if((children.get(v.key)||[]).length>1)block('REVERSAL_FORK',v.key);
    if(v.reversal){
      const next=byKey.get(v.reversal);
      if(!next){block('REVERSAL_MISSING',v.key);continue;}
      if(next.sourceType!=='reversal'||next.parent!==v.key)block('REVERSAL_BACKLINK_MISMATCH',v.key);
      if(!scopeMatches(v,next))block('REVERSAL_SCOPE_MISMATCH',v.key);
      if(!['posted','reversed'].includes(next.status))block('REVERSAL_NOT_POSTED',v.key);
      if(contents.has(v.key)&&contents.has(next.key)&&!opposite(contents.get(v.key).net,contents.get(next.key).net))block('REVERSAL_CONTENT_MISMATCH',v.key);
    }
  }
  // Inspect every component, including corrupt cycles with no business root.
  const finished=new Set();
  for(const v of byKey.values()){
    const path=new Set();let node=v;
    while(node&&!finished.has(node.key)){
      if(path.has(node.key)){block('REVERSAL_CYCLE',node.key);break;}
      path.add(node.key);node=node.reversal?byKey.get(node.reversal):null;
    }
    for(const key of path)finished.add(key);
  }
  for(const root of byKey.values()){
    if(!['posted','reversed'].includes(root.status)||root.sourceType==='reversal')continue;
    const chain=[],seen=new Set();let v=root;
    while(v&&!seen.has(v.key)) {chain.push(v.key);seen.add(v.key);v=v.reversal?byKey.get(v.reversal):null;}
    const componentHasError=()=>result.blockers.some(b=>seen.has(b.key));
    if(componentHasError())continue;
    if(chain.length%2===0){result.cancelledChains.push(chain);continue;}
    if(!['manual','sale','purchase'].includes(root.sourceType)){block('SOURCE_ADAPTER_NOT_SUPPORTED',root.key);continue;}
    const s=root.source;
    if(root.sourceType==='manual'&&!s){
      result.candidates.push({root:root.key,leaf:chain.at(-1),source:null,chain});continue;
    }
    if(!s){block('SOURCE_MISSING',root.key);continue;}
    const resolution=sourceCompanyResolutions[root.key];
    const confirmedSourceCompany=resolution?.company===s.company&&typeof resolution.reason==='string'&&resolution.reason.trim()
      &&root.owner===s.owner&&root.organization===s.organization&&!!s.company;
    if(!scopeMatches(root,s)&&!confirmedSourceCompany)block('SOURCE_SCOPE_MISMATCH',root.key);
    if(s.voucher!==root.key)block('SOURCE_LINK_MISMATCH',root.key);
    if(s.electronicMetadata!==false)block('ELECTRONIC_SOURCE_REVIEW',root.key);
    if(s.dependencyCount!==0)block('DEPENDENT_RECORDS',root.key);
    if(componentHasError())continue;
    const candidate={root:root.key,leaf:chain.at(-1),source:s.key,chain};
    if(root.company!==s.company)candidate.scopeCorrection={reverseInCompany:root.company,draftInCompany:s.company,reason:resolution.reason};
    result.candidates.push(candidate);
  }
  result.integrityReady=result.blockers.length===0;
  return result;
}
