// Stage A wave 4 (review 2): the numbers each fix must hold on the committed bake.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { createHorizonGeography } from '../src/harbour/horizon/runtime/geography';
import { walkPlan, type HorizonPathGraph } from '../src/harbour/horizon/world/pathGraph';

type Point3 = [number, number, number];
type World = { collision: Omit<LandCuts, 'solids' | 'diagnostics'>; geometry: { solids: StructureSolid[] }; pathGraph: HorizonPathGraph; diagnostics: { id: string; severity: string }[]; views: { id: string; eye: Point3; target: Point3; proof: { passLandscape: boolean; passPortrait: boolean; landscape: { grid: [number, number]; minPixels: number }; subjects: { id: string; pixels: number; portraitPixels: number | null }[] } }[] };
let cache: { world: World; field: TerrainField; geo: ReturnType<typeof createHorizonGeography> } | undefined;
const baked = () => {
  if (cache) return cache;
  const world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as World, bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full');
  const geo = createHorizonGeography(field, { ...world.collision, solids: world.geometry.solids, diagnostics: [] } as LandCuts);
  return cache = { world, field, geo };
};
/** The runtime body along a planned route: 0.2 eu steps, a surface within the 0.48 step, ≤ 40°, no blocker, dry. */
function bodyWalk(from: Point3, to: Point3, stepFree = true): { planned: boolean; reached: boolean; blockedAt: number[] | null; length: number } {
  const { world, geo } = baked(), plan = walkPlan(world.pathGraph, from, to, { stepFree });
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

describe('R2-03 Crown Road through the Shoulder Tunnel north portal', () => {
  it('walks V02 both ways and the Year Walk January footway both ways through the portal (was 75.96 → 81.24 across the road)', () => {
    const up = bodyWalk([1433.3, 70, 335.6], [1370, 110, 690]), down = bodyWalk([1370, 110, 690], [1433.3, 70, 335.6]);
    expect(up).toMatchObject({ reached: true, blockedAt: null }); expect(down).toMatchObject({ reached: true, blockedAt: null });
    expect(up.length).toBeCloseTo(373.7, 0);
    expect(bodyWalk([1449.5, 74.9, 405], [1450.1, 75.5, 430])).toMatchObject({ reached: true, blockedAt: null });
    expect(bodyWalk([1450.1, 75.5, 430], [1449.5, 74.9, 405])).toMatchObject({ reached: true, blockedAt: null });
  });
  it('keeps the road surface continuous across the portal: every 0.25 eu the surface rises ≤ 0.48 and stays ≤ 40°', () => {
    const { geo } = baked();
    for (const x of [1444.1, 1450.5]) {
      let y = geo.surface(x, 405, 80, 10)!.y;
      for (let z = 405.25; z <= 432; z += .25) { const hit = geo.surface(x, z, y, .48); expect(hit, `surface at [${x},${z}]`).not.toBeNull(); expect(hit!.slope, `slope at [${x},${z}]`).toBeLessThanOrEqual(40); y = hit!.y; }
    }
  });
});

describe('R2-08 the summit L02 on foot', () => {
  it('walks the runtime body from the square to L02 without the gondola (Crown Road, the turning circle, walk crown) and from the top station', () => {
    const square = bodyWalk([1455, 12, 1175], [1310, 158, 470]);
    expect(square).toMatchObject({ planned: true, reached: true, blockedAt: null }); expect(square.length).toBeLessThan(2900);
    expect(bodyWalk([1370, 110, 690], [1310, 158, 470])).toMatchObject({ reached: true, blockedAt: null });
    // The gondola's top station (RESERVED height 112) to L02: the walk no longer meets 52° ground at [1370,569].
    const station = bodyWalk([1360, 112, 560], [1310, 158, 470]);
    expect(station).toMatchObject({ reached: true, blockedAt: null }); expect(station.length).toBeCloseTo(412.5, 0);
  });
  it('joins the Crown walk to the Year Walk lane it shares at the turning circle, and keeps the launch stair off the walk', () => {
    const { world } = baked(), lanes = world.pathGraph.edges.filter(e => e.id.startsWith('lane:'));
    expect(lanes.length).toBeGreaterThan(0);
    expect((world.pathGraph.blocked ?? []).filter(b => b.bedId === 'walk crown').map(b => b.solid)).toEqual([]);
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
  it('leaves the top flight open under L01 (was 0.9 eu of headroom under the slab) and reports no floating L01 pad', () => {
    const { world, geo } = baked();
    for (const z of [911.5, 913.5, 915.5]) { const tread = geo.surface(1170.6, z, 52.1, 3)!; expect(tread.id).toMatch(/^damGallery\.flight\.2\.treads/); expect(geo.ceiling(1170.6, z, tread.y)).toBe(Infinity); }
    expect(geo.surface(1174, 913, 52.1, .3)!.id).toMatch(/^place\.L01\.slab/);
    expect(world.diagnostics.filter(d => d.id.startsWith('structures.padFloating.place.L01'))).toEqual([]);
    expect(world.geometry.solids.some(s => s.id.startsWith('place.L01.supports'))).toBe(true);
  });
});

