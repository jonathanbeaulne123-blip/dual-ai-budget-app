from pathlib import Path
import difflib,hashlib,json
r=Path.cwd();o=Path('/tmp/mountain-production-source-refactor');entry='scripts/horizon/bake-entry.ts';s=(r/entry).read_text();start=s.index('  const cuts=buildLandCuts(baseHeight);');end=s.index('  fitFootLaneJoin(cuts,ground);');body=s[start:end]
sourceImports=[]
for line in s.splitlines():
 if any(('from '+repr(path)) in line for path in []):pass
 if any(name in line for name in ['import {groundTerrainBeds}','import {settleFoundations}','import {baseHeight,buildTerrain,sampleTerrain}','import {encodeTerrainAsset,decodeTerrainAsset}','import {buildLandCuts}','import {buildWaterCuts,buildSpringSolids}','import {buildOffshoreSolids}','import {buildCrossings}','import {resolveComputedCrossings,settleBedEdges,openRetainingPassages}','import {settleCorridors}','import {mountainSourceEnvironment}']):sourceImports.append(line)
sourceImports.append("import {buildWorldLines,corridorDestinations} from '../../src/harbour/horizon/world/build.ts';")
source='\n'.join(sourceImports)+'''\n\n/** The production source immediately before local Foot fitting.\n * Bake and geometry regressions must use this same ordered construction.\n * Ground is deliberately created before settleCorridors mutates cuts: returning\n * that exact closure preserves its original yield/mouth inputs. No fit, world\n * partition, LOD, output rounding, or artifact IO is performed here. */\nexport function buildHorizonPrejoinSource(){\n'''+body+'  return{cuts,buffer,field,ground,corridors,groundBeds,foundations};\n}\n'
newEntry=s[:start]+'  const {cuts,buffer,field,ground,corridors,groundBeds,foundations}=buildHorizonPrejoinSource();\n'+s[end:]
for line in sourceImports:
 if line=="import {encodeTerrainAsset,decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';":newEntry=newEntry.replace(line,"import {decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';")
 else:newEntry=newEntry.replace(line+'\n','')
newEntry=newEntry.replace('import {createLandWorld,buildWorldLines,corridorDestinations}', 'import {createLandWorld}')
newEntry=newEntry.replace("import {fitFootLaneJoin} from '../../src/harbour/horizon/land/mountainV2/footLaneJoin.ts';", "import {fitFootLaneJoin} from '../../src/harbour/horizon/land/mountainV2/footLaneJoin.ts';\nimport {buildHorizonPrejoinSource} from './bake-source.ts';",1)
p='test/horizon-foot-lane-apron.test.ts';base=(r/p).read_text();test=base
for line in ["import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset';\n","import {emitBedGeometry} from '../src/harbour/horizon/land/beds/profiles';\n","import {mountainSourceEnvironment} from '../src/harbour/horizon/land/mountainV2/sourceEnvironment';\n"]:
 assert line in test;test=test.replace(line,'')
test="import {buildHorizonPrejoinSource} from '../scripts/horizon/bake-source';\nimport {createHash} from 'node:crypto';\n"+test
old="const world=parseHorizonDefinition(bytes('public/horizon/world/horizon-geo-1.json.gz')),field=decodeTerrainAsset(bytes('public/horizon/terrain/horizon-geo-1.bin'),'full');\nconst relevant=(x:number,z:number)=>x>1260&&x<1310&&z>708&&z<752;"
new="""const world=parseHorizonDefinition(bytes('public/horizon/world/horizon-geo-1.json.gz'));
const servedTerrain=bytes('public/horizon/terrain/horizon-geo-1.bin');
// Build once from the exact production stages. Served compacted prisms and a
// selectively re-emitted neighbourhood are not interchangeable source inputs.
// This is intentionally real construction during collection, not a saved fixture.
const {cuts,buffer,field,ground}=buildHorizonPrejoinSource();"""
assert old in test;test=test.replace(old,new)
a=test.index('const originals=world.geometry.solids.filter(');b=test.index('const originalPoints=JSON.stringify(',a)
test=test[:a]+test[b:]
needle="describe('visible Foot apron',()=>{"
insert="""describe('visible Foot apron',()=>{
 it('uses byte-identical production terrain before asserting served/source geometry parity',()=>{
  const hash=(b:ArrayBuffer)=>createHash('sha256').update(new Uint8Array(b)).digest('hex');
  expect(hash(buffer)).toBe(hash(servedTerrain));
 });"""
assert needle in test;test=test.replace(needle,insert,1)
# Fence: preserve every existing test body and the source-top Float32 flip guard.
assert '(sourceTop&&n[1]!<1e-8)' in test
assert base[base.index(" it('ends the visible Horizon join"):]==test[test.index(" it('ends the visible Horizon join"):]
files={entry:newEntry,'scripts/horizon/bake-source.ts':source,p:test};diff=[];manifest=[]
for path,content in files.items():
 before=(r/path).read_text() if (r/path).exists() else '';dest=o/'source'/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(content)
 diff.extend(difflib.unified_diff(before.splitlines(True),content.splitlines(True),fromfile='a/'+path if before else '/dev/null',tofile='b/'+path))
 manifest.append({'path':path,'beforeSha256':hashlib.sha256(before.encode()).hexdigest() if before else None,'afterSha256':hashlib.sha256(content.encode()).hexdigest()})
(o/'shared-source.patch').write_text(''.join(diff));(o/'manifest.json').write_text(json.dumps(manifest,indent=2));(o/'verification.json').write_text(json.dumps({'prejoinBodyTextIdentical':body in source,'existingTestBodiesTextIdentical':True,'sourceTopFloat32GuardPreserved':True,'execution':'none; source-only review'},indent=2))
