import V2 from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/mountainV2/v2-data.json';
import {readFileSync} from 'node:fs';
import {createRegionGeography} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/regions/mountainV2/geography';
import {prepareRegionGround} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/regions/mountainV2/ground';
import {funicularFootPathPlacement,type FootPathArtProof} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/regions/mountainV2/funicularFootPath';
import {MOUNTAIN_V2_OFFSET as O} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/regions/mountainV2/placement';
import {PATH_EDGES} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/mountain/pathGraph';
import {mountainArtPalette} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/mountain/art/palette';
import {SCENE_DRESSING} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/scene/place';
import {parseHorizonDefinition} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/house/world/horizonAssets';
import {decodeTerrainAsset} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/terrain/asset';
import {sampleTerrain} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/terrain';
import {emitBedGeometry} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/beds/profiles';
import {funicularFootStationTop} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/mountainV2/funicularFootStation';
import {mountainSourceEnvironment} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/mountainV2/sourceEnvironment';
import {fitFootLaneJoin} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/mountainV2/footLaneJoin';
import {mountainJoinRoadTop} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/mountainV2/joins';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/runtime/geography';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/regions/mountainV2';
import {bedPath,pointAt,progressOf} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/movers/board/situations';
import type {LandCuts} from '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/interfaces';
export function buildSourceFixture(world:ReturnType<typeof parseHorizonDefinition>,field:ReturnType<typeof decodeTerrainAsset>){
const relevant=(x:number,z:number)=>x>1260&&x<1310&&z>708&&z<752;
const sourceId=(s:LandCuts['solids'][number])=>s.sourceId??s.id.split('@')[0]!;
const isApron=(s:LandCuts['solids'][number])=>['mountainV2.footLane.apron','mountainV2.funicularFoot.apron'].includes(sourceId(s));
const isFittedSource=(s:LandCuts['solids'][number])=>/^(yearWalk|S1)\.(bed|surface|shoulders|batter)(\.|$)/.test(sourceId(s));
const originals=world.geometry.solids.filter(s=>s.positions.some((v,i)=>i%3===0&&relevant(v,s.positions[i+2]!)));
// Drop every served partition of the previous apron. Retaining @district pieces
// after a bake would add an old floor under the candidate and mask regressions.
const cuts:LandCuts={...structuredClone(world.collision),solids:structuredClone(originals.filter(s=>!isApron(s))),diagnostics:[]};
const sourceLane=cuts.beds.find(b=>b.id==='mountainV2.footLane')!;
sourceLane.structureIds=sourceLane.structureIds.filter(id=>!['mountainV2.footLane.apron','mountainV2.funicularFoot.apron'].includes(id));
{
 // The bake runs before vertex compaction. Regenerate those real source prisms,
 // rather than falsely interpreting the served mesh's compacted vertex order.
 const generated:LandCuts&{floorSource:LandCuts['solids']}={...cuts,solids:[],floorSource:originals.filter(s=>!isApron(s))};
 for(const id of ['yearWalk','S1']){
  const source=cuts.beds.find(b=>b.id===id)!,groups:(typeof source.points)[]=[];let group:typeof source.points=[];
  for(let i=0;i<source.points.length;i++){
   const near=source.points.slice(Math.max(0,i-2),i+3).some(p=>relevant(p[0],p[2]));
   if(near)group.push(source.points[i]!);else if(group.length){groups.push(group);group=[];}
  }
  if(group.length)groups.push(group);
  for(const points of groups)emitBedGeometry({...source,points},generated,(x,z)=>sampleTerrain(field,x,z),cuts.pads.filter(p=>!p.underground&&p.kind!=='host').map(p=>[p.centre[0],p.centre[2]]));
 }
 // Served chunks add @district (notably bare yearWalk.batter@lakeside).
 // Remove that old mesh before regenerating source prisms, or it leaves a
 // false 14.06cm lip at H[1283.815639,723.135064] in the +2m lane.
 const replaced=isFittedSource;
 cuts.solids=[...cuts.solids.filter(s=>!replaced(s)),...generated.solids.filter(replaced)];
}
const {ground}=mountainSourceEnvironment(cuts,field);
const originalPoints=JSON.stringify(cuts.beds.map(b=>[b.id,b.points]));
const untouched=JSON.stringify(cuts.solids.filter(s=>!isApron(s)&&!isFittedSource(s)));
fitFootLaneJoin(cuts,ground);
// Diagnostic fixture keeps pre-join geography only. The runner creates and times
// actual walkingJoinSolids geography after offline geometry construction.
const finalRegion=createMountainV2Region({horizonGround:(x,z)=>sampleTerrain(field,x,z),yield:terraceBedExclusion(cuts.beds),exclude:mouthExclusion(cuts.mouths),terrainStep:field.step});
const geo=createHorizonGeography(field,cuts);geo.addDynamic(finalRegion.provider);

return{cuts,geo,region:finalRegion,sourceRoutesPreserved:originalPoints===JSON.stringify(cuts.beds.map(b=>[b.id,b.points])),unrelatedSolidsPreserved:untouched===JSON.stringify(cuts.solids.filter(s=>!isApron(s)&&!isFittedSource(s)))};
}
