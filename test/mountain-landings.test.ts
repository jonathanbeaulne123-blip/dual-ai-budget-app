import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {SKILL_BRANCHES,MOUNTAIN_COURSE_POINTS} from '../src/harbour/mountain/course.ts';
import {MOUNTAIN_ROAD_LINE} from '../src/harbour/mountain/roads.ts';
import {WORLD_SURFACES,queryWorldSurface,worldDeckAt,worldCollisionAt,worldCeilingAt} from '../src/harbour/mountain/surfaces.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {courtObstacles,holdAshore} from '../src/harbour/body/obstacles.ts';
import {pushOutAll,hit} from '../src/harbour/skate/sim/geometry.ts';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {createRegionGeography,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2/geography.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../src/harbour/horizon/regions/mountainV2/placement.ts';
import {repairDamEntry} from '../src/harbour/mountain/damEntry.ts';
import {landingSample,landingPointAt} from '../src/harbour/mountain/branchLandings.ts';
import type {Point3} from '../src/harbour/mountain/math.ts';
import authoredPlanting from '../src/harbour/mountain/generated/planting-authoring-corridors.json';
import {drawnRoadFloor} from '../src/harbour/horizon/regions/mountainV2/drawnRoadFloor.ts';

const bytes=(path:string)=>{const b=readFileSync(path);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const world=parseHorizonDefinition(bytes('public/horizon/world/horizon-geo-1.json.gz'));
const terrain=decodeTerrainAsset(bytes('public/horizon/terrain/horizon-geo-1.bin'),'full');
const region=createRegionGeography({walkingJoinSolids:world.geometry.solids,horizonGround:(x,z)=>sampleTerrain(terrain,x,z),exclude:mouthExclusion(world.collision.mouths),yield:terraceBedExclusion(world.collision.beds)});
const horizon=createHorizonGeography(terrain,{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]});
horizon.addDynamic(region.provider);
const branches=SKILL_BRANCHES.filter(b=>b.id==='library-balcony'||b.id==='dam-promenade');
const starts={'library-balcony':28,'dam-promenade':44} as const;
const start=(id:string)=>starts[id as keyof typeof starts];
const libraryRoad=MOUNTAIN_ROAD_LINE.samples.filter(s=>s.s>280&&s.s<360),entryRoad=MOUNTAIN_ROAD_LINE.samples.filter(s=>s.s>365&&s.s<420);
function nearestRoad(p:Point3){
 let best={distance:Infinity,y:0};const samples=p[0]<45?entryRoad:libraryRoad;
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1]!.at,b=samples[i]!.at,dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz)));
  const distance=Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);
  if(distance<best.distance)best={distance,y:a[1]+(b[1]-a[1])*t};
 }return best;
}
function* triangles(rows:readonly (readonly Point3[])[],first=1){
 for(let i=first;i<rows.length;i++)for(let k=1;k<rows[i]!.length;k++){
  const a=rows[i-1]![k-1]!,b=rows[i]![k-1]!,c=rows[i]![k]!,d=rows[i-1]![k]!;
  yield [a,b,c] as const;yield [a,c,d] as const;
 }
}
function triangleGrade(a:Point3,b:Point3,c:Point3){
 const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 const nx=u[1]!*v[2]!-u[2]!*v[1]!,ny=u[2]!*v[0]!-u[0]!*v[2]!,nz=u[0]!*v[1]!-u[1]!*v[0]!;
 return Math.hypot(nx,nz)/Math.abs(ny);
}

