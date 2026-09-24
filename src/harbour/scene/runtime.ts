import type {WorldAmbience} from '../mountain/audio.ts';
import {createFrameStudy,type FrameStudy} from '../mountain/performance.ts';
import type {MountainRecoveryView} from '../mountain/recovery.ts';
import type {MountainInteractionState} from '../mountain/life.ts';
import {mountainFoliageAt} from '../mountain/planting.ts';
import {worldCeilingAt,worldCollisionAt} from '../mountain/surfaces.ts';
import {MOUNTAIN_VERSION,transportPoint,TRANSPORT_STOPS,type Point3,type TransportKind} from '../mountain/definition.ts';
import {crossedVillageDoor,villagePortalArrival} from "../village/topology.ts";
import * as THREE from "three";
import {buildSkatePark} from '../skate/parkScene.ts';
import {skateField,type SkateControls} from '../skate/driver.ts';
import type {SkateProgress} from '../skate/session.ts';
import {createHudThrottle,type SkateHudModel} from '../skate/hud/model.ts';
import {createSkateCamera,SKATE_CAM,type SkateCamera} from '../skate/camera/skateCamera.ts';
import {skateWalkPose,skateWatchPoint} from '../skate/camera/companion.ts';
import {insideVillageBuilding} from '../body/obstacles.ts';
import { acquireWorldRenderer } from "../../house/world/rendererOwner.ts";
import { worldDiagnostics } from "../../house/world/diagnostics.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import { createCourtCamera, type CourtCamera, type CourtLook } from "../camera/courtCamera.ts";
// ── The body lane (world-body) ───────────────────────────────────────────────
// Everything this lane adds to the runtime is additive and marked like this
// block. A sibling lane is restructuring this file; nothing above or below a
// marked block was rewritten to make room for the body.
import { createFollowCamera, FOLLOW_DISTANCE, FOLLOW_LOOK_HEIGHT, FOLLOW_MAX_R, FOLLOW_PHI, followInRoom, type FollowCamera } from "../camera/followCamera.ts";
import { createWalker, COURT_ARRIVAL, type Walker } from "../body/walker.ts";
import type { EmoteId } from "../body/bodyModel.ts";
import type {PlayableAvatar} from '../body/avatarDefinition.ts';
import {createCat,type Cat} from '../body/cat.ts';
import {heelStand,type CatErrand} from '../body/catModel.ts';
import {attentionDoor,attentionOf} from '../data/attention.ts';
import {HARBOUR_LAND} from '../village/world.ts';
import {harbourZoomExit,zoomEdgeArmed,ZOOM_REST,type ZoomEdge} from '../camera/worldZoom.ts';
// ── Hearth Mountain v2 · the camera track ── one camera system: Look, Walk, Close, Ride, Skate, with explicit hand-offs.
import {cameraBlocked,cameraGround,rideFrame,type MovingSolid} from '../camera/worldAdapter.ts';
import {arrivalAt,closeLandmark,damViewPose,doorExitPose,momentPose,openWorldFov,overviewPose,summitViewPose} from '../camera/mountainPoses.ts';
import {handToLook,handToWalk,walkFrom} from '../camera/director.ts';
import {createRideCamera,rideExitHeading,type RideCamera} from '../camera/rideCamera.ts';
import {blendShot,createFinishShot,raceFinishShot,raceStartShot,startShotWeight} from '../skate/camera/raceShots.ts';
import {skateCameraPose} from '../skate/camera/skateCamera.ts';
import {poseFrom} from '../camera/poses.ts';
import {tourPose} from '../mountain/tour.ts';
// ── walk-everywhere ──────────────────────────────────────────────────────────
// Where a body may stand in each of the eleven places: the floor, the walls,
// what is in the way, and where you come in. All of it derived from each
// place's own numbers (`body/places.ts`).
import { EXIT_REACH, exitAnchors, followHoldIn, placeArrival, placeGround, placeObstacles, placeRoom, roomReach, walksIndoors } from "../body/places.ts";
import { NO_INPUT, eyeHeight, type BodyInput } from "../body/bodyModel.ts";
import { CLOSE_HOLDS, COURT_ANCHOR_IDS, COURT_FOV, closePose, type CourtAnchor, type CourtMode, type CourtPose, type RoomHold } from "../camera/poses.ts";
import { harbourFramePolicy, CAMERA_INTERVAL_MS } from "./framePolicy.ts";
import { createGround,groundHeightAt } from "./ground.ts";
import { configureHarbourRenderer, createLightRig } from "./lightRig.ts";
import { EMPTY_PLACE, PLACES, PLACED_PLACE_IDS, PLACE_HOLDS, SCENE_DRESSING,  placedFootprintHold, placedPose, placementLift, placementToWorld, placementOf, poseFor, streamPlaces, type Anchor, type Composition, type Place, type PlaceDressing, type PlaceHandle, type PlacePlacement, type PlaceReading, type Pose, type Region, type Vec3 } from "./place.ts";
import { travelAt, travelPlan, type TravelPlan } from "./travel.ts";
import type { HarbourPlaceId } from "../flag.ts";
import type { RenderTier } from "./quality.ts";

/** What a pointer landed on. */
export type HarbourHit =
  | { kind: "queen"; region: string; object: THREE.Object3D; point: Vec3 }
  | { kind: "anchor"; id: string; anchor: Anchor; point: Vec3 }
  | { kind: "ground"; point: Vec3 }
  | { kind: "none" };

export type GestureSample = { x: number; y: number; t: number };
/** A finished, non-tap gesture on the Queen. `court/queenTouch.ts` classifies it. */
export type HarbourGesture = { region: string; samples: GestureSample[] };

/** A DOM twin's place on the stage, in stage pixels, already clamped inside it and grown to 44 px. */
export type ProjectedRect = { id: string; kind: "region" | "anchor"; group: string; label: string; x: number; y: number; w: number; h: number; visible: boolean; door?: Anchor["door"] };

/** What the runtime publishes to the shell while skating (`onSkate`). */
export type SkateFrame = { model: SkateHudModel; progress: SkateProgress; revision: number };

export type HarbourCallbacks = {
  onJourney?:()=>void;
  avatar?:PlayableAvatar|null;
  onAvatarStatus?:(avatar:PlayableAvatar,status:"ready"|"error")=>void;
  /** Tideline Skate Club: the HUD model (throttled) and the progress to save, or null when the board is put away. */
  onSkate?: (frame:SkateFrame|null)=>void;
  onReady: () => void;
  onFailure: () => void;
  onProject?: (rects: ProjectedRect[]) => void;
  /** A tap, with where it landed in stage pixels. */
  onTap?: (hit: HarbourHit, at: { x: number; y: number }) => void;
  onGesture?: (gesture: HarbourGesture) => void;
  /**
   * A drag that began on the rail (or its water line): where the pointer is
   * now, in stage pixels, and how wide the stage is. The cellar turns this
   * into a day with its own `scrubIndex`; the runtime stays out of it. While
   * such a drag is in flight the camera does not orbit.
   */
  onRailDrag?: (x: number, width: number) => void;
  /**
   * The phone's thumb-stick (W7 b). A press held still on the ground becomes
   * a stick under the thumb: `{x, y}` is where it was pressed, `{dx, dy}` is
   * how far the thumb has pushed from there, already clamped to the stick's
   * own radius. `null` when the thumb comes off. The runtime does the walking
   * — this is only so the shell can draw it.
   */
  onStick?: (stick: { x: number; y: number; dx: number; dy: number } | null) => void;
  /** The close hold went on or off (a double-tap on the ground, or the shell asking). */
  onClose?: (closed: boolean) => void;
  /**
   * A placed building's doorway was crossed (§3). `place` is the building you
   * walked into, or `"court"` when you walked back out of one into the open.
   * The shell turns this into the same route change a tap on the building from
   * across the lawn makes, so the app's state, the compass, the quick sheet and
   * the flat edition all stay exactly as correct as they were.
   */
  onThreshold?: (place: HarbourPlaceId) => void;
  onMountainTravel?:(travelling:boolean)=>void;
  /**
   * Hearth Mountain v2 (C5): the Look camera is at its far limit and one more
   * pull will open the Journey — the shell shows "Pull once more to open the
   * Journey" while this is true.
   */
  onZoomEdge?:(armed:boolean)=>void;
  /**
   * The body walked to a place's own way out (walk-everywhere): the Tower's
   * stair, the Cellar's stair, the Glasshouse's garden door, the footpath up
   * the shore. The shell runs it through **exactly the path a tap on that
   * anchor runs through** — no new route concept, no second table of ways —
   * so walking out and tapping the door are the same act. A placed building
   * is not reported here: there you really do walk out through the doorway,
   * and `onThreshold` above is the crossing.
   */
  onExit?: (anchor: Anchor) => void;
  /** Defaults: the registered court, the theme's scene dressing, no reading. */
  place?: Place;
  dressing?: PlaceDressing;
  reading?: PlaceReading | null;
  composition?: Composition;
};

/** A phone's portrait frame takes a wider field so the Queen and her flagstone fit at a friendly distance. */
export const PHONE_FOV = 52;
/**
 * ── walk-everywhere ──
 * How far out onto the lawn the body steps when it comes out of a building
 * without walking — the "← Back to the Court" button, a quick-sheet row.
 * Clear of the doorway's own arrival radius, so coming out is not immediately
 * going back in.
 */
export const COURT_DOORSTEP = 2.2;
export const fovFor = (composition: Composition): number => (composition === "phone" ? PHONE_FOV : COURT_FOV);
const isCourtAnchor = (id: string | undefined): id is CourtAnchor => (COURT_ANCHOR_IDS as readonly string[]).includes(id ?? "");

/**
 * ── The body lane (world-body → walk-everywhere) ──
 * Your character, and the camera that walks with it. It stands in **every**
 * place now: the island in the Court, the shore at the Campfire, and the floor
 * of each of the nine rooms, each with its own floor height, its own walls and
 * its own way out (`body/places.ts`).
 *
 * The Look camera is never taken away — `follow(false)` hands the view back to
 * it, and every named pose, every twin and every door work exactly as before.
 */
export type BodyControls = {
  skate: SkateControls;
  /** Is the follow camera driving? */
  following: () => boolean;
  /** Take the follow camera, or give it back. Giving it back returns to the room's own pose. */
  follow: (on: boolean) => void;
  /** What the keys are asking for, in camera space (+forward is away from the eye). */
  input: (next: BodyInput) => void;
  /** Walk to a point on the ground — a tap. A straight line that slides off what it meets. */
  goTo: (x: number, z: number) => boolean;
  /** Stop a clicked walking route when a navigation panel takes focus. */
  cancel: () => void;
  /** Put the body somewhere at once. */
  place: (x: number, z: number, yaw?: number, y?:number) => void;
  /**
   * Where it stands, and what it is doing beyond standing. `act` is the move
   * or emote playing and `p` is how far through it, 0…1 — the two the
   * world-presence lane carries so a partner sees it too.
   */
  at: () => { x: number; y: number; z: number; yaw: number; speed: number; act: string | null; p: number };
  /** Is it walking right now? */
  walking: () => boolean;
  /* ── The moves (walk-moves) ─────────────────────────────────────────────
   * Three verbs, each one-shot: a press is taken on the next frame, exactly
   * once. None of them can be refused by the camera or a tool — a jump asked
   * for while a sheet is open simply never reaches here.
   */
  /** Jump; in the air, the second jump. */
  jump: () => void;
  /** Drop into a slide. Only from a run, and only on the ground. */
  slide: () => void;
  /** Play an emote, or stop the one playing. Asking for the one playing stops it. */
  emote: (id: EmoteId | null) => void;
};

