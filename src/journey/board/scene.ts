/**
 * `createJourneyBoardScene(host, options)` (T3): the low-poly island (T2's `land.group`) with the board drawn on it,
 * on the SHARED renderer lease (`acquireWorldRenderer`, priority 1).
 *
 * - Hemisphere + one directional light; no shadows, fog or post. DPR = `effectiveDpr(tier)` (full ≤ 1.5, lite 1).
 * - Frames only when dirty: a camera move, an animation (≤ 600 ms; a milestone settle ≤ 800 ms), a resize, a data or
 *   theme change. Idle = zero frames. `sleep()` (and a hidden document) stops frames; `dispose()` releases the lease.
 * - The route, spaces, piece and signposts also draw in an occluded pass (GreaterDepth, 35 %) so land never hides them.
 * - Every rendered frame that moved something reports `MarkAnchor`s (screen px) for the UI's real DOM buttons: the
 *   piece, month spaces, day spaces, clusters, stops, crossroads (ids per `marks.ts`), plus `district:<id>` labels
 *   (drawn at Sky and Region) and `preview:<crossroadsId>` while a preview is shown.
 * - `setSafeArea({top,right,bottom,left})` (stage px under chrome): framing centres its target in the uncovered rect
 *   and Sky fits the island inside it (a projection offset — the canvas stays full-bleed). A pristine or Sky-fit view
 *   re-frames to a new safe area, an in-flight camera move is retargeted, any other view holds still on screen.
 * - Input: drag = pan, wheel / pinch = continuous zoom (60 … 2900, widened only to fit the island at Sky), click =
 *   `onPick(id | null)`. Below Stop nothing happens: zoom never enters the world (P2).
 * - The scene holds NO actions: its options carry no `JourneyBoardActions`, and nothing here opens, posts, completes,
 *   stores or fetches anything. Selecting, previewing, focusing and animating only change pixels.
 */
import { compressHeight } from "../contracts.ts";
import * as THREE from "three";
import type {
  CameraTier, ChapterId, CreateJourneyBoardScene, DateKey, JourneyBoard, JourneyBoardSceneHandle, JourneyBoardSceneOptions,
  MarkAnchor, RouteSpace, ThemeId,
} from "../contracts.ts";
import { acquireWorldRenderer, type WorldRendererOptions } from "../../house/world/rendererOwner.ts";
import { effectiveDpr } from "../../harbour/scene/quality.ts";
import { landDressing, setJourneyLandTier, setJourneyLandView } from "../land/index.ts";
import {
  applyView, CAMERA_MOVE_MS, clampSafeArea, clampView as clampViewIn, easeInOutCubic, easeOutBack, easeOutCubic, frameHeight, lerpView, NO_SAFE_AREA,
  radiusForTier as radiusForTierIn, rayGround, screenRay, skyFitRadius, tierOf, uncoveredRect, worldPerPixel, type CameraView, type SafeArea,
} from "./camera.ts";
import { boardDressing, type FullBoardDressing } from "./dressing.ts";
import { countBoardDraws, createMarkLayer, instancedGeometry, mergedGeometry, type MarkItem, type MarkLayer } from "./layers.ts";
import { boardMarks, POST_SCALE, type BoardMark } from "./marks.ts";
import { BOARD_LIGHT, setRibbonColors } from "./materials.ts";
import { pieceShape } from "./piece.ts";
import { dashedBranch, dashedRing, findAlternative, previewHomes, type PreviewSelection } from "./preview.ts";
import { createRibbon, ribbonWidth } from "./ribbon.ts";
import { daySpaceFor, stretchMidpoint } from "./route.ts";
import { ring, transform } from "./shapes.ts";
import { createSignposts } from "./signposts.ts";
import { createShadowLayer, type ShadowItem } from "./shadows.ts";
import { createSpaces, pileShape, stationPadMasks, type NearWindow } from "./spaces.ts";

/** Design unit clamps (eu per unit): marks keep their px size between these. */
export const UNIT_MIN = 0.2;
export const UNIT_MAX = 2.5;
/** Design units are authored as px seen straight on; the 58° view foreshortens them, so marks draw this much larger. */
export const MARK_SCALE = 1.45;
/** The piece stands taller than every post: it is the one thing you must find first. */
export const PIECE_SCALE = 1.6;
/**
 * Tier design scale (T7): at Sky the piece is prominent but not a tower and the posts stand a little smaller, so the
 * island's landmarks stay readable; from Region inward both are full size (the piece is the tallest thing on the board).
 */
export const TIER_SCALE = { piece: { sky: 0.72, region: 1, stop: 1 }, post: { sky: 0.8, region: 1, stop: 1 } } as const;
/** Boardwalk piles: one pair every this many eu of route over water. */
const PILE_EVERY_EU = 10;
/** Month pads never grow past this (two stations stand 73 eu apart). */
export const PAD_UNIT_MAX = 2.2;
export const SELECTION_LIFT_MS = 150;
export const PIECE_SETTLE_MS = 520;
export const MILESTONE_SETTLE_MS = 700;
const SELECTION_LIFT_UNITS = 5;
const CLICK_SLOP_PX = 6;
/** Near window (eu) for day spaces / posts at Region and Stop (grown 35 % when built, rebuilt when the view leaves it). */
const NEAR_RADIUS = 200;
const PICK_RADIUS_PX = 26;

