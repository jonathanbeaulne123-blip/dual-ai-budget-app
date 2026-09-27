import {HARBOUR_DEV} from '../../flag.ts';
import * as THREE from 'three';
import {acquireWorldRenderer} from '../../../house/world/rendererOwner.ts';
import {createBodyFigure} from '../../body/figure.ts';
import type {PlaceWalkSource} from '../../scene/place.ts';
import type {HouseBodyReturn} from '../../../house/navigation.ts';
import {HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD} from '../../../worldGeography.ts';
import {loadHorizonAssets,type HorizonAssets} from '../../../house/world/horizonAssets.ts';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES,HORIZON_BODY_HEIGHT} from './geography.ts';
import {buildDistrictCards,buildWaterCards,buildHorizonRing} from './cards.ts';
import {createDistrictStream,useDefinitionDistricts} from '../world/districts.ts';
import {useCoastline} from '../land/coast/index.ts';
import {HORIZON_MANIFEST} from '../world/manifest.ts';
import {restoreHorizonPosition,HORIZON_RESTORE_TOLERANCE} from './savedPosition.ts';
import {horizonPartnerPose} from './partner.ts';
import {walkPlan} from '../world/pathGraph.ts';
import {solarPosition,solarReviewDate} from '../sun/solar.ts';
import {skyGradient} from '../sky/gradient.ts';
import {horizonFog,HORIZON_FOG} from '../sky/fog.ts';
import {horizonMotion,appReducedMotion,type HorizonComfort} from '../sun/comfort.ts';
import {shadowFrame} from '../sun/shadow.ts';
import {nightLight,NIGHT_LIGHT_CARDS,NIGHT_FLOOR,faceCardOn,FACE_CARD_LIGHT} from '../sky/night.ts';
import {sketchbookLens} from '../world/lens.ts';
import type {XYZ} from '../land/interfaces.ts';
import type {Host,SketchbookPose} from '../world/definition.ts';

