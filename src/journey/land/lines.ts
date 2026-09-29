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
 */
import * as THREE from "three";
import type { JourneyLandDressing, JourneyLandLine, LandLineKind, Point2 } from "../contracts.ts";
import { hexRgb, LINE_DRESSING_KEY } from "./dressing.ts";
import { isMinorLine, LINE_TOLERANCE } from "./extract.ts";
import { densify, simplifyLine } from "./simplify.ts";
import type { LandSurface } from "./surface.ts";

/** Screen width (px) per kind, and the world clamp (eu) it is held inside. The board route is 14 px. */
export const LINE_PX: Readonly<Record<LandLineKind, number>> = { road: 3.4, skate: 2.8, walk: 2, cable: 1.4, rail: 2.2, ferry: 2, row: 1.6 };
export const LINE_WIDTH_EU: Readonly<Record<LandLineKind, { min: number; max: number }>> = {
  road: { min: 1.6, max: 9 }, skate: { min: 1.3, max: 7 }, walk: { min: 1, max: 5 }, cable: { min: 0.7, max: 4 },
  rail: { min: 1.1, max: 6 }, ferry: { min: 0.9, max: 6 }, row: { min: 0.8, max: 5 },
};
const MINOR_PX = 2.2, MINOR_EU = { min: 1.1, max: 6 };
/** Dash period (eu along the line) for the dashed kinds; 0 = solid. */
const DASH_EU: Readonly<Record<LandLineKind, number>> = { road: 0, skate: 0, walk: 0, cable: 9, rail: 0, ferry: 14, row: 10 };
const LINE_LIFT: Readonly<Record<LandLineKind, number>> = { road: 0.6, skate: 0.7, walk: 0.6, cable: 0.9, rail: 0.65, ferry: 0.3, row: 0.3 };
/** Longest ribbon segment (eu) before draping: one terrain lattice step. */
const DRAPE_STEP = 20;
export const MINOR_LINES_NAME = "journey-land:lines:minor";
export const MAJOR_LINES_NAME = "journey-land:lines:major";
/** Kinds drawn in the minor mesh (plus minor roads). */
const MINOR_KINDS = new Set<LandLineKind>(["cable", "ferry", "row"]);

/** The land's view uniforms, shared by every land shader (set once per frame by the board scene). */
export type LandViewUniforms = { uWpp: { value: number }; uHostPx: { value: number } };
export function landViewUniforms(): LandViewUniforms {
  // A Region-like default so a land built without a scene still draws sensibly.
  return { uWpp: { value: 0.3 }, uHostPx: { value: 0 } };
}

const VERTEX = /* glsl */ `
attribute vec2 aSide; attribute vec3 aWidth; attribute vec3 aColor; attribute vec2 aDash;
uniform float uWpp;
varying vec3 vColor; varying vec2 vDash;
void main() {
  float w = clamp(aWidth.x * uWpp, aWidth.y, aWidth.z);
  vec3 p = position + vec3(aSide.x, 0.0, aSide.y) * (0.5 * w);
  vColor = aColor; vDash = aDash;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}`;
const FRAGMENT = /* glsl */ `
varying vec3 vColor; varying vec2 vDash;
void main() {
  if (vDash.y > 0.0 && fract(vDash.x / vDash.y) > 0.56) discard;
  gl_FragColor = vec4(vColor, 1.0);
}`;

type Bucket = { positions: number[]; side: number[]; width: number[]; colour: number[]; kinds: LandLineKind[]; dash: number[]; index: number[] };
const bucket = (): Bucket => ({ positions: [], side: [], width: [], colour: [], kinds: [], dash: [], index: [] });

