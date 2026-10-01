import json,re,sys
from pathlib import Path
current=Path(sys.argv[1]); baseline=Path(sys.argv[2]); output=Path(sys.argv[3])
a=json.loads((current/'serial-results.json').read_text());b=json.loads((baseline/'results.json').read_text());prior={r['file']:r for r in b['results']}
rows=[]
for r in a['results']:
 log=(current/r['log']).read_text(); summaries=re.findall(r'^\s*Tests\s+([^\n]+)',log,re.M)
 counts={k:int(v) for v,k in re.findall(r'(\d+)\s+(passed|failed|todo|skipped)',summaries[-1] if summaries else '')}
 cases=re.findall(r'^ FAIL\s+([^\n]+)',log,re.M)
 base=prior.get(r['file']); basecases=[]
 if base:basecases=re.findall(r'^ FAIL\s+([^\n]+)',(baseline/base['log']).read_text(),re.M)
 rows.append({**r,'assertions':counts,'failedCases':cases,'runtimeError':'Unhandled Error' in log,'baseline':base,'sameFailedCaseNames':cases==basecases if base else None})
report={'sourceStart':a['sourceStart'],'sourceStable':a.get('sourceStable'),'baselineHead':b['head'],'note':'Same test names identify matching assertions, not identical geometry or complete inheritance. Numerical witnesses and dependency proof must also be inspected. Failed runner exits remain failed even where assertions pass.','files':len(rows),'failedFiles':sum(r['exitCode']!=0 for r in rows),'assertions':{k:sum(r['assertions'].get(k,0) for r in rows) for k in ['passed','failed','todo','skipped']},'rows':rows}
output.write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2))
