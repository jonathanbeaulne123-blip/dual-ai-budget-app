import { createBridgeArt } from './bridgeArt';
import {createAirport} from '../airport/campus.ts';
import {AIRPORT,AIRPORT_VIEWS} from '../airport/layout.ts';
import {AIRCRAFT,FLIGHT_CONTROLS,stepThrottle,type AircraftId} from '../airport/aircraft.ts';
import {createAdaptiveQuality} from '../../../house/world/adaptiveQuality.ts';
import {applyHorizonQuality} from './quality.ts';
import {recordDiagnostic} from '../../../diagnostics/inspectorCore.ts';
import type {GroundState} from '../movers/shared/ground/types.ts';
import {createHorizonFrameLoop} from './frameLoop.ts';
import {createBuildTask,finishBuild} from '../../../house/world/buildTask.ts';
import type {District} from '../world/definition.ts';
import {CARD_CLOCK} from '../../art/cardScene.ts';
import {createHomeWorld} from '../../../home/world.ts';
import type {HomeLayout} from '../../../home/model.ts';
import type {HomeDisplayContent} from '../../../home/displays.ts';
import {createKitchenActivity} from '../kitchen/activity.ts';
import type {ChefId,KitchenChefInput,KitchenCommand} from '../kitchen/types.ts';
import {createCruiserArt,CRUISER_RIDER_POSE} from '../movers/cruiser/art.ts';
import type {CruiserController} from '../movers/cruiser/controller.ts';
import {validCruiserPosition} from '../movers/cruiser/sim.ts';
import {rideModeFor,type CruiserSkin} from '../movers/cruiser/tuning.ts';
import {createFleet,isCraft,HANDLING,toWorld,toLocal,type CraftId} from '../movers/fleet/model.ts';
import {createWatercraftController} from '../movers/fleet/controller.ts';
import {createFleetArt} from '../movers/fleet/art.ts';
import {constantWind,windVelocity} from '../movers/shared/wind.ts';
import {createPerspective,perspectiveLabel,type Perspective} from './perspective.ts';
import {HARBOUR_DEV} from '../../flag.ts';
import * as THREE from 'three';
import {acquireWorldRenderer} from '../../../house/world/rendererOwner.ts';
import {createBodyFigure} from '../../body/figure.ts';
import {createPlayableFigure} from '../../body/playableFigure.ts';
import type {PlayableAvatar} from '../../body/avatarDefinition.ts';
import {EMOTE_LOOPS,EMOTE_SECONDS,type EmoteId} from '../../body/bodyModel.ts';
import {createNativeSkate,type NativeSkate,type NativeSkateFrame} from '../skate/nativeSkate.ts';
import {terrainPaintKind} from '../skate/world.ts';
import type {SkateProgress} from '../../skate/session.ts';
import type {PlaceWalkSource} from '../../scene/place.ts';
import type {HouseBodyReturn} from '../../../house/navigation.ts';
import {HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD} from '../../../worldGeography.ts';
import {loadHorizonAssets,type HorizonAssets} from '../../../house/world/horizonAssets.ts';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES,HORIZON_BODY_HEIGHT} from './geography.ts';
import {buildDistrictCardSteps,buildDistrictCards,buildWaterCards,buildHorizonRing,type DistrictCards,type TerrainCellFilter} from './cards.ts';
import {sampleTerrain} from '../land/terrain/index.ts';
import type {MountainV2Region,RegionScene} from '../regions/mountainV2/index.ts';
import {MOUNTAIN_V2_OFFSET} from '../regions/mountainV2/placement.ts';
import {createHorizonMonorail} from '../monorail/HorizonMonorail.ts';
import type {MonorailState,MonorailView} from '../../mountain/monorail.ts';
import {MONORAIL_STOPS} from '../../mountain/definition.ts';
import {connectCableRegion,asCableRide,cableControls,type CableControl} from '../movers/gondola/index.ts';
import type {CableControlId} from '../movers/gondola/hud.ts';
import type {PlaceDressing} from '../../scene/place.ts';
import {createDistrictStream,districtAt,useDefinitionDistricts} from '../world/districts.ts';
import {useCoastline} from '../land/coast/index.ts';
import {HORIZON_MANIFEST} from '../world/manifest.ts';
import {restoreHorizonPosition,HORIZON_RESTORE_TOLERANCE} from './savedPosition.ts';
import {horizonFootFrame,horizonWalkOut,type HorizonWalkProbe} from './walkOut.ts';
import {GLIDER_PADS,createGliderPads,gliderPadNear,gliderPadPlacement,gliderPadRefusal,gliderPadStand,liveTravelOffers,stairEnds,type GliderPadId} from './gliderPads.ts';
import {horizonPartnerPose} from './partner.ts';
import {createWalkState,horizonWalkWorld,walkMove,walkPose,walkTick,walkView,type WalkMove} from './walkSim.ts';
import {nearestPathNode,walkPlan,withExtraGraph} from '../world/pathGraph.ts';
import {createChunkGate,createChunkScheduler,createRideGate,CHUNK_REACH_EU,CHUNK_ARRIVING_STATUS,CHUNK_FAILED_STATUS} from './chunkGate.ts';
import {createCableLayer} from './cableLayer.ts';
import {solarPosition,solarReviewDate} from '../sun/solar.ts';
import {skyGradient} from '../sky/gradient.ts';
import {horizonFog,HORIZON_FOG} from '../sky/fog.ts';
import {horizonMotion,appReducedMotion,type HorizonComfort} from '../sun/comfort.ts';
import {shadowFrame} from '../sun/shadow.ts';
import {createSkyDome} from '../sky/dome.ts';
import {nightLight,nightDome,NIGHT_LIGHT_CARDS,NIGHT_FLOOR,faceCardOn,FACE_CARD_LIGHT} from '../sky/night.ts';
import {createRoadLights} from './roadLights.ts';
import {createCorridorArt,type CorridorArt} from './corridorArt.ts';
import {createCorridorPlanting,type CorridorPlanting} from './corridorPlanting.ts';
import {roadLampRamp} from '../sky/night.ts';
import {createInspector,inspectorEnabled,buildInspectorSnapshot,type InspectorSource} from './inspector.ts';
import {sketchbookLens} from '../world/lens.ts';
import type {XYZ} from '../land/interfaces.ts';
import type {Host,SketchbookPose} from '../world/definition.ts';
import type {WorldAmbience} from '../../mountain/audio.ts';
import {createMoverRegistry,type MoverDeps} from '../movers/shared/registry.ts';
import type {AirborneBody,ModeController,ModeHud,ModeId,MoverBody,MoverFrame,MoverHud,MoverInput,MoverSound,ReducedMotionCut,ReducedMotionLanding} from '../movers/shared/mode.ts';
import type {ThresholdOffer} from '../movers/shared/threshold.ts';
import {moverInputFrom,moverFadeMs,moverBlendMs,moverBlendEase,registerHorizonMovers,riderSlip,savedRideBody,offerToShow,sameHud,sameOffer,createRideHold,RIDING_STATUS,rideAheadReady} from './moverInput.ts';
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
export type HorizonOptions={homePlotId?:string;homeLayout?:HomeLayout;onHomeBook?:()=>void;onHomeWorkspace?:(target:string)=>void;cruiserSkin?:CruiserSkin;fleetStorageKey?:string;kitchenStorageKey?:string;tier:'full'|'lite';hideBuildings?:boolean;signal?:AbortSignal;/** The app's reduced-motion setting (Comfort.motion) or the OS query; html[data-motion] is also read. Live changes go through `api.setComfort`. */reducedMotion?:boolean;onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onStatus?:(text:string)=>void;partner?:()=>PlaceWalkSource|null;initialBody?:HouseBodyReturn;
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
  movers?:Partial<Record<ModeId,(deps:MoverDeps)=>ModeController>>;
  /** Pass 5: Mountain v2 placed on the Horizon. Mounted when the definition lists the `mountainV2` region (a bake with the
   *  ground override); `false` keeps it out, `true` mounts it on any bake (review; also `?mountainV2` in development). */
  mountainV2?:boolean;
  /** The old Tideline skate's HUD frames (model, progress, revision), null when the board is picked up. Only with Mountain v2 placed. */
  onSkate?:(frame:NativeSkateFrame|null)=>void;
  onMonorail?:(state:MonorailState|null)=>void;
  avatar?:PlayableAvatar|null;onAvatarStatus?:(avatar:PlayableAvatar,status:'ready'|'error')=>void};
/** Pass 5 (T2): a placed region and the dressing its scene is built in. */
export type HorizonPlacedRegion={region:MountainV2Region;dressing:(theme:VehicleDressing)=>PlaceDressing};
/** Why the old board stays in hand (`skateRefusal`): only water, rooms, unsupported or steep (>40°) ground, a wall, unloaded
 *  ground, or another ride. Everywhere else on the island it goes down where the person stands. */
