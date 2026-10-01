"""Standard-library evidence IO; no runtime/world imports and no file replacement."""
import argparse,hashlib,json,pathlib,subprocess,datetime,traceback,gzip
BASE='1cf76c551e6f49124b6257162bc4d36ca18d7bd1'
WORLD='public/horizon/world/horizon-geo-1.json'
def sha(b):return hashlib.sha256(b).hexdigest()
def write(path,value):
 with path.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
def start(description):
 p=argparse.ArgumentParser(description=description);p.add_argument('--root',required=True);p.add_argument('--out',required=True);a=p.parse_args();root=pathlib.Path(a.root).resolve();out=pathlib.Path(a.out).resolve();out.mkdir(parents=True,exist_ok=False)
 def git(*args):return subprocess.check_output(['git','-C',str(root),*args])
 try:
  resolved=git('rev-parse',BASE+'^{commit}').decode().strip()
  if resolved!=BASE:raise ValueError('Fixed baseline did not resolve exactly')
  current=(root/WORLD).read_bytes();baseline=git('show',BASE+':'+WORLD)
  inputs={WORLD:sha(current),'baseline:'+WORLD:sha(baseline)}
  for q in ['public/horizon/world/horizon-geo-1.json.gz','public/horizon/terrain/horizon-geo-1.bin']:
   if not (root/q).is_file():raise FileNotFoundError(q)
   inputs[q]=sha((root/q).read_bytes())
  if json.loads(gzip.decompress((root/'public/horizon/world/horizon-geo-1.json.gz').read_bytes()))!=json.loads(current):raise ValueError('Current readable and served compressed world definitions differ')
  # Capture the complete source scope, including untracked files; do not assume HEAD equals working tree.
  paths=git('ls-files','-z','--cached','--others','--exclude-standard','--','src/harbour','src/house/world','scripts/horizon').decode().split('\0')
  sources={q:sha((root/q).read_bytes()) for q in sorted(set(paths)) if q and (root/q).is_file()}
  tools={q.name:sha(q.read_bytes()) for q in pathlib.Path(__file__).parent.glob('*.py')}
  manifest={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'out':str(out),'baselineCommit':BASE,'head':git('rev-parse','HEAD').decode().strip(),'workingTreeStatus':git('status','--porcelain=v1').decode(),'inputHashes':inputs,'sourceHashes':sources,'toolHashes':tools}
  write(out/'manifest.json',manifest)
  return root,out,json.loads(current),json.loads(baseline),manifest
 except Exception:
  write(out/'error.json',{'error':traceback.format_exc(),'baselineCommit':BASE});raise

def finish(root,out,manifest):
 """Retain a second independent manifest and reject source/asset drift after analysis."""
 paths=subprocess.check_output(['git','-C',str(root),'ls-files','-z','--cached','--others','--exclude-standard','--','src/harbour','src/house/world','scripts/horizon']).decode().split('\0')
 sources={q:sha((root/q).read_bytes()) for q in sorted(set(paths)) if q and (root/q).is_file()}
 inputs={q:sha((root/q).read_bytes()) for q in manifest['inputHashes'] if not q.startswith('baseline:')}
 head=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD']).decode().strip()
 stable=head==manifest['head'] and sources==manifest['sourceHashes'] and all(manifest['inputHashes'][q]==h for q,h in inputs.items())
 write(out/'manifest-end.json',{'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':head,'sourceHashes':sources,'inputHashes':inputs,'sourceStable':stable})
 if not stable:raise RuntimeError('Source or input assets changed during analysis; findings retained but run is not a stable snapshot')