export type HarbourRuntime = {
  measure:(action:'start'|'stop'|'read',label?:string)=>FrameStudy;
  mountainTravel:(at:Point3,trip?:{kind:TransportKind;from:number;to:number})=>void;
  mountainSkip:()=>void;
  mountainCalm:(on:boolean)=>void;
  setMountainRecovery:(view:MountainRecoveryView)=>void;
  setMountainInteraction:(state:MountainInteractionState)=>void;
  /** Nonfinancial sound cue; never enables Sound or creates an audio context. */
  mountainBell:()=>void;
  setWorldAmbience:(audio:WorldAmbience|null)=>void;
  setAvatar:(avatar:PlayableAvatar|null)=>void;
  /**
   * Fly to a mode; `anchor` is one of `poses.ts`'s named anchors or any anchor
   * the place exposes. `"door"` is the frieze a place shows in the band above
   * an open tool: its own `door` pose when it names one, else its sky; the
   * Court's frieze is her portrait.
   */
  go: (mode: CourtMode | "door", anchor?: string) => void;
  setReading: (reading: PlaceReading | null) => void;
  /** A close look at any point (the Queen's roots, the slip). */
  look: (look: CourtLook) => void;
  /**
   * Keyboard: the arrows orbit and +/− zoom. **There is no pan.** W A S D
   * used to slide the camera's look-at target and call it walking; the body
   * does the walking now, in every place, so the pan is gone rather than left
   * as a fallback — a fallback is how the stage came to promise a walk and
   * deliver a camera slide.
   */
  gesture: (input: { kind: "orbit"; dx: number; dy: number } | { kind: "zoom"; delta: number } | { kind: "spin"; dir: -1 | 0 | 1 }) => void;
  /**
   * Hearth Mountain v2: fly Look to an authored shot, composed for this stage —
   * `tour:<id>`, `moment:<interaction id>`, `view:dam`, `view:summit`,
   * `view:world` (the overview), `view:town` (the signature arrival shot).
   * False when the shot is unknown.
   */
  shot: (id: string) => boolean;
  /** A tool is open in front of the court: no breathing, the strip only redraws on demand. */
  setToolOpen: (open: boolean) => void;
  /** The place's idle animation (the Queen's breath). Off by default for an empty island. */
  setBreathing: (on: boolean) => void;
  /** Something else that moves each animated frame (the Queen's breath); returns the way to stop it. */
  addAnimator: (animate: (t: number, dt: number) => void) => () => void;
  /**
   * Something inside the place started moving that the runtime did not ask for
   * — the cellar's water finding its level, a bank's squash after a deposit.
   * Runs animated frames until the place's own `animate` says it has settled.
   */
  invalidate: () => void;
  /** A return record's camera. */
  restore: (position: Vec3) => void;
  camera: () => Vec3;
  pose: () => CourtPose;
  place: () => PlaceHandle;
  /** Which place is standing now. */
  placeId: () => HarbourPlaceId;
  /**
   * Go into another place of this room (BUILD_PLAN_SLICE2 §1). The place is
   * built if it is not standing yet, both places live for the length of the
   * journey, the roof and the lid move through `travelPlan`, and the one you
   * left is disposed when the travel ends. Returns the plan it is following.
   */
  enter: (place: HarbourPlaceId, options?: { from?: HarbourPlaceId; reduced?: boolean; threshold?: boolean }) => TravelPlan;
  /** Whether a journey is in flight (both places are mounted). */
  traveling: () => boolean;
  /**
   * Where on the island the viewer is standing (§2). The character lane drives
   * this from the body's own island coordinates; until a body exists the
   * runtime follows the camera's target on the ground. Placed interiors are
   * built and released from here, and a placed building's doorway is crossed
   * from here.
   */
  setFocus: (x: number, z: number) => void;
  focus: () => readonly [number, number];
  /**
   * Ask the streamer again without moving anything: a placed interior whose
   * chunk has only just landed can stand up now rather than on the next move.
   */
  restream: () => void;
  /** Which placed interiors are standing right now, in a stable order. */
  resident: () => HarbourPlaceId[];
  /**
   * The place's third camera hold (W7 a): the one object it is about, framed
   * and held. On and off by the same gesture — a double-tap on the ground, or
   * the shell's own key — and remembered per place for as long as this world
   * stands. A place with no close hold answers false and does nothing.
   */
  toggleClose: (on?: boolean) => boolean;
  closed: () => boolean;
  /** ── The body lane (world-body) ── Your character, where there is one. */
  body: () => BodyControls | null;
  dispose: () => void;
};

/**
 * What a place's handle may also do, all feature-detected and none required.
 * The tower lifts its roof; the Court lifts its own floor away as the cellar's
 * lid; the cellar walks its rail through the month. Two spellings are accepted
 * for the scrub so a place may say it either way (`scrubTo`/`step`/`today` is
 * the cellar's own; `setScrub` is the shorter one the runtime first asked for).
 */
type Movable = {
  setRoof?: (k: number) => void;
  setLid?: (k: number) => void;
  setScrub?: (index: number) => void;
  scrubTo?: (index: number) => void;
  step?: (delta: number) => void;
  today?: () => void;
  index?: () => number;
};
const methodOf = <K extends keyof Movable>(handle: PlaceHandle, name: K): NonNullable<Movable[K]> | null => {
  const found = (handle as PlaceHandle & Movable)[name];
  return typeof found === "function" ? (found as NonNullable<Movable[K]>).bind(handle) as NonNullable<Movable[K]> : null;
};
const roofOf = (handle: PlaceHandle): ((k: number) => void) | null => methodOf(handle, "setRoof");
const lidOf = (handle: PlaceHandle): ((k: number) => void) | null => methodOf(handle, "setLid");

/** The cellar's day scrub, under either spelling. */
export const scrubOf = (handle: PlaceHandle): ((index: number) => void) | null =>
  methodOf(handle, "setScrub") ?? methodOf(handle, "scrubTo");

export type ScrubControls = {
  /** Go to a day by index; the place clamps it. */
  to: (index: number) => void;
  /** A day earlier or later — the ◀ ▶ twins and the arrow keys. */
  step: (delta: number) => void;
  /** Back to today, in one tap. */
  today: () => void;
  /** Where the rail stands now, when the place says. */
  index: () => number;
};

/**
 * The walk along the rail, when the standing place has one. Everything here is
 * a reading: the water rises and falls and the jars pale, and nothing is
 * written. A place with only `setScrub` still gets a step and a today, worked
 * out from the index it reports.
 */
export function scrubControls(handle: PlaceHandle, todayIndex = 0): ScrubControls | null {
  const to = scrubOf(handle);
  if (!to) return null;
  const at = methodOf(handle, "index");
  const own = methodOf(handle, "step");
  const home = methodOf(handle, "today");
  const index = at ?? (() => todayIndex);
  return {
    to,
    step: own ?? ((delta: number) => to(index() + delta)),
    today: home ?? (() => to(todayIndex)),
    index,
  };
}

type MountainPresentationHandle = PlaceHandle & {
  setVisitor?:(at:Point3)=>void;
  setTransit?:(at:Point3|null,kind?:TransportKind)=>void;
  setCalm?:(on:boolean)=>void;
  setRecovery?:(view:MountainRecoveryView)=>void;
  setInteraction?:(state:MountainInteractionState)=>void;
};

const TAP_PIXELS = 8, TAP_MS = 350, MIN_TWIN = 44;
/** A second tap this soon after the first, and this near it, is one deliberate gesture. */
export const DOUBLE_TAP_MS = 320, DOUBLE_TAP_PIXELS = 28;
/**
 * The thumb-stick (W7 b): how long the ground is held still before it becomes
 * a stick, and how far the thumb may push it. A full push is a full push of
 * the **body's** own input, the same input W A S D gives it, so there is no
 * gain to convert between them any more — `STICK_GAIN` was the pixels-per-
 * second the old camera pan needed, and the pan is gone.
 */
export const STICK_MS = 380, STICK_RADIUS = 56;
/** Hearth Mountain v2: how fast a held Q/E (or , .) turns the view, radians per second. */
export const ORBIT_KEY_RATE = 1.9;
/** Zones a drag walks rather than orbits: the cellar's rail and the water behind it. */
const RAIL_ZONES = new Set(["rail", "water"]);
const isRail = (hit: HarbourHit): boolean => hit.kind === "anchor" && RAIL_ZONES.has(hit.anchor.zone);
type Pointer = { id: number; x: number; y: number; startX: number; startY: number; startedAt: number; hit: HarbourHit; samples: GestureSample[] };

/**
 * Mounts the harbour scene into `host` (BUILD_PLAN §2 #5): one renderer lease
 * at priority 0, the light rig, the island ground and the active place; drives
 * the court camera; routes pointers to the Queen, an anchor or the ground;
 * projects DOM twins; snapshots on suspend; disposes everything.
 */
