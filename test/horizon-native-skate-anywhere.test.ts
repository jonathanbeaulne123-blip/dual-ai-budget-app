import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {createMountainV2Region,terraceBedExclusion,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2/index.ts';
import {MOUNTAIN_V2_OFFSET as O} from '../src/harbour/horizon/regions/mountainV2/placement.ts';
import {createNativeSkate,horizonSkateEntry} from '../src/harbour/horizon/skate/nativeSkate.ts';
import {createHorizonSkateWorld,skateKindOf,terrainPaintKind} from '../src/harbour/horizon/skate/world.ts';
import {createBodyFigure} from '../src/harbour/body/figure.ts';
import {skateField} from '../src/harbour/skate/driver.ts';

/**
 * Jonathan 2026-10-04: "bring back the skateboard anywhere mechanics, it was tuned perfectly." The old Tideline board is
 * put down where the person stands, on the baked Horizon (terrain, every chunk's solids, Mountain v2 placed), and rides.
 */
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const world=parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),terrain=decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')),'full');
const region=createMountainV2Region({walkingJoinSolids:world.geometry.solids,horizonGround:(x,z)=>sampleTerrain(terrain,x,z),yield:terraceBedExclusion(world.collision.beds),exclude:mouthExclusion(world.collision.mouths),terrainStep:terrain.step});
const geography=createHorizonGeography(terrain,{...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]});geography.addDynamic(region.provider);
const paint=terrainPaintKind(terrain);
function board(ready?:(x:number,z:number)=>boolean){
  return createNativeSkate({scene:new THREE.Scene(),figure:createBodyFigure(),tier:'lite',reducedMotion:()=>true,geography,terrainKind:paint,...(ready?{ready}:{})});
}
/** Where a walker stands at (x, z): the highest floor (the walker's own `geography.surface`). */
const feet=(x:number,z:number)=>geography.surface(x,z)!.y;
const entry=horizonSkateEntry();
// Walkable points across the island (baked places, views, thresholds and walk beds; the Crown deck; the Suspension Bridge).
const PLACES:[string,number,number][]=[
  ['Tideline (Mountain v2 town)',entry.x,entry.z],
  ['Little Harbour square',1455,1175],
  ['Little Harbour quay',1484,1295],
  ['quayWest threshold',1453,1277],
  ['Long Sands',1185,1445],
  ['Landing campfire',1200,1430],
  ['Flats strip',420,685],
  ['Green',1030,1060],
  ['Hollow',985,580],
  ['Notch overlook',1268,1145],
  ['Crown summit',1310,470],
  ['Crown L01 deck',1316,539.2],
  ['Suspension Bridge deck',561,1098],
];

describe('the old board anywhere on the baked Horizon',()=>{
  it.each(PLACES)('puts the board down and rides at %s',(_name,x,z)=>{
    const skate=board(),y=feet(x,z);
    expect(skate.startRefusal(x,z,y)).toBeNull();
    expect(skate.start({x,y,z,yaw:0})).toBe(true);
    const input=skate.controls.input()!;let t=0;
    // Push and carve a little for three seconds: hold W, lean left for the last second.
    input.keyDown({key:'w',timeStamp:t});
    let maxSpeed=0,frame=null;
    for(let i=0;i<180;i++){
      t+=1000/60;if(i===120)input.keyDown({key:'a',timeStamp:t});
      frame=skate.step(1/60);
      const p=skate.controls.present()!;maxSpeed=Math.max(maxSpeed,p.speed);
      // The first second rolls on the floor the board was put down on (later it may carve off an open deck edge,
      // as the walker can step off one: the Crown lookouts have open edges).
      if(i===59){expect(p.phase).not.toBe('air');expect(p.phase).not.toBe('bail');expect(Math.abs(frame!.body.y-y)).toBeLessThan(.6);}
    }
    const p=skate.controls.present()!;
    expect(frame!.body.x).toBeCloseTo(p.x+O.x,6);
    expect(Number.isFinite(frame!.body.y)).toBe(true);
    // Moving under its own push: the ride is not stuck, unsupported or in the sea.
    expect(maxSpeed).toBeGreaterThan(1);
    expect(Math.hypot(frame!.body.x-x,frame!.body.z-z)).toBeGreaterThan(1);
    expect(geography.submerged(frame!.body.x,frame!.body.z,frame!.body.y)).toBe(false);
    // B again: picked up where the rider stands.
    const at=skate.stop()!;
    expect(Math.hypot(at.x-frame!.body.x,at.z-frame!.body.z)).toBeLessThan(.01);
    expect(skate.controls.active()).toBe(false);
  });

  it('refuses in water, on steep ground, off any floor, and where the ground has not streamed in',()=>{
    const skate=board();
    // The Stillwater lake by the Lakeside walk: the terrain under the water is no floor for the board.
    expect(geography.submerged(1130,820,feet(1130,820))).toBe(true);
    expect(skate.startRefusal(1130,820,feet(1130,820))).toBe('water');
    // A walker 3 m above the nearest floor (a fall, a jump) has nothing under the board.
    expect(skate.startRefusal(1455,1175,feet(1455,1175)+3)).toBe('unsupported');
    // Steeper than the Horizon's 40° walkable limit.
    let steep:[number,number]|null=null;
    for(let x=1100;x<1520&&!steep;x+=5)for(let z=380;z<620&&!steep;z+=5){const s=geography.surface(x,z);if(s&&s.slope>48&&!geography.submerged(x,z,s.y))steep=[x,z];}
    expect(steep).not.toBeNull();
    expect(skate.startRefusal(steep![0],steep![1],feet(...steep!))).toBe('steep');
    // Streaming hold: never on ground whose chunk has not loaded.
    const held=board(()=>false);
    expect(held.startRefusal(1455,1175,feet(1455,1175))).toBe('held');
    expect(held.start({x:1455,y:feet(1455,1175),z:1175,yaw:0})).toBe(false);
  });

  it('rides the Horizon surfaces as the old skate kinds, not everything as grass',()=>{
    const host=createHorizonSkateWorld(geography,skateField(),{terrainKind:paint});
    const kind=(x:number,z:number)=>host.field.sample(x-O.x,z-O.z,feet(x,z)-O.y).kind;
    // Solid materials (walk beds, decks, quays, bridges).
    expect(kind(1455,1175)).toBe('path');      // gravel walk bed, Little Harbour
    expect(kind(420,685)).toBe('path');        // paved Flats strip
    expect(kind(561,1098)).toBe('wood');       // boardwalk deck, Suspension Bridge
    expect(kind(1484,1295)).toBe('cobble');    // stone quay
    // Terrain is its paint: Long Sands is sand; the Mountain v2 town is the old island's own kinds.
    expect(paint(1185,1445)).toBe('sand');expect(kind(1185,1445)).toBe('sand');
    expect(['cobble','path','concrete']).toContain(kind(O.x,O.z));   // the old town terrace
    expect(skateKindOf('timber')).toBe('wood');expect(skateKindOf('plaza')).toBe('concrete');expect(skateKindOf('bankedTurf')).toBe('grass');
  });
});
