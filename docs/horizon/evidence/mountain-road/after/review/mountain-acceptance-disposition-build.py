import json,gzip,hashlib
from pathlib import Path
root=Path('/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book');p=root/'docs/horizon/evidence/mountain-road/after/attempts/expanded-native-footway-comparison'
A=json.loads(gzip.decompress((p/'baseline-results.json.gz').read_bytes()));B=json.loads(gzip.decompress((p/'current-results.json.gz').read_bytes()));a={(r['route'],r['direction']):r for r in A['results']};b={(r['route'],r['direction']):r for r in B['results']};rows=[]
keys=['completed','reason','completedDistanceM','finalPosition','walkBlocker','contacts','airborneFrames','offbedFrames','bails']
for k,x in a.items():
 y=b[k]
 if y['completed']:continue
 dif=[v for v in keys if x.get(v)!=y.get(v)]
 status='introduced failure after baseline completion' if x['completed'] else 'exact retained failure witness' if not dif else 'baseline failed; changed witness, not exact inheritance'
 rows.append({'route':k[0],'direction':k[1],'classification':status,'differentFields':dif,'baseline':{v:x.get(v) for v in keys},'current':{v:y.get(v) for v in keys}})
R={'scope':'Existing saved results only; not final source or current runtime proof. Exact witness equality is limited to the stated fields, not complete route/terrain inheritance.','files':{str(q.relative_to(root)):hashlib.sha256(q.read_bytes()).hexdigest() for q in [p/'baseline-results.json.gz',p/'current-results.json.gz',p/'mountain-native-footways-comparison.json']},'comparisonFields':keys,'baseline':{k:A.get(k) for k in ['head','worldSha256','terrainSha256','sourceProof']},'current':{k:B.get(k) for k in ['head','worldSha256','terrainSha256','sourceProof']},'rows':rows}
Path('/tmp/mountain-native-footway-witness-disposition.json').write_text(json.dumps(R,indent=2))
