from pathlib import Path
import re,json,csv,html,subprocess
import os
root=Path(os.environ.get('FINORA_AUDIT_ROOT', '.')).resolve();out=Path(os.environ.get('FINORA_AUDIT_OUT', '/tmp/finora-controls-audit'));out.mkdir(parents=True,exist_ok=True)
files=[root/'index.html',*sorted((root/'js').glob('*.js'))]
tests={str(p.relative_to(root)):p.read_text() for p in (root/'scripts').glob('*') if p.suffix in ['.js','.mjs'] and ('spec' in p.name or 'test' in p.name or 'check' in p.name)}
alltext='\n'.join(p.read_text() for p in files);definitions=set(re.findall(r'\bfunction\s+([\w$]+)\s*\(',alltext));definitions.update(re.findall(r'(?:window\.)?([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)',alltext));definitions.update(re.findall(r'\b(?:const|let|var)\s+([\w$]+)\s*=',alltext))
rows=[]
for p in files:
 s=p.read_text()
 for m in re.finditer(r'<(button|input|select|textarea|a|summary)\b([^>]*)(?:>(.*?)</\1\s*>|>)',s,re.S|re.I):
  tag,attrs,body=m.group(1).lower(),m.group(2),m.group(3) or ''
  attr={a.lower():html.unescape(v) for a,q,v in re.findall(r'([\w:-]+)\s*=\s*([\"\'])(.*?)\2',attrs,re.S)}
  handlers={k:v for k,v in attr.items() if k.startswith('on')}
  label=html.unescape(re.sub('<[^>]*>',' ',body));label=re.sub(r'\s+',' ',label).strip()[:160]
  roots=sorted(set(x for h in handlers.values() for x in re.findall(r'(?<![.\w])([A-Za-z_$][\w$]*)\s*\(',h) if x not in {'if','function','for','switch','catch','return'}))
  refs=[name for name,t in tests.items() if (attr.get('id') and attr['id'] in t) or any(re.search(r'\b'+re.escape(x)+r'\b',t) for x in roots)]
  rows.append({'source':str(p.relative_to(root)),'line':s.count('\n',0,m.start())+1,'tag':tag,'id':attr.get('id',''),'label':label,'type':attr.get('type',''),'handlers':handlers,'call_roots':roots,'unresolved_static':[x for x in roots if x not in definitions and x not in {'alert','confirm','prompt','setTimeout','clearTimeout','Number','String','parseInt','parseFloat','encodeURIComponent','JSON','Math','Object','Array','Date'}],'test_reference_files':refs,'test_reference_only':True,'execution_status':'NOT_EXECUTED_BY_STATIC_INVENTORY'})
# Attribute-level inventory catches handlers on div/td and JS-generated fragments, independently of control tag parser.
events=[]
for p in files:
 s=p.read_text()
 for m in re.finditer(r'\b(on(?:click|change|input|submit|keydown|keyup|focus|blur|dblclick))\s*=\s*([\"\'])(.*?)\2',s,re.S):events.append({'source':str(p.relative_to(root)),'line':s.count('\n',0,m.start())+1,'event':m.group(1),'expression':html.unescape(m.group(3))})
summary={'sha':subprocess.check_output(['git','rev-parse','origin/main'],cwd=root,text=True).strip(),'source_files':len(files),'control_template_occurrences':len(rows),'index_control_occurrences':sum(r['source']=='index.html' for r in rows),'js_control_template_occurrences':sum(r['source']!='index.html' for r in rows),'event_attribute_occurrences':len(events),'controls_with_inline_handler':sum(bool(r['handlers']) for r in rows),'controls_with_test_lexical_reference':sum(bool(r['test_reference_files']) for r in rows),'controls_without_test_lexical_reference':sum(not r['test_reference_files'] for r in rows),'unique_inline_expressions':len(set(r['expression'] for r in events)),'unresolved_static_candidates':sorted(set(x for r in rows for x in r['unresolved_static'])),'caveats':['Source regex counts template occurrences, not unique rendered controls or record-row instances.','Quoted HTML in JavaScript may contain interpolations; source labels/handlers can be partial.','Test string references are not execution coverage or assertions.','No input field or button was clicked by this static script.']}
(out/'controls-static.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));(out/'event-attributes.json').write_text(json.dumps(events,ensure_ascii=False,indent=2));(out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
with (out/'controls-static.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in r.items()} for r in rows)
print(json.dumps(summary,ensure_ascii=False,indent=2))