export const SKATE_REFUSALS={
  ride:'Park your current ride before skating.',
  indoors:'Step outside to put down the board.',
  water:'Step out of the water to put down the board.',
  steep:'Too steep for the board here. Find flatter ground.',
  unsupported:'Stand on solid ground to put down the board.',
  blocked:'Step clear of the wall to put down the board.',
  held:CHUNK_ARRIVING_STATUS,
} as const;
/** A region not needed (no district under its footprint resident, or the Journey map) is released after this long. */
export const REGION_RELEASE_MS=20_000;
/** Loads and creates the placed Mountain v2 region when the definition lists it (dynamic: v2's definition evaluates its terrain at import). */
export async function placeHorizonRegions(assets:Pick<HorizonAssets,'world'|'field'|'cuts'>,options:Pick<HorizonOptions,'mountainV2'>={},load:()=>Promise<typeof import('../regions/mountainV2/index.ts')>=()=>import('../regions/mountainV2/index.ts')):Promise<HorizonPlacedRegion|null>{
  const listed=assets.world.regions?.some(r=>r.id==='mountainV2'&&r.kind==='placedWorld')===true;
  if(options.mountainV2===false||!(listed||options.mountainV2===true))return null;
  // PR #566 Codex: the region's import fetches/decodes v2's terrain; a failure leaves the Horizon without the region, never blocks it.
  try{
    const mod=await load(),field=assets.field;
    // PR #566 CodeRabbit: across the Foot terrace S1 runs on the Horizon's own slab — drawn under the region, answered by the Horizon.
    return {region:mod.createMountainV2Region({horizonGround:(x,z)=>sampleTerrain(field,x,z),exclude:mod.mouthExclusion(assets.cuts.mouths),yield:mod.terraceBedExclusion(assets.cuts.beds),terrainStep:field.step,walkingJoinSolids:assets.cuts.solids}),dressing:mod.regionDressing};
  }catch(error){console.warn('Horizon: the Mountain v2 region did not load; the island runs without it.',error);return null;}
}
export async function mountHorizon(host:HTMLElement,options:HorizonOptions){
  const startedAt=performance.now(),assets=await loadHorizonAssets(options.tier,options.signal);if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  // R1-72: the chunk under the entry body (page A's eye) is the only geometry fetched before the first frame; the rest
  // streams by district residency (createDistrictStream ready/request), each added to the collision index as it lands.
  // Wave 6 arrival rule: the camera district AND every chunk within the body's reach (CHUNK_REACH_EU) are resident before
  // the first interactive frame — the body (page A's eye, or the restored body) and the camera (page A, or ?shot=).
  // Pass 5: the placed region's module (v2's definition and its 1.2 MB ground) loads alongside the entry chunks.
  // Review (HARBOUR_DEV): `?mountainV2` places it on any bake, `?mountainV2=off` keeps it out.
  const review=HARBOUR_DEV?new URLSearchParams(location.search).get('mountainV2'):null;
  const placing=placeHorizonRegions(assets,{mountainV2:options.mountainV2??(review===null?undefined:review!=='off')});placing.catch(()=>{});
  const startEye=assets.world.views.find(v=>v.id==='A')?.eye;
  if(assets.chunks&&startEye){
    useDefinitionDistricts(assets.world.districts);
    const loader=assets.chunks,gate=createChunkGate(loader,(x,z)=>districtAt(x,z)),shotEye=assets.world.views.find(v=>v.id===new URLSearchParams(location.search).get('shot'))?.eye,bodyAt=options.initialBody?[options.initialBody.x,options.initialBody.z]:[startEye[0],startEye[2]];
    const ids=new Set<string>([districtAt(startEye[0],startEye[2]),...gate.near(bodyAt[0]!,bodyAt[1]!,CHUNK_REACH_EU),...(shotEye?[districtAt(shotEye[0],shotEye[2])]:[])]);
    await Promise.all([...ids].map(id=>loader.load(id,options.signal)));if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  }
  const placed=await placing;if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  // Region creation races entry-chunk loading above. No scene exists yet; close
  // that race before registering its providers or starting its first build.
  placed?.region.refreshWalkingJoinSolids(assets.cuts.solids,()=>{});
  return createRuntime(host,assets,options,startedAt,placed);
}
function createRuntime(host:HTMLElement,assets:HorizonAssets,options:HorizonOptions,startedAt:number,placed:HorizonPlacedRegion|null=null){
  const {world,field,journey,cuts}=assets,tier=options.tier,assetLoadedAt=performance.now(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.08,4500);
  // The partition is the definition's (R1-67): districtAt() uses the baked hearts from here on.
  useDefinitionDistricts(world.districts);
  // …and the coastline too: shore tests read the baked outline, not a client re-solve of the manifest.
  useCoastline(world.coastline);
  // Pass 5: a placed region's walk graph joins the Horizon's at its seams (walk plans, walk-outs, restores cross it).
  if(placed&&world.pathGraph)world.pathGraph=withExtraGraph(world.pathGraph,placed.region.pathGraph());
  // R1-72: the chunk under the entry body (page A's eye) is the only geometry fetched before the first frame; the rest
  // streams in behind it, nearest the body first, one chunk at a time, each added to the collision index as it lands.
  const chunks=assets.chunks;
  const bytesBeforeFirstFrame={definition:chunks?.bytes()??assets.definitionBytes,terrain:assets.bytes};
  const geography=createHorizonGeography(field,cuts);
  for(const view of AIRPORT_VIEWS)if(!world.views.some(v=>v.id===view.id))world.views.push({...view,fovDegrees:50,radius:80});
  let figure=options.avatar?createPlayableFigure(options.avatar,tier,{invalidate:()=>schedule(),onStatus:options.onAvatarStatus}):createBodyFigure();
  const partner=createBodyFigure({coat:'#af8760'});
  scene.add(figure.group,partner.group);partner.group.visible=false;
  // The old skate keeps its native Mountain space (`../skate/nativeSkate.ts`): its park, spots and race stand on Mountain v2's
  // town island, so it exists with the placed region. Its floors, walls, water and ceilings are the Horizon geography's, and
  // terrain rides as its baked paint, so the board goes down on any dry, open, walkable ground of the whole island.
  const skate:NativeSkate|null=placed?createNativeSkate({scene,figure,tier:options.tier,theme:options.theme,geography,terrainKind:terrainPaintKind(field),ready:(x,z)=>gateOpen(x,z),destination:{ready:prepareSkateDestination,clear:clearSkateDestination},nativeVisible:(x,z)=>regionVisible&&placed.region.requiresScene(x,z),reducedMotion:()=>comfort.reducedMotion,onSkate:options.onSkate,blocked:(x,y,z,r)=>placed.region.blocked(x,y,z,r)}):null;
  const skating=()=>Boolean(skate?.controls.active());
  // Pass 5: inside the region's footprint its provider owns the ground (v2's exact ground, decks, solids, ceilings).
  // PR #566 Codex: its decks, solids and ceilings answer only while the region's scene is drawn (showRegion); ground and water always.
  let regionVisible=false,regionSettle=false;
  let skateDestination:{x:number;z:number}|null=null;
  const offRegion=placed?geography.addDynamic(placed.region.providerWhileDrawn(()=>regionVisible)):null;
  const homeWorld=createHomeWorld(scene,world.reserves,options.homePlotId);homeWorld.set(options.homeLayout);const offHome=geography.addDynamic(homeWorld.collision);
  // Movers (RIDE §10.2, §11 ask 2): one registry, one active controller; the Horizon mode stays 'walk' while riding.
  // One comfort source (v2.2): the land's motion (cuts, the frozen 15:30) and the movers' registry read the same two flags.
  let comfort:HorizonComfort={calm:options.calm===true,reducedMotion:options.reducedMotion===true||appReducedMotion()},motion=horizonMotion(comfort);
  let theme=options.theme??'classic';const perspective=createPerspective();
  const monorail=placed?createHorizonMonorail(scene,tier,placed.dressing(theme)):null;
  let lastMonorailReport=0;
  const reportMonorail=(force=false)=>{const now=performance.now();if(force||now-lastMonorailReport>250){lastMonorailReport=now;options.onMonorail?.(monorail?.state()??null);}};
  const registry=createMoverRegistry({world,geography,manifest:HORIZON_MANIFEST,reducedMotion:comfort.reducedMotion,calm:comfort.calm,tier});
  registerHorizonMovers(registry,options.movers);
  const sharedWind=constantWind();
  const airportStorageKey=(options.fleetStorageKey??'hearth:horizon-fleet:review:v1')+':aircraft:v1';
  const airport=createAirport(scene,geography,options.theme??'classic',{load:()=>JSON.parse(localStorage.getItem(airportStorageKey)??'null'),save:states=>localStorage.setItem(airportStorageKey,JSON.stringify(states))},()=>comfort.calm?[0,0]:windVelocity(sharedWind.sample(0,0,0,performance.now()/1000)));
  const waterLevel=geography.waterLevel;
  // Hull clearance uses static island geometry. Dynamic yacht collision is queried by people and flight.
  const hullGeography=geography.staticOnly;
  const fleet=createFleet({water:waterLevel,ground:geography.ground,blocked:hullGeography.blocked,ceiling:hullGeography.ceiling,surface:hullGeography.surface,width:world.extent.w,depth:world.extent.h,wind:{sample:(x,y,z,t)=>comfort.calm||comfort.reducedMotion?{dir:0,speed:0}:sharedWind.sample(x,y,z,t)}});
  const offFleet=geography.addDynamic(fleet);let fleetArt=createFleetArt(fleet,theme);scene.add(fleetArt.root);
  for(const id of ['kayak','dinghy','motorboat','yacht'] as const)registry.register(id,()=>createWatercraftController(fleet,id));
  const fleetKey=options.fleetStorageKey??'hearth:horizon-fleet:review:v1';
  let fleetRestore:ReturnType<typeof fleet.restore>=null;
  try{fleetRestore=fleet.restore(JSON.parse(localStorage.getItem(fleetKey)??'null'));}catch{/* Unavailable storage starts one default fleet. */}
  let physicalBody:HorizonBody|null=null;
  // Reconciliation 2 (Stage A walk-out × main #557 physical body): Look / Island opened from Walk is a pause — Walk resumes the
  // physical body (main: the yacht deck, a seat, the spot on the island). A page CHOSEN (the page picker, a comfort cut to a view,
  // `api.shot`) is a visit — Walk starts from that page on dry path (Stage A R3-130 walk-out). The physical body is still what a
  // reload saves while looking (main: never the camera eye).
  let pageChosen=false;
  let kitchen:ReturnType<typeof createKitchenActivity>|null=null;
  let fleetLook=0;
  let swimming=false,lastFleetSave=0,fleetSaveFailed=false;
  let lastFleetCutaway='';
  let carriedVelocity={x:0,z:0};
  function saveFleet(){const activeCruiser=wheels();const at=registry.mode()==='plane'?AIRPORT.arrival:activeCruiser?(activeCruiser.dismount()??activeCruiser.state().safe):hold.body??physicalBody??body;try{localStorage.setItem(fleetKey,JSON.stringify(fleet.snapshot(at)));fleetSaveFailed=false;}catch{fleetSaveFailed=true;}}
  function cycleCamera(){cyclePerspective();}
  // Visual occupancy survives a jump or a seat's half-metre offset. Physics still
  // requires actual foot support; this never carries an airborne body.
  function yachtView(){const at=fleet.surface(body.x,body.z,body.y,.1);return at&&body.y-at.y>=-.16&&body.y-at.y<1.35?at:null;}
  function fleetAction(id:string){
    if(kitchen?.active()||mode!=='walk'||paused||registry.active()&&!isCraft(registry.mode())){recordDiagnostic('fleet',id,'rejected','another activity owns movement');return false;}
    const action=fleet.actions(body).find(a=>a.id===id);if(!action){recordDiagnostic('fleet',id,'rejected','no reachable action');return false;}
    // Validate reach afresh, including button clicks. No remotely supplied helm coordinates.
    if((action.kind==='board'||action.kind==='helm')&&!rideGateOpen()){options.onStatus?.(RIDE_WAITS_STATUS);recordDiagnostic('fleet',id,'waiting','districts loading');return false;}
    const result=fleet.act(id,body);if(!result){recordDiagnostic('fleet',id,'rejected','vessel controller declined');return false;}
    recordDiagnostic('fleet',id,'accepted',action.kind);
    if(result.leave){registry.finish();onFoot(result.body??body,result.message??'On foot.');}
    else if(result.board){const at=result.body!;Object.assign(body,at);registry.accept({id,thresholdId:'fleet.'+id,from:'feet',to:result.board,at:[at.x,at.y,at.z],action:action.label,label:action.label},body,performance.now());startRide();}
    else if(result.body){Object.assign(body,result.body);velocityY=0;}
    clear();physicalBody={...body};requestShadow('fleet-interaction');if(result.message)options.onStatus?.(result.message);saveFleet();return true;
  }
  function fleetActions(){return !kitchen?.active()&&mode==='walk'&&!paused&&(!registry.active()||isCraft(registry.mode()))?fleet.actions(body):[];}
  function tickFleet(dt:number){
    if(registry.active()&&isCraft(registry.mode())&&!rideGateOpen()){fleet.resetInput();return;}
    // Reconciliation 2 (ride chunk rule): no hull moves while any district is missing — a coasting boat would sail through a
    // pier or quay whose collision has not arrived (hulls test the resident solids only). Checked without re-routing the queue.
    if(rideGate.missing().length&&fleet.vessels.some(v=>v.speed!==0||v.turn!==0)){fleet.resetInput();return;}
    const aboard=!kitchen?.active()&&!registry.active()&&(fleet.support(body)!==null||fleet.sitting()!==null)&&velocityY===0;
    const before={...fleet.yacht},local=aboard?toLocal(before,body):null;
    if(isCraft(registry.mode()))fleet.drive(registry.mode() as CraftId,moverInputFrom({keys,controls,jumpHeld,jumpEdge:jumpRequested,accept:false,look:lookAcc}));
    fleet.step(dt);
    if(local){const p=toWorld(fleet.yacht,local),turn=fleet.yacht.yaw-before.yaw;carriedVelocity={x:(p.x-body.x)/Math.max(.0001,dt),z:(p.z-body.z)/Math.max(.0001,dt)};Object.assign(body,p);body.yaw+=turn;yaw+=turn;}else carriedVelocity={x:0,z:0};
  }
  // R2-01: Look / Island / a page pause the ride where it is; Walk resumes it; a reload / arrive parks at a threshold. A mode never ends in place.
  const hold=createRideHold(registry,world,(x,z)=>geography.ground(x,z));
  const moverArts=new Set<HorizonMoverArt>();
  const removeMoverArt=(art:HorizonMoverArt)=>{if(!moverArts.delete(art))return;scene.remove(art.object);art.dispose?.();};
  let cruiserTheme=options.theme??'classic';
  let cruiserSkin:CruiserSkin=options.cruiserSkin??'vespa',cruiserArt:ReturnType<typeof createCruiserArt>|null=null;
  /** The cruiser or the bicycle: one vehicle sim (cruiser/sim.ts) under two registry modes. */
  const wheels=()=>registry.mode()==='cruiser'||registry.mode()==='bicycle'?registry.active() as CruiserController|null:null;
  const wheelsLook=():CruiserSkin=>registry.mode()==='bicycle'?'bicycle':cruiserSkin==='bicycle'?'vespa':cruiserSkin;
  let boardProxy:BoardProxy|null=null,consumeJumpUntilRelease=false,jumpHeld=false,acceptRequested=false,lookAcc={dx:0,dy:0},lastOffer:ThresholdOffer|null=null,lastHud:MoverHud|null=null,lastInput:MoverInput|null=null,walkFov:number|null=null,footFov=45,fadeTimer=0,moverActionRequested:'fold'|'pull'|null=null,fadeLabel:{label:string;at:number}|null=null;
  const fadeEl=document.createElement('div');fadeEl.className='horizon-fade';fadeEl.setAttribute('aria-hidden','true');host.appendChild(fadeEl);
  const partnerMaterials:Record<string,THREE.Material>={};partner.group.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])partnerMaterials[material.uuid]=material;});
  // Pass 5: terrain cells under the region are built apart (`under`) and shown only while the region is not drawn. A resident
  // tile's cell goes under when its centre is inside the region; a journey (coarse) cell only when it lies wholly inside.
  const regionCells:TerrainCellFilter=placed?{split:(x,z)=>placed.region.hidesTerrainCell(x,z)}:{};
  const coarseCells:TerrainCellFilter=placed?{split:(x,z,st)=>[[0,0],[-1,-1],[1,-1],[-1,1],[1,1]].every(([u,v])=>placed.region.contains(x+u!*st/2,z+v!*st/2))}:{};
  const regionDistricts=new Set<string>();
  if(placed){const f=placed.region.footprint;for(let x=f.minX;x<=f.maxX;x+=10)for(let z=f.minZ;z<=f.maxZ;z+=10)if(placed.region.requiresScene(x,z))regionDistricts.add(districtAt(x,z));}
  const coarse=new Map(world.districts.map(d=>{const cards=buildDistrictCards(world,journey,cuts,d,tier,true,false,coarseCells);scene.add(cards.group);return[d.id,cards] as const;}));
  const water=buildWaterCards(cuts,tier),ring=buildHorizonRing(assets.horizonCards,tier);scene.add(water.group,ring.group);
  // Horizon cards are fogged like the land but never beyond 70 % (STYLE §1.8), so they never vanish and never poke through.
  for(const material of Object.values(ring.materials)){if('fog'in material)(material as THREE.MeshStandardMaterial).fog=true;fogHook(material,HORIZON_FOG.horizonMaxOpacity);}
  // R2-110: the sky is a dome in view direction whose horizon IS the fog colour (sky/dome.ts), not a screen-space gradient.
  const skyDome=createSkyDome();scene.add(skyDome.mesh);let lastSkyColors:{zenith:string;horizonAway:string;horizonSun:string}|null=null,lastSunDirection:[number,number,number]=[0,1,0];
  const ambient=new THREE.HemisphereLight('#d9e7e8','#786b57',1.2),sun=new THREE.DirectionalLight('#fff0d5',2.2),moon=new THREE.DirectionalLight('#9badcd',.26);
  sun.castShadow=true;{const size=tier==='full'?2048:1024;sun.shadow.mapSize.set(size,size);}sun.shadow.camera.near=1;sun.shadow.normalBias=.05;sun.shadow.bias=-.00006;
  scene.add(ambient,sun,sun.target,moon);
  // ---- Light cards and road lamps (runtime/roadLights.ts; ROAD.md §6, D-R3) ----
  // Night is the moonlit floor plus the light cards of every `world.lights` anchor (door and threshold pool + bead; corridor
  // lamps: conformed pool decal + glow/halo) under one cap, and, for road lamps only (D-R3 overrides STYLE §1.2.1), a fixed
  // pool of shadowless point lights. Lamps ramp on the world clock (the sun's elevation); `updateLocalLights` drives it.
  // ---- Road main: the corridor's dressing and planting (runtime/corridorArt.ts, corridorPlanting.ts; ROAD.md §4–§6, §8) ----
  // Markings, guard kits, lamps and stop furniture, and the roadside planting, per resident district; hidden on the Journey map.
  // The kit's lamp heads feed roadLights so the pools, glow cards and point lights sit on the lanterns as drawn.
  const seasonOf=(date:Date)=>{const month=date.getMonth()+1;return month<=2||month===12?'winter' as const:month<=5?'spring' as const:month<=8?'summer' as const:'autumn' as const;};
  let corridorArt:CorridorArt,corridorPlanting:CorridorPlanting,corridorSeason='',corridorNight=-1;
  function mountCorridor(date:Date){
    corridorArt=createCorridorArt(world,{tier,theme,ground:(x,z)=>geography.ground(x,z),externalLampHalos:true});
    corridorSeason=seasonOf(date);corridorNight=-1;
    corridorPlanting=createCorridorPlanting(world,{tier,theme,season:corridorSeason as ReturnType<typeof seasonOf>,month:date.getMonth()+1});
    scene.add(corridorArt.group,corridorPlanting.group);
    for(const material of Object.values(corridorArt.materials))fogHook(material);for(const material of corridorPlanting.materials())fogHook(material);
  }
  function unmountCorridor(){corridorArt.dispose();corridorPlanting.dispose();scene.remove(corridorPlanting.group);}
  let bridgeArt=createBridgeArt(world,{tier,theme,material:fogHook,changed:()=>requestShadow('bridge-art')});scene.add(bridgeArt.group);
  mountCorridor(new Date());
  // The lanterns' heads as this theme's kit draws them (review minor 2: rebuilt with the kit on a theme change).
  const makeRoadLights=()=>createRoadLights(scene,world,{tier,corridorAnchors:corridorArt.lampAnchors(),ground:(x,z,near)=>geography.surface(x,z,near+1,0)?.y??null,revision:()=>geography.indexStats.chunks});
  let roadLights=makeRoadLights();
  const lightAt:[number,number,number]=[0,0,0],lightFrame:{at?:readonly [number,number,number];hidden:boolean}={hidden:false};
  // The seven windows (LIGHT §3): each host's doorway is a lit card from dusk, one instanced draw.
  const doorHosts=world.hosts.filter(h=>'xy'in h.door),doorGeometry=new THREE.PlaneGeometry(NIGHT_LIGHT_CARDS.doorSize[0],NIGHT_LIGHT_CARDS.doorSize[1]).translate(0,NIGHT_LIGHT_CARDS.doorSize[1]/2,0),doorMaterial=new THREE.MeshBasicMaterial({color:NIGHT_LIGHT_CARDS.door,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8}),doors=new THREE.InstancedMesh(doorGeometry,doorMaterial,Math.max(1,doorHosts.length));
  doorHosts.forEach((h,i)=>{const d=h.door as {xy:readonly [number,number];height?:number},facing=h.facing??0;doors.setMatrixAt(i,new THREE.Matrix4().makeRotationY(facing).setPosition(d.xy[0]+Math.sin(facing)*.08,(d.height??0)+.02,d.xy[1]+Math.cos(facing)*.08));});doors.count=doorHosts.length;doors.visible=false;scene.add(doors);
  // D-A5 (v2.0 lights, LIGHT §2): the dam's glass face is an emissive card (an unlit quad, no dynamic light), on from golden hour to dawn.
  const faceCardMaterial=new THREE.MeshBasicMaterial({color:FACE_CARD_LIGHT.colour,transparent:true,opacity:FACE_CARD_LIGHT.opacity,side:THREE.FrontSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),faceCards=new THREE.Group();
  for(const card of world.faceCards??[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(card.corners.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();const mesh=new THREE.Mesh(g,faceCardMaterial);mesh.name=`faceCard.${card.id}`;mesh.renderOrder=2;faceCards.add(mesh);}
  faceCards.visible=false;scene.add(faceCards);let faceCardsLit=false;
  let night=false,lastSolar={elevation:30,azimuth:180},ambience:WorldAmbience|null=null;
  // Jonathan 2026-10-04: a parked glider at each launch pad (gliderPads.ts), built once its deck is resident; `gliderFrom` is the
  // pad the rider launched from (its parked glider hides while that flight lasts).
  const padGround=(x:number,z:number,y:number)=>geography.surface(x,z,y)?.y??geography.ground(x,z),padClear=stairEnds(cuts.beds);
  const padStands=GLIDER_PADS.flatMap(p=>{const s=gliderPadStand(world,p.id,padGround);return s?[{id:p.id,label:p.label,stand:s.stand}]:[];});
  const gliderPads=createGliderPads(scene,world,id=>gliderPadPlacement(world,id,(x,z,y)=>geography.surface(x,z,y),geography.ground,padClear),{theme,tier});
  let gliderFrom:string|null=null;
  const shadowRequests:{at:number;reason:string}[]=[];
  function requestShadow(reason:string){schedule();renderer.shadowMap.needsUpdate=true;shadowRequests.push({at:performance.now(),reason});if(shadowRequests.length>120)shadowRequests.shift();}
  function updateFog(){const fog=horizonFog({tier,eyeAboveGround:Math.max(0,camera.position.y-geography.ground(camera.position.x,camera.position.z)),elevation:lastSolar.elevation,sunAzimuth:lastSolar.azimuth,heading:yaw*180/Math.PI});scene.fog=mode==='journey'?null:new THREE.Fog(fog.color,fog.near,fog.far);if(lastSkyColors)skyDome.update(lastSkyColors,fog.color,lastSunDirection);}
  /** Every frame: the lamps' ramp, sequence and point-light cross-fades (cheap; re-picks the nearest set every 500 ms / 20 eu). */
  function updateLocalLights(now:number){
    doors.visible=night&&mode!=='journey';lightAt[0]=body.x;lightAt[1]=body.y;lightAt[2]=body.z;lightFrame.at=mode==='look'?undefined:lightAt;lightFrame.hidden=mode==='journey';
    roadLights.update(camera,lastSolar.elevation,now,lightFrame);
    const k=Math.round(roadLampRamp(lastSolar.elevation)*100)/100;if(k!==corridorNight){corridorNight=k;corridorArt.setNight(k);bridgeArt.setNight(k);}
  }
  let interactiveAt:number|null=null;
  let doorCooldown=0,lastMovementBlocker:unknown=null,simulating=false;
  let frameDriver:ReturnType<typeof createHorizonFrameLoop>|undefined;
  let disposed=false,paused=false,mode:HorizonMode='look',last=0,lastSun=-Infinity,shotId='A',distance=12,pitch=.2,yaw=0,drag:{x:number;y:number;id:number;travel:number}|null=null;
  let comfortCut:ReducedMotionCut|null=null,comfortCutBody:MoverBody|null=null,ambienceSpeed=0;
  // `live`: the walk ↔ ride camera blend (RIDE §10.2). Walking/riding keeps running and the goal (toEye/toTarget) follows the camera ride()/step() set that frame; fov blends to toFov.
  let transition:{eye:THREE.Vector3;target:THREE.Vector3;toEye:THREE.Vector3;toTarget:THREE.Vector3;at:number;duration:number;live?:boolean;fov?:number;toFov?:number}|null=null;
  let controls:{forward:number;strafe:number;run:boolean;rudder?:number}={forward:0,strafe:0,run:false},path:XYZ[]=[],velocityY=0,jumpRequested=false,currentTime:Date|null=null;
  // The entry body and the Island camera come from the definition (page A's eye; the extent), not code constants.
  const entry=world.views.find(v=>v.id==='A')??world.views[0],body:HorizonBody={x:entry?.eye[0]??world.extent.w/2,y:(entry?.eye[1]??1.6)-1.6,z:entry?.eye[2]??world.extent.h/2,yaw:0},target=new THREE.Vector3(),keys=new Set<string>(),frameTimes:number[]=[],drawSamples:{at:number;calls:number;triangles:number;resident:number}[]=[];
  const adaptiveQuality=createAdaptiveQuality(tier);let qualityDirty=false,contextLost=false;
  const configure=(r:THREE.WebGLRenderer)=>{contextLost=r.getContext().isContextLost();r.shadowMap.enabled=true;r.shadowMap.autoUpdate=false;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.25;applyHorizonQuality(r,sun,adaptiveQuality.profile(window.devicePixelRatio),true);r.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight));};
  const lease=acquireWorldRenderer(host,{priority:0,parameters:{antialias:tier==='full',alpha:false,preserveDrawingBuffer:HARBOUR_DEV},configure,onSuspend:()=>{adaptiveQuality.interrupt();frameDriver?.suspend();kitchen?.pause('The world is resting. Resume to continue cooking.');keys.clear();controls={forward:0,strafe:0,run:false};},onResume:()=>{last=0;adaptiveQuality.interrupt();resize(false);schedule();}}),renderer=lease.renderer;
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
  function* buildChalk(d:{solidIds?:string[]}):Generator<void,THREE.Mesh|null,void>{
    const positions:number[]=[],colors:number[]=[];
    for(const id of d.solidIds??[]){const solid=solidsById.get(id);if(!solid||!CHALK_SOLID.test(solid.id))continue;const faces=CHALK_FACE_SOLID.test(solid.id);const p=tier==='lite'?(solid.litePositions??solid.positions):solid.positions,ix=tier==='lite'?(solid.liteIndices??solid.indices):solid.indices;
      for(let i=0;i<ix.length;i+=3){if(i%1536===0)yield;const a=ix[i]!*3,b=ix[i+1]!*3,c=ix[i+2]!*3,ux=p[b]!-p[a]!,uy=p[b+1]!-p[a+1]!,uz=p[b+2]!-p[a+2]!,vx=p[c]!-p[a]!,vy=p[c+1]!-p[a+1]!,vz=p[c+2]!-p[a+2]!,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,n=Math.hypot(nx,ny,nz);if(n<1e-9)continue;const up=Math.abs(ny/n)>=.6;if(!up&&!(faces&&Math.abs(ny/n)<.45))continue;const col=up?(/(^|\.)marker(\.|@|$)/.test(solid.id)?markerInk:lipChalk):faceChalk,ox=up?0:nx/n*.03,oz=up?0:nz/n*.03;for(const k of [a,b,c]){positions.push(p[k]!+ox,p[k+1]!+(up?.03:0),p[k+2]!+oz);colors.push(col.r,col.g,col.b);}}}
    if(!positions.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,chalkMaterial);mesh.visible=night;mesh.renderOrder=4;return mesh;
  }
  // Pass 5: the placed region's state (updateRegion, below).
  let regionScene:RegionScene|null=null,regionTask:{advance():RegionScene|undefined;cancel():void}|null=null,regionIdleSince=0,regionShownAt=0,regionHooks:FogHook[]=[];
  let regionWater:{level:number|null;reserve:number|null}={level:null,reserve:null},regionTransit:{cabin:{at:XYZ;yaw:number;pitch:number}|null;kind:'gondola'|'funicular'}|null=null;
  type Resident={cards:DistrictCards;chalk:THREE.Mesh|null;at:number;fadeIn(amount:number):void;dispose():void};
  function* buildResident(d:District):Generator<void,Resident,void>{
    const cards=yield* buildDistrictCardSteps(world,field,cuts,d,tier,false,options.hideBuildings,regionCells);
    for(const mesh of cards.under??[])mesh.visible=!regionVisible;
    let chalk:THREE.Mesh|null=null,complete=false;
    try {
      chalk=yield* buildChalk(d);
      const hooks=Object.values(cards.materials).map(material=>fogHook(material));let lastFade=-1;
      const fadeIn=(amount:number)=>{if(amount===lastFade)return;lastFade=amount;for(const hook of hooks)hook.fade.value=amount;};
      fadeIn(motion.districtFadeMs>0?0:1);scene.add(cards.group);if(chalk)scene.add(chalk);requestShadow('district-load');complete=true;
      return{cards,chalk,at:performance.now(),fadeIn,dispose(){scene.remove(cards.group);cards.dispose();if(chalk){scene.remove(chalk);chalk.geometry.dispose();}if(coarse.has(d.id))coarse.get(d.id)!.group.visible=true;}};
    } finally {if(!complete){cards.dispose();chalk?.geometry.dispose();}}
  }
  const stream=createDistrictStream(world,d=>finishBuild(buildResident(d)),tier,{prepare:d=>createBuildTask(buildResident(d)),ready:id=>!chunks||chunks.ready(id),request:id=>{scheduler?.view([id]);}});
  // Wave 6: one chunk at a time by priority — a walk plan's route (path order), then what the view asked for, then the rest
  // nearest the body; after the first frame every chunk's BYTES are fetched ahead (network only; parsed by priority).
  const nearestFirst=()=>chunks?[...chunks.refs].map(r=>{const d=world.districts.find(q=>q.id===r.districtId)??world.districts.flatMap(q=>q.children??[]).find(q=>q.id===r.districtId),c=d?.heart??d?.outline[0];return{id:r.districtId,d:c?Math.hypot(c[0]-body.x,c[1]-body.z):Infinity};}).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).map(r=>r.id):[];
  const gate=chunks?createChunkGate(chunks,(x,z)=>districtAt(x,z)):null;
  const scheduler=chunks?createChunkScheduler({ready:id=>chunks.ready(id),load:id=>chunks.load(id,options.signal),background:nearestFirst,isDisposed:()=>disposed}):null;
  const chunkHolds:{districts:string[];at:XYZ;t:number;resolved?:'sync'|'arrived'}[]=[];let heldNow:string[]=[];
  function prefetchChunks(){if(!chunks||!scheduler)return;for(const id of nearestFirst())if(!chunks.ready(id))void chunks.prefetch(id,options.signal).catch(()=>{});scheduler.startBackground();}
  function routeAhead(points:readonly XYZ[]){if(gate&&scheduler)scheduler.route(gate.along(points),true);}
  let resnap=false;
  // Wave 6: cables span by span with their anchors (runtime/cableLayer.ts), rebuilt as chunks land.
  const cableLayer=createCableLayer(world,tier,id=>!chunks||chunks.ready(id),xy=>gate?gate.near(xy[0],xy[1],6):[districtAt(xy[0],xy[1])],build=>{for(const material of Object.values(build.materials))fogHook(material);});
  cableLayer.rebuild();scene.add(cableLayer.group);
  const offChunk=chunks?.onLoad((_id,solids)=>{if(!disposed){
    // The town apron can arrive after the Mountain scene is already drawn. Its
    // new ground cut and path paint require the same visible generation as its
    // provider: cancel/dispose first, then rebuild through updateRegion's gate.
    placed?.region.refreshWalkingJoinSolids(cuts.solids,releaseRegion);
    for(const solid of solids)solidsById.set(solid.id,solid);geography.addSolids(solids);cableLayer.rebuild();residencyRevision=-1;requestShadow('chunk-load');
    if(resnap&&mode==='walk'&&gate){const at=holdPoint();if(!gate.missingAt(at[0],at[1]).length){resnap=false;reseat();}}
  }});
  /** The gate: resident (true) or held (false). Bytes already fetched are parsed now; the review simulation may block.
   *  PR #566 Codex: inside the placed region, also held until its scene is drawn (its decks and solids answer only then). */
  function gateOpen(x:number,z:number):boolean{return chunkGateOpen(x,z)&&regionReady(x,z);}
  /** A remote skate command keeps its source pose while its target chunks and region become drawable. */
  function clearSkateDestination(){
    if(!skateDestination)return;
    skateDestination=null;
    if(!heldNow.length&&holdText){holdText='';options.onStatus?.('');}
  }
  function prepareSkateDestination(x:number,z:number):boolean{
    skateDestination={x,z};schedule();
    // This is an active demand, not a passive current-position readiness check.
    const chunksReady=chunkGateOpen(x,z),ready=chunksReady&&regionReady(x,z);
    if(!ready){
      if(!heldNow.length){if(holdText!==CHUNK_ARRIVING_STATUS){holdText=CHUNK_ARRIVING_STATUS;options.onStatus?.(holdText);}}
      else holdStatus();
    }
    return ready;
  }
  /** PR #566 Codex: the placed region is not in the way here: drawn, or (x, z) outside its footprint. */
  function regionReady(x:number,z:number):boolean{return !placed||regionVisible||!placed.region.requiresScene(x,z);}
  /** PR #566 Codex: a rider inside the not-yet-drawn region waits (a board on a bridge keeps its deck); a cable ride runs on its line. */
  function riderReady():boolean{const m=registry.mode();if(m==='gondola'||m==='funicular')return true;if(!regionReady(body.x,body.z))return false;
    // A boosted cruiser/bicycle covers 4.8 m in a capped frame: hold before ground that is not resident, not on it.
    const w=wheels()?.state();return !w||rideAheadReady(body,w.vx,w.vz,gateOpen);}
  function chunkGateOpen(x:number,z:number):boolean{
    if(!gate||!chunks)return true;
    const missing=gate.missingAt(x,z),at:XYZ=[x,body.y,z],t=performance.now(),hold=(h:typeof chunkHolds[number])=>{chunkHolds.push(h);if(chunkHolds.length>200)chunkHolds.shift();};
    if(!missing.length){if(heldNow.length){hold({districts:heldNow,at,t,resolved:'arrived'});if(holdText)options.onStatus?.('');holdText='';}heldNow=[];return true;}
    // R3-122 (b): a failed synchronous review fetch throws NetworkError; the step holds instead of throwing out of the loop.
    for(const id of missing){try{chunks.loadSync(id,simulating&&HARBOUR_DEV);}catch{/* held: the scheduler retries (R3-118) */}}
    const still=gate.missingAt(x,z);
    if(!still.length){hold({districts:missing,at,t,resolved:'sync'});heldNow=[];return true;}
    // A new hold is a fresh demand (R3-118): its chunks go to the front and a failed one gets its tries back.
    if(heldNow.join()!==still.join()){heldNow=still;hold({districts:still,at,t});scheduler?.route([...still,...scheduler.queued().route]);}
    return false;
  }
  /** R3-118: while the walker is held, one status line says why — still arriving, or failed and being retried. */
  let holdText='';
  function holdStatus(){
    // PR #566 Codex: held inside the placed region while its scene builds: the same "still arriving" line.
    if(!heldNow.length&&!regionReady(body.x,body.z)){if(holdText!==CHUNK_ARRIVING_STATUS){holdText=CHUNK_ARRIVING_STATUS;options.onStatus?.(holdText);}return;}
    if(!heldNow.length||!scheduler)return;
    const failedHere=scheduler.failures().some(f=>heldNow.includes(f.id)),text=failedHere?CHUNK_FAILED_STATUS:CHUNK_ARRIVING_STATUS;
    if(text!==holdText){holdText=text;options.onStatus?.(text);}
  }
  // v2.2 ride rule (chunkGate.ts createRideGate): a feet → mover offer is taken only with every chunk resident; until then
  // it is held (the offer stays on show, a status line says why) and boards by itself when the last chunk lands.
  const rideGate=createRideGate<ThresholdOffer>(chunks);
  /** Every chunk resident (fetched bytes are parsed now; `blocking` — the review-only attach — may wait synchronously). */
  function rideGateOpen(blocking=false):boolean{
    if(!chunks)return true;
    let missing=rideGate.missing();if(!missing.length)return true;
    for(const id of missing){try{chunks.loadSync(id,blocking&&HARBOUR_DEV);}catch{/* held (R3-122 b) */}}
    missing=rideGate.missing();if(!missing.length)return true;
    scheduler?.route([...missing,...scheduler.queued().route]);return false;
  }
  function resize(reframe=true){schedule();adaptiveQuality.interrupt();if(lease.active)applyHorizonQuality(renderer,sun,adaptiveQuality.profile(window.devicePixelRatio));const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(reframe&&mode==='look'&&!transition){const pose=world.views.find(p=>p.id===shotId);if(pose)lookAt(pose);}}
  const observer=new ResizeObserver(()=>resize());observer.observe(host);resize();
  function setLight(date:Date){const month=date.getMonth()+1;homeWorld.setSeason(month<=2||month===12?'winter':month<=5?'spring':month<=8?'summer':'autumn');
    if(seasonOf(date)!==corridorSeason){corridorSeason=seasonOf(date);corridorPlanting.setSeason(seasonOf(date),month);}
    const position=solarPosition(date),colors=skyGradient(position.elevation),lookHeight=camera.position.y-geography.ground(camera.position.x,camera.position.z),fog=horizonFog({tier,eyeAboveGround:Math.max(0,lookHeight),elevation:position.elevation,sunAzimuth:position.azimuth,heading:yaw*180/Math.PI}),floor=nightLight(position.elevation,colors);
    lastSolar=position;night=floor.lightCards;faceCardsLit=faceCardOn(position,comfort.calm);faceCards.visible=faceCardsLit&&mode!=='journey';roadLights.refresh();
    lastSkyColors=nightDome(colors,floor.nightness);lastSunDirection=[position.direction[0],position.direction[1],position.direction[2]];skyDome.update(lastSkyColors,fog.color,lastSunDirection);
    scene.fog=mode==='journey'?null:new THREE.Fog(fog.color,fog.near,fog.far);
    ambient.color.set(floor.hemisphereSky);ambient.groundColor.set(floor.hemisphereGround);ambient.intensity=floor.hemisphereIntensity;
    // The shadow box follows what the camera frames (sun/shadow.ts), not only the body.
    const frame=shadowFrame({tier,mode,eye:mode==='walk'?[body.x,body.y,body.z]:[camera.position.x,camera.position.y,camera.position.z],heading:yaw,groundY:mode==='walk'?body.y:geography.ground(camera.position.x,camera.position.z)}),[cx,cy,cz]=frame.centre;
    const shadowCamera=sun.shadow.camera;shadowCamera.left=shadowCamera.bottom=-frame.half;shadowCamera.right=shadowCamera.top=frame.half;shadowCamera.far=frame.far;shadowCamera.updateProjectionMatrix();
    // Bias follows the texel (2·half/mapSize) so a wider box does not stripe flat ground with acne.
    sun.shadow.normalBias=1.5*2*frame.half/sun.shadow.mapSize.x;sun.shadow.bias=-.0001;
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
  function shot(id:string){schedule();kitchen?.pause('Looking around the island. Choose Walk and Resume to return to service.');if(mode==='walk')leaveWalk();const pose=world.views.find(p=>p.id===id);if(!pose)return false;pauseRide();shotId=id;mode='look';path=[];transition=null;lookAt(pose);body.x=pose.eye[0];body.z=pose.eye[2];body.y=pose.eye[1]-1.6;body.yaw=yaw;lastSun=-Infinity;return true;}
  const restoreStand=(x:number,z:number,y:number)=>{const at=geography.surface(x,z,y+.5,HORIZON_RESTORE_TOLERANCE);return at&&at.slope<=HORIZON_WALKABLE_DEGREES&&!geography.submerged(x,z,at.y)&&!geography.blocked(x,z,at.y)?{standY:at.y}:null;};
  /** Wave 7 (R3-130): dry, walkable, unblocked floor at or under y (the walk-out's standing check). */
  const walkProbe:HorizonWalkProbe=(x,z,y)=>{const at=geography.surface(x,z,y);return at&&at.slope<=HORIZON_WALKABLE_DEGREES&&!geography.submerged(x,z,at.y)&&!geography.blocked(x,z,at.y)?{y:at.y}:null;};
  let pendingRestore:HouseBodyReturn|null=null,pendingWalkOut=false,walkOutWait:[number,number]|null=null;
  /** Where a held body's hold waits: a pending walk-out's `wait` point (the eye, the page's ground, a node), else the body. */
  function holdPoint():[number,number]{return pendingWalkOut&&walkOutWait?walkOutWait:[body.x,body.z];}
  /** A chunk has landed under a held body: finish what was held (a restore's validation, a walk-out), or settle on the floor. */
  function reseat(){
    // PR #566 Codex: a chunk landing under a body inside the not-yet-drawn region (no decks yet) keeps the hold until it is drawn.
    {const at=holdPoint();if(!regionReady(at[0],at[1])){resnap=true;return;}}
    if(pendingRestore){const saved=pendingRestore;pendingRestore=null;const next=restoreHorizonPosition(saved,world.pathGraph!,geography.ground,restoreStand);const moved=Math.hypot(next.x-body.x,next.z-body.z);Object.assign(body,{x:next.x,y:next.y!,z:next.z,yaw:next.yaw});if(moved>.5){yaw=body.yaw;updateCamera();}return;}
    if(pendingWalkOut&&mode==='walk'){pendingWalkOut=false;walkOut(true);return;}
    // PR #566 Codex: a body held only for the region kept its height (a deck or v2's ground): settle within a step, never
    // up onto a low bridge deck overhead.
    const at=geography.surface(body.x,body.z,body.y+(regionSettle?.1:HORIZON_BODY_HEIGHT));regionSettle=false;if(at)body.y=at.y;
  }
  /**
   * Wave 7 (R3-130): Look → Walk stands the body where the page's eye stands, or — an eye over water or in the air (page J) —
   * at the page's dry ground point or the nearest dry path node reachable from the square, with a fade (a cut under reduced
   * motion or calm). Never a submerged body, never one in the air. Held while the eye's chunk has not arrived.
   * Returns true when the body moved away from the eye.
   */
  function walkOut(late=false):boolean{
    pendingWalkOut=false;walkOutWait=null;
    const pose=world.views.find(p=>p.id===shotId),atEye=pose&&Math.hypot(body.x-pose.eye[0],body.z-pose.eye[2])<.01&&Math.abs(body.y-(pose.eye[1]-1.6))<.01;
    const out=horizonWalkOut({eye:[body.x,body.y+1.6,body.z],target:atEye?pose!.target:undefined,ground:atEye?pose!.ground:undefined,yaw:body.yaw},world.pathGraph!,walkProbe,(x,z)=>gateOpen(x,z));
    // Codex P2: a point the walk-out must probe has no collision yet (the eye, the page's ground, a node): the body holds where
    // it is — no movement, no fall, no chute (bodyHeld) — and the walk-out runs again when that chunk lands.
    if(out.how==='wait'){pendingWalkOut=true;walkOutWait=[out.x,out.z];resnap=true;scheduler?.retry(heldNow);return false;}
    lastWalkOut={page:atEye?pose!.id:null,how:out.how,node:out.node,moved:+out.moved.toFixed(2),at:[out.x,out.y,out.z]};
    Object.assign(body,{x:out.x,y:out.y,z:out.z});velocityY=0;
    if(out.how==='stand')return false;
    body.yaw=out.yaw;yaw=out.yaw;if(!gateOpen(body.x,body.z))resnap=true;
    fadeCut(late?'':'Walk starts on the nearest dry path.');return true;
  }
  let lastWalkOut:{page:string|null;how:string;node?:string;moved:number;at:XYZ}|null=null;
  /**
   * Leaving Walk: the body becomes the physical body Walk resumes — except a walk-out still pending (the body is at the page's
   * eye, not on ground): then the page choice stands and the next Walk walks out again. A held body's re-seat waits for Walk.
   */
  function leaveWalk(){if(pendingWalkOut){pendingWalkOut=false;walkOutWait=null;pageChosen=true;}else physicalBody={...body};resnap=false;}
  /**
   * PR #561 review (Codex P2): a body standing on ground whose chunk has not arrived — a pending walk-out (Look → Walk before
   * the page's chunk), a held restore, a resume — is HELD: no movement, no fall, no jump, no parachute, until the chunk lands
   * and reseat() finishes what was pending. Without this, the next step() found no floor under the eye (G's floor is only in
   * `undercroft`) and took the unsupported-body path into beginAirborne() — the chute opened instead of the dry walk-out.
   * Fetched bytes are parsed here at once (gateOpen), so the hold ends on the frame the chunk can land.
   */
  function bodyHeld():boolean{
    const at=holdPoint(),frame=horizonFootFrame({walkOut:pendingWalkOut,restore:pendingRestore!==null,resnap},()=>gateOpen(at[0],at[1]));
    if(frame==='free')return false;
    if(frame==='held'){resnap=true;return true;}
    resnap=false;reseat();   // the chunk is resident: the dry walk-out, the restore's validation, or a settle on the floor
    // A walk-out that relocated onto another missing chunk is held again (walkOut set resnap).
    return pendingWalkOut||pendingRestore!==null||(resnap&&!!gate&&gate.missingAt(body.x,body.z).length>0);
  }
  function restore(saved:HouseBodyReturn){
    schedule();
    if(skating()){skate?.controls.setAudio(null);skate?.stop();skate?.publish(performance.now(),true);}
    monorail?.cancel();reportMonorail(true);kitchen?.exit();fleet.stand();physicalBody=null;pageChosen=false;parkRide();if(transition?.live)transition=null;rideGate.clear();
    // Wave 7 (R3-122 a): a same-revision restore into ground whose chunk has not arrived is NOT validated against the partial
    // collision (the terrain under a missing deck, or the water under it): the body holds at its saved height, and the full
    // validation runs when the chunk lands (reseat). Only a restore onto resident ground is validated now.
    const current=saved.geo===HORIZON_GEOGRAPHY&&saved.world===HORIZON_PRESENCE_WORLD&&Number.isFinite(saved.y);
    if(current&&!gateOpen(saved.x,saved.z)){Object.assign(body,{x:saved.x,y:saved.y!,z:saved.z,yaw:saved.yaw});pendingRestore={...saved};scheduler?.retry(heldNow);}
    else{const next=restoreHorizonPosition(saved,world.pathGraph!,geography.ground,restoreStand);Object.assign(body,{x:next.x,y:next.y!,z:next.z,yaw:next.yaw});pendingRestore=null;}
    yaw=body.yaw;mode='walk';path=[];velocityY=0;pendingWalkOut=false;walkOutWait=null;
    // Wave 6: a restore into ground whose chunk has not arrived stands and waits; the body is re-seated when it lands.
    if(!gateOpen(body.x,body.z))resnap=true;updateCamera();
  }

  /** While riding, a reload restores on foot at the nearest threshold of the mode (RIDE §6.5). */
  function savedBody():HouseBodyReturn{saveFleet();airport.save();const physical=hold.body??physicalBody??body,activeCruiser=wheels(),stop=monorail?.state()?.station,platform=stop===undefined?null:MONORAIL_STOPS[stop];const at=registry.mode()==='plane'?AIRPORT.arrival:platform?{x:platform.at[0]+MOUNTAIN_V2_OFFSET.x,y:platform.at[1]+MOUNTAIN_V2_OFFSET.y,z:platform.at[2]+MOUNTAIN_V2_OFFSET.z,yaw:body.yaw}:activeCruiser?(activeCruiser.dismount()??activeCruiser.state().safe):registry.active()&&!isCraft(registry.mode())?savedRideBody(world,physical,registry.mode(),geography.ground):physical;return{x:at.x,y:at.y,z:at.z,yaw:at.yaw,place:'court',world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY};}
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
    if(registry.mode()==='board'||registry.stowed()==='board')mountBoardProxy();else unmountBoardProxy();
    if(wheels()){if(!cruiserArt){cruiserArt=createCruiserArt(cruiserTheme);scene.add(cruiserArt.root);}if(cruiserArt.root.userData.skin!==wheelsLook())cruiserArt.setSkin(wheelsLook());}
    else{cruiserArt?.dispose();cruiserArt=null;}
  }
  function beginAirborne(at:AirborneBody,open:boolean){emote=null;
    // Ride chunk rule (reconciliation 2): a fall cannot wait on the ground, so it is never refused; every missing chunk is put at
    // the front of the queue (fetched bytes parsed now) and the canopy holds at an unloaded boundary (main's `airspaceReady`).
    rideGateOpen();
    if(!registry.deploy(at,performance.now(),open))return false;
    velocityY=0;jumpRequested=false;consumeJumpUntilRelease=consumeJumpUntilRelease||keys.has(' ')||jumpHeld;
    startRide();return true;
  }
  /** The figure over the deck: it faces the travel (body.yaw + slip), feet on the deck top; the deck keeps the nose heading, pitch and roll in world space and stays on the ground under a crouch. */
  const proxyTurn=new THREE.Quaternion(),proxyEuler=new THREE.Euler(0,0,0,'YXZ'),figureInverse=new THREE.Quaternion();
  function poseRider(pose:MoverFrame['pose'],active:ModeController,now:number){
    if(active.id==='plane'){figure.group.position.set(body.x,body.y-.45,body.z);figure.group.rotation.set(-pose.pitch,body.yaw,-pose.roll,'YXZ');figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:'sit',emoteAt:1,flourish:0});return;}
    if(active.id==='cruiser'||active.id==='bicycle'){
      const state=(active as CruiserController).state();
      figure.group.position.set(body.x,body.y+.265,body.z-.12*Math.cos(body.yaw));figure.group.position.x-=.12*Math.sin(body.yaw);
      figure.group.rotation.set(0,body.yaw,comfort.reducedMotion?0:-state.lean);
      figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:null,flourish:0,skatePose:CRUISER_RIDER_POSE});
      return;
    }
    if(isCraft(active.id)){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.set(0,body.yaw,0);figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:active.id==='yacht'?'wave':'sit',emoteAt:1,flourish:0});return;}
    // In a cabin the rider sits when seated (crouch 1) and otherwise stands on the cabin floor (T3 rides notes).
    if(active.id==='gondola'||active.id==='funicular'){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.set(0,body.yaw,0);figure.pose(pose.crouch>=1?0:now*.004,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:pose.crouch>=1?'sit':null,emoteAt:1,flourish:0});return;}
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
  function onFoot(at:MoverBody|null,status:string,cut=false){schedule();
    recordDiagnostic('movement','return to feet','accepted',registry.mode());
    const heldJump=keys.has(' ')||jumpHeld||consumeJumpUntilRelease;
    if(cruiserArt)clear();consumeJumpUntilRelease=heldJump;cruiserArt?.dispose();cruiserArt=null;
    if(cut)transition=null;else blendCamera(moverBlendMs('park',comfort.reducedMotion,comfort.calm),walkFov??camera.fov);unmountBoardProxy();
    if(at){Object.assign(body,{x:at.x,y:at.y,z:at.z,yaw:at.yaw});yaw=body.yaw;}
    velocityY=0;path=[];jumpRequested=false;consumeJumpUntilRelease=consumeJumpUntilRelease||keys.has(' ')||jumpHeld;figure.group.rotation.set(0,body.yaw,0);figure.group.position.set(body.x,body.y,body.z);
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
    schedule();
    const was=comfort;
    comfort={calm:next.calm??comfort.calm,reducedMotion:(next.reducedMotion??comfort.reducedMotion)||appReducedMotion()};
    registry.setReducedMotion(comfort.reducedMotion);registry.setCalm(comfort.calm);
    if(comfort.calm){faceCardsLit=false;faceCards.visible=false;}
    motion=horizonMotion(comfort);regionScene?.setQuiet(!motion.ambientMotion);
    if(motion.transitionMs<=0&&transition&&!transition.live){camera.position.copy(transition.toEye);target.copy(transition.toTarget);camera.lookAt(target);transition=null;}
    if(!comfortCut&&(comfort.reducedMotion&&!was.reducedMotion||comfort.calm&&!was.calm))openComfortCut();
    lastSun=-Infinity;
  }
  function acceptOffer(offer:ThresholdOffer){
    const riding=registry.active()!==null,name=registry.mode(),acceptedBody={...body};
    // v2.2: boarding waits for the island's chunks (parking never waits); the held offer boards from offersAndAccept.
    if(!riding&&offer.to!=='feet'&&(rideGateOpen(),!rideGate.request(offer))){options.onStatus?.(RIDE_WAITS_STATUS);recordDiagnostic('interaction',offer.thresholdId,'waiting','districts loading');return false;}
    if(!registry.accept(offer,{...body},performance.now())){recordDiagnostic('interaction',offer.thresholdId,'rejected','controller declined threshold');return false;}
    recordDiagnostic('interaction',offer.thresholdId,'accepted',offer.to);
    if(offer.to==='feet')onFoot(registry.lastExit(),`Parked the ${name} at ${offer.thresholdId}.`);
    else {if(offer.to==='glider')gliderFrom=offer.thresholdId;if(!riding)startRide();if(comfort.reducedMotion||comfort.calm)openComfortCut(acceptedBody);}
    return true;
  }
  /** Pick-up: save the walk FOV, blend the camera to the mover's (0.8 s; a cut under reduced motion / calm), show the deck. */
  function startRide(){schedule();recordDiagnostic('movement','mount','accepted',registry.mode());emote=null;if(wheels()){clear();wheels()!.resetInput();}else if(isCraft(registry.mode()))clear();if(walkFov===null)walkFov=footFov;path=[];blendCamera(moverBlendMs('pickup',comfort.reducedMotion,comfort.calm),camera.fov);syncEquipment();options.onStatus?.(isCraft(registry.mode())?'W accelerates; S slows then reverses. A/D steer; Space brakes; E interacts. C changes camera.':registry.mode()==='parachute'?'Airborne. Space opens or retracts the parachute.':RIDING_STATUS);}
  /** Leaving Walk (Look / Island / a page) while riding: the mover pauses where it is (R2-01). The mode, the controller and the rider's body are kept; `update` stops; the Look / Island camera takes over. */
  function pauseRide(){
    if(!hold.pause({...body}))return;
    clear();wheels()?.resetInput();
    options.onStatus?.(`The ${registry.mode()} waits where you left it. Choose Walk to ride on.`);
  }
  /** Walk again: the paused rider is put back and the mover camera blends back in (0.8 s; a cut under reduced motion / calm). */
  function resumeRide(){
    const at=hold.resume();if(!at)return false;clear();wheels()?.resetInput();
    Object.assign(body,at);yaw=body.yaw;mode='walk';path=[];lookAcc={dx:0,dy:0};jumpRequested=false;acceptRequested=false;
    const ms=moverBlendMs('pickup',comfort.reducedMotion,comfort.calm);if(!ms)transition=null;   // a cut also drops a Look/Island transition still running
    blendCamera(ms,camera.fov);options.onStatus?.(RIDING_STATUS);return true;
  }
  /** A reload / arrive while riding: the mode ends at the saved-body rule's `mode→feet` threshold through `registry.accept` (the controller exits and is disposed). */
  function parkRide(){
    if(!registry.active())return;
    if(registry.mode()==='plane'){hold.resume();registry.finish();onFoot({...AIRPORT.arrival},'Aircraft secured. Recover it at the terminal if needed.');airport.save();return;}
    if(wheels()){const controller=wheels()!,at=controller.dismount()??controller.state().safe,name=controller.id==='bicycle'?'Bicycle':'Cruiser';hold.resume();registry.finish();onFoot(at,`${name} put away.`);return;}
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
    if(active.id==='plane')perspective.followHeading(f.body.yaw-body.yaw);
    Object.assign(body,{x:f.body.x,y:f.body.y,z:f.body.z,yaw:f.body.yaw});yaw=f.body.yaw;
    ambienceSpeed=f.pose.speed;
    const wet=waterLevel(body.x,body.z),deck=fleet.surface(body.x,body.z,body.y,.1);
    const waterExit=active.id==='parachute'&&active.finished?.()&&wet!==null&&body.y<=wet+.2&&!deck&&fleet.vessels.some(v=>Math.hypot(body.x-v.x,body.z-v.z)<(v.id==='yacht'?85:30));
    if(f.fade&&!waterExit){fadeLabel={label:f.fade.label,at:performance.now()};fadeCut(f.fade.label);if(transition?.live)transition=null;}   // the mover snapped its camera with the body: no blend across a fade
    if(f.camera){camera.position.set(...f.camera.eye);target.set(...f.camera.target);camera.lookAt(target);if(transition?.live)transition.toFov=f.camera.fov;else if(Math.abs(camera.fov-f.camera.fov)>1e-3){camera.fov=f.camera.fov;camera.updateProjectionMatrix();}}
    else updateCamera();
    poseRider(f.pose,active,now);
    if(active.id==='cruiser'||active.id==='bicycle')cruiserArt?.update((active as CruiserController).state(),dt,comfort.reducedMotion||comfort.calm);
    if(!sameHud(lastHud,f.hud)){
      if(active.id==='parachute'&&lastHud?.label!==f.hud.label)recordDiagnostic('parachute','deployment state','changed',f.hud.label??'unknown');
      lastHud={...f.hud};options.onMoverHud?.(lastHud);
    }
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
  function airportActions(){return mode==='walk'&&!paused&&!skating()&&!kitchen?.active()&&!monorail?.state()?airport.actions(body,registry.mode()):[];}
  function airportAction(id:string){
    if(!airportActions().some(a=>a.id===id))return false;
    if(id==='stand'){airport.stand();return true;}if(id.startsWith('sit:')){const seat=airport.sit(id.slice(4));if(seat){clear();Object.assign(body,seat);yaw=seat.yaw;return true;}return false;}
    if(id==='info'){options.onStatus?.('Three local aircraft: Kestrel is gentle, Swift is nimble, Heron is steady. Walk to a parked plane to board. Taxi at low power; align with runway 18 or 36, then add power and gently pull back. '+FLIGHT_CONTROLS);return true;}
    if(id==='exit'){const s=airport.selected();if(!s)return false;if(!s.grounded){const at=registry.active()?.airborne?.();if(!at||!beginAirborne(at,false))return false;}else{const at=airport.exit();if(!at){options.onStatus?.('Stop the aircraft before getting out.');return false;}registry.finish();onFoot(at,'Aircraft parked. Welcome back.');}clear();airport.save();return true;}
    if(id.startsWith('recover:')){const aircraftId=id.slice(8) as AircraftId;const active=registry.mode()==='plane';if(active){registry.finish();onFoot({...AIRPORT.arrival},'Back at the airport.');}if(!airport.recover(aircraftId)){options.onStatus?.('That stand is occupied. Move the other aircraft first.');return false;}options.onStatus?.(AIRCRAFT[aircraftId].name+' recovered to its stand.');clear();return true;}
    if(id.startsWith('board:')){if(!rideGateOpen()){options.onStatus?.(RIDE_WAITS_STATUS);return false;}const aircraftId=id.slice(6) as AircraftId,controller=airport.controller(aircraftId);if(!registry.attach(controller,{id,thresholdId:id,from:'feet',to:'plane',at:[body.x,body.y,body.z],action:'Board',label:'Board'},body,performance.now()))return false;clear();startRide();if(comfort.reducedMotion||comfort.calm)openComfortCut({...AIRPORT.arrival});options.onStatus?.(FLIGHT_CONTROLS);airport.save();return true;}return false;
  }
  // Only offers this registry can take now (gliderPads.ts `liveTravelOffers`): a mode with no registered controller (zip, cart,
  // balloon, ferry…) keeps its thresholds but renders no button that does nothing (Jonathan 2026-10-04: the Prow offers only "run off").
  const travelOffers=()=>liveTravelOffers(registry,body);
  function offersAndAccept():boolean{
    const offer=mode==='walk'&&(!transition||transition.live)?offerToShow(travelOffers(),registry.canAccept):null;
    if(!sameOffer(offer,lastOffer)){lastOffer=offer;options.onOffer?.(offer);}
    // A held boarding stays held while the rider is still at its threshold (a Walk camera tween or a paused frame hides the offer
    // row, not the offer); it boards once every chunk is in, and is dropped only when its offer is no longer there.
    const held=rideGate.pending();
    if(held&&mode==='walk'){rideGateOpen();const here=registry.offers(body).find(o=>o.id===held.id)??null,go=rideGate.poll(here);if(go&&acceptOffer(go)){acceptRequested=false;return false;}}
    if(!acceptRequested)return false;acceptRequested=false;
    const airAction=airportActions()[0];if(airAction&&airportAction(airAction.id))return false;
    const boatAction=fleetActions()[0];if(boatAction&&fleetAction(boatAction.id))return false;
    if(offer&&acceptOffer(offer))return false;
    if(registry.active())return true;
    enterDoor();return false;
  }
  function enterDoor(hostId?:string){if(kitchen?.active()||registry.active())return false;
    if(monorail?.state())return false;
    if(!hostId&&homeWorld.actions(body).some(a=>a.id==='home-book')){clear();options.onHomeBook?.();return true;}   // a rider parks first: a door is not a mode threshold
    const h=hostId?world.hosts.find(h=>h.id===hostId):world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<2.4);if(!h)return false;
    doorCooldown=performance.now()+1800;const out=h.returnAt;if(out){Object.assign(body,{x:out[0],y:out[1],z:out[2],yaw:h.facing??0});yaw=body.yaw;}path=[];options.onDoor?.(h,savedBody());return true;
  }
  function setMode(next:HorizonMode){
    schedule();
    if(monorail?.state()&&next!=='walk')return;
    if(skating()){const at=skate?.stop();if(at){Object.assign(body,at);yaw=at.yaw;}skate?.controls.setAudio(null);skate?.publish(performance.now(),true);}
    let resumeFoot=false;
    if(next!=='walk')kitchen?.pause('The island view is open. Choose Walk and Resume to continue.');
    if(next!=='walk'){if(mode==='walk')leaveWalk();pauseRide();}
    // Reconciliation 2 × main #559: an open galley service holds the body — Walk (then the kitchen's Resume) returns to the
    // galley even after a chosen page; Exit ends the service and page choice is a visit again.
    else if(!registry.active()&&physicalBody&&(!pageChosen||kitchen?.active())){Object.assign(body,physicalBody);yaw=body.yaw;physicalBody=null;resumeFoot=true;}
    else if(registry.active()){pageChosen=false;resumeRide();mode='walk';path=[];updateFog();return;}
    if(next==='walk'&&!resumeFoot&&pageChosen){physicalBody=null;pendingRestore=null;fleet.stand();swimming=false;}
    if(next==='walk')pageChosen=false;   // riding: no walk-camera transition, the mover camera blends back (a cut under reduced motion / calm)
    const fromEye=camera.position.clone(),fromTarget=target.clone();mode=next;path=[];faceCards.visible=faceCardsLit&&mode!=='journey';
    if(next==='journey'){const {w,h}=world.extent;camera.position.set(w/2,w*1.05,h*1.17);target.set(w/2,20,h*.47);camera.lookAt(target);camera.fov=50;camera.updateProjectionMatrix();}
    else if(next==='look')shot(shotId);
    let relocated=false;
    // main's resume (never onto a submerged floor: a swimmer stays at the surface; held, not settled on the partial collision,
    // while its chunk is missing — Codex P2); otherwise the Stage A walk-out.
    if(next==='walk'){footFov=camera.fov;if(resumeFoot){if(!gateOpen(body.x,body.z))resnap=true;else{const at=geography.surface(body.x,body.z,body.y);if(at&&at.slope<=HORIZON_WALKABLE_DEGREES&&!geography.submerged(body.x,body.z,at.y))body.y=at.y;}}else relocated=walkOut();distance=9;pitch=-.26;updateCamera();}
    // A walk-out that relocates the body fades (fadeCut) rather than tweening the camera across the map.
    transition={eye:fromEye,target:fromTarget,toEye:camera.position.clone(),toTarget:target.clone(),at:performance.now(),duration:relocated?0:motion.transitionMs};
    // Reduced motion: a cut, never a tween (CONTRACT §2.10).
    if(transition.duration<=0){const to=transition;transition=null;camera.position.copy(to.toEye);target.copy(to.toTarget);}else{camera.position.copy(fromEye);target.copy(fromTarget);}camera.lookAt(target);
    updateFog();
  }
  function cyclePerspective(){if(mode!=='walk')return;if(kitchen?.active()&&kitchen.view().state.players===2){options.onStatus?.('Shared kitchen view keeps both chefs in sight.');recordDiagnostic('camera','change perspective','rejected','Shared kitchen owns the view');return;}perspective.cycle(body,camera.position.toArray(),target.toArray());transition=null;options.onStatus?.(`${perspectiveLabel(perspective.mode())}. C changes the view.`);recordDiagnostic('camera','change perspective','accepted',perspective.mode());}
  function updateCamera(){if(mode!=='walk')return;
    if(monorail?.state())return;
    if(!registry.active()&&camera.fov!==footFov){camera.fov=footFov;camera.updateProjectionMatrix();}
    const craft=isCraft(registry.mode())?fleet.get(registry.mode() as CraftId):null;
    const aboard=yachtView()!==null;
    const trail=craft?HANDLING[craft.id].camera:aboard?6.5:distance;
    const heading=craft?craft.yaw+fleetLook:yaw;
    const seen=craft||aboard?body:walkView(walkState,body);   // on foot: the walker as drawn (walkSim), not its last fixed step
    const eye:XYZ=[seen.x,seen.y+(craft?.id==='kayak'?.95:1.15),seen.z];
    const desired:XYZ=[eye[0]-Math.sin(heading)*trail,eye[1]+(craft?.id==='yacht'?10:aboard?7:Math.max(1,-Math.sin(pitch)*trail)),eye[2]-Math.cos(heading)*trail];
    let f=1;while(f>.06&&geography.cameraBlocked(eye,[eye[0]+(desired[0]-eye[0])*f,eye[1]+(desired[1]-eye[1])*f,eye[2]+(desired[2]-eye[2])*f],aboard))f-=.04;
    camera.position.set(eye[0]+(desired[0]-eye[0])*f,eye[1]+(desired[1]-eye[1])*f,eye[2]+(desired[2]-eye[2])*f);target.set(...eye);camera.lookAt(target);
  }
  let leftSupport=false;
  const walkState=createWalkState(body);
  function move(dx:number,dz:number,_dt:number):WalkMove{
    // The collision step lives in walkSim (collide and slide); this binds it to the runtime's geography, gate and state.
    const r=walkMove(horizonWalkWorld(geography,world.extent,gateOpen,HORIZON_WALKABLE_DEGREES),body,dx,dz,{swimming,grounded:velocityY===0});
    leftSupport=r.leftSupport;if(r.blocker)lastMovementBlocker=r.blocker;return r;
  }
  let emote:{id:EmoteId;at:number}|null=null;
  function step(dt:number,now:number){
    leftSupport=false;
    if(airport.seated()){if(keys.size||controls.forward||controls.strafe||jumpRequested)airport.stand();else{figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:'sit',emoteAt:1,flourish:0});updateCamera();return;}}
    if(fleet.sitting()){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:'sit',emoteAt:1,flourish:0});updateCamera();return;}
    // Held on ground whose chunk has not arrived (Codex P2): no movement and no airborne physics until reseat().
    // PR #566 Codex: inside the placed region before its scene is drawn (its decks are not answered yet) the body is held the
    // same way — a body on a bridge or the dam crest during a (re)build stays there and is re-seated on the deck once drawn.
    if(!regionReady(body.x,body.z)){resnap=true;regionSettle=true;}
    if(bodyHeld()){velocityY=0;jumpRequested=false;holdStatus();if(!simulating){figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;figure.pose(now*.007,0,now/1000);updateCamera();}return;}
    const at=geography.surface(body.x,body.z,body.y,.1),water=waterLevel(body.x,body.z,body.y);
    swimming=water!==null&&body.y<=water-.3&&(!at||at.y<water-.3);
    let forward=controls.forward+(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),strafe=controls.strafe+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    const dx=Math.sin(yaw)*forward+Math.cos(yaw)*strafe,dz=Math.cos(yaw)*forward-Math.sin(yaw)*strafe;
    if(dx||dz)path=[];
    // walkSim (fixed step): weight on start and release, slides along walls, slope pace, and a route followed through its
    // corners. A pad's analog magnitude still scales the pace (main #557); a route keeps full pace and eases into its end.
    const walked=walkTick(walkState,body,{wishX:dx,wishZ:dz,run:controls.run||keys.has('shift'),speeds:HORIZON_MANIFEST.speeds_ms,swim:swimming?2.4:undefined,route:path.length?path:undefined},dt,(x,z)=>move(x,z,dt));
    const moved=walked.moved;
    if(walked.routeBlocked){path=[];options.onStatus?.('That path is blocked. Choose another approach.');}
    holdStatus();
    const floor=geography.surface(body.x,body.z,body.y,.02),wet=waterLevel(body.x,body.z,body.y);
    swimming=wet!==null&&body.y<=wet-.3&&(!floor||floor.y<wet-.3);
    const unsupported=leftSupport||!floor||body.y-floor.y>.05;
    if(!swimming&&(unsupported||jumpRequested&&!consumeJumpUntilRelease)){
      const vx=walkState.vx+carriedVelocity.x,vz=walkState.vz+carriedVelocity.z;
      if(beginAirborne({...body,velocity:[vx,unsupported?0:4.2,vz]},false))return;
    }
    if(swimming&&wet!==null)body.y=wet-.5;
    jumpRequested=false;
    if(moved>0&&now>doorCooldown&&!swimming){const door=world.hosts.find(h=>'xy'in h.door&&Math.hypot(body.x-h.door.xy[0],body.z-h.door.xy[1],body.y-(h.door.height??0))<1.15);if(door)enterDoor(door.id);}
    // The old shell's emote row (walk-moves): an emote plays while standing; walking or its own length ends it.
    if(emote&&(moved>0||!EMOTE_LOOPS[emote.id]&&(now-emote.at)/1000>EMOTE_SECONDS[emote.id]))emote=null;
    // The figure stands where walkSim shows the body (interpolated, risers eased) and walks by distance, at the walk's speed.
    if(!simulating){const seen=walkView(walkState,body),gait=walkPose(walkState,HORIZON_MANIFEST.speeds_ms);figure.group.position.set(seen.x,seen.y,seen.z);figure.group.rotation.y=body.yaw;if(emote)figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:emote.id,emoteAt:(now-emote.at)/1000,flourish:0});else figure.pose(gait.phase,gait.gait,now/1000,gait.motion);updateCamera();}
  }
  // ---- Pass 5: the placed region (Mountain v2) ----
  // Mounted (one v2 builder per frame) when a district under its footprint is resident outside the Journey map, drawn while
  // that holds, released REGION_RELEASE_MS after it stops. Its materials take the Horizon's fog stage and fade in like a district.
  function releaseRegion(){regionTask?.cancel();regionTask=null;regionScene?.dispose();regionScene=null;regionHooks=[];showRegion(false);}
  function showRegion(visible:boolean){
    if(regionScene)regionScene.group.visible=visible;
    if(monorail)monorail.group.visible=visible||Boolean(monorail.state());
    if(visible===regionVisible)return;regionVisible=visible;if(visible)regionShownAt=performance.now();
    if(visible&&!heldNow.length&&holdText){holdText='';options.onStatus?.('');}   // PR #566 Codex: the region hold's line ends
    for(const resource of stream.live.values())for(const mesh of resource.cards.under??[])mesh.visible=!visible;
    requestShadow('region-visibility');
  }
  function updateRegion(dt:number,now:number){
    if(!placed)return;
    // PR #566 Codex: a walker inside the footprint always wants it (the hold above waits for it to be drawn).
    const wanted=mode!=='journey'&&([...regionDistricts].some(id=>stream.live.has(id))||mode==='walk'&&(placed.region.requiresScene(body.x,body.z)||Boolean(skateDestination&&placed.region.requiresScene(skateDestination.x,skateDestination.z))));
    if(wanted&&!regionScene&&!regionTask)regionTask=createBuildTask(placed.region.mountSteps(scene,tier,placed.dressing(theme),{season:seasonOf(currentTime??new Date()),quiet:!motion.ambientMotion}));
    if(regionTask){const done=regionTask.advance();if(done){regionTask=null;regionScene=done;done.group.visible=false;
      const materials=new Set<THREE.Material>();done.group.traverse(o=>{const m=(o as THREE.Mesh).material;if(m)for(const x of Array.isArray(m)?m:[m])materials.add(x);});
      regionHooks=[...materials].map(material=>fogHook(material));done.setWater(regionWater.level,regionWater.reserve);if(regionTransit)done.setTransit(regionTransit.cabin,regionTransit.kind);}}
    showRegion(wanted&&regionScene!==null);
    for(const cards of coarse.values())for(const mesh of cards.under??[])mesh.visible=mode==='journey'||!regionVisible;
    if(wanted)regionIdleSince=0;else if(!regionIdleSince)regionIdleSince=now;else if(now-regionIdleSince>REGION_RELEASE_MS&&(regionScene||regionTask))releaseRegion();
    if(!regionScene||!regionVisible)return;
    const fadeLevel=motion.districtFadeMs>0?Math.min(1,Math.max(0,(performance.now()-regionShownAt)/motion.districtFadeMs)):1;for(const hook of regionHooks)hook.fade.value=fadeLevel;
    regionScene.animate(dt,now/1000);
  }
  let residencyRevision=-1,residencyMode:HorizonMode|undefined;
  const residentIds=new Set<string>();
  let peerKey='',paintCount=0;
  const readPeer=()=>horizonPartnerPose(options.partner?.());
  const partnerKey=(peer:ReturnType<typeof readPeer>)=>peer?`${peer.x}:${peer.y}:${peer.z}:${peer.yaw}:${peer.opacity}:${peer.moving}`:'';
  /** One skating frame: the old skate steps in native space; the Horizon body follows it and its chase camera leads. */
  function skateStep(dt:number){
    const frame=skate?.step(skate.controls.paused()?0:dt);if(!frame)return;
    body.x=frame.body.x;body.y=frame.body.y;body.z=frame.body.z;body.yaw=frame.body.yaw;path=[];
    const shot=skate!.camera(dt,camera.aspect||1.6,comfort.reducedMotion);if(!shot)return;
    camera.position.set(...shot.eye);target.set(...shot.target);camera.up.set(0,1,0);camera.lookAt(target);if(shot.roll)camera.rotateZ(shot.roll);
    if(Math.abs(camera.fov-shot.fov)>1e-3){camera.fov=shot.fov;camera.updateProjectionMatrix();}
  }
  function monorailStep(dt:number,now:number){
    const pose=monorail?.update(dt);if(!pose)return;
    Object.assign(body,{x:pose.at[0],y:pose.at[1],z:pose.at[2],yaw:pose.yaw});yaw=pose.yaw;path=[];
    figure.group.position.set(body.x,body.y,body.z);figure.group.rotation.y=body.yaw;
    figure.pose(0,0,now/1000,{lean:0,bank:0,run:0,air:0,rise:0,crouch:0,slide:0,emote:monorail?.state()?.seated?'sit':null,emoteAt:1,flourish:0});
    const view=monorail!.camera();if(view){camera.position.set(...view.eye);target.set(...view.target);camera.lookAt(target);}
    reportMonorail();
  }
  function tick(now:number){if(disposed)return false;const workStarted=performance.now(),frameMs=last?now-last:0;if(qualityDirty&&lease.active){applyHorizonQuality(renderer,sun,adaptiveQuality.profile(window.devicePixelRatio));qualityDirty=false;}const dt=Math.min(kitchen?.active() ? .1 : wheels() ? .1 : .05,Math.max(0,(now-(last||now))/1000));if(last)frameTimes.push(now-last);if(frameTimes.length>3600)frameTimes.shift();last=now;
    let stepped=false;
    if(!paused&&!document.hidden&&mode==='walk'&&!hold.paused()&&!monorail?.state()){physicalBody=null;tickFleet(dt);}
    if(kitchen?.active()){if(!paused&&!document.hidden&&mode==='walk')kitchen.update(dt);}
    else kitchen?.update(0);
    if(!paused&&!document.hidden){const accept=comfortCut||kitchen?.active()||monorail?.state()?false:offersAndAccept();if(mode==='walk'&&!kitchen?.active()&&(!transition||transition.live)){stepped=true;if(monorail?.state())monorailStep(dt,now);else if(skating())skateStep(dt);else if(registry.active()){if(!comfortCut&&hold.steps(mode)&&riderReady())ride(dt,now,accept);}else if(!comfortCut)step(dt,now);}if(mode!=='journey')stream.update({x:body.x,z:body.z,now,mode:mode==='look'?'look':'walk',radius:mode==='look'?world.views.find(v=>v.id===shotId)?.radius:undefined,keepRadius:world.views.find(v=>v.id===shotId)?.radius,underground:body.y+HORIZON_BODY_HEIGHT<geography.ground(body.x,body.z)-.5});}
    // Pass 5: the ambience reads Mountain v2's geography (the river, its paths), so with the region placed it hears native space.
    // PR #566 CodeRabbit: only inside the region's footprint; elsewhere the Horizon body is what it hears.
    const heard=placed&&placed.region.requiresScene(body.x,body.z)?{x:body.x-MOUNTAIN_V2_OFFSET.x,y:body.y-MOUNTAIN_V2_OFFSET.y,z:body.z-MOUNTAIN_V2_OFFSET.z}:body;
    if(ambience){if(paused)ambience.pause();else ambience.update(heard.x,heard.y,heard.z,ambienceSpeed,false,false,comfort.calm,registry.mode()==='glider'||registry.mode()==='parachute');}
    // The shared card clock (wind in v2's planting, water sheen) runs with ambient motion; calm and reduced motion hold it.
    if(placed&&motion.ambientMotion)CARD_CLOCK.value=now/1000;
    updateRegion(dt,now);
    for(const art of [...moverArts])if(!art.tick(dt,figure.group))removeMoverArt(art);
    if(residencyRevision!==stream.revision||residencyMode!==mode){
      residencyRevision=stream.revision;residencyMode=mode;residentIds.clear();for(const id of stream.live.keys())residentIds.add(id);
      ring.updateResidency(residentIds,mode==='journey');cableLayer.update(residentIds,mode==='journey');
      for(const [id,cards]of coarse)cards.group.visible=mode==='journey'||!stream.live.has(id);
    }
    // Fine districts rise from the fog colour over 0.8 s (a cut under reduced motion); the coarse card they replace hides at once.
    for(const resource of stream.live.values()){resource.cards.group.visible=mode!=='journey';if(resource.chalk)resource.chalk.visible=night&&mode!=='journey';resource.fadeIn(motion.districtFadeMs>0?Math.min(1,Math.max(0,(now-resource.at)/motion.districtFadeMs)):1);}
    // Road main: the corridor's art and planting follow the resident districts (hidden on the Journey map).
    bridgeArt.group.visible=corridorArt.group.visible=corridorPlanting.group.visible=mode!=='journey';if(mode!=='journey'){bridgeArt.update(residentIds);corridorArt.update(camera,residentIds);corridorPlanting.update(camera,residentIds);}
    if(transition){
      if(transition.live&&stepped){transition.toEye.copy(camera.position);transition.toTarget.copy(target);}   // ride()/step() just set this frame's goal camera
      const t=transition.duration>0?Math.min(1,Math.max(0,(now-transition.at)/transition.duration)):1,ease=transition.live?moverBlendEase(now-transition.at,transition.duration):t*t*(3-2*t);
      camera.position.lerpVectors(transition.eye,transition.toEye,ease);target.lerpVectors(transition.target,transition.toTarget,ease);camera.lookAt(target);
      if(transition.fov!==undefined&&transition.toFov!==undefined){const fov=transition.fov+(transition.toFov-transition.fov)*ease;if(Math.abs(camera.fov-fov)>1e-3){camera.fov=fov;camera.updateProjectionMatrix();}}
      if(t===1)transition=null;
    }
    skate?.publish(now);
    const chosen=mode==='walk'&&!skating()&&!monorail?.state()?(()=>{const seen={...body,...walkView(walkState,body)};return perspective.pose(seen,(a,b)=>geography.cameraBlocked(a,b,yachtView()!==null),geography.ceiling(seen.x,seen.z,seen.y));})():null;
    if(chosen){camera.position.set(...chosen.eye);target.set(...chosen.target);if(camera.fov!==chosen.fov){camera.fov=chosen.fov;camera.updateProjectionMatrix();}camera.lookAt(target);}
    const firstPerson=mode==='walk'&&perspective.mode()==='first-person';
    // The skate's look adopts the figure and its chase camera is external, so the rider shows in any perspective (PR #571 review).
    figure.group.visible=mode==='walk'&&(!firstPerson||skating())&&!kitchen?.active();
    // Own equipment is hidden locally in first person; activity and floating retain the full canopy.
    for(const art of moverArts)if(firstPerson)art.object.visible=false;
    if(cruiserArt)cruiserArt.root.visible=mode==='walk'&&!firstPerson;
    if(registry.mode()!=='glider')gliderFrom=null;
    gliderPads.update(body,gliderFrom,mode!=='journey',(x,z)=>gateOpen(x,z)&&stream.live.has(districtAt(x,z)),night);
    homeWorld.update(body,mode,firstPerson);fleetArt.update(body,yachtView()!==null,mode==='journey',!firstPerson,yachtView()?.y);
    const roomMarkers=fleetArt.root.getObjectByName('yacht-room-markers');if(roomMarkers&&kitchen?.active())roomMarkers.visible=false;
    kitchen?.render(camera,target,mode==='walk');
    const cutawayKey=`${yachtView()?Math.floor(yachtView()!.y-fleet.yacht.y):'outside'}:${perspective.mode()}:${mode}`;if(cutawayKey!==lastFleetCutaway){lastFleetCutaway=cutawayKey;requestShadow('fleet-cutaway');}
    if(now-lastFleetSave>2000){lastFleetSave=now;saveFleet();}
    const peer=readPeer();peerKey=partnerKey(peer);partner.group.visible=Boolean(peer)&&mode!=='journey';if(peer){fade(partnerMaterials,peer.opacity);partner.group.position.set(peer.x,peer.y??geography.ground(peer.x,peer.z),peer.z);partner.group.rotation.y=peer.yaw;partner.pose(motion.ambientMotion?now*.007:0,peer.moving?1:0,motion.ambientMotion?now/1000:0);}
    // Calm and reduced motion hold the frozen 15:30 (no night, no sun step); a review date never overrides them.
    if(now-lastSun>=60_000){setLight(motion.sunFollowsClock&&currentTime?currentTime:solarReviewDate(new Date(),location.search,{dev:HARBOUR_DEV,reducedMotion:comfort.reducedMotion,calm:comfort.calm}));lastSun=now;}
    updateLocalLights(now);
    airport.update(paused||mode!=='walk'?0:Math.max(0,frameMs/1000),mode==='journey',camera.position,night?1:0,perspective.mode()==='first-person');
    skyDome.follow(camera);renderer.render(scene,camera);paintCount++;if(interactiveAt===null){interactiveAt=performance.now();options.onReady?.();void prefetchChunks();}if(drawSamples.length===0||now-drawSamples.at(-1)!.at>500){drawSamples.push({at:now,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resident:stream.live.size});if(drawSamples.length>600)drawSamples.shift();}
    const building=stream.building||!!regionTask||corridorArt.building()||(mode!=='journey'&&bridgeArt.building())||stream.live.size<stream.cap&&Boolean(stream.history.at(-1)?.pending.some(id=>!chunks||chunks.ready(id)));
    const fading=motion.districtFadeMs>0&&([...stream.live.values()].some(resource=>now-resource.at<motion.districtFadeMs)||regionVisible&&performance.now()-regionShownAt<motion.districtFadeMs);
    const continuous=!paused&&(mode==='walk'||skating()||!!transition||mode!=='journey'&&(building||fading||!!peer&&motion.ambientMotion||roadLights.busy(now))||moverArts.size>0);
    // Queue a quality change for the next paint: resizing after render would clear this frame.
    if(continuous&&frameMs>0&&adaptiveQuality.sample(frameMs,performance.now()-workStarted))qualityDirty=true;
    return continuous;
  }
  function schedule(){frameDriver?.wake();}
  const offers=()=>!kitchen?.active()&&mode==='walk'&&!paused&&!skating()&&!monorail?.state()?travelOffers():[];
  function acceptPublic(offer?:ThresholdOffer):HorizonAccept|null|void{
    if(kitchen?.active())return null;
    if(!offer){acceptRequested=true;return;}
    if(!registry.canAccept(offer)||!acceptOffer(offer))return null;
    return{mode:registry.mode(),controller:registry.active(),cut:comfortCut};
  }
  /** A page chosen by the reader (the page picker, a comfort cut to a view): Walk then starts from it (see `pageChosen`). */
  function pickPage(id:string){const ok=shot(id);if(ok)pageChosen=true;return ok;}
  function cutTo(to:HorizonCutTarget){
    if(to.kind==='view'){
      const holdAt=comfortCutBody,out=registry.finish();
      if(out||holdAt)onFoot(holdAt??out,'Flight paused.');
      return pickPage(to.id);
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
  function keyDown(e:KeyboardEvent){if(paused)return;schedule();const key=e.key.toLowerCase();if(monorail?.state())return;if(skating()){if(interactive(e)||!host.contains(document.activeElement))return;if(!['b','p','escape'].includes(key)&&skate!.controls.input()?.keyDown(e))e.preventDefault();return;}if(kitchen?.active()){const focused=document.activeElement;if(!host.parentElement?.contains(focused)||focused?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')||(['enter',' '].includes(key)&&focused?.closest('button,a')))return;if(key==='c'&&!e.repeat){e.preventDefault();cyclePerspective();}else if(kitchen.keyDown(e))e.preventDefault();return;}if(interactive(e)||!host.contains(document.activeElement))return;if(key==='e'&&!e.repeat&&kitchen?.available()){e.preventDefault();kitchen.command({type:'open'});return;}if(suppressedKeys.has(key)){if(e.repeat){e.preventDefault();return;}suppressedKeys.delete(key);if(key===' ')consumeJumpUntilRelease=false;}if(registry.mode()==='plane'&&['[',']','x','q','r'].includes(key)){e.preventDefault();if(key==='x')airport.brake(true);else if(key==='q'||key==='r')keys.add(key);else{const s=airport.selected();if(s)airport.power(stepThrottle(s.id,s.throttle,key===']'?.1:-.1));}return;}if(key==='v'&&!e.repeat){e.preventDefault();toggleCruiser();return;}if(key==='r'&&wheels()&&!e.repeat){e.preventDefault();recoverRide();return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' '].includes(key)){e.preventDefault();keys.add(key);if(key===' '&&!e.repeat&&!consumeJumpUntilRelease)jumpRequested=true;}if(key==='c'&&!e.repeat){e.preventDefault();cyclePerspective();}if(key==='q'&&!e.repeat&&fleetActions().some(a=>a.kind==='anchor')){e.preventDefault();fleetAction('anchor');return;}if(key==='e'){e.preventDefault();if(!e.repeat)acceptRequested=true;}if(key==='escape')path=[];}
  const suppressedKeys=new Set<string>();
  function hostBlur(event:FocusEvent){if(kitchen?.active()&&event.relatedTarget instanceof Node&&host.parentElement?.contains(event.relatedTarget))return;clear();}
  function focusPause(){kitchen?.pause('The window lost focus. Resume when both chefs are ready.');if(skating()&&!skate!.controls.paused())skate!.controls.pause(true);clear();}
  function visibilityClear(){if(document.hidden){focusPause();last=0;frameDriver?.suspend();}else schedule();}
  function keyUp(e:KeyboardEvent){if(e.key.toLowerCase()==='x')airport.brake(false);if(skating()&&skate!.controls.input()?.keyUp(e))e.preventDefault();kitchen?.keyUp(e);keys.delete(e.key.toLowerCase());suppressedKeys.delete(e.key.toLowerCase());if(e.key===' '){consumeJumpUntilRelease=false;jumpHeld=false;}}
  function clear(){airport.brake(false);skate?.controls.input()?.reset();kitchen?.clear();for(const key of keys)suppressedKeys.add(key);keys.clear();controls={forward:0,strafe:0,run:false};path=[];drag=null;jumpHeld=false;jumpRequested=false;moverActionRequested=null;consumeJumpUntilRelease=suppressedKeys.has(' ');acceptRequested=false;lookAcc={dx:0,dy:0};wheels()?.resetInput();fleet.resetInput();}
  const unlisten=[lease.listenCanvas<Event>('webglcontextlost',event=>{event.preventDefault();contextLost=true;adaptiveQuality.interrupt();frameDriver?.suspend();}),lease.listenCanvas<Event>('webglcontextrestored',()=>{if(disposed||!lease.active)return;configure(renderer);adaptiveQuality.interrupt();last=0;resize(false);requestShadow('context-restore');}),lease.listenCanvas<PointerEvent>('pointerdown',e=>{if(paused)return;host.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,id:e.pointerId,travel:0};renderer.domElement.setPointerCapture(e.pointerId);}),lease.listenCanvas<PointerEvent>('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;schedule();const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.travel+=Math.hypot(dx,dy);drag.x=e.clientX;drag.y=e.clientY;if(perspective.mode()!=='activity'&&mode==='walk')perspective.look(-dx*.005,-dy*.004);
      else{lookAcc.dx-=dx*.005;lookAcc.dy-=dy*.004;yaw-=dx*.005;pitch=Math.max(-1.2,Math.min(.8,pitch-dy*.004));}if(mode==='look'){target.set(camera.position.x+Math.sin(yaw)*Math.cos(pitch)*distance,camera.position.y+Math.sin(pitch)*distance,camera.position.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target);}}),lease.listenCanvas<PointerEvent>('pointerup',e=>{const click=drag&&drag.travel<5;drag=null;if(!click||mode!=='walk'||paused||registry.active()||kitchen?.active())return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObjects([...stream.live.values()].map(r=>r.cards.group).concat(bridgeArt.group),true);const hit=hits[0];if(hit){const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],[hit.point.x,hit.point.y,hit.point.z],{stepFree:true});if(plan){path=[...plan.points];routeAhead(plan.points);}else options.onStatus?.('No connected walking route reaches that point.');}}),lease.listenCanvas<WheelEvent>('wheel',e=>{schedule();if(paused)return;e.preventDefault();if(perspective.mode()==='floating'&&mode==='walk'){perspective.zoom(e.deltaY);return;}if(registry.active())return;distance=Math.max(2,Math.min(45,distance*Math.exp(e.deltaY*.001)));updateCamera();},{passive:false})];
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',focusPause);document.addEventListener('visibilitychange',visibilityClear);host.addEventListener('blur',hostBlur);
  shot(new URLSearchParams(location.search).get('shot')??'A');if(options.initialBody)restore(options.initialBody);
  if(fleetRestore){Object.assign(body,fleetRestore.body);yaw=body.yaw;mode='walk';if(fleetRestore.pilot){const id=fleetRestore.pilot;registry.accept({id:'restore-fleet',thresholdId:'fleet-restore',from:'feet',to:id,at:[body.x,body.y,body.z],action:'Resume boat',label:'Resume boat'},body,performance.now());startRide();}updateCamera();}
  kitchen=createKitchenActivity({fleet,scene,storageKey:options.kitchenStorageKey??'hearth:yacht-kitchen:review:v1',theme,viewport:()=>({width:host.clientWidth,height:host.clientHeight}),body:()=>body,setBody:at=>{Object.assign(body,at);yaw=at.yaw;velocityY=0;},canOpen:()=>mode==='walk'&&!paused&&!registry.active()&&!fleet.sitting()&&velocityY===0,canPlay:()=>mode==='walk'&&!paused&&!document.hidden,movementYaw:()=>perspective.mode()==='activity'?0:Math.atan2(target.x-camera.position.x,target.z-camera.position.z)-fleet.yacht.yaw,perspective:()=>perspective.mode(),choosePerspective:value=>{for(let i=0;i<3&&perspective.mode()!==value;i++)perspective.cycle(body,camera.position.toArray(),target.toArray());transition=null;},status:message=>options.onStatus?.(message),clearWorldInput:clear,reducedMotion:()=>comfort.reducedMotion});
  const saveAll=()=>{airport.save();saveFleet();kitchen?.save();};window.addEventListener('pagehide',saveAll);
  frameDriver=createHorizonFrameLoop({active:()=>!disposed&&!contextLost&&!document.hidden&&lease.active,request:callback=>lease.requestFrame(callback),cancel:id=>lease.cancelFrame(id),
    frame:(now,resumed)=>{if(resumed){last=0;adaptiveQuality.interrupt();}return tick(now);},
    poll:()=>performance.now()-lastSun>=60_000||mode!=='journey'&&partnerKey(readPeer())!==peerKey||!paused&&mode!=='journey'&&performance.now()>=stream.nextMaintenanceAt,
    delay:callback=>window.setTimeout(callback,100),clearDelay:id=>window.clearTimeout(id)});
  resize();schedule();
  /** Ride / Get off (V, the Ride and Bike buttons). `kind` picks the vehicle for this ride (the saved style otherwise);
   *  the cruiser and the bicycle are one sim (cruiser/sim.ts) under two registry modes. */
  function toggleCruiser(kind?:'cruiser'|'bicycle'){
    if(kitchen?.active()||paused)return false;
    const active=wheels();
    if(active&&(!kind||kind===active.id)){
      const airborne=active.airborne?.();
      if(airborne){resumeRide();clear();mode='walk';return beginAirborne(airborne,false);}
      const at=active.dismount();
      if(!at){options.onStatus?.(active.state().grounded?'No clear place beside you. Move into an open spot or use Recover.':'No safe dismount is available yet.');return false;}
      hold.resume();mode='walk';const offer:ThresholdOffer={id:active.id+'-park',thresholdId:'beside-'+active.id,from:active.id,to:'feet',at:[at.x,at.y,at.z],action:'Get off',label:'Get off'};
      return acceptOffer(offer);
    }
    if(active&&kind){swapWheels(kind);return true;}
    if(registry.active()){options.onStatus?.('Park your current ride first.');return false;}
    if(mode!=='walk')setMode('walk');
    if(!rideGateOpen()){options.onStatus?.(RIDE_WAITS_STATUS);return false;}
    const to=kind??rideModeFor(cruiserSkin),name=to==='bicycle'?'bicycle':'cruiser';
    if(fleet.sitting()||fleet.support(body)){options.onStatus?.(`Step ashore to ride the ${name}.`);return false;}
    const at=validCruiserPosition(geography,body);if(!at||velocityY!==0){options.onStatus?.('Stand on clear, dry ground to ride.');return false;}
    Object.assign(body,at);transition=null;
    return acceptOffer({id:to+'-pickup',thresholdId:'beside-rider',from:'feet',to,at:[at.x,at.y,at.z],action:'Ride',label:'Ride'});
  }
  /** Change between the motor styles and the bicycle mid-ride: the same spot and heading; the new vehicle starts from rest. */
  function swapWheels(to:'cruiser'|'bicycle'){
    const active=wheels();if(!active||active.id===to)return;
    const s=active.state(),at:MoverBody={x:s.x,y:s.y,z:s.z,yaw:s.yaw};
    if(!s.grounded){options.onStatus?.('Land first, then change the ride.');return;}
    if(!registry.accept({id:active.id+'-swap',thresholdId:'beside-rider',from:active.id,to:'feet',at:[at.x,at.y,at.z],action:'Get off',label:'Get off'},at,performance.now()))return;
    if(!registry.accept({id:to+'-swap',thresholdId:'beside-rider',from:'feet',to,at:[at.x,at.y,at.z],action:'Ride',label:'Ride'},at,performance.now())){onFoot(at,'The ride could not change here.');return;}
    clear();wheels()?.resetInput();syncEquipment();
  }
  function recoverRide(){const active=wheels();if(!active)return false;clear();const ok=active.recover();options.onStatus?.(ok?'Ready to ride.':'No clear recovery spot nearby.');return ok;}
  // ---- Road-specific read-only probe; the global Inspector owns `=` ----
  const inspectorSource:InspectorSource={tier,sha:new URLSearchParams(location.search).get('sha'),   // scripts pass ?sha=<git sha> (flag.ts alone reads the build env)
    body:()=>body,mode:()=>mode,perspective:()=>perspective.mode(),mover:()=>registry.mode(),
    motion:()=>{const plane=airport.selected();if(plane)return{speed:plane.speed,grounded:plane.grounded,contact:plane.disabled?'aircraft-stopped':null};const c=wheels()?.state();return c?{speed:Math.hypot(c.vx,c.vz),grounded:c.grounded,contact:c.contact}:registry.active()?{speed:ambienceSpeed,grounded:registry.active()?.airborne?.()?false:null}:{speed:null,grounded:null};},
    surface:(x,z,y)=>geography.surface(x,z,y),solid:id=>{const s=solidsById.get(id);return s?{role:s.role,kind:s.kind,surface:s.surface}:null;},
    corridors:()=>world.corridors,frames:()=>frameTimes,render:()=>drawSamples.at(-1)??null,resident:()=>[...stream.live.keys()],
    lights:()=>({...roadLights.stats()}),blocker:()=>lastMovementBlocker,clock:()=>api.reviewDate()};
  const inspector=createInspector(host,inspectorSource,{enabled:inspectorEnabled(location.search,HARBOUR_DEV),focusBack:()=>host.focus({preventScroll:true})});
  const api={world,assets,scene,camera,geography,airportActions,airportAction,airportState:airport.state,airportPower:(value:number)=>{schedule();airport.power(value);},airportBrake:(on:boolean)=>{schedule();airport.brake(on);},airportTakeoff:()=>{schedule();return airport.takeoff();},airportRudder:(value:number)=>{schedule();controls={...controls,rudder:Math.max(-1,Math.min(1,value))};},shot:pickPage,setMode,restore,savedBody,enterDoor,
    /** Development replay uses the exact live controllers/collision without waiting for rendered frames. */
    simulateMotion(seconds:number){if(!HARBOUR_DEV)throw new Error('Development replay only.');const steps=Math.ceil(Math.max(0,Math.min(120,seconds))*60);for(let i=0;i<steps;i++){if(paused||mode!=='walk'||hold.paused())break;physicalBody=null;tickFleet(1/60);if(kitchen?.active())kitchen.update(1/60);else if(registry.active())ride(1/60,performance.now()+i*1000/60,false);else step(1/60,performance.now()+i*1000/60);}homeWorld.update(body,mode);fleetArt.update(body,yachtView()!==null,mode==='journey',perspective.mode()!=='first-person',yachtView()?.y);return{body:{...body},vessels:fleet.snapshot().vessels};},
    kitchenView:()=>kitchen!.view(),kitchenCommand:(command:KitchenCommand)=>{if(command.type==='resume'&&mode!=='walk')setMode('walk');return kitchen!.command(command);},kitchenInput:(chef:ChefId,value:Partial<KitchenChefInput>)=>kitchen!.input(chef,value),setKitchenSound:(on:boolean,gesture=false)=>kitchen!.setSound(on,gesture),
    fleetActions,fleetAction,cycleCamera,fleetState:()=>({vessels:fleet.snapshot().vessels,swimming,perspective:perspective.mode(),sitting:fleet.sitting(),saveFailed:fleetSaveFailed}),
    /** The three glider launch pads for the Guide (Jonathan 2026-10-04). */
    gliderPads:()=>padStands.map(p=>({id:p.id,label:p.label})),
    /** The pad within `radius` (3D) of the body, for the first-approach hint; null when none or not walking. */
    gliderPadNear:(radius?:number)=>mode==='walk'&&!registry.active()?gliderPadNear(padStands,body,radius)?.id??null:null,
    /**
     * The Guide's "Glider launches": stand on the pad's deck at its threshold, facing the run-off, the offer in reach, with the
     * walk-out fade (a cut under reduced motion / calm). Refused while riding or airborne, in the galley, on the monorail,
     * seated or skating (`gliderPadRefusal`). A deck whose chunk has not arrived holds the body (`restore`) until it lands.
     */
    goToGliderPad(id:GliderPadId):{ok:true}|{ok:false;reason:string}{
      schedule();
      const refused=gliderPadRefusal({riding:registry.active()!==null,airborne:!!registry.active()?.airborne?.(),kitchen:!!kitchen?.active(),monorail:!!monorail?.state(),seated:!!airport.seated(),sitting:fleet.sitting()!==null,skating:skating()});
      const pad=padStands.find(p=>p.id===id);
      if(refused||!pad){const reason=refused??'That launch is not on this island.';options.onStatus?.(reason);recordDiagnostic('interaction',`glider pad ${id}`,'rejected',reason);return{ok:false,reason};}
      // Recomputed now, not at mount: the deck (and the Crown's Mountain v2 ground) may have arrived since, which sets the run-off heading.
      const stand=gliderPads.placements().find(p=>p.id===id)?.stand??gliderPadStand(world,id,padGround)?.stand??pad.stand;
      // From Look / Island the walk camera and its FOV come back first (as Walk does), then the body stands on the pad.
      if(mode!=='walk')setMode('walk');
      restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:stand.x,y:stand.y,z:stand.z,yaw:stand.yaw});
      transition=null;fadeCut(`${pad.label} launch. Press E to run off.`);recordDiagnostic('interaction',`glider pad ${id}`,'accepted');
      return{ok:true};
    },
    arrive(hostId:string){const h=world.hosts.find(h=>h.id===hostId);if(!h||!h.returnAt)return false;restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:h.returnAt[0],y:h.returnAt[1],z:h.returnAt[2],yaw:(h.facing??0)+Math.PI});return true;},
    /** Review-only: run the district stream and the region build to completion without waiting for frames (headless captures
     * at 1 fps advance a 3 ms build budget once a second; a page's four districts took minutes). Returns what is still pending. */
    settle(maxMs=60_000){if(!HARBOUR_DEV)throw new Error('Settling is a review-only control.');const end=performance.now()+Math.max(0,Math.min(maxMs,600_000));let busy=true;
      while(busy&&performance.now()<end){const now=performance.now();const pose=world.views.find(v=>v.id===shotId);busy=mode!=='journey'&&stream.update({x:body.x,z:body.z,now,mode:mode==='look'?'look':'walk',radius:mode==='look'?pose?.radius:undefined,keepRadius:pose?.radius,underground:body.y+HORIZON_BODY_HEIGHT<geography.ground(body.x,body.z)-.5});updateRegion(0,now);if(mode!=='journey'){bridgeArt.update(new Set(stream.live.keys()));busy=busy||bridgeArt.building();}busy=busy||regionTask!==null;}
      schedule();return{pending:stream.history.at(-1)?.pending??[],region:placed?{mounted:regionScene!==null,building:regionTask!==null}:null};},
    simulateWalk(seconds:number){if(!HARBOUR_DEV)throw new Error('Simulation is a review-only control.');const count=Math.ceil(Math.max(0,Math.min(seconds,3600))/.05);simulating=true;try{for(let i=0;i<count&&path.length;i++)step(.05,performance.now()+i*50);}finally{simulating=false;updateCamera();}return{body:{...body},remaining:path.length,blocker:lastMovementBlocker};},
    toggleCruiser,recoverCruiser:recoverRide,
    setCruiserTheme(theme:VehicleDressing){schedule();if(cruiserTheme===theme)return;cruiserTheme=theme;airport.setTheme(theme);if(cruiserArt){cruiserArt.dispose();cruiserArt=createCruiserArt(theme);cruiserArt.setSkin(wheelsLook());scene.add(cruiserArt.root);}},
    setCruiserSkin(skin:CruiserSkin){schedule();cruiserSkin=skin;const active=wheels();if(active&&active.id!==rideModeFor(skin))swapWheels(rideModeFor(skin));else if(active)syncEquipment();},
    cruiserState:()=>wheels()?.state()??null,
    body:()=>({...body}),mode:()=>mode,shotId:()=>shotId,
    setTheme(next:VehicleDressing){if(next===theme)return;theme=next;airport.setTheme(next);bridgeArt.dispose();bridgeArt=createBridgeArt(world,{tier,theme,material:fogHook,changed:()=>requestShadow('bridge-art')});bridgeArt.setNight(corridorNight);scene.add(bridgeArt.group);unmountCorridor();mountCorridor(currentTime??new Date());roadLights.dispose();roadLights=makeRoadLights();roadLights.refresh();skate?.setTheme(next);gliderPads.setTheme(next);if(regionScene||regionTask)releaseRegion();if(placed)monorail?.setTheme(placed.dressing(next));kitchen?.setTheme(next);fleetArt.dispose();fleetArt=createFleetArt(fleet,theme);scene.add(fleetArt.root);homeWorld.update(body,mode);fleetArt.update(body,yachtView()!==null,mode==='journey',perspective.mode()!=='first-person',yachtView()?.y);requestShadow('fleet-theme');},
    setAvatar(next:PlayableAvatar|null){const previous=figure;figure=next?createPlayableFigure(next,tier,{invalidate:schedule,onStatus:options.onAvatarStatus}):createBodyFigure();scene.add(figure.group);skate?.setFigure(figure);previous.group.removeFromParent();previous.dispose();schedule();},
    settings:()=>({tier,reducedMotion:comfort.reducedMotion,calm:comfort.calm,theme}),reviewDate:()=>(motion.sunFollowsClock&&currentTime?currentTime:solarReviewDate(new Date(),location.search,{dev:HARBOUR_DEV,reducedMotion:comfort.reducedMotion,calm:comfort.calm})),setAmbience(audio:WorldAmbience|null){ambience=audio;schedule();},
    inspectorRead(){
      const road=buildInspectorSnapshot(inspectorSource),station=road.station;
      const support=fleet.support(body),ground=support??geography.surface(body.x,body.z,body.y,.1),active=registry.active(),modeId=registry.mode();
      const board=modeId==='board'?(active as {state?:()=>GroundState}|null)?.state?.()??null:null,cruiserData=wheels()?.state()??null;
      const speed=board?Math.hypot(board.v[0],board.v[2]):cruiserData?Math.hypot(cruiserData.vx,cruiserData.vz):ambienceSpeed;
      const yacht=fleet.yacht,vessel=isCraft(modeId)?fleet.get(modeId):support?yacht:null,dx=body.x-yacht.x,dz=body.z-yacht.z,cos=Math.cos(yacht.yaw),sin=Math.sin(yacht.yaw);
      const details={supportId:ground?.id??null,supportMaterial:ground?.material??null,supportSlopeDegrees:ground?.slope??null,supportNormal:ground?`${ground.nx.toFixed(2)}/${ground.ny.toFixed(2)}/${ground.nz.toFixed(2)}`:null,
        roadStation:'none' in station?station.none:`${station.road} / ${station.reach} / ${station.s.toFixed(1)}`,roadContext:'none' in station?null:station.context,roadStructure:'none' in station?null:station.structureId,roadOffset:'none' in station?null:station.offset,roadSide:'none' in station?null:station.side,roadSurfaceRole:road.surface?.role??null,roadHeading:road.heading.degrees,
        boardStep:board?.step??null,boardGrip:board?.grip??null,boardSteer:lastInput&&board?lastInput.steer:null,boardBoost:board?board.legs.boost>0:null,boardHeading:board?.heading??null,boardTravelHeading:board&&speed>.05?Math.atan2(board.v[0],board.v[2]):null,boardGround:board?.contact.kind??null,boardSlope:board?.contact.slope??null,boardSurfaceNormal:board?.contact.n.map(n=>n.toFixed(2)).join('/')??null,
        cruiserSkin:cruiserData?wheelsLook():null,cruiserReverse:cruiserData?.reverse??null,cruiserBrake:cruiserData?.brakeHeld??null,cruiserGrounded:cruiserData?.grounded??null,cruiserContact:cruiserData?.contact??null,
        vessel:vessel?.id??null,vesselSpeed:vessel?.speed??null,vesselAnchor:vessel?.anchor??null,vesselLocalX:support?dx*cos-dz*sin:null,vesselLocalY:support?body.y-yacht.y:null,vesselLocalZ:support?dx*sin+dz*cos:null,vesselWorldX:vessel?.x??null,vesselWorldZ:vessel?.z??null,
        cookingPhase:kitchen?.active()?kitchen.view().state.phase:null,flightPrompt:modeId==='parachute'||modeId==='glider'?lastHud?.label??null:null,flightHeight:modeId==='parachute'||modeId==='glider'?lastHud?.height??null:null,flightLift:modeId==='parachute'||modeId==='glider'?lastHud?.lift??null:null,cameraFov:camera.fov,transitionFrom:transition?transition.eye.toArray().map(n=>n.toFixed(1)).join('/'):null,transitionTo:transition?transition.toEye.toArray().map(n=>n.toFixed(1)).join('/'):null};
      return {body:{...body},camera:{eye:camera.position.toArray() as [number,number,number],target:target.toArray() as [number,number,number],mode:perspective.mode(),owner:active?modeId:`perspective:${perspective.mode()}`,transitioning:transition!==null},mode,shot:shotId,
        worldRevision:world.geographyRevision,loadedRevision:world.geographyRevision,region:placed&&placed.region.contains(body.x,body.z)?placed.region.id:null,
        movement:{controller:active?registry.mode():support?'fleet deck':'walking',state:registry.mode(),horizontalSpeed:speed,verticalVelocity:velocityY,grounded:board?.contact.on??cruiserData?.grounded??velocityY===0,airborne:registry.mode()==='parachute'||!!active?.airborne?.(),support:support?'vessel':'terrain',blocker:lastMovementBlocker?'collision or route blocker':null},details,
        interaction:{target:offers()[0]?.thresholdId??null,inputOwner:kitchen?.active()?'kitchen':active?registry.mode():mode},
        rendering:{tier,qualityStep:adaptiveQuality.stats().level,loadedDistricts:stream.live.size,assetFailures:scheduler?.failures().length??0,paused,hidden:document.hidden,contextLost,transitionMs:transition?Math.max(0,performance.now()-transition.at):null},
        frame:paintCount,frameMs:frameTimes.at(-1)??null,recentFrames:frameTimes.slice(-90),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    },
    inspectorHit(clientX:number,clientY:number){
      const rect=renderer.domElement.getBoundingClientRect();if(clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)return null;
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),camera);
      const groups=[...stream.live].map(([id,resource])=>({id,object:resource.cards.group}));
      const hit=ray.intersectObjects(groups.map(row=>row.object),true)[0];if(!hit)return null;
      const owner=groups.find(row=>{let object:THREE.Object3D|null=hit.object;while(object){if(object===row.object)return true;object=object.parent;}return false;});
      return{id:owner?.id??'unknown district',owner:'Horizon district',transform:`${hit.point.x.toFixed(1)}, ${hit.point.y.toFixed(1)}, ${hit.point.z.toFixed(1)} world units`,target:hit.object.name||'Terrain / art mesh'};
    },
    inspectorVisuals(){
      const rect=renderer.domElement.getBoundingClientRect(),project=(x:number,y:number,z:number)=>{const p=new THREE.Vector3(x,y,z).project(camera);return p.z>=-1&&p.z<=1?{x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2}:null;};
      const visuals:{id:'ground'|'movement'|'camera';x:number;y:number;x2?:number;y2?:number}[]=[],ground=fleet.support(body)??geography.surface(body.x,body.z,body.y,.1),g=ground?project(body.x,ground.y,body.z):null;
      if(g)visuals.push({id:'ground',...g});
      const board=registry.mode()==='board'?(registry.active() as {state?:()=>GroundState}|null)?.state?.()??null:null,cruiserData=wheels()?.state();
      const vx=board?.v[0]??cruiserData?.vx??Math.sin(body.yaw)*ambienceSpeed,vz=board?.v[2]??cruiserData?.vz??Math.cos(body.yaw)*ambienceSpeed;
      const a=project(body.x,body.y+.8,body.z),b=project(body.x+vx,body.y+.8,body.z+vz);if(a&&b)visuals.push({id:'movement',...a,x2:b.x,y2:b.y});
      const c=project(target.x,target.y,target.z);if(c)visuals.push({id:'camera',...c});
      return visuals;
    },
    offers,
    moverState():HorizonMoverState{const fade=fadeLabel&&performance.now()-fadeLabel.at<HORIZON_FADE_LABEL_MS?fadeLabel.label:undefined;return{mode:registry.mode(),attached:registry.active()!==null,hud:lastHud,airborne:registry.mode()==='parachute'||!!registry.active()?.airborne?.(),stowed:registry.stowed(),perspective:perspective.mode(),...(fade?{fade}:{}),cut:comfortCut};},
    moverAction(action:'fold'|'pull'|'gate'|CableControlId){
      // PR #566 Codex: the cable ride's Skip and Sit/Stand buttons (E / Space) reach the active controller here.
      if(action==='skip'||action==='seat'){const cable=hold.paused()?null:asCableRide(registry.active());if(cable){schedule();if(action==='skip')cable.skip();else cable.toggleSeat();}return;}
      if(action==='pull'&&registry.mode()!=='parachute'){
        recordDiagnostic('parachute','deploy','requested');const at=registry.active()?.airborne?.();if(at){recordDiagnostic('parachute','deploy','accepted','airborne controller');beginAirborne(at,true);}else{recordDiagnostic('parachute','deploy','rejected','not airborne');options.onStatus?.('Open the parachute while airborne.');}
      }else if(action==='fold'||action==='pull'){recordDiagnostic('parachute',action,'requested',registry.mode());moverActionRequested=action;}
    },
    cyclePerspective,
    /** PR #566 Codex: the active cable ride's touch controls (Skip; Sit on the gondola) for the stage; [] when not riding one. */
    cableControls():CableControl[]{const cable=hold.paused()?null:asCableRide(registry.active());return cable?cableControls(cable.kind,cable.state()):[];},
    resumeEquipment(){if(registry.resumeStowed({...body,velocity:[0,0,0]})){startRide();return true;}options.onStatus?.('Carry the board to a rideable surface.');return false;},
    airspaceReady:(x:number,z:number)=>gateOpen(x,z),
    moverArt(object:THREE.Object3D,tick:(dt:number,figure:THREE.Object3D)=>boolean,dispose?:()=>void){schedule();const art:HorizonMoverArt={object,tick,dispose};moverArts.add(art);scene.add(object);return()=>removeMoverArt(art);},
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
    jumpHold(on:boolean){schedule();if(on&&!jumpHeld&&!consumeJumpUntilRelease)jumpRequested=true;jumpHeld=on;if(!on)consumeJumpUntilRelease=false;},
    offer:()=>lastOffer,
    /** Compatibility (main #552): one comfort path — `setComfort` sets the land's motion and the movers' registry together. */
    setReducedMotion(on:boolean){applyComfort({reducedMotion:on});},
    setCalm(on:boolean){applyComfort({calm:on});},
    /** The old Tideline skate (the shell's SkateHUD drives these). Null without Mountain v2 placed. */
    skate(){return skate?.controls??null;},
    monorailState:()=>monorail?.state()??null,
    hasMonorail:()=>monorail!==null,
    monorailBoard(station:number,companion=false){if(!monorail||registry.active()||skating()||kitchen?.active())return false;const pose=monorail.board(station,companion);if(!pose)return false;mode='walk';path=[];clear();Object.assign(body,{x:pose.at[0],y:pose.at[1],z:pose.at[2],yaw:pose.yaw});yaw=pose.yaw;transition=null;physicalBody=null;pageChosen=false;reportMonorail(true);schedule();return true;},
    monorailSelect(stop:number){monorail?.select(stop);reportMonorail(true);schedule();},
    monorailControl(control:'pause'|'brake'|'seat'|'companion'|'speed'|'view'|'exit'|'bell',value?:number|boolean|MonorailView){
      if(!monorail?.state())return false;
      if(control==='exit'){
        const pose=monorail.pose();if(!pose||monorail.state()?.phase!=='doors-open')return false;
        if(!gateOpen(pose.at[0],pose.at[2])||!regionReady(pose.at[0],pose.at[2])){options.onStatus?.('The platform is still arriving. Wait a moment before stepping off.');return false;}
        const foot=restoreHorizonPosition({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:pose.at[0],y:pose.at[1],z:pose.at[2],yaw:pose.yaw},world.pathGraph!,geography.ground,restoreStand);
        if(!gateOpen(foot.x,foot.z)){options.onStatus?.('The walkway is still arriving. Wait a moment before stepping off.');return false;}
        monorail.control('exit');Object.assign(body,{x:foot.x,y:foot.y!,z:foot.z,yaw:foot.yaw});yaw=foot.yaw;reportMonorail(true);updateCamera();schedule();return true;
      }
      if(control==='bell')ambience?.bell();
      monorail.control(control,value);reportMonorail(true);schedule();return true;
    },
    /** Whether the old board exists on this Horizon (it stands with the placed Mountain v2 region). */
    hasSkate(){return Boolean(skate);},
    /** Why the board cannot be put down where the body stands on foot, as a status line; null where it can. */
    skateRefusal():string|null{
      if(!skate)return 'The board is not on this island.';
      if(skating())return null;
      if(mode!=='walk'||monorail?.state()||registry.active()||kitchen?.active()||airport.seated()||fleet.sitting()||yachtView()!==null)return SKATE_REFUSALS.ride;
      if(homeWorld.roomAt(body))return SKATE_REFUSALS.indoors;
      const why=skate.startRefusal(body.x,body.z,body.y);
      return why?SKATE_REFUSALS[why]:null;
    },
    canSkate(){return Boolean(skate)&&!skating()&&api.skateRefusal()===null;},
    startSkate(progress?:SkateProgress){
      schedule();if(!skate)return false;if(skating())return true;
      const refusal=api.skateRefusal();
      if(refusal){if(refusal===SKATE_REFUSALS.held)holdStatus();else options.onStatus?.(refusal);return false;}
      emote=null;path=[];clear();return skate.start({...body},progress);
    },
    retry(){
      schedule();
      if(skating()){skate!.controls.command('retry');skate!.publish(performance.now(),true);return true;}
      // The live vehicle pose can be in water or air. Use the same safe foot
      // position that a reload would choose before selecting a walkable path.
      const saved=savedBody();
      const anchor:[number,number,number]=[saved.x,saved.y,saved.z].every(Number.isFinite)
        ?[saved.x,saved.y!,saved.z]:[AIRPORT.arrival.x,AIRPORT.arrival.y,AIRPORT.arrival.z];
      const node=nearestPathNode(world.pathGraph!,anchor);
      if(!node){options.onStatus?.('A safe path is still loading. Please try again.');return false;}
      restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:node.at[0],y:node.at[1],z:node.at[2],yaw:node.facing??(Number.isFinite(saved.yaw)?saved.yaw:0)});
      fadeCut('Back on safe ground.');return true;
    },
    stopSkate(){schedule();const at=skate?.stop();if(!at)return false;Object.assign(body,at);yaw=at.yaw;path=[];clear();return true;},
    /** The old shell's emote row: plays on the walking figure (null stops it). Riding, it does nothing. */
    emote(id:EmoteId|null){schedule();emote=id&&!registry.active()?{id,at:performance.now()}:null;},
    input(next:Partial<typeof controls>){schedule();controls={...controls,...next};},jump(){schedule();jumpRequested=true;},look(dx:number,dy:number){schedule();if(perspective.mode()!=='activity'&&mode==='walk'){perspective.look(dx,dy);return;}lookAcc.dx+=dx;lookAcc.dy+=dy;yaw+=dx;pitch=Math.max(-1.2,Math.min(.8,pitch+dy));},
    pause(value:boolean){paused=value;adaptiveQuality.interrupt();schedule();if(value){kitchen?.pause('Tools are open. All kitchen timers are paused.');if(skating()&&!skate!.controls.paused())skate!.controls.pause(true);clear();ambience?.pause();}},setDate(date:Date){schedule();const month=date.getMonth()+1;homeWorld.setSeason(month<=2||month===12?'winter':month<=5?'spring':month<=8?'summer':'autumn');currentTime=date;lastSun=-Infinity;},

    /** The app's comfort choices, live (HorizonStage threads useComfort; html[data-motion] is read too). */
    setComfort(next:Partial<HorizonComfort>){applyComfort(next);},
    comfort:()=>({...comfort,motion:{...motion}}),
    /** Whether a tapped or requested route is still being walked. */
    routing(){return path.length>0&&!registry.active();},
    walkTo(p:XYZ){schedule();if(registry.active()||skating()||monorail?.state())return null;lastMovementBlocker=null;const plan=walkPlan(world.pathGraph!,[body.x,body.y,body.z],p,{stepFree:true});path=plan?[...plan.points]:[];if(plan)routeAhead(plan.points);return plan;},
    /**
     * Quick travel (Jonathan, 2026-10-04): the deliberate, instant jump to a place's step that All tools › Places and a panel's
     * Visit make. It is a restore, so the chunk gate still holds the body on ground that has not arrived and the full
     * validation runs when it lands (no teleport into the void, no fall-through); the board and the walk end where they stand
     * and a short fade covers the cut (a plain cut under reduced motion / calm). A ride, the monorail and the kitchen keep
     * their refusal: false, and the caller says so.
     */
    quickTravel(p:XYZ,facing?:number,label=''){
      schedule();const busy=registry.active()||monorail?.state()||kitchen?.active();if(busy)return false;
      restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:p[0],y:p[1],z:p[2],yaw:Number.isFinite(facing)?facing!:body.yaw});
      fadeCut(label);return true;
    },
    setHomeBotanical(...args:Parameters<typeof homeWorld.setBotanical>){schedule();homeWorld.setBotanical(...args);},
    setHome(layout:HomeLayout|undefined,displays?:HomeDisplayContent[],plotId?:string){const occupied=homeWorld.roomAt(body);homeWorld.set(layout,displays,plotId);if(occupied&&(geography.blocked(body.x,body.z,body.y)||!homeWorld.roomAt(body))){const at=homeWorld.visit();if(at)restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',...at});}requestShadow('home-renovation');},
    visitHome(){const at=homeWorld.visit();if(!at)return false;restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',...at});return true;},
    homeActions(){return !paused&&mode==='walk'&&!registry.active()?homeWorld.actions(body):[];},
    activateHome(id:string){const action=!paused&&!registry.active()?homeWorld.actions(body).find(a=>a.id===id):null;if(!action){recordDiagnostic('home',id,'rejected','not reachable or another activity owns movement');return false;}recordDiagnostic('home',id,'accepted');clear();if(action.id==='home-book')options.onHomeBook?.();else if(action.target)options.onHomeWorkspace?.(action.target);return true;},
    stats(){const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),revision:world.geographyRevision,terrainBytes:assets.bytes,collisionIndex:geography.indexStats,bytesBeforeFirstFrame,chunksLoaded:chunks?chunks.refs.filter(r=>chunks.ready(r.districtId)).map(r=>r.districtId):null,cables:cableLayer.stats(),chunks:chunks?{resident:chunks.refs.filter(r=>chunks.ready(r.districtId)).map(r=>r.districtId),total:chunks.refs.length,queued:scheduler!.queued(),heldAt:heldNow.length?{districts:[...heldNow],body:{...body}}:null,holds:chunkHolds.map(h=>({...h,at:[...h.at]})),ride:rideGate.stats(),failures:scheduler!.failures()}:null,walkOut:lastWalkOut,walkOutWait:pendingWalkOut?walkOutWait:null,definitionBytesSoFar:chunks?.bytes()??assets.definitionBytes,shadowRequests:[...shadowRequests],comfort:{...comfort,motion:{...motion}},lightCards:roadLights.stats().cards,roadLights:roadLights.stats(),shadow:{half:sun.shadow.camera.right,centre:sun.target.position.toArray()},paintCount,quality:{...adaptiveQuality.stats(),...adaptiveQuality.profile(window.devicePixelRatio),appliedPixelRatio:renderer.getPixelRatio(),pending:qualityDirty,shadowMapSize:sun.shadow.map?.width??null},firstInteractiveMs:interactiveAt===null?null:interactiveAt-startedAt,assetLoadMs:assetLoadedAt-startedAt,mode,shot:shotId,body:{...body},frames:[...frameTimes],drawSamples:[...drawSamples],stream:[...stream.history],camera:{eye:camera.position.toArray(),target:target.toArray(),fov:camera.fov},diagnostics:world.diagnostics,region:placed?{id:placed.region.id,mounted:regionScene!==null,building:regionTask!==null,visible:regionVisible,districts:[...regionDistricts],joins:world.pathGraph?.joins??[],...(regionScene?regionScene.stats():{})}:null};},
    // ---- road-light and legacy road-probe review APIs ----
    /** Read-only road snapshot used by headless review scripts and the global Inspector. */
    inspect:()=>buildInspectorSnapshot(inspectorSource),
    /** Snapshots copied with the road probe's explicit Copy button this session. */
    inspectorLog:inspector.log,
    /** Opens or closes the inspector overlay (dev / ?diagnostics=1); returns whether it is open. */
    toggleInspector:()=>inspector.toggle(),
    /** Review: set the world clock (as `setDate`); null returns to the device clock / `?sun=`. */
    setClock(date:Date|null){if(date)api.setDate(date);else{currentTime=null;lastSun=-Infinity;schedule();}},
    bridgeArt:()=>bridgeArt.stats(),roadLights:()=>roadLights.stats(),
    /** Read-only capture readiness: settle() alone does not drive deferred corridor builders. */
    corridorRenderStatus:()=>({building:corridorArt.building(),furniture:corridorArt.stats(),planting:corridorPlanting.stats()}),
    /** Pass 5: the placed Mountain v2 region (null when not placed). T3's rides move its cabins through `setTransit`. */
    mountainRegion:placed?{region:placed.region,scene:()=>regionScene,visible:()=>regionVisible,
      setTransit(cabin:{at:XYZ;yaw:number;pitch:number}|null,kind:'gondola'|'funicular'){regionTransit={cabin,kind};regionScene?.setTransit(cabin,kind);}}:null,
    /** Pass 5: the water picture at v2's dam, as given (0…1; null = unknown, frosted glass). The runtime and the region read
     *  nothing themselves: the app feeds the one reading L01 shows (CONTRACT §2.2). */
    setMountainDamWater(level:number|null,reserve:number|null){regionWater={level,reserve};regionScene?.setWater(level,reserve);schedule();},
    dispose(){airport.dispose();bridgeArt.dispose();gliderPads.dispose();monorail?.dispose();skate?.dispose();kitchen?.dispose();releaseRegion();offRegion?.();offCable?.();saveFleet();window.removeEventListener('pagehide',saveAll);offFleet();offHome();homeWorld.dispose();fleetArt.dispose();disposed=true;window.clearTimeout(fadeTimer);registry.dispose();cruiserArt?.dispose();for(const art of [...moverArts])removeMoverArt(art);unmountBoardProxy();fadeEl.remove();offChunk?.();frameDriver?.dispose();observer.disconnect();for(const fn of unlisten)fn();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',focusPause);document.removeEventListener('visibilitychange',visibilityClear);host.removeEventListener('blur',hostBlur);stream.dispose();cableLayer.dispose();for(const c of coarse.values())c.dispose();water.dispose();ring.dispose();skyDome.dispose();roadLights.dispose();unmountCorridor();inspector.dispose();chalkMaterial.dispose();doorGeometry.dispose();doorMaterial.dispose();figure.dispose();partner.dispose();sun.shadow.map?.dispose();lease.release();}
  };
  // Pass 5 (T3's contract, HANDOFF-notes/rides.md): the cable rides move the region's cabins through `setTransit`.
  const offCable=placed&&api.mountainRegion?connectCableRegion(placed.region,api.mountainRegion,()=>camera.aspect):null;
  return api;
}

const CHALK_SOLID=/(^|\.)(edges|kerbs|kerb|guard|parapet|parapets|rails|retaining|coping|lip|marker)(\.|@|$)/;
/** Solids whose vertical faces also take the night face colour (walls that bound a walk and, Wave 6, rails: P28 C and L
 * read their rails at 1.25 / 2.69 : 1 against the moonlit ground; not markers). */
const CHALK_FACE_SOLID=/(^|\.)(edges|kerbs|kerb|parapet|parapets|retaining|coping|rails)(\.|@|$)/;
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
