// Stage A wave 4 (review 2): the numbers each fix must hold on the committed bake.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { createHorizonGeography } from '../src/harbour/horizon/runtime/geography';
import { walkPlan, type HorizonPathGraph } from '../src/harbour/horizon/world/pathGraph';
import { mountainV2Rule } from '../src/harbour/horizon/land/mountainV2/ground';

type Point3 = [number, number, number];
type World = { collision: Omit<LandCuts, 'solids' | 'diagnostics'>; geometry: { solids: StructureSolid[] }; pathGraph: HorizonPathGraph; diagnostics: { id: string; severity: string }[]; views: { id: string; eye: Point3; target: Point3; proof: { passLandscape: boolean; passPortrait: boolean; landscape: { grid: [number, number]; minPixels: number }; subjects: { id: string; pixels: number; portraitPixels: number | null }[] } }[] };
type Baked = { world: World; field: TerrainField; geo: ReturnType<typeof createHorizonGeography> };
const cache: Partial<Record<'full' | 'lite', Baked>> = {};
let worldCache: World | undefined;
const baked = (tier: 'full' | 'lite' = 'full'): Baked => {
  if (cache[tier]) return cache[tier]!;
  const world = worldCache ??= JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as World, bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), tier);
  const geo = createHorizonGeography(field, { ...world.collision, solids: world.geometry.solids, diagnostics: [] } as LandCuts);
  return cache[tier] = { world, field, geo };
};
/** The runtime body along a planned route: 0.2 eu steps, a surface within the 0.48 step, ≤ 40°, no blocker, dry. */
function bodyWalk(from: Point3, to: Point3, stepFree = true, tier: 'full' | 'lite' = 'full'): { planned: boolean; reached: boolean; blockedAt: number[] | null; length: number } {
  const { world, geo } = baked(tier), plan = walkPlan(world.pathGraph, from, to, { stepFree });
  if (!plan) return { planned: false, reached: false, blockedAt: null, length: 0 };
  const p0 = plan.points[0]!; let y = geo.surface(p0[0], p0[2], p0[1] + 1, 3)?.y ?? p0[1], end: Point3 = [p0[0], p0[1], p0[2]];
  for (let i = 1; i < plan.points.length; i++) {
    const a = plan.points[i - 1]!, c = plan.points[i]!, n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[2] - a[2]) / .2));
    for (let k = 1; k <= n; k++) {
      const x = a[0] + (c[0] - a[0]) * k / n, z = a[2] + (c[2] - a[2]) * k / n, hit = geo.surface(x, z, y, .48);
      const blocker = hit ? geo.blocker(x, z, Math.max(y, hit.y), .3, [(c[0] - a[0]) / n, (c[2] - a[2]) / n]) : null;
      if (!hit || blocker || hit.slope > 40 || geo.submerged(x, z, hit.y)) return { planned: true, reached: false, blockedAt: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)], length: plan.length };
      y = hit.y; end = [x, y, z];
    }
  }
  return { planned: true, reached: Math.hypot(end[0] - to[0], end[2] - to[2]) < 3, blockedAt: null, length: plan.length };
}

