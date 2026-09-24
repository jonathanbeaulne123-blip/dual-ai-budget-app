/**
 * Skate Lab · the browser page (dev only: served at `/__skate-lab` by
 * `scripts/skate-lab.mjs` and the `__review` preview; never part of a build).
 *
 * The real park (`buildSkatePark` on the real field, on the island ground, in
 * the real light rig), the real rider (`createSkaterLook` on the Jonathan or
 * Bianca playable figure), the real skate chase camera and optionally the real
 * HUD — all driven by frames, not the wall clock. Rendering happens only in
 * `snap()`, so it runs under SwiftShader. See the "Skate Lab" section of
 * docs/worksessions/2026-09-23-skate-v2-plan.md.
 */
import * as THREE from 'three';
import {createElement} from 'react';
import {flushSync} from 'react-dom';
import {createRoot,type Root} from 'react-dom/client';
import {createGround,groundHeightAt,type Ground} from '../../src/harbour/scene/ground.ts';
import {configureHarbourRenderer,createLightRig,type LightRig} from '../../src/harbour/scene/lightRig.ts';
import {SCENE_DRESSING} from '../../src/harbour/scene/place.ts';
import {buildSkatePark,type SkatePark} from '../../src/harbour/skate/parkScene.ts';
import {SKATE_CATALOGS,SKATE_TRICK_BOOK,skateField,skateGesturePath} from '../../src/harbour/skate/driver.ts';
import {createSkaterLook,type SkaterLook} from '../../src/harbour/skate/look/index.ts';
import {createSkateCamera,type SkateCamera} from '../../src/harbour/skate/camera/skateCamera.ts';
import {createBodyFigure,type BodyFigure} from '../../src/harbour/body/figure.ts';
import {createPlayableFigure} from '../../src/harbour/body/playableFigure.ts';
import {SkateHUD} from '../../src/harbour/skate/SkateHUD.tsx';
import type {SkatePresent} from '../../src/harbour/skate/contract.ts';
import {createLabCore,type LabEntry,type LabLoad} from './skateLabCore.ts';
import {LAB_SCENARIOS,LAB_STILL_CAMERAS,type LabCamera} from './skateLabScenarios.ts';

type Vec3=readonly [number,number,number];
const params=new URLSearchParams(location.search);
const host=document.getElementById('skate-lab')!;
const canvas=document.createElement('canvas');host.append(canvas);
const hudHost=document.createElement('div');hudHost.style.cssText='position:absolute;inset:0;pointer-events:none';host.append(hudHost);
let hudRoot:Root|null=null;

const core=createLabCore();
let renderer:THREE.WebGLRenderer|null=null,scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(55,1,.05,480);
let ground:Ground|null=null,rig:LightRig|null=null,park:SkatePark|null=null,look:SkaterLook|null=null,figure:BodyFigure|null=null;
let chase:SkateCamera=createSkateCamera({ground:groundHeightAt});
let cam:LabCamera={kind:'chase'},sideYaw=0;
let frozen:SkatePresent|null=null;
let loaded:Required<Pick<LabLoad,'theme'|'tier'|'avatar'|'stance'|'hud'|'width'|'height'>>={theme:'classic',tier:'full',avatar:'jonathan',stance:'regular',hud:false,width:Number(params.get('w'))||480,height:Number(params.get('h'))||300};
let loadedKey='';

