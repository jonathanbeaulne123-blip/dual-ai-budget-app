/**
 * `buildJourneyLand()` — the clay island (Horizon Clock, L2), ported from the approved prototype (`horizon-clock.html`)
 * onto the real bake. Everything drawn comes from `JourneyLandData` (coastline, `journey` terrain lattice and paint,
 * water, roads, bridges, hosts, reserves, districts); toy proportions are diorama units, never island coordinates.
 *
 * The group is in DIORAMA UNITS (du) about `dioramaFrame(land)`'s centre (the board adds it inside its clock):
 * - `journey-land:shallows` — the sea shoulder: a ring from the smoothed coast out 30 m, sloping down to the sea;
 * - `journey-land:slab` — the smoothed coast extruded with a rounded (bevelled) clay edge, sand;
 * - `journey-land:terrain` — the 20 m lattice, softened and lifted (`createClaySurface`), vertex-painted by height,
 *   woodland and settled paint, sand near the coast;
 * - `journey-land:lakes` (flat at their shore's clay height) and `journey-land:rivers` (draped), inside the coast only;
 * - `journey-land:roads` (main roads) and `journey-land:roads:minor` (spurs, plot service roads) as soft grey ribbons,
 *   with `journey-land:bridges` clay planks under the spans that carry them;
 * - `journey-land:houses` — a clay house at every host (Our home under the home roof, the bank as the porcelain
 *   Mandevilla Queen) and village houses on the bake's settled paint; `journey-land:trees` on woodland paint and a
 *   sprinkle on low meadow; the member homes (D53) re-materialled as clay at their plots (`journey-land:homes`);
 * - `journey-land:blobs` — contact shadows, shown on the lite tier only. On full the meshes cast and receive a real
 *   shadow map (`createClayLights` configures the sun the board scene adds).
 *
 * The handle keeps the contract's concept-metre queries (`worldToBoard`, `heightAt`, `isLand`, …) and adds the
 * Horizon Clock fields: `frame`, `dioramaGroundAt`, `miniGeometry` (the Year ring's shared stride-2 island), plus
 * `setCalm` for the Week (`setJourneyLandCalm`). Budget: inside `JOURNEY_LAND_BUDGET` on both tiers (tests).
 */
import * as THREE from "three";
import type {
  BuildJourneyLand, DioramaFrame, JourneyClayPalette, JourneyHome, JourneyLandCalm, JourneyLandData, JourneyLandHandle, JourneyPropPalette, Point2, Point3,
  StationId, ThemeId,
} from "../contracts.ts";
import { compressHeight, HEIGHT_COMPRESSION, JOURNEY_DIORAMA } from "../contracts.ts";
import { blobDisc, buildScatter, countDraws, mergeParts, roundedBox, type ClayPaint, type ScatterMesh, type ToyItem, type ToyPart } from "./clayKit.ts";
import { clayDerived, clayPalette, JOURNEY_PROP_PALETTE } from "./clayPalette.ts";
import { createClaySurface, dioramaFrame, distanceToLine, offsetRing, resampleLine, smooth, type ClaySurface } from "./diorama.ts";
import { isMinorLine } from "./extract.ts";
import { buildHomes, reservesForHomes, type HomeMeshes, type Season } from "./homes.ts";
import { deckBlend, locateOnBridge, planBridges, type BridgePlan } from "./road.ts";
import { closedRing, pointInPolygon } from "./simplify.ts";
import { createLandSurface, LEVEL_WATER_KINDS, type LandSurface } from "./surface.ts";
import { homeSite } from "../../home/site.ts";

export const CLAY_LAND_NAME = "journey-land";
export const CLAY_NAMES = {
  shallows: "journey-land:shallows", slab: "journey-land:slab", terrain: "journey-land:terrain", lakes: "journey-land:lakes",
  rivers: "journey-land:rivers", roads: "journey-land:roads", minorRoads: "journey-land:roads:minor", bridges: "journey-land:bridges",
  houses: "journey-land:houses", trees: "journey-land:trees", blobs: "journey-land:blobs", homes: "journey-land:homes",
} as const;

/** The clay land's own budget (triangles / draw calls), inside the board's `JOURNEY_LOD` allowance on both tiers. */
export const JOURNEY_LAND_BUDGET = { full: { triangles: 25_000, drawCalls: 20 }, lite: { triangles: 15_000, drawCalls: 20 } } as const;

/** Per-tier detail (counts and segments only; no coordinates). */

export const CLAY_LAND_LOD = {
  full: { coast: 240, bevel: 3, roadStep: 9, minorStep: 12, treeDetail: 1, trunkSides: 5, houseSegments: 2, trees: 64, villageHouses: 22, miniStride: 2, miniCoast: 96 },
  lite: { coast: 160, bevel: 2, roadStep: 14, minorStep: 18, treeDetail: 0, trunkSides: 4, houseSegments: 1, trees: 44, villageHouses: 14, miniStride: 3, miniCoast: 72 },
} as const;

/** Toy proportions (du unless named in metres), from the prototype. */
const TOY = {
  shallowsM: 30, shallowsInner: 0.012, shallowsOuter: 0.004,
  slabBevel: 0.03, slabBevelSize: 0.04,
  roadWidth: 0.034, minorWidth: 0.02, roadLift: 0.012, riverLift: 0.014, lakeLift: 0.012,
  deckWidth: 0.05, deckThickness: 0.018, deckLift: 0.008,
  sink: 0.02, houseScale: 0.58, homeScale: 0.78, villageScale: 0.55, queenScale: 0.85, treeScale: 0.5, treeScaleJitter: 0.25,
  /** A member home (D53) at map detail is drawn this many times its true size (houses are toys). */
  homeToy: 2.6,
  blobLift: 0.012,
} as const;

/** Placement rules in metres (the prototype's), applied to the bake. */
const PLACE = {
  treeCoastM: 36, treeMaxHeightM: 96, treeWaterPadM: 16, treeJitterM: 14, woodSpacingM: 34, meadowSpacingM: 60, meadowChance: 0.035, meadowMaxM: 60,
  houseCoastM: 24, houseWaterPadM: 18, houseHostClearM: 40, houseSpacingM: 46,
} as const;
/** The bake's ground paint (bits 0–4): woodland floor, and the settled grounds (paved … plaza). */
const PAINT_WOOD = 2, PAINT_SETTLED: readonly [number, number] = [12, 18];