// v2.6 (D-M4): Crown Road and its Shoulder Tunnel are retired (MANIFEST retired_v2_6); the Mountain Road (V03) passes under the
// Shoulder remnant east of the Foot in the Mountain Road Tunnel. R2-03's rule (the road and its January footway walk through a
// portal both ways, on both tiers, on a continuous surface) now holds there.
describe('R2-03 (v2.6) the Mountain Road through its tunnel', () => {
  it('walks V03 both ways and the Year Walk January footway through the tunnel', () => {
    const up = bodyWalk([1599.5, 35, 790.8], [1281.5, 55.3, 742]), down = bodyWalk([1281.5, 55.3, 742], [1599.5, 35, 790.8]);
    expect(up).toMatchObject({ reached: true, blockedAt: null }); expect(down).toMatchObject({ reached: true, blockedAt: null });
    expect(up.length).toBeLessThan(400);
    expect(bodyWalk([1490, 44, 796.5], [1395, 52.5, 795.5])).toMatchObject({ reached: true, blockedAt: null });
    expect(bodyWalk([1395, 52.5, 795.5], [1490, 44, 796.5])).toMatchObject({ reached: true, blockedAt: null });
  });
  it('walks the same tunnel on the phone tier', () => {
    expect(bodyWalk([1599.5, 35, 790.8], [1281.5, 55.3, 742], true, 'lite')).toMatchObject({ reached: true, blockedAt: null });
    expect(bodyWalk([1281.5, 55.3, 742], [1599.5, 35, 790.8], true, 'lite')).toMatchObject({ reached: true, blockedAt: null });
  });
  it('keeps the road surface continuous through both portals: every 0.25 eu the surface rises ≤ 0.48 and stays ≤ 40°', () => {
    const { geo, world } = baked(), v03 = world.collision.beds.find(b => b.id === 'V03')!;
    const zAt = (x: number) => { let best = v03.points[0]!; for (const p of v03.points) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; return best; };
    for (const [x0, x1] of [[1500, 1455], [1425, 1380]] as const) {
      const start = zAt(x0); let y = geo.surface(x0, start[2], start[1] + 2, 4)!.y;
      for (let x = x0 - .25; x >= x1; x -= .25) { const z = zAt(x)[2], hit = geo.surface(x, z, y, .48); expect(hit, `surface at [${x},${z}]`).not.toBeNull(); expect(hit!.slope, `slope at [${x},${z}]`).toBeLessThanOrEqual(40); y = hit!.y; }
    }
  });
});

describe('R2-08 the summit L02 on foot', () => {
  it('walks the runtime body from the square to the Foot on the Mountain Road and from the summit station to L02 (D-M4, D-M6)', () => {
    // v2.6: the square → the Foot on V03 is the Horizon's walk; the climb from the road foot is Mountain v2's road with its gorge
    // bridges, whose decks the region answers (T2's geography): that stretch is proved by the region's tests, not here.
    const foot = bodyWalk([1455, 12, 1175], [1281.5, 55.3, 742]);
    expect(foot).toMatchObject({ planned: true, reached: true, blockedAt: null }); expect(foot.length).toBeLessThan(1000);
    // The gondola's Summit Commons platform (v2's) to L02: a short step-free walk.
    const station = bodyWalk([1298.3, 158.05, 481.7], [1310, 158, 470]);
    expect(station).toMatchObject({ reached: true, blockedAt: null }); expect(station.length).toBeLessThan(40);
  });
  it('keeps the launch stair off the Crown walk and joins the Year Walk lanes', () => {
    const { world } = baked(), lanes = world.pathGraph.edges.filter(e => e.id.startsWith('lane:'));
    expect(lanes.length).toBeGreaterThan(0);
    const blocked = (world.pathGraph.blocked ?? []).filter(b => b.bedId === 'walk crown');
    expect(blocked.filter(b => /crownLaunch/.test(b.solid))).toEqual([]);
  });
});

describe('R2-53 / R2-108 the Deep is closed to the island; L01 is carried, not floating over the gallery stair', () => {
  it('ray-casts page G from the jetty: no ray reaches the terrain from below or leaves the rock outside the Throat', async () => {
    const { world, field } = baked(), { createRayCaster } = await import('../src/harbour/horizon/world/raycast');
    const ray = createRayCaster(field, { ...world.collision, solids: world.geometry.solids } as unknown as LandCuts), g = world.views.find(v => v.id === 'G')!;
    let f = g.target.map((t, i) => t - g.eye[i]!) as Point3; const fl = Math.hypot(...f); f = f.map(a => a / fl) as Point3;
    const hz = Math.hypot(f[0], f[2]), r: Point3 = [-f[2] / hz, 0, f[0] / hz], u: Point3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const vt = Math.tan(2 * Math.atan(Math.tan(55 * Math.PI / 360) / (16 / 9)) / 2), ht = vt * 1.6; let terrain = 0, outside = 0, total = 0;
    for (let j = 0; j < 45; j++) for (let i = 0; i < 72; i++) {
      const nx = (i + .5) / 72 * 2 - 1, ny = 1 - (j + .5) / 45 * 2; let d = [0, 1, 2].map(k => f[k]! + r[k]! * nx * ht + u[k]! * ny * vt) as Point3; const dl = Math.hypot(...d); d = d.map(a => a / dl) as Point3;
      const hit = ray.first(g.eye, d, 2600, { underground: true }); total++;
      if (hit.kind === 'terrain') terrain++;
      // Nothing of the island's surface (roads, walks) is seen from the Deep (V01 and the Year Walk were, 165 eu away).
      if (hit.kind === 'solid' && !/^(underground|deep|throat|oreTunnel|seaPassage|ORE|DEEP_RUN|jetty\.deep|threshold\.deepJetty)/.test(hit.sourceId)) outside++;
    }
    expect(total).toBe(3240); expect(terrain).toBe(0); expect(outside).toBe(0);
    expect(world.geometry.solids.find(s => s.id.startsWith('underground.deep.headwall'))!.positions.length / 24).toBe(8);
  });
  it('carries L01 on Mountain v2\'s glass dam crest: its bay is the floor there and no L01 pad floats (v2.6, D-M3)', () => {
    // v2.5 stood L01 over the dam gallery's top flight; the dam, its gallery and their supports are retired with the dam.
    const { world, geo } = baked();
    expect(geo.surface(1316, 539.2, 142.1, .3)!.id).toMatch(/^place\.L01\.deck/);
    expect(world.diagnostics.filter(d => d.id.startsWith('structures.padFloating.place.L01'))).toEqual([]);
    expect(world.geometry.solids.some(s => s.id.startsWith('damGallery.'))).toBe(false);
  });
});

