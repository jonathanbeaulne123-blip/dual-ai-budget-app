import {expect,it} from 'vitest';
import * as THREE from 'three';
import {kitchenCameraFrame} from '../src/harbour/horizon/kitchen/camera.ts';
import {STATIONS} from '../src/harbour/horizon/kitchen/config.ts';
for(const [width,height]of[[320,844],[390,844],[720,900],[1440,900],[900,560]])for(const deck of[false,true])it(`keeps ${deck?'Sunset':'galley'} working surfaces clear of HUD at ${width}×${height}`,()=>{
 const fit=kitchenCameraFrame(width!,height!,deck),camera=new THREE.PerspectiveCamera(48,width!/height!,.08,4500);camera.position.set(fit.eye.x,fit.eye.y,fit.eye.z);camera.lookAt(fit.target.x,fit.target.y,fit.target.z);camera.setViewOffset(width!,height!,0,fit.offsetY,width!,height!);camera.updateMatrixWorld(true);
 for(const station of STATIONS.filter(st=>deck||st.area!=='deck')){
  const point=new THREE.Vector3(station.surface.x,station.surface.y,station.surface.z).project(camera),x=(point.x+1)*width!/2,y=(1-point.y)*height!/2;
  expect(x,station.id).toBeGreaterThanOrEqual(fit.work.left);expect(x,station.id).toBeLessThanOrEqual(fit.work.right);expect(y,station.id).toBeGreaterThanOrEqual(fit.work.top);expect(y,station.id).toBeLessThanOrEqual(fit.work.bottom);
 }
});