export type JourneyBoardSceneExtras = {
  /** Test seam: passed to the renderer lease (`rendererFactory`), with `shared` to pick the lease mode. */
  rendererFactory?: WorldRendererOptions["rendererFactory"];
  shared?: boolean;
  /** Stage size before the host has layout (jsdom, first paint). */
  size?: { width: number; height: number };
  devicePixelRatio?: number;
  /** Where the camera opens (default: Region on the piece). */
  initialFocus?: { target: FocusTarget; tier: CameraTier };
};
export type BoardSceneOptions = JourneyBoardSceneOptions & JourneyBoardSceneExtras;
export type FocusTarget = Parameters<JourneyBoardSceneHandle["focus"]>[0];

/** The contract handle plus what the UI's toolbar needs (+ / − zoom, a pan for arrow keys, reading the view). */
export type BoardSceneHandle = JourneyBoardSceneHandle & {
  /** Stage px covered by chrome per side (see the header). Required here; optional on the frozen contract. */
  setSafeArea(inset: SafeArea): void;
  /** Continuous zoom by a factor on the radius (< 1 = closer). Clamped; never enters the world. */
  zoomBy(factor: number, animate?: boolean): void;
  /** Pan by screen pixels. */
  panBy(dxPx: number, dyPx: number): void;
  /** Screen → concept ground point, sea included (null only when the ray misses the island's range). */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } | null;
  view(): { x: number; y: number; radius: number; tier: CameraTier; worldPerPixel: number };
  /** The anchors of the last rendered frame. */
  anchors(): MarkAnchor[];
  /** Render a pending (or forced) frame now (captures, tests). */
  renderNow(): void;
};

type Anim = { start: number; duration: number; step(t: number): void; end(): void };

