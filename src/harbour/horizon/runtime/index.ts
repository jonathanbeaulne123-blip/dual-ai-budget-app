import {HARBOUR_DEV} from '../../flag.ts';
import * as THREE from 'three';
import {acquireWorldRenderer} from '../../../house/world/rendererOwner.ts';
import {createBodyFigure} from '../../body/figure.ts';
import type {PlaceWalkSource} from '../../scene/place.ts';
import type {HouseBodyReturn} from '../../../house/navigation.ts';
import {HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD} from '../../../worldGeography.ts';
import {loadHorizonAssets,type HorizonAssets} from '../../../house/world/horizonAssets.ts';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES,HORIZON_BODY_HEIGHT,HORIZON_G} from './geography.ts';
import {buildDistrictCards,buildWaterCards,buildHorizonRing} from './cards.ts';
import {createDistrictStream} from '../world/districts.ts';
import {HORIZON_MANIFEST} from '../world/manifest.ts';
import {restoreHorizonPosition} from './savedPosition.ts';
import {horizonPartnerPose} from './partner.ts';
import {walkPlan} from '../world/pathGraph.ts';
import {solarPosition,solarReviewDate} from '../sun/solar.ts';
import {skyGradient} from '../sky/gradient.ts';
import {horizonFog} from '../sky/fog.ts';
import type {XYZ} from '../land/interfaces.ts';
import type {Host,SketchbookPose} from '../world/definition.ts';
import {createMoverRegistry,type MoverDeps} from '../movers/shared/registry.ts';
import type {ModeController,ModeId,MoverBody,MoverFrame,MoverHud,MoverInput,MoverSound} from '../movers/shared/mode.ts';
import type {ThresholdOffer} from '../movers/shared/threshold.ts';
import {moverInputFrom,moverFadeMs,moverBlendMs,moverBlendEase,registerHorizonMovers,riderSlip,savedRideBody,offerToShow,sameHud,sameOffer,createRideHold,RIDING_STATUS} from './moverInput.ts';
import {buildBoardProxy,BOARD_PROXY,type BoardProxy} from '../movers/board/art/proxy.ts';

export type HorizonBody={x:number;y:number;z:number;yaw:number};
export type HorizonMode='walk'|'look'|'journey';
export type HorizonRuntime=ReturnType<typeof createRuntime>;
export type HorizonOptions={tier:'full'|'lite';hideBuildings?:boolean;signal?:AbortSignal;reducedMotion?:boolean;onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onStatus?:(text:string)=>void;partner?:()=>PlaceWalkSource|null;initialBody?:HouseBodyReturn;
  /** Calm view (RIDE §10.6): forwarded to the active mover and the review sun. Live changes go through `api.setCalm`. */
  calm?:boolean;
  /** The nearest acceptable threshold offer (throttled to changes); the Enter bubble reads its label. */
  onOffer?:(offer:ThresholdOffer|null)=>void;
  /** The active mover's pace bubble (throttled to changes); null when no mover is active. */
  onMoverHud?:(hud:MoverHud|null)=>void;
  /** The active mover's sound intensities, every riding frame. */
  onMoverSound?:(sound:MoverSound)=>void;
  /** Mover factories to register at mount; the board and the bicycle are registered by default (`HORIZON_MOVERS`) and an entry here replaces its mode's default. `api.registry.register` works later too. */
  movers?:Partial<Record<ModeId,(deps:MoverDeps)=>ModeController>>};
