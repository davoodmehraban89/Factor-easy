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
    for(const finding of findPostedToDraftRewrites(sql))violations.push({file:path,...finding});
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
        console.error('FINORA_POSTED_HISTORY_DOWNGRADE_BLOCKED '+v.file+':'+v.line+' '+v.reason);
      console.error('STOP MERGE: preserve historical posted/reversed records and reversal links; use owner-approved non-destructive migration and isolated historic parity tests.');
      process.exitCode=1;
    }else{
      console.log('FINORA_POSTED_HISTORY_MIGRATION_TRIPWIRE_PASS: '+report.inspected+' changed migration file(s) scanned; heuristic only, SQL review required.');
    }
  }catch(error){console.error('FINORA_MIGRATION_GUARD_UNVERIFIED: '+error.message);process.exitCode=1;}
}
