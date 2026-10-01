import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2/index.ts';
import {drawnRoadFloor} from '../src/harbour/horizon/regions/mountainV2/drawnRoadFloor.ts';
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const world=parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),terrain=decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')),'full');
const region=createMountainV2Region({walkingJoinSolids:world.geometry.solids,horizonGround:(x,z)=>sampleTerrain(terrain,x,z),yield:terraceBedExclusion(world.collision.beds),exclude:mouthExclusion(world.collision.mouths),terrainStep:terrain.step});
const g=createHorizonGeography(terrain,{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]});g.addDynamic(region.provider);
describe('Mountain Road actual drawn floor selection',()=>{
  it('keeps the reachable lower floor beneath a higher drawn deck',()=>{
    // The second top is wound backwards as a tight native swept band can be.
    // CardKit reverses it when rendering; both genuine levels must remain queryable.
    const floor=drawnRoadFloor([[[0,0,0],[2,0,0]],[[0,0,2],[2,0,2]],[[0,3,2],[2,3,2]],[[0,3,0],[2,3,0]]]);
    expect(floor(1,1,.48)?.y).toBe(0);
    expect(floor(1,1,3.48)?.y).toBe(3);
    expect(floor(1,1,-.1)).toBeNull();
    expect(floor(3,1,4)).toBeNull();
  });
  it.each([
    [1328.2437095,69.8433603,667.8077897,69.96334891852766],
    [1327.7774114,69.8138071,668.6430453,69.87089815554657],
  ])('supports the real road above Orchard Lane at the controller stall %s',(x,y,z,drawnY)=>{
    // Recorded independent native-art triangle witnesses. The old provider chose a
    // lower orchard top and jumped 12.2cm after only 2.5cm of travel.
    const hit=g.surface(x,z,y,.48)!;expect(hit.id).toBe('mountainV2:mountain-road');expect(hit.y).toBeCloseTo(drawnY,6);
    for(let ix=-10;ix<=10;ix++)for(let iz=-10;iz<=10;iz++){
      const px=x+ix*.025,pz=z+iz*.025,p=g.surface(px,pz,y,.48)!;
      expect(p.id).toBe('mountainV2:mountain-road');expect(p.slope).toBeLessThan(7);
      for(const [dx,dz]of [[.025,0],[0,.025]] as const){
        const q=g.surface(px+dx,pz+dz,y,.48)!;expect(Math.abs(q.y-p.y)).toBeLessThan(.004);
      }
    }
  });
});