describe('shared native and Horizon mountain landings',()=>{
 it('keeps every actual deck triangle within the authored 40% grade limit',()=>{
  for(const b of branches)for(const t of triangles(b.landingRows!))expect(triangleGrade(...t),b.id).toBeLessThanOrEqual(.4);
 });
 it('keeps the repaired library exit above terrain, including the narrow baked mound missed by row-only tests',()=>{
  const b=branches.find(b=>b.id==='library-balcony')!,deck=WORLD_SURFACES.find(s=>s.id===b.id)!;
  // This actual baked peak buried the first regrade by almost 1m; it is between deck vertices.
  const peak=worldDeckAt(deck,76,-174)!;expect(peak).not.toBeNull();expect(peak.point[1]-groundHeightAt(76,-174)).toBeGreaterThanOrEqual(0);
  let worstExterior=-Infinity,worstRoadDifference=0;
  // Entry now follows the actual native support line around its ground mound.
  // native-library-entry.test.ts densely checks both worlds' actual ownership edges
  // against the 6cm board limit, with zero burial and the protected roof unchanged.
  // Keep this independent, original 3cm fine-line requirement for the exit.
  for(const [a,q,c] of triangles(b.landingRows!,start(b.id)))for(let i=0;i<=20;i++)for(let j=0;j<=20-i;j++){
   const u=i/20,v=j/20,p:Point3=[a[0]*(1-u-v)+q[0]*u+c[0]*v,a[1]*(1-u-v)+q[1]*u+c[1]*v,a[2]*(1-u-v)+q[2]*u+c[2]*v];
   const road=nearestRoad(p);
   if(road.distance>4.8)worstExterior=Math.max(worstExterior,groundHeightAt(p[0],p[2])-p[1]);
   else worstRoadDifference=Math.max(worstRoadDifference,Math.abs(p[1]-road.y));
  }
  expect(worstExterior).toBeLessThanOrEqual(.02);expect(worstRoadDifference).toBeLessThanOrEqual(.03);
  // The native road floor has an existing ~.017m ground discrepancy at the exit.
  // That true-road baseline does not broaden the exterior-ramp clearance allowance above.
 });
 it('supports the full repaired width and admits the rider in native and the actual composed Horizon',()=>{
  const obstacles=courtObstacles('lite'),out=hit(),failures:unknown[]=[];
  for(const b of branches)for(let i=b.id==='library-balcony'?1:start(b.id);i<b.points.length;i++){
   const a=b.points[i-1]!,c=b.points[i]!,dx=c[0]-a[0],dz=c[2]-a[2],length=Math.hypot(dx,dz);
   for(let k=0;k<=4;k++)for(const side of[-.95,0,.95]){
    const t=k/4,x=a[0]+dx*t+dz/length*b.halfWidth*side,z=a[2]+dz*t-dx/length*b.halfWidth*side,y=a[1]+(c[1]-a[1])*t;
    const native=queryWorldSurface({x,z,y,supportId:b.id},groundHeightAt),placed=horizon.surface(x+O.x,z+O.z,y+O.y,.4);
    pushOutAll(x,z,y,.24,obstacles,[],out);
    const contact=horizon.contact(x+O.x,z+O.z,placed?.y??y+O.y,.24);
    if(Math.abs(native.y-y)>.3||!placed||Math.abs(placed.y-O.y-y)>.3||out.id||contact||!holdAshore(x,z).ashore)
     failures.push({branch:b.id,i,x,z,y,native:native.y,horizon:placed?.y,solid:out.id,contact:contact?.id});
   }
  }
  expect(failures.slice(0,8)).toEqual([]);
 });
 it('retains original joins and the primary library roof above its unchanged walls',()=>{
  for(const b of branches){expect(b.points[0]).toEqual(MOUNTAIN_COURSE_POINTS[b.entry]);expect(b.points.at(-1)).toEqual(MOUNTAIN_COURSE_POINTS[b.exit]);}
  const b=branches.find(b=>b.id==='library-balcony')!,walls=courtObstacles('lite').filter(o=>o.id.startsWith('village-library-'));
  const wallTop=Math.max(...walls.map(o=>'top' in o?o.top??0:0));
  expect(Math.min(...b.segments[1]!.points.filter(p=>p[0]>=44&&p[0]<=56.7).map(p=>p[1]))).toBeGreaterThanOrEqual(wallTop);
 });
 it('leaves through-road riders on one flat floor at each repaired mouth in both worlds',()=>{
  const failures:unknown[]=[];
  for(const b of branches)for(const end of b.id==='library-balcony'?[b.points[0]!,b.points.at(-1)!]:[b.points.at(-1)!]){for(const s of MOUNTAIN_ROAD_LINE.samples){
   if(Math.hypot(s.at[0]-end[0],s.at[2]-end[2])>18)continue;
   for(const side of[-1.45,0,1.45]){
    const x=s.at[0]+s.normal[0]*side,z=s.at[2]+s.normal[2]*side,road=worldDeckAt(WORLD_SURFACES.find(s=>s.id==='mountain-road')!,x,z),y=road!.point[1];
    const n=queryWorldSurface({x,z,y,stepHeight:.1},groundHeightAt),h=horizon.surface(x+O.x,z+O.z,y+O.y,.1),contact=horizon.contact(x+O.x,z+O.z,y+O.y,.24);
    if(Math.abs(n.y-y)>.04||!h||Math.abs(h.y-O.y-y)>.04||worldCollisionAt(x,y+.7,z,.24)||contact||region.provider.ceiling(x+O.x,z+O.z,y+O.y)-(y+O.y)<1.45)failures.push({branch:b.id,x,z,y,native:n.y,horizon:h?.y,contact:contact?.id});
   }
  }}expect(failures.slice(0,8)).toEqual([]);
 });
});