/** Week calm (prototype `calmPrep`/`applyCalm`), metres. */
export const CALM = {
  fadeFromM: 90, fadeToM: 300, highFromM: 68, highToM: 120, highNearFromM: 45, highNearToM: 95,
  squash: 0.85, colourShare: 0.75, coastFromM: 18, coastToM: 60, keepNearM: 45, keepFarM: 150, keepClearM: 40, keepEvery: 3,
  mainRoadFade: 0.65,
} as const;

export type { JourneyLandCalm };

/** The clay land: the contract handle with every Horizon Clock field present, plus Week calm. */
export type ClayLandHandle = JourneyLandHandle & {
  frame: DioramaFrame;
  dioramaGroundAt(x: number, y: number): number;
  miniGeometry(): THREE.BufferGeometry;
  /** Calm the land away from the Week trail (`amount` 0 … 1; null = none). Presentation only. */
  setCalm(calm: JourneyLandCalm | null, amount?: number): void;
};

/** Calm a built land from the board (works on any handle; a land without calm ignores it). */
export function setJourneyLandCalm(land: Pick<JourneyLandHandle, "group">, calm: JourneyLandCalm | null, amount = 1): void {
  const apply = land.group.userData.setCalm as ClayLandHandle["setCalm"] | undefined;
  apply?.(calm, amount);
}

/**
 * The prototype's lights for the clay (hemisphere + ambient + a sun that casts the real shadow map on the full tier).
 * Intensities are the prototype's × π (three r155+ dropped the legacy light scale). The board scene adds `group`.
 */
