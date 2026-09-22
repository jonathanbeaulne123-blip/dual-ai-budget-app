import * as THREE from "three";
import { acquireWorldRenderer } from "../../house/world/rendererOwner.ts";
import { worldDiagnostics } from "../../house/world/diagnostics.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import { createCourtCamera, type CourtCamera, type CourtLook } from "../camera/courtCamera.ts";
// ── The body lane (world-body) ───────────────────────────────────────────────
// Everything this lane adds to the runtime is additive and marked like this
// block. A sibling lane is restructuring this file; nothing above or below a
// marked block was rewritten to make room for the body.
import { createFollowCamera, type FollowCamera } from "../camera/followCamera.ts";
import { createWalker, COURT_ARRIVAL, type Walker } from "../body/walker.ts";
import { NO_INPUT, eyeHeight, type BodyInput } from "../body/bodyModel.ts";
import { CLOSE_HOLDS, COURT_ANCHOR_IDS, COURT_FOV, closePose, type CourtAnchor, type CourtMode, type CourtPose } from "../camera/poses.ts";
import { harbourFramePolicy, CAMERA_INTERVAL_MS } from "./framePolicy.ts";
import { createGround } from "./ground.ts";
import { configureHarbourRenderer, createLightRig } from "./lightRig.ts";
import { EMPTY_PLACE, PLACES, PLACE_HOLDS, SCENE_DRESSING, poseFor, type Anchor, type Composition, type Place, type PlaceDressing, type PlaceHandle, type PlaceReading, type Region, type Vec3 } from "./place.ts";
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

export type HarbourCallbacks = {
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
  /** Defaults: the registered court, the theme's scene dressing, no reading. */
  place?: Place;
  dressing?: PlaceDressing;
  reading?: PlaceReading | null;
  composition?: Composition;
};

/** A phone's portrait frame takes a wider field so the Queen and her flagstone fit at a friendly distance. */
export const PHONE_FOV = 52;
export const fovFor = (composition: Composition): number => (composition === "phone" ? PHONE_FOV : COURT_FOV);
const isCourtAnchor = (id: string | undefined): id is CourtAnchor => (COURT_ANCHOR_IDS as readonly string[]).includes(id ?? "");

/**
 * ── The body lane (world-body) ──
 * Your character, and the camera that walks with it. `null` where there is no
 * body to drive: the rooms are six units across and a body belongs on the
 * island, so this is the Court's alone for now.
 *
 * The Look camera is never taken away — `follow(false)` hands the view back to
 * it, and every named pose, every twin and every door work exactly as before.
 */
export type BodyControls = {
  /** Is the follow camera driving? */
  following: () => boolean;
  /** Take the follow camera, or give it back. Giving it back returns to the room's own pose. */
  follow: (on: boolean) => void;
  /** What the keys are asking for, in camera space (+forward is away from the eye). */
  input: (next: BodyInput) => void;
  /** Walk to a point on the ground — a tap. A straight line that slides off what it meets. */
  goTo: (x: number, z: number) => void;
  /** Put the body somewhere at once. */
  place: (x: number, z: number, yaw?: number) => void;
  /** Where it stands. */
  at: () => { x: number; y: number; z: number; yaw: number; speed: number };
  /** Is it walking right now? */
  walking: () => boolean;
};

