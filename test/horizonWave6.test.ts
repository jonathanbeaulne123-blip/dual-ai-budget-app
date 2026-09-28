// Stage A Wave 6 (candidate 4 browser findings): the body blockers each fix must clear on the committed bake, both tiers.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { createHorizonGeography } from '../src/harbour/horizon/runtime/geography';
import { walkPlan, type HorizonPathGraph } from '../src/harbour/horizon/world/pathGraph';

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

/** The runtime body along given points (no planner): the same 0.2 eu steps, 0.48 lip, 40°, 0.3 radius, dry rule. */
function lineWalk(points: readonly Point3[], tier: 'full' | 'lite' = 'full'): { reached: boolean; blockedAt: number[] | null; by: string | null } {
  const { geo } = baked(tier), p0 = points[0]!; let y = geo.surface(p0[0], p0[2], p0[1] + 1, 3)?.y ?? p0[1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, c = points[i]!, n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[2] - a[2]) / .2));
    for (let k = 1; k <= n; k++) {
      const x = a[0] + (c[0] - a[0]) * k / n, z = a[2] + (c[2] - a[2]) * k / n, hit = geo.surface(x, z, y, .48);
      const blocker = hit ? geo.blocker(x, z, Math.max(y, hit.y), .3, [(c[0] - a[0]) / n, (c[2] - a[2]) / n]) : null;
      if (!hit || blocker || hit.slope > 40 || geo.submerged(x, z, hit.y)) return { reached: false, blockedAt: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)], by: blocker ?? (hit ? `slope ${hit.slope.toFixed(1)}` : 'no surface') };
      y = hit.y;
    }
  }
  return { reached: true, blockedAt: null, by: null };
}
const bed = (id: string) => baked().world.collision.beds.find(b => b.id === id)!;
const solidsNear = (prefix: string, x: number, z: number, r: number) => baked().world.geometry.solids.filter(s => s.id.startsWith(prefix)).flatMap(s => { const out: number[][] = []; for (let i = 0; i < s.indices.length; i += 3) { const t = [0, 1, 2].map(k => s.indices[i + k]! * 3), cx = t.reduce((m, j) => m + s.positions[j]!, 0) / 3, cz = t.reduce((m, j) => m + s.positions[j + 2]!, 0) / 3; if (Math.hypot(cx - x, cz - z) < r) out.push(t.map(j => s.positions[j + 1]!)); } return out; });

describe.each(['full', 'lite'] as const)('Wave 6 body blockers (%s)', tier => {
  it('S2 walks continuously from the Wash onto the Bight Bridge deck and on to the east descent: the kerb rail opens where S2 crosses it (was a post at [469.2,12,1025.6])', () => {
    const s2 = bed('S2').points as Point3[];
    expect(lineWalk(s2.slice(88, 193), tier)).toEqual({ reached: true, blockedAt: null, by: null });
    expect(solidsNear('bightBridge.kerbRails', 469.2, 1025.6, 1.5)).toHaveLength(0);
  });
  it('the square walk reaches the upper street step-free: the gondola base slab no longer overhangs it (lite stopped under it at [1485.3,16.5,1086.5])', () => {
    expect(bodyWalk([1455, 12, 1175], [1480, 18, 1062], true, tier)).toMatchObject({ reached: true, blockedAt: null });
    const { geo, world } = baked(tier), slab = world.geometry.solids.filter(s => s.id.startsWith('platform.gondolaBase.slab')), xs = slab.flatMap(s => s.positions.filter((_, i) => i % 3 === 0));
    expect(Math.max(...xs)).toBeCloseTo(1483.41, 1);
    // Every point of the square walk under the slab's old footprint (x 1475–1485, z 1086–1094) has body height + 0.3 of clear headroom or none of the slab over it.
    for (const p of bed('walk square').points) { if (p[0] < 1475 || p[0] > 1487 || p[2] < 1084 || p[2] > 1096) continue; const stand = geo.surface(p[0], p[2], p[1] + .5, .6)!.y, over = geo.ceiling(p[0], p[2], stand); expect(over - stand, `headroom at [${p[0].toFixed(1)},${p[2].toFixed(1)}]`).toBeGreaterThanOrEqual(1.55); }
  });
  it("page B's pose walks off the lamp-gallery landing onto its ramp (the ramp's edges crossed the landing at z 1191.3)", () => {
    const ramp = bed('lampGallery.ramp').points as Point3[];
    expect(ramp.at(-1)!.map(v => +v.toFixed(3))).toEqual([540, 25, 1190]);
    expect(lineWalk([[540, 25, 1195], ...ramp.slice(-12).reverse()], tier)).toEqual({ reached: true, blockedAt: null, by: null });
  });
  it("page A's pose steps onto the home approach from the square: a walkable batter, not a retaining wall (was host.home.approach.retaining at [1470.5,12,1184.9])", () => {
    expect(solidsNear('host.home.approach.retaining', 1470.5, 1184.9, 2)).toHaveLength(0);
    expect(bodyWalk([1470, 12, 1186], [1490, 14, 1165], true, tier)).toMatchObject({ reached: true, blockedAt: null });
    expect(lineWalk([[1470, 12, 1186], [1470.5, 12, 1182], [1476, 12, 1181]], tier)).toEqual({ reached: true, blockedAt: null, by: null });
  });
});
describe('Wave 6 floor slabs as ground beside a bed edge', () => {
  it("reads a slab's top faces, not its box: the rotated bight.1 lay-by does not cancel the service drive's rail or VBS's wall beside it (P09 +4 m on the first cut)", () => {
    // Candidate 6 (v2.3, W7-A): plot bight.1 moved 1.0 m and its service drive meets the June lane at grade, so the drop the
    // drive's rail guarded at [867.5,944.7] is gone (P09 lists neither plot.bight.1.service nor VBS on candidate 6). The
    // slab rule still leaves both beds' own guards standing beside the lay-by: the drive's kerb and VBS's retaining wall.
    expect(solidsNear('plot.bight.1.service.edges', 867.5, 944.7, 2)).toHaveLength(0);
    expect(solidsNear('plot.bight.1.service.kerbs', 867.5, 944.7, 30).length).toBeGreaterThan(0);
    expect(solidsNear('VBS.retaining', 864.3, 952.4, 2)).toHaveLength(0); expect(solidsNear('VBS.retaining', 864.3, 952.4, 20).length).toBeGreaterThan(0);
  });
});
