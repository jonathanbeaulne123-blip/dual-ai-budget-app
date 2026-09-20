import * as THREE from "three";
import { acquireWorldRenderer } from "../../house/world/rendererOwner.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import { createCourtCamera, type CourtCamera } from "../camera/courtCamera.ts";
import { COURT_ANCHOR_IDS, COURT_FOV, type CourtAnchor, type CourtMode, type CourtPose } from "../camera/poses.ts";
import { harbourFramePolicy, CAMERA_INTERVAL_MS } from "./framePolicy.ts";
import { createGround } from "./ground.ts";
import { configureHarbourRenderer, createLightRig } from "./lightRig.ts";
import { EMPTY_PLACE, PLACES, SCENE_DRESSING, type Anchor, type Composition, type Place, type PlaceDressing, type PlaceHandle, type PlaceReading, type Vec3 } from "./place.ts";
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
  onTap?: (hit: HarbourHit) => void;
  onGesture?: (gesture: HarbourGesture) => void;
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
  /** Keyboard: arrows orbit, +/− zoom. */
  gesture: (input: { kind: "orbit"; dx: number; dy: number } | { kind: "zoom"; delta: number }) => void;
  /** A tool is open in front of the court: no breathing, the strip only redraws on demand. */
  setToolOpen: (open: boolean) => void;
  /** The place's idle animation (the Queen's breath). Off by default for an empty island. */
  setBreathing: (on: boolean) => void;
  /** Something else that moves each animated frame (the Queen's breath); returns the way to stop it. */
  addAnimator: (animate: (t: number, dt: number) => void) => () => void;
  /** A return record's camera. */
  restore: (position: Vec3) => void;
  camera: () => Vec3;
  pose: () => CourtPose;
  place: () => PlaceHandle;
  dispose: () => void;
};

const TAP_PIXELS = 8, TAP_MS = 350, MIN_TWIN = 44;
type Pointer = { id: number; x: number; y: number; startX: number; startY: number; startedAt: number; hit: HarbourHit; samples: GestureSample[] };

/**
 * Mounts the harbour scene into `host` (BUILD_PLAN §2 #5): one renderer lease
 * at priority 0, the light rig, the island ground and the active place; drives
 * the court camera; routes pointers to the Queen, an anchor or the ground;
 * projects DOM twins; snapshots on suspend; disposes everything.
 */
export function mountHarbourWorld(host: HTMLElement, theme: ThemeId, tier: RenderTier, callbacks: HarbourCallbacks): HarbourRuntime {
  let disposed = false, frame = 0, previous = 0, lastPaint = 0, lastAnimated = 0, visible = true, toolOpen = false, breathing = false, intervalMs = CAMERA_INTERVAL_MS;
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
  const activePlace = callbacks.place ?? PLACES.court ?? EMPTY_PLACE;
  breathing = activePlace !== EMPTY_PLACE;
  let handle: PlaceHandle;
  try { handle = activePlace.build(scene, dressing, callbacks.reading ?? null, tier, { composition, signal: abort.signal, invalidate }); }
  catch { handle = EMPTY_PLACE.build(scene, dressing, null, tier, { composition, signal: abort.signal, invalidate }); }
  const court: CourtCamera = createCourtCamera({ camera, composition, reduced: reduced.matches, fov: fovFor(composition) });
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
    const moving = court.tick(dt);
    const policy = harbourFramePolicy({ reduced: reduced.matches, moving, breathing, touched: pointers.size > 0, projectionChanged: dirty, hidden: document.hidden || !visible, toolOpen });
    intervalMs = policy.intervalMs;
    let animated = false;
    if (policy.animate && pointers.size === 0) {
      const t = (now - mountedAt) / 1000, adt = lastAnimated ? Math.min((now - lastAnimated) / 1000, 0.1) : 0;
      animated = handle.animate(t, adt) === true || animators.size > 0;
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
    else { court.drag(dx, dy); dirty = true; }
    schedule();
  }
  function onPointerEnd(event: PointerEvent): void {
    const pointer = pointers.get(event.pointerId); if (!pointer) return;
    pointers.delete(event.pointerId); pinchDistance = 0;
    try { host.releasePointerCapture(event.pointerId); } catch { /* jsdom */ }
    if (event.type === "pointercancel") return;
    const travelled = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY), lasted = performance.now() - pointer.startedAt;
    if (travelled < TAP_PIXELS && lasted < TAP_MS) callbacks.onTap?.(pointer.hit);
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

  return {
    go(mode, anchor) {
      court.setReduced(reduced.matches);
      if (mode !== "object" || isCourtAnchor(anchor)) court.go(mode, isCourtAnchor(anchor) ? anchor : undefined);
      else {
        const found = handle.anchors().find(a => a.id === anchor);
        if (found) court.goTo({ target: [found.position[0], Math.max(0.6, found.position[1]), found.position[2]] });
        else court.go("object");
      }
      moved();
    },
    setReading(reading) { handle.update(reading); dirty = true; render(); schedule(); },
    gesture(input) { court.setReduced(reduced.matches); if (input.kind === "orbit") court.drag(input.dx, input.dy); else court.zoom(input.delta); moved(); },
    setToolOpen(open) { toolOpen = open; schedule(); },
    setBreathing(on) { breathing = on; schedule(); },
    addAnimator(animate) { animators.add(animate); schedule(); return () => { animators.delete(animate); }; },
    restore(position) { court.restore(position); dirty = true; render(); schedule(); },
    camera: () => camera.position.toArray() as [number, number, number],
    pose: () => court.pose(),
    place: () => handle,
    dispose() {
      disposed = true; abort.abort();
      lease.cancelFrame(frame);
      host.removeEventListener("pointerdown", onPointerDown); host.removeEventListener("pointermove", onPointerMove); host.removeEventListener("pointerup", onPointerEnd); host.removeEventListener("pointercancel", onPointerEnd); host.removeEventListener("wheel", onWheel);
      observer?.disconnect(); intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility); reduced.removeEventListener("change", onReduced); removeLost();
      handle.dispose(); ground.dispose(); rig.dispose();
      lease.release();
      host.style.backgroundImage = "";
      delete host.dataset.renderer; delete host.dataset.houseCamera;
    },
  };
}