describe('R2-25 / R2-21 cut-edge spikes are capped on the detailed tiers', () => {
  it('caps a single-vertex spike on a synthetic lattice to its highest neighbour + SPIKE_KEEP and leaves a smooth hill alone', async () => {
    const { despikeTerrain, SPIKE_KEEP } = await import('../src/harbour/horizon/land/terrain/index');
    const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 5, columns: 401, rows: 361, heights: new Float32Array(401 * 361), surfaces: new Uint8Array(401 * 361) };
    // A smooth dome on the island (≤ 0.4 eu between neighbours) and one 6 eu spike beside a cut at [1460,345].
    for (let j = 0; j < 361; j++) for (let i = 0; i < 401; i++) field.heights[j * 401 + i] = 60 - Math.hypot(i * 5 - 1300, j * 5 - 800) * .08;
    const n = (345 / 5) * 401 + 1460 / 5, before = field.heights[n]!; field.heights[n] = before + 6;
    const dome = (800 / 5) * 401 + 1300 / 5, top = field.heights[dome]!;
    expect(despikeTerrain(field)).toBe(1);
    expect(field.heights[n]!).toBeCloseTo(Math.max(field.heights[n - 1]!, field.heights[n + 1]!, field.heights[n - 401]!, field.heights[n + 401]!, field.heights[n - 402]!, field.heights[n - 400]!, field.heights[n + 400]!, field.heights[n + 402]!) + SPIKE_KEEP, 4);
    expect(field.heights[dome]).toBe(top);
  });
  it('leaves one land vertex of the baked full tier more than 1 eu above all eight neighbours, the one carrying beds (was 48 spikes > 0.3, max 5.85 at [1460,345])', () => {
    const { field } = baked(), { columns: C, rows: R, step, heights: H } = field; let max = 0, spikes = 0; const over: number[][] = [];
    for (let j = 1; j < R - 1; j++) for (let i = 1; i < C - 1; i++) {
      const n = j * C + i; let top = -Infinity; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj) top = Math.max(top, H[n + dj * C + di]!);
      if (H[n]! <= .1) continue; const rise = H[n]! - top; if (rise > .3 && mountainV2Rule(i * step, j * step).kind !== 'land') spikes++; if (rise > 1) over.push([i * step, j * step]); else if (mountainV2Rule(i * step, j * step).kind !== 'land') max = Math.max(max, rise);
    }
    // W5-A: [910,885] (VBS and walk bight 4.5 m from the Year Walk) is now on the VBS trestle's open span (D-C9): no fill cliff.
    // Candidate 4: [660,1155] (11.35, 1.42 over its neighbours) is the east headland's lattice edge under the Bight Bridge's
    // east deck end, raised by the Year Walk's approach blend off the deck (open item, W5-T terrain: no earth under the deck).
    // v2.6 (D-M1): on Mountain v2's own land the lattice samples v2's authored ground (its abutments, benches and rocks), which the
    // de-spiker leaves alone and the region draws exactly: counted apart.
    const v2 = over.filter(p => mountainV2Rule(p[0]!, p[1]!).kind === 'land');
    expect(over.filter(p => !v2.includes(p))).toEqual([[660, 1155]]); expect(max).toBeLessThanOrEqual(1.005); expect(spikes).toBeLessThanOrEqual(31);
  });
  it('never takes the fill from under a bed: the runway south end keeps its ground (a first cut left 12.6 eu under it)', async () => {
    const { sampleTerrain } = await import('../src/harbour/horizon/land/terrain/index'), { field } = baked();
    expect(sampleTerrain(field, 445, 860)).toBeGreaterThan(37.5); expect(sampleTerrain(field, 445, 861)).toBeGreaterThan(35);
  });
});

