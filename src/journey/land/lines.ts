/**
 * Lines (T2; legibility pass T7): roads, skate lines, cableways, the ore railway, the ferry and the rowing runs as flat
 * ribbons in TWO merged meshes:
 *
 * - `journey-land:lines:major` — roads, skate lines, walks and the railway;
 * - `journey-land:lines:minor` — spurs and plot service roads, the cableways, the ferry and the rowing runs. The board
 *   hides it at Sky (`setJourneyLandTier`): at the island's scale those lines are scratches, and the ferry drew a big
 *   polygon round the whole island.
 *
 * Widths are presentation, not the road bed: each kind has a SCREEN width (px) that the view sets through one shared
 * uniform (`setJourneyLandView`), clamped in world units — so a road is always clearly narrower (and duller) than the
 * board's route, the one strong line on the map, at every tier. Water routes and cableways are dashed along their
 * length. Ribbons are draped on the drawn surface (compressed ground, or the water on top of it); the width offset is
 * planar. Douglas–Peucker: the data carries 4 eu (full); lite re-simplifies at 8 eu.
 *
 * Road pass (ROAD.md §7): the runs come from `planRoad` (`road.ts`). Ground runs are draped exactly as before. Runs on a
 * bridge deck go in a THIRD mesh, `journey-land:lines:deck`, drawn with the bridges (after them, before the board, no
 * depth write) so the road reads as crossing on its bridge and never hides a board mark. A covered stretch (tunnel,
 * the Prow gallery) is dimmed and dashed with a darker, wider notch at each portal; a boulevard reach is a little wider
 * with a thin planted band (a green inset at the centre for a median, at the edges for planted verges). Nothing else of
 * the road's dressing (lamps, kerbs, rails, single plants) is drawn at map scale.
 */
import * as THREE from "three";
import type { JourneyLandDressing, LandLineKind } from "../contracts.ts";
import { hexRgb, landExtras, LINE_DRESSING_KEY } from "./dressing.ts";
import type { RoadPlan, RoadRun } from "./road.ts";

export { DRAPE_STEP, LINE_LIFT } from "./road.ts";

/** Screen width (px) per kind, and the world clamp (eu) it is held inside. The board route is 14 px. */
export const LINE_PX: Readonly<Record<LandLineKind, number>> = { road: 3.4, skate: 2.8, walk: 2, cable: 1.4, rail: 2.2, ferry: 2, row: 1.6 };
export const LINE_WIDTH_EU: Readonly<Record<LandLineKind, { min: number; max: number }>> = {
  road: { min: 1.6, max: 9 }, skate: { min: 1.3, max: 7 }, walk: { min: 1, max: 5 }, cable: { min: 0.7, max: 4 },
  rail: { min: 1.1, max: 6 }, ferry: { min: 0.9, max: 6 }, row: { min: 0.8, max: 5 },
};
const MINOR_PX = 2.2, MINOR_EU = { min: 1.1, max: 6 };
/** Dash period (eu along the line) for the dashed kinds; 0 = solid. */
const DASH_EU: Readonly<Record<LandLineKind, number>> = { road: 0, skate: 0, walk: 0, cable: 9, rail: 0, ferry: 14, row: 10 };
/** A boulevard reach is this much wider than the road (px and clamps). */
export const BOULEVARD_SCALE = 1.6;
/** A covered stretch: dash period (eu) and how far its colour falls toward the portal colour. */
export const COVER_DASH_EU = 7;
const COVER_DIM = 0.45;
/** A portal notch is this much wider than the road. */
export const NOTCH_SCALE = 1.9;
export const MINOR_LINES_NAME = "journey-land:lines:minor";
export const MAJOR_LINES_NAME = "journey-land:lines:major";
export const DECK_LINES_NAME = "journey-land:lines:deck";
/** Kinds drawn in the minor mesh (plus minor roads). */
const MINOR_KINDS = new Set<LandLineKind>(["cable", "ferry", "row"]);
/**
 * Draw order (opaque list). The board draws its ghost pass at 1 (against the land's depth only) and its marks at 2, so
 * every land line is drawn between them: ground lines at 1.3, then the bridges (1.5), then the lines on the decks
 * (1.6). A land line is therefore always drawn before — never over — a board mark.
 */
