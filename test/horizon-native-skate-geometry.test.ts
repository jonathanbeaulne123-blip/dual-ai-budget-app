import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import {solid,box} from '../src/harbour/horizon/land/structures/mesh.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2/index.ts';
import {REGION_SOLIDS} from '../src/harbour/horizon/regions/mountainV2/geography.ts';
import {createHorizonSkateWorld} from '../src/harbour/horizon/skate/world.ts';
import {createSkateDriver,skateField} from '../src/harbour/skate/driver.ts';
import {SKATE_NO_INTENT} from '../src/harbour/skate/contract.ts';
const O={x:1308,y:54,z:764};
const flat:TerrainField={revision:'horizon-geo-1',width:2000,depth:2000,step:1000,columns:3,rows:3,heights:new Float32Array(9).fill(54),surfaces:new Uint8Array(9)};
const empty:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const world=parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),terrain=decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')),'full');
const region=createMountainV2Region({walkingJoinSolids:world.geometry.solids,horizonGround:(x,z)=>sampleTerrain(terrain,x,z),yield:terraceBedExclusion(world.collision.beds),exclude:mouthExclusion(world.collision.mouths),terrainStep:terrain.step});
function slab(underside:number){const s=solid('test-overhead','test','stone','deck');box(s,[1408,868],54+underside+.2,[20,4],54+underside);return s;}
function ride(underside:number){
  const geography=createHorizonGeography(flat,{...empty,solids:[slab(underside)]}),host=createHorizonSkateWorld(geography,skateField());
  const driver=createSkateDriver({obstacles:[],field:host.field,physics:host.physics},{getGamepads:null,intent:()=>({...SKATE_NO_INTENT,push:true})});
  driver.mount(100,100,0,undefined,{y:0});let maxCrouch=0,maxZ=100,bailed=false;
  for(let i=0;i<480;i++){driver.step(1/120);const p=driver.present()!;maxCrouch=Math.max(maxCrouch,p.crouch);maxZ=Math.max(maxZ,p.z);if(p.bail){bailed=true;break;}}
  return {geography,host,maxCrouch,maxZ,bailed};
}
describe('native skate actual Horizon geometry regressions',()=>{
  it('an outward overlap with a real Mountain plinth cannot hide an approaching static wall',()=>{
    const plinth=REGION_SOLIDS.find(s=>s.id==='dam:plinth:46')!,x=plinth.max[0]+.1+O.x,z=(plinth.min[2]+plinth.max[2])/2+O.z,y=plinth.min[1]+O.y;
    expect(region.provider.contact(x,z,y,.3)?.id).toBe('mountainV2:dam:plinth:46');
    expect(region.provider.contact(x,z,y,.3,[1,0],1.08)).toBeNull();
    const wall=solid('later-static-wall','test','stone','wall');box(wall,[x+.2,z],y+3,[.2,3],y);
    const geo=createHorizonGeography(terrain,{...empty,solids:[wall]});geo.addDynamic(region.provider);
    const host=createHorizonSkateWorld(geo,skateField());
    expect(host.physics.contact!(x-O.x,z-O.z,y-O.y,.3,[1,0])?.id).toBe('later-static-wall');
  });
  it('zero-travel contact still detects an actual wall instead of filtering every triangle',()=>{
    const wall=solid('stationary-wall','test','stone','wall');box(wall,[1408.2,864],57,[.2,3],54);
    const host=createHorizonSkateWorld(createHorizonGeography(flat,{...empty,solids:[wall]}),skateField());
    expect(host.physics.contact!(100,100,0,.3,[0,0])?.id).toBe('stationary-wall');
    expect(host.canStart(1408,864,54)).toBe(false);
  });
  it('enters beneath a real 1.2m ceiling that blocks a standing Horizon body',()=>{
    const r=ride(1.2);
    expect(r.geography.contact(1408,868,54,.3)?.id).toBe('test-overhead');
    expect(r.host.physics.contact!(100,104,0,.3,[0,1])).toBeNull();
    // Native crouching suppresses pushing; test entry beneath the slab, not unlimited powered travel.
    expect(r.maxZ).toBeGreaterThan(104);expect(r.maxCrouch).toBeGreaterThan(.8);expect(r.bailed).toBe(false);
  });
  it('cannot pass the same real slab when even the crouched rider does not fit',()=>{
    const r=ride(1);expect(r.maxZ).toBeLessThan(102);expect(r.host.physics.contact!(100,104,0,.3,[0,1])?.id).toBe('test-overhead');
  });
  it('a real V03 support beyond the old radial shore admits native skating without a false sea bail',()=>{
    const geo=createHorizonGeography(terrain,{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]});geo.addDynamic(region.provider);
    const host=createHorizonSkateWorld(geo,skateField()),at=world.beds.find(b=>b.id==='V03')!.points[0]!;
    const support=geo.surface(at[0],at[2],at[1],.48)!;expect(support).not.toBeNull();expect(Math.hypot(at[0]-O.x,at[2]-O.z)).toBeGreaterThan(64);
    expect(host.canStart(at[0],at[2],support.y)).toBe(true);expect(host.physics.shore).toBeNull();
    const driver=createSkateDriver({obstacles:[],field:host.field,physics:host.physics},{getGamepads:null,intent:()=>SKATE_NO_INTENT});driver.mount(at[0]-O.x,at[2]-O.z,0,undefined,{y:support.y-O.y});
    for(let i=0;i<120;i++){driver.step(1/120);expect(driver.events().some(e=>e.kind==='bail'&&e.reason==='water')).toBe(false);}
    expect(Math.hypot(driver.present()!.x-(at[0]-O.x),driver.present()!.z-(at[2]-O.z))).toBeLessThan(.2);
  });
});