describe('R2-74 / R2-14 the baked view proof measures the acceptance frames', () => {
  it('renders 1440 × 900 (144 × 90, runtime lens) and 390 × 844 (60 × 130), legible at ≥ 1 ‰ and under 60 % fog', async () => {
    const { VIEW_GRID, LEGIBLE_PERMILLE, FOG_LEGIBLE } = await import('../src/harbour/horizon/world/views');
    expect(VIEW_GRID).toEqual({ landscape: [144, 90], portrait: [60, 130] }); expect(LEGIBLE_PERMILLE).toBe(1); expect(FOG_LEGIBLE).toBe(.6);
    const { world } = baked();
    for (const v of world.views) { expect(v.proof.landscape.grid).toEqual([144, 90]); expect(v.proof.landscape.minPixels).toBe(13); }
  });
  it('claims only what the frames hold: 12/12 at 1440 × 900 and 8/12 on the phone (Stage A candidate 4; review 2 measured 6/12 and 7/12)', () => {
    const { world } = baked(), pass = (k: 'passLandscape' | 'passPortrait') => world.views.filter(v => v.proof[k]).map(v => v.id).join('');
    // Candidate 4 (integrator 3): A (the bank 6 m narrower: the Shoulder 33 px), D (the Lamp deferred to Pass 2b, v2.1), H (the
    // airstrip's open rail: the west sea 78 px) and I (W5-T's spring + D-C5) join at 1440 × 900; H's portrait eye moved (v2.1).
    // Candidate 6 (integrator 4): the honest proof (W7-T, R3-74) failed G and H on candidate 5 (0 px: the shaft is not visible
    // from the jetty; H's 78 px were the sea beyond the grid). v2.4 re-poses them: G under the shaft 70 / 42 px (D-D7), H an
    // aerial eye over the strip, the in-map west sea 350 / 94 px — the claim is true again, on the honest measure.
    // v2.6 (D-M3/D-M10): the dam's glass face is retired; A's portrait holds the High Span alone and passes (9/12 on the phone).
    expect(pass('passLandscape')).toBe('ABCDEFGHIJKL'); expect(pass('passPortrait')).toBe('ABEFGHIJK');
    const px = (page: string, subject: string) => world.views.find(v => v.id === page)!.proof.subjects.find(s => s.id === subject)!;
    expect(px('K', 'the Glasshouse').pixels).toBeGreaterThan(13); expect(px('A', 'the Shoulder').pixels).toBeGreaterThanOrEqual(13);
    expect(px('I', 'the spring').pixels).toBeGreaterThanOrEqual(13); expect(px('I', 'the spring').portraitPixels).toBeGreaterThanOrEqual(8); expect(px('I', 'the Reach water').pixels).toBeGreaterThan(1000);
    expect(px('H', 'the west sea').pixels).toBeGreaterThanOrEqual(13); expect(px('H', 'the west sea').portraitPixels).toBeGreaterThanOrEqual(8);
    // Where the phone frame still fails a subject (final4/BEFORE-AFTER.md lists each blocker):
    expect(world.views.find(v => v.id === 'A')!.proof.subjects.map(q => q.id)).not.toContain("the dam's glass face"); expect(px('C', 'the skate shelf').portraitPixels).toBeLessThan(8);
    expect(px('D', 'surf').portraitPixels).toBeLessThan(8); expect(px('L', 'the Boathouse').portraitPixels).toBeLessThan(8);
    expect(world.views.find(v => v.id === 'D')!.proof.subjects.map(q => q.id)).not.toContain('the Lamp');
  });
});