export const GROUND_LINES_ORDER = 1.3;
export const DECK_LINES_ORDER = 1.6;

/** The land's view uniforms, shared by every land shader (set once per frame by the board scene). */
/** View-only reservation for a drawn month symbol; never part of extracted road geometry. */
export type StationPadMask = { x: number; z: number; radius: number };
export const STATION_PAD_MASK_CAPACITY = 12;
export type LandViewUniforms = {
  uWpp: { value: number }; uHostPx: { value: number };
  uStationPadCount: { value: number }; uStationPads: { value: THREE.Vector3[] };
};
/** CPU counterpart of the covered-fragment discard, also used by geometric acceptance tests. */
export function coveredFragmentMasked(x: number, z: number, covered: number, pads: readonly StationPadMask[]): boolean {
  return covered > 0.5 && pads.some(p => (x - p.x) ** 2 + (z - p.z) ** 2 <= p.radius ** 2);
}
export function setStationPadMasks(view: LandViewUniforms, pads: readonly StationPadMask[]): void {
  if (pads.length > STATION_PAD_MASK_CAPACITY) throw new Error('Too many Journey station pad masks');
  for (const pad of pads) if (![pad.x, pad.z, pad.radius].every(Number.isFinite) || pad.radius < 0) throw new Error('Invalid Journey station pad mask');
  view.uStationPadCount.value = pads.length;
  pads.forEach((p, i) => view.uStationPads.value[i]!.set(p.x, p.z, p.radius));
}
export function landViewUniforms(): LandViewUniforms {
  // A Region-like default so a land built without a scene still draws sensibly.
  return { uWpp: { value: 0.3 }, uHostPx: { value: 0 }, uStationPadCount: { value: 0 }, uStationPads: { value: Array.from({ length: STATION_PAD_MASK_CAPACITY }, () => new THREE.Vector3()) } };
}

const VERTEX = /* glsl */ `
attribute float aCovered; attribute vec2 aSide; attribute vec3 aWidth; attribute vec3 aColor; attribute vec2 aDash; attribute vec2 aBand;
uniform float uWpp;
varying vec3 vColor; varying vec2 vDash; varying vec2 vBand; varying vec2 vPlan; varying float vCovered;
void main() {
  float w = clamp(aWidth.x * uWpp, aWidth.y, aWidth.z);
  vec3 p = position + vec3(aSide.x, 0.0, aSide.y) * (0.5 * w);
  vColor = aColor; vDash = aDash; vBand = aBand; vPlan = p.xz; vCovered = aCovered;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}`;
const FRAGMENT = /* glsl */ `
uniform vec3 uPlanted;
uniform int uStationPadCount;
uniform vec3 uStationPads[${STATION_PAD_MASK_CAPACITY}];
varying vec3 vColor; varying vec2 vDash; varying vec2 vBand; varying vec2 vPlan; varying float vCovered;
void main() {
  // Underground cover ink yields to the actual zoom/state-scaled month symbol.
  // Test the width-expanded fragment, not only its centreline. Nothing is moved,
  // and uncovered roads/bridges keep their existing drawing and clearance checks.
  if (vCovered > 0.5) for (int i = 0; i < ${STATION_PAD_MASK_CAPACITY}; i++) {
    if (i < uStationPadCount) {
      vec2 delta = vPlan - uStationPads[i].xy;
      if (dot(delta, delta) <= uStationPads[i].z * uStationPads[i].z) discard;
    }
  }
  if (vDash.y > 0.0 && fract(vDash.x / vDash.y) > 0.56) discard;
  float a = abs(vBand.x);
  // vBand.y: 1 = planted median (a green band at the centre), 2 = planted verges (green inset at both edges).
  bool planted = (vBand.y > 0.5 && vBand.y < 1.5 && a < 0.26) || (vBand.y > 1.5 && a > 0.52 && a < 0.8);
  gl_FragColor = vec4(planted ? uPlanted : vColor, 1.0);
}`;

