import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {createAdaptiveQuality,qualityProfile} from '../src/house/world/adaptiveQuality.ts';
import {applyHorizonQuality} from '../src/harbour/horizon/runtime/quality.ts';

type Controller=ReturnType<typeof createAdaptiveQuality>;
function run(controller:Controller,seconds:number,frameMs=1000/60,workMs=5){for(let n=0;n<Math.ceil(seconds*1000/frameMs);n++)controller.sample(frameMs,workMs);}

describe('adaptive rendering pressure and recovery',()=>{
 it.each([60,90,120,144])('keeps native quality on a healthy %i Hz display',hz=>{
  const controller=createAdaptiveQuality('full');run(controller,45,1000/hz);
  expect(controller.stats().level).toBe(0);expect(controller.stats().changes).toEqual([]);
 });
 it('requires sustained pressure and changes one step at a time within fixed bounds',()=>{
  const controller=createAdaptiveQuality('full');run(controller,1.1);run(controller,1,1000/30,20);
  expect(controller.stats().level).toBe(0);run(controller,1.2,1000/30,20);expect(controller.stats().level).toBe(1);
  run(controller,25,1000/30,20);expect(controller.stats().level).toBe(3);
  expect(controller.stats().changes.map(x=>x.level)).toEqual([1,2,3]);expect(controller.stats().atFloor).toBe(true);
 });
 it('does not degrade for isolated long tasks or near-budget timing noise',()=>{
  const controller=createAdaptiveQuality('lite');run(controller,2);
  for(let i=0;i<12;i++){controller.sample(800,600);run(controller,2);}
  run(controller,8,18,10);expect(controller.stats().level).toBe(0);
 });
 it('restores gradually after sustained headroom and backs off before another recovery attempt',()=>{
  const controller=createAdaptiveQuality('full');run(controller,10,1000/30,20);expect(controller.stats().level).toBe(3);
  run(controller,6);expect(controller.stats().level).toBe(3);run(controller,12);expect(controller.stats().level).toBe(2);
  run(controller,4,1000/30,20);expect(controller.stats().level).toBe(3);
  run(controller,9);expect(controller.stats().level).toBe(3);run(controller,40);expect(controller.stats().level).toBe(0);
  const changes=controller.stats().changes;expect(changes.filter(x=>x.reason==='recovery').length).toBe(4);
 });
 it('excludes idle, pause and lease gaps without forgetting the chosen quality',()=>{
  const controller=createAdaptiveQuality('lite');run(controller,3.5,1000/30,20);expect(controller.stats().level).toBe(1);
  for(let i=0;i<30;i++){controller.interrupt();run(controller,.8);}
  expect(controller.stats().level).toBe(1);expect(controller.stats().changes).toHaveLength(1);
  run(controller,20);expect(controller.stats().level).toBe(0);
 });
 it('ignores invalid samples and does not expose mutable diagnostics',()=>{
  const controller=createAdaptiveQuality('full');run(controller,4,1000/30,20);
  const before=controller.stats();for(const ms of [NaN,Infinity,-2,0])expect(controller.sample(ms,5)).toBe(false);
  expect(controller.stats().level).toBe(before.level);before.changes[0]!.level=99;expect(controller.stats().changes[0]!.level).toBe(1);
 });
});

describe('bounded raster and shadow profiles',()=>{
 it('never exceeds native/tier resolution, and keeps legible lower bounds',()=>{
  for(const tier of ['full','lite'] as const)for(const dpr of [.5,1,1.25,2,3]){
   const base=qualityProfile(tier,0,dpr);let previous=base.pixelRatio;
   for(let level=0;level<=3;level++){
    const profile=qualityProfile(tier,level,dpr);expect(profile.pixelRatio).toBeLessThanOrEqual(previous);expect(profile.pixelRatio).toBeGreaterThanOrEqual(Math.min(.75,base.pixelRatio));previous=profile.pixelRatio;
    expect(profile.shadowSize).toBeGreaterThanOrEqual(tier==='full'?1024:512);
   }
  }
  expect(qualityProfile('full',3,2)).toEqual({pixelRatio:1.5*.7,shadowSize:1024});
  expect(qualityProfile('lite',3,2)).toEqual({pixelRatio:.75,shadowSize:512});
  expect(qualityProfile('lite',0,NaN)).toEqual({pixelRatio:1,shadowSize:1024});
 });
 it('releases old shadow targets when resizing, keeps bias consistent, and avoids redundant resizes',()=>{
  let ratio=1.5;const setPixelRatio=vi.fn((value:number)=>{ratio=value;});
  const renderer={getPixelRatio:()=>ratio,setPixelRatio,shadowMap:{needsUpdate:false}} as unknown as THREE.WebGLRenderer;
  const sun=new THREE.DirectionalLight();sun.shadow.camera.right=96;sun.shadow.mapSize.set(2048,2048);
  const old=new THREE.WebGLRenderTarget(2048,2048),pass=new THREE.WebGLRenderTarget(2048,2048),dispose=vi.spyOn(old,'dispose'),disposePass=vi.spyOn(pass,'dispose');sun.shadow.map=old;sun.shadow.mapPass=pass;
  applyHorizonQuality(renderer,sun,{pixelRatio:1.2,shadowSize:1024});
  expect(dispose).toHaveBeenCalledOnce();expect(disposePass).toHaveBeenCalledOnce();expect(sun.shadow.map).toBeNull();expect(sun.shadow.mapPass).toBeNull();
  expect(sun.shadow.mapSize.toArray()).toEqual([1024,1024]);expect(sun.shadow.normalBias).toBe(3*96/1024);expect(renderer.shadowMap.needsUpdate).toBe(true);
  applyHorizonQuality(renderer,sun,{pixelRatio:1.2,shadowSize:1024});expect(setPixelRatio).toHaveBeenCalledOnce();
  const restored=new THREE.WebGLRenderTarget(1024,1024),restoreDispose=vi.spyOn(restored,'dispose');sun.shadow.map=restored;renderer.shadowMap.needsUpdate=false;
  applyHorizonQuality(renderer,sun,{pixelRatio:1.2,shadowSize:1024},true);expect(restoreDispose).toHaveBeenCalledOnce();expect(renderer.shadowMap.needsUpdate).toBe(true);
 });
});
