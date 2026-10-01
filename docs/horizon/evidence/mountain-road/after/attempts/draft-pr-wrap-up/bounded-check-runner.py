import os, subprocess, time, json, signal, hashlib
from pathlib import Path
root=Path.cwd()
out=root/'docs/horizon/evidence/mountain-road/after/attempts/draft-pr-wrap-up'
env=dict(os.environ,pnpm_config_verify_deps_before_run='false',VITEST_MAX_THREADS='1',VITEST_MIN_THREADS='1',VITEST_MAX_FORKS='1',VITEST_MIN_FORKS='1')
files=[p for folder in ['src','scripts'] for p in (root/folder).rglob('*') if p.is_file() and not '__pycache__' in p.parts]
files += [root/'native-mountain-review.html',root/'horizon-review.html',root/'package.json']
def hashes():return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
before=hashes()
(out/'source-before.json').write_text(json.dumps(before,indent=2)+'\n')
jobs=[('high-quick-gate',['pnpm','test','--','--risk=high','--focus=test/horizon-walking-ground-patch.test.ts','--focus=test/horizon-funicular-render-precision.test.ts','--focus-reason=Draft PR wrap-up: shared ground construction and preserved funicular render geometry'],300),('bake',['pnpm','horizon:bake'],300),('byte-exact-check',['pnpm','horizon:check'],300)]
results=[]
for name,cmd,limit in jobs:
    start=time.monotonic()
    print(json.dumps({'phase':name,'state':'started','hardStopSeconds':limit}),flush=True)
    with (out/(name+'.txt')).open('w') as log:
        child=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT,env=env,start_new_session=True)
        timedOut=False
        try:code=child.wait(timeout=limit)
        except subprocess.TimeoutExpired:
            timedOut=True
            os.killpg(child.pid,signal.SIGTERM)
            try:code=child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid,signal.SIGKILL);code=child.wait()
            log.write('\nBounded draft wrap-up stopped this command at its recorded deadline; INCOMPLETE, NOT A PASS.\n')
    record={'phase':name,'command':cmd,'elapsedSeconds':round(time.monotonic()-start,3),'exitCode':code,'timedOut':timedOut,'accepted':code==0 and not timedOut}
    results.append(record)
    (out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(record),flush=True)
after=hashes()
(out/'source-after.json').write_text(json.dumps(after,indent=2)+'\n')
drift=[p for p in before if before[p]!=after.get(p)]
(out/'source-stability.json').write_text(json.dumps({'files':len(before),'drift':drift,'stable':not drift},indent=2)+'\n')
print(json.dumps({'sourceStable':not drift,'files':len(before),'drift':drift}),flush=True)