function prefersReducedMotion(explicit: boolean): boolean {
  if (explicit) return true;
  try {
    if (typeof document !== "undefined" && document.documentElement?.dataset.motion === "reduced") return true;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { /* fall through */ }
  return false;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);

export function createJourneyBoardScene(host: HTMLElement, options: BoardSceneOptions): BoardSceneHandle {
  const land = options.land;
  const extent = land.data.extent;
  let board: JourneyBoard = options.board;
  let route: RouteSpace = options.route;
  let theme: ThemeId = options.theme;
  let dressing: FullBoardDressing = boardDressing(theme);
  let width = Math.max(1, host.clientWidth || options.size?.width || 390);
  let height = Math.max(1, host.clientHeight || options.size?.height || 844);
  const dpr = effectiveDpr(options.tier, options.devicePixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1));

  // --- scene graph -------------------------------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.name = "journey-board-scene";
  const background = new THREE.Color(landDressing(theme).sky);
  scene.background = background;
  const hemi = new THREE.HemisphereLight(0xfff4e4, 0x8e8575, 2.1);
  const sun = new THREE.DirectionalLight(0xfff2de, 1.7);
  sun.position.set(...BOARD_LIGHT.sunDir).multiplyScalar(1000);
  scene.add(hemi, sun, land.group);
  const boardGroup = new THREE.Group();
  boardGroup.name = "journey-board";
  scene.add(boardGroup);

  // The route crosses water in places (September over Stillwater): those stretches are drawn as a boardwalk.
  const ribbon = createRibbon(route, (x, z) => !land.isLand(x, z));
  const spaces = createSpaces();
  const signposts = createSignposts();
  const pieceLayer = createMarkLayer("piece");
  const ringLayer = createMarkLayer("selection", { occluded: false });
  const previewLayer = createMarkLayer("preview", { occluded: false });
  const pileLayer = createMarkLayer("piles", { occluded: false });
  const shadows = createShadowLayer();
  boardGroup.add(ribbon.group, shadows.group, pileLayer.group, ...spaces.all.map((l) => l.group), signposts.layer.group, pieceLayer.group, ringLayer.group, previewLayer.group);
  const markLayers: MarkLayer[] = [...spaces.all, signposts.layer, pieceLayer, ringLayer, previewLayer, pileLayer];

  const camera = new THREE.PerspectiveCamera(20, width / height, 1, 20000);
  /** Chrome over the stage (px per side); every framing call below reads it. */
  let safe: SafeArea = NO_SAFE_AREA;
  const clampView = (v: CameraView, e: typeof extent, w: number, h: number) => clampViewIn(v, e, w, h, safe);
  const radiusForTier = (t: CameraTier, e: typeof extent, w: number, h: number) => radiusForTierIn(t, e, w, h, safe);
  /** The last explicit framing, while nothing (input, zoom, pan) has moved the camera since: a new safe area re-applies it. */
  let lastFocus: { target: FocusTarget; tier: CameraTier; animate: boolean } | null = null;
  /** A frame has shown `lastFocus` (false between a focus call and the next frame); the first safe area always re-frames. */
  let focusPresented = false, safeSeen = false;
  let view: CameraView = { x: extent.w / 2, y: extent.h / 2, radius: radiusForTier("region", extent, width, height) };
  let tier: CameraTier = tierOf(view.radius);
  let marks: BoardMark[] = [];
  let lastAnchors: MarkAnchor[] = [];
  let selection: string | null = null;
  let preview: PreviewSelection | null = null;
  let previewingHomes = false;
  let homesKey = JSON.stringify(board.homes);
  const anims = new Map<string, Anim>();
  let frameId = 0, sleeping = false, hidden = false, disposed = false, readySent = false;

  // --- renderer lease ------------------------------------------------------------------------------------------
  const configure = (renderer: THREE.WebGLRenderer) => {
    renderer.setPixelRatio?.(dpr);
    renderer.setSize?.(width, height, false);
    renderer.setClearColor?.(background, 1);
    if (renderer.shadowMap) renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const canvas = renderer.domElement;
    if (canvas) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      canvas.style.touchAction = "none";
      canvas.setAttribute("aria-hidden", "true");
    }
  };
  const lease = acquireWorldRenderer(host, {
    priority: 1,
    configure,
    parameters: { antialias: options.tier === "full", alpha: false, powerPreference: "low-power" },
    onResume: () => invalidate(),
    rendererFactory: options.rendererFactory,
    shared: options.shared,
  });

  // --- building ------------------------------------------------------------------------------------------------
  const unitNow = () => Math.min(Math.max(worldPerPixel(view.radius, height), UNIT_MIN), UNIT_MAX) * MARK_SCALE;
  const padUnitNow = () => Math.min(unitNow(), PAD_UNIT_MAX);
  /** The unit a mark of this kind is drawn at (month pads clamp; the piece and posts take the tier's design scale). */
  const unitFor = (kind: BoardMark["kind"]) => kind === "month" ? padUnitNow()
    : kind === "piece" ? unitNow() * TIER_SCALE.piece[tier]
      : kind === "stop" || kind === "cluster" || kind === "crossroads" ? unitNow() * TIER_SCALE.post[tier] : unitNow();

  let markMap = new Map<string, BoardMark>();
  const markById = () => markMap;

  function buildPiece() {
    const mark = marks.find((m) => m.kind === "piece");
    if (!mark) { pieceLayer.setGeometry(null); return; }
    const onStation = route.months.some((m) => m.at[0] === mark.base[0] && m.at[2] === mark.base[2]);
    pieceLayer.setGeometry(instancedGeometry(pieceShape(board.piece.lookId, dressing), [{ anchor: mark.base, color: dressing.piece[board.piece.lookId]?.body ?? "#666666", scale: PIECE_SCALE, lift: onStation ? 4.6 : 5.6 }]), new Map([["piece", 0]]));
  }

  function selectionLayerFor(id: string): { layer: MarkLayer; index: number } | null {
    for (const layer of [pieceLayer, signposts.layer, spaces.pads, spaces.padRings, spaces.days, spaces.flags, spaces.stakes]) {
      const index = layer.indexOf.get(id);
      if (index !== undefined) return { layer, index };
    }
    // Day N is the month pad.
    const month = route.months.find((m) => route.stretches.find((s) => s.chapterId === m.chapterId)?.days.at(-1)?.date === id);
    if (month) {
      const pad = spaces.pads.indexOf.get(month.chapterId) ?? spaces.padRings.indexOf.get(month.chapterId);
      if (pad !== undefined) return { layer: spaces.pads.indexOf.has(month.chapterId) ? spaces.pads : spaces.padRings, index: pad };
    }
    return null;
  }

  function buildSelectionRing() {
    const mark = selection ? markById().get(selection) : undefined;
    if (!mark) { ringLayer.setGeometry(null); return; }
    const scale = mark.kind === "piece" ? 1.42 : mark.kind === "month" ? 1.25 : mark.kind === "day" ? 0.75 : 0.95;
    const shape = transform(ring({ sides: 16, rIn: 12.5, rOut: 15.5, y: 1.3, y0: 0, top: { tint: 1 }, wall: { tint: 1, shade: 0.75 } }), { scale: [scale, 1, scale], at: [mark.offset[0], 0, mark.offset[1]] });
    const lift = mark.kind === "piece" || mark.date === board.today ? 3 : 0;
    ringLayer.setGeometry(mergedGeometry([{ shape, item: { anchor: mark.base, color: dressing.selectionRing, lift }, index: 0 }]));
  }

  function buildPreview() {
    const found = findAlternative(board, preview);
    const mark = found ? markById().get(found.crossroads.id) : undefined;
    if (!found || !mark) { previewLayer.setGeometry(null); return; }
    const day = daySpaceFor(route, found.crossroads.date);
    const tangent = day?.tangent ?? [1, 0];
    const side: [number, number] = [mark.offset[0] === 0 && mark.offset[1] === 0 ? 0 : mark.offset[0] / Math.hypot(mark.offset[0], mark.offset[1]), mark.offset[1] === 0 ? -1 : mark.offset[1] / Math.hypot(mark.offset[0], mark.offset[1])];
    const parts = [{ shape: dashedRing(22), item: { anchor: mark.base, color: dressing.provisional }, index: 0 }];
    if (!found.alternative.isCurrent && found.alternative.preview.kind !== "home") {
      parts.push({ shape: dashedBranch(tangent, side), item: { anchor: mark.base, color: dressing.provisional }, index: 1 });
    }
    previewLayer.setGeometry(mergedGeometry(parts));
  }

  function applyHomes() {
    const homes = previewHomes(board, preview);
    if (homes) { land.setHomes(homes); previewingHomes = true; return; }
    const key = JSON.stringify(board.homes);
    if (previewingHomes || key !== homesKey) land.setHomes(board.homes);
    previewingHomes = false;
    homesKey = key;
  }

  /** Piles under the boardwalk: every `PILE_EVERY_EU` of centreline that is over water. */
  function buildPiles() {
    const items: MarkItem[] = [];
    for (const s of route.stretches) {
      let arc = 0, last = -Infinity;
      for (let i = 0; i < s.points.length; i += 1) {
        const p = s.points[i]!, prev = s.points[Math.max(0, i - 1)]!, next = s.points[Math.min(s.points.length - 1, i + 1)]!;
        if (i > 0) arc += Math.hypot(p[0] - prev[0], p[2] - prev[2]);
        if (land.isLand(p[0], p[2]) || arc - last < PILE_EVERY_EU) continue;
        const tx = next[0] - prev[0], tz = next[2] - prev[2], tl = Math.hypot(tx, tz) || 1;
        items.push({ anchor: p, dir: [tx / tl, tz / tl], color: dressing.plank });
        last = arc;
      }
    }
    pileLayer.setGeometry(items.length ? instancedGeometry(pileShape(), items) : null);
  }

  /** Contact shadows under the piece, the standing posts and the month pads (at this tier's design scale). */
  function buildShadows() {
    const items: ShadowItem[] = [];
    const pf = TIER_SCALE.piece[tier], sf = TIER_SCALE.post[tier];
    const piece = marks.find((m) => m.kind === "piece");
    if (piece) items.push({ anchor: piece.base, offset: [0, 0], radius: 12.5 * PIECE_SCALE * pf, lift: 0.4 });
    for (const m of route.months) if (m.state !== "upcoming") items.push({ anchor: m.at, offset: [0, 0], radius: m.state === "open" ? 20.5 : 18.5, pad: true, lift: 0.3 });
    const seen = new Set<number>();
    const byId = new Map(board.stops.map((st) => [st.id, st] as const));
    for (const m of marks) {
      if (m.kind !== "stop" && m.kind !== "cluster" && m.kind !== "crossroads") continue;
      const index = signposts.layer.indexOf.get(m.id);
      if (index === undefined || seen.has(index)) continue;
      seen.add(index);
      const r = m.kind === "cluster" ? 10 : byId.get(m.id)?.kind === "milestone" ? 12.5 : 6.5;
      items.push({ anchor: m.base, offset: [m.offset[0] * sf, m.offset[1] * sf], radius: r * POST_SCALE * sf });
    }
    shadows.set(items, dressing.shadow);
  }

  function buildAll() {
    marks = boardMarks(board, route);
    markMap = new Map(marks.map((m) => [m.id, m] as const));
    ribbon.setRoute(route);
    setRibbonColors(ribbon.uniforms, { past: dressing.spacePast, open: dressing.spaceOpen, edge: dressing.ribbonEdge, plank: dressing.plank });
    near = grownNear();
    spaces.build(route, board, dressing, near);
    spaces.setTier(tier);
    signposts.build(route, board, dressing, tier, near);
    buildPiece();
    buildPiles();
    buildShadows();
    buildSelectionRing();
    buildPreview();
    applySelectionIndex(false);
  }

  // Region / Stop: build day spaces and posts near the camera only; rebuilt when the view drifts.
  let near: NearWindow | null = null;
  const wantedNear = (): NearWindow | null => {
    if (tier === "sky") return null;
    // Half the diagonal of the ground the view frames (depth foreshortened by the 58° pitch), plus a little.
    const fh = frameHeight(view.radius), half = 0.5 * Math.hypot(fh * (width / height), fh / Math.sin((58 * Math.PI) / 180));
    return { x: view.x, z: view.y, radius: Math.max(NEAR_RADIUS, half * 1.15) };
  };
  /** The window to build: the wanted one plus margin, so small pans and zooms reuse it. */
  const grownNear = (): NearWindow | null => { const w = wantedNear(); return w ? { ...w, radius: w.radius * 1.35 } : null; };
  function rebuildNear(force: boolean) {
    const want = wantedNear();
    if (!force) {
      if (want === null && near === null) return;
      // Still covered: the built window contains the wanted one and is not wastefully large.
      if (want && near && Math.hypot(want.x - near.x, want.z - near.z) + want.radius <= near.radius && want.radius >= near.radius * 0.45) return;
    }
    near = grownNear();
    spaces.build(route, board, dressing, near);
    spaces.setTier(tier);
    signposts.build(route, board, dressing, tier, near);
    buildShadows();
    applySelectionIndex(false);
  }

  let selectionTarget: { layer: MarkLayer; index: number } | null = null;
  function applySelectionIndex(animate: boolean) {
    for (const layer of markLayers) { layer.uniforms.uSel.value = -1; layer.uniforms.uSelLift.value = 0; }
    selectionTarget = selection ? selectionLayerFor(selection) : null;
    if (!selectionTarget) return;
    const { layer, index } = selectionTarget;
    layer.uniforms.uSel.value = index;
    if (!animate || prefersReducedMotion(options.reducedMotion)) { layer.uniforms.uSelLift.value = SELECTION_LIFT_UNITS; anims.delete("selection"); return; }
    startAnim("selection", SELECTION_LIFT_MS, (t) => { layer.uniforms.uSelLift.value = SELECTION_LIFT_UNITS * easeOutCubic(t); }, () => { layer.uniforms.uSelLift.value = SELECTION_LIFT_UNITS; });
  }

  // --- animation + frames --------------------------------------------------------------------------------------
  function startAnim(key: string, duration: number, step: (t: number) => void, end: () => void) {
    anims.get(key)?.end();
    anims.set(key, { start: now(), duration, step, end });
    step(0);
    invalidate();
  }
  function endAnim(key: string) {
    const a = anims.get(key);
    if (!a) return;
    anims.delete(key);
    a.end();
    invalidate();
  }

  function invalidate() {
    if (frameId || sleeping || hidden || disposed || !lease.active) return;
    frameId = lease.requestFrame(frame);
  }

  function setTier(next: CameraTier) {
    if (next === tier) return;
    tier = next;
    setJourneyLandTier(land, tier);
    // Piles are sub-pixel ticks at Sky: the planks alone say "boardwalk" there.
    pileLayer.setVisible(tier !== "sky");
    rebuildNear(true);
    options.onTier(tier);
  }

  function updateUniforms() {
    const wpp = worldPerPixel(view.radius, height);
    const unit = unitNow(), padUnit = padUnitNow();
    for (const layer of markLayers) layer.uniforms.uUnit.value = unit;
    spaces.pads.uniforms.uUnit.value = padUnit;
    spaces.padRings.uniforms.uUnit.value = padUnit;
    pieceLayer.uniforms.uUnit.value = unit * TIER_SCALE.piece[tier];
    signposts.layer.uniforms.uUnit.value = unit * TIER_SCALE.post[tier];
    shadows.uniforms.uUnit.value = unit;
    shadows.uniforms.uPadUnit.value = padUnit;
    const selectedKind = selection ? markById().get(selection)?.kind : undefined;
    if (selectedKind) ringLayer.uniforms.uUnit.value = unitFor(selectedKind);
    ribbon.uniforms.uWidth.value = ribbonWidth(wpp);
    ribbon.uniforms.uUnit.value = unit;
    setJourneyLandView(land, { worldPerPixel: wpp, stationPads: stationPadMasks(route.months, padUnit) });
  }

  const projected = new THREE.Vector3();
  function computeAnchors(): MarkAnchor[] {
    const out: MarkAnchor[] = [];
    const camPos = camera.position;
    const push = (id: string, x: number, y: number, z: number, drawn: boolean) => {
      projected.set(x, y, z).project(camera);
      const sx = (projected.x * 0.5 + 0.5) * width, sy = (-projected.y * 0.5 + 0.5) * height;
      const inFront = projected.z > -1 && projected.z < 1;
      const onStage = sx >= 0 && sx <= width && sy >= 0 && sy <= height;
      out.push({ id, x: round1(sx), y: round1(sy), depth: round1(camPos.distanceTo(new THREE.Vector3(x, y, z))), visible: drawn && inFront && onStage });
    };
    for (const m of marks) {
      const u = unitFor(m.kind);
      const lift = m.kind === "piece" ? 5.6 : m.date === board.today && m.kind === "day" ? 3 : 0;
      const head = m.kind === "piece" ? m.head * PIECE_SCALE : m.head;
      push(m.id, m.base[0] + m.offset[0] * u, m.base[1] + (head + lift) * u, m.base[2] + m.offset[1] * u, m.tiers.includes(tier));
    }
    for (const d of land.data.districts) {
      if (!d.heart) continue;
      // District names are read at Sky and Region (the UI labels them, lowest priority); at Stop they would crowd the days.
      push(`district:${d.id}`, d.heart[0], land.heightAt(d.heart[0], d.heart[1]), d.heart[1], tier !== "stop");
    }
    for(const b of land.data.bridges??[]){if(!b.landmark)continue;const {at}=b.landmark;
      push(`bridge:${b.id}`,at[0],compressHeight(at[1])+5,at[2],tier!=="sky");out[out.length-1]!.bridge=b.landmark;
    }
    const found = findAlternative(board, preview);
    const pm = found ? marks.find((m) => m.id === found.crossroads.id) : undefined;
    if (found && pm) push(`preview:${found.crossroads.id}`, pm.base[0], pm.base[1] + 44 * unitFor("crossroads"), pm.base[2], true);
    return out;
  }

  function frame() {
    frameId = 0;
    if (disposed || sleeping || hidden) return;
    const t = now();
    for (const [key, a] of [...anims]) {
      const k = a.duration > 0 ? Math.min(1, (t - a.start) / a.duration) : 1;
      a.step(k);
      if (k >= 1) { anims.delete(key); a.end(); }
    }
    draw();
    if (anims.size) invalidate();
  }

  function draw() {
    setTier(tierOf(view.radius));
    rebuildNear(false);
    applyView(camera, view, land.heightAt(view.x, view.y), width, height, safe);
    updateUniforms();
    lease.renderer.render(scene, camera);
    focusPresented = true;
    lastAnchors = computeAnchors();
    options.onAnchors(lastAnchors);
    if (!readySent && lease.active) { readySent = true; options.onReady(); }
  }

  // --- camera --------------------------------------------------------------------------------------------------
  function focusPoint(target: FocusTarget, forTier: CameraTier): { x: number; y: number } {
    if (forTier === "sky") return { x: extent.w / 2, y: extent.h / 2 };
    if (target === "piece") {
      const m = marks.find((mk) => mk.kind === "piece");
      return m ? { x: m.base[0], y: m.base[2] } : { x: view.x, y: view.y };
    }
    if ("chapterId" in target) {
      const mid = forTier === "stop" ? route.months.find((m) => m.chapterId === target.chapterId)?.at ?? null : stretchMidpoint(route, target.chapterId as ChapterId);
      return mid ? { x: mid[0], y: mid[2] } : { x: view.x, y: view.y };
    }
    if ("date" in target) {
      const d = daySpaceFor(route, target.date as DateKey);
      return d ? { x: d.at[0], y: d.at[2] } : { x: view.x, y: view.y };
    }
    return { x: target.x, y: target.y };
  }

  function moveTo(next: CameraView, animate: boolean) {
    const to = clampView(next, extent, width, height);
    anims.delete("camera");
    if (!animate || prefersReducedMotion(options.reducedMotion)) { view = to; invalidate(); return; }
    const from = { ...view };
    startAnim("camera", CAMERA_MOVE_MS, (t) => { view = lerpView(from, to, easeInOutCubic(t)); }, () => { view = to; });
  }

  function settlePiece() {
    if (prefersReducedMotion(options.reducedMotion)) return;
    const u = pieceLayer.uniforms;
    startAnim("piece", PIECE_SETTLE_MS, (t) => {
      u.uAnimIndex.value = 0;
      u.uAnimLift.value = 16 * (1 - easeOutCubic(t));
      u.uAnimScale.value = 0.85 + 0.15 * easeOutBack(t);
    }, () => { u.uAnimIndex.value = -1; u.uAnimLift.value = 0; u.uAnimScale.value = 1; });
  }

  function settleMilestone(stopId: string) {
    const index = signposts.layer.indexOf.get(stopId);
    if (index === undefined || prefersReducedMotion(options.reducedMotion)) return;
    const u = signposts.layer.uniforms;
    startAnim("milestone", MILESTONE_SETTLE_MS, (t) => {
      u.uAnimIndex.value = index;
      u.uAnimLift.value = 22 * (1 - easeOutCubic(t));
      u.uAnimScale.value = 0.5 + 0.5 * easeOutCubic(t);
    }, () => { u.uAnimIndex.value = -1; u.uAnimLift.value = 0; u.uAnimScale.value = 1; });
  }

  // --- input ---------------------------------------------------------------------------------------------------
  const pointers = new Map<number, { x: number; y: number }>();
  let press: { id: number; x: number; y: number; moved: boolean } | null = null;
  let pinch: { dist: number; mx: number; my: number } | null = null;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = host.getBoundingClientRect?.();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const anyInput = () => { if (anims.has("milestone")) endAnim("milestone"); };
  /** The person moved the camera: the view is theirs now, a later safe-area change holds it still. */
  const cameraTaken = () => { lastFocus = null; };
  const groundPerPx = () => ({ x: worldPerPixel(view.radius, height), y: worldPerPixel(view.radius, height) / Math.sin((58 * Math.PI) / 180) });

  function panPixels(dx: number, dy: number) {
    cameraTaken();
    const g = groundPerPx();
    view = clampView({ x: view.x - dx * g.x, y: view.y - dy * g.y, radius: view.radius }, extent, width, height);
    invalidate();
  }
  function zoomAt(factor: number, sx: number, sy: number) {
    cameraTaken();
    const before = screenToWorld(sx, sy);
    const radius = clampView({ ...view, radius: view.radius * factor }, extent, width, height).radius;
    const k = 1 - radius / view.radius;
    view = clampView({ x: before ? view.x + (before.x - view.x) * k : view.x, y: before ? view.y + (before.y - view.y) * k : view.y, radius }, extent, width, height);
    invalidate();
  }

  const unlisten: (() => void)[] = [];
  unlisten.push(lease.listenCanvas<PointerEvent>("pointerdown", (e) => {
    anyInput();
    anims.delete("camera");
    const p = local(e);
    pointers.set(e.pointerId, p);
    try { (e.target as Element | null)?.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
    if (pointers.size === 1) press = { id: e.pointerId, x: p.x, y: p.y, moved: false };
    else { press = null; const [a, b] = [...pointers.values()]; pinch = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2 }; }
  }));
  unlisten.push(lease.listenCanvas<PointerEvent>("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y), mx = (a!.x + b!.x) / 2, my = (a!.y + b!.y) / 2;
      if (dist > 0 && pinch.dist > 0) zoomAt(pinch.dist / dist, mx, my);
      panPixels(mx - pinch.mx, my - pinch.my);
      pinch = { dist, mx, my };
      return;
    }
    if (press && press.id === e.pointerId) {
      if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) < CLICK_SLOP_PX) return;
      press.moved = true;
      panPixels(p.x - prev.x, p.y - prev.y);
    }
  }));
  const release = (e: PointerEvent, cancelled: boolean) => {
    const p = local(e);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!cancelled && press && press.id === e.pointerId && !press.moved) options.onPick(pickAt(p.x, p.y));
    if (press?.id === e.pointerId) press = null;
  };
  unlisten.push(lease.listenCanvas<PointerEvent>("pointerup", (e) => release(e, false)));
  unlisten.push(lease.listenCanvas<PointerEvent>("pointercancel", (e) => release(e, true)));
  unlisten.push(lease.listenCanvas<WheelEvent>("wheel", (e) => {
    e.preventDefault?.();
    anyInput();
    anims.delete("camera");
    const p = local(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(Math.max(-60, Math.min(60, delta)) * 0.0022), p.x, p.y);
  }, { passive: false }));
  unlisten.push(lease.listenCanvas<Event>("webglcontextlost", (e) => { e.preventDefault?.(); options.onLost(); }));
  const onWindowInput = () => anyInput();
  const onVisibility = () => {
    hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden) { if (frameId) { lease.cancelFrame(frameId); frameId = 0; } } else invalidate();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onWindowInput, true);
    window.addEventListener("pointerdown", onWindowInput, true);
  }
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

  const PICK_PENALTY: Record<string, number> = { piece: 0, crossroads: 1, cluster: 1, stop: 3, month: 4, day: 6 };
  function pickAt(x: number, y: number): string | null {
    const kindOf = new Map(marks.map((m) => [m.id, m.kind] as const));
    let best: { id: string; score: number } | null = null;
    for (const a of lastAnchors) {
      const kind = kindOf.get(a.id);
      if (!kind || !a.visible) continue;
      // Posts pick on their body too (the anchor is at the head): test against a short vertical span.
      const unit = unitNow();
      const span = kind === "stop" || kind === "cluster" || kind === "crossroads" || kind === "piece" ? 26 * (unit / Math.max(worldPerPixel(view.radius, height), 1e-6)) : 0;
      const dy = y < a.y ? a.y - y : y > a.y + span ? y - (a.y + span) : 0;
      const d = Math.hypot(a.x - x, dy);
      if (d > PICK_RADIUS_PX) continue;
      const score = d + (PICK_PENALTY[kind] ?? 5);
      if (!best || score < best.score) best = { id: a.id, score };
    }
    return best?.id ?? null;
  }

  function screenToWorld(sx: number, sy: number): { x: number; y: number } | null {
    applyView(camera, view, land.heightAt(view.x, view.y), width, height, safe);
    const hit = rayGround(screenRay(camera, sx, sy, width, height), (x, z) => Math.max(land.heightAt(x, z), 0));
    return hit ? { x: hit.x, y: hit.z } : null;
  }

  /** The view frames the whole island (Sky at its fit): a resize or a new safe area re-fits it. */
  const isSkyFit = () => tier === "sky" && view.radius >= skyFitRadius(extent, width, height, safe) * 0.98;

  // --- start ---------------------------------------------------------------------------------------------------
  buildAll();
  setJourneyLandTier(land, tier);
  {
    const initial = options.initialFocus ?? { target: "piece" as const, tier: "region" as const };
    lastFocus = { target: initial.target, tier: initial.tier, animate: false };
    focusPresented = false;
    view = clampView({ ...focusPoint(initial.target, initial.tier), radius: radiusForTier(initial.tier, extent, width, height) }, extent, width, height);
    tier = tierOf(view.radius);
    setJourneyLandTier(land, tier);
    pileLayer.setVisible(tier !== "sky");
    rebuildNear(true);
  }
  invalidate();

  const handle: BoardSceneHandle = {
    setBoard(nextBoard, nextRoute) {
      if (disposed) return;
      const prev = board;
      board = nextBoard;
      route = nextRoute;
      if (preview && !findAlternative(board, preview)) preview = null;
      buildAll();
      applyHomes();
      if (prev.piece.anchorChapterId !== board.piece.anchorChapterId) settlePiece();
      const wasGranted = new Set(prev.stops.filter((s) => s.kind === "milestone" && s.status === "granted").map((s) => s.id));
      const fresh = board.stops.find((s) => s.kind === "milestone" && s.status === "granted" && !wasGranted.has(s.id));
      if (fresh) settleMilestone(fresh.id);
      invalidate();
    },
    setSelection(id) {
      if (disposed || id === selection) return;
      selection = id;
      buildSelectionRing();
      applySelectionIndex(true);
      invalidate();
    },
    setPreview(next) {
      if (disposed) return;
      const same = (next === null && preview === null) || (next && preview && next.crossroadsId === preview.crossroadsId && next.alternativeId === preview.alternativeId);
      if (same) return;
      preview = next && findAlternative(board, next) ? { ...next } : null;
      buildPreview();
      applyHomes();
      invalidate();
    },
    focus(target, forTier, animate) {
      if (disposed) return;
      lastFocus = { target, tier: forTier, animate };
      focusPresented = false;
      const point = focusPoint(target, forTier);
      moveTo({ ...point, radius: radiusForTier(forTier, extent, width, height) }, animate);
      if (target === "piece" && animate) settlePiece();
    },
    groundAt(sx, sy) {
      const p = screenToWorld(sx, sy);
      return p && land.isLand(p.x, p.y) ? p : null;
    },
    setTheme(next) {
      if (disposed || next === theme) return;
      theme = next;
      dressing = boardDressing(theme);
      land.setTheme(theme);
      background.set(landDressing(theme).sky);
      lease.renderer.setClearColor?.(background, 1);
      buildAll();
      invalidate();
    },
    resize(w, h) {
      if (disposed) return;
      const nw = Math.max(1, Math.round(w)), nh = Math.max(1, Math.round(h));
      if (nw === width && nh === height) return;
      const wasSkyFit = isSkyFit();
      width = nw; height = nh;
      lease.renderer.setSize?.(width, height, false);
      if (wasSkyFit) view = { ...view, radius: radiusForTier("sky", extent, width, height) };
      view = clampView(view, extent, width, height);
      invalidate();
    },
    setSafeArea(inset) {
      if (disposed) return;
      const next = clampSafeArea(inset, width, height);
      const first = !safeSeen;
      safeSeen = true;
      if ((["top", "right", "bottom", "left"] as const).every((k) => Math.abs(next[k] - safe[k]) < 0.5)) return;
      const wasSkyFit = isSkyFit();
      const flying = anims.has("camera");
      // Where the new uncovered centre looks now (old projection): keeping it there holds the picture still.
      const open = uncoveredRect(width, height, next);
      const held = screenToWorld(open.cx, open.cy);
      safe = next;
      if (lastFocus && (first || flying || !focusPresented)) {
        // The mount's framing (before the chrome was measured), a focus not yet drawn (the panel that opened with it),
        // or one still flying: frame that focus again, clear of the chrome. A cut unless a move was already under way.
        const f = lastFocus;
        moveTo({ ...focusPoint(f.target, f.tier), radius: radiusForTier(f.tier, extent, width, height) }, flying && f.animate);
      } else if (wasSkyFit) {
        moveTo({ ...focusPoint("piece", "sky"), radius: radiusForTier("sky", extent, width, height) }, !prefersReducedMotion(options.reducedMotion));
      } else {
        // A zoom still animating finishes on its own; a resting view holds still on screen.
        if (held && !flying) view = clampView({ ...view, x: held.x, y: held.y }, extent, width, height);
        invalidate();
      }
    },
    sleep() {
      sleeping = true;
      if (frameId) { lease.cancelFrame(frameId); frameId = 0; }
    },
    wake() {
      if (disposed) return;
      sleeping = false;
      invalidate();
    },
    stats: () => countBoardDraws(scene),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frameId) lease.cancelFrame(frameId);
      frameId = 0;
      for (const a of anims.values()) a.end();
      anims.clear();
      for (const off of unlisten) off();
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", onWindowInput, true);
        window.removeEventListener("pointerdown", onWindowInput, true);
      }
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (previewingHomes) land.setHomes(board.homes);
      ribbon.dispose();
      spaces.dispose();
      signposts.dispose();
      shadows.dispose();
      pieceLayer.dispose(); ringLayer.dispose(); previewLayer.dispose(); pileLayer.dispose();
      scene.remove(land.group);
      scene.clear();
      lease.release();
    },
    zoomBy(factor, animate = false) {
      if (disposed || !(factor > 0)) return;
      cameraTaken();
      moveTo({ ...view, radius: view.radius * factor }, animate);
    },
    panBy(dx, dy) { if (!disposed) panPixels(dx, dy); },
    screenToWorld,
    view: () => ({ x: view.x, y: view.y, radius: view.radius, tier, worldPerPixel: worldPerPixel(view.radius, height) }),
    anchors: () => lastAnchors,
    renderNow() {
      if (disposed) return;
      if (frameId) { lease.cancelFrame(frameId); frameId = 0; }
      frame();
    },
  };
  return handle;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Type-level check: the extended factory is a valid `CreateJourneyBoardScene`. */
export const createJourneyBoardSceneContract: CreateJourneyBoardScene = createJourneyBoardScene;
