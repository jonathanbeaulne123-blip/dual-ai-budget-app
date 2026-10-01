"""Compare every baked authored proof to fixed integrated-main; preserve failures, cameras and raw metrics."""
import traceback
from evidence_common import start,write,finish
root,out,w,b,manifest=start(__doc__)
try:
 old={v['id']:v for v in b['views']};now={v['id']:v for v in w['views']};rows=[]
 if len(old)!=len(b['views']) or len(now)!=len(w['views']):raise ValueError('Duplicate view ID')
 for vid in sorted(set(old)|set(now)):
  v,q=now.get(vid),old.get(vid);p=v.get('proof') if v else None;bp=q.get('proof') if q else None
  camera=lambda a:{k:a.get(k) for k in ['eye','target','fovDegrees','aspect','portrait','radius','subjectIds','deferred']} if a else None
  rows.append({'id':vid,'cameraUnchanged':camera(v)==camera(q),'beforeCamera':camera(q),'afterCamera':camera(v),'proofChanged':p!=bp,'beforeProof':bp,'afterProof':p,'currentFailure':not p or not p.get('passLandscape') or not p.get('passPortrait'),'sameExactProofAsBaseline':p==bp,'removed':v is None,'added':q is None})
 missing=[i for i in 'ABCDEFGHIJKL' if i not in now];failed=[r['id'] for r in rows if r['currentFailure']]
 diagnostics={name:world.get('diagnostics') for name,world in [('before',b),('after',w)]}
 write(out/'view-compare.json',{'baselineCommit':manifest['baselineCommit'],'status':'FAILURES_RETAINED' if failed or missing else 'BAKED_PROOFS_PASS','missingAuthoredPages':missing,'currentFailedViews':failed,'views':rows,'diagnostics':diagnostics,'limits':['This compares saved bake raycast proofs, not a rerun or renderer occlusion proof. Runtime furniture requires authored-view renders.','Page L and portrait failures remain failures even if exact baseline matches.','Camera changes are reported, never repaired or substituted.']})
 finish(root,out,manifest)
 raise SystemExit(2 if failed or missing else 0)
except SystemExit:raise
except Exception:
 write(out/'error.json',{'error':traceback.format_exc()});raise
