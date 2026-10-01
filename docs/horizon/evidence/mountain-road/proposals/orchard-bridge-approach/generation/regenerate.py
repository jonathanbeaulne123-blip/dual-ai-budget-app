#!/usr/bin/env python3
"""Offline exact-input reproduction. No repository imports or writes.
Usage: python3 regenerate.py /tmp/chosen-output-directory
This replays the saved source snapshot, not a silently changed live road.
"""
from pathlib import Path
import sys,json,hashlib,time
ART=Path(__file__).resolve().parent
if len(sys.argv)!=2:raise SystemExit('Usage: python3 regenerate.py /tmp/empty-output-directory')
OUT=Path(sys.argv[1]).resolve();OUT.mkdir(parents=True,exist_ok=True)
if any(OUT.iterdir()):raise SystemExit('Output directory must be empty')
INPUT=ART/'source-input.json'
manifest=json.loads((ART/'manifest.json').read_text())
for name,sha in manifest['sha256'].items():
 if hashlib.sha256((ART/name).read_bytes()).hexdigest()!=sha:raise RuntimeError(f'Changed reviewed generator artifact: {name}')
start=time.monotonic()
exec((ART/'clip.py').read_text(),globals())
exec((ART/'fit.py').read_text(),globals())
mesh=json.loads((OUT/'mesh.json').read_text());source=json.loads(INPUT.read_text())
expected=json.loads((ART/'expected-generated.json').read_text())
profile=lambda s:{'at':s['at'],'normal':s['normal'],'halfWidth':s['halfWidth']}
generated={'sourceSha256':source['sourceSha256'],'fixedFromRow':26,'bridgeArtFromRow':8,'bridgeRowY':mesh['bridgeRowY'],'points':mesh['points'],'triangles':mesh['triangles'],'bands':mesh['bands'],'columns':mesh['columns'],'ownership':mesh['ownership'],'expectedLane':[profile(s) for s in source['orchard']['samples'][:27]],'expectedRoad':[[i,profile(source['road']['samples'][i])] for i in range(168,219)]}
(OUT/'orchardJunction.generated.json').write_text(json.dumps(generated,separators=(',',':'))+'\n')
if generated!=expected:raise RuntimeError('Reproduction differs from the reviewed generated geometry; inspect, do not overwrite source')
if mesh['maximumNewLongitudinalGrade'][0]>.12 or mesh['maxNewFacetGrade'][0]>.250001:raise RuntimeError('Original fitted limits exceeded')
print(json.dumps({'exactGeneratedObject':True,'elapsedSeconds':time.monotonic()-start,'triangles':len(generated['triangles']),'vertices':len(generated['points']),'output':str(OUT/'orchardJunction.generated.json')},indent=2))