describe('shared awning contour return',()=>{
 const awning=SKILL_BRANCHES.find(b=>b.id==='hearth-awning')!;
 // Match the existing rendered/native road surfaces, not a 4.8m capsule around
 // the nearest 1m centreline. The approved road frames change the swept footprint.
 const roadRows=MOUNTAIN_ROAD_LINE.samples.map(s=>[-s.halfWidth,-s.halfWidth+.55,-.45,.45,s.halfWidth-.55,s.halfWidth].map(w=>[s.at[0]+s.normal[0]*w,s.at[1],s.at[2]+s.normal[2]*w] as Point3));
 const roadAt=drawnRoadFloor(roadRows);
 it('preserves the original first grind rail and departure point, with a real course rejoin',()=>{
  expect(awning.segments[1]!.points).toEqual([
   [34.82506414443134,17.68656601983504,-96.28165997086504],
   [34.244163975907405,17.55442502311574,-95.45734681700047],
   [33.62484575454764,17.3963917515904,-94.66062157963863],
   [33.11757954014527,17.08669623447073,-93.79136413457388],
  ]);
  expect(awning.points[0]).toEqual(MOUNTAIN_COURSE_POINTS[awning.entry]);
  expect(awning.points.at(-1)).toEqual(MOUNTAIN_COURSE_POINTS[awning.exit]);
  expect(awning.branchLength).toBeLessThan(awning.roadLength);
  for(let i=5;i<=8;i++){const row=awning.landingRows![i]!;expect(Math.hypot(row[4]![0]-row[0]![0],row[4]![2]-row[0]![2])).toBeCloseTo(3,10);}
  // The unchanged rail has an existing 47.7853% outer triangle. The rebuilt return starts
  // at the NEXT band, including its connection to the protected rail endpoint.
  for(const t of triangles(awning.landingRows!,9))expect(triangleGrade(...t)).toBeLessThanOrEqual(.4);
 });
 it('conforms only the approved first five entrance rows to the road before the unchanged first rail',()=>{
  // D-MR19 replaces the formerly flat entrance with the existing road crossfall.
  // Its measured 25.2cm bound is absolute movement; plan positions never change.
  const original=authoredPlanting.branches.find(b=>b.id===awning.id)!.points;
  const sourceRows=MOUNTAIN_ROAD_LINE.samples.map(s=>[-s.halfWidth,-s.halfWidth+.55,-.45,.45,s.halfWidth-.55,s.halfWidth].map(w=>[s.at[0]+s.normal[0]*w,s.at[1],s.at[2]+s.normal[2]*w] as Point3));
  const roadFloor=drawnRoadFloor(sourceRows);
  for(let i=0;i<=8;i++){
   const p=original[i]!,a=original[Math.max(0,i-1)]!,b=original[i+1]!,dx=b[0]!-a[0]!,dz=b[2]!-a[2]!,length=Math.hypot(dx,dz);
   for(let k=0;k<5;k++){
    const expected:Point3=[p[0]!+dz/length*1.5*(k/2-1),p[1]!,p[2]!-dx/length*1.5*(k/2-1)],row=awning.landingRows![i]![k]!;
    expect(row[0]).toBe(expected[0]);expect(row[2]).toBe(expected[2]);
    if(i<5){expect(Math.abs(row[1]-expected[1])).toBeLessThanOrEqual(.251677);expect(row[1]).toBeCloseTo(roadFloor(row[0],row[2])!.y,10);}
    else expect(row).toEqual(expected);
   }
  }
 });
 it('has no folded or degenerate triangles after the protected rail',()=>{
  // Previously bands 8→9 and 9→10 reversed on the inside of the splice;
  // overlapping positive/negative cells made draw and queried floors disagree.
  for(const [a,b,c] of triangles(awning.landingRows!,9)){
   const area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
   expect(area).toBeLessThan(-1e-8);
  }
 });
 it('keeps every rebuilt return cell clear of terrain and flush with the actual road',()=>{
  let minimumClearance=Infinity,roadError=0,maximumExposedSupport=0;
  for(const [a,b,c] of triangles(awning.landingRows!,9)){
   const n=Math.ceil(Math.max(Math.hypot(b[0]-a[0],b[2]-a[2]),Math.hypot(c[0]-a[0],c[2]-a[2]))/.05);
   for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){
    const u=i/n,v=j/n,x=a[0]+(b[0]-a[0])*u+(c[0]-a[0])*v,z=a[2]+(b[2]-a[2])*u+(c[2]-a[2])*v,y=a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v,r=roadAt(x,z);
    if(!r){const native=groundHeightAt(x,z),exposed=mouthExclusion(world.collision.mouths)(x+O.x,z+O.z)?sampleTerrain(terrain,x+O.x,z+O.z)-O.y:-Infinity;minimumClearance=Math.min(minimumClearance,y-Math.max(native,exposed));}else roadError=Math.max(roadError,Math.abs(y-r.y));
    // Only selected/visible support constrains this apron. The unchanged native
    // preferred-landing and through-road queries below remain independent gates.
    maximumExposedSupport=Math.max(maximumExposedSupport,(r?.y??-Infinity)-y);
   }
  }
  expect(minimumClearance).toBeGreaterThanOrEqual(0);expect(roadError).toBeLessThanOrEqual(.03);
  expect(maximumExposedSupport).toBeLessThanOrEqual(.01);
 });
 it('supports the actual tapered width with no rider contacts in both worlds',()=>{
  const obstacles=courtObstacles('lite'),out=hit(),failures:unknown[]=[],rows=awning.landingRows!;
  for(let i=9;i<rows.length;i++)for(let step=0;step<=10;step++)for(const across of[.05,.25,.5,.75,.95]){
   const [x,y,z]=landingPointAt(rows,i,step/10,across);
   const deck=landingSample(rows,x,z);expect(deck).not.toBeNull();expect(deck!.y).toBeCloseTo(y,8);
   const n=queryWorldSurface({x,z,y,supportId:awning.id},groundHeightAt),h=horizon.surface(x+O.x,z+O.z,y+O.y,.4);
   pushOutAll(x,z,y,.24,obstacles,[],out);const contact=horizon.contact(x+O.x,z+O.z,y+O.y,.24);
   if(Math.abs(n.y-y)>.01||!h||Math.abs(h.y-O.y-y)>.01||out.id||contact)failures.push({i,x,z,y,native:n.y,horizon:h?.y,solid:out.id,contact:contact?.id});
  }expect(failures.slice(0,8)).toEqual([]);
 });
 it('removes the old return ceiling and leaves both road directions open across the new arrival',()=>{
  const failures:unknown[]=[],obstacles=courtObstacles('lite'),out=hit(),nativeRoad=WORLD_SURFACES.find(s=>s.id==='mountain-road')!;
  // Includes the old outer-lane obstruction and the new join; the wider hairpin's existing
  // terrain/nearest-route floor differences are covered by the road regression, not waived here.
  for(const s of MOUNTAIN_ROAD_LINE.samples.filter(p=>p.s>155&&p.s<190))for(const off of[-3.85,-2,0,2,3.85]){
   const x=s.at[0]+s.normal[0]*off,z=s.at[2]+s.normal[2]*off,y=worldDeckAt(nativeRoad,x,z)!.point[1];
   pushOutAll(x,z,y,.24,obstacles,[],out);const contact=horizon.contact(x+O.x,z+O.z,y+O.y,.24),ceiling=horizon.ceiling(x+O.x,z+O.z,y+O.y);
   if(out.id||contact||worldCeilingAt(x,z,y)<y+1.45||ceiling<y+O.y+1.45||worldCollisionAt(x,y+.7,z,.24))failures.push({x,z,y,solid:out.id,contact:contact?.id,ceiling});
  }expect(failures.slice(0,8)).toEqual([]);
 });
});

