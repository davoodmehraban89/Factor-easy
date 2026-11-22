// Security/QA stop-merge tripwire for one destructive accounting migration pattern.
// Diff-only and source-only; NEVER connects to a database or mutates records.
// This heuristic does not replace SQL migration review or historical parity E2E.
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

function withoutComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, m=>m.replace(/[^\r\n]/g,' '))
    .replace(/--[^\r\n]*/g, m=>' '.repeat(m.length));
}

export function findPostedToDraftRewrites(sql) {
  const text=withoutComments(sql);
  const results=[];
  // SQL storage is public.records JSONB. INSERT of a new draft is allowed;
  // rewriting existing records to draft requires a dedicated safety review.
  const updates=/\bUPDATE\s+(?:public\s*\.\s*)?records\b(?:\s+(?:AS\s+)?[a-z_][a-z_0-9]*)?\s+SET\b/gi;
  for(const match of text.matchAll(updates)){
    const tail=text.slice(match.index);
    const statement=tail.slice(0,tail.indexOf(';')===-1?tail.length:tail.indexOf(';'));
    const assignments=[
      /\b(?:status|documentStatus|accountingStatus)\s*=\s*'draft'/i,
      /['"](?:status|documentStatus|accountingStatus)['"]\s*,\s*['"]draft['"]/i,
      /'\{\s*(?:status|documentStatus|accountingStatus)\s*\}'\s*,\s*'(?:"draft"|draft)'/i
    ];
    if(assignments.some(p=>p.test(statement))){
      const line=1+text.slice(0,match.index).split('\n').length-1;
      results.push({line,reason:'UPDATE of existing public.records assigns accounting lifecycle draft; historical posted/reversed rows must be preserved'});
    }
  }
  return results;
}


// Conservative, diff-only review heuristic for exposed journal-identity RPCs.
// This intentionally checks new/modified migration SQL only. SQL semantics,
// real JWT permissions and journal transactional atomicity still require review.
export function findUnsafePublicJournalIdentityRpcs(sql){
  const source=withoutComments(sql),findings=[];
  const starts=[...source.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\s*\.\s*(finora_journal_[a-z_0-9]*identity)\s*\(/gi)];
  for(let i=0;i<starts.length;i++){
    const match=starts[i],name=match[1].toLowerCase();
    const segment=source.slice(match.index,starts[i+1]?.index??source.length);
    const definition=/\bAS\s+(\$[a-z_0-9]*\$)([\s\S]*?)\1\s*;/i.exec(segment);
    if(!definition)continue;
    const header=segment.slice(0,definition.index),body=definition[2];
    // PostgreSQL grants EXECUTE to PUBLIC for new functions by default.
    // An explicit GRANT is *not* needed to make a SECURITY DEFINER public RPC callable.
    // An explicit REVOKE from PUBLIC suppresses this default only when no
    // separate GRANT to authenticated/anon/PUBLIC restores access.
    // ALTER DEFAULT PRIVILEGES / prior ACLs and SQL semantics require manual review.
    const grant=new RegExp('\\bGRANT\\s+(?:EXECUTE|ALL(?:\\s+PRIVILEGES)?)\\s+ON\\s+FUNCTION\\s+public\\s*\\.\\s*'+name+'\\s*\\([^;]*\\)\\s+TO\\s+[^;]*\\b(?:authenticated|anon|PUBLIC)\\b[^;]*;','i');
    const revokePublic=new RegExp('\\bREVOKE\\s+(?:EXECUTE|ALL(?:\\s+PRIVILEGES)?)\\s+ON\\s+FUNCTION\\s+public\\s*\\.\\s*'+name+'\\s*\\([^;]*\\)\\s+FROM\\s+[^;]*\\bPUBLIC\\b[^;]*;','i');
    const exposedBySource=grant.test(source)||!revokePublic.test(source);
    if(!/\bSECURITY\s+DEFINER\b/i.test(header)||!exposedBySource)continue;
    const line=source.slice(0,match.index).split('\n').length;
    const flag=reason=>findings.push({line,kind:'identity-rpc',reason:name+': '+reason});
    if(/\bp_actor\s+uuid\b/i.test(header)&&/\bp_actor\b/i.test(body))
      flag('caller-supplied p_actor reaches privileged identity RPC; derive audit actor from auth.uid()');
    if(/_post_identity$/.test(name)&&
       /\bUPDATE\s+public\s*\.\s*finora_journal_document_registry\s+SET\s+state\s*=\s*'posted'/i.test(body))
      flag('direct registry-only posted state can bypass canonical journal posting checks');
    if(/_allocate_identity$/.test(name)&&
       /\bINSERT\s+INTO\s+public\s*\.\s*finora_journal_document_registry\b/i.test(body)&&
       !/\bFROM\s+public\s*\.\s*records\b/i.test(body))
      flag('public allocator lacks a direct persisted voucher/company/fiscal scope lookup');
  }
  // A later migration can re-expose an existing identity function by a
  // standalone GRANT; this file contains no CREATE and cannot inspect the
  // complete prior function/ACL history. Fail closed to require review.
  const standaloneGrants=/\bGRANT\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+FUNCTION\s+public\s*\.\s*(finora_journal_[a-z_0-9]*identity)\s*\([^;]*?\)\s+TO\s+[^;]*\b(?:authenticated|anon|PUBLIC)\b[^;]*;/gi;
  for(const grant of source.matchAll(standaloneGrants)){
    const name=grant[1].toLowerCase();
    if(starts.some(x=>x[1].toLowerCase()===name))continue;
    findings.push({
      line:source.slice(0,grant.index).split('\n').length,
      kind:'identity-rpc',
      reason:name+': standalone grant can re-expose a prior journal identity RPC; manual ACL and JWT review required'
    });
  }
  return findings;
}

function git(args,cwd=process.cwd()){
  const r=spawnSync('git',args,{cwd,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
  if(r.error||r.status!==0)throw Error('Git migration diff unavailable: '+(r.stderr||r.error?.message||'git exit '+r.status).trim());
  return r.stdout;
}

export function auditMigrationDiff({base='HEAD^',head='HEAD',cwd=process.cwd()}={}){
  const refs=/^(?:[a-fA-F0-9]{40}|HEAD(?:\^|~1)?)$/;
  if(!refs.test(base)||!refs.test(head))throw Error('Invalid migration compare SHA');
  const names=git(['diff','--no-renames','--name-only','--diff-filter=AM',base,head,'--','supabase/migrations'],cwd);
  const violations=[];
  let inspected=0;
  for(const path of names.split('\n').filter(Boolean)){
    if(!/^supabase\/migrations\/[a-zA-Z0-9_.-]+\.sql$/.test(path))
      throw Error('Unexpected migration path from Git diff');
    const sql=git(['show',head+':'+path],cwd);
    inspected++;
    for(const finding of [...findPostedToDraftRewrites(sql),...findUnsafePublicJournalIdentityRpcs(sql)])violations.push({file:path,...finding});
  }
  return {inspected,violations};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const input=process.env.FINORA_MIGRATION_BASE_SHA||'';
    const base=input&&!/^0+$/.test(input)?input:'HEAD^';
    const report=auditMigrationDiff({base});
    if(report.violations.length){
      for(const v of report.violations)
        console.error((v.kind==='identity-rpc'?'FINORA_IDENTITY_RPC_MIGRATION_BLOCKED':'FINORA_POSTED_HISTORY_DOWNGRADE_BLOCKED')+' '+v.file+':'+v.line+' '+v.reason);
      console.error('STOP MERGE: preserve posted history and forbid exposed identity-RPC state/audit bypass; require owner-reviewed journal atomicity, real JWT negatives and migration parity.');
      process.exitCode=1;
    }else{
      console.log('FINORA_POSTED_HISTORY_MIGRATION_TRIPWIRE_PASS: '+report.inspected+' changed migration file(s) scanned; heuristic only, SQL review required.');
      console.log('FINORA_IDENTITY_RPC_MIGRATION_TRIPWIRE_PASS: '+report.inspected+' changed migration file(s) scanned; heuristic only, real JWT/DB review required.');
    }
  }catch(error){console.error('FINORA_MIGRATION_GUARD_UNVERIFIED: '+error.message);process.exitCode=1;}
}
