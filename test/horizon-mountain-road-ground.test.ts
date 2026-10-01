import {describe,it,expect} from 'vitest';
import {createRegionGeography,REGION_ROAD,mouthExclusion,terraceBedExclusion} from '../src/harbour/horizon/regions/mountainV2/geography.ts';
import {drawnRoadGroundCeiling} from '../src/harbour/horizon/regions/mountainV2/drawnRoadGround.ts';
import {prepareRegionGround} from '../src/harbour/horizon/regions/mountainV2/ground.ts';
import {drawnRoadFloor} from '../src/harbour/horizon/regions/mountainV2/drawnRoadFloor.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {MOUNTAIN_ROAD_LINE} from '../src/harbour/mountain/roads.ts';
import {readFileSync} from 'node:fs';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
const bytes=(p:string)=>{const b=readFileSync(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const world=parseHorizonDefinition(bytes('public/horizon/world/horizon-geo-1.json.gz')),terrain=decodeTerrainAsset(bytes('public/horizon/terrain/horizon-geo-1.bin'),'full');
const makeRegion=()=>createRegionGeography({walkingJoinSolids:world.geometry.solids,horizonGround:(x,z)=>sampleTerrain(terrain,x,z),yield:terraceBedExclusion(world.collision.beds),exclude:mouthExclusion(world.collision.mouths)});
const O={x:1308,y:54,z:764};
describe('Horizon drawn road ground clearance',()=>{
 it('does not project radial shoulder cuts behind the final actual road section',()=>{
  const cap=drawnRoadGroundCeiling(REGION_ROAD),floor=drawnRoadFloor(REGION_ROAD.landingRows!);
  // Expanded ordinary walking audit: the x±6cm stencil crossed a false
  // 25.0004cm cut and reported 64.359 degrees on an unchanged flat native bench.
  const hx=1324.1302169332484,hz=470.73125184711256,geo=makeRegion();
  for(const dx of[-.06,0,.06]){
   const x=hx+dx-O.x,z=hz-O.z;
   expect(floor(x,z)).toBeNull();expect(cap(x,z)).toBeNull();
   expect(geo.groundAt(hx+dx,hz)).toBeCloseTo(groundHeightAt(x,z)+O.y,9);
  }
  const hit=geo.surface(hx,158.18000030517578,hz,.48)!;
  expect(hit.y).toBeCloseTo(158.18000030517578,7);expect(hit.slope).toBeLessThan(.01);
  // The real terminal face still receives its original 8cm ground clearance.
  const end=REGION_ROAD.points.at(-1)!;
  expect(cap(end[0],end[2])).toBeCloseTo(floor(end[0],end[2])!.y-.08,9);
 });

 it('removes the measured grass ridges in both directions while keeping the actual road floor',()=>{
  const geo=makeRegion(),composed=createHorizonGeography(terrain,{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]});composed.addDynamic(geo.provider);
  for(const[x,y,z]of[[1344.0086,127.2256,551.1936],[1344.015,127.2256,553.47],[1287.017,98.427,570.989],[1330,68.846,679.64]]){
   for(const dx of[-.04,0,.04]){
    const surface=composed.surface(x!+dx,z!,y!,.48)!;
    expect(surface.id).toBe('mountainV2:mountain-road');expect(surface.ny).toBeGreaterThan(.98);
    expect(geo.groundAt(x!+dx,z!)!).toBeLessThanOrEqual(surface.y-.079);
    expect(composed.contact(x!+dx,z!,surface.y,.3)).toBeNull();
   }
  }
 });

 it('keeps the actual full and lite drawn ground triangles below the road at reported stops',()=>{
  const geo=makeRegion(),floor=drawnRoadFloor(REGION_ROAD.landingRows!);
  const sites=[[1344.0086,551.1936],[1344.015,553.47],[1287.017,570.989],[1330,679.64],[1390.407,480.893],[1375.77,688.02]];
  for(const tier of ['full','lite'] as const){
   // These exact positions and filtered indices are passed to buildRegionGround's
   // BufferGeometry. Test rendered triangles, not just the height callback.
   const prepared=prepareRegionGround(tier,geo.contains,terrain.step,new Map(),geo.groundCeiling,geo.walkingGroundPatch),positions=prepared.render.positions,indices=prepared.render.indices;
   for(const[hx,hz]of sites){
    const triangles:number[][][]=[];
    for(let i=0;i<indices.length;i+=3){
     const p=[indices[i]!,indices[i+1]!,indices[i+2]!].map(j=>[positions[j*3]!,positions[j*3+1]!,positions[j*3+2]!]);
     if(Math.max(...p.map(q=>q[0]!))<hx!-O.x-.25||Math.min(...p.map(q=>q[0]!))>hx!-O.x+.25||Math.max(...p.map(q=>q[2]!))<hz!-O.z-.25||Math.min(...p.map(q=>q[2]!))>hz!-O.z+.25)continue;triangles.push(p);
    }
    let samples=0;
    for(const dx of[-.2,-.1,0,.1,.2])for(const dz of[-.2,-.1,0,.1,.2]){
     const x=hx!-O.x+dx,z=hz!-O.z+dz,road=floor(x,z)!;expect(road).not.toBeNull();
     for(const[p,q,r]of triangles){
      const ux=q![0]!-p![0]!,uz=q![2]!-p![2]!,vx=r![0]!-p![0]!,vz=r![2]!-p![2]!,det=ux*vz-uz*vx,u=((x-p![0]!)*vz-(z-p![2]!)*vx)/det,v=(ux*(z-p![2]!)-uz*(x-p![0]!))/det;
      if(u< -1e-7||v< -1e-7||u+v>1+1e-7)continue;
      const y=p![1]!+(q![1]!-p![1]!)*u+(r![1]!-p![1]!)*v;
      expect(y).toBeLessThan(road.y);samples++;
     }
    }
    expect(samples).toBeGreaterThanOrEqual(25);
   }
  }
 },60000);
 it('leaves actual bridge underpass ground unchanged',()=>{
  const geo=makeRegion();let tested=0;
  for(const s of MOUNTAIN_ROAD_LINE.samples.filter(s=>s.support==='bridge')){
   const[x,y,z]=s.at,ground=groundHeightAt(x,z);if(y-ground<2)continue;
   const cap=geo.groundCeiling(x+O.x,z+O.z)!-O.y;
   expect(Math.min(ground,cap)).toBe(ground);tested++;
  }
  expect(tested).toBeGreaterThan(20);
 });
 it('keeps the cut local and retains the true folded faces for separate native-road review',()=>{
  const cap=drawnRoadGroundCeiling(REGION_ROAD);expect(cap(-200,-200)).toBeNull();
  const geo=makeRegion(),fold=geo.provider.surface(1390.515,480.18,151.53,.48)!;
  const drawn=drawnRoadFloor(REGION_ROAD.landingRows!)(1390.515-O.x,480.18-O.z)!;
  expect(fold.id).toBe('mountainV2:mountain-road');expect(fold.ny).toBeCloseTo(1/Math.hypot(drawn.gx,1,drawn.gz),8);expect(fold.y).toBeCloseTo(drawn.y+O.y,8);
 });
});