export type HarbourRuntime = {
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
  /** Keyboard: arrows orbit, +/− zoom, WASD walks (a screen-space pan of the target, held inside the room). */
  gesture: (input: { kind: "orbit"; dx: number; dy: number } | { kind: "zoom"; delta: number } | { kind: "pan"; dx: number; dy: number }) => void;
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
  enter: (place: HarbourPlaceId, options?: { from?: HarbourPlaceId; reduced?: boolean }) => TravelPlan;
  /** Whether a journey is in flight (both places are mounted). */
  traveling: () => boolean;
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

const TAP_PIXELS = 8, TAP_MS = 350, MIN_TWIN = 44;
/** A second tap this soon after the first, and this near it, is one deliberate gesture. */
export const DOUBLE_TAP_MS = 320, DOUBLE_TAP_PIXELS = 28;
/**
 * The thumb-stick (W7 b): how long the ground is held still before it becomes
 * a stick, how far the thumb may push it, and how much walking a full push is
 * worth per second — in the same pixels-of-drag `pan` already speaks, so the
 * stick and W A S D drive one input and not two.
 */
export const STICK_MS = 380, STICK_RADIUS = 56, STICK_GAIN = 3.4;
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
  const mountedAt = performance.now();
  const diagnostics = worldDiagnostics();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
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
      lease.cancelFrame(frame); frame = 0;
      if (!disposed) { try { host.style.backgroundImage = `url(${renderer.domElement.toDataURL("image/webp", 0.75)})`; host.style.backgroundSize = "100% 100%"; } catch { /* The reading edition remains. */ } }
      host.dataset.renderer = "suspended";
    },
    onResume() { host.style.backgroundImage = ""; host.dataset.renderer = "active"; previous = performance.now(); resize(); schedule(); },
  });
  const renderer = lease.renderer;
  host.dataset.renderer = lease.active ? "active" : "suspended";
  host.dataset.harbourTier = tier;

  const camera = new THREE.PerspectiveCamera(fovFor(composition), 1, 0.1, 220);
  const animators = new Set<(t: number, dt: number) => void>();
  const rig = createLightRig(scene, dressing.light, tier);
  const ground = createGround(scene, dressing, tier);
  // A place says something in it changed: the twins' tables are read again.
  const invalidate = () => { if (!disposed) { dirty = true; listsDirty = true; schedule(); } };
  let reading: PlaceReading | null = callbacks.reading ?? null;
  /** Every place standing right now: one while at rest, two for the length of a journey. */
  const live = new Map<HarbourPlaceId, { handle: PlaceHandle; abort: AbortController }>();

  function raise(place: Place): PlaceHandle {
    const standing = live.get(place.id);
    if (standing) return standing.handle;
    const control = new AbortController();
    abort.signal.addEventListener("abort", () => control.abort(), { once: true });
    let built: PlaceHandle;
    try { built = place.build(scene, dressing, reading, tier, { composition, signal: control.signal, invalidate }); }
    catch { built = EMPTY_PLACE.build(scene, dressing, null, tier, { composition, signal: control.signal, invalidate }); }
    live.set(place.id, { handle: built, abort: control });
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
  }

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
  const court: CourtCamera = createCourtCamera({ camera, composition, reduced: reduced.matches, fov: fovFor(composition) });
  // The standing room holds the camera from the first frame: a stale return
  // slot or a wild zoom can never show a room from the lawn.
  court.setHold(PLACE_HOLDS[placeId] ?? null);
  court.go("court");

  // ── The body lane (world-body) ─────────────────────────────────────────────
  // The body stands on the island from the first frame; the follow camera only
  // takes over the moment you actually move. So the Court's first screen is the
  // diorama it has always been, and the stage's promise — "W A S D walk" — is
  // true the first time you press a key.
  let walker: Walker | null = null;
  let follow: FollowCamera | null = null;
  let following = false;
  let bodyInput: BodyInput = NO_INPUT;
  const bodySamples: number[] = [];
  function raiseBody(): void {
    if (walker || placeId !== "court") return;
    walker = createWalker({ groundHeightAt: ground.groundHeightAt, tier, start: COURT_ARRIVAL });
    scene.add(walker.group);
    follow = createFollowCamera({ camera, composition, reduced: reduced.matches, groundHeightAt: ground.groundHeightAt });
    host.dataset.harbourBody = "standing";
  }
  function dropBody(): void {
    if (following) { following = false; court.restore(camera.position.toArray() as Vec3); }
    walker?.dispose(); walker = null; follow = null; bodyInput = NO_INPUT;
    delete host.dataset.harbourBody;
  }
  /** Take the follow camera, or hand the view back to the Look camera where it stands. */
  function setFollowing(on: boolean): void {
    const wanted = on && walker !== null && follow !== null && placeId === "court" && !toolOpen;
    if (wanted === following) return;
    following = wanted;
    host.dataset.harbourBody = wanted ? "following" : "standing";
    if (wanted && walker && follow) {
      const at = walker.state();
      follow.setSubject({ x: at.x, y: eyeHeight(at), z: at.z, yaw: at.yaw, speed: at.speed });
      // Start from where the Look camera stands, so this is a move, not a cut.
      follow.seed(court.pose());
    } else {
      // Hand it back at the eye it is actually showing: no jump either way.
      // Asking to be somewhere else also stops the walk — otherwise a body
      // still crossing the lawn would take the camera straight back off the
      // pose that was just asked for.
      walker?.cancel();
      bodyInput = NO_INPUT;
      court.restore(camera.position.toArray() as Vec3);
    }
    dirty = true;
    schedule();
  }
  raiseBody();

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
  const moved = () => { dirty = true; court.setReduced(reduced.matches); previous = performance.now(); schedule(); };

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
    return { x, y, w, h, visible };
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
    for (const region of regionList) {
      if (region.box) box.copy(region.box);
      else { box.makeEmpty(); for (const object of region.objects ?? []) box.expandByObject(object); }
      if (box.isEmpty()) continue;
      for (let i = 0; i < 8; i += 1) corners[i]!.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
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
    renderer.render(scene, camera);
    const rendered = performance.now();
    project();
    const projected = performance.now();
    // `renderMs` is what the GPU was asked for. Projecting the twins is CPU
    // work on this side of the frame and is measured separately in diagnostics.
    if (diagnostics) {
      paintSamples.push(rendered - began); if (paintSamples.length > 60) paintSamples.shift();
      projectSamples.push(projected - rendered); if (projectSamples.length > 60) projectSamples.shift();
    }
    // Development, the review server and a page asked for them keep the
    // numbers; a shipped frame writes nothing to the DOM at all.
    if (!diagnostics) return;
    host.dataset.renderMs = (paintSamples.reduce((a, b) => a + b, 0) / paintSamples.length).toFixed(2);
    host.dataset.projectMs = (projectSamples.reduce((a, b) => a + b, 0) / projectSamples.length).toFixed(2);
    host.dataset.projectMs = (projectSamples.reduce((a, b) => a + b, 0) / projectSamples.length).toFixed(2);
    host.dataset.houseCamera = JSON.stringify(camera.position.toArray().map(n => Number(n.toFixed(4))));
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
    court.setReduced(reduced.matches);
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
    // ── The body lane (world-body) ──
    // The stick is repointed at the body: W7 b built it to pan the camera,
    // and "the same input, not two" now means the same input the keys drive.
    // Pushing it up walks away from the eye; pushing it to the ring runs.
    // Where there is no body (a room), it pans the camera exactly as before.
    const push = stick ? Math.min(1, Math.hypot(stick.dx, stick.dy) / STICK_RADIUS) : 0;
    const stickInput: BodyInput | null = stick
      ? { forward: (-stick.dy / STICK_RADIUS) || 0, strafe: (stick.dx / STICK_RADIUS) || 0, run: push > 0.97 }
      : null;
    if (stick && !walker && (stick.dx !== 0 || stick.dy !== 0) && dt > 0) {
      const step = STICK_GAIN * Math.min(dt, 0.08);
      court.pan(-stick.dx * step, -stick.dy * step);
      dirty = true;
    }
    // ── The body lane (world-body): one step of the walk ──
    // Inside the frame the renderer lease already owns. There is no
    // `requestAnimationFrame` in this lane; `createWorldFrameScheduler` and the
    // lease own the loop, and the body only ever asks for the next frame by
    // saying it is still moving.
    let bodyMoving = false;
    if (walker && follow) {
      const began = diagnostics ? performance.now() : 0;
      const drive = stickInput ?? bodyInput;
      // Asking for a direction is what turns the follow camera on: the Court's
      // first screen stays the diorama until you actually move.
      if (drive.forward !== 0 || drive.strafe !== 0) setFollowing(true);
      walker.setInput(drive);
      // A direction is being held: the follow camera latches the heading a key
      // is read against, so holding W walks a straight line while the camera
      // settles in behind you rather than curving you round in a circle.
      follow.setSteering(drive.forward !== 0 || drive.strafe !== 0);
      // Walk relative to what you can see: the follow camera's basis when it is
      // driving, the Look camera's heading when it is not.
      const heading = following ? follow.basis() : court.pose().theta;
      bodyMoving = walker.step(dt, (now - mountedAt) / 1000, heading);
      if (walker.walking()) setFollowing(true);
      const at = walker.state();
      follow.setSubject({ x: at.x, y: eyeHeight(at), z: at.z, yaw: at.yaw, speed: at.speed });
      if (following && follow.tick(dt)) bodyMoving = true;
      if (bodyMoving) dirty = true;
      if (diagnostics) { bodySamples.push(performance.now() - began); if (bodySamples.length > 60) bodySamples.shift(); }
    }
    // ── The body lane (world-body) ── the Look camera stands still while the follow camera drives.
    const easing = following ? false : court.tick(dt);
    // A journey is the camera moving: it keeps frames flowing at the camera's rate and ends by dropping the place it left.
    if (journey) {
      if (journey.startedAt === null) journey.startedAt = now;
      const frame = travelAt(journey.plan, now - journey.startedAt);
      settle(frame.roof, frame.lid);
      dirty = true;
      if (frame.done) {
        if (journey.from !== placeId) pull(journey.from);
        journey = null;
        court.setHold(PLACE_HOLDS[placeId] ?? null);
      }
    }
    const moving = easing || journey !== null;
    // Reduced motion (and a tool standing in front of the place): no animated
    // frame will ever run, so a place that asked to settle is settled the
    // moment it asks. Without this the flag stays up for the life of the
    // world and the policy is asked a question it has already answered.
    if (settling && (reduced.matches || toolOpen)) settling = false;
    // `walking` is the body lane's one word to the policy: while it is true the
    // world runs at the camera's rate, and the moment the body stands still the
    // policy falls back through its own branches to asking for nothing.
    const policy = harbourFramePolicy({ reduced: reduced.matches, moving, breathing: breathing || settling, touched: pointers.size > 0, projectionChanged: dirty, hidden: document.hidden || !visible, toolOpen, walking: bodyMoving });
    intervalMs = policy.intervalMs;
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
    if (next !== composition) { composition = next; camera.fov = fovFor(next); court.setFov(camera.fov); court.setComposition(next); follow?.setComposition(next); }
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    court.setAspect(camera.aspect);
    dirty = true;
    render(); schedule();
  }

  function onPointerDown(event: PointerEvent): void {
    if (disposed || (event.target instanceof Element && event.target.closest("button,a,input,select,textarea,[role=button]"))) return;
    const { x, y, bounds } = stagePoint(event);
    const hit = pointers.size === 0 ? resolveHit(x, y, bounds) : { kind: "none" as const };
    pointers.set(event.pointerId, { id: event.pointerId, x, y, startX: x, startY: y, startedAt: performance.now(), hit, samples: [{ x, y, t: 0 }] });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDistance = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
    try { host.setPointerCapture(event.pointerId); } catch { /* jsdom */ }
    event.preventDefault();
    moved();
  }
  function onPointerMove(event: PointerEvent): void {
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    const { x, y } = stagePoint(event);
    const dx = x - pointer.x, dy = y - pointer.y; pointer.x = x; pointer.y = y;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      // ── The body lane (world-body) ── a pinch pulls the follow camera in and out.
      if (pinchDistance > 0 && distance > 0) { const delta = Math.log(pinchDistance / distance); if (following && follow) follow.zoom(delta); else court.zoom(delta); dirty = true; }
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
          if (walker) { walker.goTo(pointer.hit.point[0], pointer.hit.point[2]); setFollowing(true); }
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
    if (following && follow) follow.zoom(delta); else court.zoom(delta);
    moved();
  }

  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", onPointerEnd);
  host.addEventListener("pointercancel", onPointerEnd);
  host.addEventListener("wheel", onWheel, { passive: false });
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; observer?.observe(host);
  const intersection = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); if (visible) { previous = performance.now(); schedule(); } else { lease.cancelFrame(frame); frame = 0; } }) : null; intersection?.observe(host);
  const visibility = () => { if (document.hidden) { lease.cancelFrame(frame); frame = 0; } else { previous = performance.now(); schedule(); } };
  // ── The body lane (world-body) ── reduced motion cuts the follow camera
  // rather than swinging it. The character still walks: that is the app.
  const onReduced = () => { court.setReduced(reduced.matches); follow?.setReduced(reduced.matches); schedule(); };
  const removeLost = lease.listenCanvas("webglcontextlost", (event: Event) => { event.preventDefault(); lease.cancelFrame(frame); frame = 0; callbacks.onFailure(); });
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
    const wanted = on && CLOSE_HOLDS[placeId] !== undefined;
    closedIn.set(placeId, wanted);
    const was = court.closed();
    court.close(wanted ? closePose(placeId, composition) : null);
    if (was !== wanted) callbacks.onClose?.(wanted);
    return wanted;
  }

  function aim(mode: CourtMode | "door", anchor?: string): void {
    court.setReduced(reduced.matches);
    if (placeId !== "court") {
      const key = mode === "court" ? placeId : mode === "object" && anchor ? `object:${anchor}` : mode;
      const pose = poseFor(handle.poses(), key, composition) ?? (mode === "door" ? poseFor(handle.poses(), "sky", composition) : undefined);
      if (pose) { court.goTo({ target: pose.target, r: pose.r, theta: pose.theta, phi: pose.phi }); return; }
    }
    if (mode === "door") { court.go("object", "queen"); return; }
    if (mode !== "object" || isCourtAnchor(anchor)) { court.go(mode, isCourtAnchor(anchor) ? anchor : undefined); return; }
    const found = handle.anchors().find(a => a.id === anchor);
    if (found) court.goTo({ target: [found.position[0], Math.max(0.6, found.position[1]), found.position[2]] });
    else court.go("object");
  }

  return {
    // ── The body lane (world-body) ── an explicit destination hands the view
    // back to the Look camera first, so the flight starts from the eye you can
    // actually see and every named pose behaves exactly as it always has.
    go(mode, anchor) { setFollowing(false); aim(mode, anchor); moved(); },
    setReading(next) { reading = next; for (const { handle: each } of live.values()) each.update(next); dirty = true; listsDirty = true; render(); schedule(); },
    look(next) { setFollowing(false); court.setReduced(reduced.matches); court.goTo(next); moved(); },
    gesture(input) {
      court.setReduced(reduced.matches);
      if (input.kind === "orbit") court.drag(input.dx, input.dy);
      else if (input.kind === "pan") court.pan(input.dx, input.dy);
      else court.zoom(input.delta);
      moved();
    },
    // ── The body lane (world-body) ── a tool in front of the place turns the
    // stage into a door strip: the follow camera gives the view back for it.
    setToolOpen(open) { toolOpen = open; if (open) setFollowing(false); schedule(); },
    setBreathing(on) { breathing = on; schedule(); },
    invalidate() { settling = true; dirty = true; previous = performance.now(); schedule(); },
    addAnimator(animate) { animators.add(animate); listsDirty = true; schedule(); return () => { animators.delete(animate); }; },
    restore(position) { setFollowing(false); court.restore(position); dirty = true; render(); schedule(); },
    camera: () => camera.position.toArray() as [number, number, number],
    pose: () => court.pose(),
    place: () => handle,
    placeId: () => placeId,
    traveling: () => journey !== null,
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
        following: () => following,
        follow(on) { setFollowing(on); if (!on) { aim("court"); } moved(); },
        input(next) { bodyInput = next; if (next.forward !== 0 || next.strafe !== 0) { setFollowing(true); } dirty = true; schedule(); },
        goTo(x, z) { one.goTo(x, z); setFollowing(true); dirty = true; schedule(); },
        place(x, z, yaw) { one.place(x, z, yaw); dirty = true; schedule(); },
        at() { const at = one.state(); return { x: at.x, y: at.y, z: at.z, yaw: at.yaw, speed: at.speed }; },
        walking: () => one.walking(),
      };
    },
    enter(next, options = {}) {
      const from = options.from ?? placeId;
      const cut = options.reduced ?? reduced.matches;
      const plan = travelPlan(from, next, cut);
      const place = PLACES[next];
      if (!place) return plan;
      // The place being entered is raised first, so both stand for the length of the journey.
      handle = raise(place);
      // ── The body lane (world-body) ── a room is six units across; the body
      // stands on the island. It is put away on the way out and raised again
      // on the way in, and the room's own camera is never disturbed.
      if (next !== "court") dropBody();
      placeId = next;
      if (next === "court") raiseBody();
      // The place you arrive in declares its own idle motion; until it does, nothing moves.
      breathing = false;
      // A cut lands at once, so the destination's hold applies at once. A full
      // journey flies through the open air between the rooms: the hold is
      // lifted for the flight and the destination's takes over when it lands
      // (the `frame.done` branch of the loop).
      court.setHold(plan.cut ? PLACE_HOLDS[next] ?? null : null);
      aim(plan.camera.mode, plan.camera.anchor ?? undefined);
      // The room you are walking into opens the way you left it: its close
      // hold, if it had one on, goes straight back on.
      applyClose(closedIn.get(next) ?? false);
      if (plan.cut) {
        settle(plan.roof[1], plan.lid[1]);
        if (from !== next) pull(from);
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
      disposed = true; abort.abort();
      if (stick) { stick = null; callbacks.onStick?.(null); }
      lease.cancelFrame(frame);
      host.removeEventListener("pointerdown", onPointerDown); host.removeEventListener("pointermove", onPointerMove); host.removeEventListener("pointerup", onPointerEnd); host.removeEventListener("pointercancel", onPointerEnd); host.removeEventListener("wheel", onWheel);
      observer?.disconnect(); intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility); reduced.removeEventListener("change", onReduced); removeLost();
      for (const id of [...live.keys()]) pull(id);
      // ── The body lane (world-body) ──
      dropBody();
      ground.dispose(); rig.dispose();
      lease.release();
      host.style.backgroundImage = "";
      delete host.dataset.renderer; delete host.dataset.houseCamera;
      delete host.dataset.bodyAt; delete host.dataset.bodyMs;
    },
  };
}
