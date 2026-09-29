/**
 * Pass 5 (T1 Land, D-M1/D-M2): Mountain v2's baked ground, read for the Horizon bake.
 *
 * v2's ground grid (`public/mountain/terrain/hearth-mountain-geo-2.bin`, 1-unit lattice over native x −200…200,
 * z −396…−30) is read synchronously with Node's `fs` the first time the bake (or a Node test) asks for it. The browser never
 * runs `baseHeight` over a field it has not been served, so there `v2GroundAt` returns null and the Horizon's own height
 * stands. No v2 module is imported: v2's `terrainBase.ts` awaits a fetch at import and `definition.ts` builds the scene, so
 * the decoder below repeats `mountain/terrainAsset.ts decodeTerrainAsset` for the ground grid only (header layout:
 * u32 header length, JSON header {revision, base, ground, …}, base Float32 grid, ground Float32 grid).
 */
import { MOUNTAIN_V2_OFFSET as O } from '../../regions/mountainV2/placement';

export const MOUNTAIN_V2_GROUND_ASSET = 'public/mountain/terrain/hearth-mountain-geo-2.bin';
export const MOUNTAIN_V2_GROUND_REVISION = 'hearth-mountain-geo-2';
export interface V2Grid { minX: number; minZ: number; step: number; cols: number; rows: number; data: Float32Array }

