import {createFleet,isCraft,HANDLING,toWorld,toLocal,type CraftId} from '../movers/fleet/model.ts';
import {createWatercraftController} from '../movers/fleet/controller.ts';
import {createFleetArt} from '../movers/fleet/art.ts';
import {waterHeightAt} from '../land/water/index.ts';
import {constantWind} from '../movers/shared/wind.ts';
import {createPerspective,perspectiveLabel,type Perspective} from './perspective.ts';
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
import {createDistrictStream,districtAt,useDefinitionDistricts} from '../world/districts.ts';
import {useCoastline} from '../land/coast/index.ts';
import {HORIZON_MANIFEST} from '../world/manifest.ts';
import {restoreHorizonPosition,HORIZON_RESTORE_TOLERANCE} from './savedPosition.ts';
import {horizonPartnerPose} from './partner.ts';
import {walkPlan} from '../world/pathGraph.ts';
import {createChunkGate,createChunkScheduler,createRideGate,CHUNK_REACH_EU} from './chunkGate.ts';
import {createCableLayer} from './cableLayer.ts';
import {solarPosition,solarReviewDate} from '../sun/solar.ts';
import {skyGradient} from '../sky/gradient.ts';
import {horizonFog,HORIZON_FOG} from '../sky/fog.ts';
import {horizonMotion,appReducedMotion,type HorizonComfort} from '../sun/comfort.ts';
import {shadowFrame} from '../sun/shadow.ts';
import {createSkyDome} from '../sky/dome.ts';
import {nightLight,nightDome,NIGHT_LIGHT_CARDS,NIGHT_FLOOR,faceCardOn,FACE_CARD_LIGHT} from '../sky/night.ts';
import {sketchbookLens} from '../world/lens.ts';
import type {XYZ} from '../land/interfaces.ts';
import type {Host,SketchbookPose} from '../world/definition.ts';
import type {WorldAmbience} from '../../mountain/audio.ts';
import {createMoverRegistry,type MoverDeps} from '../movers/shared/registry.ts';
import type {AirborneBody,ModeController,ModeHud,ModeId,MoverBody,MoverFrame,MoverHud,MoverInput,MoverSound,ReducedMotionCut,ReducedMotionLanding} from '../movers/shared/mode.ts';
import type {ThresholdOffer} from '../movers/shared/threshold.ts';
import {moverInputFrom,moverFadeMs,moverBlendMs,moverBlendEase,registerHorizonMovers,riderSlip,savedRideBody,offerToShow,sameHud,sameOffer,createRideHold,RIDING_STATUS} from './moverInput.ts';
import {buildBoardProxy,BOARD_PROXY,type BoardProxy} from '../movers/board/art/proxy.ts';
import type {VehicleDressing} from '../movers/shared/vehicleArt.ts';