/** Per-vertex paint: the line kind, and whether it is covered (dimmed) or a portal notch. */
type Paint = { kind: LandLineKind; style: 0 | 1 | 2 };
type Bucket = { positions: number[]; side: number[]; width: number[]; paints: Paint[]; dash: number[]; band: number[]; covered: number[]; index: number[] };
const bucket = (): Bucket => ({ positions: [], side: [], width: [], paints: [], dash: [], band: [], covered: [], index: [] });

function ribbon(run: RoadRun, b: Bucket): void {
  const path = run.verts;
  if (path.length < 2) return;
  const base = b.positions.length / 3, kind = run.kind;
  const px = run.minor && kind === "road" ? MINOR_PX : LINE_PX[kind], eu = run.minor && kind === "road" ? MINOR_EU : LINE_WIDTH_EU[kind];
  for (let i = 0; i < path.length; i++) {
    // Duplicated cut points (a cover / boulevard boundary) share a position: take the tangent past the duplicate.
    let pi = i - 1, ni = i + 1;
    while (pi > 0 && samePlace(path[pi]!, path[i]!)) pi--;
    while (ni < path.length - 1 && samePlace(path[ni]!, path[i]!)) ni++;
    const prev = path[Math.max(0, pi)]!, next = path[Math.min(path.length - 1, ni)]!;
    let tx = next.x - prev.x, ty = next.z - prev.z;
    const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    // Normal in plan; miter length capped so sharp corners do not spike.
    let nx = -ty, ny = tx, scale = 1;
    if (pi >= 0 && ni <= path.length - 1 && i > 0 && i < path.length - 1) {
      const a = prev, p = path[i]!, c = next;
      const l1 = Math.hypot(p.x - a.x, p.z - a.z), l2 = Math.hypot(c.x - p.x, c.z - p.z);
      if (l1 > 1e-6 && l2 > 1e-6) {
        const n1x = -(p.z - a.z) / l1, n1y = (p.x - a.x) / l1, n2x = -(c.z - p.z) / l2, n2y = (c.x - p.x) / l2;
        nx = n1x + n2x; ny = n1y + n2y; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        scale = Math.min(2, 1 / Math.max(0.2, nx * n1x + ny * n1y));
      }
    }
    const v = path[i]!;
    const grow = v.notch ? NOTCH_SCALE : v.plant ? BOULEVARD_SCALE : 1;
    const dash = v.covered && !v.notch ? COVER_DASH_EU : DASH_EU[kind];
    for (const s of [1, -1]) {
      b.positions.push(v.x, v.y, v.z);
      b.side.push(s * nx * scale, s * ny * scale);
      b.width.push(px * grow, eu.min * grow, eu.max * grow);
      b.paints.push({ kind, style: v.notch ? 2 : v.covered ? 1 : 0 });
      b.dash.push(v.arc, dash);
      b.band.push(s, v.notch || v.covered ? 0 : v.plant);
      b.covered.push(v.covered ? 1 : 0);
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const l0 = base + i * 2, r0 = l0 + 1, l1 = l0 + 2, r1 = l0 + 3;
    b.index.push(l0, r0, l1, r0, r1, l1);
  }
}
const samePlace = (a: { x: number; z: number }, c: { x: number; z: number }) => a.x === c.x && a.z === c.z;

export type LineMeshes = { meshes: THREE.Mesh[]; minor: THREE.Mesh | null; deck: THREE.Mesh | null; recolour(d: JourneyLandDressing): void; dispose(): void };

export function buildLines(plan: RoadPlan, dressing: JourneyLandDressing, view: LandViewUniforms = landViewUniforms()): LineMeshes {
  const major = bucket(), minorBucket = bucket(), deckBucket = bucket();
  for (const run of plan.ground) ribbon(run, run.minor || MINOR_KINDS.has(run.kind) ? minorBucket : major);
  // A minor line on a deck stays in the minor mesh (hidden at Sky); none of the baked spans carries one today.
  for (const run of plan.deck) ribbon(run, run.minor || MINOR_KINDS.has(run.kind) ? minorBucket : deckBucket);
  const meshes: THREE.Mesh[] = [], owned: { dispose(): void }[] = [], painted: { b: Bucket; geometry: THREE.BufferGeometry }[] = [];
  let minor: THREE.Mesh | null = null, deck: THREE.Mesh | null = null;
  const uniforms = { uWpp: view.uWpp, uStationPadCount: view.uStationPadCount, uStationPads: view.uStationPads, uPlanted: { value: new THREE.Color() } };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    // Ribbons are flat; draw both faces so winding never hides one.
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  material.name = "journey-land-line";
  // On a deck: drawn over the bridge in order, writing no depth, so the board (drawn later) is never hidden by a
  // raised road (the board's own depth test sees the land only there).
  const deckMaterial = material.clone();
  deckMaterial.uniforms = uniforms;
  deckMaterial.depthWrite = false;
  deckMaterial.name = "journey-land-line-deck";
  owned.push(material, deckMaterial);
  for (const [name, b] of [[MAJOR_LINES_NAME, major], [MINOR_LINES_NAME, minorBucket], [DECK_LINES_NAME, deckBucket]] as const) {
    if (!b.index.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
    geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(b.side, 2));
    geometry.setAttribute("aWidth", new THREE.Float32BufferAttribute(b.width, 3));
    geometry.setAttribute("aDash", new THREE.Float32BufferAttribute(b.dash, 2));
    geometry.setAttribute("aCovered", new THREE.Float32BufferAttribute(b.covered, 1));
    geometry.setAttribute("aBand", new THREE.Float32BufferAttribute(b.band, 2));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(new Float32Array(b.paints.length * 3), 3));
    geometry.setIndex(b.index);
    const onDeck = name === DECK_LINES_NAME;
    const mesh = new THREE.Mesh(geometry, onDeck ? deckMaterial : material);
    mesh.name = name;
    mesh.renderOrder = onDeck ? DECK_LINES_ORDER : GROUND_LINES_ORDER;
    // Widths grow in the vertex shader: never cull a ribbon by its centreline box.
    mesh.frustumCulled = false;
    meshes.push(mesh); owned.push(geometry); painted.push({ b, geometry });
    if (name === MINOR_LINES_NAME) minor = mesh;
    if (onDeck) deck = mesh;
  }
  const recolour = (d: JourneyLandDressing) => {
    const x = landExtras(d), portal = hexRgb(x.deckRail);
    uniforms.uPlanted.value.setRGB(...hexRgb(x.planted));
    for (const { b, geometry } of painted) {
      const attr = geometry.getAttribute("aColor") as THREE.BufferAttribute, arr = attr.array as Float32Array;
      b.paints.forEach((paint, n) => {
        const c = hexRgb(d[LINE_DRESSING_KEY[paint.kind]]);
        const k = paint.style === 2 ? 1 : paint.style === 1 ? COVER_DIM : 0;
        arr.set([c[0] + (portal[0] - c[0]) * k, c[1] + (portal[1] - c[1]) * k, c[2] + (portal[2] - c[2]) * k], n * 3);
      });
      attr.needsUpdate = true;
    }
  };
  recolour(dressing);
  return { meshes, minor, deck, recolour, dispose() { for (const o of owned) o.dispose(); } };
}