let grid: V2Grid | null | undefined;
/** Decode v2's asset bytes to its ground grid (the grid v2's `groundHeightAt` samples before its benches). */
export function decodeV2Ground(bytes: ArrayBuffer): V2Grid {
  const view = new DataView(bytes), headerLength = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.slice(4, 4 + headerLength))) as { revision: string; base: Omit<V2Grid, 'data'>; ground: Omit<V2Grid, 'data'> };
  if (header.revision !== MOUNTAIN_V2_GROUND_REVISION) throw new Error(`Mountain v2 ground: expected ${MOUNTAIN_V2_GROUND_REVISION}, found ${header.revision}`);
  const groundOffset = 4 + headerLength + header.base.cols * header.base.rows * 4, size = header.ground.cols * header.ground.rows * 4;
  if (groundOffset + size !== bytes.byteLength) throw new Error('Mountain v2 ground: invalid asset length');
  return { ...header.ground, data: new Float32Array(bytes.slice(groundOffset, groundOffset + size)) };
}
/** The grid, loaded once in Node; null in a browser (no `process.getBuiltinModule`). */
export function mountainV2Grid(): V2Grid | null {
  if (grid !== undefined) return grid;
  const proc = (globalThis as { process?: { cwd(): string; getBuiltinModule?: (id: string) => unknown } }).process;
  const fs = proc?.getBuiltinModule?.('node:fs') as { readFileSync(path: string): Uint8Array } | undefined;
  if (!proc || !fs) return grid = null;
  const buffer = fs.readFileSync(`${proc.cwd()}/${MOUNTAIN_V2_GROUND_ASSET}`);
  return grid = decodeV2Ground(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
}
/** Bilinear, clamped: `mountain/terrainBase.ts sampleGrid`, repeated (that module awaits a fetch at import). */
export function sampleV2Grid(g: V2Grid, x: number, z: number): number {
  const fx = Math.max(0, Math.min(g.cols - 1.000001, (x - g.minX) / g.step)), fz = Math.max(0, Math.min(g.rows - 1.000001, (z - g.minZ) / g.step));
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, i = iz * g.cols + ix, d = g.data;
  return (d[i]! * (1 - u) + d[i + 1]! * u) * (1 - v) + (d[i + g.cols]! * (1 - u) + d[i + g.cols + 1]! * u) * v;
}
/** v2's ground at a Horizon point, in Horizon height (native + 54); null outside v2's grid or with no grid. */
export function v2GroundAt(hx: number, hz: number): number | null {
  const g = mountainV2Grid(); if (!g) return null;
  const nx = hx - O.x, nz = hz - O.z;
  if (nx < g.minX || nz < g.minZ || nx > g.minX + (g.cols - 1) * g.step || nz > g.minZ + (g.rows - 1) * g.step) return null;
  return sampleV2Grid(g, nx, nz) + O.y;
}

/** v2's harbour-island shape (`mountain/islandShape.ts`), repeated: the Foot terrace (D-M1) keeps its terrace level and lawn hump. */
export const MOUNTAIN_V2_ISLAND = { radius: 84, lawn: 58, terrace: 10.4, level: -0.05, sea: -0.45 } as const;
export function v2IslandHeight(nx: number, nz: number): number {
  const I = MOUNTAIN_V2_ISLAND, r = Math.hypot(nx, nz);
  if (r <= I.terrace) return I.level;
  if (r <= I.lawn) { const t = (r - I.terrace) / (I.lawn - I.terrace); return I.level + Math.sin(t * Math.PI) * (1.25 + .35 * Math.sin(nx * .065) * Math.cos(nz * .075)); }
  return I.level; // the island's sandy fall to v2's sea is not placed: the Foot terrace holds its level to the island's edge
}
/**
 * The D-M1 / D-M2 ground rule, in Horizon height. `horizon` is the Horizon's own height at the point (bands, the Throat
 * buttress, the Stillwater sill), before the shore, the Notch and the named water. Returns `horizon` outside v2's reach.
 *  - v2's land (its ground at or above its sea, −0.45 native) inside the grid: v2's ground + 54 (south of the summit line v2 wins;
 *    north of it the higher of the two, so the Throat's buttress, collar and the skylight saddle keep their rock);
 *  - v2's harbour island (native z > −48, r ≤ 84): the Foot terrace, the island's own terrace level + lawn hump (+54);
 *  - v2's sea inside its grid and the 40 m round v2's land and the island: an apron from the Foot level (53.95) at v2's shoreline
 *    to the Horizon's height FEATHER m out (the Horizon's ground stands wherever v2 has no land, so the seam at the footprint's
 *    edge is the Horizon's own). North of the summit line the higher of the two wins here too.
 * The lake and the Notch are applied after this rule (applyWaters, notchHeight), so Stillwater wins where it meets the Foot terrace.
 */
export const MOUNTAIN_V2_FOOT = MOUNTAIN_V2_ISLAND.level + O.y;
export const MOUNTAIN_V2_APRON = 40;
const MASSIF_Z = -48, SUMMIT_Z = -294;
/**
 * The Foot plain (Horizon plan): south of v2's harbour island, between the lake terrace and the Terraces, the Shoulder's south-east
 * rim (60–97, outside the footprint) stood between the Foot and the Green; its routes are retired with the Shoulder sweep and the
 * Lakeside zig-zag (D-M5), and it hid Mountain v2's face from the square (page A, D-M10). The Foot terrace holds its level over it
 * to the terrace's south edge (z 905, the Stillwater terrace's own edge), then the apron falls to the Green. Horizon-drawn.
 */
export const MOUNTAIN_V2_FOOT_PLAIN: readonly (readonly [number, number])[] = [[1245, 838], [1330, 846], [1395, 850], [1415, 875], [1400, 905], [1250, 905], [1238, 880]];
function inPolygon(poly: readonly (readonly [number, number])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; }
  return inside;
}
function polygonGap(poly: readonly (readonly [number, number])[], x: number, z: number): number {
  if (inPolygon(poly, x, z)) return 0;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!, dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)); }
  return d;
}
let landDistance: Float32Array | undefined;
/** Chamfer distance (native m) from every grid cell to v2's nearest land cell (massif only; the island is analytic). */
function landDistanceField(g: V2Grid): Float32Array {
  if (landDistance) return landDistance;
  const { cols, rows, data } = g, d = new Float32Array(cols * rows), D = Math.SQRT2 * g.step, S = g.step;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c, nz = g.minZ + r * g.step; d[i] = nz <= MASSIF_Z && data[i]! >= MOUNTAIN_V2_ISLAND.sea ? 0 : 1e9; }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c; let v = d[i]!;
    if (c > 0) v = Math.min(v, d[i - 1]! + S); if (r > 0) { v = Math.min(v, d[i - cols]! + S); if (c > 0) v = Math.min(v, d[i - cols - 1]! + D); if (c < cols - 1) v = Math.min(v, d[i - cols + 1]! + D); } d[i] = v; }
  for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) { const i = r * cols + c; let v = d[i]!;
    if (c < cols - 1) v = Math.min(v, d[i + 1]! + S); if (r < rows - 1) { v = Math.min(v, d[i + cols]! + S); if (c < cols - 1) v = Math.min(v, d[i + cols + 1]! + D); if (c > 0) v = Math.min(v, d[i + cols - 1]! + D); } d[i] = v; }
  return landDistance = d;
}
const smooth01 = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
/** Which rule holds at a Horizon point, and v2's own height there when it is v2's (for probes, tests and T2's seam). */
export function mountainV2Rule(hx: number, hz: number): { kind: 'outside' | 'land' | 'island' | 'foot' | 'apron'; v2: number | null; apronWeight: number; north: boolean } {
  const g = mountainV2Grid(), nx = hx - O.x, nz = hz - O.z, north = nz < SUMMIT_Z;
  if (!g) return { kind: 'outside', v2: null, apronWeight: 1, north };
  const inGrid = nx >= g.minX && nz >= g.minZ && nx <= g.minX + (g.cols - 1) * g.step && nz <= g.minZ + (g.rows - 1) * g.step, r = Math.hypot(nx, nz);
  if (nz > MASSIF_Z && r <= MOUNTAIN_V2_ISLAND.radius) {
    // Where v2's grid reaches the island (native z −48…−30) its ground carries v2's benches there (the road foot's embankment).
    const own = v2IslandHeight(nx, nz), v2 = inGrid ? Math.max(sampleV2Grid(g, nx, nz), own - .03) : own;
    return { kind: 'island', v2: v2 + O.y, apronWeight: 0, north };
  }
  // The Foot plain: the Foot terrace's level, drawn by the Horizon (not v2's).
  const plain = polygonGap(MOUNTAIN_V2_FOOT_PLAIN, hx, hz);
  if (plain === 0) return { kind: 'foot', v2: MOUNTAIN_V2_FOOT, apronWeight: 0, north };
  // Distance to the island (analytic, only near its own half: native z > −48), the Foot plain and v2's massif land (the grid's field).
  let distance = Math.min(plain, nz > MASSIF_Z - MOUNTAIN_V2_APRON ? Math.max(0, r - MOUNTAIN_V2_ISLAND.radius) : Infinity);
  if (inGrid) {
    const v = sampleV2Grid(g, nx, nz);
    if (nz <= MASSIF_Z && v >= MOUNTAIN_V2_ISLAND.sea) return { kind: 'land', v2: v + O.y, apronWeight: 0, north };
    const f = landDistanceField(g), c = Math.round((nx - g.minX) / g.step), rr = Math.round((nz - g.minZ) / g.step);
    distance = Math.min(distance, f[rr * g.cols + c]!);
  }
  if (!(distance < MOUNTAIN_V2_APRON)) return { kind: 'outside', v2: null, apronWeight: 1, north };
  return { kind: 'apron', v2: null, apronWeight: smooth01(distance / MOUNTAIN_V2_APRON), north };
}
/** The ground rule applied: v2's ground, the Foot terrace or the apron, over the Horizon's own `horizon` height. */
export function mountainV2Height(hx: number, hz: number, horizon: number): number {
  if (hx < 1108 - MOUNTAIN_V2_APRON - 90 || hx > 1508 + MOUNTAIN_V2_APRON + 90 || hz < 368 - MOUNTAIN_V2_APRON || hz > 905 + MOUNTAIN_V2_APRON + 10) return horizon;
  const rule = mountainV2Rule(hx, hz);
  if (rule.kind === 'outside') return horizon;
  const own = rule.kind === 'apron' ? MOUNTAIN_V2_FOOT + (horizon - MOUNTAIN_V2_FOOT) * rule.apronWeight : rule.v2!;
  return rule.north ? Math.max(own, horizon) : own;
}