export type HorizonBody={x:number;y:number;z:number;yaw:number};
export type HorizonMode='walk'|'look'|'journey';
export type HorizonRuntime=ReturnType<typeof createRuntime>;
export type HorizonOptions={tier:'full'|'lite';hideBuildings?:boolean;signal?:AbortSignal;/** The app's reduced-motion setting (Comfort.motion) or the OS query; html[data-motion] is also read. */reducedMotion?:boolean;/** The app's calm view (Comfort.quiet): the frozen 15:30, no night, nothing moving on its own. */calm?:boolean;onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onStatus?:(text:string)=>void;partner?:()=>PlaceWalkSource|null;initialBody?:HouseBodyReturn};
export async function mountHorizon(host:HTMLElement,options:HorizonOptions){
  const startedAt=performance.now(),assets=await loadHorizonAssets(options.tier,options.signal);if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  return createRuntime(host,assets,options,startedAt);
}
function createRuntime(host:HTMLElement,assets:HorizonAssets,options:HorizonOptions,startedAt:number){
  const {world,field,journey,cuts}=assets,tier=options.tier,assetLoadedAt=performance.now(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.08,4500);
  // The partition is the definition's (R1-67): districtAt() uses the baked hearts from here on.
  useDefinitionDistricts(world.districts);
  // …and the coastline too: shore tests read the baked outline, not a client re-solve of the manifest.
  useCoastline(world.coastline);
  const geography=createHorizonGeography(field,cuts),figure=createBodyFigure(),partner=createBodyFigure({coat:'#af8760'});
  scene.add(figure.group,partner.group);partner.group.visible=false;
  const partnerMaterials:Record<string,THREE.Material>={};partner.group.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])partnerMaterials[material.uuid]=material;});
  const coarse=new Map(world.districts.map(d=>{const cards=buildDistrictCards(world,journey,cuts,d,tier,true);scene.add(cards.group);return[d.id,cards] as const;}));
  const water=buildWaterCards(cuts,tier),ring=buildHorizonRing(assets.horizonCards,tier);scene.add(water.group,ring.group);
  // Horizon cards are fogged like the land but never beyond 70 % (STYLE §1.8), so they never vanish and never poke through.
  for(const material of Object.values(ring.materials)){if('fog'in material)(material as THREE.MeshStandardMaterial).fog=true;fogHook(material,HORIZON_FOG.horizonMaxOpacity);}
  let comfort:HorizonComfort={calm:options.calm===true,reducedMotion:options.reducedMotion===true||appReducedMotion()},motion=horizonMotion(comfort);
  const skyCanvas=document.createElement('canvas');skyCanvas.width=8;skyCanvas.height=256;const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;
  const ambient=new THREE.HemisphereLight('#d9e7e8','#786b57',1.2),sun=new THREE.DirectionalLight('#fff0d5',2.2),moon=new THREE.DirectionalLight('#9badcd',.26);
  sun.castShadow=true;{const size=tier==='full'?2048:1024;sun.shadow.mapSize.set(size,size);}sun.shadow.camera.near=1;sun.shadow.normalBias=.05;sun.shadow.bias=-.00006;
  scene.add(ambient,sun,sun.target,moon);
  // No dynamic point lights (STYLE §1.2.1): night is the moonlit floor plus one instanced batch of
  // light cards (a warm ground pool and a bead) at the definition's door and threshold lamps.
  const lightCardCap=NIGHT_LIGHT_CARDS[tier],poolGeometry=new THREE.CircleGeometry(NIGHT_LIGHT_CARDS.poolRadius,20).rotateX(-Math.PI/2),beadGeometry=new THREE.SphereGeometry(NIGHT_LIGHT_CARDS.beadRadius,8,6);
  const poolMaterial=new THREE.MeshBasicMaterial({color:NIGHT_LIGHT_CARDS.pool,transparent:true,opacity:NIGHT_LIGHT_CARDS.poolOpacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8}),beadMaterial=new THREE.MeshBasicMaterial({color:NIGHT_LIGHT_CARDS.bead});
  const pools=new THREE.InstancedMesh(poolGeometry,poolMaterial,lightCardCap),beads=new THREE.InstancedMesh(beadGeometry,beadMaterial,lightCardCap);pools.renderOrder=3;pools.frustumCulled=beads.frustumCulled=false;pools.count=beads.count=0;scene.add(pools,beads);
  // The seven windows (LIGHT §3): each host's doorway is a lit card from dusk, one instanced draw.
  const doorHosts=world.hosts.filter(h=>'xy'in h.door),doorGeometry=new THREE.PlaneGeometry(NIGHT_LIGHT_CARDS.doorSize[0],NIGHT_LIGHT_CARDS.doorSize[1]).translate(0,NIGHT_LIGHT_CARDS.doorSize[1]/2,0),doorMaterial=new THREE.MeshBasicMaterial({color:NIGHT_LIGHT_CARDS.door,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8}),doors=new THREE.InstancedMesh(doorGeometry,doorMaterial,Math.max(1,doorHosts.length));
  doorHosts.forEach((h,i)=>{const d=h.door as {xy:readonly [number,number];height?:number},facing=h.facing??0;doors.setMatrixAt(i,new THREE.Matrix4().makeRotationY(facing).setPosition(d.xy[0]+Math.sin(facing)*.08,(d.height??0)+.02,d.xy[1]+Math.cos(facing)*.08));});doors.count=doorHosts.length;doors.visible=false;scene.add(doors);
  // D-A5 (v2.0 lights, LIGHT §2): the dam's glass face is an emissive card (an unlit quad, no dynamic light), on from golden hour to dawn.
  const faceCardMaterial=new THREE.MeshBasicMaterial({color:FACE_CARD_LIGHT.colour,transparent:true,opacity:FACE_CARD_LIGHT.opacity,side:THREE.FrontSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),faceCards=new THREE.Group();
  for(const card of world.faceCards??[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(card.corners.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();const mesh=new THREE.Mesh(g,faceCardMaterial);mesh.name=`faceCard.${card.id}`;mesh.renderOrder=2;faceCards.add(mesh);}
  faceCards.visible=false;scene.add(faceCards);let faceCardsLit=false;
  let night=false,lastLocalLights=-Infinity,lastLightAt:XYZ=[Infinity,0,0],lastSolar={elevation:30,azimuth:180};
  const shadowRequests:{at:number;reason:string}[]=[];
  function requestShadow(reason:string){renderer.shadowMap.needsUpdate=true;shadowRequests.push({at:performance.now(),reason});if(shadowRequests.length>120)shadowRequests.shift();}
  function updateFog(){const fog=horizonFog({tier,eyeAboveGround:Math.max(0,camera.position.y-geography.ground(camera.position.x,camera.position.z)),elevation:lastSolar.elevation,sunAzimuth:lastSolar.azimuth,heading:yaw*180/Math.PI});scene.fog=mode==='journey'?null:new THREE.Fog(fog.color,fog.near,fog.far);}
  const lightMatrix=new THREE.Matrix4();
  function updateLocalLights(now:number){
    if(now-lastLocalLights<500)return;lastLocalLights=now;
    const at:XYZ=mode==='look'?[camera.position.x,camera.position.y,camera.position.z]:[body.x,body.y,body.z];
    doors.visible=night&&mode!=='journey';if(!night){pools.count=beads.count=0;return;}
    if(Math.hypot(at[0]-lastLightAt[0],at[2]-lastLightAt[2])<20&&pools.count>0)return;lastLightAt=at;
    const near=world.lights.map(anchor=>({anchor,distance:Math.hypot(anchor.at[0]-at[0],anchor.at[2]-at[2])})).sort((a,b)=>a.distance-b.distance).slice(0,lightCardCap);
    near.forEach(({anchor},i)=>{const lift=anchor.kind==='door'?2.2:.8,ground=anchor.at[1]-lift;lightMatrix.makeTranslation(anchor.at[0],ground+.06,anchor.at[2]);pools.setMatrixAt(i,lightMatrix);lightMatrix.makeTranslation(anchor.at[0],anchor.at[1],anchor.at[2]);beads.setMatrixAt(i,lightMatrix);});
    pools.count=beads.count=near.length;pools.instanceMatrix.needsUpdate=beads.instanceMatrix.needsUpdate=true;
  }
  let interactiveAt:number|null=null;
  let doorCooldown=0,lastMovementBlocker:unknown=null,simulating=false;
  let frame=0,disposed=false,paused=false,mode:HorizonMode='look',last=0,lastSun=-Infinity,shotId='A',distance=12,pitch=.2,yaw=0,drag:{x:number;y:number;id:number;travel:number}|null=null;
  let transition:{eye:THREE.Vector3;target:THREE.Vector3;toEye:THREE.Vector3;toTarget:THREE.Vector3;at:number;duration:number}|null=null;
  let controls={forward:0,strafe:0,run:false},path:XYZ[]=[],velocityY=0,jumpRequested=false,currentTime:Date|null=null;
  // The entry body and the Island camera come from the definition (page A's eye; the extent), not code constants.
  const entry=world.views.find(v=>v.id==='A')??world.views[0],body:HorizonBody={x:entry?.eye[0]??world.extent.w/2,y:(entry?.eye[1]??1.6)-1.6,z:entry?.eye[2]??world.extent.h/2,yaw:0},target=new THREE.Vector3(),keys=new Set<string>(),frameTimes:number[]=[],drawSamples:{at:number;calls:number;triangles:number;resident:number}[]=[];
  const configure=(r:THREE.WebGLRenderer)=>{r.setPixelRatio(Math.min(window.devicePixelRatio||1,tier==='full'?1.5:1));r.shadowMap.enabled=true;r.shadowMap.autoUpdate=false;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.25;};
  const lease=acquireWorldRenderer(host,{priority:0,parameters:{antialias:tier==='full',alpha:false,preserveDrawingBuffer:HARBOUR_DEV},configure,onSuspend:()=>{keys.clear();controls={forward:0,strafe:0,run:false};},onResume:()=>{last=0;schedule();}}),renderer=lease.renderer;
  const fades=new WeakMap<THREE.Material,{opacity:number;transparent:boolean;depthWrite:boolean}>();
  function fade(materials:Record<string,THREE.Material>,amount:number){for(const material of Object.values(materials)){let original=fades.get(material);if(!original){original={opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite};fades.set(material,original);}const transparent=original.transparent||amount<1;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=original.opacity*amount;material.depthWrite=original.depthWrite&&amount>=1;}}
  // A district streams in from the fog colour (STYLE §1.13.2): each material mixes toward the fog colour by 1 − fade.
  // Night chalk lip line (STYLE §1.3.3, darkness floor: "carried by a chalk lip line where light alone is not
  // enough"): the up-facing faces of every lip, kerb, parapet, rail and retaining solid, one unlit batch per resident district.
  // The FACES of retaining walls, kerbs, edges and parapets take a dimmer per-role night colour ("chalked coping", STYLE §1.3.3)
  // so a wall reads against the moonlit ground at ≥ 3:1 where the lip line alone is thin (P28 pages A and L).
  const chalkMaterial=new THREE.MeshBasicMaterial({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),lipChalk=new THREE.Color(NIGHT_LIGHT_CARDS.chalk),faceChalk=new THREE.Color(NIGHT_LIGHT_CARDS.faceChalk),solidsById=new Map((world.geometry?.solids??[]).map(solid=>[solid.id,solid]));
  function buildChalk(d:{solidIds?:string[]}){
    const positions:number[]=[],colors:number[]=[];
    for(const id of d.solidIds??[]){const solid=solidsById.get(id);if(!solid||!CHALK_SOLID.test(solid.id))continue;const faces=CHALK_FACE_SOLID.test(solid.id);const p=tier==='lite'?(solid.litePositions??solid.positions):solid.positions,ix=tier==='lite'?(solid.liteIndices??solid.indices):solid.indices;
      for(let i=0;i<ix.length;i+=3){const a=ix[i]!*3,b=ix[i+1]!*3,c=ix[i+2]!*3,ux=p[b]!-p[a]!,uy=p[b+1]!-p[a+1]!,uz=p[b+2]!-p[a+2]!,vx=p[c]!-p[a]!,vy=p[c+1]!-p[a+1]!,vz=p[c+2]!-p[a+2]!,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,n=Math.hypot(nx,ny,nz);if(n<1e-9)continue;const up=Math.abs(ny/n)>=.6;if(!up&&!(faces&&Math.abs(ny/n)<.45))continue;const col=up?lipChalk:faceChalk,ox=up?0:nx/n*.03,oz=up?0:nz/n*.03;for(const k of [a,b,c]){positions.push(p[k]!+ox,p[k+1]!+(up?.03:0),p[k+2]!+oz);colors.push(col.r,col.g,col.b);}}}
    if(!positions.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,chalkMaterial);mesh.visible=night;mesh.renderOrder=2;return mesh;
  }
  const stream=createDistrictStream(world,d=>{const cards=buildDistrictCards(world,field,cuts,d,tier,false,options.hideBuildings);const hooks=Object.values(cards.materials).map(material=>fogHook(material));const fadeIn=(amount:number)=>{for(const hook of hooks)hook.fade.value=amount;};fadeIn(motion.districtFadeMs>0?0:1);const chalk=buildChalk(d);scene.add(cards.group);if(chalk)scene.add(chalk);requestShadow('district-load');return{cards,chalk,at:performance.now(),fadeIn,dispose(){scene.remove(cards.group);cards.dispose();if(chalk){scene.remove(chalk);chalk.geometry.dispose();}if(coarse.has(d.id))coarse.get(d.id)!.group.visible=true;}};},tier);
  function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(mode==='look'&&!transition){const pose=world.views.find(p=>p.id===shotId);if(pose)lookAt(pose);}}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function setLight(date:Date){
    const position=solarPosition(date),colors=skyGradient(position.elevation),lookHeight=camera.position.y-geography.ground(camera.position.x,camera.position.z),fog=horizonFog({tier,eyeAboveGround:Math.max(0,lookHeight),elevation:position.elevation,sunAzimuth:position.azimuth,heading:yaw*180/Math.PI}),floor=nightLight(position.elevation,colors);
    lastSolar=position;night=floor.lightCards;faceCardsLit=faceCardOn(position,comfort.calm);faceCards.visible=faceCardsLit&&mode!=='journey';lastLocalLights=-Infinity;lastLightAt=[Infinity,0,0];
    const context=skyCanvas.getContext('2d')!;const gradient=context.createLinearGradient(0,0,0,256);gradient.addColorStop(0,colors.zenith);gradient.addColorStop(.6,colors.horizonAway);gradient.addColorStop(1,colors.horizonSun);context.fillStyle=gradient;context.fillRect(0,0,8,256);skyTexture.needsUpdate=true;scene.background=skyTexture;
    scene.fog=mode==='journey'?null:new THREE.Fog(fog.color,fog.near,fog.far);
    ambient.color.set(floor.hemisphereSky);ambient.groundColor.set(floor.hemisphereGround);ambient.intensity=floor.hemisphereIntensity;
    // The shadow box follows what the camera frames (sun/shadow.ts), not only the body.
    const frame=shadowFrame({tier,mode,eye:mode==='walk'?[body.x,body.y,body.z]:[camera.position.x,camera.position.y,camera.position.z],heading:yaw,groundY:mode==='walk'?body.y:geography.ground(camera.position.x,camera.position.z)}),[cx,cy,cz]=frame.centre;
    const shadowCamera=sun.shadow.camera;shadowCamera.left=shadowCamera.bottom=-frame.half;shadowCamera.right=shadowCamera.top=frame.half;shadowCamera.far=frame.far;shadowCamera.updateProjectionMatrix();
    // Bias follows the texel (2·half/mapSize) so a wider box does not stripe flat ground with acne.
    sun.shadow.normalBias=1.5*2*frame.half/frame.mapSize;sun.shadow.bias=-.0001;
    sun.color.set(colors.sunColor);sun.intensity=colors.sunIntensity*2;sun.position.set(cx+position.direction[0]*frame.sunDistance,cy+position.direction[1]*frame.sunDistance,cz+position.direction[2]*frame.sunDistance);sun.target.position.set(cx,cy,cz);sun.target.updateMatrixWorld();
    moon.color.set(NIGHT_FLOOR.moon);moon.position.set(cx+colors.moonDirection[0]*500,cy+500,cz+colors.moonDirection[2]*500);moon.target.position.set(cx,cy,cz);moon.target.updateMatrixWorld();moon.intensity=floor.moonIntensity;requestShadow('sun-step');
  }
  function lookAt(pose:SketchbookPose){
    // MANIFEST v1.7 viewRule: landscape keeps the page's vertical FOV (its horizontal FOV at 16:9);
    // portrait holds the page's HORIZONTAL FOV (portrait.fov, never < 45°) aimed at the portrait target.
    const lens=sketchbookLens(pose,camera.aspect);
    camera.position.fromArray([...lens.eye]);target.fromArray([...lens.target]);camera.lookAt(target);
    const delta=target.clone().sub(camera.position),horizontal=Math.hypot(delta.x,delta.z);yaw=Math.atan2(delta.x,delta.z);pitch=Math.atan2(delta.y,horizontal);distance=delta.length();
    camera.fov=lens.verticalFovDegrees;camera.updateProjectionMatrix();
  }
  function shot(id:string){const pose=world.views.find(p=>p.id===id);if(!pose)return false;shotId=id;mode='look';path=[];transition=null;lookAt(pose);body.x=pose.eye[0];body.z=pose.eye[2];body.y=pose.eye[1]-1.6;body.yaw=yaw;lastSun=-Infinity;return true;}
  function restore(saved:HouseBodyReturn){
    const next=restoreHorizonPosition(saved,world.pathGraph!,geography.ground,(x,z,y)=>{const at=geography.surface(x,z,y+.5,HORIZON_RESTORE_TOLERANCE);return at&&at.slope<=HORIZON_WALKABLE_DEGREES&&!geography.submerged(x,z,at.y)&&!geography.blocked(x,z,at.y)?{standY:at.y}:null;});
    Object.assign(body,{x:next.x,y:next.y!,z:next.z,yaw:next.yaw});yaw=body.yaw;mode='walk';path=[];velocityY=0;updateCamera();
  }

  function savedBody():HouseBodyReturn{return{...body,place:'court',world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY};}
  function enterDoor(hostId?:string){const h=hostId?world.hosts.find(h=>h.id===hostId):world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<2.4);if(!h)return false;
    doorCooldown=performance.now()+1800;const out=h.returnAt;if(out){Object.assign(body,{x:out[0],y:out[1],z:out[2],yaw:h.facing??0});yaw=body.yaw;}path=[];options.onDoor?.(h,savedBody());return true;
  }
  function setMode(next:HorizonMode){
    const fromEye=camera.position.clone(),fromTarget=target.clone();mode=next;path=[];faceCards.visible=faceCardsLit&&mode!=='journey';
    if(next==='journey'){const {w,h}=world.extent;camera.position.set(w/2,w*1.05,h*1.17);target.set(w/2,20,h*.47);camera.lookAt(target);camera.fov=50;camera.updateProjectionMatrix();}
    else if(next==='look')shot(shotId);
    else if(next==='walk'){const at=geography.surface(body.x,body.z,body.y);if(at&&at.slope<=HORIZON_WALKABLE_DEGREES)body.y=at.y;distance=9;pitch=-.26;updateCamera();}
    transition={eye:fromEye,target:fromTarget,toEye:camera.position.clone(),toTarget:target.clone(),at:performance.now(),duration:motion.transitionMs};
    // Reduced motion: a cut, never a tween (CONTRACT §2.10).
    if(transition.duration<=0){const to=transition;transition=null;camera.position.copy(to.toEye);target.copy(to.toTarget);}else{camera.position.copy(fromEye);target.copy(fromTarget);}camera.lookAt(target);
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
    if(velocityY!==0){velocityY-=12*dt;body.y+=velocityY*dt;const floor=geography.surface(body.x,body.z,body.y+.5);if(floor&&body.y<=floor.y){body.y=floor.y;velocityY=0;}if(geography.ceiling(body.x,body.z,body.y)<body.y+HORIZON_BODY_HEIGHT){body.y=geography.ceiling(body.x,body.z,body.y)-HORIZON_BODY_HEIGHT;velocityY=Math.min(0,velocityY);}}
    if(moved>0&&now>doorCooldown){const door=world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<1.15);if(door)enterDoor(door.id);}
    if(!simulating){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;figure.pose(now*.007,moved>0?1:0,now/1000);updateCamera();}
  }
  function tick(now:number){if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-(last||now))/1000));if(last)frameTimes.push(now-last);if(frameTimes.length>3600)frameTimes.shift();last=now;
    if(!paused){if(mode==='walk'&&!transition)step(dt,now);if(mode!=='journey')stream.update({x:body.x,z:body.z,now,mode:mode==='look'?'look':'walk',radius:mode==='look'?world.views.find(v=>v.id===shotId)?.radius:undefined,underground:body.y+HORIZON_BODY_HEIGHT<geography.ground(body.x,body.z)-.5});}
    ring.updateResidency(new Set(stream.live.keys()),mode==='journey');
    // Fine districts rise from the fog colour over 0.8 s (a cut under reduced motion); the coarse card they replace hides at once.
    for(const resource of stream.live.values()){resource.cards.group.visible=mode!=='journey';if(resource.chalk)resource.chalk.visible=night&&mode!=='journey';resource.fadeIn(motion.districtFadeMs>0?Math.min(1,Math.max(0,(now-resource.at)/motion.districtFadeMs)):1);}
    for(const [id,cards]of coarse)cards.group.visible=mode==='journey'||!stream.live.has(id);
    if(transition){const t=transition.duration>0?Math.min(1,Math.max(0,(now-transition.at)/transition.duration)):1,ease=t*t*(3-2*t);camera.position.lerpVectors(transition.eye,transition.toEye,ease);target.lerpVectors(transition.target,transition.toTarget,ease);camera.lookAt(target);if(t===1)transition=null;}figure.group.visible=mode==='walk';
    const peer=horizonPartnerPose(options.partner?.());partner.group.visible=Boolean(peer)&&mode!=='journey';if(peer){fade(partnerMaterials,peer.opacity);partner.group.position.set(peer.x,peer.y??geography.ground(peer.x,peer.z),peer.z);partner.group.rotation.y=peer.yaw;partner.pose(motion.ambientMotion?now*.007:0,peer.moving?1:0,motion.ambientMotion?now/1000:0);}
    // Calm and reduced motion hold the frozen 15:30 (no night, no sun step); a review date never overrides them.
    if(now-lastSun>=60_000){setLight(motion.sunFollowsClock&&currentTime?currentTime:solarReviewDate(new Date(),location.search,{dev:HARBOUR_DEV,reducedMotion:comfort.reducedMotion,calm:comfort.calm}));lastSun=now;}
    updateLocalLights(now);
    renderer.render(scene,camera);if(interactiveAt===null){interactiveAt=performance.now();options.onReady?.();}if(drawSamples.length===0||now-drawSamples.at(-1)!.at>500){drawSamples.push({at:now,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resident:stream.live.size});if(drawSamples.length>600)drawSamples.shift();}schedule();
  }
  function schedule(){if(!disposed&&lease.active)frame=lease.requestFrame(tick);}
  const interactive=(event:KeyboardEvent)=>event.composedPath().some(t=>t instanceof Element&&Boolean(t.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[role="textbox"]')));
  function keyDown(e:KeyboardEvent){if(paused||interactive(e)||!host.contains(document.activeElement))return;const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' '].includes(key)){e.preventDefault();if(key===' ')jumpRequested=true;else keys.add(key);}if(key==='e'){e.preventDefault();enterDoor();}if(key==='escape')path=[];}
  function keyUp(e:KeyboardEvent){keys.delete(e.key.toLowerCase());}
  function clear(){keys.clear();controls={forward:0,strafe:0,run:false};path=[];drag=null;}
  const unlisten=[lease.listenCanvas<PointerEvent>('pointerdown',e=>{if(paused)return;host.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,id:e.pointerId,travel:0};renderer.domElement.setPointerCapture(e.pointerId);}),lease.listenCanvas<PointerEvent>('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.travel+=Math.hypot(dx,dy);drag.x=e.clientX;drag.y=e.clientY;yaw-=dx*.005;pitch=Math.max(-1.2,Math.min(.8,pitch-dy*.004));if(mode==='look'){target.set(camera.position.x+Math.sin(yaw)*Math.cos(pitch)*distance,camera.position.y+Math.sin(pitch)*distance,camera.position.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);}}),lease.listenCanvas<PointerEvent>('pointerup',e=>{const click=drag&&drag.travel<5;drag=null;if(!click||mode!=='walk'||paused)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObjects([...stream.live.values()].map(r=>r.cards.group),true);const hit=hits[0];if(hit){const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],[hit.point.x,hit.point.y,hit.point.z],{stepFree:true});if(plan)path=[...plan.points];else options.onStatus?.('No connected walking route reaches that point.');}}),lease.listenCanvas<WheelEvent>('wheel',e=>{if(paused)return;e.preventDefault();distance=Math.max(2,Math.min(45,distance*Math.exp(e.deltaY*.001)));updateCamera();},{passive:false})];
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clear);host.addEventListener('blur',clear);
  shot(new URLSearchParams(location.search).get('shot')??'A');if(options.initialBody)restore(options.initialBody);resize();schedule();
  const api={world,assets,scene,camera,geography,shot,setMode,restore,savedBody,enterDoor,
    arrive(hostId:string){const h=world.hosts.find(h=>h.id===hostId);if(!h||!h.returnAt)return false;restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:h.returnAt[0],y:h.returnAt[1],z:h.returnAt[2],yaw:(h.facing??0)+Math.PI});return true;},
    simulateWalk(seconds:number){if(!HARBOUR_DEV)throw new Error('Simulation is a review-only control.');const count=Math.ceil(Math.max(0,Math.min(seconds,3600))/.05);simulating=true;try{for(let i=0;i<count&&path.length;i++)step(.05,performance.now()+i*50);}finally{simulating=false;updateCamera();}return{body:{...body},remaining:path.length,blocker:lastMovementBlocker};},
    body:()=>({...body}),mode:()=>mode,shotId:()=>shotId,
    input(next:Partial<typeof controls>){controls={...controls,...next};},jump(){jumpRequested=true;},look(dx:number,dy:number){yaw+=dx;pitch=Math.max(-1.2,Math.min(.8,pitch+dy));},
    pause(value:boolean){paused=value;if(value)clear();},setDate(date:Date){currentTime=date;lastSun=-Infinity;},
    /** The app's comfort choices, live (HorizonStage threads useComfort; html[data-motion] is read too). */
    setComfort(next:Partial<HorizonComfort>){comfort={calm:next.calm??comfort.calm,reducedMotion:(next.reducedMotion??comfort.reducedMotion)||appReducedMotion()};if(comfort.calm){faceCardsLit=false;faceCards.visible=false;}motion=horizonMotion(comfort);if(motion.transitionMs<=0&&transition){camera.position.copy(transition.toEye);target.copy(transition.toTarget);camera.lookAt(target);transition=null;}lastSun=-Infinity;},
    comfort:()=>({...comfort,motion:{...motion}}),
    walkTo(p:XYZ){lastMovementBlocker=null;const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],p,{stepFree:true});path=plan?[...plan.points]:[];return plan;},
    stats(){const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),revision:world.geographyRevision,terrainBytes:assets.bytes,collisionIndex:geography.indexStats,shadowRequests:[...shadowRequests],comfort:{...comfort,motion:{...motion}},lightCards:pools.count,shadow:{half:sun.shadow.camera.right,centre:sun.target.position.toArray()},firstInteractiveMs:interactiveAt===null?null:interactiveAt-startedAt,assetLoadMs:assetLoadedAt-startedAt,mode,shot:shotId,body:{...body},frames:[...frameTimes],drawSamples:[...drawSamples],stream:[...stream.history],camera:{eye:camera.position.toArray(),target:target.toArray(),fov:camera.fov},diagnostics:world.diagnostics};},
    dispose(){disposed=true;lease.cancelFrame(frame);observer.disconnect();for(const fn of unlisten)fn();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);host.removeEventListener('blur',clear);stream.dispose();for(const c of coarse.values())c.dispose();water.dispose();ring.dispose();skyTexture.dispose();poolGeometry.dispose();beadGeometry.dispose();poolMaterial.dispose();beadMaterial.dispose();chalkMaterial.dispose();doorGeometry.dispose();doorMaterial.dispose();figure.dispose();partner.dispose();sun.shadow.map?.dispose();lease.release();}
  };
  return api;
}

