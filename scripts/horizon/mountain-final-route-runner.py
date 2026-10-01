import subprocess,json,os,time,hashlib,argparse,sys,traceback
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--root',default=str(Path.cwd()));parser.add_argument('--out',required=True);parser.add_argument('--pause-file');args=parser.parse_args()
root=Path(args.root).resolve();base=Path(args.out).resolve();base.mkdir(parents=True,exist_ok=False)
logdir=base/'runs';logdir.mkdir()
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
 ('footways',node('mountain-modes-audit.mjs',str(root),out('footways'),'--footways'),{'MOUNTAIN_BASELINE_REF':'1cf76c551e6f49124b6257162bc4d36ca18d7bd1','MOUNTAIN_BASELINE_NATIVE':str(root/'docs/horizon/evidence/mountain-road/after/attempts/expanded-native-footway-comparison/baseline-native-paths.json')},None),
 # Keep exact centreline outcomes above. This separate ordinary-input policy
 # proves access around visible furniture within each unchanged source width.
 ('footways-clearance',node('mountain-modes-audit.mjs',str(root),out('footways-clearance'),'--footways','--walk-clearance'),{'MOUNTAIN_BASELINE_REF':'1cf76c551e6f49124b6257162bc4d36ca18d7bd1','MOUNTAIN_BASELINE_NATIVE':str(root/'docs/horizon/evidence/mountain-road/after/attempts/expanded-native-footway-comparison/baseline-native-paths.json')},None),
 ('native-paced',node('mountain-native-audit.mjs',str(root),out('native-paced'),'paced'),{},None),
 ('native-natural',node('mountain-native-audit.mjs',str(root),out('native-natural'),'natural-downhill'),{'MOUNTAIN_ROUTES':'mountain-road'},None),
 ('native-landings',node('mountain-native-landings-audit.mjs',str(root),out('native-landings'),'--run','--full-branches','--native-roads'),{},None),
 ('hairpins',node('summarize-mountain-hairpins.mjs','--cruiser',out('cruiser-chain/audit.json'),'--cruiser',out('cruiser-natural/audit.json'),'--native',out('native-paced/native-results.json'),'--native',out('native-natural/native-results.json'),'--out',out('hairpins')),{},None),
]
def proof():
 paths=sorted(set(subprocess.check_output(['git','ls-files','-co','--exclude-standard','src','scripts','test','public/horizon','public/mountain','package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','tsconfig.app.json'],cwd=root,text=True).splitlines()))
 hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths if (root/p).is_file()}
 baseline_native=root/'docs/horizon/evidence/mountain-road/after/attempts/expanded-native-footway-comparison/baseline-native-paths.json'
 hashes[str(baseline_native.relative_to(root))]=hashlib.sha256(baseline_native.read_bytes()).hexdigest()
 return {'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'sha256':hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest(),'files':hashes}

def write(path,data):path.write_text(json.dumps(data,indent=2)+'\n')
def observations(name):
 """Keep process completion separate from visible acceptance findings; never auto-waive inherited defects."""
 if name.startswith('cruiser-'):
  path=base/name/'audit.json';r=json.loads(path.read_text());bad=[q for rows in r.get('issues',{}).values() for q in rows if q.get('severity') in ('BLOCKER','MAJOR')]
  bad_drives=[q for q in r.get('drives',[]) if not q.get('completed',False) or q.get('restarts') or q.get('contacts',0) or q.get('airborneSteps',0)]
  if not r.get('drives'):return {'status':'incomplete','reason':'No drives recorded','artifact':str(path)}
  return {'status':'findings' if bad or bad_drives else 'review-required','findingCount':len(bad),'failedDriveCount':len(bad_drives),'artifact':str(path),'limits':'Static severity retained. Drive completion/contact/air and authorized dispositions remain explicit in original audit.'}
 if name in ('modes','footways','footways-clearance','native-paced','native-natural','native-landings'):
  path=base/name/('native-results.json' if name.startswith('native-') and name!='native-landings' else 'results.json');r=json.loads(path.read_text());rows=r.get('results',[])
  bad=[q for q in rows if not q.get('completed',False) or q.get('restarts',0) or q.get('bails',0) or q.get('airborneFrames',0) or any(q.get('contacts',{}).values())]
  return {'status':'incomplete' if not rows else 'findings' if bad else 'review-required','attempts':len(rows),'findingCount':len(bad),'artifact':str(path),'limits':'Clean emitted attempts still require inventory coverage/disposition review; inherited failures retained.'}
 if name=='envelopes':
  path=base/'envelopes.json';r=json.loads(path.read_text());rows=r.get('results',[]);bad=[q for q in rows if q.get('status')!='clear-by-conservative-envelope']
  return {'status':'incomplete' if not rows else 'findings' if bad else 'review-required','findingCount':len(bad),'artifact':str(path)}
 path=base/(name+'.json') if name!='hairpins' else base/name/'HAIRPINS.json';r=json.loads(path.read_text())
 return {'status':'review-required','artifact':str(path),'limits':'Measured budget capacities, sampled limits and hairpin reach are retained in original JSON; process success is not acceptance.'}
record={'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'expectedJobs':[j[0] for j in jobs],'results':[],'acceptanceStatus':'pending-review'}
start=proof();end=start;write(logdir/'source-start.json',start);record['sourceStart']=start['sha256'];stop=None
# Never inherit an accidental narrowed route/asset selection from an earlier shell command.
selectors=['MOUNTAIN_ROUTES','CORRIDOR_IDS','MOUNTAIN_BUDGET_WORLD','MOUNTAIN_BUDGET_TERRAIN','MOUNTAIN_BASELINE_WORLD','MOUNTAIN_BASELINE_NATIVE','MOUNTAIN_BASELINE_REF','HEARTH_REBAKE']
base_env={k:v for k,v in os.environ.items() if k not in selectors};record['discardedAmbientSelectors']={k:os.environ[k] for k in selectors if k in os.environ}
try:
 for name,cmd,extra,destination in jobs:
  if args.pause_file and Path(args.pause_file).exists():stop='pause-requested';break
  before=proof()
  if before['sha256']!=start['sha256'] or before['head']!=start['head']:stop='source-drift-before-job';end=before;break
  print('START',name,flush=True);t=time.monotonic();item={'name':name,'command':cmd,'environment':extra,'sourceBefore':before['sha256']}
  try:
   with (destination or logdir/(name+'.txt')).open('x') as f,(logdir/(name+'.stderr.txt')).open('x') as e:
    result=subprocess.run(cmd,cwd=root,env={**base_env,**extra,'pnpm_config_verify_deps_before_run':'false'},stdout=f,stderr=e)
   item['exitCode']=result.returncode
   try:item['acceptance']=observations(name)
   except Exception as error:item['acceptance']={'status':'incomplete','error':repr(error)}
   item['processStatus']='completed' if result.returncode==0 else 'completed-with-findings' if name=='envelopes' and result.returncode==2 and item['acceptance']['status']=='findings' else 'failed'
  except Exception as error:item.update(processStatus='failed',error=repr(error),acceptance={'status':'incomplete'})
  item['seconds']=round(time.monotonic()-t,3);record['results'].append(item);write(logdir/'results.json',record);print(item,flush=True)
  end=proof();item['sourceAfter']=end['sha256']
  if end['sha256']!=start['sha256'] or end['head']!=start['head']:stop='source-drift-after-job';break
except BaseException as error:
 stop='interrupted-or-runner-error';record['runnerError']=traceback.format_exc()
finally:
 end=proof();record.update(sourceEnd=end['sha256'],sourceStable=end['sha256']==start['sha256'] and end['head']==start['head'],completedJobs=len(record['results']),allJobsCompleted=len(record['results'])==len(jobs),stopReason=stop,endedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
 failed=any(r.get('exitCode',1)!=0 or r.get('acceptance',{}).get('status') in ('findings','incomplete') for r in record['results'])
 record['executionStatus']='incomplete' if not record['allJobsCompleted'] or stop else 'completed-with-failures' if any(r.get('processStatus')=='failed' for r in record['results']) else 'completed'
 record['acceptanceStatus']='failures-retained' if failed else 'pending-review'
 write(logdir/'source-end.json',end);write(logdir/'results.json',record)
sys.exit(1 if failed or not record['allJobsCompleted'] or not record['sourceStable'] or stop else 0)
