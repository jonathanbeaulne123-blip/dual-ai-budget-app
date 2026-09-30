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
import {landingSample} from '../src/harbour/mountain/branchLandings.ts';
import type {Point3} from '../src/harbour/mountain/math.ts';

const bytes=(path:string)=>{const b=readFileSync(path);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const world=parseHorizonDefinition(bytes('public/horizon/world/horizon-geo-1.json.gz'));
const terrain=decodeTerrainAsset(bytes('public/horizon/terrain/horizon-geo-1.bin'),'full');
const region=createRegionGeography({horizonGround:(x,z)=>sampleTerrain(terrain,x,z),exclude:mouthExclusion(world.collision.mouths),yield:terraceBedExclusion(world.collision.beds),terrainStep:terrain.step});
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
 const road=MOUNTAIN_ROAD_LINE.samples.filter(s=>s.s>165&&s.s<229);
 const roadAt=(x:number,z:number)=>{
  let nearest={distance:Infinity,y:0};
  for(let i=1;i<road.length;i++){
   const a=road[i-1]!.at,b=road[i]!.at,dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz)));
   const distance=Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);
   if(distance<nearest.distance)nearest={distance,y:a[1]+(b[1]-a[1])*t};
  }return nearest;
 };
 it('preserves the original first grind rail and entry, with a real course rejoin',()=>{
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
 it('keeps every rebuilt return cell clear of terrain and flush with the actual road',()=>{
  let minimumClearance=Infinity,roadError=0;
  for(const [a,b,c] of triangles(awning.landingRows!,9)){
   const n=Math.ceil(Math.max(Math.hypot(b[0]-a[0],b[2]-a[2]),Math.hypot(c[0]-a[0],c[2]-a[2]))/.05);
   for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){
    const u=i/n,v=j/n,x=a[0]+(b[0]-a[0])*u+(c[0]-a[0])*v,z=a[2]+(b[2]-a[2])*u+(c[2]-a[2])*v,y=a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v,r=roadAt(x,z);
    if(r.distance>4.8){const native=groundHeightAt(x,z),exposed=mouthExclusion(world.collision.mouths)(x+O.x,z+O.z)?sampleTerrain(terrain,x+O.x,z+O.z)-O.y:-Infinity;minimumClearance=Math.min(minimumClearance,y-Math.max(native,exposed));}else roadError=Math.max(roadError,Math.abs(y-r.y));
   }
  }
  expect(minimumClearance).toBeGreaterThanOrEqual(0);expect(roadError).toBeLessThanOrEqual(.03);
 });
 it('supports the actual tapered width with no rider contacts in both worlds',()=>{
  const obstacles=courtObstacles('lite'),out=hit(),failures:unknown[]=[],rows=awning.landingRows!;
  for(let i=9;i<rows.length;i++)for(let step=0;step<=10;step++)for(const across of[.05,.25,.5,.75,.95]){
   const t=step/10,a=rows[i-1]!,b=rows[i]!,x=(a[0]![0]*(1-across)+a[4]![0]*across)*(1-t)+(b[0]![0]*(1-across)+b[4]![0]*across)*t,z=(a[0]![2]*(1-across)+a[4]![2]*across)*(1-t)+(b[0]![2]*(1-across)+b[4]![2]*across)*t;
   const deck=landingSample(rows,x,z);expect(deck).not.toBeNull();const y=deck!.y;
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
   pushOutAll(x,z,y,.24,obstacles,[],out);const contact=horizon.contact(x+O.x,z+O.z,y+O.y,.24),ceiling=horizon.ceiling(x+O.x,z+O.z,y+O.y,.24);
   if(out.id||contact||worldCeilingAt(x,z,y)<y+1.45||ceiling<y+O.y+1.45||worldCollisionAt(x,y+.7,z,.24))failures.push({x,z,y,solid:out.id,contact:contact?.id,ceiling});
  }expect(failures.slice(0,8)).toEqual([]);
 });
});
