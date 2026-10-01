import subprocess,json,os,time,hashlib
from pathlib import Path
root=Path('/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book')
base=root/'docs/horizon/evidence/mountain-road/after/final'
logdir=base/'runs';logdir.mkdir(parents=True,exist_ok=True)
baseworld=json.loads(subprocess.check_output(['git','show','1cf76c551e6f49124b6257162bc4d36ca18d7bd1:public/horizon/world/horizon-geo-1.json'],cwd=root,text=True))
original=','.join(b['id'] for b in baseworld['collision']['beds'] if b['kind']=='road' and (b['id'] in ['V01','VG','V03','VBS'] or b['id'].startswith('spur ') or b['id'].startswith('plot.') and b['id'].endswith('.service')))
out=lambda name:str(base/name)
node=lambda script,*args:['node','scripts/horizon/'+script,*args]
jobs=[
 ('budget-all',node('mountain-budgets.mjs'),{'CORRIDOR_IDS':'all'},base/'budget-all.json'),
 ('budget-mountain',node('mountain-budgets.mjs'),{},base/'budget-mountain.json'),
 ('budget-baked-solids',node('mountain-baked-budget.mjs',out('budget-baked-solids.json')),{},None),
 ('envelopes',node('mountain-envelope-audit.mjs',str(root),out('envelopes.json')),{},None),
 ('cruiser-chain',node('road-audit.mjs','--mountain-chain','--title','after','--out',out('cruiser-chain')),{},None),
 ('cruiser-original',node('road-audit.mjs','--beds',original,'--title','after','--out',out('cruiser-original')),{},None),
 ('cruiser-stillwater',node('road-audit.mjs','--beds','spur stillwater','--title','after','--out',out('cruiser-stillwater')),{},None),
 ('cruiser-natural',node('road-audit.mjs','--mountain-chain','--no-static','--natural-downhill','--title','after','--out',out('cruiser-natural')),{},None),
 ('modes',node('mountain-modes-audit.mjs',str(root),out('modes'),'--registry-board'),{},None),
 ('footways',node('mountain-modes-audit.mjs',str(root),out('footways'),'--footways'),{},None),
 ('native-paced',node('mountain-native-audit.mjs',str(root),out('native-paced'),'paced'),{},None),
 ('native-natural',node('mountain-native-audit.mjs',str(root),out('native-natural'),'natural-downhill'),{'MOUNTAIN_ROUTES':'mountain-road'},None),
 ('native-landings',node('mountain-native-landings-audit.mjs',str(root),out('native-landings'),'--run','--full-branches'),{},None),
 ('hairpins',node('summarize-mountain-hairpins.mjs','--cruiser',out('cruiser-chain/audit.json'),'--cruiser',out('cruiser-natural/audit.json'),'--native',out('native-paced/native-results.json'),'--native',out('native-natural/native-results.json'),'--out',out('hairpins')),{},None),
]
def proof():
 paths=sorted(set(subprocess.check_output(['git','ls-files','-co','--exclude-standard','src','scripts','test','public/horizon'],cwd=root,text=True).splitlines()))
 hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths if (root/p).is_file()}
 return {'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'sha256':hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest(),'files':hashes}
record={'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'results':[]};start=proof();(logdir/'source-start.json').write_text(json.dumps(start,indent=2));record['sourceStart']=start['sha256']
for name,cmd,extra,destination in jobs:
 if Path('/tmp/mountain-final-pause').exists():print('Pause requested before',name,flush=True);break
 if destination and destination.exists():raise SystemExit('Refusing overwrite '+str(destination))
 if (base/name).exists() and (base/name).is_dir():raise SystemExit('Refusing overwrite '+str(base/name))
 print('START',name,flush=True);t=time.monotonic()
 with (destination or logdir/(name+'.txt')).open('w') as f, (logdir/(name+'.stderr.txt')).open('w') as e:
  r=subprocess.run(cmd,cwd=root,env={**os.environ,**extra,'pnpm_config_verify_deps_before_run':'false'},stdout=f,stderr=e)
 item={'name':name,'command':cmd,'environment':extra,'exitCode':r.returncode,'seconds':round(time.monotonic()-t,3)};record['results'].append(item);(logdir/'results.json').write_text(json.dumps(record,indent=2));print(item,flush=True)
 end=proof()
 if end['sha256']!=start['sha256']:raise SystemExit('Source changed: remaining runs suspended')
record['sourceEnd']=end['sha256'];record['sourceStable']=end['sha256']==start['sha256'];record['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());(logdir/'source-end.json').write_text(json.dumps(end,indent=2));(logdir/'results.json').write_text(json.dumps(record,indent=2))
