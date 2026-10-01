import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {roadFixture,FIXTURE} from '../src/harbour/horizon/kit/road/fixture';
import {corridorLightAnchors} from '../src/harbour/horizon/land/corridor/lights';
import {createCorridorArt} from '../src/harbour/horizon/runtime/corridorArt';
import {createRoadLights} from '../src/harbour/horizon/runtime/roadLights';
import {NIGHT_LIGHT_CARDS} from '../src/harbour/horizon/sky/night';

describe('one physical corridor fixture and one capped night glow',()=>{
 it('keeps omitted lite fixtures absent through baked and missing-anchor fallback paths',()=>{
  for(const baked of [false,true])for(const tier of ['full','lite'] as const){
   const fx=roadFixture(),c=fx.corridor;
   c.liteLampIds=c.lamps.filter((l,i)=>l.kind!=='roadLantern'||i%2===0).map(l=>l.id);
   const w={...fx.world,lights:baked?corridorLightAnchors(fx.world.corridors!):[]};
   const lights=createRoadLights(new THREE.Scene(),w,{tier});
   const expected=fx.world.corridors!.flatMap(c=>tier==='lite'&&c.liteLampIds?c.lamps.filter(l=>c.liteLampIds!.includes(l.id)):c.lamps);
   expect(lights.stats().roadLamps).toBe(expected.length);
   lights.update(new THREE.PerspectiveCamera(),-12,0);
   for(const lamp of c.lamps)expect(lights.intensity(lamp.id)).toBe(tier==='full'||c.liteLampIds.includes(lamp.id)?1:0);
   lights.dispose();
  }
 });
 it('uses actual themed heads, includes stop lamps, and leaves halo ownership with the clock system',()=>{
  for(const theme of ['classic','taylor','newfoundland'] as const)for(const tier of ['full','lite'] as const){
   const fx=roadFixture(),c=fx.corridor,scene=new THREE.Scene();
   c.liteLampIds=c.lamps.filter((l,i)=>l.kind!=='roadLantern'||i%2===0).map(l=>l.id);
   const art=createCorridorArt(fx.world,{theme,tier,ground:fx.ground,districtOf:()=>FIXTURE.district,externalLampHalos:true});
   scene.add(art.group);art.prebuild([FIXTURE.district]);art.setNight(1);
   const anchors=art.lampAnchors();
   expect(anchors.some(a=>a.id.endsWith('.lamp')&&a.line?.includes(':stop:'))).toBe(true);
   for(const h of art.lampHeads())expect(anchors.find(a=>a.id===h.id)!.head).toEqual(h.head);
   const w={...fx.world,lights:corridorLightAnchors(fx.world.corridors!)};
   const lights=createRoadLights(scene,w,{tier,corridorAnchors:anchors});
   lights.update(new THREE.PerspectiveCamera(),-12,0);
   expect(lights.stats().roadLamps).toBe(anchors.length);
   expect(lights.stats().cards).toBeLessThanOrEqual(NIGHT_LIGHT_CARDS[tier]);
   expect(lights.lights).toHaveLength(tier==='full'?6:2);
   expect(scene.getObjectByName('horizon.corridorArt.halos')).toBeUndefined();
   const glow=scene.getObjectByName('lightCards.roadGlows') as THREE.InstancedMesh;
   expect(glow.count).toBeGreaterThan(0);
   for(const lamp of c.lamps)if(tier==='lite'&&!c.liteLampIds.includes(lamp.id))expect(lights.intensity(lamp.id)).toBe(0);
   lights.dispose();art.dispose();
  }
 });
});
