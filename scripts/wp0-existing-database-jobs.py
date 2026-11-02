import subprocess,re,os,time,tempfile,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'.github/workflows/quality.yml').read_text()
results=[]
for job,db in [('identity-wave5a-database','finora_identity'),('c8-policy-database','finora_c8'),('d1-request-database','finora_d1')]:
 name='finora-wp0-'+job
 log=open('/tmp/wp0-'+job+'.log','w')
 def run(args,**kw):return subprocess.run(args,stdout=log,stderr=subprocess.STDOUT,check=True,**kw)
 try:
  run(['docker','run','--rm','-d','--network','none','--name',name,'-v',str(root)+':/work:ro','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB='+db,'postgres:17-alpine'])
  for _ in range(100):
   if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres','-d',db],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
   time.sleep(.1)
  section=s.split('  '+job+':')[1].split('\n  ',1)[0] if False else re.split(r'\n  [a-z0-9-]+:',s.split('  '+job+':',1)[1])[0]
  cmds=re.findall(r'^        run: (psql .+|node scripts/office-c8-concurrency.mjs)$',section,re.M)
  for cmd in cmds:
   log.write('COMMAND '+cmd+'\n');log.flush()
   if cmd.startswith('psql '):run(['docker','exec','-i','-w','/work',name,'psql','-U','postgres','-d',db,*cmd.split()[1:]])
   else:
    with tempfile.TemporaryDirectory() as d:
     shim=Path(d)/'psql';shim.write_text('#!/usr/bin/env python3\nimport os,subprocess,sys\nsys.exit(subprocess.run(["docker","exec","-i",os.environ["WP0_CONTAINER"],"psql","-U","postgres","-d",os.environ["WP0_DATABASE"],*sys.argv[1:]]).returncode)\n');shim.chmod(0o755)
     run(cmd.split(),cwd=root,env={**os.environ,'PATH':d+':'+os.environ['PATH'],'WP0_CONTAINER':name,'WP0_DATABASE':db})
  results.append({'job':job,'result':'PASS','commands':len(cmds)})
 except Exception as e:results.append({'job':job,'result':'FAIL','error':str(e)})
 finally:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL);log.close()
print(json.dumps(results,indent=2))
(root/'docs/wp0/EXISTING_DATABASE_RESULTS.json').write_text(json.dumps(results,indent=2)+'\n')

if any(x["result"] != "PASS" for x in results): raise SystemExit(1)