function ribbon(points: readonly Point2[], kind: LandLineKind, minor: boolean, surface: LandSurface, b: Bucket): void {
  const path = densify(points, DRAPE_STEP);
  if (path.length < 2) return;
  const base = b.positions.length / 3, lift = LINE_LIFT[kind];
  const px = minor && kind === "road" ? MINOR_PX : LINE_PX[kind], eu = minor && kind === "road" ? MINOR_EU : LINE_WIDTH_EU[kind];
  let arc = 0;
  for (let i = 0; i < path.length; i++) {
    if (i > 0) arc += Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]);
    const prev = path[Math.max(0, i - 1)]!, next = path[Math.min(path.length - 1, i + 1)]!;
    let tx = next[0] - prev[0], ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    // Normal in plan; miter length capped so sharp corners do not spike.
    let nx = -ty, ny = tx, scale = 1;
    if (i > 0 && i < path.length - 1) {
      const a = path[i - 1]!, p = path[i]!, c = path[i + 1]!;
      const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, l2 = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1;
      const n1x = -(p[1] - a[1]) / l1, n1y = (p[0] - a[0]) / l1, n2x = -(c[1] - p[1]) / l2, n2y = (c[0] - p[0]) / l2;
      nx = n1x + n2x; ny = n1y + n2y; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      scale = Math.min(2, 1 / Math.max(0.2, nx * n1x + ny * n1y));
    }
    const p = path[i]!, y = surface.surfaceAt(p[0], p[1]) + lift;
    for (const s of [1, -1]) {
      b.positions.push(p[0], y, p[1]);
      b.side.push(s * nx * scale, s * ny * scale);
      b.width.push(px, eu.min, eu.max);
      b.kinds.push(kind);
      b.dash.push(arc, DASH_EU[kind]);
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const l0 = base + i * 2, r0 = l0 + 1, l1 = l0 + 2, r1 = l0 + 3;
    b.index.push(l0, r0, l1, r0, r1, l1);
  }
}

export type LineMeshes = { meshes: THREE.Mesh[]; minor: THREE.Mesh | null; recolour(d: JourneyLandDressing): void; dispose(): void };

export function buildLines(lines: readonly JourneyLandLine[], tier: "full" | "lite", surface: LandSurface, dressing: JourneyLandDressing, view: LandViewUniforms = landViewUniforms()): LineMeshes {
  const major = bucket(), minorBucket = bucket();
  for (const line of lines) {
    const minorRoad = line.kind === "road" && isMinorLine(line.id);
    const points = tier === "lite" ? simplifyLine(line.points, LINE_TOLERANCE.lite) : line.points;
    ribbon(points, line.kind, minorRoad, surface, minorRoad || MINOR_KINDS.has(line.kind) ? minorBucket : major);
  }
  const meshes: THREE.Mesh[] = [], owned: { dispose(): void }[] = [], painted: { b: Bucket; geometry: THREE.BufferGeometry }[] = [];
  let minor: THREE.Mesh | null = null;
  const material = new THREE.ShaderMaterial({
    uniforms: { uWpp: view.uWpp }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    // Ribbons are flat; draw both faces so winding never hides one.
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  material.name = "journey-land-line";
  owned.push(material);
  for (const [name, b] of [[MAJOR_LINES_NAME, major], [MINOR_LINES_NAME, minorBucket]] as const) {
    if (!b.index.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
    geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(b.side, 2));
    geometry.setAttribute("aWidth", new THREE.Float32BufferAttribute(b.width, 3));
    geometry.setAttribute("aDash", new THREE.Float32BufferAttribute(b.dash, 2));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(new Float32Array(b.kinds.length * 3), 3));
    geometry.setIndex(b.index);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.renderOrder = 2;
    // Widths grow in the vertex shader: never cull a ribbon by its centreline box.
    mesh.frustumCulled = false;
    meshes.push(mesh); owned.push(geometry); painted.push({ b, geometry });
    if (name === MINOR_LINES_NAME) minor = mesh;
  }
  const recolour = (d: JourneyLandDressing) => {
    for (const { b, geometry } of painted) {
      const attr = geometry.getAttribute("aColor") as THREE.BufferAttribute, arr = attr.array as Float32Array;
      b.kinds.forEach((kind, n) => { arr.set(hexRgb(d[LINE_DRESSING_KEY[kind]]), n * 3); });
      attr.needsUpdate = true;
    }
  };
  recolour(dressing);
  return { meshes, minor, recolour, dispose() { for (const o of owned) o.dispose(); } };
}