export async function mountHorizon(host:HTMLElement,options:HorizonOptions){
  const startedAt=performance.now(),assets=await loadHorizonAssets(options.tier,options.signal);if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  return createRuntime(host,assets,options,startedAt);
}
function createRuntime(host:HTMLElement,assets:HorizonAssets,options:HorizonOptions,startedAt:number){
  const {world,field,journey,cuts}=assets,tier=options.tier,assetLoadedAt=performance.now(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.08,4500);
  const geography=createHorizonGeography(field,cuts),figure=createBodyFigure(),partner=createBodyFigure({coat:'#af8760'});
  scene.add(figure.group,partner.group);partner.group.visible=false;
  // Movers (RIDE §10.2, §11 ask 2): one registry, one active controller; the Horizon mode stays 'walk' while riding.
  let reducedMotion=options.reducedMotion===true,calm=options.calm===true;
  const registry=createMoverRegistry({world,geography,manifest:HORIZON_MANIFEST,reducedMotion,calm,tier});
  registerHorizonMovers(registry,options.movers);
  // R2-01: Look / Island / a page pause the ride where it is; Walk resumes it; a reload / arrive parks at a threshold. A mode never ends in place.
  const hold=createRideHold(registry,world,(x,z)=>geography.ground(x,z));
  let boardProxy:BoardProxy|null=null,jumpHeld=false,acceptRequested=false,lookAcc={dx:0,dy:0},lastOffer:ThresholdOffer|null=null,lastHud:MoverHud|null=null,lastInput:MoverInput|null=null,walkFov:number|null=null,fadeTimer=0;
  const fadeEl=document.createElement('div');fadeEl.className='horizon-fade';fadeEl.setAttribute('aria-hidden','true');host.appendChild(fadeEl);
  const partnerMaterials:Record<string,THREE.Material>={};partner.group.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])partnerMaterials[material.uuid]=material;});
  const coarse=new Map(world.districts.map(d=>{const cards=buildDistrictCards(world,journey,cuts,d,tier,true);scene.add(cards.group);return[d.id,cards] as const;}));
  const water=buildWaterCards(cuts,tier),ring=buildHorizonRing(assets.horizonCards,tier);scene.add(water.group,ring.group);
  const skyCanvas=document.createElement('canvas');skyCanvas.width=8;skyCanvas.height=256;const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;
  const ambient=new THREE.HemisphereLight('#d9e7e8','#786b57',1.2),sun=new THREE.DirectionalLight('#fff0d5',2.2),moon=new THREE.DirectionalLight('#9badcd',.26);
  sun.castShadow=true;sun.shadow.mapSize.set(tier==='full'?2048:1024,tier==='full'?2048:1024);sun.shadow.camera.near=1;sun.shadow.camera.far=1400;
  sun.shadow.camera.left=sun.shadow.camera.bottom=-180;sun.shadow.camera.right=sun.shadow.camera.top=180;sun.shadow.normalBias=.05;sun.shadow.bias=-.00006;
  scene.add(ambient,sun,sun.target,moon);
  // Pass 1 uses light anchors without fixtures or decorative geometry. Reuse a
  // bounded pool so a large threshold register never creates hundreds of lights.
  const localLights=Array.from({length:tier==='full'?6:4},()=>{const light=new THREE.PointLight('#ffe1ad',0,18,2);scene.add(light);return light;});
  let night=false,lastLocalLights=-Infinity,lastSolar={elevation:30,azimuth:180};
  const shadowRequests:{at:number;reason:string}[]=[];
  function requestShadow(reason:string){renderer.shadowMap.needsUpdate=true;shadowRequests.push({at:performance.now(),reason});if(shadowRequests.length>120)shadowRequests.shift();}
  function updateFog(){const fog=horizonFog({tier,eyeAboveGround:Math.max(0,camera.position.y-geography.ground(camera.position.x,camera.position.z)),elevation:lastSolar.elevation,sunAzimuth:lastSolar.azimuth,heading:yaw*180/Math.PI});scene.fog=mode==='journey'?null:new THREE.Fog(fog.color,fog.near,fog.far);}
  function updateLocalLights(now:number){
    if(now-lastLocalLights<500)return;lastLocalLights=now;
    const near=night?world.lights.map(anchor=>({anchor,distance:Math.hypot(anchor.at[0]-body.x,anchor.at[1]-body.y,anchor.at[2]-body.z)})).filter(p=>p.distance<40).sort((a,b)=>a.distance-b.distance).slice(0,localLights.length):[];
    localLights.forEach((light,i)=>{const item=near[i];light.intensity=item?22:0;if(item)light.position.fromArray([...item.anchor.at]);});
  }
  let interactiveAt:number|null=null;
  let doorCooldown=0,lastMovementBlocker:unknown=null,simulating=false;
  let frame=0,disposed=false,paused=false,mode:HorizonMode='look',last=0,lastSun=-Infinity,shotId='A',distance=12,pitch=.2,yaw=0,drag:{x:number;y:number;id:number;travel:number}|null=null;
  // `live`: the walk ↔ ride camera blend (RIDE §10.2). Walking/riding keeps running and the goal (toEye/toTarget) follows the camera ride()/step() set that frame; fov blends to toFov.
  let transition:{eye:THREE.Vector3;target:THREE.Vector3;toEye:THREE.Vector3;toTarget:THREE.Vector3;at:number;duration:number;live?:boolean;fov?:number;toFov?:number}|null=null;
  let controls={forward:0,strafe:0,run:false},path:XYZ[]=[],velocityY=0,jumpRequested=false,currentTime:Date|null=null;
  const body:HorizonBody={x:1400,y:22,z:1210,yaw:0},target=new THREE.Vector3(),keys=new Set<string>(),frameTimes:number[]=[],drawSamples:{at:number;calls:number;triangles:number;resident:number}[]=[];
  const configure=(r:THREE.WebGLRenderer)=>{r.setPixelRatio(Math.min(window.devicePixelRatio||1,tier==='full'?1.5:1));r.shadowMap.enabled=true;r.shadowMap.autoUpdate=false;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.25;};
  const lease=acquireWorldRenderer(host,{priority:0,parameters:{antialias:tier==='full',alpha:false,preserveDrawingBuffer:HARBOUR_DEV},configure,onSuspend:()=>{keys.clear();controls={forward:0,strafe:0,run:false};},onResume:()=>{last=0;schedule();}}),renderer=lease.renderer;
  const fades=new WeakMap<THREE.Material,{opacity:number;transparent:boolean;depthWrite:boolean}>();
  function fade(materials:Record<string,THREE.Material>,amount:number){for(const material of Object.values(materials)){let original=fades.get(material);if(!original){original={opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite};fades.set(material,original);}const transparent=original.transparent||amount<1;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=original.opacity*amount;material.depthWrite=original.depthWrite&&amount>=1;}}
  const stream=createDistrictStream(world,d=>{const cards=buildDistrictCards(world,field,cuts,d,tier,false,options.hideBuildings);scene.add(cards.group);requestShadow('district-load');return{cards,at:performance.now(),dispose(){scene.remove(cards.group);cards.dispose();if(coarse.has(d.id))coarse.get(d.id)!.group.visible=true;}};},tier);
  function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function setLight(date:Date){
    const position=solarPosition(date),colors=skyGradient(position.elevation),lookHeight=camera.position.y-geography.ground(camera.position.x,camera.position.z),fog=horizonFog({tier,eyeAboveGround:Math.max(0,lookHeight),elevation:position.elevation,sunAzimuth:position.azimuth,heading:yaw*180/Math.PI});
    lastSolar=position;night=position.elevation<0;lastLocalLights=-Infinity;
    const context=skyCanvas.getContext('2d')!;const gradient=context.createLinearGradient(0,0,0,256);gradient.addColorStop(0,colors.zenith);gradient.addColorStop(.6,colors.horizonAway);gradient.addColorStop(1,colors.horizonSun);context.fillStyle=gradient;context.fillRect(0,0,8,256);skyTexture.needsUpdate=true;scene.background=skyTexture;
    for(const material of Object.values(ring.materials))if('color'in material)(material as THREE.MeshStandardMaterial).color.set('#ffffff').lerp(new THREE.Color(fog.color),.5);
    scene.fog=mode==='journey'?null:new THREE.Fog(fog.color,fog.near,fog.far);
    ambient.color.set(colors.zenith);ambient.groundColor.set(position.elevation<0?'#546071':'#b8a580');ambient.intensity=colors.ambient*2.3;
    sun.color.set(colors.sunColor);sun.intensity=colors.sunIntensity*2;sun.position.set(body.x+position.direction[0]*700,body.y+position.direction[1]*700,body.z+position.direction[2]*700);sun.target.position.set(body.x,body.y,body.z);
    moon.position.set(body.x+colors.moonDirection[0]*500,500,body.z+colors.moonDirection[2]*500);moon.intensity=position.elevation<0?.38:0;requestShadow('sun-step');
  }
  function lookAt(pose:SketchbookPose){
    camera.position.fromArray([...pose.eye]);target.fromArray([...pose.target]);camera.lookAt(target);
    const delta=target.clone().sub(camera.position),horizontal=Math.hypot(delta.x,delta.z);yaw=Math.atan2(delta.x,delta.z);pitch=Math.atan2(delta.y,horizontal);distance=delta.length();
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(pose.fovDegrees)/2)/(pose.aspect??16/9)));camera.updateProjectionMatrix();
  }
  function shot(id:string){const pose=world.views.find(p=>p.id===id);if(!pose)return false;pauseRide();shotId=id;mode='look';path=[];transition=null;lookAt(pose);body.x=pose.eye[0];body.z=pose.eye[2];body.y=pose.eye[1]-1.6;body.yaw=yaw;lastSun=-Infinity;return true;}
  function restore(saved:HouseBodyReturn){
    parkRide();if(transition?.live)transition=null;const next=restoreHorizonPosition(saved,world.pathGraph!,geography.ground);
    Object.assign(body,{x:next.x,y:next.y!,z:next.z,yaw:next.yaw});yaw=body.yaw;mode='walk';path=[];velocityY=0;updateCamera();
  }

  /** While riding, a reload restores on foot at the nearest threshold of the mode (RIDE §6.5). */
  function savedBody():HouseBodyReturn{const at=registry.active()?savedRideBody(world,hold.body??body,registry.mode(),geography.ground):body;return{x:at.x,y:at.y,z:at.z,yaw:at.yaw,place:'court',world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY};}
  // ---- The mover hook ----
  function fadeCut(label:string){
    // The mover has already moved the body: show black at once and fade back in (300 ms); a cut under reduced motion / calm.
    const ms=moverFadeMs(reducedMotion,calm);if(label)options.onStatus?.(label);if(!ms)return;
    window.clearTimeout(fadeTimer);fadeEl.style.transitionDuration='0ms';fadeEl.style.opacity='1';void fadeEl.offsetWidth;
    fadeTimer=window.setTimeout(()=>{fadeEl.style.transitionDuration=`${ms}ms`;fadeEl.style.opacity='0';},16);
  }
  /** Starts the walk ↔ ride camera blend from where the camera is now (a cut when `ms` is 0). */
  function blendCamera(ms:number,toFov:number){
    if(!ms){if(transition?.live)transition=null;return;}
    transition={eye:camera.position.clone(),target:target.clone(),toEye:camera.position.clone(),toTarget:target.clone(),at:performance.now(),duration:ms,live:true,fov:camera.fov,toFov};
  }
  /** The board greybox under the rider's figure while a mover is active (RIDE §11: VehicleArt until pass 2b). */
  function mountBoardProxy(){
    if(boardProxy)return;boardProxy=buildBoardProxy();
    boardProxy.group.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});
    figure.group.add(boardProxy.group);
  }
  function unmountBoardProxy(){boardProxy?.dispose();boardProxy=null;}
  /** The figure over the deck: it faces the travel (body.yaw + slip), feet on the deck top; the deck keeps the nose heading, pitch and roll in world space and stays on the ground under a crouch. */
  const proxyTurn=new THREE.Quaternion(),proxyEuler=new THREE.Euler(0,0,0,'YXZ'),figureInverse=new THREE.Quaternion();
  function poseRider(pose:MoverFrame['pose'],active:ModeController,now:number){
    const slip=riderSlip(pose,active),drop=Math.max(0,pose.crouch)*.25,lift=boardProxy?BOARD_PROXY.top:0;
    figure.group.position.set(body.x,body.y+lift-drop,body.z);figure.group.rotation.set(0,body.yaw+slip,-pose.lean);
    figure.pose(now*.007,0,now/1000);   // riding: no walk cycle
    if(!boardProxy)return;
    const scale=figure.group.scale.x||1;figureInverse.copy(figure.group.quaternion).invert();
    boardProxy.group.quaternion.copy(figureInverse).multiply(proxyTurn.setFromEuler(proxyEuler.set(-pose.pitch,body.yaw,-pose.roll,'YXZ')));
    boardProxy.group.position.set(0,drop-lift,0).applyQuaternion(figureInverse).divideScalar(scale);
    boardProxy.group.scale.setScalar(1/scale);
  }
  function onFoot(at:MoverBody|null,status:string){
    blendCamera(moverBlendMs('park',reducedMotion,calm),walkFov??camera.fov);unmountBoardProxy();
    if(at){Object.assign(body,{x:at.x,y:at.y,z:at.z,yaw:at.yaw});yaw=body.yaw;}
    velocityY=0;path=[];figure.group.rotation.set(0,body.yaw,0);figure.group.position.set(body.x,body.y,body.z);
    if(walkFov!==null){camera.fov=walkFov;camera.updateProjectionMatrix();walkFov=null;}
    lastHud=null;options.onMoverHud?.(null);options.onStatus?.(status);updateCamera();
  }
  function acceptOffer(offer:ThresholdOffer){
    const riding=registry.active()!==null,name=registry.mode();
    if(!registry.accept(offer,{...body},performance.now()))return false;
    if(offer.to==='feet')onFoot(registry.lastExit(),`Parked the ${name} at ${offer.thresholdId}.`);
    else if(!riding)startRide();
    return true;
  }
  /** Pick-up: save the walk FOV, blend the camera to the mover's (0.8 s; a cut under reduced motion / calm), show the deck. */
  function startRide(){walkFov=camera.fov;path=[];blendCamera(moverBlendMs('pickup',reducedMotion,calm),camera.fov);mountBoardProxy();options.onStatus?.(RIDING_STATUS);}
  /** Leaving Walk (Look / Island / a page) while riding: the mover pauses where it is (R2-01). The mode, the controller and the rider's body are kept; `update` stops; the Look / Island camera takes over. */
  function pauseRide(){
    if(!hold.pause({...body}))return;
    jumpHeld=false;jumpRequested=false;acceptRequested=false;
    options.onStatus?.(`The ${registry.mode()} waits where you left it. Choose Walk to ride on.`);
  }
  /** Walk again: the paused rider is put back and the mover camera blends back in (0.8 s; a cut under reduced motion / calm). */
  function resumeRide(){
    const at=hold.resume();if(!at)return false;
    Object.assign(body,at);yaw=body.yaw;mode='walk';path=[];lookAcc={dx:0,dy:0};jumpRequested=false;acceptRequested=false;
    const ms=moverBlendMs('pickup',reducedMotion,calm);if(!ms)transition=null;   // a cut also drops a Look/Island transition still running
    blendCamera(ms,camera.fov);options.onStatus?.(RIDING_STATUS);return true;
  }
  /** A reload / arrive while riding: the mode ends at the saved-body rule's `mode→feet` threshold through `registry.accept` (the controller exits and is disposed). */
  function parkRide(){
    if(!registry.active())return;
    const name=registry.mode(),parked=hold.park({...body},performance.now());
    onFoot(parked?.body??null,parked?`Parked the ${name} at ${parked.offer.thresholdId}.`:`The ${name} is put away.`);
  }
  function currentInput(accept:boolean):MoverInput{return moverInputFrom({keys,controls,jumpHeld,jumpEdge:jumpRequested,accept,look:lookAcc});}
  function ride(dt:number,now:number,accept:boolean){
    const active=registry.active()!;const input=currentInput(accept);jumpRequested=false;lookAcc={dx:0,dy:0};lastInput=input;
    const f=active.update(dt,input,now);
    Object.assign(body,{x:f.body.x,y:f.body.y,z:f.body.z,yaw:f.body.yaw});yaw=f.body.yaw;
    if(f.fade){fadeCut(f.fade.label);if(transition?.live)transition=null;}   // the mover snapped its camera with the body: no blend across a fade
    if(f.camera){camera.position.set(...f.camera.eye);target.set(...f.camera.target);camera.lookAt(target);if(transition?.live)transition.toFov=f.camera.fov;else if(Math.abs(camera.fov-f.camera.fov)>1e-3){camera.fov=f.camera.fov;camera.updateProjectionMatrix();}}
    else updateCamera();
    poseRider(f.pose,active,now);
    if(!sameHud(lastHud,f.hud)){lastHud={...f.hud};options.onMoverHud?.(lastHud);}
    options.onMoverSound?.(f.sound);
  }
  /** Offers and the E / Enter edge, once per frame. Returns whether the edge is still unspent (for the mover's `accept`). */
  function offersAndAccept():boolean{
    const offer=mode==='walk'&&(!transition||transition.live)?offerToShow(registry.offers(body),registry.canAccept):null;
    if(!sameOffer(offer,lastOffer)){lastOffer=offer;options.onOffer?.(offer);}
    if(!acceptRequested)return false;acceptRequested=false;
    if(offer&&acceptOffer(offer))return false;
    if(registry.active())return true;
    enterDoor();return false;
  }
  function enterDoor(hostId?:string){if(registry.active())return false;   // a rider parks first: a door is not a mode threshold
    const h=hostId?world.hosts.find(h=>h.id===hostId):world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<2.4);if(!h)return false;
    doorCooldown=performance.now()+1800;const out=h.returnAt;if(out){Object.assign(body,{x:out[0],y:out[1],z:out[2],yaw:h.facing??0});yaw=body.yaw;}path=[];options.onDoor?.(h,savedBody());return true;
  }
  function setMode(next:HorizonMode){
    if(next!=='walk')pauseRide();
    else if(registry.active()){resumeRide();mode='walk';path=[];updateFog();return;}   // riding: no walk-camera transition, the mover camera blends back
    const fromEye=camera.position.clone(),fromTarget=target.clone();mode=next;path=[];
    if(next==='journey'){camera.position.set(1000,2100,2100);target.set(1000,20,850);camera.lookAt(target);camera.fov=50;camera.updateProjectionMatrix();}
    else if(next==='walk'){const at=geography.surface(body.x,body.z,body.y);if(at&&at.slope<=HORIZON_WALKABLE_DEGREES)body.y=at.y;distance=9;pitch=-.26;updateCamera();}
    transition={eye:fromEye,target:fromTarget,toEye:camera.position.clone(),toTarget:target.clone(),at:performance.now(),duration:reducedMotion?300:1100};camera.position.copy(fromEye);target.copy(fromTarget);camera.lookAt(target);
    updateFog();
  }
  function updateCamera(){if(mode!=='walk')return;
    const eye:XYZ=[body.x,body.y+1.15,body.z],desired:XYZ=[body.x-Math.sin(yaw)*distance,body.y+1.15-Math.sin(pitch)*distance,body.z-Math.cos(yaw)*distance];
    let f=1;while(f>.12&&geography.cameraBlocked(eye,[eye[0]+(desired[0]-eye[0])*f,eye[1]+(desired[1]-eye[1])*f,eye[2]+(desired[2]-eye[2])*f]))f-=.08;
    camera.position.set(eye[0]+(desired[0]-eye[0])*f,eye[1]+(desired[1]-eye[1])*f,eye[2]+(desired[2]-eye[2])*f);target.set(...eye);camera.lookAt(target);
  }
  function move(dx:number,dz:number,dt:number){
    const length=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(length/.2));let moved=0;
    for(let i=0;i<steps;i++){
      const x=body.x+dx/steps,z=body.z+dz/steps,hit=geography.surface(x,z,body.y,.48);
      const obstacle=hit?geography.blocker(x,z,Math.max(body.y,hit.y),.3,[dx/steps,dz/steps]):null;
      if(!hit||hit.slope>HORIZON_WALKABLE_DEGREES||geography.submerged(x,z,hit.y)||obstacle){lastMovementBlocker={at:[x,body.y,z],surface:hit,obstacle,water:hit?geography.submerged(x,z,hit.y):false};break;}
      body.x=x;body.z=z;if(velocityY===0)body.y=Math.max(hit.y,body.y-6*dt/steps);moved+=length/steps;
    }return moved;
  }
  function step(dt:number,now:number){
    let forward=controls.forward+(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),strafe=controls.strafe+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    let dx=Math.sin(yaw)*forward+Math.cos(yaw)*strafe,dz=Math.cos(yaw)*forward-Math.sin(yaw)*strafe;
    if(dx||dz)path=[];
    else if(path.length){const p=path[0]!;dx=p[0]-body.x;dz=p[2]-body.z;if(Math.hypot(dx,dz)<.35){path.shift();dx=0;dz=0;}}
    const length=Math.hypot(dx,dz),speed=controls.run||keys.has('shift')?HORIZON_MANIFEST.speeds_ms.run:HORIZON_MANIFEST.speeds_ms.walk;
    let moved=0;if(length){dx=dx/length*Math.min(length,speed*dt);dz=dz/length*Math.min(length,speed*dt);body.yaw=Math.atan2(dx,dz);moved=move(dx,dz,dt);if(path.length&&moved<.001){path=[];options.onStatus?.('That path is blocked. Choose another approach.');}}
    if(jumpRequested&&velocityY===0)velocityY=4.2;jumpRequested=false;
    if(velocityY!==0){velocityY-=HORIZON_G*dt;body.y+=velocityY*dt;const floor=geography.surface(body.x,body.z,body.y+.5);if(floor&&body.y<=floor.y){body.y=floor.y;velocityY=0;}if(geography.ceiling(body.x,body.z,body.y)<body.y+HORIZON_BODY_HEIGHT){body.y=geography.ceiling(body.x,body.z,body.y)-HORIZON_BODY_HEIGHT;velocityY=Math.min(0,velocityY);}}
    if(moved>0&&now>doorCooldown){const door=world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<1.15);if(door)enterDoor(door.id);}
    if(!simulating){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;figure.pose(now*.007,moved>0?1:0,now/1000);updateCamera();}
  }
  function tick(now:number){if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-(last||now))/1000));if(last)frameTimes.push(now-last);if(frameTimes.length>3600)frameTimes.shift();last=now;
    let stepped=false;
    if(!paused){const accept=offersAndAccept();if(mode==='walk'&&(!transition||transition.live)){stepped=true;if(registry.active()){if(hold.steps(mode))ride(dt,now,accept);}else step(dt,now);}if(mode!=='journey')stream.update({x:body.x,z:body.z,now,mode:mode==='look'?'look':'walk',radius:mode==='look'?world.views.find(v=>v.id===shotId)?.radius:undefined,underground:body.y+HORIZON_BODY_HEIGHT<geography.ground(body.x,body.z)-.5});}
    ring.updateResidency(new Set(stream.live.keys()),mode==='journey');
    for(const resource of stream.live.values()){resource.cards.group.visible=mode!=='journey';fade(resource.cards.materials,Math.min(1,Math.max(0,(now-resource.at)/(reducedMotion?300:500))));}
    for(const [id,cards]of coarse){const resource=stream.live.get(id),amount=mode==='journey'||!resource?1:Math.max(0,1-(now-resource.at)/(reducedMotion?300:500));cards.group.visible=amount>0;fade(cards.materials,amount);}
    if(transition){
      if(transition.live&&stepped){transition.toEye.copy(camera.position);transition.toTarget.copy(target);}   // ride()/step() just set this frame's goal camera
      const t=Math.min(1,Math.max(0,(now-transition.at)/transition.duration)),ease=transition.live?moverBlendEase(now-transition.at,transition.duration):t*t*(3-2*t);
      camera.position.lerpVectors(transition.eye,transition.toEye,ease);target.lerpVectors(transition.target,transition.toTarget,ease);camera.lookAt(target);
      if(transition.fov!==undefined&&transition.toFov!==undefined){const fov=transition.fov+(transition.toFov-transition.fov)*ease;if(Math.abs(camera.fov-fov)>1e-3){camera.fov=fov;camera.updateProjectionMatrix();}}
      if(t===1)transition=null;
    }figure.group.visible=mode==='walk';
    const peer=horizonPartnerPose(options.partner?.());partner.group.visible=Boolean(peer)&&mode!=='journey';if(peer){fade(partnerMaterials,peer.opacity);partner.group.position.set(peer.x,peer.y??geography.ground(peer.x,peer.z),peer.z);partner.group.rotation.y=peer.yaw;partner.pose(now*.007,peer.moving?1:0,now/1000);}
    if(now-lastSun>=60_000){setLight(currentTime??solarReviewDate(new Date(),location.search,{dev:HARBOUR_DEV,reducedMotion,calm}));lastSun=now;}
    updateLocalLights(now);
    renderer.render(scene,camera);if(interactiveAt===null){interactiveAt=performance.now();options.onReady?.();}if(drawSamples.length===0||now-drawSamples.at(-1)!.at>500){drawSamples.push({at:now,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resident:stream.live.size});if(drawSamples.length>600)drawSamples.shift();}schedule();
  }
  function schedule(){if(!disposed&&lease.active)frame=lease.requestFrame(tick);}
  const interactive=(event:KeyboardEvent)=>event.composedPath().some(t=>t instanceof Element&&Boolean(t.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[role="textbox"]')));
  function keyDown(e:KeyboardEvent){if(paused||interactive(e)||!host.contains(document.activeElement))return;const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' '].includes(key)){e.preventDefault();keys.add(key);if(key===' '&&!e.repeat||key===' '&&!registry.active())jumpRequested=true;}if(key==='e'){e.preventDefault();if(!e.repeat)acceptRequested=true;}if(key==='escape')path=[];}
  function keyUp(e:KeyboardEvent){keys.delete(e.key.toLowerCase());}
  function clear(){keys.clear();controls={forward:0,strafe:0,run:false};path=[];drag=null;jumpHeld=false;}
  const unlisten=[lease.listenCanvas<PointerEvent>('pointerdown',e=>{if(paused)return;host.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,id:e.pointerId,travel:0};renderer.domElement.setPointerCapture(e.pointerId);}),lease.listenCanvas<PointerEvent>('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.travel+=Math.hypot(dx,dy);drag.x=e.clientX;drag.y=e.clientY;lookAcc.dx-=dx*.005;lookAcc.dy-=dy*.004;yaw-=dx*.005;pitch=Math.max(-1.2,Math.min(.8,pitch-dy*.004));if(mode==='look'){target.set(camera.position.x+Math.sin(yaw)*Math.cos(pitch)*distance,camera.position.y+Math.sin(pitch)*distance,camera.position.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);}}),lease.listenCanvas<PointerEvent>('pointerup',e=>{const click=drag&&drag.travel<5;drag=null;if(!click||mode!=='walk'||paused)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObjects([...stream.live.values()].map(r=>r.cards.group),true);const hit=hits[0];if(hit){const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],[hit.point.x,hit.point.y,hit.point.z],{stepFree:true});if(plan)path=[...plan.points];else options.onStatus?.('No connected walking route reaches that point.');}}),lease.listenCanvas<WheelEvent>('wheel',e=>{if(paused)return;e.preventDefault();distance=Math.max(2,Math.min(45,distance*Math.exp(e.deltaY*.001)));updateCamera();},{passive:false})];
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clear);host.addEventListener('blur',clear);
  shot(new URLSearchParams(location.search).get('shot')??'A');if(options.initialBody)restore(options.initialBody);resize();schedule();
  const api={world,assets,scene,camera,geography,shot,setMode,restore,savedBody,enterDoor,
    arrive(hostId:string){const h=world.hosts.find(h=>h.id===hostId);if(!h||!h.returnAt)return false;restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:h.returnAt[0],y:h.returnAt[1],z:h.returnAt[2],yaw:(h.facing??0)+Math.PI});return true;},
    simulateWalk(seconds:number){if(!HARBOUR_DEV)throw new Error('Simulation is a review-only control.');const count=Math.ceil(Math.max(0,Math.min(seconds,3600))/.05);simulating=true;try{for(let i=0;i<count&&path.length;i++)step(.05,performance.now()+i*50);}finally{simulating=false;updateCamera();}return{body:{...body},remaining:path.length,blocker:lastMovementBlocker};},
    body:()=>({...body}),mode:()=>mode,shotId:()=>shotId,
    // ---- movers (track I) ----
    registry,
    /** The input the active mover would read this frame (after a riding frame: the one it did read). */
    moverInput():MoverInput{return lastInput&&registry.active()?{...lastInput,look:{...lastInput.look}}:currentInput(acceptRequested);},
    /** Review only (HARBOUR_DEV, R2-14): make `controller` the active mode as if `offer` had been accepted here. Refused while riding (park first). */
    attachMover(controller:ModeController,offer:ThresholdOffer){if(!HARBOUR_DEV)throw new Error('attachMover is a review-only control.');if(!registry.attach(controller,offer,{...body},performance.now()))return false;mode='walk';path=[];startRide();return true;},
    /** Review only (HARBOUR_DEV): park through `offer` (to 'feet'), else at the saved-body rule's threshold. Never in place. */
    detachMover(offer?:ThresholdOffer){if(!HARBOUR_DEV)throw new Error('detachMover is a review-only control.');if(!registry.active())return false;if(offer)return acceptOffer(offer);parkRide();return true;},
    /** Whether the active mover is paused (Look / Island / a page while riding). */
    ridePaused:()=>hold.paused(),
    /** E / the Enter bubble: an edge the next frame spends on the nearest offer, else a nearby door. */
    accept(){acceptRequested=true;},
    /** The Jump bubble held (riding: the board charges its pop). */
    jumpHold(on:boolean){jumpHeld=on;if(on&&!registry.active())jumpRequested=true;},
    offer:()=>lastOffer,
    setReducedMotion(on:boolean){reducedMotion=on;registry.setReducedMotion(on);lastSun=-Infinity;},
    setCalm(on:boolean){calm=on;registry.setCalm(on);lastSun=-Infinity;},
    input(next:Partial<typeof controls>){controls={...controls,...next};},jump(){jumpRequested=true;},look(dx:number,dy:number){lookAcc.dx+=dx;lookAcc.dy+=dy;yaw+=dx;pitch=Math.max(-1.2,Math.min(.8,pitch+dy));},
    pause(value:boolean){paused=value;if(value)clear();},setDate(date:Date){currentTime=date;lastSun=-Infinity;},
    walkTo(p:XYZ){lastMovementBlocker=null;const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],p,{stepFree:true});path=plan?[...plan.points]:[];return plan;},
    stats(){const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),revision:world.geographyRevision,terrainBytes:assets.bytes,collisionIndex:geography.indexStats,shadowRequests:[...shadowRequests],firstInteractiveMs:interactiveAt===null?null:interactiveAt-startedAt,assetLoadMs:assetLoadedAt-startedAt,mode,shot:shotId,body:{...body},frames:[...frameTimes],drawSamples:[...drawSamples],stream:[...stream.history],camera:{eye:camera.position.toArray(),target:target.toArray(),fov:camera.fov},diagnostics:world.diagnostics};},
    dispose(){disposed=true;window.clearTimeout(fadeTimer);registry.dispose();unmountBoardProxy();fadeEl.remove();lease.cancelFrame(frame);observer.disconnect();for(const fn of unlisten)fn();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);host.removeEventListener('blur',clear);stream.dispose();for(const c of coarse.values())c.dispose();water.dispose();ring.dispose();skyTexture.dispose();figure.dispose();partner.dispose();sun.shadow.map?.dispose();lease.release();}
  };
  return api;
}
