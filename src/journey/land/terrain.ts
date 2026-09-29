/**
 * Terrain (T2; legibility pass T7): the low-poly terrain mesh from the baked `journey` LOD (20 m lattice). Sampling
 * lives in `surface.ts`.
 *
 * Heights are drawn through `compressHeight` (view-only); x/z are the lattice's own concept metres, never altered.
 * Seabed is flattened to sea level and quads wholly under the sea are dropped (`SEABED_CUT`): the sea plane (deep
 * water) stands just above the flattened seabed and the shallows band along the coastline (`water.ts`) is the rim.
 *
 * Every triangle carries ONE flat colour (non-indexed; the triangle count is unchanged): a calm, legible low-poly
 * read instead of vertex colours smeared across 20 m cells. The colour is
 *  - the shore ring: shallows (under water) → wet sand → sand where a face touches the waterline;
 *  - else a height band on the face's mean baked height — meadow → upland → highland → high rock — with the baked
 *    paint only where it matters (beach sand, woodland floor, bare rock, snow, settled ground);
 *  - a small per-landform tint, so neighbouring districts read as different ground at Sky;
 *  - times a baked raking light: the face's slope (on gently exaggerated baked heights) against a low north-west sun.
 *    No shadow maps, no scene lights: the material is unlit, so each theme's colours are exact.
 */
import * as THREE from "three";
import type { JourneyLandData, JourneyLandDressing } from "../contracts.ts";
import { compressHeight } from "../contracts.ts";
import { landExtras } from "./dressing.ts";
import { pointInPolygon } from "./simplify.ts";

const scratch = new THREE.Color(), other = new THREE.Color();
const mixed = (a: string, b: string, t: number) => scratch.set(a).lerp(other.set(b), t);

/**
 * A quad whose every corner is at or below this (baked m) is not drawn: the sea stands just above the flattened seabed,
 * so the visible shore is where the drawn (linearly interpolated) terrain rises through the water — a contour, not
 * the lattice's staircase — and the shallows rim is the smooth band along the coastline drawn by `water.ts`.
 */
export const SEABED_CUT = 0.05;
/** Height band edges (baked metres, face mean). */
export const BANDS = { meadow: 24, upland: 62, highland: 105 } as const;
/** Relief used for the raking light only (baked metres × this); the drawn heights stay compressed. */
const SHADE_RELIEF = 0.85;
/** The low sun: from the north-west and fairly low, so slopes facing the camera (south) read as shade. */
const SUN = new THREE.Vector3(-0.62, 0.7, -0.55).normalize();
const SHADE_GAIN = 1.4, SHADE_DARK = 0.22, SHADE_LIGHT = 0.1;
/** Per-landform lightness steps (cycled by landform order), a whisper of difference between districts. */
const LANDFORM_TINT = [0, 0.045, -0.035, 0.03, -0.05, 0.02, -0.02, 0.05, -0.04, 0.035, -0.015, 0.025];

/**
 * Vertex colour from the baked paint byte (ground palette index, bits 0–4, `TERRAIN_SURFACE_PALETTE` order) and the
 * height. Kept for callers that colour a single point (the flat twin's reading, tests); the mesh uses `faceColour`.
 */
export function groundColour(paint: number, height: number, d: JourneyLandDressing, out: THREE.Color): THREE.Color {
  if (height < 0) return out.set(d.shallows);
  return bandColour(paint, height, height, height, d, out);
}

function band(h: number, d: JourneyLandDressing): string {
  const x = landExtras(d);
  return h < BANDS.meadow ? d.grass : h < BANDS.upland ? d.forest : h < BANDS.highland ? x.highland : x.peak;
}

/** Colour of a land face from its dominant paint and its heights (mean, min, max). */
function bandColour(paint: number, mean: number, lo: number, hi: number, d: JourneyLandDressing, out: THREE.Color): THREE.Color {
  const x = landExtras(d);
  const ground = paint & 31;
  if (ground === 19) return out.set(d.snow);
  if (ground === 0 && mean < 10) return out.set(d.sand); // beaches and dunes
  if (ground >= 12 && ground <= 18) return out.copy(mixed(x.settled, band(mean, d), 0.35)); // paved · earth · apron · boardwalk · cobble · gravel · plaza
  out.set(band(mean, d));
  // A face that straddles a band edge takes half of each: the bands step, they do not saw.
  for (const edge of [BANDS.meadow, BANDS.upland, BANDS.highland]) {
    if (lo < edge && hi >= edge) { out.lerp(other.set(band(mean < edge ? edge + 1 : edge - 1, d)), 0.4); break; }
  }
  if (ground === 2) out.lerp(other.set(d.forest), 0.45).multiplyScalar(0.94); // woodland floor: a deeper green
  else if (ground >= 4 && ground <= 11) out.lerp(other.set(d.rock), 0.6); // strata rock / ledges
  else if (ground === 3) out.lerp(other.set(d.sand), 0.3); // ochre
  else if (ground === 20) out.lerp(other.set(d.rock), 0.45); // scree
  return out;
}

export type TerrainMesh = { mesh: THREE.Mesh; recolour(d: JourneyLandDressing): void; dispose(): void };