// Stage A wave 5 (integrator 3): the seams between W5-A (beds), W5-S (structures) and W5-T (terrain), on candidate 4.
describe('Wave 5 seams on the committed bake (integrator 3)', () => {
  type Diag = { id: string; severity: string; measured?: number; at?: number[] };
  type Proof = { id: string; separation: number; built: boolean; heightA: number; heightB: number };
  const extra = () => baked().world as unknown as { diagnostics: Diag[]; crossingProofs: Proof[]; journeyMeasurements: { id: string; pass: boolean }[] };
  const solid = (id: string) => baked().world.geometry.solids.find(s => s.id === id || s.id.startsWith(`${id}@`));
  it('keeps G1\'s towers to the region (their footings only), retires the portage and opens the ferry channel', () => {
    const w = extra();
    // v2.6 (D-M6): Mountain v2 draws its gondola's towers; the Horizon keeps their footings. D-M3: the dam portage is retired.
    expect(solid('G1.towers.bracing')).toBeUndefined(); expect(solid('G1.towers.footings')?.indices.length).toBeGreaterThan(0);
    expect(w.crossingProofs.some(p => p.id.startsWith('cross.s1.damPortage'))).toBe(false);
    // v2.1: 40 m opening at s 103-143, the 8 m hull clears every pier and bent footing (was −3.99 at 36 m).
    const hull = w.diagnostics.find(d => d.id === 'structures.bightBridge.ferryHull')!; expect(hull.severity).toBe('info'); expect(hull.measured!).toBeGreaterThan(1.3);
    expect(w.journeyMeasurements.every(j => j.pass)).toBe(true);
  });
  it('carries S2 over the road inside its flyover rails and onto ground at the east abutment', () => {
    const { world, field } = baked(), beds = world.collision.beds, s2 = beds.find(b => b.id === 'S2')!, fly = beds.find(b => b.id === 'structure.bightBridge.s2Flyover')!;
    expect(fly.width).toBe(s2.width);
    const near = (p: readonly number[], line: readonly (readonly number[])[]) => Math.min(...line.slice(1).map((b, i) => { const a = line[i]!, dx = b[0]! - a[0]!, dz = b[2]! - a[2]!, t = Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[2]! - a[2]!) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p[0]! - a[0]! - t * dx, p[2]! - a[2]! - t * dz); }));
    const onFly = s2.points.filter(p => Math.abs(p[1] - 17.6) < .01); expect(onFly.length).toBeGreaterThan(4);
    for (const p of onFly) expect(near(p, fly.points)).toBeLessThan(.5);
    expect(extra().diagnostics.some(d => d.id === 'bed.S2.overWater')).toBe(false);
    const g = (x: number, z: number) => field.heights[Math.round(z / field.step) * field.columns + Math.round(x / field.step)]!;
    expect(g(660, 1180)).toBeGreaterThan(9);
  });
  it('guards the airstrip with an open posted rail (page H sees the west sea over it) and holds the page proofs', () => {
    const rails = baked().world.geometry.solids.filter(s => s.id.startsWith('strip.edges')); expect(rails.length).toBeGreaterThan(0); let solidParapet = 0;
    for (const { positions: p } of rails) for (let o = 0; o + 24 <= p.length; o += 24) { let lo = Infinity, hi = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = o; i < o + 24; i += 3) { lo = Math.min(lo, p[i + 1]!); hi = Math.max(hi, p[i + 1]!); x0 = Math.min(x0, p[i]!); x1 = Math.max(x1, p[i]!); z0 = Math.min(z0, p[i + 2]!); z1 = Math.max(z1, p[i + 2]!); } if (hi - lo > .5 && Math.min(x1 - x0, z1 - z0) > .3 && Math.max(x1 - x0, z1 - z0) > 1) solidParapet++; }
    expect(solidParapet).toBe(0);
    const H = baked().world.views.find(v => v.id === 'H')!.proof.subjects.find(s => s.id === 'the west sea')!; expect(H.pixels).toBeGreaterThanOrEqual(13);   // candidate 6: 350 (in-map sea only, v2.4 aerial eye)
    expect(H.pixels).toBe(350);
  });
});