function size(w:number,h:number){
  host.style.cssText=`position:relative;width:${w}px;height:${h}px;overflow:hidden;background:#000`;
  canvas.style.cssText=`display:block;width:${w}px;height:${h}px`;
  renderer?.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
async function figureFor(avatar:LabLoad['avatar'],tier:'full'|'lite'):Promise<BodyFigure>{
  if(avatar==='default')return createBodyFigure();
  let done:()=>void=()=>{};const ready=new Promise<void>(r=>{done=r;});
  const f=createPlayableFigure(avatar??'jonathan',tier,{invalidate:()=>done()});
  await Promise.race([ready,new Promise(r=>setTimeout(r,10000))]);
  return f;
}
/** Rebuild the scene when theme/tier/avatar change; keep it otherwise. */
async function buildScene(){
  const key=`${loaded.theme}|${loaded.tier}|${loaded.avatar}`;
  if(key===loadedKey&&look)return;
  look?.dispose();figure?.dispose();park?.dispose();ground?.dispose();rig?.dispose();
  scene=new THREE.Scene();
  const dressing=SCENE_DRESSING[loaded.theme];
  if(!renderer){renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});}
  configureHarbourRenderer(renderer,loaded.tier,1);canvas.style.cssText=`display:block;width:${loaded.width}px;height:${loaded.height}px`;
  rig=createLightRig(scene,dressing.light,loaded.tier);
  ground=createGround(scene,dressing,loaded.tier);
  park=buildSkatePark(dressing,{tier:loaded.tier,field:skateField()});scene.add(park.group);
  figure=await figureFor(loaded.avatar,loaded.tier);
  look=createSkaterLook({figure,tier:loaded.tier,catalogs:SKATE_CATALOGS,theme:loaded.theme});scene.add(look.root);
  loadedKey=key;
}
const riderAt=():SkatePresent|null=>frozen??core.present();
function aim(dt:number){
  const p=riderAt();
  if(cam.kind==='chase'){
    if(!p)return;
    const f=chase.update(p,frozen?[]:core.events(),dt,{aspect:camera.aspect,blocked:(x,y,z)=>y<skateField().heightAt(x,z)+.05});
    camera.position.set(...f.position);camera.up.set(0,1,0);camera.lookAt(...f.target);if(f.roll)camera.rotateZ(f.roll);camera.fov=f.fov;
  }else if(cam.kind==='side'){
    if(!p)return;
    const d=cam.dist??3,h=cam.height??.8,s=cam.side??1,rx=-Math.cos(sideYaw)*s,rz=Math.sin(sideYaw)*s;
    camera.position.set(p.x+rx*d,p.y+h,p.z+rz*d);camera.up.set(0,1,0);camera.lookAt(p.x,p.y+.45,p.z);camera.fov=cam.fov??50;
  }else if(cam.kind==='orbit'){
    const t:Vec3=cam.target??(p?[p.x,p.y+.5,p.z]:[0,0,0]);
    const yw=cam.yawDeg*Math.PI/180,pt=cam.pitchDeg*Math.PI/180;
    camera.position.set(t[0]+Math.sin(yw)*Math.cos(pt)*cam.dist,t[1]+Math.sin(pt)*cam.dist,t[2]+Math.cos(yw)*Math.cos(pt)*cam.dist);
    camera.up.set(0,1,0);camera.lookAt(t[0],t[1],t[2]);camera.fov=cam.fov??50;
  }else{
    camera.position.set(...cam.position);camera.up.set(0,1,0);camera.lookAt(...cam.target);camera.fov=cam.fov??50;
  }
  camera.updateProjectionMatrix();
}
function draw(p:SkatePresent|null,events:Parameters<SkaterLook['update']>[1],dt:number){
  if(!p||!look)return;
  look.update(p,events,dt,false);
}
function renderHud(){
  if(!loaded.hud){if(hudRoot){hudRoot.unmount();hudRoot=null;}return;}
  hudRoot??=createRoot(hudHost);
  hudHost.className=`harbour-world harbour-world--${loaded.theme}`;
  const model=core.driver()?.hud()??null;
  const noop=()=>{};
  flushSync(()=>hudRoot!.render(createElement(SkateHUD,{model,onStart:noop,onWalk:noop,onPause:noop,onRoute:noop,onSpot:noop,onDeck:noop,onSettings:noop,onCommand:noop,onFocus:noop,gesturePath:skateGesturePath,trickBook:SKATE_TRICK_BOOK})));
}