export function createClayLights(theme: ThemeId, tier: "full" | "lite") {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.62 * Math.PI);
  const ambient = new THREE.AmbientLight(0xffffff, 0.12 * Math.PI);
  const sun = new THREE.DirectionalLight(0xffffff, 1.05 * Math.PI);
  sun.position.set(-7, 11, 5);
  sun.castShadow = tier === "full";
  if (tier === "full") {
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 40 });
    sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
  }
  const group = new THREE.Group();
  group.name = "journey-land:lights";
  group.add(hemi, ambient, sun, sun.target);
  const setTheme = (next: ThemeId) => { const p = clayPalette(next); hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); sun.color.set(p.light); };
  setTheme(theme);
  return { group, sun, hemi, ambient, setTheme, dispose() { sun.dispose(); hemi.dispose(); ambient.dispose(); group.removeFromParent(); } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry builders (diorama units)

const colour = (hex: string) => new THREE.Color(hex);
type Owned = { dispose(): void };

/** The terrain lattice as an indexed mesh at `stride`; `src` maps each vertex to its lattice node. */
function terrainGeometry(clay: ClaySurface, stride: number, compact = false): { geometry: THREE.BufferGeometry; src: Uint32Array } {
  const { columns: C, rows: R } = clay;
  const cs = Math.floor((C - 1) / stride) + 1, rs = Math.floor((R - 1) / stride) + 1;
  const positions = new Float32Array(cs * rs * 3), src = new Uint32Array(cs * rs), index: number[] = [];
  for (let r = 0; r < rs; r++) for (let c = 0; c < cs; c++) {
    const v = r * cs + c, i = r * stride * C + c * stride;
    positions.set([clay.toX(clay.planX[i]!), clay.y[i]!, clay.toZ(clay.planZ[i]!)], v * 3);
    src[v] = i;
  }
  for (let r = 0; r < rs - 1; r++) for (let c = 0; c < cs - 1; c++) {
    const a = r * cs + c, b = a + 1, d = a + cs, e = d + 1;
    if (clay.inside[src[a]!] || clay.inside[src[b]!] || clay.inside[src[d]!] || clay.inside[src[e]!]) index.push(a, d, b, b, d, e);
  }
  const geometry = new THREE.BufferGeometry();
  if (compact) {
    // Keep only the vertices a face uses (the Year mini: twelve instances, culled by a true bounding sphere).
    const remap = new Int32Array(cs * rs).fill(-1), keptPos: number[] = [], keptSrc: number[] = [];
    for (let k = 0; k < index.length; k++) {
      const v = index[k]!;
      if (remap[v]! < 0) { remap[v] = keptSrc.length; keptSrc.push(src[v]!); keptPos.push(positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!); }
      index[k] = remap[v]!;
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(keptPos, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(keptSrc.length * 3), 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return { geometry, src: Uint32Array.from(keptSrc) };
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cs * rs * 3), 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return { geometry, src };
}

/** The prototype's terrain paint: grass → grass2 → hill → rock → snow by softened height; woodland, settled, coast sand. */
function paintTerrain(geometry: THREE.BufferGeometry, src: Uint32Array, clay: ClaySurface, paints: Uint8Array, p: JourneyClayPalette): Float32Array {
  const col = geometry.getAttribute("color") as THREE.BufferAttribute, out = col.array as Float32Array;
  const c = { grass: colour(p.grass), grass2: colour(p.grass2), hill: colour(p.hill), rock: colour(p.rock), snow: colour(p.snow), leaf2: colour(p.leaf2), wall: colour(p.wall), sand: colour(p.sand) };
  const o = new THREE.Color();
  for (let v = 0; v < src.length; v++) {
    const i = src[v]!, h = clay.heights[i]!, d = clay.coastDistance[i]!, k = paints[i]! & 31;
    o.copy(c.grass).lerp(c.grass2, smooth(8, 30, h)).lerp(c.hill, smooth(30, 60, h) * 0.6).lerp(c.rock, smooth(70, 112, h) * 0.85).lerp(c.snow, smooth(140, 152, h));
    if (k === PAINT_WOOD) o.lerp(c.leaf2, 0.3);
    else if (k >= PAINT_SETTLED[0] && k <= PAINT_SETTLED[1]) o.lerp(c.wall, 0.25);
    o.lerp(c.sand, 1 - smooth(16, 44, d));
    out[v * 3] = o.r; out[v * 3 + 1] = o.g; out[v * 3 + 2] = o.b;
  }
  col.needsUpdate = true;
  return Float32Array.from(out);
}

/** A plan ring (concept metres) as a THREE.Shape in the XY plane that `rotateX(-π/2)` lays on the ground. */
function planShape(clay: ClaySurface, ring: readonly Point2[]): THREE.Shape {
  return new THREE.Shape(ring.map((p) => new THREE.Vector2(clay.toX(p[0]), -clay.toZ(p[1]))));
}

/**
 * The clay slab: the smoothed coast's top cap at the slab top, and a rounded clay edge swept round the coast — a
 * quarter-round of `segments` steps out to the bevel, then straight down to just under the sea. (No bottom cap: it is
 * never seen.) Offsets are along the ring's own normals (`offsetRing`), so the edge follows every bay.
 */
function slabGeometry(clay: ClaySurface, ring: readonly Point2[], segments: number): THREE.BufferGeometry {
  const { top, sea } = JOURNEY_DIORAMA.slab, base = sea - 0.03, bt = TOY.slabBevel, bm = TOY.slabBevelSize / clay.frame.scale;
  const profile: { off: number; y: number }[] = [];
  const steps = Math.max(1, segments);
  for (let k = 0; k <= steps; k++) { const a = (k / steps) * (Math.PI / 2); profile.push({ off: Math.sin(a) * bm, y: top - (1 - Math.cos(a)) * bt }); }
  profile.push({ off: bm, y: base });
  const rings = profile.map((q) => (q.off > 0 ? offsetRing(ring, q.off) : ring.slice()));
  const n = ring.length, pos: number[] = [], idx: number[] = [];
  rings.forEach((r, k) => { for (const p of r) pos.push(clay.toX(p[0]), profile[k]!.y, clay.toZ(p[1])); });
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = k * n + i, b = k * n + ((i + 1) % n), c = a + n, d = b + n;
    idx.push(a, c, b, b, c, d);
  }
  const capStart = pos.length / 3;
  const cap = THREE.ShapeUtils.triangulateShape(ring.map((p) => new THREE.Vector2(p[0], p[1])), []);
  for (const p of ring) pos.push(clay.toX(p[0]), top, clay.toZ(p[1]));
  for (const t of cap) idx.push(capStart + t[0]!, capStart + t[1]!, capStart + t[2]!);
  // Wind every face to face outward / up: test one edge face against the outward offset, and one cap triangle.
  const face = (i0: number, i1: number, i2: number) => {
    const a = new THREE.Vector3().fromArray(pos, i0 * 3), b = new THREE.Vector3().fromArray(pos, i1 * 3), c = new THREE.Vector3().fromArray(pos, i2 * 3);
    return b.sub(a).cross(c.sub(a));
  };
  const flip = (from: number, to: number) => { for (let t = from; t < to; t += 3) { const x = idx[t + 1]!; idx[t + 1] = idx[t + 2]!; idx[t + 2] = x; } };
  const edgeFaces = (rings.length - 1) * n * 6, last = rings.length - 2;
  // Outward at vertex 0 = from the coast ring to the fully offset ring (plan); the last band runs straight down there.
  const outward = new THREE.Vector3(pos[last * n * 3]! - pos[0]!, 0, pos[last * n * 3 + 2]! - pos[2]!);
  const first = last * n * 6;
  if (outward.lengthSq() > 0 && face(idx[first]!, idx[first + 1]!, idx[first + 2]!).dot(outward) < 0) flip(0, edgeFaces);
  if (cap.length && face(idx[edgeFaces]!, idx[edgeFaces + 1]!, idx[edgeFaces + 2]!).y < 0) flip(edgeFaces, idx.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The sea shoulder: a strip from the coast (just above the sea) out to the offset ring (at the sea). */
function shoulderGeometry(clay: ClaySurface, coast: readonly Point2[]): THREE.BufferGeometry {
  const outer = offsetRing(coast, TOY.shallowsM), n = coast.length, sea = JOURNEY_DIORAMA.slab.sea;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) {
    pos.push(clay.toX(coast[i]![0]), sea + TOY.shallowsInner, clay.toZ(coast[i]![1]));
    pos.push(clay.toX(outer[i]![0]), sea + TOY.shallowsOuter, clay.toZ(outer[i]![1]));
  }
  for (let i = 0; i < n; i++) { const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  flipUp(g);
  return g;
}

/** Make every normal face up (flat ground pieces, drawn double-sided where it matters). */
function flipUp(g: THREE.BufferGeometry) {
  const n = g.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
}

/** Flat ground polygons (lakes) or draped ones (rivers) from water outlines. */
function waterGeometry(clay: ClaySurface, bodies: JourneyLandData["water"], draped: boolean): { geometry: THREE.BufferGeometry | null; owner: Uint16Array; centres: Point2[]; baseY: number[] } {
  const parts: THREE.BufferGeometry[] = [], owners: number[] = [], centres: Point2[] = [], baseY: number[] = [];
  bodies.forEach((w) => {
    const ring = closedRing(w.outline);
    const g = new THREE.ShapeGeometry(planShape(clay, ring));
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute("uv");
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length, cy = ring.reduce((s, q) => s + q[1], 0) / ring.length;
    const level = ring.reduce((s, q) => s + clay.groundAt(q[0], q[1]), 0) / ring.length + TOY.lakeLift;
    for (let i = 0; i < p.count; i++) {
      if (draped) { const x = p.getX(i) / clay.frame.scale + clay.frame.centre[0], y = p.getZ(i) / clay.frame.scale + clay.frame.centre[1]; p.setY(i, clay.groundAt(x, y) + TOY.riverLift); }
      else p.setY(i, level);
    }
    g.computeVertexNormals(); flipUp(g);
    parts.push(g); for (let i = 0; i < p.count; i++) owners.push(centres.length);
    centres.push([cx, cy]); baseY.push(level);
  });
  if (!parts.length) return { geometry: null, owner: new Uint16Array(0), centres, baseY };
  const geometry = mergeParts(parts);
  for (const g of parts) g.dispose();
  return { geometry, owner: Uint16Array.from(owners), centres, baseY };
}

/** Where a road vertex rides: on a carrying bridge's plank (blended over the ramp) or on the clay. */
type Deck = { plan: BridgePlan; y0: number; y1: number };
function deckYAt(d: Deck, along: number) { const t = Math.min(Math.max(along / d.plan.length, 0), 1); return d.y0 + (d.y1 - d.y0) * t + TOY.deckLift; }

/** The prototype's draped flat ribbon (both edges on the clay), for one road; returns null if too short. */
function ribbonGeometry(clay: ClaySurface, points: readonly Point2[], widthDu: number, decks: readonly Deck[]): THREE.BufferGeometry | null {
  const n = points.length;
  if (n < 2) return null;
  const hw = widthDu / 2 / clay.frame.scale, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]!, b = points[Math.min(n - 1, i + 1)]!, p = points[i]!;
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = -ty, ny = tx;
    let blend = 0, deckY = 0;
    for (const d of decks) {
      const where = locateOnBridge(d.plan, p[0], p[1]), k = deckBlend(d.plan, where);
      if (k > blend) { blend = k; deckY = deckYAt(d, where.along); }
    }
    for (const s of [1, -1]) {
      const x = p[0] + nx * hw * s, y = p[1] + ny * hw * s, ground = clay.groundAt(x, y) + TOY.roadLift;
      pos.push(clay.toX(x), blend > 0 ? ground + (Math.max(ground, deckY + 0.004) - ground) * blend : ground, clay.toZ(y));
    }
    if (i < n - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals(); flipUp(g);
  return g;
}

/** Clay planks under the spans that carry a drawn road: level between the clay at their two ends. */
function plankGeometry(clay: ClaySurface, decks: readonly Deck[]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  for (const d of decks) {
    const b = d.plan, draw = b.drawIndices ?? b.plan.map((_, i) => i), hw = Math.max(TOY.deckWidth, b.width * clay.frame.scale) / 2;
    const pos: number[] = [], idx: number[] = [];
    draw.forEach((ai, k) => {
      const p = b.plan[ai]!, prev = b.plan[draw[Math.max(0, k - 1)]!]!, next = b.plan[draw[Math.min(draw.length - 1, k + 1)]!]!;
      let tx = clay.toX(next[0]) - clay.toX(prev[0]), tz = clay.toZ(next[1]) - clay.toZ(prev[1]);
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const x = clay.toX(p[0]), z = clay.toZ(p[1]), top = deckYAt(d, b.arc[ai]!), bottom = top - TOY.deckThickness;
      // left top, right top, left bottom, right bottom
      pos.push(x - tz * hw, top, z + tx * hw, x + tz * hw, top, z - tx * hw, x - tz * hw, bottom, z + tx * hw, x + tz * hw, bottom, z - tx * hw);
      if (k < draw.length - 1) {
        const o = k * 4, q = o + 4;
        idx.push(o, q, o + 1, o + 1, q, q + 1); // top
        idx.push(o + 2, q + 2, o, o, q + 2, q); // left side
        idx.push(o + 1, q + 1, o + 3, o + 3, q + 1, q + 3); // right side
      }
    });
    if (idx.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); parts.push(g); }
  }
  if (!parts.length) return null;
  const out = mergeParts(parts);
  for (const g of parts) g.dispose();
  return out;
}

// --- toys (the prototype's house, tree, the Mandevilla Queen) --------------------------------------------------------

type Toys = { house: ToyPart[]; tree: ToyPart[]; queen: ToyPart[]; blob: { house: ToyPart[]; tree: ToyPart[]; queen: ToyPart[] }; owned: THREE.BufferGeometry[] };
type AnyPaint = ClayPaint | keyof JourneyPropPalette | `derived.${keyof ReturnType<typeof clayDerived>}`;

function toyKit(tier: "full" | "lite"): Toys {
  const lod = CLAY_LAND_LOD[tier], owned: THREE.BufferGeometry[] = [];
  const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => { g.translate(x, y, z); owned.push(g); return g; };
  const seg = lod.houseSegments;
  const wall = at(seg > 1 ? roundedBox(0.34, 0.28, 0.3, 0.05, seg) : new THREE.BoxGeometry(0.34, 0.28, 0.3), 0, 0.14, 0);
  const roof = at(new THREE.BoxGeometry(0.42, 0.06, 0.34), 0, 0.33, 0);
  const ridge = new THREE.CylinderGeometry(0.2, 0.2, 0.38, 3, 1);
  ridge.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 6, 0, Math.PI / 2, "XYZ")));
  ridge.scale(1, 1, 0.62);
  at(ridge, 0, 0.36, 0);
  const door = at(new THREE.BoxGeometry(0.08, 0.13, 0.02), 0, 0.08, 0.155);
  for (const g of [wall, roof, door]) if (g.getAttribute("uv")) g.deleteAttribute("uv");
  const trunk = at(new THREE.CylinderGeometry(0.035, 0.05, 0.22, lod.trunkSides, 1, true), 0, 0.11, 0);
  const crown = lod.treeDetail ? new THREE.SphereGeometry(0.17, 7, 5) : new THREE.IcosahedronGeometry(0.17, 0);
  crown.scale(1, 1.05, 1);
  at(crown, 0, 0.3, 0);
  const pot = at(new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.17, 0.16], [0.16, 0.18], [0, 0.18]].map(([x, y]) => new THREE.Vector2(x, y)), tier === "full" ? 12 : 8), 0, 0, 0);
  const body = new THREE.SphereGeometry(0.1, tier === "full" ? 10 : 7, tier === "full" ? 8 : 5); body.scale(1, 1.1, 0.9); at(body, 0, 0.26, 0);
  const head = at(new THREE.SphereGeometry(0.075, tier === "full" ? 10 : 7, tier === "full" ? 8 : 5), 0, 0.39, 0);
  const ears = [-1, 1].map((s) => at(new THREE.ConeGeometry(0.03, 0.06, 6), s * 0.045, 0.46, 0));
  const flower = at(new THREE.SphereGeometry(0.04, 6, 4), 0.1, 0.22, 0.06);
  for (const g of [pot, body, head, ...ears, flower]) if (g.getAttribute("uv")) g.deleteAttribute("uv");
  for (const g of owned) if (g.getAttribute("uv")) g.deleteAttribute("uv");
  const disc = (r: number) => { const g = blobDisc(r); g.translate(0, TOY.blobLift, 0); owned.push(g); return [{ geometry: g, paint: "shadow" as const }]; };
  return {
    house: [{ geometry: wall, paint: "wall" }, { geometry: roof, paint: "roof1" }, { geometry: ridge, paint: "roof1" }, { geometry: door, paint: "trunk" }],
    tree: [{ geometry: trunk, paint: "trunk" }, { geometry: crown, paint: "leaf" }],
    queen: [{ geometry: pot, paint: "pot" as ClayPaint }, { geometry: body, paint: "porcelain" as ClayPaint }, { geometry: head, paint: "porcelain" as ClayPaint },
      ...ears.map((g) => ({ geometry: g, paint: "porcelain" as ClayPaint })), { geometry: flower, paint: "cross" as ClayPaint }],
    blob: { house: disc(0.32), tree: disc(0.22), queen: disc(0.24) },
    owned,
  };
}

