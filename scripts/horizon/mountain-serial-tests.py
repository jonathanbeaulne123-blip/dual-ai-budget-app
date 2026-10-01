import subprocess,json,time,os,hashlib,argparse,sys,traceback
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--out',required=True);args=parser.parse_args()
root=Path.cwd();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=False)
files=sorted(str(p) for p in (root/'test').glob('*.test.*') if p.name.startswith(('horizon','journey-','harbour-world-toggle','harbour-source-fences','harbour-walk','mountain-','mountainTerrain','mountainRace','mountainStreaming','hearth-mountain','skate-','native-library-entry','native-body-height-spawn','harbour-open-world','harbour-body','harbour-hercules','harbour-skate','world-presence','desk-mountain-integration')) and not p.name.startswith(('mountain-demo','skate-review')))
# Explicit change-required serial lane, not the exhaustive repository gate.
files=[str(Path(p).relative_to(root)) for p in files]
def source_proof():
 paths=sorted(set(subprocess.check_output(['git','ls-files','-co','--exclude-standard','src','scripts','test','public/horizon','public/mountain','package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','tsconfig.app.json'],text=True).splitlines()))
 hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths if (root/p).is_file()}
 return {'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'sha256':hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest(),'files':hashes}
start=source_proof(); (out/'source-start.json').write_text(json.dumps(start,indent=2))
report={'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sourceStart':start['sha256'],'method':'Explicit change-required files, one Vitest process at a time. Not the exhaustive gate.','files':files,'results':[]}
env={**os.environ,'pnpm_config_verify_deps_before_run':'false','VITEST_MAX_THREADS':'1','VITEST_MIN_THREADS':'1','VITEST_MAX_FORKS':'1','VITEST_MIN_FORKS':'1'}

end=start;stop=None
try:
 for i,p in enumerate(files):
  before=source_proof()
  if before['sha256']!=start['sha256'] or before['head']!=start['head']:stop='source-drift-before-test';break
  t=time.monotonic();log=out/(Path(p).name+'.txt')
  try:
   with log.open('x') as f:r=subprocess.run(['pnpm','exec','vitest','run',p,'--maxWorkers=1','--minWorkers=1'],stdout=f,stderr=subprocess.STDOUT,env=env)
   row={'file':p,'exitCode':r.returncode,'seconds':round(time.monotonic()-t,3),'log':log.name,'sourceBefore':before['sha256']}
  except Exception as e:row={'file':p,'exitCode':None,'error':repr(e),'log':log.name}
  report['results'].append(row);(out/'serial-results.json').write_text(json.dumps(report,indent=2));print(i+1,len(files),row,flush=True)
  end=source_proof();row['sourceAfter']=end['sha256']
  if end['sha256']!=start['sha256'] or end['head']!=start['head']:stop='source-drift-after-test';break
except BaseException:
 stop='interrupted-or-runner-error';report['runnerError']=traceback.format_exc()
finally:
 end=source_proof();(out/'source-end.json').write_text(json.dumps(end,indent=2));failed=sum(r.get('exitCode')!=0 for r in report['results']);complete=bool(files) and len(report['results'])==len(files)
 report.update(sourceEnd=end['sha256'],sourceStable=start['sha256']==end['sha256'] and start['head']==end['head'],allFilesCompleted=complete,failedProcesses=failed,stopReason=stop,endedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),status='incomplete' if not complete or stop else 'failed' if failed else 'passed')
 (out/'serial-results.json').write_text(json.dumps(report,indent=2));print(json.dumps({'files':len(files),'completed':len(report['results']),'failed':failed,'sourceStable':report['sourceStable'],'status':report['status']}),flush=True)
sys.exit(1 if failed or not complete or stop or not report['sourceStable'] else 0)