const lab={
  /** Load a ride (rebuilds the scene only when theme/tier/avatar change). */
  async load(o:LabLoad={}){
    loaded={theme:o.theme??loaded.theme,tier:o.tier??loaded.tier,avatar:o.avatar??loaded.avatar,stance:o.stance??'regular',hud:o.hud??false,width:o.width??loaded.width,height:o.height??loaded.height};
    size(loaded.width,loaded.height);
    await buildScene();
    size(loaded.width,loaded.height);
    frozen=null;
    const pose=core.load({...o,tier:loaded.tier,stance:loaded.stance});
    chase=createSkateCamera({ground:groundHeightAt});sideYaw=pose.yaw;
    const p=core.present()!;draw(p,null,1/60);chase.snap(p);aim(0);
    renderHud();
    return pose;
  },
  script(entries:LabEntry[]){core.script(entries);},
  /** Advance `n` frames (default dt 1/60). Updates the rider and the camera; does not render. */
  step(n=1,dt=1/60){
    frozen=null;
    for(let i=0;i<n;i++){
      core.step(1,dt);
      const p=core.present();draw(p,core.events(),dt);
      if(core.driver()?.takeCut()&&p)chase.snap(p);
      aim(dt);
    }
    return core.present();
  },
  advanceTo(frame:number){const n=frame-core.frame();if(n>0)lab.step(n);return core.frame();},
  frame:()=>core.frame(),
  present:()=>riderAt(),
  events:()=>core.events(),
  trace:()=>core.trace(),
  kinds:()=>core.kinds(),
  /** 'chase' (the real skate camera), 'side' (locked across the path), 'orbit', 'fixed'. */
  camera(kind:LabCamera['kind'],params:Record<string,unknown>={}){
    cam={kind,...params} as LabCamera;
    const p=riderAt();sideYaw=typeof params.yawDeg==='number'?params.yawDeg*Math.PI/180:(p?.heading??sideYaw);
    if(kind==='chase'&&p)chase.snap(p);
    aim(0);
  },
  /** Freeze an arbitrary present (pose inspection); springs settle over `settle` frames. */
  pose(p:Partial<SkatePresent>,settle=45){
    const base=core.present();if(!base)return;
    frozen={...base,...p} as SkatePresent;
    for(let i=0;i<settle;i++)draw(frozen,null,1/60);
    aim(0);
  },
  /** Render and return the canvas as a PNG data URL (no HUD: the CLI screenshots the stage for that). */
  async snap():Promise<string>{
    if(!renderer)return '';
    const p=riderAt();if(p&&rig)rig.focus(p.x,p.y,p.z,cam.kind==='fixed'?30:10);
    renderHud();
    renderer.render(scene,camera);
    return canvas.toDataURL('image/png');
  },
  scenarios:()=>LAB_SCENARIOS.map(s=>({name:s.name,title:s.title,frames:s.frames})),
  /** Load a named scenario (with overrides) and queue its script. */
  async begin(name:string,over:LabLoad={}){
    const sc=LAB_SCENARIOS.find(s=>s.name===name);if(!sc)throw Error(`no scenario ${name}`);
    await lab.load({...sc.load,...over});
    lab.camera(sc.camera.kind,{...sc.camera});
    core.script(sc.script);
    const n=sc.samples??12,samples=Array.from({length:n},(_,k)=>Math.max(1,Math.round((k+1)*sc.frames/n)));
    return {name:sc.name,title:sc.title,frames:sc.frames,samples,hud:loaded.hud,expect:sc.expect};
  },
  stillCameras:()=>LAB_STILL_CAMERAS.map(([name])=>name),
  async still(theme:LabLoad['theme'],tier:'full'|'lite',index:number,over:LabLoad={}){
    await lab.load({spot:'tideline',...over,theme,tier});
    const [,c]=LAB_STILL_CAMERAS[index]!;lab.camera(c.kind,{...c});
    return lab.snap();
  },
  /** Tile images into a labelled grid (a filmstrip). */
  async compose(images:string[],labels:string[],cols:number,title=''):Promise<string>{
    const imgs=await Promise.all(images.map(src=>new Promise<HTMLImageElement>((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src;})));
    const w=imgs[0]?.width??loaded.width,h=imgs[0]?.height??loaded.height,rows=Math.ceil(imgs.length/cols),head=title?24:0;
    const c=document.createElement('canvas');c.width=w*cols;c.height=h*rows+head;
    const g=c.getContext('2d')!;g.fillStyle='#1d2622';g.fillRect(0,0,c.width,c.height);
    if(title){g.fillStyle='#fff6d7';g.font='bold 14px system-ui';g.fillText(title,8,17);}
    imgs.forEach((im,k)=>{const x=(k%cols)*w,y=head+Math.floor(k/cols)*h;g.drawImage(im,x,y,w,h);
      g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x,y+h-18,w,18);g.fillStyle='#fff';g.font='12px ui-monospace,monospace';g.fillText(labels[k]??'',x+5,y+h-5);
      g.strokeStyle='#1d2622';g.strokeRect(x+.5,y+.5,w-1,h-1);});
    return c.toDataURL('image/png');
  },
};
(window as unknown as {skateLab:typeof lab}).skateLab=lab;
size(loaded.width,loaded.height);
document.body.dataset.skateLab='ready';