/** A deterministic 0…1 hash of a lattice node (stable yaw / order without Math.random). */
const hash01 = (i: number) => { let h = (i ^ 0x9e3779b9) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

type Placed = { kind: "house" | "tree" | "queen"; x: number; y: number; yaw: number; scale: number; paint?: ClayPaint };

/** Every toy's concept position: hosts, village houses on settled paint, trees on woodland and meadow. */
export function placeClayScenery(land: JourneyLandData, clay: ClaySurface, tier: "full" | "lite"): Placed[] {
  const lod = CLAY_LAND_LOD[tier], out: Placed[] = [];
  const wet = land.water.filter((w) => w.kind !== "dry");
  const inWater = (x: number, y: number, pad: number) => wet.some((w) => pointInPolygon(x, y, w.outline) || distanceToLine(closedRing(w.outline), x, y, true) < pad);
  const roofs: ClayPaint[] = ["roof1", "roof3", "roof2"];
  // Hosts: Our home under the home roof, the bank as the porcelain Queen, the others as houses.
  land.hosts.forEach((h, i) => {
    const [x, y] = h.door;
    if (!clay.insideCoast(x, y)) return;
    if (h.id === "bank") out.push({ kind: "queen", x, y, yaw: 0, scale: TOY.queenScale });
    else if (h.id === "home") out.push({ kind: "house", x, y, yaw: 0.3, scale: TOY.homeScale, paint: "homeRoof" });
    else out.push({ kind: "house", x, y, yaw: (i * 1.7) % 1.2 - 0.6, scale: TOY.houseScale, paint: roofs[(i + 1) % 3]! });
  });
  // Village houses on the bake's settled ground, nearest district heart first, spaced and clear of hosts and water.
  const { columns: C, rows: R, step } = clay, paints = land.terrain.surfaces;
  const hearts = land.districts.flatMap((d) => (d.heart ? [d.heart] : []));
  const candidates: { i: number; x: number; y: number; d: number }[] = [];
  for (let i = 0; i < C * R; i++) {
    const k = paints[i]! & 31;
    if (k < PAINT_SETTLED[0] || k > PAINT_SETTLED[1] || !clay.inside[i] || clay.coastDistance[i]! < PLACE.houseCoastM) continue;
    const x = (i % C) * step, y = Math.floor(i / C) * step;
    candidates.push({ i, x, y, d: hearts.length ? Math.min(...hearts.map((h) => Math.hypot(h[0] - x, h[1] - y))) : 0 });
  }
  candidates.sort((a, b) => a.d - b.d || a.i - b.i);
  const houses = out.map((p) => [p.x, p.y] as Point2);
  let village = 0;
  for (const c of candidates) {
    if (village >= lod.villageHouses) break;
    if (houses.some((q) => Math.hypot(q[0] - c.x, q[1] - c.y) < (village < out.length ? PLACE.houseHostClearM : PLACE.houseSpacingM))) continue;
    if (inWater(c.x, c.y, PLACE.houseWaterPadM)) continue;
    houses.push([c.x, c.y]);
    out.push({ kind: "house", x: c.x, y: c.y, yaw: hash01(c.i) * 1.2 - 0.6, scale: TOY.villageScale, paint: roofs[village % 3]! });
    village++;
  }
  // Trees (prototype): woodland paint first, then a sprinkle on low meadow; seeded, spaced, off the water.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const placed: Point2[] = [];
  let trees = 0;
  for (let i = 0; i < C * R && trees < lod.trees; i++) {
    const wood = (paints[i]! & 31) === PAINT_WOOD;
    if (!wood && !(rnd() < PLACE.meadowChance && clay.heights[i]! < PLACE.meadowMaxM)) continue;
    if (!clay.inside[i] || clay.coastDistance[i]! < PLACE.treeCoastM || clay.heights[i]! > PLACE.treeMaxHeightM) continue;
    const x = (i % C) * step + (rnd() - 0.5) * PLACE.treeJitterM, y = Math.floor(i / C) * step + (rnd() - 0.5) * PLACE.treeJitterM;
    if (inWater(x, y, PLACE.treeWaterPadM)) continue;
    if (placed.some((q) => Math.hypot(q[0] - x, q[1] - y) < (wood ? PLACE.woodSpacingM : PLACE.meadowSpacingM))) continue;
    placed.push([x, y]);
    const s = TOY.treeScale + rnd() * TOY.treeScaleJitter;
    out.push({ kind: "tree", x, y, yaw: 0, scale: s, paint: rnd() < 0.5 ? "leaf2" : "leaf" });
    trees++;
  }
  return out;
}

// --- the Year mini --------------------------------------------------------------------------------------------------

function miniIsland(land: JourneyLandData, frame: DioramaFrame, tier: "full" | "lite") {
  const lod = CLAY_LAND_LOD[tier];
  const clay = createClaySurface(land, frame, lod.miniCoast);
  const { geometry: terrain, src } = terrainGeometry(clay, lod.miniStride, true);
  const slab = slabGeometry(clay, clay.coast, 0);
  const shoulder = shoulderGeometry(clay, clay.coast);
  // Per-part colour roles, so a theme change repaints in place.
  const roles = (g: THREE.BufferGeometry, role: number) => { const n = g.getAttribute("position").count; g.setAttribute("aRole", new THREE.BufferAttribute(new Float32Array(n).fill(role), 1)); };
  roles(shoulder, 2); roles(slab, 1); roles(terrain, 0);
  for (const g of [shoulder, slab]) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 3), 3));
  const geometry = mergeParts([shoulder, slab, terrain], ["color", "aRole"]);
  geometry.name = "journey-land:mini";
  geometry.computeBoundingSphere();
  const terrainStart = shoulder.getAttribute("position").count + slab.getAttribute("position").count;
  const paints = land.terrain.surfaces;
  const recolour = (p: JourneyClayPalette) => {
    const painted = paintTerrain(terrain, src, clay, paints, p);
    const out = geometry.getAttribute("color") as THREE.BufferAttribute, arr = out.array as Float32Array, role = geometry.getAttribute("aRole");
    const sand = colour(p.sand), shallow = colour(p.shallow);
    for (let v = 0; v < terrainStart; v++) { const c = role.getX(v) === 1 ? sand : shallow; arr.set([c.r, c.g, c.b], v * 3); }
    arr.set(painted, terrainStart * 3);
    out.needsUpdate = true;
  };
  return { geometry, recolour, dispose() { geometry.dispose(); terrain.dispose(); slab.dispose(); shoulder.dispose(); } };
}