export type HorizonBody={x:number;y:number;z:number;yaw:number};
export type HorizonMode='walk'|'look'|'journey';
export type HorizonMoverState={mode:ModeId;attached:boolean;hud:MoverHud|ModeHud|null;fade?:string;cut?:ReducedMotionCut|null;airborne?:boolean;stowed?:ModeId|null;perspective?:Perspective};
export type HorizonMoverArt={object:THREE.Object3D;tick:(dt:number,figure:THREE.Object3D)=>boolean;dispose?:()=>void};
export type HorizonAccept={mode:ModeId;controller:ModeController|null;cut:ReducedMotionCut|null};
export type HorizonCutTarget={kind:'landing';landing:ReducedMotionLanding}|{kind:'view';id:string}|{kind:'stay'};
export const HORIZON_FADE_LABEL_MS=2500;
/** v2.2 ride rule: said while a boarding waits for the island's chunks (chunkGate.ts createRideGate). */
export const RIDE_WAITS_STATUS='The ride waits a moment while the island finishes arriving.';
export type HorizonRuntime=ReturnType<typeof createRuntime>;
export type HorizonOptions={fleetStorageKey?:string;tier:'full'|'lite';hideBuildings?:boolean;signal?:AbortSignal;/** The app's reduced-motion setting (Comfort.motion) or the OS query; html[data-motion] is also read. Live changes go through `api.setComfort`. */reducedMotion?:boolean;onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onStatus?:(text:string)=>void;partner?:()=>PlaceWalkSource|null;initialBody?:HouseBodyReturn;
  /** The active Hearth dressing is shared with the Horizon vehicle art. */
  theme?:VehicleDressing;
  /** The app's calm view (Comfort.quiet; RIDE §10.6): the frozen 15:30, no night, nothing moving on its own; forwarded to the active mover. Live changes go through `api.setComfort`. */
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
  // R1-72: the chunk under the entry body (page A's eye) is the only geometry fetched before the first frame; the rest
  // streams by district residency (createDistrictStream ready/request), each added to the collision index as it lands.
  // Wave 6 arrival rule: the camera district AND every chunk within the body's reach (CHUNK_REACH_EU) are resident before
  // the first interactive frame — the body (page A's eye, or the restored body) and the camera (page A, or ?shot=).
  const startEye=assets.world.views.find(v=>v.id==='A')?.eye;
  if(assets.chunks&&startEye){
    useDefinitionDistricts(assets.world.districts);
    const loader=assets.chunks,gate=createChunkGate(loader,(x,z)=>districtAt(x,z)),shotEye=assets.world.views.find(v=>v.id===new URLSearchParams(location.search).get('shot'))?.eye,bodyAt=options.initialBody?[options.initialBody.x,options.initialBody.z]:[startEye[0],startEye[2]];
    const ids=new Set<string>([districtAt(startEye[0],startEye[2]),...gate.near(bodyAt[0]!,bodyAt[1]!,CHUNK_REACH_EU),...(shotEye?[districtAt(shotEye[0],shotEye[2])]:[])]);
    await Promise.all([...ids].map(id=>loader.load(id,options.signal)));if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  }
  return createRuntime(host,assets,options,startedAt);
}
function createRuntime(host:HTMLElement,assets:HorizonAssets,options:HorizonOptions,startedAt:number){
  const {world,field,journey,cuts}=assets,tier=options.tier,assetLoadedAt=performance.now(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.08,4500);
  // The partition is the definition's (R1-67): districtAt() uses the baked hearts from here on.
  useDefinitionDistricts(world.districts);
  // …and the coastline too: shore tests read the baked outline, not a client re-solve of the manifest.
  useCoastline(world.coastline);
  // R1-72: the chunk under the entry body (page A's eye) is the only geometry fetched before the first frame; the rest
  // streams in behind it, nearest the body first, one chunk at a time, each added to the collision index as it lands.
  const chunks=assets.chunks;
  const bytesBeforeFirstFrame={definition:chunks?.bytes()??assets.definitionBytes,terrain:assets.bytes};
  const geography=createHorizonGeography(field,cuts),figure=createBodyFigure(),partner=createBodyFigure({coat:'#af8760'});
  scene.add(figure.group,partner.group);partner.group.visible=false;
  // Movers (RIDE §10.2, §11 ask 2): one registry, one active controller; the Horizon mode stays 'walk' while riding.
  // One comfort source (v2.2): the land's motion (cuts, the frozen 15:30) and the movers' registry read the same two flags.
  let comfort:HorizonComfort={calm:options.calm===true,reducedMotion:options.reducedMotion===true||appReducedMotion()},motion=horizonMotion(comfort);
  const theme=options.theme??'classic',perspective=createPerspective();
  const registry=createMoverRegistry({world,geography,manifest:HORIZON_MANIFEST,reducedMotion:comfort.reducedMotion,calm:comfort.calm,tier});
  registerHorizonMovers(registry,options.movers);
  const sharedWind=constantWind();
  const waterLevel=(x:number,z:number)=>{let level:number|null=null;for(const w of cuts.waters){if(w.kind==='dry'||w.underground)continue;const h=waterHeightAt(w,x,z);if(h!==null&&(level===null||h>level))level=h;}return level??(geography.ground(x,z)<-.2?0:null);};
  // Hull clearance uses static island geometry. Dynamic yacht collision is queried by people and flight.
  const hullGeography=createHorizonGeography(field,cuts);
  const fleet=createFleet({water:waterLevel,ground:geography.ground,blocked:hullGeography.blocked,ceiling:hullGeography.ceiling,surface:hullGeography.surface,width:world.extent.w,depth:world.extent.h,wind:{sample:(x,y,z,t)=>comfort.calm||comfort.reducedMotion?{dir:0,speed:0}:sharedWind.sample(x,y,z,t)}});
  const offFleet=geography.addDynamic(fleet),fleetArt=createFleetArt(fleet,theme);scene.add(fleetArt.root);
  for(const id of ['kayak','dinghy','motorboat','yacht'] as const)registry.register(id,()=>createWatercraftController(fleet,id));
  const fleetKey=options.fleetStorageKey??'hearth:horizon-fleet:review:v1';
  let fleetRestore:ReturnType<typeof fleet.restore>=null;
  try{fleetRestore=fleet.restore(JSON.parse(localStorage.getItem(fleetKey)??'null'));}catch{/* Unavailable storage starts one default fleet. */}
  let physicalBody:HorizonBody|null=null;
  let fleetLook=0;
  let swimming=false,lastFleetSave=0,fleetSaveFailed=false;
  let lastFleetCutaway='';
  let carriedVelocity={x:0,z:0};
  function saveFleet(){try{localStorage.setItem(fleetKey,JSON.stringify(fleet.snapshot(hold.body??physicalBody??body)));fleetSaveFailed=false;}catch{fleetSaveFailed=true;}}
  function cycleCamera(){cyclePerspective();}
  // Visual occupancy survives a jump or a seat's half-metre offset. Physics still
  // requires actual foot support; this never carries an airborne body.
  function yachtView(){const at=fleet.surface(body.x,body.z,body.y,.1);return at&&body.y-at.y>=-.16&&body.y-at.y<1.35?at:null;}
  function fleetAction(id:string){
    if(mode!=='walk'||paused||registry.active()&&!isCraft(registry.mode()))return false;
    const action=fleet.actions(body).find(a=>a.id===id);if(!action)return false;
    // Validate reach afresh, including button clicks. No remotely supplied helm coordinates.
    if((action.kind==='board'||action.kind==='helm')&&!rideGateOpen()){options.onStatus?.(RIDE_WAITS_STATUS);return false;}
    const result=fleet.act(id,body);if(!result)return false;
    if(result.leave){registry.finish();onFoot(result.body??body,result.message??'On foot.');}
    else if(result.board){const at=result.body!;Object.assign(body,at);registry.accept({id,thresholdId:'fleet.'+id,from:'feet',to:result.board,at:[at.x,at.y,at.z],action:action.label,label:action.label},body,performance.now());startRide();}
    else if(result.body){Object.assign(body,result.body);velocityY=0;}
    clear();physicalBody={...body};requestShadow('fleet-interaction');if(result.message)options.onStatus?.(result.message);saveFleet();return true;
  }
  function fleetActions(){return mode==='walk'&&!paused&&(!registry.active()||isCraft(registry.mode()))?fleet.actions(body):[];}
  function tickFleet(dt:number){
    if(registry.active()&&isCraft(registry.mode())&&!rideGateOpen()){fleet.resetInput();return;}
    const aboard=!registry.active()&&(fleet.support(body)!==null||fleet.sitting()!==null)&&velocityY===0;
    const before={...fleet.yacht},local=aboard?toLocal(before,body):null;
    if(isCraft(registry.mode()))fleet.drive(registry.mode() as CraftId,moverInputFrom({keys,controls,jumpHeld,jumpEdge:jumpRequested,accept:false,look:lookAcc}));
    fleet.step(dt);
    if(local){const p=toWorld(fleet.yacht,local),turn=fleet.yacht.yaw-before.yaw;carriedVelocity={x:(p.x-body.x)/Math.max(.0001,dt),z:(p.z-body.z)/Math.max(.0001,dt)};Object.assign(body,p);body.yaw+=turn;yaw+=turn;}else carriedVelocity={x:0,z:0};
  }
  // R2-01: Look / Island / a page pause the ride where it is; Walk resumes it; a reload / arrive parks at a threshold. A mode never ends in place.
  const hold=createRideHold(registry,world,(x,z)=>geography.ground(x,z));
  const moverArts=new Set<HorizonMoverArt>();
  const removeMoverArt=(art:HorizonMoverArt)=>{if(!moverArts.delete(art))return;scene.remove(art.object);art.dispose?.();};
  let boardProxy:BoardProxy|null=null,consumeJumpUntilRelease=false,jumpHeld=false,acceptRequested=false,lookAcc={dx:0,dy:0},lastOffer:ThresholdOffer|null=null,lastHud:MoverHud|null=null,lastInput:MoverInput|null=null,walkFov:number|null=null,footFov=45,fadeTimer=0,moverActionRequested:'fold'|'pull'|null=null,fadeLabel:{label:string;at:number}|null=null;
  const fadeEl=document.createElement('div');fadeEl.className='horizon-fade';fadeEl.setAttribute('aria-hidden','true');host.appendChild(fadeEl);
  const partnerMaterials:Record<string,THREE.Material>={};partner.group.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])partnerMaterials[material.uuid]=material;});
  const coarse=new Map(world.districts.map(d=>{const cards=buildDistrictCards(world,journey,cuts,d,tier,true);scene.add(cards.group);return[d.id,cards] as const;}));
  const water=buildWaterCards(cuts,tier),ring=buildHorizonRing(assets.horizonCards,tier);scene.add(water.group,ring.group);
  // Horizon cards are fogged like the land but never beyond 70 % (STYLE §1.8), so they never vanish and never poke through.
  for(const material of Object.values(ring.materials)){if('fog'in material)(material as THREE.MeshStandardMaterial).fog=true;fogHook(material,HORIZON_FOG.horizonMaxOpacity);}
  // R2-110: the sky is a dome in view direction whose horizon IS the fog colour (sky/dome.ts), not a screen-space gradient.
  const skyDome=createSkyDome();scene.add(skyDome.mesh);let lastSkyColors:{zenith:string;horizonAway:string;horizonSun:string}|null=null,lastSunDirection:[number,number,number]=[0,1,0];
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
  let night=false,lastLocalLights=-Infinity,lastLightAt:XYZ=[Infinity,0,0],lastSolar={elevation:30,azimuth:180},ambience:WorldAmbience|null=null;
  const shadowRequests:{at:number;reason:string}[]=[];
  function requestShadow(reason:string){renderer.shadowMap.needsUpdate=true;shadowRequests.push({at:performance.now(),reason});if(shadowRequests.length>120)shadowRequests.shift();}
  function updateFog(){const fog=horizonFog({tier,eyeAboveGround:Math.max(0,camera.position.y-geography.ground(camera.position.x,camera.position.z)),elevation:lastSolar.elevation,sunAzimuth:lastSolar.azimuth,heading:yaw*180/Math.PI});scene.fog=mode==='journey'?null:new THREE.Fog(fog.color,fog.near,fog.far);if(lastSkyColors)skyDome.update(lastSkyColors,fog.color,lastSunDirection);}
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
  let comfortCut:ReducedMotionCut|null=null,comfortCutBody:MoverBody|null=null,ambienceSpeed=0;
  // `live`: the walk ↔ ride camera blend (RIDE §10.2). Walking/riding keeps running and the goal (toEye/toTarget) follows the camera ride()/step() set that frame; fov blends to toFov.
  let transition:{eye:THREE.Vector3;target:THREE.Vector3;toEye:THREE.Vector3;toTarget:THREE.Vector3;at:number;duration:number;live?:boolean;fov?:number;toFov?:number}|null=null;
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
  // Wave 6 (P28 A: threshold markers 1.37:1 inside their lamp's warm pool, which was drawn over them): the chalk draws AFTER the
  // pools (transparent pass, renderOrder 4, opacity 1) and a marker's top takes a dark ink, which reads against its lit pool.
  const chalkMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),markerInk=new THREE.Color(NIGHT_LIGHT_CARDS.markerInk),lipChalk=new THREE.Color(NIGHT_LIGHT_CARDS.chalk),faceChalk=new THREE.Color(NIGHT_LIGHT_CARDS.faceChalk),solidsById=new Map((world.geometry?.solids??[]).map(solid=>[solid.id,solid]));
  function buildChalk(d:{solidIds?:string[]}){
    const positions:number[]=[],colors:number[]=[];
    for(const id of d.solidIds??[]){const solid=solidsById.get(id);if(!solid||!CHALK_SOLID.test(solid.id))continue;const faces=CHALK_FACE_SOLID.test(solid.id);const p=tier==='lite'?(solid.litePositions??solid.positions):solid.positions,ix=tier==='lite'?(solid.liteIndices??solid.indices):solid.indices;
      for(let i=0;i<ix.length;i+=3){const a=ix[i]!*3,b=ix[i+1]!*3,c=ix[i+2]!*3,ux=p[b]!-p[a]!,uy=p[b+1]!-p[a+1]!,uz=p[b+2]!-p[a+2]!,vx=p[c]!-p[a]!,vy=p[c+1]!-p[a+1]!,vz=p[c+2]!-p[a+2]!,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,n=Math.hypot(nx,ny,nz);if(n<1e-9)continue;const up=Math.abs(ny/n)>=.6;if(!up&&!(faces&&Math.abs(ny/n)<.45))continue;const col=up?(/(^|\.)marker(\.|@|$)/.test(solid.id)?markerInk:lipChalk):faceChalk,ox=up?0:nx/n*.03,oz=up?0:nz/n*.03;for(const k of [a,b,c]){positions.push(p[k]!+ox,p[k+1]!+(up?.03:0),p[k+2]!+oz);colors.push(col.r,col.g,col.b);}}}
    if(!positions.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,chalkMaterial);mesh.visible=night;mesh.renderOrder=4;return mesh;
  }
  const stream=createDistrictStream(world,d=>{const cards=buildDistrictCards(world,field,cuts,d,tier,false,options.hideBuildings);const hooks=Object.values(cards.materials).map(material=>fogHook(material));const fadeIn=(amount:number)=>{for(const hook of hooks)hook.fade.value=amount;};fadeIn(motion.districtFadeMs>0?0:1);const chalk=buildChalk(d);scene.add(cards.group);if(chalk)scene.add(chalk);requestShadow('district-load');return{cards,chalk,at:performance.now(),fadeIn,dispose(){scene.remove(cards.group);cards.dispose();if(chalk){scene.remove(chalk);chalk.geometry.dispose();}if(coarse.has(d.id))coarse.get(d.id)!.group.visible=true;}};},tier,{ready:id=>!chunks||chunks.ready(id),request:id=>{scheduler?.view([id]);}});
  // Wave 6: one chunk at a time by priority — a walk plan's route (path order), then what the view asked for, then the rest
  // nearest the body; after the first frame every chunk's BYTES are fetched ahead (network only; parsed by priority).
  const nearestFirst=()=>chunks?[...chunks.refs].map(r=>{const d=world.districts.find(q=>q.id===r.districtId)??world.districts.flatMap(q=>q.children??[]).find(q=>q.id===r.districtId),c=d?.heart??d?.outline[0];return{id:r.districtId,d:c?Math.hypot(c[0]-body.x,c[1]-body.z):Infinity};}).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).map(r=>r.id):[];
  const gate=chunks?createChunkGate(chunks,(x,z)=>districtAt(x,z)):null;
  const scheduler=chunks?createChunkScheduler({ready:id=>chunks.ready(id),load:id=>chunks.load(id,options.signal),background:nearestFirst,isDisposed:()=>disposed}):null;
  const chunkHolds:{districts:string[];at:XYZ;t:number;resolved?:'sync'|'arrived'}[]=[];let heldNow:string[]=[];
  function prefetchChunks(){if(!chunks||!scheduler)return;for(const id of nearestFirst())if(!chunks.ready(id))void chunks.fetch(id,options.signal).catch(()=>{});scheduler.startBackground();}
  function routeAhead(points:readonly XYZ[]){if(gate&&scheduler)scheduler.route(gate.along(points));}
  let resnap=false;
  // Wave 6: cables span by span with their anchors (runtime/cableLayer.ts), rebuilt as chunks land.
  const cableLayer=createCableLayer(world,tier,id=>!chunks||chunks.ready(id),xy=>gate?gate.near(xy[0],xy[1],6):[districtAt(xy[0],xy[1])],build=>{for(const material of Object.values(build.materials))fogHook(material);});
  cableLayer.rebuild();scene.add(cableLayer.group);
  const offChunk=chunks?.onLoad((_id,solids)=>{if(!disposed){for(const solid of solids)solidsById.set(solid.id,solid);geography.addSolids(solids);hullGeography.addSolids(solids);cableLayer.rebuild();requestShadow('chunk-load');if(resnap&&gate&&!gate.missingAt(body.x,body.z).length){resnap=false;const at=geography.surface(body.x,body.z,body.y+HORIZON_BODY_HEIGHT);if(at)body.y=at.y;}}});
  /** The gate: resident (true) or held (false). Bytes already fetched are parsed now; the review simulation may block. */
  function gateOpen(x:number,z:number):boolean{
    if(!gate||!chunks)return true;
    const missing=gate.missingAt(x,z),at:XYZ=[x,body.y,z],t=performance.now(),hold=(h:typeof chunkHolds[number])=>{chunkHolds.push(h);if(chunkHolds.length>200)chunkHolds.shift();};
    if(!missing.length){if(heldNow.length)hold({districts:heldNow,at,t,resolved:'arrived'});heldNow=[];return true;}
    for(const id of missing)chunks.loadSync(id,simulating&&HARBOUR_DEV);
    const still=gate.missingAt(x,z);
    if(!still.length){hold({districts:missing,at,t,resolved:'sync'});heldNow=[];return true;}
    if(heldNow.join()!==still.join()){heldNow=still;hold({districts:still,at,t});}
    scheduler?.route([...still,...scheduler.queued().route]);return false;
  }
  // v2.2 ride rule (chunkGate.ts createRideGate): a feet → mover offer is taken only with every chunk resident; until then
  // it is held (the offer stays on show, a status line says why) and boards by itself when the last chunk lands.
  const rideGate=createRideGate<ThresholdOffer>(chunks);
  /** Every chunk resident (fetched bytes are parsed now; `blocking` — the review-only attach — may wait synchronously). */
  function rideGateOpen(blocking=false):boolean{
    if(!chunks)return true;
    let missing=rideGate.missing();if(!missing.length)return true;
    for(const id of missing)chunks.loadSync(id,blocking&&HARBOUR_DEV);
    missing=rideGate.missing();if(!missing.length)return true;
    scheduler?.route([...missing,...scheduler.queued().route]);return false;
  }
  function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(mode==='look'&&!transition){const pose=world.views.find(p=>p.id===shotId);if(pose)lookAt(pose);}}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function setLight(date:Date){
    const position=solarPosition(date),colors=skyGradient(position.elevation),lookHeight=camera.position.y-geography.ground(camera.position.x,camera.position.z),fog=horizonFog({tier,eyeAboveGround:Math.max(0,lookHeight),elevation:position.elevation,sunAzimuth:position.azimuth,heading:yaw*180/Math.PI}),floor=nightLight(position.elevation,colors);
    lastSolar=position;night=floor.lightCards;faceCardsLit=faceCardOn(position,comfort.calm);faceCards.visible=faceCardsLit&&mode!=='journey';lastLocalLights=-Infinity;lastLightAt=[Infinity,0,0];
    lastSkyColors=nightDome(colors,floor.nightness);lastSunDirection=[position.direction[0],position.direction[1],position.direction[2]];skyDome.update(lastSkyColors,fog.color,lastSunDirection);
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
  function shot(id:string){if(mode==='walk')physicalBody={...body};const pose=world.views.find(p=>p.id===id);if(!pose)return false;pauseRide();shotId=id;mode='look';path=[];transition=null;lookAt(pose);body.x=pose.eye[0];body.z=pose.eye[2];body.y=pose.eye[1]-1.6;body.yaw=yaw;lastSun=-Infinity;return true;}
  function restore(saved:HouseBodyReturn){
    fleet.stand();physicalBody=null;parkRide();if(transition?.live)transition=null;rideGate.clear();
    const next=restoreHorizonPosition(saved,world.pathGraph!,geography.ground,(x,z,y)=>{const at=geography.surface(x,z,y+.5,HORIZON_RESTORE_TOLERANCE);return at&&at.slope<=HORIZON_WALKABLE_DEGREES&&!geography.submerged(x,z,at.y)&&!geography.blocked(x,z,at.y)?{standY:at.y}:null;});
    Object.assign(body,{x:next.x,y:next.y!,z:next.z,yaw:next.yaw});yaw=body.yaw;mode='walk';path=[];velocityY=0;
    // Wave 6: a restore into ground whose chunk has not arrived stands and waits; the body is re-seated when it lands.
    if(!gateOpen(body.x,body.z))resnap=true;updateCamera();
  }

  /** While riding, a reload restores on foot at the nearest threshold of the mode (RIDE §6.5). */
  function savedBody():HouseBodyReturn{saveFleet();const physical=hold.body??physicalBody??body;const at=registry.active()&&!isCraft(registry.mode())?savedRideBody(world,physical,registry.mode(),geography.ground):physical;return{x:at.x,y:at.y,z:at.z,yaw:at.yaw,place:'court',world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY};}
  // ---- The mover hook ----
  function fadeCut(label:string){
    // The mover has already moved the body: show black at once and fade back in (300 ms); a cut under reduced motion / calm.
    const ms=moverFadeMs(comfort.reducedMotion,comfort.calm);if(label)options.onStatus?.(label);if(!ms)return;
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
  function syncEquipment(){
    if(registry.mode()==='board'||registry.mode()==='bicycle'||registry.stowed()==='board')mountBoardProxy();else unmountBoardProxy();
  }
  function beginAirborne(at:AirborneBody,open:boolean){
    if(!registry.deploy(at,performance.now(),open))return false;
    velocityY=0;jumpRequested=false;consumeJumpUntilRelease=keys.has(' ')||jumpHeld;
    startRide();return true;
  }
  /** The figure over the deck: it faces the travel (body.yaw + slip), feet on the deck top; the deck keeps the nose heading, pitch and roll in world space and stays on the ground under a crouch. */
  const proxyTurn=new THREE.Quaternion(),proxyEuler=new THREE.Euler(0,0,0,'YXZ'),figureInverse=new THREE.Quaternion();
  function poseRider(pose:MoverFrame['pose'],active:ModeController,now:number){
    if(isCraft(active.id)){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.set(0,body.yaw,0);figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:active.id==='yacht'?'wave':'sit',emoteAt:1,flourish:0});return;}
    const stowed=active.id==='parachute'&&registry.stowed()==='board';
    const slip=riderSlip(pose,active),drop=Math.max(0,pose.crouch)*.25,lift=boardProxy&&!stowed?BOARD_PROXY.top:0;
    figure.group.position.set(body.x,body.y+lift-drop,body.z);figure.group.rotation.set(0,body.yaw+slip,-pose.lean);
    figure.pose(now*.007,0,now/1000);   // riding: no walk cycle
    if(!boardProxy)return;
    const scale=figure.group.scale.x||1;
    if(stowed){boardProxy.group.position.set(0,.55,-.25).divideScalar(scale);boardProxy.group.rotation.set(Math.PI/2,0,0);boardProxy.group.scale.setScalar(1/scale);return;}
    figureInverse.copy(figure.group.quaternion).invert();
    boardProxy.group.quaternion.copy(figureInverse).multiply(proxyTurn.setFromEuler(proxyEuler.set(-pose.pitch,body.yaw,-pose.roll,'YXZ')));
    boardProxy.group.position.set(0,drop-lift,0).applyQuaternion(figureInverse).divideScalar(scale);
    boardProxy.group.scale.setScalar(1/scale);
  }
  function onFoot(at:MoverBody|null,status:string,cut=false){
    if(cut)transition=null;else blendCamera(moverBlendMs('park',comfort.reducedMotion,comfort.calm),walkFov??camera.fov);unmountBoardProxy();
    if(at){Object.assign(body,{x:at.x,y:at.y,z:at.z,yaw:at.yaw});yaw=body.yaw;}
    velocityY=0;path=[];jumpRequested=false;consumeJumpUntilRelease=keys.has(' ')||jumpHeld;figure.group.rotation.set(0,body.yaw,0);figure.group.position.set(body.x,body.y,body.z);
    if(walkFov!==null){camera.fov=walkFov;camera.updateProjectionMatrix();walkFov=null;}
    comfortCut=null;comfortCutBody=null;ambienceSpeed=0;lastHud=null;options.onMoverHud?.(null);options.onStatus?.(status);updateCamera();
  }
  function openComfortCut(at:MoverBody={...body}){
    const active=registry.active(),cut=active?.reducedMotionCut?.();
    // Falls keep player control with the comfort camera; a destination cut would teleport an ordinary jump.
    if(!active||active.id==='parachute'||!cut)return false;
    comfortCut=cut;comfortCutBody={...at};options.onStatus?.('Choose where to continue.');return true;
  }
  /** The app's comfort, live, for the land and the movers at once (Stage A + main #552; the stricter rule wins): reduced motion
   *  makes every camera change a cut (Look/Island, districts, mover pick-up/park, fades) and a ride a cut to a chosen place;
   *  calm freezes 15:30 (no night, no light cards), nothing moves on its own, and the movers are silent. */
  function applyComfort(next:Partial<HorizonComfort>){
    const was=comfort;
    comfort={calm:next.calm??comfort.calm,reducedMotion:(next.reducedMotion??comfort.reducedMotion)||appReducedMotion()};
    registry.setReducedMotion(comfort.reducedMotion);registry.setCalm(comfort.calm);
    if(comfort.calm){faceCardsLit=false;faceCards.visible=false;}
    motion=horizonMotion(comfort);
    if(motion.transitionMs<=0&&transition&&!transition.live){camera.position.copy(transition.toEye);target.copy(transition.toTarget);camera.lookAt(target);transition=null;}
    if(!comfortCut&&(comfort.reducedMotion&&!was.reducedMotion||comfort.calm&&!was.calm))openComfortCut();
    lastSun=-Infinity;
  }
  function acceptOffer(offer:ThresholdOffer){
    const riding=registry.active()!==null,name=registry.mode(),acceptedBody={...body};
    // v2.2: boarding waits for the island's chunks (parking never waits); the held offer boards from offersAndAccept.
    if(!riding&&offer.to!=='feet'&&(rideGateOpen(),!rideGate.request(offer))){options.onStatus?.(RIDE_WAITS_STATUS);return false;}
    if(!registry.accept(offer,{...body},performance.now()))return false;
    if(offer.to==='feet')onFoot(registry.lastExit(),`Parked the ${name} at ${offer.thresholdId}.`);
    else {if(!riding)startRide();if(comfort.reducedMotion||comfort.calm)openComfortCut(acceptedBody);}
    return true;
  }
  /** Pick-up: save the walk FOV, blend the camera to the mover's (0.8 s; a cut under reduced motion / calm), show the deck. */
  function startRide(){if(isCraft(registry.mode()))clear();if(walkFov===null)walkFov=footFov;path=[];blendCamera(moverBlendMs('pickup',comfort.reducedMotion,comfort.calm),camera.fov);syncEquipment();options.onStatus?.(isCraft(registry.mode())?'W accelerates; S slows then reverses. A/D steer; Space brakes; E interacts. C changes camera.':registry.mode()==='parachute'?'Airborne. Space opens or retracts the parachute.':RIDING_STATUS);}
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
    const ms=moverBlendMs('pickup',comfort.reducedMotion,comfort.calm);if(!ms)transition=null;   // a cut also drops a Look/Island transition still running
    blendCamera(ms,camera.fov);options.onStatus?.(RIDING_STATUS);return true;
  }
  /** A reload / arrive while riding: the mode ends at the saved-body rule's `mode→feet` threshold through `registry.accept` (the controller exits and is disposed). */
  function parkRide(){
    if(!registry.active())return;
    if(isCraft(registry.mode())){const at=hold.resume()??{...body};clear();registry.finish();onFoot(at,'Boat left here.');return;}
    const name=registry.mode(),parked=hold.park({...body},performance.now());
    onFoot(parked?.body??null,parked?`Parked the ${name} at ${parked.offer.thresholdId}.`:`The ${name} is put away.`);
  }
  function currentInput(accept:boolean):MoverInput{
    const action=moverActionRequested;moverActionRequested=null;
    return {...moverInputFrom({keys,controls,jumpHeld,jumpEdge:jumpRequested,accept,look:lookAcc}),...(action?{action}:{})};
  }
  function ride(dt:number,now:number,accept:boolean){
    let active=registry.active()!,transferred=false;const edge=jumpRequested;const input=currentInput(accept);jumpRequested=false;lookAcc={dx:0,dy:0};
    if(edge&&!consumeJumpUntilRelease&&active.id!=='parachute'){
      const at=active.airborne?.();if(at&&beginAirborne(at,true)){active=registry.active()!;transferred=true;input.jump=false;input.action=undefined;}
    }
    if(active.id==='parachute')input.jump=!transferred&&edge&&!consumeJumpUntilRelease;
    else if(consumeJumpUntilRelease)input.jump=false;
    lastInput=input;
    if(isCraft(active.id))fleetLook+=input.look.dx;
    const f=active.update(dt,input,now);
    Object.assign(body,{x:f.body.x,y:f.body.y,z:f.body.z,yaw:f.body.yaw});yaw=f.body.yaw;
    ambienceSpeed=f.pose.speed;
    const wet=waterLevel(body.x,body.z),deck=fleet.surface(body.x,body.z,body.y,.1);
    const waterExit=active.id==='parachute'&&active.finished?.()&&wet!==null&&body.y<=wet+.2&&!deck&&fleet.vessels.some(v=>Math.hypot(body.x-v.x,body.z-v.z)<(v.id==='yacht'?85:30));
    if(f.fade&&!waterExit){fadeLabel={label:f.fade.label,at:performance.now()};fadeCut(f.fade.label);if(transition?.live)transition=null;}   // the mover snapped its camera with the body: no blend across a fade
    if(f.camera){camera.position.set(...f.camera.eye);target.set(...f.camera.target);camera.lookAt(target);if(transition?.live)transition.toFov=f.camera.fov;else if(Math.abs(camera.fov-f.camera.fov)>1e-3){camera.fov=f.camera.fov;camera.updateProjectionMatrix();}}
    else updateCamera();
    poseRider(f.pose,active,now);
    if(!sameHud(lastHud,f.hud)){lastHud={...f.hud};options.onMoverHud?.(lastHud);}
    options.onMoverSound?.(f.sound);
    if(ambience&&!comfort.calm){if(f.sound.bite)ambience.snap();if(f.sound.boost)ambience.splashEcho();ambience.vario(f.hud.lift??0);}
    if(active.finished?.()){
      const impact={...body},out=registry.finish();
      if(waterExit){onFoot({...impact,y:wet!-.5},'Swimming. Move toward the stern ladder to climb aboard.',true);swimming=true;}
      else if(registry.active()){
        jumpRequested=false;consumeJumpUntilRelease=keys.has(' ')||jumpHeld;syncEquipment();
        blendCamera(moverBlendMs('park',comfort.reducedMotion,comfort.calm),camera.fov);
        options.onStatus?.('Landed. Riding on with the board.');
      }else if(out)onFoot(out,fadeLabel?.label??`Landed. ${registry.stowed()?'Board stowed. ':''}Space jumps.`,!!f.fade);
    }
  }
  /** Offers and the E / Enter edge, once per frame. Returns whether the edge is still unspent (for the mover's `accept`). */
  function offersAndAccept():boolean{
    const offer=mode==='walk'&&(!transition||transition.live)?offerToShow(registry.offers(body),registry.canAccept):null;
    if(!sameOffer(offer,lastOffer)){lastOffer=offer;options.onOffer?.(offer);}
    // A held boarding stays held while the rider is still at its threshold (a Walk camera tween or a paused frame hides the offer
    // row, not the offer); it boards once every chunk is in, and is dropped only when its offer is no longer there.
    const held=rideGate.pending();
    if(held&&mode==='walk'){rideGateOpen();const here=registry.offers(body).find(o=>o.id===held.id)??null,go=rideGate.poll(here);if(go&&acceptOffer(go)){acceptRequested=false;return false;}}
    if(!acceptRequested)return false;acceptRequested=false;
    const boatAction=fleetActions()[0];if(boatAction&&fleetAction(boatAction.id))return false;
    if(offer&&acceptOffer(offer))return false;
    if(registry.active())return true;
    enterDoor();return false;
  }
  function enterDoor(hostId?:string){if(registry.active())return false;   // a rider parks first: a door is not a mode threshold
    const h=hostId?world.hosts.find(h=>h.id===hostId):world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<2.4);if(!h)return false;
    doorCooldown=performance.now()+1800;const out=h.returnAt;if(out){Object.assign(body,{x:out[0],y:out[1],z:out[2],yaw:h.facing??0});yaw=body.yaw;}path=[];options.onDoor?.(h,savedBody());return true;
  }
  function setMode(next:HorizonMode){
    if(next!=='walk'){if(mode==='walk')physicalBody={...body};pauseRide();}
    else if(!registry.active()&&physicalBody){Object.assign(body,physicalBody);yaw=body.yaw;physicalBody=null;}
    else if(registry.active()){resumeRide();mode='walk';path=[];updateFog();return;}   // riding: no walk-camera transition, the mover camera blends back (a cut under reduced motion / calm)
    const fromEye=camera.position.clone(),fromTarget=target.clone();mode=next;path=[];faceCards.visible=faceCardsLit&&mode!=='journey';
    if(next==='journey'){const {w,h}=world.extent;camera.position.set(w/2,w*1.05,h*1.17);target.set(w/2,20,h*.47);camera.lookAt(target);camera.fov=50;camera.updateProjectionMatrix();}
    else if(next==='look')shot(shotId);
    else if(next==='walk'){footFov=camera.fov;if(!gateOpen(body.x,body.z))resnap=true;const at=geography.surface(body.x,body.z,body.y);if(at&&at.slope<=HORIZON_WALKABLE_DEGREES)body.y=at.y;distance=9;pitch=-.26;updateCamera();}
    transition={eye:fromEye,target:fromTarget,toEye:camera.position.clone(),toTarget:target.clone(),at:performance.now(),duration:motion.transitionMs};
    // Reduced motion: a cut, never a tween (CONTRACT §2.10).
    if(transition.duration<=0){const to=transition;transition=null;camera.position.copy(to.toEye);target.copy(to.toTarget);}else{camera.position.copy(fromEye);target.copy(fromTarget);}camera.lookAt(target);
    updateFog();
  }
  function cyclePerspective(){if(mode!=='walk')return;perspective.cycle(body,camera.position.toArray(),target.toArray());transition=null;options.onStatus?.(`${perspectiveLabel(perspective.mode())}. C changes the view.`);}
  function updateCamera(){if(mode!=='walk')return;
    if(!registry.active()&&camera.fov!==footFov){camera.fov=footFov;camera.updateProjectionMatrix();}
    const craft=isCraft(registry.mode())?fleet.get(registry.mode() as CraftId):null;
    const aboard=yachtView()!==null;
    const trail=craft?HANDLING[craft.id].camera:aboard?6.5:distance;
    const heading=craft?craft.yaw+fleetLook:yaw;
    const eye:XYZ=[body.x,body.y+(craft?.id==='kayak'?.95:1.15),body.z];
    const desired:XYZ=[eye[0]-Math.sin(heading)*trail,eye[1]+(craft?.id==='yacht'?10:aboard?7:Math.max(1,-Math.sin(pitch)*trail)),eye[2]-Math.cos(heading)*trail];
    let f=1;while(f>.06&&geography.cameraBlocked(eye,[eye[0]+(desired[0]-eye[0])*f,eye[1]+(desired[1]-eye[1])*f,eye[2]+(desired[2]-eye[2])*f],aboard))f-=.04;
    camera.position.set(eye[0]+(desired[0]-eye[0])*f,eye[1]+(desired[1]-eye[1])*f,eye[2]+(desired[2]-eye[2])*f);target.set(...eye);camera.lookAt(target);
  }
  let held=false,leftSupport=false;
  function move(dx:number,dz:number,_dt:number){
    const length=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(length/.15));let moved=0;held=false;leftSupport=false;
    for(let i=0;i<steps;i++){
      const x=body.x+dx/steps,z=body.z+dz/steps;if(!gateOpen(x,z)){held=true;break;}
      if(x<.4||z<.4||x>world.extent.w-.4||z>world.extent.h-.4)break;
      const hit=geography.surface(x,z,body.y,.48),wet=waterLevel(x,z),water=wet!==null&&(!hit||hit.y<wet-.3);
      const height=hit&&!water&&velocityY===0?Math.max(body.y,hit.y):body.y;
      const obstacle=geography.blocker(x,z,height,.3,[dx/steps,dz/steps]);
      if(obstacle||hit&&!water&&hit.slope>HORIZON_WALKABLE_DEGREES){lastMovementBlocker={at:[x,body.y,z],surface:hit,obstacle,water};break;}
      body.x=x;body.z=z;
      if(!swimming&&(!hit||body.y-hit.y>.48||water)){moved+=length/steps;leftSupport=true;break;}
      if(velocityY===0&&hit&&!water&&Math.abs(body.y-hit.y)<=.5)body.y=hit.y;
      moved+=length/steps;
    }return moved;
  }
  function step(dt:number,now:number){
    leftSupport=false;
    if(fleet.sitting()){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:'sit',emoteAt:1,flourish:0});updateCamera();return;}
    const at=geography.surface(body.x,body.z,body.y,.1),water=waterLevel(body.x,body.z);
    swimming=water!==null&&body.y<=water-.3&&(!at||at.y<water-.3);
    let forward=controls.forward+(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),strafe=controls.strafe+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    let dx=Math.sin(yaw)*forward+Math.cos(yaw)*strafe,dz=Math.cos(yaw)*forward-Math.sin(yaw)*strafe;
    if(dx||dz)path=[];else if(path.length){const p=path[0]!;dx=p[0]-body.x;dz=p[2]-body.z;if(Math.hypot(dx,dz)<.35){path.shift();dx=0;dz=0;}}
    const length=Math.hypot(dx,dz),speed=swimming?2.4:controls.run||keys.has('shift')?HORIZON_MANIFEST.speeds_ms.run:HORIZON_MANIFEST.speeds_ms.walk;
    const before={x:body.x,z:body.z};
    let moved=0;if(length){dx=dx/length*Math.min(1,length)*speed*dt;dz=dz/length*Math.min(1,length)*speed*dt;body.yaw=Math.atan2(dx,dz);moved=move(dx,dz,dt);if(path.length&&moved<.001&&!held)path=[];}
    const floor=geography.surface(body.x,body.z,body.y,.02),wet=waterLevel(body.x,body.z);
    swimming=wet!==null&&body.y<=wet-.3&&(!floor||floor.y<wet-.3);
    const unsupported=leftSupport||!floor||body.y-floor.y>.05;
    if(!swimming&&(unsupported||jumpRequested&&!consumeJumpUntilRelease)){
      const vx=(dt>0?(leftSupport?dx:body.x-before.x)/dt:0)+carriedVelocity.x,vz=(dt>0?(leftSupport?dz:body.z-before.z)/dt:0)+carriedVelocity.z;
      if(beginAirborne({...body,velocity:[vx,unsupported?0:4.2,vz]},false))return;
    }
    if(swimming&&wet!==null)body.y=wet-.5;
    jumpRequested=false;
    if(moved>0&&now>doorCooldown&&!swimming){const door=world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<1.15);if(door)enterDoor(door.id);}
    if(!simulating){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;figure.pose(now*.007,moved>0?1:0,now/1000);updateCamera();}
  }
  function tick(now:number){if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-(last||now))/1000));if(last)frameTimes.push(now-last);if(frameTimes.length>3600)frameTimes.shift();last=now;
    let stepped=false;
    if(!paused&&mode==='walk'&&!hold.paused()){physicalBody=null;tickFleet(dt);}
    if(!paused){const accept=comfortCut?false:offersAndAccept();if(mode==='walk'&&(!transition||transition.live)){stepped=true;if(registry.active()){if(!comfortCut&&hold.steps(mode))ride(dt,now,accept);}else if(!comfortCut)step(dt,now);}if(mode!=='journey')stream.update({x:body.x,z:body.z,now,mode:mode==='look'?'look':'walk',radius:mode==='look'?world.views.find(v=>v.id===shotId)?.radius:undefined,keepRadius:world.views.find(v=>v.id===shotId)?.radius,underground:body.y+HORIZON_BODY_HEIGHT<geography.ground(body.x,body.z)-.5});}
    if(ambience){if(paused)ambience.pause();else ambience.update(body.x,body.y,body.z,ambienceSpeed,false,false,comfort.calm,registry.mode()==='glider'||registry.mode()==='parachute');}
    for(const art of [...moverArts])if(!art.tick(dt,figure.group))removeMoverArt(art);
    ring.updateResidency(new Set(stream.live.keys()),mode==='journey');cableLayer.update(new Set(stream.live.keys()),mode==='journey');
    // Fine districts rise from the fog colour over 0.8 s (a cut under reduced motion); the coarse card they replace hides at once.
    for(const resource of stream.live.values()){resource.cards.group.visible=mode!=='journey';if(resource.chalk)resource.chalk.visible=night&&mode!=='journey';resource.fadeIn(motion.districtFadeMs>0?Math.min(1,Math.max(0,(now-resource.at)/motion.districtFadeMs)):1);}
    for(const [id,cards]of coarse)cards.group.visible=mode==='journey'||!stream.live.has(id);
    if(transition){
      if(transition.live&&stepped){transition.toEye.copy(camera.position);transition.toTarget.copy(target);}   // ride()/step() just set this frame's goal camera
      const t=transition.duration>0?Math.min(1,Math.max(0,(now-transition.at)/transition.duration)):1,ease=transition.live?moverBlendEase(now-transition.at,transition.duration):t*t*(3-2*t);
      camera.position.lerpVectors(transition.eye,transition.toEye,ease);target.lerpVectors(transition.target,transition.toTarget,ease);camera.lookAt(target);
      if(transition.fov!==undefined&&transition.toFov!==undefined){const fov=transition.fov+(transition.toFov-transition.fov)*ease;if(Math.abs(camera.fov-fov)>1e-3){camera.fov=fov;camera.updateProjectionMatrix();}}
      if(t===1)transition=null;
    }
    const chosen=mode==='walk'?perspective.pose(body,(a,b)=>geography.cameraBlocked(a,b,yachtView()!==null),geography.ceiling(body.x,body.z,body.y)):null;
    if(chosen){camera.position.set(...chosen.eye);target.set(...chosen.target);camera.fov=chosen.fov;camera.updateProjectionMatrix();camera.lookAt(target);}
    const firstPerson=mode==='walk'&&perspective.mode()==='first-person';
    figure.group.visible=mode==='walk'&&!firstPerson;
    // Own equipment is hidden locally in first person; activity and floating retain the full canopy.
    for(const art of moverArts)if(firstPerson)art.object.visible=false;
    fleetArt.update(body,yachtView()!==null,mode==='journey',!firstPerson,yachtView()?.y);
    const cutawayKey=`${yachtView()?Math.floor(yachtView()!.y-fleet.yacht.y):'outside'}:${perspective.mode()}:${mode}`;if(cutawayKey!==lastFleetCutaway){lastFleetCutaway=cutawayKey;requestShadow('fleet-cutaway');}
    if(now-lastFleetSave>2000){lastFleetSave=now;saveFleet();}
    const peer=horizonPartnerPose(options.partner?.());partner.group.visible=Boolean(peer)&&mode!=='journey';if(peer){fade(partnerMaterials,peer.opacity);partner.group.position.set(peer.x,peer.y??geography.ground(peer.x,peer.z),peer.z);partner.group.rotation.y=peer.yaw;partner.pose(motion.ambientMotion?now*.007:0,peer.moving?1:0,motion.ambientMotion?now/1000:0);}
    // Calm and reduced motion hold the frozen 15:30 (no night, no sun step); a review date never overrides them.
    if(now-lastSun>=60_000){setLight(motion.sunFollowsClock&&currentTime?currentTime:solarReviewDate(new Date(),location.search,{dev:HARBOUR_DEV,reducedMotion:comfort.reducedMotion,calm:comfort.calm}));lastSun=now;}
    updateLocalLights(now);
    skyDome.follow(camera);renderer.render(scene,camera);if(interactiveAt===null){interactiveAt=performance.now();options.onReady?.();void prefetchChunks();}if(drawSamples.length===0||now-drawSamples.at(-1)!.at>500){drawSamples.push({at:now,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resident:stream.live.size});if(drawSamples.length>600)drawSamples.shift();}schedule();
  }
  function schedule(){if(!disposed&&lease.active)frame=lease.requestFrame(tick);}
  const offers=()=>mode==='walk'&&!paused?registry.offers(body):[];
  function acceptPublic(offer?:ThresholdOffer):HorizonAccept|null|void{
    if(!offer){acceptRequested=true;return;}
    if(!registry.canAccept(offer)||!acceptOffer(offer))return null;
    return{mode:registry.mode(),controller:registry.active(),cut:comfortCut};
  }
  function cutTo(to:HorizonCutTarget){
    if(to.kind==='view'){
      const holdAt=comfortCutBody,out=registry.finish();
      if(out||holdAt)onFoot(holdAt??out,'Flight paused.');
      return shot(to.id);
    }
    if(to.kind==='landing'){
      const at={x:to.landing.xy[0],y:to.landing.height??geography.ground(to.landing.xy[0],to.landing.xy[1]),z:to.landing.xy[1],yaw:body.yaw};
      registry.finish();onFoot(at,`→ ${to.landing.label}`);return true;
    }
    const holdAt=comfortCutBody,out=registry.finish();
    if(out||holdAt)onFoot(holdAt??out,'Stayed at the accepted threshold.');
    return true;
  }
  const interactive=(event:KeyboardEvent)=>event.composedPath().some(t=>t instanceof Element&&Boolean(t.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[role="textbox"]')));
  function keyDown(e:KeyboardEvent){if(paused||interactive(e)||!host.contains(document.activeElement))return;const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' '].includes(key)){e.preventDefault();keys.add(key);if(key===' '&&!e.repeat&&!consumeJumpUntilRelease)jumpRequested=true;}if(key==='c'&&!e.repeat){e.preventDefault();cyclePerspective();}if(key==='q'&&!e.repeat&&fleetActions().some(a=>a.kind==='anchor')){e.preventDefault();fleetAction('anchor');return;}if(key==='e'){e.preventDefault();if(!e.repeat)acceptRequested=true;}if(key==='escape')path=[];}
  function keyUp(e:KeyboardEvent){keys.delete(e.key.toLowerCase());if(e.key===' '){consumeJumpUntilRelease=false;jumpHeld=false;}}
  function clear(){keys.clear();controls={forward:0,strafe:0,run:false};path=[];drag=null;jumpHeld=false;jumpRequested=false;moverActionRequested=null;consumeJumpUntilRelease=false;acceptRequested=false;lookAcc={dx:0,dy:0};fleet.resetInput();}
  const unlisten=[lease.listenCanvas<PointerEvent>('pointerdown',e=>{if(paused)return;host.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,id:e.pointerId,travel:0};renderer.domElement.setPointerCapture(e.pointerId);}),lease.listenCanvas<PointerEvent>('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.travel+=Math.hypot(dx,dy);drag.x=e.clientX;drag.y=e.clientY;if(perspective.mode()!=='activity'&&mode==='walk')perspective.look(-dx*.005,-dy*.004);
      else{lookAcc.dx-=dx*.005;lookAcc.dy-=dy*.004;yaw-=dx*.005;pitch=Math.max(-1.2,Math.min(.8,pitch-dy*.004));}if(mode==='look'){target.set(camera.position.x+Math.sin(yaw)*Math.cos(pitch)*distance,camera.position.y+Math.sin(pitch)*distance,camera.position.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);}}),lease.listenCanvas<PointerEvent>('pointerup',e=>{const click=drag&&drag.travel<5;drag=null;if(!click||mode!=='walk'||paused||registry.active())return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObjects([...stream.live.values()].map(r=>r.cards.group),true);const hit=hits[0];if(hit){const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],[hit.point.x,hit.point.y,hit.point.z],{stepFree:true});if(plan){path=[...plan.points];routeAhead(plan.points);}else options.onStatus?.('No connected walking route reaches that point.');}}),lease.listenCanvas<WheelEvent>('wheel',e=>{if(paused)return;e.preventDefault();if(perspective.mode()==='floating'&&mode==='walk')perspective.zoom(e.deltaY);else distance=Math.max(2,Math.min(45,distance*Math.exp(e.deltaY*.001)));updateCamera();},{passive:false})];
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clear);host.addEventListener('blur',clear);
  shot(new URLSearchParams(location.search).get('shot')??'A');if(options.initialBody)restore(options.initialBody);
  if(fleetRestore){Object.assign(body,fleetRestore.body);yaw=body.yaw;mode='walk';if(fleetRestore.pilot){const id=fleetRestore.pilot;registry.accept({id:'restore-fleet',thresholdId:'fleet-restore',from:'feet',to:id,at:[body.x,body.y,body.z],action:'Resume boat',label:'Resume boat'},body,performance.now());startRide();}updateCamera();}
  window.addEventListener('pagehide',saveFleet);resize();schedule();
  const api={world,assets,scene,camera,geography,shot,setMode,restore,savedBody,enterDoor,
    /** Development replay uses the exact live controllers/collision without waiting for rendered frames. */
    simulateMotion(seconds:number){if(!HARBOUR_DEV)throw new Error('Development replay only.');const steps=Math.ceil(Math.max(0,Math.min(120,seconds))*60);for(let i=0;i<steps;i++){if(paused||mode!=='walk'||hold.paused())break;physicalBody=null;tickFleet(1/60);if(registry.active())ride(1/60,performance.now()+i*1000/60,false);else step(1/60,performance.now()+i*1000/60);}fleetArt.update(body,yachtView()!==null,mode==='journey',perspective.mode()!=='first-person',yachtView()?.y);return{body:{...body},vessels:fleet.snapshot().vessels};},
    fleetActions,fleetAction,cycleCamera,fleetState:()=>({vessels:fleet.snapshot().vessels,swimming,perspective:perspective.mode(),sitting:fleet.sitting(),saveFailed:fleetSaveFailed}),
    arrive(hostId:string){const h=world.hosts.find(h=>h.id===hostId);if(!h||!h.returnAt)return false;restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:h.returnAt[0],y:h.returnAt[1],z:h.returnAt[2],yaw:(h.facing??0)+Math.PI});return true;},
    simulateWalk(seconds:number){if(!HARBOUR_DEV)throw new Error('Simulation is a review-only control.');const count=Math.ceil(Math.max(0,Math.min(seconds,3600))/.05);simulating=true;try{for(let i=0;i<count&&path.length;i++)step(.05,performance.now()+i*50);}finally{simulating=false;updateCamera();}return{body:{...body},remaining:path.length,blocker:lastMovementBlocker};},
    body:()=>({...body}),mode:()=>mode,shotId:()=>shotId,
    settings:()=>({tier,reducedMotion:comfort.reducedMotion,calm:comfort.calm,theme}),reviewDate:()=>(motion.sunFollowsClock&&currentTime?currentTime:solarReviewDate(new Date(),location.search,{dev:HARBOUR_DEV,reducedMotion:comfort.reducedMotion,calm:comfort.calm})),setAmbience(audio:WorldAmbience|null){ambience=audio;},
    offers,
    moverState():HorizonMoverState{const fade=fadeLabel&&performance.now()-fadeLabel.at<HORIZON_FADE_LABEL_MS?fadeLabel.label:undefined;return{mode:registry.mode(),attached:registry.active()!==null,hud:lastHud,airborne:registry.mode()==='parachute'||!!registry.active()?.airborne?.(),stowed:registry.stowed(),perspective:perspective.mode(),...(fade?{fade}:{}),cut:comfortCut};},
    moverAction(action:'fold'|'pull'|'gate'){
      if(action==='pull'&&registry.mode()!=='parachute'){
        const at=registry.active()?.airborne?.();if(at)beginAirborne(at,true);else options.onStatus?.('Open the parachute while airborne.');
      }else if(action==='fold'||action==='pull')moverActionRequested=action;
    },
    cyclePerspective,
    resumeEquipment(){if(registry.resumeStowed({...body,velocity:[0,0,0]})){startRide();return true;}options.onStatus?.('Carry the board to a rideable surface.');return false;},
    airspaceReady:(x:number,z:number)=>gateOpen(x,z),
    moverArt(object:THREE.Object3D,tick:(dt:number,figure:THREE.Object3D)=>boolean,dispose?:()=>void){const art:HorizonMoverArt={object,tick,dispose};moverArts.add(art);scene.add(object);return()=>removeMoverArt(art);},
    // ---- movers (track I) ----
    registry,
    /** The input the active mover would read this frame (after a riding frame: the one it did read). */
    moverInput():MoverInput{return lastInput&&registry.active()?{...lastInput,look:{...lastInput.look}}:currentInput(acceptRequested);},
    /** Review only (HARBOUR_DEV, R2-14): make `controller` the active mode as if `offer` had been accepted here. Refused while riding (park first). */
    attachMover(controller:ModeController,offer:ThresholdOffer){if(!HARBOUR_DEV)throw new Error('attachMover is a review-only control.');const at={...body};if(!rideGateOpen(true))return false;if(!registry.attach(controller,offer,at,performance.now()))return false;mode='walk';path=[];startRide();if(comfort.reducedMotion||comfort.calm)openComfortCut(at);return true;},
    /** Review only (HARBOUR_DEV): park through `offer` (to 'feet'), else at the saved-body rule's threshold. Never in place. */
    detachMover(offer?:ThresholdOffer){if(!HARBOUR_DEV)throw new Error('detachMover is a review-only control.');if(!registry.active())return false;if(offer)return acceptOffer(offer);parkRide();return true;},
    /** Whether the active mover is paused (Look / Island / a page while riding). */
    ridePaused:()=>hold.paused(),
    /** E / the Enter bubble: an edge the next frame spends on the nearest offer, else a nearby door. */
    accept:acceptPublic,
    cutTo,
    /** The Jump bubble held (riding: the board charges its pop). */
    jumpHold(on:boolean){if(on&&!jumpHeld&&!consumeJumpUntilRelease)jumpRequested=true;jumpHeld=on;if(!on)consumeJumpUntilRelease=false;},
    offer:()=>lastOffer,
    /** Compatibility (main #552): one comfort path — `setComfort` sets the land's motion and the movers' registry together. */
    setReducedMotion(on:boolean){applyComfort({reducedMotion:on});},
    setCalm(on:boolean){applyComfort({calm:on});},
    input(next:Partial<typeof controls>){controls={...controls,...next};},jump(){jumpRequested=true;},look(dx:number,dy:number){if(perspective.mode()!=='activity'&&mode==='walk'){perspective.look(dx,dy);return;}lookAcc.dx+=dx;lookAcc.dy+=dy;yaw+=dx;pitch=Math.max(-1.2,Math.min(.8,pitch+dy));},
    pause(value:boolean){paused=value;if(value){clear();ambience?.pause();}},setDate(date:Date){currentTime=date;lastSun=-Infinity;},

    /** The app's comfort choices, live (HorizonStage threads useComfort; html[data-motion] is read too). */
    setComfort(next:Partial<HorizonComfort>){applyComfort(next);},
    comfort:()=>({...comfort,motion:{...motion}}),
    walkTo(p:XYZ){lastMovementBlocker=null;const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],p,{stepFree:true});path=plan?[...plan.points]:[];if(plan)routeAhead(plan.points);return plan;},
    stats(){const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),revision:world.geographyRevision,terrainBytes:assets.bytes,collisionIndex:geography.indexStats,bytesBeforeFirstFrame,chunksLoaded:chunks?chunks.refs.filter(r=>chunks.ready(r.districtId)).map(r=>r.districtId):null,cables:cableLayer.stats(),chunks:chunks?{resident:chunks.refs.filter(r=>chunks.ready(r.districtId)).map(r=>r.districtId),total:chunks.refs.length,queued:scheduler!.queued(),heldAt:heldNow.length?{districts:[...heldNow],body:{...body}}:null,holds:chunkHolds.map(h=>({...h,at:[...h.at]})),ride:rideGate.stats()}:null,definitionBytesSoFar:chunks?.bytes()??assets.definitionBytes,shadowRequests:[...shadowRequests],comfort:{...comfort,motion:{...motion}},lightCards:pools.count,shadow:{half:sun.shadow.camera.right,centre:sun.target.position.toArray()},firstInteractiveMs:interactiveAt===null?null:interactiveAt-startedAt,assetLoadMs:assetLoadedAt-startedAt,mode,shot:shotId,body:{...body},frames:[...frameTimes],drawSamples:[...drawSamples],stream:[...stream.history],camera:{eye:camera.position.toArray(),target:target.toArray(),fov:camera.fov},diagnostics:world.diagnostics};},
    dispose(){saveFleet();window.removeEventListener('pagehide',saveFleet);offFleet();fleetArt.dispose();disposed=true;window.clearTimeout(fadeTimer);registry.dispose();for(const art of [...moverArts])removeMoverArt(art);unmountBoardProxy();fadeEl.remove();offChunk?.();lease.cancelFrame(frame);observer.disconnect();for(const fn of unlisten)fn();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);host.removeEventListener('blur',clear);stream.dispose();cableLayer.dispose();for(const c of coarse.values())c.dispose();water.dispose();ring.dispose();skyDome.dispose();poolGeometry.dispose();beadGeometry.dispose();poolMaterial.dispose();beadMaterial.dispose();chalkMaterial.dispose();doorGeometry.dispose();doorMaterial.dispose();figure.dispose();partner.dispose();sun.shadow.map?.dispose();lease.release();}
  };
  return api;
}

const CHALK_SOLID=/(^|\.)(edges|kerbs|parapet|parapets|rails|retaining|coping|lip|marker)(\.|@|$)/;
/** Solids whose vertical faces also take the night face colour (walls that bound a walk and, Wave 6, rails: P28 C and L
 * read their rails at 1.25 / 2.69 : 1 against the moonlit ground; not markers). */
const CHALK_FACE_SOLID=/(^|\.)(edges|kerbs|parapet|parapets|retaining|coping|rails)(\.|@|$)/;
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