export function buildTerrainMesh(data: JourneyLandData, dressing: JourneyLandDressing): TerrainMesh {
  const field = data.terrain;
  const { columns, rows, step, heights, surfaces } = field;
  // Faces: three lattice nodes each, split along the flatter diagonal so ridges read as ridges.
  const faces: number[] = [];
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
    const a = j * columns + i, b = a + 1, c = a + columns, e = c + 1;
    // Wholly under the sea: the sea plane (deep water) and the shallows band (`water.ts`) draw it.
    if (Math.max(heights[a]!, heights[b]!, heights[c]!, heights[e]!) <= SEABED_CUT) continue;
    // Counter-clockwise seen from above (+y).
    if (Math.abs(heights[a]! - heights[e]!) <= Math.abs(heights[b]! - heights[c]!)) faces.push(a, c, e, a, e, b);
    else faces.push(a, c, b, b, c, e);
  }
  const count = faces.length, positions = new Float32Array(count * 3), colours = new Float32Array(count * 3);
  const node = (n: number) => [(n % columns) * step, Math.floor(n / columns) * step] as const;
  for (let k = 0; k < count; k++) {
    const n = faces[k]!, [x, z] = node(n);
    positions[k * 3] = x; positions[k * 3 + 1] = Math.max(0, compressHeight(heights[n]!)); positions[k * 3 + 2] = z;
  }

  // Per face (fixed across themes): the shore role, heights, dominant paint, landform and the raking-light shade.
  const faceCount = count / 3;
  const role = new Uint8Array(faceCount); // 0 land · 1 shallows · 2 wet sand · 3 sand
  const mean = new Float32Array(faceCount), lo = new Float32Array(faceCount), hi = new Float32Array(faceCount);
  const paint = new Uint8Array(faceCount), shade = new Float32Array(faceCount), landform = new Int16Array(faceCount).fill(-1);
  // Landforms, largest first, so the smaller (more specific) landform wins where they overlap.
  const area = (ring: readonly (readonly [number, number])[]) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]!; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const forms = data.landforms.map((l, index) => ({ l, index, area: area(l.outline) })).sort((p, q) => q.area - p.area);
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), normal = new THREE.Vector3();
  const flatLight = SUN.y;
  for (let f = 0; f < faceCount; f++) {
    const n0 = faces[f * 3]!, n1 = faces[f * 3 + 1]!, n2 = faces[f * 3 + 2]!;
    const h0 = heights[n0]!, h1 = heights[n1]!, h2 = heights[n2]!;
    mean[f] = (h0 + h1 + h2) / 3; lo[f] = Math.min(h0, h1, h2); hi[f] = Math.max(h0, h1, h2);
    role[f] = hi[f]! <= 0.4 ? 1 : lo[f]! <= 0.4 ? (mean[f]! <= 0.6 ? 2 : 3) : 0;
    // The dominant paint: two corners agreeing win, else the highest corner's.
    const p0 = surfaces[n0]! & 31, p1 = surfaces[n1]! & 31, p2 = surfaces[n2]! & 31;
    paint[f] = p0 === p1 || p0 === p2 ? p0 : p1 === p2 ? p1 : h0 >= h1 && h0 >= h2 ? p0 : h1 >= h2 ? p1 : p2;
    const [x0, z0] = node(n0), [x1, z1] = node(n1), [x2, z2] = node(n2);
    ab.set(x1 - x0, (h1 - h0) * SHADE_RELIEF, z1 - z0);
    ac.set(x2 - x0, (h2 - h0) * SHADE_RELIEF, z2 - z0);
    normal.crossVectors(ac, ab).normalize();
    if (normal.y < 0) normal.negate();
    shade[f] = role[f] === 1 ? 1 : 1 + Math.min(SHADE_LIGHT, Math.max(-SHADE_DARK, (normal.dot(SUN) - flatLight) * SHADE_GAIN));
    if (role[f] === 0) {
      const cx = (x0 + x1 + x2) / 3, cz = (z0 + z1 + z2) / 3;
      for (let k = forms.length - 1; k >= 0; k--) if (pointInPolygon(cx, cz, forms[k]!.l.outline)) { landform[f] = forms[k]!.index; break; }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "journey-land:terrain";
  const recolour = (d: JourneyLandDressing) => {
    const x = landExtras(d);
    const c = new THREE.Color(), t = new THREE.Color();
    for (let f = 0; f < faceCount; f++) {
      const r = role[f]!;
      if (r === 1) c.set(d.shallows);
      else if (r === 2) c.set(x.wetSand);
      else if (r === 3) c.set(d.sand);
      else {
        bandColour(paint[f]!, mean[f]!, lo[f]!, hi[f]!, d, c);
        const lf = landform[f]!;
        if (lf >= 0) { const k = LANDFORM_TINT[lf % LANDFORM_TINT.length]!; if (k > 0) c.lerp(t.set(d.sand), k); else c.multiplyScalar(1 + k); }
      }
      c.multiplyScalar(shade[f]!);
      for (let v = 0; v < 3; v++) { const k = (f * 3 + v) * 3; colours[k] = c.r; colours[k + 1] = c.g; colours[k + 2] = c.b; }
    }
    (geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  };
  recolour(dressing);
  return { mesh, recolour, dispose: () => { geometry.dispose(); material.dispose(); } };
}