// --- member homes (D53), re-materialled as clay ----------------------------------------------------------------------

function clayHomes(homes: readonly JourneyHome[], land: JourneyLandData, surface: LandSurface, clay: ClaySurface, tier: "full" | "lite", season: Season) {
  const built: HomeMeshes = buildHomes(homes, land, surface, clayPalette("classic").ink, season);
  const reserves = reservesForHomes(land, surface);
  const sites = new Map<string, ReturnType<typeof homeSite>>(homes.map((h) => [`${h.memberId}@${h.plotId}`, homeSite(reserves, h.plotId)]));
  const owned: Owned[] = [];
  const s = clay.frame.scale * TOY.homeToy;
  built.group.name = CLAY_NAMES.homes;
  for (const node of [...built.group.children]) {
    const tag = node.name.slice(node.name.lastIndexOf(":") + 1), site = sites.get(tag);
    const drawable = node as THREE.Mesh | THREE.LineSegments;
    if (!site || !drawable.geometry) continue;
    const g = drawable.geometry, p = g.getAttribute("position") as THREE.BufferAttribute;
    const baseM = compressHeight(site.y), cx = clay.toX(site.x), cz = clay.toZ(site.z), ground = clay.groundAt(site.x, site.z) - TOY.sink;
    for (let i = 0; i < p.count; i++) {
      const up = (p.getY(i) - baseM) / HEIGHT_COMPRESSION.buildingScale;
      p.setXYZ(i, cx + (p.getX(i) - site.x) * s, ground + up * s, cz + (p.getZ(i) - site.z) * s);
    }
    p.needsUpdate = true;
    g.computeBoundingSphere();
    if ((drawable as THREE.Mesh).isMesh) {
      g.computeVertexNormals();
      const old = drawable.material as THREE.MeshLambertMaterial;
      const clayMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, transparent: old.transparent, opacity: old.opacity, depthWrite: old.depthWrite, side: old.side });
      drawable.material = clayMaterial; owned.push(clayMaterial);
      drawable.castShadow = tier === "full" && !old.transparent; drawable.receiveShadow = tier === "full";
    } else (drawable as THREE.LineSegments).computeLineDistances();
  }
  return { group: built.group, dispose() { built.dispose(); for (const o of owned) o.dispose(); } };
}

