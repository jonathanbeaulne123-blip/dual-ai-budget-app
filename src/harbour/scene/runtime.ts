import * as THREE from "three";
import { acquireWorldRenderer } from "../../house/world/rendererOwner.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import { createCourtCamera, type CourtCamera, type CourtLook } from "../camera/courtCamera.ts";
import { COURT_ANCHOR_IDS, COURT_FOV, type CourtAnchor, type CourtMode, type CourtPose } from "../camera/poses.ts";
import { harbourFramePolicy, CAMERA_INTERVAL_MS } from "./framePolicy.ts";
import { createGround } from "./ground.ts";
import { configureHarbourRenderer, createLightRig } from "./lightRig.ts";
import { EMPTY_PLACE, PLACES, PLACE_HOLDS, SCENE_DRESSING, poseFor, type Anchor, type Composition, type Place, type PlaceDressing, type PlaceHandle, type PlaceReading, type Vec3 } from "./place.ts";
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

export type HarbourRuntime = {
  /** Fly to a mode; `anchor` is one of `poses.ts`'s named anchors or any anchor the place exposes. */
  go: (mode: CourtMode, anchor?: string) => void;
  setReading: (reading: PlaceReading | null) => void;
  /** A close look at any point (the Queen's roots, the slip). */
  look: (look: CourtLook) => void;
  /** Keyboard: arrows orbit, +/− zoom. */
  gesture: (input: { kind: "orbit"; dx: number; dy: number } | { kind: "zoom"; delta: number }) => void;
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
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dressing = callbacks.dressing ?? SCENE_DRESSING[theme];
  const abort = new AbortController();
  let composition: Composition = callbacks.composition ?? (host.getBoundingClientRect().width < 720 ? "phone" : "desktop");

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
  const invalidate = () => { if (!disposed) { dirty = true; schedule(); } };
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
    return built;
  }
  function pull(id: HarbourPlaceId): void {
    const standing = live.get(id);
    if (!standing) return;
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

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(), projected = new THREE.Vector3(), box = new THREE.Box3();
  const pointers = new Map<number, Pointer>();
  let projectionSignature = "", pinchDistance = 0, paintSamples: number[] = [], dirty = true;
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
      const point = hit.point.toArray() as [number, number, number];
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const region = node.userData.region;
        if (typeof region === "string") return { kind: "queen", region, object: hit.object, point };
        const anchorId = node.userData.anchor;
        if (typeof anchorId === "string") {
          const anchor = handle.anchors().find(a => a.id === anchorId);
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

  function rectOf(corners: THREE.Vector3[], bounds: DOMRect): { x: number; y: number; w: number; h: number; visible: boolean } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, behind = 0;
    for (const corner of corners) {
      projected.copy(corner).project(camera);
      if (projected.z >= 1) behind += 1;
      const sx = (projected.x * 0.5 + 0.5) * bounds.width, sy = (-projected.y * 0.5 + 0.5) * bounds.height;
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    }
    if (behind === corners.length || !Number.isFinite(minX)) return null;
    let w = Math.max(MIN_TWIN, maxX - minX), h = Math.max(MIN_TWIN, maxY - minY);
    w = Math.min(w, bounds.width); h = Math.min(h, bounds.height);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const x = Math.max(0, Math.min(bounds.width - w, cx - w / 2)), y = Math.max(0, Math.min(bounds.height - h, cy - h / 2));
    const visible = maxX > 0 && minX < bounds.width && maxY > 0 && minY < bounds.height;
    return { x, y, w, h, visible };
  }

  function project(): void {
    if (!callbacks.onProject) return;
    const bounds = host.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    camera.updateMatrixWorld(); scene.updateMatrixWorld();
    const rects: ProjectedRect[] = [];
    const anchors = handle.anchors();
    for (const region of handle.regions()) {
      if (region.box) box.copy(region.box);
      else { box.makeEmpty(); for (const object of region.objects ?? []) box.expandByObject(object); }
      if (box.isEmpty()) continue;
      const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
      const rect = rectOf(corners, bounds);
      if (!rect) continue;
      // An anchor with the same id lends the region its door and its words: one twin per thing.
      const anchor = anchors.find(a => a.id === region.id);
      rects.push({ id: region.id, kind: "region", group: region.group, label: anchor?.label ?? region.label, door: anchor?.door, ...rect });
    }
    for (const anchor of anchors) {
      if (rects.some(r => r.id === anchor.id)) continue;
      const [x, y, z] = anchor.position;
      const rect = rectOf([new THREE.Vector3(x, y + 0.6, z)], bounds);
      if (rect) rects.push({ id: anchor.id, kind: "anchor", group: anchor.zone, label: anchor.label, door: anchor.door, ...rect });
    }
    const signature = rects.map(r => `${r.id}:${r.x | 0}:${r.y | 0}:${r.w | 0}:${r.h | 0}:${r.visible ? 1 : 0}:${r.label}`).join("|");
    if (signature === projectionSignature) return;
    projectionSignature = signature;
    callbacks.onProject(rects);
  }

  function render(): void {
    if (!lease.active || disposed) return;
    const began = performance.now();
    renderer.render(scene, camera);
    project();
    paintSamples.push(performance.now() - began); if (paintSamples.length > 60) paintSamples.shift();
    host.dataset.renderMs = (paintSamples.reduce((a, b) => a + b, 0) / paintSamples.length).toFixed(2);
    host.dataset.houseCamera = JSON.stringify(camera.position.toArray().map(n => Number(n.toFixed(4))));
    host.dataset.drawCalls = String(renderer.info.render.calls); host.dataset.geometries = String(renderer.info.memory.geometries); host.dataset.textures = String(renderer.info.memory.textures);
  }

  function schedule(): void { if (!disposed && !frame && visible && !document.hidden && lease.active) frame = lease.requestFrame(loop); }

  function loop(now: number): void {
    frame = 0;
    if (disposed || !visible || document.hidden || !lease.active) return;
    if (intervalMs > 0 && now - lastPaint < intervalMs) { schedule(); return; }
    const dt = Math.min((now - previous) / 1000, 0.08); previous = now;
    court.setReduced(reduced.matches);
    const easing = court.tick(dt);
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
    const policy = harbourFramePolicy({ reduced: reduced.matches, moving, breathing: breathing || settling, touched: pointers.size > 0, projectionChanged: dirty, hidden: document.hidden || !visible, toolOpen });
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
    const next: Composition = width < 720 ? "phone" : "desktop";
    if (next !== composition) { composition = next; camera.fov = fovFor(next); court.setFov(camera.fov); court.setComposition(next); }
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
      if (pinchDistance > 0 && distance > 0) { court.zoom(Math.log(pinchDistance / distance)); dirty = true; }
      pinchDistance = distance;
    } else if (pointer.hit.kind === "queen") pointer.samples.push({ x, y, t: performance.now() - pointer.startedAt });
    else if (isRail(pointer.hit) && callbacks.onRailDrag) { callbacks.onRailDrag(x, host.getBoundingClientRect().width); dirty = true; }
    else { court.drag(dx, dy); dirty = true; }
    schedule();
  }
  function onPointerEnd(event: PointerEvent): void {
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    pointers.delete(event.pointerId); pinchDistance = 0;
    try { host.releasePointerCapture(event.pointerId); } catch { /* jsdom */ }
    if (event.type === "pointercancel") return;
    const travelled = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY), lasted = performance.now() - pointer.startedAt;
    if (travelled < TAP_PIXELS && lasted < TAP_MS) callbacks.onTap?.(pointer.hit, { x: pointer.startX, y: pointer.startY });
    else if (pointer.hit.kind === "queen") callbacks.onGesture?.({ region: pointer.hit.region, samples: pointer.samples });
    schedule();
  }
  function onWheel(event: WheelEvent): void {
    if (disposed) return;
    event.preventDefault();
    court.zoom(Math.max(-0.5, Math.min(0.5, event.deltaY * 0.0015)));
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
  const onReduced = () => { court.setReduced(reduced.matches); schedule(); };
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
  function aim(mode: CourtMode, anchor?: string): void {
    court.setReduced(reduced.matches);
    if (placeId !== "court") {
      const key = mode === "court" ? placeId : mode === "object" && anchor ? `object:${anchor}` : mode;
      const pose = poseFor(handle.poses(), key, composition);
      if (pose) { court.goTo({ target: pose.target, r: pose.r, theta: pose.theta, phi: pose.phi }); return; }
    }
    if (mode !== "object" || isCourtAnchor(anchor)) { court.go(mode, isCourtAnchor(anchor) ? anchor : undefined); return; }
    const found = handle.anchors().find(a => a.id === anchor);
    if (found) court.goTo({ target: [found.position[0], Math.max(0.6, found.position[1]), found.position[2]] });
    else court.go("object");
  }

  return {
    go(mode, anchor) { aim(mode, anchor); moved(); },
    setReading(next) { reading = next; for (const { handle: each } of live.values()) each.update(next); dirty = true; render(); schedule(); },
    look(next) { court.setReduced(reduced.matches); court.goTo(next); moved(); },
    gesture(input) { court.setReduced(reduced.matches); if (input.kind === "orbit") court.drag(input.dx, input.dy); else court.zoom(input.delta); moved(); },
    setToolOpen(open) { toolOpen = open; schedule(); },
    setBreathing(on) { breathing = on; schedule(); },
    invalidate() { settling = true; dirty = true; previous = performance.now(); schedule(); },
    addAnimator(animate) { animators.add(animate); schedule(); return () => { animators.delete(animate); }; },
    restore(position) { court.restore(position); dirty = true; render(); schedule(); },
    camera: () => camera.position.toArray() as [number, number, number],
    pose: () => court.pose(),
    place: () => handle,
    placeId: () => placeId,
    traveling: () => journey !== null,
    enter(next, options = {}) {
      const from = options.from ?? placeId;
      const cut = options.reduced ?? reduced.matches;
      const plan = travelPlan(from, next, cut);
      const place = PLACES[next];
      if (!place) return plan;
      // The place being entered is raised first, so both stand for the length of the journey.
      handle = raise(place);
      placeId = next;
      // The place you arrive in declares its own idle motion; until it does, nothing moves.
      breathing = false;
      // A cut lands at once, so the destination's hold applies at once. A full
      // journey flies through the open air between the rooms: the hold is
      // lifted for the flight and the destination's takes over when it lands
      // (the `frame.done` branch of the loop).
      court.setHold(plan.cut ? PLACE_HOLDS[next] ?? null : null);
      aim(plan.camera.mode, plan.camera.anchor ?? undefined);
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
      lease.cancelFrame(frame);
      host.removeEventListener("pointerdown", onPointerDown); host.removeEventListener("pointermove", onPointerMove); host.removeEventListener("pointerup", onPointerEnd); host.removeEventListener("pointercancel", onPointerEnd); host.removeEventListener("wheel", onWheel);
      observer?.disconnect(); intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility); reduced.removeEventListener("change", onReduced); removeLost();
      for (const id of [...live.keys()]) pull(id);
      ground.dispose(); rig.dispose();
      lease.release();
      host.style.backgroundImage = "";
      delete host.dataset.renderer; delete host.dataset.houseCamera;
    },
  };
}