describe('shared dam entry landing',()=>{
 const dam=SKILL_BRANCHES.find(b=>b.id==='dam-promenade')!,rows=dam.landingRows!;
 const first=dam.points[0]!,entry=MOUNTAIN_ROAD_LINE.samples.reduce((a,b)=>Math.hypot(a.at[0]-first[0],a.at[2]-first[2])<Math.hypot(b.at[0]-first[0],b.at[2]-first[2])?a:b);
 const local=MOUNTAIN_ROAD_LINE.samples.filter(s=>Math.abs(s.s-entry.s)<24),roadRows=local.map(s=>[-s.halfWidth,-s.halfWidth+.55,-.45,.45,s.halfWidth-.55,s.halfWidth].map(w=>[s.at[0]+s.normal[0]*w,s.at[1],s.at[2]+s.normal[2]*w] as Point3));
 it('limits the repair to entry heights and preserves the rail, exit, endpoints and every plan coordinate',()=>{
  const before={points:[...dam.points],rows},unchanged=JSON.stringify(before),again=repairDamEntry(before,MOUNTAIN_ROAD_LINE.samples);
  expect(JSON.stringify(before)).toBe(unchanged);
  expect(again.points[0]).toEqual(before.points[0]);expect(again.points.at(-1)).toEqual(before.points.at(-1));
  expect(again.points.slice(13)).toEqual(before.points.slice(13));expect(again.rows.slice(13)).toEqual(before.rows.slice(13));
  for(let i=0;i<rows.length;i++)for(let k=0;k<rows[i]!.length;k++)expect([again.rows[i]![k]![0],again.rows[i]![k]![2]]).toEqual([rows[i]![k]![0],rows[i]![k]![2]]);
  // The first maintenance rail starts at row18; the complete five-row separation stays authored.
  expect(dam.segments[1]!.points[0]).toEqual(dam.points[18]);
 });
 it('draws and queries the same entry triangles with less than 20mm overlap error',()=>{
  const surface=WORLD_SURFACES.find(s=>s.id===dam.id)!;let compared=0,maximum=0,minimumExteriorClearance=Infinity;
  for(const [a,b,c] of triangles(rows.slice(0,14)))for(let i=0;i<=10;i++)for(let j=0;j<=10-i;j++){
   const u=i/10,v=j/10,x=a[0]+(b[0]-a[0])*u+(c[0]-a[0])*v,z=a[2]+(b[2]-a[2])*u+(c[2]-a[2])*v,deck=landingSample(rows,x,z)!,road=landingSample(roadRows,x,z);
   expect(triangleGrade(a,b,c)).toBeLessThanOrEqual(.4);
   const queried=worldDeckAt(surface,x,z);expect(queried).not.toBeNull();expect(queried!.point[1]).toBeCloseTo(deck.y,9);
   if(road){compared++;maximum=Math.max(maximum,Math.abs(deck.y-road.y));}else minimumExteriorClearance=Math.min(minimumExteriorClearance,deck.y-groundHeightAt(x,z));
  }
  expect(minimumExteriorClearance).toBeGreaterThanOrEqual(0);expect(compared).toBeGreaterThan(2000);expect(maximum).toBeLessThan(.02);
  // buildBranchArt uses these rows and the same quad diagonal, with its existing 2cm paint lift.
  expect(dam.segments[0]!.landingRows).toEqual(rows.slice(0,19));
 });
 it('adds no entry lip at center and +/-2m in either direction, retaining three exact native road limitations',()=>{
  const failures:unknown[]=[],lanes=new Map<number,{native:number;base:number;s:number}[]>(),withoutDam=WORLD_SURFACES.filter(s=>s.id!==dam.id);
  for(let i=1;i<local.length;i++){
   const a=local[i-1]!,b=local[i]!;if(Math.abs(a.s-entry.s)>9)continue;
   for(let j=0;j<10;j++)for(const off of[-2,0,2]){
    const t=j/10,x=a.at[0]+(b.at[0]-a.at[0])*t+(a.normal[0]+(b.normal[0]-a.normal[0])*t)*off,z=a.at[2]+(b.at[2]-a.at[2])*t+(a.normal[2]+(b.normal[2]-a.normal[2])*t)*off,y=landingSample(roadRows,x,z)!.y;
    const nativeBase=queryWorldSurface({x,z,y,stepHeight:.48},groundHeightAt,withoutDam),native=queryWorldSurface({x,z,y,stepHeight:.48},groundHeightAt),h=horizon.surface(x+O.x,z+O.z,y+O.y,.48);
    // Keep the inherited native road selector as the baseline; the landing may not add a lip.
    const lane=lanes.get(off)??[];lane.push({native:native.y,base:nativeBase.y,s:a.s+(b.s-a.s)*t});lanes.set(off,lane);
    if(!h||Math.abs(h.y-O.y-y)>.02||worldCollisionAt(x,y+.7,z,.3))failures.push({x,z,y,nativeBase:nativeBase.y,native:native.y,horizon:h?.y});
    for(const dir of[-1,1]){const hit=horizon.blocker(x+O.x,z+O.z,y+O.y,.3,[dir*(b.at[0]-a.at[0]),dir*(b.at[2]-a.at[2])]);if(hit)failures.push({x,z,dir,hit});}
   }
  }
  // Three specific inherited coarse-road projection switches on the -2m lane.
  // course.ts decimates the rendered road to every third sample; nearestOnRoute
  // changes segment here before reaching the common vertex. The original and
  // repaired native source return exactly these same road-only heights. These are
  // retained source limitations, not continuous floors or permission for new lips.
  const witnesses=[
   {name:'entry-minus-0.15m',step:.08789190618772125,points:[
    {s:812.01041990782,x:49.786268008824855,z:-255.36004067062694,y:90.45524493076074,base:90.43828910086188,index:268},
    {s:812.1111381600629,x:49.713191601064885,z:-255.39983541628067,y:90.47138799347671,base:90.5261810070496,index:269}]},
   {name:'entry-plus-3.07m',step:.10301467242125284,points:[
    {s:815.2312146563306,x:48.05299457104254,z:-256.89187354306955,y:90.85901767884745,base:90.80503004360301,index:269},
    {s:815.3318789045454,x:48.01300430203281,z:-256.9579149792493,y:90.8690257892576,base:90.90804471602426,index:270}]},
   {name:'entry-plus-6.09m',step:.07710466449535147,points:[
    {s:818.2513692884962,x:47.02853563535578,z:-259.0476061030744,y:91.22661926595174,base:91.19221279500577,index:270},
    {s:818.3520452501972,x:47.007256263194705,z:-259.1271103217448,y:91.23707336196352,base:91.26931745950112,index:271}]},
  ];
  const nativeRoad=WORLD_SURFACES.find(s=>s.id==='mountain-road')!;
  for(const witness of witnesses)for(const p of witness.points){
   const control=queryWorldSurface({x:p.x,z:p.z,y:p.y,stepHeight:.48},groundHeightAt,withoutDam),actual=queryWorldSurface({x:p.x,z:p.z,y:p.y,stepHeight:.48},groundHeightAt);
   expect(control.id,witness.name).toBe('mountain-road');expect(control.y,witness.name).toBeCloseTo(p.base,8);
   expect(worldDeckAt(nativeRoad,p.x,p.z)!.index,witness.name).toBe(p.index);
   expect(actual,witness.name).toEqual(control);
  }
  const matchedWitnesses=new Set<string>();
  for(const [off,lane] of lanes)for(let i=1;i<lane.length;i++){
   const p=lane[i]!,q=lane[i-1]!,step=Math.abs(p.native-q.native),baselineStep=Math.abs(p.base-q.base);
   const unchangedWitness=off===-2&&witnesses.find(w=>Math.abs(q.s-w.points[0]!.s)<1e-6&&Math.abs(p.s-w.points[1]!.s)<1e-6&&p.native===p.base&&q.native===q.base&&Math.abs(baselineStep-w.step)<1e-8);
   if(unchangedWitness)matchedWitnesses.add(unchangedWitness.name);
   if(step>.06&&!unchangedWitness)failures.push({off,i,step,baselineStep});
  }
  expect([...matchedWitnesses].sort()).toEqual(witnesses.map(w=>w.name).sort());
  expect(failures.slice(0,8)).toEqual([]);
 });
});