// ---------------------------------------------------------------------------------------------------------------------

export const buildJourneyLand: BuildJourneyLand = (data: JourneyLandData, options): ClayLandHandle => {
  const tier = options.tier, lod = CLAY_LAND_LOD[tier], season: Season = options.season ?? "summer";
  let theme: ThemeId = options.theme;
  let palette = clayPalette(theme);
  const props: JourneyPropPalette = JOURNEY_PROP_PALETTE;
  const frame = dioramaFrame(data);
  const clay = createClaySurface(data, frame, lod.coast);
  const surface = createLandSurface(data);
  const shadows = tier === "full";
  const group = new THREE.Group();
  group.name = CLAY_LAND_NAME;
  group.userData.tier = tier;
  group.userData.frame = frame;
  const owned: Owned[] = [];
  const mats: { key: AnyPaint; material: THREE.MeshStandardMaterial }[] = [];
  const material = (key: AnyPaint, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, ...extra });
    mats.push({ key, material: m }); owned.push(m);
    return m;
  };
  const add = (geometry: THREE.BufferGeometry, m: THREE.Material, name: string, cast: boolean) => {
    const mesh = new THREE.Mesh(geometry, m);
    mesh.name = name; mesh.castShadow = shadows && cast; mesh.receiveShadow = shadows;
    group.add(mesh); owned.push(geometry);
    return mesh;
  };

  // Sea shoulder, slab, terrain.
  add(shoulderGeometry(clay, clay.coast), material("shallow", { roughness: 0.5 }), CLAY_NAMES.shallows, false);
  add(slabGeometry(clay, clay.coast, lod.bevel), material("sand"), CLAY_NAMES.slab, true);
  const { geometry: terrainGeo, src } = terrainGeometry(clay, 1);
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  owned.push(terrainMat);
  add(terrainGeo, terrainMat, CLAY_NAMES.terrain, true);
  let terrainBase = paintTerrain(terrainGeo, src, clay, data.terrain.surfaces, palette);
  const terrainY = Float32Array.from((terrainGeo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array);

  // Water inside the coast: lakes flat, rivers draped. (The open sea and the Bight are the clock's sea.)
  const insideBody = (w: JourneyLandData["water"][number]) => { const ring = closedRing(w.outline); return ring.filter((q) => clay.insideCoast(q[0], q[1])).length * 2 > ring.length; };
  const lakesData = waterGeometry(clay, data.water.filter((w) => LEVEL_WATER_KINDS.has(w.kind) && insideBody(w)), false);
  const riversData = waterGeometry(clay, data.water.filter((w) => !LEVEL_WATER_KINDS.has(w.kind) && w.kind !== "dry" && insideBody(w)), true);
  const lakes = lakesData.geometry ? add(lakesData.geometry, material("water", { roughness: 0.28, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), CLAY_NAMES.lakes, false) : null;
  const rivers = riversData.geometry ? add(riversData.geometry, material("water", { roughness: 0.3, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), CLAY_NAMES.rivers, false) : null;
  const lakeY = lakes ? Float32Array.from((lakes.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array) : null;

  // Roads: main and minor ribbons, planks under the spans that carry them.
  const roadLines = data.lines.filter((l) => l.kind === "road" && l.points.length >= 2);
  const drawnIds = new Set(roadLines.map((l) => l.id));
  const decks: Deck[] = planBridges(data).filter((b) => [...b.lineIds].some((id) => drawnIds.has(id))).map((plan) => {
    const a = plan.plan[0]!, b = plan.plan[plan.plan.length - 1]!;
    return { plan, y0: clay.groundAt(a[0], a[1]), y1: clay.groundAt(b[0], b[1]) };
  });
  const ribbons = (minor: boolean) => roadLines.filter((l) => isMinorLine(l.id) === minor).flatMap((l) => {
    const g = ribbonGeometry(clay, resampleLine(l.points, minor ? lod.minorStep : lod.roadStep), minor ? TOY.minorWidth : TOY.roadWidth, decks.filter((d) => d.plan.lineIds.has(l.id)));
    return g ? [g] : [];
  });
  const roadMat = (key: "derived.road" | "derived.minorRoad") => material(key, { roughness: 0.9, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
  const mainParts = ribbons(false), minorParts = ribbons(true);
  const mainRoads = mainParts.length ? add(mergeParts(mainParts), roadMat("derived.road"), CLAY_NAMES.roads, false) : null;
  const minorRoads = minorParts.length ? add(mergeParts(minorParts), roadMat("derived.minorRoad"), CLAY_NAMES.minorRoads, false) : null;
  for (const g of [...mainParts, ...minorParts]) g.dispose();
  const planks = plankGeometry(clay, decks);
  if (planks) add(planks, material("derived.deck", { roughness: 0.75 }), CLAY_NAMES.bridges, true);

  // Scenery: houses (+ the Queen) and trees, each ONE mesh; blob contact shadows (lite only).
  const toys = toyKit(tier);
  for (const g of toys.owned) owned.push(g);
  const placed = placeClayScenery(data, clay, tier);
  const item = (p: Placed, parts: readonly ToyPart[]): ToyItem => ({
    parts, at: new THREE.Vector3(clay.toX(p.x), clay.groundAt(p.x, p.y) - TOY.sink, clay.toZ(p.y)), yaw: p.yaw, scale: p.scale,
    paints: p.paint ? (p.kind === "tree" ? { leaf: p.paint } : { roof1: p.paint }) : undefined,
  });
  const housesPlaced = placed.filter((p) => p.kind !== "tree"), treesPlaced = placed.filter((p) => p.kind === "tree");
  const houseIndex = new Map(housesPlaced.map((p, i) => [p, i])), treeIndex = new Map(treesPlaced.map((p, i) => [p, i]));
  const toyMat = (vertexColors = true) => { const m = new THREE.MeshStandardMaterial({ vertexColors, roughness: 0.82, metalness: 0 }); owned.push(m); return m; };
  const recolourAll = (s: ScatterMesh) => s.recolour({ ...props, ...palette } as unknown as JourneyClayPalette);
  const houses = buildScatter(CLAY_NAMES.houses, housesPlaced.map((p) => item(p, p.kind === "queen" ? toys.queen : toys.house)), toyMat());
  const trees = buildScatter(CLAY_NAMES.trees, treesPlaced.map((p) => item(p, toys.tree)), toyMat());
  const blobMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  owned.push(blobMat);
  const blobs = buildScatter(CLAY_NAMES.blobs, placed.map((p) => item(p, p.kind === "tree" ? toys.blob.tree : p.kind === "queen" ? toys.blob.queen : toys.blob.house)), blobMat,
    (_part, v) => (v === 0 ? 0.42 : 0));
  for (const s of [houses, trees]) { s.mesh.castShadow = shadows; s.mesh.receiveShadow = shadows; group.add(s.mesh); owned.push(s); }
  blobs.mesh.visible = !shadows; blobs.mesh.renderOrder = 1; group.add(blobs.mesh); owned.push(blobs);
  for (const s of [houses, trees, blobs]) recolourAll(s);

  // Member homes (D53).
  let homes = clayHomes(options.homes, data, surface, clay, tier, season);
  group.add(homes.group);

  // Year mini (lazy, owned).
  let mini: ReturnType<typeof miniIsland> | null = null;

  const recolourMaterials = () => {
    const derived = clayDerived(palette) as Record<string, string>;
    for (const { key, material: m } of mats) {
      const hex = key.startsWith("derived.") ? derived[key.slice(8)] : (palette as unknown as Record<string, string>)[key] ?? (props as unknown as Record<string, string>)[key];
      m.color.set(hex ?? "#ffffff");
    }
    for (const s of [houses, trees, blobs]) recolourAll(s);
  };
  recolourMaterials();

  // --- Week calm (prototype calmPrep / calmColours / applyCalm) ----------------------------------------------------
  let calm: { f: Float32Array; target: Float32Array; lakeF: Float32Array; keepHouses: boolean[]; keepTrees: boolean[]; liftHouses: number[]; liftTrees: number[]; trail: readonly Point2[]; clear: JourneyLandCalm["clear"] } | null = null;
  let calmQ = 0;
  const terrainPos = terrainGeo.getAttribute("position") as THREE.BufferAttribute, terrainCol = terrainGeo.getAttribute("color") as THREE.BufferAttribute;
  const top = JOURNEY_DIORAMA.slab.top;
  const calmTargets = (f: Float32Array) => {
    const target = new Float32Array(terrainBase.length), tc = colour(palette.grass).lerp(colour(palette.sand), 0.35);
    for (let v = 0; v < src.length; v++) {
      const r = terrainBase[v * 3]!, g = terrainBase[v * 3 + 1]!, b = terrainBase[v * 3 + 2]!, l = r * 0.3 + g * 0.59 + b * 0.11;
      const k = Math.min(1, f[v]! * CALM.colourShare) * smooth(CALM.coastFromM, CALM.coastToM, clay.coastDistance[src[v]!]!);
      target[v * 3] = r + (l * 0.2 + tc.r * 0.8 - r) * k; target[v * 3 + 1] = g + (l * 0.2 + tc.g * 0.8 - g) * k; target[v * 3 + 2] = b + (l * 0.2 + tc.b * 0.8 - b) * k;
    }
    return target;
  };
  const fieldAt = (trail: readonly Point2[], x: number, y: number, h: number) => {
    const d = distanceToLine(trail, x, y, false);
    return Math.max(smooth(CALM.fadeFromM, CALM.fadeToM, d), smooth(CALM.highFromM, CALM.highToM, h) * smooth(CALM.highNearFromM, CALM.highNearToM, d));
  };
  const keepRule = (list: readonly Placed[], trail: readonly Point2[], clear: JourneyLandCalm["clear"]) => {
    let n = 0;
    return list.map((p) => {
      const d = distanceToLine(trail, p.x, p.y, false);
      const free = (clear ?? []).every((c) => Math.hypot(c.x - p.x, c.y - p.y) > c.r + CALM.keepClearM);
      return free && d > CALM.keepNearM && d < CALM.keepFarM && n++ % CALM.keepEvery === 0;
    });
  };
  const applyCalm = (q: number) => {
    calmQ = q;
    const on = calm && q > 0;
    for (let v = 0; v < src.length; v++) {
      const k = on ? calm!.f[v]! * q : 0, y0 = terrainY[v * 3 + 1]!;
      terrainPos.setY(v, y0 > top ? top + (y0 - top) * (1 - CALM.squash * k) : y0);
      for (let j = 0; j < 3; j++) terrainCol.array[v * 3 + j] = on ? terrainBase[v * 3 + j]! + (calm!.target[v * 3 + j]! - terrainBase[v * 3 + j]!) * q : terrainBase[v * 3 + j]!;
    }
    terrainPos.needsUpdate = true; terrainCol.needsUpdate = true; terrainGeo.computeVertexNormals();
    if (lakes && lakeY) {
      const p = lakes.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const k = on ? calm!.lakeF[lakesData.owner[i]!]! * q : 0, y0 = lakeY[i * 3 + 1]!; p.setY(i, top + (y0 - top) * (1 - CALM.squash * k)); }
      p.needsUpdate = true;
    }
    const fade = (mesh: THREE.Mesh | null, to: number) => { if (!mesh) return; const m = mesh.material as THREE.MeshStandardMaterial; m.opacity = 1 - (on ? q : 0) * to; mesh.visible = m.opacity > 0.02; };
    fade(rivers, 1); fade(minorRoads, 1); fade(mainRoads, CALM.mainRoadFade);
    const thin = on && q >= 0.5;
    houses.setShown(thin ? calm!.keepHouses : null); trees.setShown(thin ? calm!.keepTrees : null);
    blobs.setShown(thin ? placed.map((p) => (p.kind === "tree" ? calm!.keepTrees[treeIndex.get(p)!]! : calm!.keepHouses[houseIndex.get(p)!]!)) : null);
    houses.setBaseY(on ? calm!.liftHouses.map((y, i) => houses.bases[i]!.y + (y - houses.bases[i]!.y) * q) : null);
    trees.setBaseY(on ? calm!.liftTrees.map((y, i) => trees.bases[i]!.y + (y - trees.bases[i]!.y) * q) : null);
  };
  const setCalm: ClayLandHandle["setCalm"] = (next, amount = 1) => {
    const q = next ? Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 1)) : 0;
    if (!next) { if (calm || calmQ) { calm = null; applyCalm(0); } return; }
    if (!calm || calm.trail !== next.trail || calm.clear !== next.clear) {
      const f = new Float32Array(src.length);
      for (let v = 0; v < src.length; v++) { const i = src[v]!; f[v] = fieldAt(next.trail, (i % clay.columns) * clay.step, Math.floor(i / clay.columns) * clay.step, clay.heights[i]!); }
      const lakeF = Float32Array.from(lakesData.centres, (c) => smooth(CALM.fadeFromM, CALM.fadeToM, distanceToLine(next.trail, c[0], c[1], false)));
      const squashed = (p: Placed) => { const y0 = clay.groundAt(p.x, p.y), k = fieldAt(next.trail, p.x, p.y, 0); return top + (y0 - top) * (1 - CALM.squash * k) - TOY.sink; };
      calm = { f, target: calmTargets(f), lakeF, keepHouses: keepRule(housesPlaced, next.trail, next.clear), keepTrees: keepRule(treesPlaced, next.trail, next.clear),
        liftHouses: housesPlaced.map(squashed), liftTrees: treesPlaced.map(squashed), trail: next.trail, clear: next.clear };
      calmQ = -1;
    }
    if (Math.abs(q - calmQ) < 0.004) return;
    applyCalm(q);
  };
  group.userData.setCalm = setCalm;

  const stations = new Map(data.stations.map((s) => [s.id, s]));
  const worldToBoard = (x: number, y: number, lift = 0): Point3 => [x, compressHeight(surface.rawHeightAt(x, y)) + lift, y];
  let disposed = false;

  return {
    group, data, frame,
    worldToBoard,
    heightAt: surface.heightAt,
    rawHeightAt: surface.rawHeightAt,
    isLand: surface.isLand,
    stationAt(id: StationId): Point3 {
      const s = stations.get(id);
      if (!s) throw new Error(`Unknown station ${id}`);
      return worldToBoard(s.anchor[0], s.anchor[1]);
    },
    dioramaGroundAt: clay.groundAt,
    miniGeometry() {
      if (!mini) { mini = miniIsland(data, frame, tier); mini.recolour(palette); }
      return mini.geometry;
    },
    setCalm,
    setTheme(next: ThemeId) {
      if (next === theme) return;
      theme = next; palette = clayPalette(next);
      recolourMaterials();
      terrainBase = paintTerrain(terrainGeo, src, clay, data.terrain.surfaces, palette);
      if (calm) { calm.target = calmTargets(calm.f); const q = calmQ; calmQ = -1; applyCalm(q); }
      mini?.recolour(palette);
    },
    setHomes(next: JourneyHome[]) {
      if (disposed) return;
      homes.dispose();
      homes = clayHomes(next, data, surface, clay, tier, season);
      group.add(homes.group);
    },
    stats: () => countDraws(group),
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      homes.dispose();
      mini?.dispose();
      for (const o of owned) o.dispose();
      group.clear();
    },
  };
};