export function mountHarbourWorld(host: HTMLElement, theme: ThemeId, tier: RenderTier, callbacks: HarbourCallbacks): HarbourRuntime {
  let disposed = false, frame = 0, previous = 0, lastPaint = 0, lastAnimated = 0, visible = true, toolOpen = false, breathing = false, settling = false, intervalMs = CAMERA_INTERVAL_MS;
  let worldAmbience:WorldAmbience|null=null;
  const frameStudy=createFrameStudy();
  const mountedAt = performance.now();
  const diagnostics = worldDiagnostics();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => reduced.matches || document.documentElement.dataset.motion === "reduced";
  const dressing = callbacks.dressing ?? SCENE_DRESSING[theme];
  const abort = new AbortController();
  let composition: Composition = callbacks.composition ?? (host.getBoundingClientRect().width < 720 ? "phone" : "desktop");

  /**
   * The stage's size, kept from the last resize. Reading it back from the DOM
   * inside a frame is a forced reflow, and the ResizeObserver already knows.
   */
  let stageWidth = 0, stageHeight = 0;
  /**
   * The standing place's own tables. A place hands back fresh arrays every
   * call, so they are taken once and kept until something says the scene
   * changed — the place's own `invalidate`, a reading, a journey.
   */
  let anchorList: Anchor[] = [], regionList: Region[] = [], listsDirty = true;
  const anchorById = new Map<string, Anchor>();

  const scene = new THREE.Scene();
  const lease = acquireWorldRenderer(host, {
    priority: 0,
    parameters: { antialias: true, alpha: false, powerPreference: "low-power" },
    configure(renderer) { configureHarbourRenderer(renderer, tier, window.devicePixelRatio || 1); },
    onSuspend() {
      frameStudy.interrupt();
      worldAmbience?.pause();
      lease.cancelFrame(frame); frame = 0;
      if (!disposed) { try { host.style.backgroundImage = `url(${renderer.domElement.toDataURL("image/webp", 0.75)})`; host.style.backgroundSize = "100% 100%"; } catch { /* The reading edition remains. */ } }
      host.dataset.renderer = "suspended";
    },
    onResume() { host.style.backgroundImage = ""; host.dataset.renderer = "active"; previous = performance.now(); resize(); schedule(); },
  });
  const renderer = lease.renderer;
  host.dataset.renderer = lease.active ? "active" : "suspended";
  host.dataset.harbourTier = tier;

  const camera = new THREE.PerspectiveCamera(fovFor(composition), 1, 0.1, 1100);
  const animators = new Set<(t: number, dt: number) => void>();
  const rig = createLightRig(scene, dressing.light, tier);
  const ground = createGround(scene, dressing, tier);
  // ── Tideline Skate Club v2 ── one field: the park you see is the park you ride.
  const skatePark=buildSkatePark(dressing,{tier,field:skateField()});scene.add(skatePark.group);
  // A local recording is a separate decorative silhouette: never a body, collider or presence source.
  const raceGhost=new THREE.Group();raceGhost.name='device-local-race-ghost';raceGhost.visible=false;
  const ghostMaterial=new THREE.MeshBasicMaterial({color:theme==='taylor'?'#e48bb5':theme==='newfoundland'?'#e3a54a':'#3fb49c',transparent:true,opacity:.38,depthWrite:false});
  const ghostGeometries=[new THREE.BoxGeometry(.36,.06,.72),new THREE.CylinderGeometry(.16,.19,.7,6),new THREE.SphereGeometry(.16,8,6)];
  for(let i=0;i<ghostGeometries.length;i++){
    const mesh=new THREE.Mesh(ghostGeometries[i]!,ghostMaterial);mesh.position.y=[.08,.67,1.2][i]!;
    mesh.raycast=()=>{};raceGhost.add(mesh);
  }
  scene.add(raceGhost);
  function updateRaceGhost():void {
    const pose=!toolOpen&&!calmWorld&&!reducedMotion()&&placeId==='court'?walker?.skate.ghost():null;
    raceGhost.visible=Boolean(pose);
    if(pose){raceGhost.position.set(pose.x,pose.y,pose.z);raceGhost.rotation.y=pose.yaw;}
  }
  const skateThrottle=createHudThrottle(100);
  let skateBuiltAt=-Infinity,hadSkate=false;
  const skateLog:string[]=[];
  /**
   * Hand the shell the HUD model: built at most every 50 ms (or at once on a
   * sim event), published through the throttle (urgent changes at once), and
   * `force` for pause/enable/route changes the shell must see immediately.
   */
  function publishSkate(now:number,force=false):void{
    const one=walker?.skate;
    if(!one?.active()){
      if(hadSkate){hadSkate=false;skateThrottle.reset();skatePark.update(null);callbacks.onSkate?.(null);}
      if(diagnostics){delete host.dataset.skate;delete host.dataset.skateEvents;skateLog.length=0;}
      return;
    }
    if(!force&&now-skateBuiltAt<50&&!one.events().length)return;
    skateBuiltAt=now;
    const model=one.hud();if(!model)return;
    const out=force?(skateThrottle.reset(),skateThrottle.offer(model,now)):skateThrottle.offer(model,now);
    if(!out)return;
    hadSkate=true;
    skatePark.update(out.run?{run:{id:out.run.id,checkpoint:out.run.gate,finished:out.run.finished}}:null);
    const progress=one.progress();
    if(progress)callbacks.onSkate?.({model:out,progress,revision:one.revision()});
  }
  // A place says something in it changed: the twins' tables are read again.
  const invalidate = () => { if (!disposed) { dirty = true; listsDirty = true; schedule(); } };
  let reading: PlaceReading | null = callbacks.reading ?? null;
  /**
   * Every place standing right now. Before world space this was one at rest
   * and two for the length of a journey; a **placed** interior (`scene/place.ts`)
   * also stands here for as long as the viewer is near its building, whichever
   * place the route says you are in. `matrix` is the transform its root group
   * was given, kept so the twins can be projected from the place's own
   * coordinates without walking the scene graph again; it is null — and every
   * path below is byte-for-byte what it always was — for an unplaced place.
   */
  let calmWorld=false;
  let mountainRecovery:MountainRecoveryView|null=null;
  let mountainInteraction:MountainInteractionState|null=null;
  const live = new Map<HarbourPlaceId, { handle: PlaceHandle; abort: AbortController; placement: PlacePlacement | null; matrix: THREE.Matrix4 | null }>();
  /**
   * Where the viewer stands on the island (§2). The body lane drives it; until
   * then it follows the camera's target on the ground, which is where you are
   * looking and near enough to where you are.
   */
  let focus: [number, number] = [0, 0];
  /** Which placed buildings the focus is inside, so a crossing is an event and not a state read every frame. */


  /**
   * A placed interior stands where its building stands. The transform is the
   * Court's own spot and yaw for that building's exterior, lifted clear of the
   * island under it (`placementLift`).
   */
  function stand(handle: PlaceHandle, placement: PlacePlacement | null): THREE.Matrix4 | null {
    if (!placement) return null;
    const lift = placementLift(placement);
    handle.group.position.set(placement.spot[0], lift, placement.spot[1]);
    handle.group.rotation.set(0, placement.yaw, 0);
    handle.group.updateMatrix();
    handle.group.updateMatrixWorld(true);
    return handle.group.matrix.clone();
  }

  /**
   * Interior/exterior coherence (§5): while a placed interior is resident, the
   * Court's exterior shell for that building is not drawn. The two are not the
   * same object at different distances — the Court's shell is a village-scale
   * marker two to three units across and the interior is a room seven to nine
   * across — so the room swallows its own shell whole. Drawing both puts the
   * shell's roof inside the room and its floor slab in the same plane as the
   * island; hiding it costs nothing, keeps the silhouette honest while you are
   * outside, and gives the draw calls back the moment the room is let go.
   */
  function showExteriors(): void {
    const court = live.get("court");
    if (!court) return;
    const active = placementOf(placeId);
    for (const [id, resident] of live) if(id !== 'court') resident.handle.group.visible = id === placeId;
    court.handle.group.traverse((node) => {
      if (node.name === 'village-waterfront') node.visible = placeId !== 'campfire';
      if(node.name.startsWith('sign-')) node.visible=placeId==='court';
      if(node.userData.villageShell) {
        const open=node.name===active?.exterior;
        node.visible=!(open && placeId==='cellar');
        node.traverse(child=>{
          if(child.name.endsWith('-roof-cutaway')||child.name.endsWith('-front-cutaway')) child.visible=!open;
        });
      }
    });
    renderer.localClippingEnabled = true;
    const hole = placeId==='cellar' ? active : null;
    const planes:THREE.Plane[]=[];
    if(hole){
      for(const [lx,lz,half] of [[1,0,hole.halfWidth],[-1,0,hole.halfWidth],[0,1,hole.halfDepth+8],[0,-1,hole.halfDepth]]){
        const normal=new THREE.Vector3(lx!*Math.cos(hole.yaw)+lz!*Math.sin(hole.yaw),0,lz!*Math.cos(hole.yaw)-lx!*Math.sin(hole.yaw));
        planes.push(new THREE.Plane(normal,-normal.x*hole.spot[0]-normal.z*hole.spot[1]-half!));
      }
    }
    ground.group.traverse(node=>{
      if(node instanceof THREE.Mesh && ['Island ground','Sea','Shallows'].includes(node.name)){
        for(const material of Array.isArray(node.material)?node.material:[node.material]) {material.clippingPlanes=planes;material.clipIntersection=true;material.needsUpdate=true;}
      }
    });
  }

  function raise(place: Place): PlaceHandle {
    const standing = live.get(place.id);
    if (standing) return standing.handle;
    const control = new AbortController();
    abort.signal.addEventListener("abort", () => control.abort(), { once: true });
    let built: PlaceHandle;
    let placement = placementOf(place.id);
    try { built = place.build(scene, dressing, reading, tier, { composition, signal: control.signal, invalidate }); }
    catch { built = EMPTY_PLACE.build(scene, dressing, null, tier, { composition, signal: control.signal, invalidate }); placement = null; }
    if(place.id==='court'){
      const mountain=built as MountainPresentationHandle;
      mountain.setCalm?.(calmWorld);
      if(mountainRecovery)mountain.setRecovery?.(mountainRecovery);
      // Priming the current state restores props without replaying an earlier bell ring.
      if(mountainInteraction)mountain.setInteraction?.(mountainInteraction);
    }
    live.set(place.id, { handle: built, abort: control, placement, matrix: stand(built, placement) });
    showExteriors();
    listsDirty = true;
    return built;
  }
  function pull(id: HarbourPlaceId): void {
    const standing = live.get(id);
    if (!standing) return;
    listsDirty = true;
    live.delete(id);
    standing.abort.abort();
    standing.handle.dispose();
    showExteriors();
  }
  /**
   * The Court and the buildings standing on it are **one island**: the Court is
   * the ground the placed interiors are built on, so walking from the terrace
   * into the Library cannot tear the terrace down — that is the whole of what
   * "one continuous place" means. Everywhere else is somewhere else: the
   * Tower is up a stair, the Cellar is under the floor, the Kitchen is its own
   * room, and stepping into one of those still leaves the island entirely.
   */
  const onIsland = (id: HarbourPlaceId): boolean => id === "court" || placementOf(id) !== null;

  /**
   * What stands once a journey has landed (§2). Arriving somewhere on the
   * island keeps the island — the streamer alone lets a building go. Arriving
   * anywhere else is exactly today's behaviour: everything but the place you
   * arrived in is torn down the moment you get there.
   */
  function prune(into: HarbourPlaceId, leaving: HarbourPlaceId): void {
    if (onIsland(into)) {
      if (leaving !== into && !onIsland(leaving)) pull(leaving);
      return;
    }
    for (const id of [...live.keys()]) if (id !== into) pull(id);
  }

  /** The standing place's hold, moved onto the island with its building (§4). */
  const holdFor = (id: HarbourPlaceId): RoomHold | null => placedFootprintHold(PLACE_HOLDS[id] ?? null, placementOf(id));

  /**
   * The streamer (§2). Distance-based, with hysteresis: a placed interior is
   * built when the focus comes within its own reach plus a margin, and let go
   * only four units further out again, so walking back and forth across one
   * threshold cannot thrash a whole building's build. The place the route says
   * you are in, and the place a journey is still flying out of, are never let
   * go however far the focus wanders. A place whose chunk has not arrived yet
   * is simply skipped; the next move asks again.
   */
  function stream(): boolean {
    let changed = false;
    const keep: HarbourPlaceId[] = journey ? [placeId, journey.from] : [placeId];
    for (const step of streamPlaces(focus, live.keys(), keep)) {
      if (step.action === "raise") {
        const place = PLACES[step.id];
        if (!place) continue;
        raise(place);
        changed = true;
      } else { pull(step.id); changed = true; }
    }
    // The ground under them. A building can never stand on nothing, so the
    // Court comes up with the first interior that needs it and stays up for
    // as long as one of them — or the route — is on the island.
    const wantsIsland = (placeId !== "court" && onIsland(placeId)) || PLACED_PLACE_IDS.some((id) => live.has(id));
    if (wantsIsland && !live.has("court") && PLACES.court) { raise(PLACES.court); changed = true; }
    const detailCourt=live.get('court')?.handle as (PlaceHandle & {streamDetails?:(x:number,z:number,race:boolean)=>boolean})|undefined;
    const run=walker?.skate.active()?walker.skate.run():null;
    // Hearth Mountain v2 (C10): district detail follows the camera's *target*
    // while Look drives — and Look on the open world is a view of the whole
    // mountain (the arrival shot, the overview, every tour stop), so there
    // every district is held in detail — and the body while Walk, a ride or
    // the board drives. Placed interiors and doorways stay on the body (`focus`).
    const lookDriving=!following&&placeId==='court';
    const view=lookDriving?court.pose().target:null;
    const detailX=view?view[0]:focus[0],detailZ=view?view[2]:focus[1];
    if(detailCourt?.streamDetails?.(detailX,detailZ,(run?.id==='mountain-descent'&&!run.finished)||lookDriving)){
      changed=true;showExteriors();
    }
    return changed;
  }

  /**
   * Doors that are thresholds (§3). Crossing into a placed building's doorway
   * — or simply standing inside its walls — is an arrival; walking back out of
   * the one you are standing in is a departure. Each is reported **once**, on
   * the crossing, and the route change the shell makes from it is the same one
   * a tap on the building from across the lawn makes, so nothing downstream
   * can tell the two apart. Tapping from a distance is untouched.
   */
  let previousDoorPoint: [number,number] | null = null;
  let pendingDoor:HarbourPlaceId|null=null;
  function thresholds(): void {
    if(!bodyDriven) return;
    if(walker?.skate.active()&&(walker.state().air>0||walker.action()?.act==='skate-grind')){previousDoorPoint=[...focus];return;}
    const before=previousDoorPoint; previousDoorPoint=[...focus];
    if(!before || pendingDoor || Math.hypot(focus[0]-before[0],focus[1]-before[1])>1.5) return;
    const next=crossedVillageDoor(before,focus,placeId,walker?.state().y);
    if(next){
      pendingDoor=next;
      if(next==='court'){court.setHold(null);follow?.setHold(null);}
      callbacks.onThreshold?.(next);
    }
  }

  /** Has the character lane taken the focus? Until it does, the camera's target is where you are. */
  let bodyDriven = false;
  function followCamera(): void {
    if (bodyDriven) return;
    const target = court.pose().target;
    focus[0] = target[0]; focus[1] = target[2];
  }

  /** The standing place's placement, and a point of its own read in island coordinates. */
  const standingPlacement = (): PlacePlacement | null => live.get(placeId)?.placement ?? null;
  const localToWorld = (point: Vec3): Vec3 => {
    const placement = standingPlacement();
    return placement ? placementToWorld(placement, point) : point;
  };

  const activePlace = callbacks.place ?? PLACES.court ?? EMPTY_PLACE;
  // Only the Court has an idle motion (her breath). A tower or a cellar at
  // rest asks for no frames until something in it says otherwise.
  breathing = activePlace !== EMPTY_PLACE && activePlace.id === "court";
  let placeId: HarbourPlaceId = activePlace.id;
  let handle: PlaceHandle = raise(activePlace);
  /**
   * The journey in flight: the plan, the place being left behind, and the
   * frame clock it started on — taken from the first frame that runs, so the
   * elapsed time is always read on the same clock the frames arrive on.
   */
  let journey: { plan: TravelPlan; startedAt: number | null; from: HarbourPlaceId } | null = null;

  /** Put the roof and the lid where a frame of the journey says they are; a handle without one simply has none. */
  function settle(roof: number, lid: number): void {
    for (const { handle: each } of live.values()) {
      roofOf(each)?.(roof);
      lidOf(each)?.(lid);
    }
  }
  // ── Hearth Mountain v2 · the camera track ─────────────────────────────────
  // The open world's lens (wider on a portrait phone, C12) and what stands in
  // the eye's way: terrain, decks, buildings, storefronts, the dam, pillars and
  // a moving cabin (C11). Rooms keep their own lens and their own hold.
  let cabinSolid: MovingSolid | null = null;
  const lookLens = (): number => (placeId === 'court' ? openWorldFov(composition, camera.aspect || (composition === 'phone' ? 390 / 844 : 1.6)) : fovFor(composition));
  const walkLens = lookLens;
  const eyeBlocked = (x: number, y: number, z: number): boolean => cameraBlocked(x, y, z, .12, tier === 'full' ? 'full' : 'lite', cabinSolid);
  const lookTerrain = () => (placeId === 'court' ? { ground: cameraGround, blocked: (x: number, y: number, z: number) => cameraBlocked(x, y, z, .15, 'lite', cabinSolid) } : null);
  /** Ease the drawn lens toward `goal` (a change of mode blends, C10 minor); reduced motion cuts. True while easing. */
  function easeLens(goal: number, dt: number): boolean {
    if (Math.abs(camera.fov - goal) < 1e-2) { if (camera.fov !== goal) { camera.fov = goal; camera.updateProjectionMatrix(); } return false; }
    camera.fov = reducedMotion() || !(dt > 0) ? goal : camera.fov + (goal - camera.fov) * (1 - Math.exp(-4 * Math.min(dt, .1)));
    camera.updateProjectionMatrix();
    return true;
  }
  const court: CourtCamera = createCourtCamera({ camera, composition, reduced: reducedMotion(), fov: fovFor(composition), terrain: lookTerrain() });
  // The standing room holds the camera from the first frame: a stale return
  // slot or a wild zoom can never show a room from the lawn.
  court.setHold(holdFor(placeId));
  aim("court");
  // First paint belongs to this room, even when it is far from the square.
  court.setReduced(true);
  court.setReduced(reducedMotion());

  // ── The body lane (world-body → walk-everywhere) ───────────────────────────
  // The body stands from the first frame, in whichever place is standing; the
  // follow camera only takes over the moment you actually move. So each
  // place's first screen is the composition it has always been, and the
  // stage's promise — "W A S D walk" — is true the first time you press a key,
  // wherever you are standing.
  let walker: Walker | null = null;
  let follow: FollowCamera | null = null;
  let following = false;
  /**
   * The skate chase camera (SHOW `camera/skateCamera.ts`). It writes the
   * PerspectiveCamera on skate frames; the follow camera keeps its subject so
   * the hand-back when the board goes away is seamless. Mouse drag is the
   * board stick while skating, so the chase camera has no orbit (decision
   * 2026-09-23): it frames the line itself.
   */
  let skateCam: SkateCamera | null = null;
  let skateCamera = false;
  let selectedAvatar=callbacks.avatar??null;
  let cat:Cat|null=null,errand:CatErrand|null=null,errandKey:string|null=null,catWatch:{x:number;z:number}|null=null;
  let catCatchUpAt=0,zoomEdge:ZoomEdge=ZOOM_REST,zoomArmed=false,journeyRequested=false;
  /** Hearth Mountain v2 · the ride camera (C4), the race's finish shot, and the keyboard orbit hold (Q/E). */
  let rideCam: RideCamera | null = null, rideOn: { kind: TransportKind; to: number } | null = null;
  const finishShot = createFinishShot();
  let spin: -1 | 0 | 1 = 0;
  /** Close was entered from Walk: leaving it returns to Walk at the body. */
  let closeFromWalk = false;
  let bodyInput: BodyInput = NO_INPUT;
  const bodySamples: number[] = [];
  /**
   * The floor under the body, for the place that is standing. A stable closure
   * over a value the place changes, so the walker and the follow camera are
   * both made once and both read the right floor after a walk into a building.
   */
  let mountainTrip:{kind:TransportKind;from:number;to:number;elapsed:number;duration:number}|null=null;
  const mountainHandle=()=>(live.get('court')?.handle??handle) as MountainPresentationHandle;
  let bodyGround: (x: number, z: number) => number = placeGround(placeId);
  /** This place's own ways out, when walking to one of them is how you leave (an unplaced room). */
  let bodyExits: Anchor[] = [];
  /**
   * You arrive a step inside the door, so the door is not a place you are
   * already standing — but a body nudged back against it by a wall would
   * otherwise leave the moment it arrived. The way out is armed once the body
   * has been a clear stride away from every one of them.
   */
  let exitArmed = false;
  /**
   * Point the body at the place that is standing: its floor, its walls, what
   * is in the way, and how close the camera stands. Called when a body is
   * raised and again whenever the place under it changes.
   */
  function standBody(): void {
    skatePark.group.visible=placeId==='court';
    const anchors = handle.anchors();
    const room = placeRoom(placeId, anchors);
    bodyGround = placeGround(placeId);
    // A placed building is left by walking out of its doorway, which the
    // threshold machinery already watches; everywhere else the way out is the
    // room's own stair, and walking to it is tapping it.
    bodyExits = (placeId==='court'?[]:placementOf(placeId)?anchors.filter(a=>a.zone==='portal'):exitAnchors(anchors)).map(a=>({...a,position:localToWorld(a.position)}));
    exitArmed = false;
    walker?.setWorld({ obstacles: placeObstacles(placeId, handle.regions(), anchors, tier), room });
    cat?.setWorld({groundHeightAt:(x,z)=>bodyGround(x,z),obstacles:placeObstacles(placeId,handle.regions(),anchors,tier),room,shore:HARBOUR_LAND.shore});
    cat?.setPerch(placeId==='court'?{x:2.2,z:1.6}:null);
    if (follow) {
      const eye=camera.position.clone(),orientation=camera.quaternion.clone(),fov=camera.fov;
      follow.setHold(followHoldIn(holdFor(placeId), room));
      const reach = walksIndoors(placeId) ? roomReach(room) : null;
      follow.setPlan(reach === null ? null : followInRoom(reach, composition));
      follow.setFov(walkLens());
      // Configuring the inactive walking rig must not take over the room view.
      if(!following){camera.position.copy(eye);camera.quaternion.copy(orientation);camera.fov=fov;camera.updateProjectionMatrix();}
    }
  }
  /**
   * Where the body stands when it comes out of a building onto the island: on
   * the lawn outside that building's own door, facing away from it, so
   * stepping back out of the Library is the walk you would have taken. From
   * anywhere that is not a building on the island, the Court's own way in.
   */
  function courtLanding(from: HarbourPlaceId): { x: number; z: number; yaw: number } {
    const placement = placementOf(from);
    if (!placement) return { x: COURT_ARRIVAL.x, z: COURT_ARRIVAL.z, yaw: COURT_ARRIVAL.yaw };
    const [dx, , dz] = placement.door;
    const out = Math.hypot(dx, dz) || 1;
    const [wx, , wz] = placementToWorld(placement, [dx + (dx / out) * COURT_DOORSTEP, 0, dz + (dz / out) * COURT_DOORSTEP]);
    return { x: wx, z: wz, yaw: Math.atan2(dx / out, dz / out) + placement.yaw };
  }
  function raiseBody(): void {
    if (walker) { standBody(); return; }
    const anchors = handle.anchors();
    const room = placeRoom(placeId, anchors);
    const start = placeId === "court" ? COURT_ARRIVAL : placeArrival(placeId, anchors);
    bodyGround = placeGround(placeId);
    walker = createWalker({
      groundHeightAt: (x, z) => bodyGround(x, z),
      obstacles: placeObstacles(placeId, handle.regions(), anchors, tier),
      room,
      tier,
      start,
      reduced: reducedMotion(),
      skateReducedMotion:()=>reducedMotion()||calmWorld||toolOpen,
      avatar:selectedAvatar,invalidate,onAvatarStatus:callbacks.onAvatarStatus,theme,
    });
    scene.add(walker.group);
    const stood=walker.state();
    cat=createCat({groundHeightAt:(x,z)=>bodyGround(x,z),obstacles:placeObstacles(placeId,handle.regions(),anchors,tier),room,shore:HARBOUR_LAND.shore,tier,start:heelStand(stood),look:stood,reduced:reducedMotion()});
    scene.add(cat.group);errandKey=null;
    const eye=camera.position.clone(),orientation=camera.quaternion.clone(),fov=camera.fov;
    follow = createFollowCamera({ camera, composition, reduced: reducedMotion(), fov: walkLens(), groundHeightAt: (x, z) => placeId==='court'?cameraGround(x,z):bodyGround(x, z), blocked:(x,y,z)=>placeId==='court'&&eyeBlocked(x,y,z) });
    skateCam = createSkateCamera({ ground: (x, z) => bodyGround(x, z) });
    rideCam = createRideCamera({ ground: cameraGround, blocked: eyeBlocked });
    host.dataset.harbourBody = "standing";
    standBody();
    refreshErrand();
    camera.position.copy(eye);camera.quaternion.copy(orientation);camera.fov=fov;camera.updateProjectionMatrix();
  }
  function refreshErrand():void{
    const want=placeId==='court'?attentionOf(reading):null,key=want?.key??null;
    if(key===errandKey)return;
    errandKey=key;errand=want?{key:want.key,...attentionDoor(want.spot)}:null;cat?.setErrand(errand);
    if(diagnostics){if(want)host.dataset.harbourErrand=`${want.spot}: ${want.why}`;else delete host.dataset.harbourErrand;}
  }
  function bringCat():void{
    if(!cat||!walker)return;
    const at=walker.state(),heel=heelStand(at);cat.place(heel.x,heel.z,heel.yaw,at);
  }
  function dropBody(): void {
    raceGhost.visible=false;
    if (following) {
      following = false;
      // The view as it is shown becomes Look's (C3); the lens then blends to Look's own.
      handToLook(court, shownPose());
    }
    if(hadSkate){hadSkate=false;skateThrottle.reset();callbacks.onSkate?.(null);}
    walker?.dispose(); walker = null; follow = null; skateCam = null; skateCamera = false; rideCam = null; rideOn = null; cabinSolid = null; bodyInput = NO_INPUT;
    cat?.dispose();cat=null;
    bodyExits = []; exitArmed = false;
    delete host.dataset.harbourBody;
  }
  /** Take the follow camera, or hand the view back to the Look camera where it stands. */
  function setFollowing(on: boolean): void {
    const wanted = on && walker !== null && follow !== null && !toolOpen;
    if (wanted === following) return;
    following = wanted;
    host.dataset.harbourBody = wanted ? "following" : "standing";
    if (wanted && walker && follow) {
      const at = walker.state();
      if(placeId==='court'&&!reducedMotion())mountainHandle().setVisitor?.([at.x,at.y,at.z]);
      host.dataset.houseBody=JSON.stringify({world:MOUNTAIN_VERSION,place:placeId,x:at.x,z:at.z,y:at.y,yaw:at.yaw});
      follow.setSubject(walkSubject(at));
      // Start from where the Look camera stands, so this is a move, not a cut —
      // unless Look is looking somewhere else entirely (C3: `SEED_REACH`).
      handToWalk(follow, court.pose(), camera.fov);
    } else {
      // Hand it back at the eye it is actually showing: no jump either way.
      // Asking to be somewhere else also stops the walk — otherwise a body
      // still crossing the lawn would take the camera straight back off the
      // pose that was just asked for.
      walker?.cancel();
      bodyInput = NO_INPUT;
      // C3: Look's goal is re-aimed at the body with the view's own r/θ/φ —
      // exactly what was on screen — so the next frame moves nothing (a tool,
      // the guide or a pause never whips the camera to a stale town goal).
      // The lens blends back to Look's own in the loop.
      handToLook(court, shownPose());
    }
    dirty = true;
    schedule();
  }
  /** What the walking camera looks at: 1.2 above the feet outdoors, the eye line indoors, the board's deck skating. */
  function walkSubject(at: ReturnType<Walker['state']>): { x: number; y: number; z: number; yaw: number; speed: number; air: number } {
    const y = walker?.skate.active() ? at.y + .28 : walksIndoors(placeId) ? eyeHeight(at) : at.y + FOLLOW_LOOK_HEIGHT;
    return { x: at.x, y, z: at.z, yaw: walker?.skate.heading() ?? at.yaw, speed: at.speed, air: at.air };
  }
  /** The pose that is on screen right now, whichever camera drew it — where a hand-off to Look begins. */
  function shownPose(): CourtPose {
    if (rideOn && rideCam) { const f = rideCam.shot(); return poseFrom(f.eye, f.look); }
    if (skateCamera && skateCam) return skateCameraPose(skateCam.frame());
    if (follow) return follow.shown();
    return court.pose();
  }
  raiseBody();

  function setZoomEdge(armed: boolean): void { if (armed !== zoomArmed) { zoomArmed = armed; callbacks.onZoomEdge?.(armed); } }
  function zoomWorld(delta:number):void{
    if(!Number.isFinite(delta)||toolOpen||journeyRequested)return;
    if(following&&follow){
      if(placeId==='court'&&delta>0&&follow.pose().r>=FOLLOW_MAX_R-.2){
        // Scroll out of Walk: Look takes the view at the body, and the next pull climbs.
        setFollowing(false);
      }else{follow.zoom(delta);return;}
    }
    if(placeId==='court'&&callbacks.onJourney){
      // C5: only a pull made *at* the far limit counts; the first one shows
      // "Pull once more to open the Journey", a later one opens it.
      const now=performance.now();
      zoomEdge=harbourZoomExit(court.goal().r,delta,zoomEdge,now);
      setZoomEdge(zoomEdgeArmed(zoomEdge,now));
      if(zoomEdge.exit){zoomEdge=ZOOM_REST;setZoomEdge(false);journeyRequested=true;callbacks.onJourney();return;}
    }else{zoomEdge=ZOOM_REST;setZoomEdge(false);}
    court.zoom(delta);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(), projected = new THREE.Vector3(), box = new THREE.Box3();
  const pointers = new Map<number, Pointer>();
  /**
   * The close hold, remembered per place for as long as this world stands
   * (W7 a). Nothing is stored: come back tomorrow and every room opens the
   * way it always opens.
   */
  const closedIn = new Map<HarbourPlaceId, boolean>();
  /** The last ground tap, for the double-tap that takes the close hold on and off. */
  let lastGroundTap: { x: number; y: number; at: number } | null = null;
  /** The thumb-stick while a thumb is on it (W7 b). */
  let stick: { id: number; x0: number; y0: number; dx: number; dy: number } | null = null;
  let projectionSignature = "", pinchDistance = 0, paintSamples: number[] = [], projectSamples: number[] = [], dirty = true;
  function lists(): void {
    if (!listsDirty) return;
    listsDirty = false;
    anchorList = handle.anchors();
    regionList = handle.regions();
    anchorById.clear();
    for (const anchor of anchorList) anchorById.set(anchor.id, anchor);
  }
  /** The eight corners of a region's bounds and the one point an anchor projects from, allocated once. */
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3());
  const single = [new THREE.Vector3()];
  /** The camera was asked to move: paint at least one frame even if it cut there under reduced motion. */
  const moved = () => { dirty = true; court.setReduced(reducedMotion()); previous = performance.now(); schedule(); };

  function stagePoint(event: { clientX: number; clientY: number }): { x: number; y: number; bounds: DOMRect } {
    const bounds = host.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top, bounds };
  }

  function resolveHit(x: number, y: number, bounds: DOMRect): HarbourHit {
    if (bounds.width < 1 || bounds.height < 1) return { kind: "none" };
    // A pointer may land before the first paint; the renderer is what normally refreshes these.
    camera.updateMatrixWorld(); scene.updateMatrixWorld();
    ndc.set((x / bounds.width) * 2 - 1, -(y / bounds.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      let visibleNode:THREE.Object3D|null=hit.object,shown=true;
      while(visibleNode){if(!visibleNode.visible){shown=false;break;}visibleNode=visibleNode.parent;}
      if(!shown)continue;
      // ── The body lane (world-body) ──
      // Your own body is not a thing to tap: it stands between the eye and the
      // island in follow mode, and a tap that landed on your coat is a tap
      // meant for whatever is behind it.
      if (walker) { let own: THREE.Object3D | null = hit.object; let mine = false; while (own) { if (own === walker.group) { mine = true; break; } own = own.parent; } if (mine) continue; }
      const point = hit.point.toArray() as [number, number, number];
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const region = node.userData.region;
        if (typeof region === "string") return { kind: "queen", region, object: hit.object, point };
        const anchorId = node.userData.anchor;
        if (typeof anchorId === "string") {
          lists();
          const anchor = anchorById.get(anchorId);
          if (anchor) return { kind: "anchor", id: anchorId, anchor, point };
        }
        if (node.userData.ground === true) return { kind: "ground", point };
        node = node.parent;
      }
      // Material-batched architecture still has authored interaction volumes.
      // Test the actual ray hit in the room frame, never a screen-wide overlay.
      lists();
      const localPoint=hit.point.clone(),placement=live.get(placeId)?.matrix;
      if(placement)localPoint.applyMatrix4(placement.clone().invert());
      const found=regionList.find(region=>region.group!=="furniture"&&region.box?.containsPoint(localPoint)&&anchorById.has(region.id));
      if(found){const anchor=anchorById.get(found.id)!;return {kind:"anchor",id:found.id,anchor,point};}
      // Untagged scenery behaves as ground: dragging it orbits.
      return { kind: "ground", point };
    }
    return { kind: "none" };
  }

  function rectOf(points: THREE.Vector3[], count: number, width: number, height: number): { x: number; y: number; w: number; h: number; visible: boolean } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, behind = 0;
    for (let i = 0; i < count; i += 1) {
      projected.copy(points[i]!).project(camera);
      if (projected.z >= 1) behind += 1;
      const sx = (projected.x * 0.5 + 0.5) * width, sy = (-projected.y * 0.5 + 0.5) * height;
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    }
    if (behind === count || !Number.isFinite(minX)) return null;
    let w = Math.max(MIN_TWIN, maxX - minX), h = Math.max(MIN_TWIN, maxY - minY);
    w = Math.min(w, width); h = Math.min(h, height);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const x = Math.max(0, Math.min(width - w, cx - w / 2)), y = Math.max(0, Math.min(height - h, cy - h / 2));
    const visible = maxX > 0 && minX < width && maxY > 0 && minY < height;
    return {
 x, y, w, h, visible };
  }

  /**
   * Where each twin stands. Called just after the renderer has drawn, so the
   * scene's world matrices are the ones the frame was drawn with and are not
   * walked a second time; only the camera's own inverse is refreshed, which the
   * projection reads directly. Nothing here is allocated per frame but the
   * rects themselves, and those are only handed on when one of them moved.
   */
  function project(): void {
    if (!callbacks.onProject) return;
    if (stageWidth < 1 || stageHeight < 1) return;
    camera.updateMatrixWorld();
    lists();
    const rects: ProjectedRect[] = [];
    let signature = "";
    const placed = new Set<string>();
    // A place writes its anchors and its regions in its own coordinates. When
    // it stands somewhere on the island those coordinates are no longer the
    // island's, so each point goes through the transform its group was given.
    // An unplaced place has none and every number below is what it always was.
    const frame = live.get(placeId)?.matrix ?? null;
    for (const region of regionList) {
      if (region.group === "furniture") continue;
      if (region.box) box.copy(region.box);
      else { box.makeEmpty(); for (const object of region.objects ?? []) box.expandByObject(object); }
      if (box.isEmpty()) continue;
      for (let i = 0; i < 8; i += 1) {
        corners[i]!.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        if (frame && region.box) corners[i]!.applyMatrix4(frame);
      }
      const rect = rectOf(corners, 8, stageWidth, stageHeight);
      if (!rect) continue;
      // An anchor with the same id lends the region its door and its words: one twin per thing.
      const anchor = anchorById.get(region.id);
      placed.add(region.id);
      rects.push({ id: region.id, kind: "region", group: region.group, label: anchor?.label ?? region.label, door: anchor?.door, ...rect });
      signature += `${region.id}:${rect.x | 0}:${rect.y | 0}:${rect.w | 0}:${rect.h | 0}:${rect.visible ? 1 : 0}:${anchor?.label ?? region.label}|`;
    }
    for (const anchor of anchorList) {
      if (placed.has(anchor.id)) continue;
      const [x, y, z] = anchor.position;
      single[0]!.set(x, y + 0.6, z);
      if (frame) single[0]!.applyMatrix4(frame);
      const rect = rectOf(single, 1, stageWidth, stageHeight);
      if (!rect) continue;
      rects.push({ id: anchor.id, kind: "anchor", group: anchor.zone, label: anchor.label, door: anchor.door, ...rect });
      signature += `${anchor.id}:${rect.x | 0}:${rect.y | 0}:${rect.w | 0}:${rect.h | 0}:${rect.visible ? 1 : 0}:${anchor.label}|`;
    }
    if (signature === projectionSignature) return;
    projectionSignature = signature;
    callbacks.onProject(rects);
  }

  function render(): void {
    if (!lease.active || disposed) return;
    // `renderMs` used to span `project()` as well, so DOM-twin projection cost
    // was reported as render cost — which is why the Court's telemetry looked
    // GPU-bound when most of it was main-thread work. They are measured apart
    // now; `projectMs` is published beside it rather than hidden inside it.
    const began = performance.now();
    const lightAt=following&&walker?[walker.state().x,walker.state().y,walker.state().z] as const:court.pose().target;
    rig.focus(...lightAt,following?14:court.pose().r*.65);
    renderer.render(scene, camera);
    const rendered = performance.now();
    project();
    const projected = performance.now();
    if(!toolOpen&&visible&&!document.hidden)frameStudy.frame(projected,projected-began,{calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});
    // `renderMs` is what the GPU was asked for. Projecting the twins is CPU
    // work on this side of the frame and is measured separately in diagnostics.
    if (diagnostics) {
      paintSamples.push(rendered - began); if (paintSamples.length > 60) paintSamples.shift();
      projectSamples.push(projected - rendered); if (projectSamples.length > 60) projectSamples.shift();
    }
    // Development, the review server and a page asked for them keep the
    // numbers; a shipped frame writes nothing to the DOM at all.
    host.dataset.houseCamera = JSON.stringify(camera.position.toArray().map(n => Number(n.toFixed(4))));
    if (!diagnostics) return;
    host.dataset.renderMs = (paintSamples.reduce((a, b) => a + b, 0) / paintSamples.length).toFixed(2);
    host.dataset.projectMs = (projectSamples.reduce((a, b) => a + b, 0) / projectSamples.length).toFixed(2);
    // ── The body lane (world-body) ── what one step of the walk and the follow
    // camera cost this frame, and where the body stands, for the evidence run.
    if (walker) {
      if (bodySamples.length) host.dataset.bodyMs = (bodySamples.reduce((a, b) => a + b, 0) / bodySamples.length).toFixed(3);
      const at = walker.state();
      host.dataset.bodyAt = JSON.stringify([at.x, at.y, at.z, at.yaw, at.speed].map(n => Number(n.toFixed(3))));
    }
    host.dataset.drawCalls = String(renderer.info.render.calls); host.dataset.geometries = String(renderer.info.memory.geometries); host.dataset.textures = String(renderer.info.memory.textures);
  }

  function schedule(): void { if (!disposed && !frame && visible && !document.hidden && lease.active) frame = lease.requestFrame(loop); }

  function loop(now: number): void {
    frame = 0;
    if (disposed || !visible || document.hidden || !lease.active) return;
    if (intervalMs > 0 && now - lastPaint < intervalMs) { schedule(); return; }
    const dt = Math.min((now - previous) / 1000, 0.08); previous = now;
    court.setReduced(reducedMotion());
    // ── The continuous world (§2, §3) ──────────────────────────────────────
    // Where the viewer stands decides which placed interiors are built and
    // whether a doorway has just been crossed. Three distances and three
    // point-in-box tests; the work only ever happens on a frame that was
    // already being drawn, so a world at rest still asks for nothing.
    followCamera();
    if (stream()) { dirty = true; listsDirty = true; }
    thresholds();
    // ── The thumb-stick (W7 b) ─────────────────────────────────────────────
    // A press held still on the open ground becomes a stick under the thumb.
    // It is grown and walked here rather than on a timer of its own: frames
    // are already flowing while a pointer is down, so the stick costs the
    // frame policy nothing it was not already spending, and there is no raw
    // `requestAnimationFrame` anywhere near it.
    if (!stick && pointers.size === 1 && composition === "phone") {
      const only = [...pointers.values()][0];
      if (only && only.hit.kind === "ground" && now - only.startedAt >= STICK_MS
        && Math.hypot(only.x - only.startX, only.y - only.startY) < TAP_PIXELS) {
        stick = { id: only.id, x0: only.startX, y0: only.startY, dx: 0, dy: 0 };
        lastGroundTap = null;
        callbacks.onStick?.({ x: stick.x0, y: stick.y0, dx: 0, dy: 0 });
        dirty = true;
      }
    }
    // ── The body lane (world-body → walk-everywhere) ──
    // The stick drives the body, everywhere. W7 b built it to pan the camera;
    // "the same input, not two" now means the same input the keys drive, and
    // the camera-pan fallback it used to have in a room is **deleted** rather
    // than left standing — a body stands in every place, and a fallback that
    // slides the camera is how the stage came to promise a walk it did not do.
    // ── Hearth Mountain v2 · keyboard orbit (Q/E and , .) ── held keys turn the
    // view at a steady rate, through the very drag a mouse or a thumb makes.
    if (spin !== 0 && !toolOpen) {
      const px = (spin * ORBIT_KEY_RATE * Math.min(dt, .1)) / 0.0052;
      if (following && follow && !skateCamera && !rideOn) follow.drag(px, 0);
      else if (!following) court.drag(px, 0);
      dirty = true;
    }
    const push = stick ? Math.min(1, Math.hypot(stick.dx, stick.dy) / STICK_RADIUS) : 0;
    const stickInput: BodyInput | null = stick
      ? { forward: (-stick.dy / STICK_RADIUS) || 0, strafe: (stick.dx / STICK_RADIUS) || 0, run: push > 0.97 }
      : null;
    // ── The body lane (world-body): one step of the walk ──
    // Inside the frame the renderer lease already owns. There is no
    // `requestAnimationFrame` in this lane; `createWorldFrameScheduler` and the
    // lease own the loop, and the body only ever asks for the next frame by
    // saying it is still moving.
    let bodyMoving = false;
    if (walker && follow) {
      const skating = walker.skate.active() && placeId === 'court';
      if(skating!==skateCamera){
        // The board went away: the walking camera picks up from the chase camera's side of the rider, on a heading whose standing eye is clear of the ramps.
        if(!skating&&skateCam&&following){const on=walker.state();follow.seed(skateWalkPose(skateCam.frame(),{x:on.x,y:on.y+FOLLOW_LOOK_HEIGHT,z:on.z},(x,z)=>bodyGround(x,z),{r:FOLLOW_DISTANCE[composition],phi:FOLLOW_PHI,lookHeight:0}));follow.lensFrom(camera.fov);}
        // The board came out: the chase camera's lens starts where Walk's was (a blend, not a cut).
        if(skating&&skateCam)skateCam.lensFrom(camera.fov);
        skateCamera=skating;
      }
      const began = diagnostics ? performance.now() : 0;
      const drive = stickInput ?? bodyInput;
      // Asking for a direction is what turns the follow camera on: the Court's
      // first screen stays the diorama until you actually move.
      if (drive.forward !== 0 || drive.strafe !== 0) setFollowing(true);
      walker.setInput(drive);
      // Manual movement stays relative to the visible view. A tapped route
      // may turn the view behind its travel because it does not read WASD.
      follow.setSteering(drive.forward !== 0 || drive.strafe !== 0, Boolean(walker.state().goal));
      // Walk relative to what you can see: the follow camera's basis when it is
      // driving, the Look camera's heading when it is not.
      const heading = following ? follow.basis() : court.pose().theta;
      if(mountainTrip){
        bodyInput=NO_INPUT;walker.setInput(NO_INPUT);
        mountainTrip.elapsed=Math.min(mountainTrip.duration,mountainTrip.elapsed+(toolOpen?0:Math.min(.1,dt)));
        const p=transportPoint(mountainTrip.kind,mountainTrip.from,mountainTrip.to,(mountainTrip.duration?mountainTrip.elapsed/mountainTrip.duration:1));
        walker.place(p[0],p[2],walker.state().yaw,p[1]);mountainHandle().setTransit?.(p,mountainTrip.kind);previousDoorPoint=null;
        bodyMoving=true;
        if(mountainTrip.elapsed>=mountainTrip.duration){mountainTrip=null;mountainHandle().setTransit?.(null);callbacks.onMountainTravel?.(false);bringCat();}
      }else bodyMoving = walker.step(dt, (now - mountedAt) / 1000, heading);
      if(walker.skate.active()||hadSkate){
        // A controller's Start is read inside the step; the book follows at once.
        const wasPaused=walker.skate.paused();
        publishSkate(now,false);
        // Evidence captures read the ride the way they read the cat (dev/diagnostics only).
        if(diagnostics){
          const p=walker.skate.present();
          if(p){host.dataset.skate=JSON.stringify({phase:p.phase,speed:+p.speed.toFixed(2),y:+p.y.toFixed(2),x:+p.x.toFixed(2),z:+p.z.toFixed(2)});
            const seen=walker.skate.events();if(seen.length){skateLog.push(...seen.map(e=>e.kind==='pop'?`pop:${e.flipId??'ollie'}`:e.kind==='grind-start'?`grind:${e.grindId}`:e.kind));skateLog.splice(0,Math.max(0,skateLog.length-16));host.dataset.skateEvents=skateLog.join(' ');}}
          else delete host.dataset.skate;
        }
        if(walker.skate.paused()!==wasPaused)publishSkate(now,true);
      }
      if (walker.walking()) setFollowing(true);
      const at = walker.state();
      if(placeId==='court'&&!reducedMotion())mountainHandle().setVisitor?.([at.x,at.y,at.z]);
      host.dataset.houseBody=JSON.stringify({world:MOUNTAIN_VERSION,place:placeId,x:at.x,z:at.z,y:at.y,yaw:at.yaw});
      follow.setSubject(walkSubject(at));
      // ── The skate chase camera ── writes the camera on skate frames.
      const ridden = skating && following && skateCam ? walker.skate.present() : null;
      if (ridden && skateCam) {
        if (walker.skate.takeCut()) skateCam.snap(ridden);
        skateCam.setDistance(walker.skate.current()?.camera === 'far' ? 'far' : 'near');
        skateCam.setFastSpeed(walker.skate.run()?.id === 'mountain-descent' ? SKATE_CAM.raceFastSpeed : SKATE_CAM.fastSpeed);
        const f = skateCam.update(ridden, walker.skate.events(), dt, {
          aspect: camera.aspect, reducedMotion: reducedMotion() || walker.skate.current()?.reducedEffects === true,
          ceilingAt:worldCeilingAt,
          blocked: (x, y, z) => y < groundHeightAt(x, z) + .05 || worldCollisionAt(x,y,z,.12) || mountainFoliageAt(x,y,z,tier) || insideVillageBuilding(x, z, .12,y),
        });
        // Hearth Mountain v2: the race's authored start shot (the first 1.5 s
        // of the countdown, down the first bends) and its finish shot (the
        // quay and the Fund bank's door), each blended over the chase frame.
        const run=walker.skate.run(),race=run?.id==='mountain-descent'?run:null,still=reducedMotion()||walker.skate.current()?.reducedEffects===true;
        const startW=race?startShotWeight(race.countdown,still):0,finishW=finishShot.update(Boolean(race?.finished),dt,still);
        const shotAspect=camera.aspect||1.6,started=startW>0?blendShot(f,raceStartShot(undefined,shotAspect),startW):f;
        const shown=finishW>0?blendShot(started,raceFinishShot(shotAspect),finishW):started;
        if(startW>0||finishW>0)bodyMoving=true;
        camera.position.set(shown.position[0], shown.position[1], shown.position[2]);
        camera.up.set(0, 1, 0);
        camera.lookAt(shown.target[0], shown.target[1], shown.target[2]);
        if (shown.roll) camera.rotateZ(shown.roll);
        if (Math.abs(camera.fov - shown.fov) > 1e-3) { camera.fov = shown.fov; camera.updateProjectionMatrix(); }
        // Paused (the book is open) the ride and its camera hold still: no frames are asked for.
        if (!walker.skate.paused()) bodyMoving = true;
      }
      // ── The three lanes together ── streaming follows the **character**, not
      // the camera. `followCamera()` keeps the focus on the Look camera's
      // target only until a body exists to stand somewhere; from the first
      // frame a walker is alive, the island is streamed around its feet, so
      // walking out to a building loads that building and orbiting the camera
      // does not. `bodyDriven` is the flag world-space left for exactly this.
      // Only where the body is standing **on the island** is its position the
      // island position: a room at the origin has its own coordinates, and
      // handing those to the streamer would raise the Library because the
      // Cellar's stair happens to be near where the Library stands.
      if (onIsland(placeId)) { bodyDriven = true; focus[0] = at.x; focus[1] = at.z; thresholds(); }
      // ── Hearth Mountain v2 · the ride camera (C4) ──────────────────────────
      // A scripted camera on the funicular and the gondola: along the travel,
      // easing into the gorge reveal, the rider always in frame; at the far
      // station (or on a skip, which is a cut) Walk takes over behind the body
      // facing away from the platform.
      const trip = placeId === 'court' ? mountainTrip : null;
      if (trip && rideCam && !toolOpen) {
        if (!following) setFollowing(true);
        const u = trip.duration ? trip.elapsed / trip.duration : 1;
        const along = rideFrame(trip.kind, trip.from, trip.to, u);
        cabinSolid = { at: [along.at[0], along.at[1] + 1.1, along.at[2]], half: [1.3, 1.5, 1.3] };
        const input = { kind: trip.kind, u, cabin: along.at, dir: along.dir, rider: [at.x, at.y + 1.1, at.z] as Vec3, aspect: camera.aspect || 1.6, fov: walkLens() };
        const shot = rideOn ? rideCam.update(input, dt, reducedMotion()) : rideCam.start(input);
        rideOn = { kind: trip.kind, to: trip.to };
        camera.position.set(shot.eye[0], shot.eye[1], shot.eye[2]);
        camera.up.set(0, 1, 0);
        camera.lookAt(shot.look[0], shot.look[1], shot.look[2]);
        easeLens(shot.fov, dt);
        bodyMoving = true;
      } else if (rideOn) {
        const heading = rideExitHeading(rideOn.kind, rideOn.to);
        rideOn = null; cabinSolid = null;
        follow.setSubject(walkSubject(at));
        follow.lensFrom(camera.fov);
        walkFrom(follow, heading);
        bodyMoving = true;
      }
      if (following && !ridden && !rideOn && follow.tick(dt)) bodyMoving = true;
      // ── walking out of a room (walk-everywhere) ──
      // The way out of an unplaced room is its own stair or door, and reaching
      // it fires the very route change tapping it fires.
      if (bodyExits.length) {
        let nearest: Anchor | null = null, least = Infinity;
        for (const exit of bodyExits) {
          const gap = Math.hypot(at.x - exit.position[0], at.z - exit.position[2]);
          if (gap < least) { least = gap; nearest = exit; }
        }
        if (least > EXIT_REACH + 0.35) exitArmed = true;
        else if (exitArmed && nearest && least <= EXIT_REACH) {
          exitArmed = false;
          walker.cancel();
          bodyInput = NO_INPUT;
          callbacks.onExit?.(nearest);
        }
      }
      if(cat){
        const doing=walker.action(),emote=doing&&doing.act!=='jump'&&doing.act!=='slide'&&!doing.act.startsWith('skate')?doing.act as EmoteId:null;
        // Skating, he waits at the edge of the pad and watches (out of the lines and out of the shot).
        if(skating){if(!catWatch){const him0=cat.state();catWatch=skateWatchPoint(at,him0);}}else catWatch=null;
        const heeled=catWatch?{x:catWatch.x,z:catWatch.z,yaw:Math.atan2(at.x-catWatch.x,at.z-catWatch.z),speed:0,air:0,emote:null}:{...at,emote};
        if(cat.step(dt,(now-mountedAt)/1000,heeled))bodyMoving=true;
        const him=cat.state();
        if(!catWatch&&now>=catCatchUpAt&&(Math.hypot(him.x-at.x,him.z-at.z)>14||him.gaveUp!==null)){
          catCatchUpAt=now+1500;if(cat.catchUp({...at,emote}))bodyMoving=true;
        }
        if(diagnostics){host.dataset.catAt=JSON.stringify([him.x,him.y,him.z,him.yaw,him.speed]);host.dataset.catMood=cat.waiting()?`wait:${him.mood}`:him.mood;}
      }
      if (bodyMoving) dirty = true;
      if (diagnostics) { bodySamples.push(performance.now() - began); if (bodySamples.length > 60) bodySamples.shift(); }
    }
    // ── The body lane (world-body) ── the Look camera stands still while the follow camera drives.
    const easing = following ? false : court.tick(dt);
    // Look's lens blends to its own after any hand-off (C10 minor: no FOV cuts).
    const lensing = following ? false : easeLens(lookLens(), dt);
    if (zoomArmed && !zoomEdgeArmed(zoomEdge, performance.now())) { zoomEdge = ZOOM_REST; setZoomEdge(false); }
    if (spin !== 0 && !toolOpen) dirty = true;
    // A journey is the camera moving: it keeps frames flowing at the camera's rate and ends by dropping the place it left.
    if (journey) {
      if (journey.startedAt === null) journey.startedAt = now;
      const frame = travelAt(journey.plan, now - journey.startedAt);
      settle(frame.roof, frame.lid);
      dirty = true;
      if (frame.done) {
        if (journey.from !== placeId) prune(placeId, journey.from);
        journey = null;
        court.setHold(holdFor(placeId));
      }
    }
    updateRaceGhost();
    if(worldAmbience){const at=walker?.state();if(at&&walker){
      worldAmbience.update(at.x,at.y,at.z,at.speed,Boolean(at.supportId&&at.supportId!=='terrain'&&at.supportId!=='mountain-road'&&at.supportId!=='town-race-road'),!walker.skate.active()&&!mountainTrip,calmWorld||toolOpen||placeId!=='court');
    }else worldAmbience.pause();}
    const moving = easing || lensing || (spin !== 0 && !toolOpen) || journey !== null;
    // Reduced motion (and a tool standing in front of the place): no animated
    // frame will ever run, so a place that asked to settle is settled the
    // moment it asks. Without this the flag stays up for the life of the
    // world and the policy is asked a question it has already answered.
    if (settling && (reducedMotion() || toolOpen)) settling = false;
    // `walking` is the body lane's one word to the policy: while it is true the
    // world runs at the camera's rate, and the moment the body stands still the
    // policy falls back through its own branches to asking for nothing.
    const policy = harbourFramePolicy({ reduced: reducedMotion(), moving, breathing: breathing || settling, touched: pointers.size > 0, projectionChanged: dirty, hidden: document.hidden || !visible, toolOpen, walking: bodyMoving });
    intervalMs = tier==='full'&&(bodyMoving||moving)?1000/60:policy.intervalMs;
    let animated = false;
    if (policy.animate && pointers.size === 0) {
      const t = (now - mountedAt) / 1000, adt = lastAnimated ? Math.min((now - lastAnimated) / 1000, 0.1) : 0;
      const moved = handle.animate(t, adt) === true;
      // The place has stopped moving of its own accord: stop asking for frames.
      if (settling && !moved) settling = false;
      animated = moved || animators.size > 0;
      for (const animate of animators) animate(t, adt);
      lastAnimated = now;
    }
    if (policy.render || animated) { render(); lastPaint = now; dirty = false; }
    if (policy.schedule) schedule();
  }

  function resize(): void {
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1 || !lease.active) return;
    // The one place the stage is measured: every frame after this reads it from here.
    stageWidth = width; stageHeight = height;
    const next: Composition = width < 720 ? "phone" : "desktop";
    if (next !== composition) { composition = next; court.setComposition(next); follow?.setComposition(next); }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // The open world's lens depends on the stage's shape (C12: never narrower
    // than 40° across in portrait). A resize is a cut; a change of mode blends.
    if (!following) camera.fov = lookLens();
    camera.updateProjectionMatrix();
    court.setFov(lookLens());
    follow?.setFov(walkLens());
    court.setAspect(camera.aspect);
    dirty = true;
    render(); schedule();
  }

  /**
   * ── Tideline Skate Club v2 ── while the board is down a mouse/pen drag on
   * the stage IS the board stick (flick-it) and the right button the back-hand
   * grab: the input track reads them; nothing orbits and nothing walks. Touch
   * rides through the HUD's own zones instead.
   */
  function skatePointer(event: PointerEvent, phase: "down" | "move" | "up" | "cancel"): boolean {
    const input = walker?.skate.active() && placeId === "court" && !toolOpen ? walker.skate.input() : null;
    if (!input || event.pointerType === "touch") return false;
    if (phase === "down") { if (!input.pointerDown(event)) return false; try { host.setPointerCapture(event.pointerId); } catch { /* jsdom */ } event.preventDefault(); setFollowing(true); schedule(); return true; }
    const used = phase === "move" ? input.pointerMove(event) : phase === "up" ? input.pointerUp(event) : input.pointerCancel(event);
    if (used && phase !== "move") { try { host.releasePointerCapture(event.pointerId); } catch { /* jsdom */ } }
    return used;
  }
  function onContextMenu(event: MouseEvent): void { if (walker?.skate.active()) event.preventDefault(); }
  function onPointerDown(event: PointerEvent): void {
    if (disposed || (event.target instanceof Element && event.target.closest("button,a,input,select,textarea,[role=button]"))) return;
    if (skatePointer(event, "down")) return;
    const { x, y, bounds } = stagePoint(event);
    const hit = pointers.size === 0 ? resolveHit(x, y, bounds) : { kind: "none" as const };
    pointers.set(event.pointerId, { id: event.pointerId, x, y, startX: x, startY: y, startedAt: performance.now(), hit, samples: [{ x, y, t: 0 }] });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDistance = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
    try { host.setPointerCapture(event.pointerId); } catch { /* jsdom */ }
    event.preventDefault();
    moved();
  }
  function onPointerMove(event: PointerEvent): void {
    if (skatePointer(event, "move")) return;
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    const { x, y } = stagePoint(event);
    const dx = x - pointer.x, dy = y - pointer.y; pointer.x = x; pointer.y = y;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      // ── The body lane (world-body) ── a pinch pulls the follow camera in and out.
      if (pinchDistance > 0 && distance > 0) { const delta = Math.log(pinchDistance / distance); zoomWorld(delta); dirty = true; }
      pinchDistance = distance;
    } else if (stick && stick.id === pointer.id) {
      // A thumb on the stick walks; it never orbits. The push is clamped to
      // the stick's radius so a thumb that slides off the edge does not run.
      const px = x - stick.x0, py = y - stick.y0;
      const reach = Math.hypot(px, py);
      const k = reach > STICK_RADIUS && reach > 0 ? STICK_RADIUS / reach : 1;
      stick.dx = px * k; stick.dy = py * k;
      callbacks.onStick?.({ x: stick.x0, y: stick.y0, dx: stick.dx, dy: stick.dy });
      dirty = true;
    } else if (pointer.hit.kind === "queen") pointer.samples.push({ x, y, t: performance.now() - pointer.startedAt });
    else if (isRail(pointer.hit) && callbacks.onRailDrag) { callbacks.onRailDrag(x, stageWidth || host.getBoundingClientRect().width); dirty = true; }
    // ── The body lane (world-body) ── a drag orbits around the character while
    // the follow camera drives. Same pixels, same gain, desktop and phone.
    else if (following && follow) { follow.drag(dx, dy); dirty = true; }
    else { court.drag(dx, dy); dirty = true; }
    schedule();
  }
  function onPointerEnd(event: PointerEvent): void {
    if (skatePointer(event, event.type === "pointercancel" ? "cancel" : "up")) return;
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    pointers.delete(event.pointerId); pinchDistance = 0;
    try { host.releasePointerCapture(event.pointerId); } catch { /* jsdom */ }
    // The thumb came off the stick: it goes away with it.
    if (stick && stick.id === pointer.id) { stick = null; callbacks.onStick?.(null); dirty = true; }
    if (event.type === "pointercancel") return;
    const travelled = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY), lasted = performance.now() - pointer.startedAt;
    if (travelled < TAP_PIXELS && lasted < TAP_MS) {
      callbacks.onTap?.(pointer.hit, { x: pointer.startX, y: pointer.startY });
      // Two quick taps on the open ground take the place's close hold on and
      // off: the ground itself opens nothing, so this steals no other tap.
      const at = performance.now();
      if (pointer.hit.kind === "ground") {
        const doubled = lastGroundTap !== null && at - lastGroundTap.at < DOUBLE_TAP_MS
          && Math.hypot(pointer.startX - lastGroundTap.x, pointer.startY - lastGroundTap.y) < DOUBLE_TAP_PIXELS;
        // ── The body lane (world-body) ──
        // Tap open ground and you walk there: the phone-friendly default, and
        // the same tap-to-go the Court has always had. The second tap of a
        // double-tap takes the walk back and does what it always did.
        if (doubled) { lastGroundTap = null; walker?.cancel(); applyClose(!court.closed()); moved(); }
        else {
          lastGroundTap = { x: pointer.startX, y: pointer.startY, at };
          if (walker&&!walker.skate.active()) { walker.goTo(pointer.hit.point[0], pointer.hit.point[2]); setFollowing(true); }
        }
      } else lastGroundTap = null;
    }
    else if (pointer.hit.kind === "queen") callbacks.onGesture?.({ region: pointer.hit.region, samples: pointer.samples });
    schedule();
  }
  function onWheel(event: WheelEvent): void {
    if (disposed) return;
    event.preventDefault();
    const delta = Math.max(-0.5, Math.min(0.5, event.deltaY * 0.0015));
    // ── The body lane (world-body) ── the wheel pulls the follow camera in and out.
    zoomWorld(delta);
    moved();
  }

  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", onPointerEnd);
  host.addEventListener("pointercancel", onPointerEnd);
  host.addEventListener("wheel", onWheel, { passive: false });
  host.addEventListener("contextmenu", onContextMenu);
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; observer?.observe(host);
  const intersection = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); if (visible) { previous = performance.now(); schedule(); } else { frameStudy.interrupt();worldAmbience?.pause();walker?.skate.pause(true);bodyInput=NO_INPUT;publishSkate(performance.now(),true);lease.cancelFrame(frame); frame = 0; } }) : null; intersection?.observe(host);
  const visibility = () => { if (document.hidden) { frameStudy.interrupt();worldAmbience?.pause();walker?.skate.pause(true);bodyInput=NO_INPUT;publishSkate(performance.now(),true);lease.cancelFrame(frame); frame = 0; } else { previous = performance.now(); schedule(); } };
  // ── The body lane (world-body) ── reduced motion cuts the follow camera
  // rather than swinging it. The character still walks: that is the app.
  const onReduced = () => {
    raceGhost.visible=false;
    court.setReduced(reducedMotion());
    const eye=camera.position.clone(),orientation=camera.quaternion.clone(),fov=camera.fov;
    follow?.setReduced(reducedMotion());
    if(!following){camera.position.copy(eye);camera.quaternion.copy(orientation);camera.fov=fov;camera.updateProjectionMatrix();}
    walker?.setReduced(reducedMotion());cat?.setReduced(reducedMotion()); schedule();
  };
  const comfortObserver = typeof MutationObserver !== "undefined" ? new MutationObserver(onReduced) : null;
  comfortObserver?.observe(document.documentElement,{attributes:true,attributeFilter:["data-motion"]});
  const removeLost = lease.listenCanvas("webglcontextlost", (event: Event) => { event.preventDefault(); worldAmbience?.pause();lease.cancelFrame(frame); frame = 0; callbacks.onFailure(); });
  document.addEventListener("visibilitychange", visibility); reduced.addEventListener("change", onReduced);
  previous = performance.now();
  resize(); callbacks.onReady();

  /**
   * Point the camera at a mode in the place that is standing. The Court keeps
   * the camera's own layout (`camera/poses.ts`) exactly as slice 1 tuned it;
   * the tower and the cellar are somewhere else entirely, so they are framed
   * by their own pose tables — `<placeId>:<composition>` for the room itself,
   * `object:<anchor>:<composition>` for one thing in it, `sky` for the whole.
   */
  /**
   * Put the close hold where the standing place says it belongs — or let it
   * go. A place with no close hold is simply never held.
   */
  function applyClose(on: boolean): boolean {
    // Hearth Mountain v2 (point 9): on the open world Close frames the
    // *nearest landmark* to the body — the fountain, the quay, a door, the
    // dam crest, the summit telescope — never the old fountain pose from the
    // top of the mountain; a room keeps its own one object.
    const at = walker?.state();
    const landmark = placeId === 'court' ? closeLandmark(at ? [at.x, at.y, at.z] : [0, 0, 0], composition) : null;
    const wanted = on && (placeId === 'court' ? landmark !== null : CLOSE_HOLDS[placeId] !== undefined);
    closedIn.set(placeId, wanted);
    const was = court.closed();
    // Walk is turned off before the hold is applied (the view is handed to
    // Look where it stands), and leaving Close returns to Walk at the body.
    if (wanted && !was) { closeFromWalk = following; if (following) setFollowing(false); }
    // The close hold is written in the room's own coordinates too; a placed
    // room's one object stands where the building stands.
    const close = wanted ? landmark?.pose ?? closePose(placeId, composition) : null;
    court.close(close ? (landmark ? close : placedPose(close, standingPlacement())) : null);
    if (was && !wanted && closeFromWalk) { closeFromWalk = false; setFollowing(true); }
    if (was !== wanted) callbacks.onClose?.(wanted);
    return wanted;
  }

  function aim(mode: CourtMode | "door", anchor?: string, instant = false): void {
    court.setReduced(instant || reducedMotion());
    {
      const key = mode === "court" ? placeId : mode === "object" && anchor ? `object:${anchor}` : mode;
      const written = poseFor(handle.poses(), key, composition) ?? (mode === "court" ? poseFor(handle.poses(), "court", composition) : undefined) ?? (mode === "door" ? poseFor(handle.poses(), "sky", composition) : undefined);
      const pose: Pose | undefined = written ? placedPose(written, standingPlacement()) : undefined;
      if (pose) { court.goTo({ target: pose.target, r: pose.r, theta: pose.theta, phi: pose.phi }); return; }
    }
    if (mode === "door") { court.go("object", "queen"); return; }
    if (mode !== "object" || isCourtAnchor(anchor)) { court.go(mode, isCourtAnchor(anchor) ? anchor : undefined); return; }
    const found = handle.anchors().find(a => a.id === anchor);
    if (found) {
      const [ax, ay, az] = localToWorld([found.position[0], Math.max(0.6, found.position[1]), found.position[2]]);
      court.goTo({ target: [ax, ay, az] });
    }
    else court.go("object");
  }

  const api: HarbourRuntime = {
    measure(action,label){if(action==='start')return frameStudy.start(label??'Mountain traversal');if(action==='stop')return frameStudy.stop();return frameStudy.snapshot();},
    setMountainRecovery(view){if(disposed)return;mountainRecovery=view;mountainHandle().setRecovery?.(view);dirty=true;schedule();},
    setMountainInteraction(state){if(disposed)return;mountainInteraction=state;mountainHandle().setInteraction?.(state);dirty=true;schedule();},
    mountainBell(){if(!disposed&&visible&&lease.active&&!toolOpen&&!calmWorld&&!reducedMotion()&&placeId==='court')worldAmbience?.bell();},
    setWorldAmbience(audio){worldAmbience=audio;dirty=true;schedule();},
    mountainCalm(on){calmWorld=on;if(on){worldAmbience?.pause();raceGhost.visible=false;walker?.skate.replay('stop');}publishSkate(performance.now(),true);mountainHandle().setCalm?.(on);dirty=true;schedule();},
    mountainSkip(){if(mountainTrip){mountainTrip.elapsed=mountainTrip.duration;dirty=true;schedule();}},
    mountainTravel(at,trip){
      if(placeId!=='court')return;
      raiseBody();if(!walker)return;
      mountainTrip=null;mountainHandle().setTransit?.(null);callbacks.onMountainTravel?.(Boolean(trip));bodyInput=NO_INPUT;walker.cancel();walker.setInput(NO_INPUT);
      const p=trip?TRANSPORT_STOPS[trip.kind][trip.from]!.at:at;
      // C7: a "Visit" arrival faces its building's door (the dam, the telescope, the view), and Walk stands behind.
      const arrival=trip?null:arrivalAt(p,composition);
      walker.place(p[0],p[2],arrival?.yaw??0,p[1]);bringCat();previousDoorPoint=null;pendingDoor=null;focus=[p[0],p[2]];
      rideOn=null;cabinSolid=null;
      setFollowing(false);setFollowing(true);if(follow){follow.setSubject(walkSubject(walker.state()));if(arrival)walkFrom(follow,arrival.yaw);else follow.snap();}stream();
      if(trip){const b=TRANSPORT_STOPS[trip.kind][trip.to]!.at;mountainTrip={...trip,elapsed:0,duration:reducedMotion()?0:Math.max(8,Math.hypot(b[0]-p[0],b[1]-p[1],b[2]-p[2])/14)};}
      dirty=true;schedule();
    },
    setAvatar(avatar){selectedAvatar=avatar;walker?.setAvatar(avatar);dirty=true;schedule();},
    // ── The body lane (world-body) ── an explicit destination hands the view
    // back to the Look camera first, so the flight starts from the eye you can
    // actually see and every named pose behaves exactly as it always has.
    go(mode, anchor) { setFollowing(false); aim(mode, anchor); moved(); },
    setReading(next) { reading = next; for (const { handle: each } of live.values()) each.update(next); refreshErrand();dirty = true; listsDirty = true; render(); schedule(); },
    look(next) { setFollowing(false); court.setReduced(reducedMotion()); court.goTo(next); stream(); moved(); },
    gesture(input) {
      court.setReduced(reducedMotion());
      // A keyboard orbit turns whichever camera is driving: Walk's view (and
      // with it the keys' basis) while walking, Look's otherwise.
      if (input.kind === "spin") { spin = input.dir; schedule(); return; }
      if (input.kind === "orbit") { if (following && follow && !skateCamera && !rideOn) follow.drag(input.dx, input.dy); else if (!following) court.drag(input.dx, input.dy); }
      else zoomWorld(input.delta);
      moved();
    },
    shot(id) {
      const aspect = camera.aspect || (composition === 'phone' ? 390 / 844 : 1.6), fov = lookLens();
      const [kind, name = ''] = id.split(/:(.*)/s, 2) as [string, string?];
      const pose = kind === 'tour' ? tourPose(name, composition, aspect)
        : kind === 'moment' ? momentPose(name, composition)
        : id === 'view:dam' ? damViewPose(composition, aspect, fov)
        : id === 'view:summit' ? summitViewPose(composition)
        : id === 'view:world' ? overviewPose(composition, aspect, fov)
        : id === 'view:town' ? poseFor(handle.poses(), 'court', composition) ?? null
        : null;
      if (!pose || placeId !== 'court') return false;
      setFollowing(false); court.setReduced(reducedMotion()); court.goTo({ target: pose.target, r: pose.r, theta: pose.theta, phi: pose.phi });
      // C10: the destination is streamed before the flight lands (Look on the open world holds every district).
      stream(); moved();
      return true;
    },
    // ── The body lane (world-body) ── a tool in front of the place turns the
    // stage into a door strip: the follow camera gives the view back for it.
    setToolOpen(open) { toolOpen = open; if (open) {spin=0;frameStudy.interrupt();raceGhost.visible=false;worldAmbience?.pause();walker?.skate.pause(true);publishSkate(performance.now(),true);setFollowing(false);} schedule(); },
    setBreathing(on) { breathing = on; schedule(); },
    invalidate() { settling = true; dirty = true; listsDirty = true; if(walker)standBody(); previous = performance.now(); schedule(); },
    addAnimator(animate) { animators.add(animate); listsDirty = true; schedule(); return () => { animators.delete(animate); }; },
    restore(position) { setFollowing(false); court.restore(position); dirty = true; render(); schedule(); },
    camera: () => camera.position.toArray() as [number, number, number],
    pose: () => court.pose(),
    place: () => handle,
    placeId: () => placeId,
    traveling: () => journey !== null,
    setFocus(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      bodyDriven = true;
      focus[0] = x; focus[1] = z;
      if (stream()) { dirty = true; listsDirty = true; }
      thresholds();
      schedule();
    },
    focus: () => [focus[0], focus[1]] as const,
    restream() {
      followCamera();
      if (stream()) { dirty = true; listsDirty = true; render(); }
      thresholds();
      schedule();
    },
    resident: () => PLACED_PLACE_IDS.filter((id) => live.has(id)),
    toggleClose(on) {
      const next = applyClose(on ?? !court.closed());
      moved();
      return next;
    },
    closed: () => court.closed(),
    // ── The body lane (world-body) ──
    body() {
      const one = walker;
      if (!one) return null;
      return {
        cancel(){bodyInput=NO_INPUT;one.setInput(NO_INPUT);one.cancel();},
        skate: {
          ...one.skate,
          ghost(){return !toolOpen&&!calmWorld&&!reducedMotion()&&placeId==='court'?one.skate.ghost():null;},
          replay(action){if(placeId!=='court')return;one.skate.replay(action);updateRaceGhost();publishSkate(performance.now(),true);moved();},
          restore(checkpoint){if(placeId!=='court')return;one.skate.restore(checkpoint);setFollowing(true);publishSkate(performance.now(),true);moved();},
          enable(on,progress){if(on&&placeId!=='court')return false;const result=one.skate.enable(on,progress);if(on)setFollowing(true);publishSkate(performance.now(),true);moved();return result;},
          pause(on){one.skate.pause(on);publishSkate(performance.now(),true);moved();},
          route(id){one.skate.route(id);setFollowing(true);previousDoorPoint=null;publishSkate(performance.now(),true);moved();},
          spot(id){one.skate.spot(id);setFollowing(true);previousDoorPoint=null;publishSkate(performance.now(),true);moved();},
          deck(id){one.skate.deck(id);publishSkate(performance.now(),true);moved();},
          settings(patch){one.skate.settings(patch);publishSkate(performance.now(),true);moved();},
          command(c){one.skate.command(c);setFollowing(true);publishSkate(performance.now(),true);moved();},
        },
        following: () => following,
        // Hearth Mountain v2 (C3): on the open world, giving up Walk leaves Look
        // at the body (it never flies to the town); a room still steps back to its own diorama.
        follow(on) { setFollowing(on); if (!on && placeId !== 'court') { aim("court"); } moved(); },
        input(next) { bodyInput = next; if (next.forward !== 0 || next.strafe !== 0) { setFollowing(true); } dirty = true; schedule(); },
        goTo(x, z) { const planned=one.goTo(x, z);if(planned)setFollowing(true); dirty = true; schedule();return planned; },
        place(x, z, yaw, y) { one.place(x, z, yaw, y);bringCat(); focus=[x,z]; previousDoorPoint=null; dirty = true; schedule(); },
        at() {
          const at = one.state(), doing = one.action();
          return { x: at.x, y: at.y, z: at.z, yaw: at.yaw, speed: at.speed, act: doing?.act ?? null, p: doing?.p ?? 0 };
        },
        walking: () => one.walking(),
        // ── The moves (walk-moves) ── each is one-shot and edge-safe: the
        // body takes it on the next frame, exactly once, and the frame is
        // asked for here because a key press is not otherwise a reason to paint.
        jump() { one.jump(); setFollowing(true); dirty = true; schedule(); },
        slide() { one.slideNow(); setFollowing(true); dirty = true; schedule(); },
        emote(id) { one.emote(id); dirty = true; schedule(); },
      };
    },
    enter(next, options = {}) {
      if(mountainTrip){mountainTrip=null;mountainHandle().setTransit?.(null);callbacks.onMountainTravel?.(false);}
      const from = options.from ?? placeId;
      const cut = options.reduced ?? reducedMotion();
      /**
       * You walked here (§3). There is no journey to fly and no camera to
       * re-aim: the interior is already standing and the eye is already in the
       * doorway. All that changes is which place the route says you are in —
       * and, with it, the hold. Every other way in keeps the choreography.
       */
      const crossing = options.threshold === true;
      if(!crossing)setFollowing(false);
      // A selected placed building is a change of viewpoint, not a camera
      // flight through its masonry. A walked doorway remains continuous.
      const portalCut = !crossing && (placementOf(from) !== null || placementOf(next) !== null);
      const plan = travelPlan(from, next, cut || crossing || portalCut);
      const place = PLACES[next];
      if (!place) return plan;
      // The place being entered is raised first, so both stand for the length of the journey.
      handle = raise(place);
      // ── The body lane (world-body → walk-everywhere) ──
      // The Court and the buildings standing on it are **one island**, so
      // walking from the terrace into the Library is the same body in the same
      // coordinates: the world under it is re-pointed and nothing is put away.
      // Anywhere else is somewhere else — up a stair, under the floor, across
      // the shore — so the body is put away and a fresh one is raised at that
      // place's own way in.
      const continuous = walker !== null && onIsland(placeId) && onIsland(next);
      const leaving = placeId;
      let doorExit: CourtPose | null = null;
      if (!continuous) dropBody();
      placeId = next;
      showExteriors();
      // Either way there is a body when this returns: a re-pointed one where
      // the island carried on, a fresh one at this place's own way in.
      raiseBody();
      /**
       * A **journey** is not a walk. Tapping the Library from across the lawn,
       * or picking its row in the quick sheet, flies the camera into the hall —
       * and the body has to be where the camera lands, or you are looking at a
       * room with nobody in it while your character stands out on the grass.
       * A **crossing** is the other case: there you walked in, the body is
       * already exactly right, and it is not touched.
       */
      if (continuous && !crossing && walker) {
        const portal=villagePortalArrival(leaving,next), placement=placementOf(next);
        const point=portal&&placement?placementToWorld(placement,portal.local):null;
        const landing = point&&portal&&placement?{x:point[0],z:point[2],yaw:portal.yaw+placement.yaw}:placement ? placeArrival(next, handle.anchors()) : courtLanding(leaving);
        walker.place(landing.x, landing.z, landing.yaw);
        bringCat();
        const at = walker.state();
        follow?.setSubject(walkSubject(at));
        follow?.snap();
        bodyDriven = true;
        focus[0] = landing.x; focus[1] = landing.z;
        // C3: out of a building onto the open world, the camera stands at the
        // door's outdoor pose — behind the body, facing *away* from the door —
        // so the first key press walks out, not back in (the Library case).
        if (next === 'court' && placementOf(leaving)) doorExit = doorExitPose(leaving, { x: at.x, y: at.y, z: at.z, yaw: landing.yaw }, composition);
      }
      court.setTerrain(lookTerrain());
      // The place you arrive in declares its own idle motion; until it does, nothing moves.
      refreshErrand();zoomEdge=ZOOM_REST;setZoomEdge(false);
      breathing = !reducedMotion();
      previousDoorPoint = null; pendingDoor=null;
      // A cut lands at once, so the destination's hold applies at once. A full
      // journey flies through the open air between the rooms: the hold is
      // lifted for the flight and the destination's takes over when it lands
      // (the `frame.done` branch of the loop).
      court.setHold(plan.cut ? holdFor(next) : null);
      if (!crossing && doorExit) {
        handToLook(court, doorExit);
        setFollowing(true);
        if (follow) { follow.snap(doorExit.theta); follow.lensFrom(camera.fov); }
      } else if (!crossing) {
        aim(plan.camera.mode, plan.camera.anchor ?? undefined, plan.cut);
        if (plan.cut) court.setReduced(reducedMotion());
      }
      // The room you are walking into opens the way you left it: its close
      // hold, if it had one on, goes straight back on. Walking in through the
      // door with no hold remembered leaves the camera exactly where the walk
      // put it, which is the whole point of a threshold.
      if (!crossing || closedIn.get(next) === true) applyClose(closedIn.get(next) ?? false);
      if (plan.cut) {
        settle(plan.roof[1], plan.lid[1]);
        prune(next, from);
        journey = null;
      } else {
        settle(plan.roof[0], plan.lid[0]);
        journey = { plan, startedAt: null, from };
      }
      projectionSignature = "";
      moved();
      return plan;
    },
    dispose() {
      frameStudy.interrupt();
      frameStudy.stop();
      worldAmbience?.pause();worldAmbience=null;
      if (disposed) return;
      disposed = true; abort.abort();
      if (stick) { stick = null; callbacks.onStick?.(null); }
      lease.cancelFrame(frame);
      host.removeEventListener("pointerdown", onPointerDown); host.removeEventListener("pointermove", onPointerMove); host.removeEventListener("pointerup", onPointerEnd); host.removeEventListener("pointercancel", onPointerEnd); host.removeEventListener("wheel", onWheel); host.removeEventListener("contextmenu", onContextMenu);
      observer?.disconnect(); intersection?.disconnect(); comfortObserver?.disconnect();
      document.removeEventListener("visibilitychange", visibility); reduced.removeEventListener("change", onReduced); removeLost();
      for (const id of [...live.keys()]) pull(id);
      // ── The body lane (world-body) ──
      dropBody();
      scene.remove(raceGhost);for(const geometry of ghostGeometries)geometry.dispose();ghostMaterial.dispose();
      skatePark.dispose();ground.dispose(); rig.dispose();
      lease.release();
      host.style.backgroundImage = "";
      delete host.dataset.renderer; delete host.dataset.houseCamera; delete host.dataset.houseBody;
      delete host.dataset.bodyAt; delete host.dataset.bodyMs;
      delete host.dataset.catAt;delete host.dataset.catMood;delete host.dataset.harbourErrand;
      delete (host as HTMLElement & { __harbour?: HarbourRuntime }).__harbour;
    },
  };
  // Development, the review server and a page that asked for diagnostics can
  // reach the standing world from the host element — the same gate the
  // per-frame numbers are written behind, and nothing a shipped page does.
  if (diagnostics) (host as HTMLElement & { __harbour?: HarbourRuntime }).__harbour = api;
  return api;
}