const CHALK_SOLID=/(^|\.)(edges|kerbs|parapet|parapets|rails|retaining|coping|lip|marker)(\.|@|$)/;
/** Solids whose vertical faces also take the night face colour (walls that bound a walk, not rails or markers). */
const CHALK_FACE_SOLID=/(^|\.)(edges|kerbs|parapet|parapets|retaining|coping)(\.|@|$)/;
type FogHook={fade:{value:number};cap:{value:number}};
const fogHooks=new WeakMap<THREE.Material,FogHook>();
/** One fog stage for land and cards: Three's fog, capped (horizon cards: 0.7), then a fade from the fog colour. */
function fogHook(material:THREE.Material,cap=1):FogHook{
  const existing=fogHooks.get(material);if(existing){existing.cap.value=cap;return existing;}
  const hook:FogHook={fade:{value:1},cap:{value:cap}},previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;fogHooks.set(material,hook);
  material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);shader.uniforms.uHorizonFade=hook.fade;shader.uniforms.uHorizonFogCap=hook.cap;
    shader.fragmentShader='uniform float uHorizonFade;\nuniform float uHorizonFogCap;\n'+shader.fragmentShader.replace('#include <fog_fragment>',`#ifdef USE_FOG
#ifdef FOG_EXP2
float horizonFogFactor=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
#else
float horizonFogFactor=smoothstep(fogNear,fogFar,vFogDepth);
#endif
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,min(horizonFogFactor,uHorizonFogCap));
gl_FragColor.rgb=mix(fogColor,gl_FragColor.rgb,uHorizonFade);
#endif`);};
  material.customProgramCacheKey=()=>`${previousKey.call(material)}|horizon-fog`;material.needsUpdate=true;return hook;
}
