// The Water's Way · PR 2 land integration: ONE open rail (land/structures/openRail.ts) and ONE sight rule (world/raycast.ts
// isOpenRail), proved on the merged bake. Every open rail the four land builders drew — the Reach (boardwalk, meeting bays,
// footbridge, High Span Overlook, Notch Bluff, Sunset Rail), the Greenway (deck, bridges and its places), the Long Sands pier,
// the Bight lookout — stops a walker pushed into it midway between two posts (runtime walkSim on the bake's geography).
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { StructureSolid } from '../src/harbour/horizon/land/interfaces.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain/index.ts';
import { solid } from '../src/harbour/horizon/land/structures/mesh.ts';
import { BODY_GUARD_BAND, isOpenRail, OPEN_RAIL, OPEN_RAIL_KIND, openRail, railBarLevels } from '../src/harbour/horizon/land/structures/openRail.ts';
import { isOpenRail as rayIsOpenRail } from '../src/harbour/horizon/world/raycast.ts';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest.ts';
import { parseHorizonDefinition } from '../src/house/world/horizonAssets.ts';
import { createHorizonGeography, HORIZON_WALKABLE_DEGREES } from '../src/harbour/horizon/runtime/geography.ts';
import { createMountainV2Region, mouthExclusion, terraceBedExclusion } from '../src/harbour/horizon/regions/mountainV2/index.ts';
import { createWalkState, horizonWalkWorld, walkMove, walkTick, WALK_FIXED_DT, type WalkBody } from '../src/harbour/horizon/runtime/walkSim.ts';

describe('one open rail, one sight rule', () => {
  it('is the same isOpenRail for the ray caster and the builder, keyed on the one marker (kind openRail) or a timber road guard', () => {
    expect(rayIsOpenRail).toBe(isOpenRail);
    expect(isOpenRail({ kind: OPEN_RAIL_KIND, surface: 'timber' })).toBe(true);
    expect(isOpenRail({ kind: 'corridorGuard', surface: 'timber' })).toBe(true);
    expect(isOpenRail({ kind: 'handrail', surface: 'timber' })).toBe(false);
  });
  it('always carries a member through the body\'s 0.65 contact band (the band a body meets above the 0.48 step)', () => {
    expect(railBarLevels()).toEqual([BODY_GUARD_BAND]);
    // A style that asks only for a low bar (the 0.2 band: under the step, a body never meets it) still gets the guard bar.
    expect(railBarLevels({ bars: [.2] })).toEqual([.2, BODY_GUARD_BAND]);
    // On a kerb (from 0.35) the style's bars are over the kerb: 0.30 over it is the guard at 0.65 over the line.
    expect(railBarLevels({ from: .35, bars: [.3] }).map(v => Number(v.toFixed(3)))).toEqual([BODY_GUARD_BAND]);
    // Pickets (0.17 → the top rail) stand through every band.
    expect(railBarLevels({ infill: 'pickets' })).toEqual([]);
    // Drawn: posts ≤ 2 m apart, the top rail at 1.05, the guard bar 0.60–0.70.
    const r = solid('t.rail', OPEN_RAIL_KIND, 'timber', 'rail'); openRail(r, [[0, 5, 0], [0, 5, 7]]);
    const ys: number[] = []; for (let i = 1; i < r.positions.length; i += 3) ys.push(r.positions[i]!);
    expect(Math.max(...ys)).toBeCloseTo(5 + OPEN_RAIL.height, 6); expect(ys.some(y => Math.abs(y - 5.7) < 1e-6)).toBe(true); expect(ys.some(y => Math.abs(y - 5.6) < 1e-6)).toBe(true);
  });
});

// ---- the merged bake --------------------------------------------------------------------------------------------------------
type Geo = ReturnType<typeof createHorizonGeography>;
let solids: StructureSolid[] = [], geo: Geo, extent: { w: number; h: number };
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
beforeAll(() => {
  const world = parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))), field = decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')), 'full');
  geo = createHorizonGeography(field, { ...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics ?? [] } as never);
  geo.addDynamic(createMountainV2Region({ walkingJoinSolids: world.geometry.solids, horizonGround: (x, z) => sampleTerrain(field, x, z), yield: terraceBedExclusion(world.collision.beds), exclude: mouthExclusion(world.collision.mouths), terrainStep: field.step }).provider);
  solids = world.geometry.solids.map(q => ({ ...q, id: (q as { sourceId?: string }).sourceId ?? q.id.split('@')[0]! })) as StructureSolid[];
  extent = world.extent;
}, 240_000);

type V2 = [number, number];
interface Probe { mid: V2; n: V2; top: number }
/** Mid-bay probes on a rail: the top rail's top faces (the highest long face over each spot), each moved to the midpoint of the two
 *  posts it spans (posts ≤ 2 m apart, both under the top rail's line). */
function probes(group: StructureSolid[], max = 24): Probe[] {
  const faces: { c: V2; t: V2; y: number }[] = [], posts: V2[] = [];
  for (const s of group) {
    const P = s.positions, I = s.indices;
    for (let k = 0; k < I.length; k += 3) {
      const v = [0, 1, 2].map(m => [P[I[k + m]! * 3]!, P[I[k + m]! * 3 + 1]!, P[I[k + m]! * 3 + 2]!] as const);
      const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2], wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, nl = Math.hypot(nx, ny, nz) || 1; if (ny / nl < .95) continue;
      const edges = [0, 1, 2].map(m => { const a = v[m]!, b = v[(m + 1) % 3]!; return { l: Math.hypot(b[0] - a[0], b[2] - a[2]), t: [b[0] - a[0], b[2] - a[2]] as V2 }; });
      const long = edges.reduce((p, q) => q.l > p.l ? q : p), c: V2 = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3], y = Math.max(v[0][1], v[1][1], v[2][1]);
      if (long.l < .25) posts.push(c); else if (long.l >= .5) faces.push({ c, t: [long.t[0] / long.l, long.t[1] / long.l], y });
    }
  }
  const top = faces.filter(f => !faces.some(g => g !== f && g.y > f.y + .05 && Math.hypot(g.c[0] - f.c[0], g.c[1] - f.c[1]) < .15));
  const out: Probe[] = [], stride = Math.max(1, Math.floor(top.length / max));
  for (let i = 0; i < top.length && out.length < max; i += stride) {
    const f = top[i]!, n: V2 = [-f.t[1], f.t[0]], along = (p: V2) => (p[0] - f.c[0]) * f.t[0] + (p[1] - f.c[1]) * f.t[1], across = (p: V2) => Math.abs((p[0] - f.c[0]) * n[0] + (p[1] - f.c[1]) * n[1]);
    const near = posts.filter(p => across(p) < .2 && Math.abs(along(p)) < 2.2);
    const back = near.filter(p => along(p) <= 0).sort((a, b) => along(b) - along(a))[0], ahead = near.filter(p => along(p) > 0).sort((a, b) => along(a) - along(b))[0];
    if (!back || !ahead || along(ahead) - along(back) > 2.15) continue;
    const mid: V2 = [(back[0] + ahead[0]) / 2, (back[1] + ahead[1]) / 2];
    out.push({ mid, n, top: f.y });
  }
  return out;
}
/** Push a walker from the deck side into the rail at a mid-bay probe for two seconds; returns the deepest it got past the rail's
 *  line (negative = held on the deck side) and the largest drop, or null where no deck stands beside the rail on that side. */
function push(p: Probe, side: 1 | -1): { past: number; drop: number; deck: number } | null {
  const n: V2 = [p.n[0] * side, p.n[1] * side], start: V2 = [p.mid[0] + n[0] * .75, p.mid[1] + n[1] * .75];
  const s = geo.surface(start[0], start[1], p.top - .9, 0); if (!s) return null;
  const rise = p.top - s.y; if (rise < .85 || rise > 1.25) return null;
  if (geo.contact(start[0], start[1], s.y, .3)) return null;
  const ww = horizonWalkWorld(geo, extent, () => true, HORIZON_WALKABLE_DEGREES), body: WalkBody = { x: start[0], y: s.y, z: start[1], yaw: 0 }, state = createWalkState(body);
  let past = -Infinity, drop = 0;
  for (let i = 0; i < 120; i++) {
    walkTick(state, body, { wishX: -n[0], wishZ: -n[1], run: true, speeds: { walk: 2.4, run: 5 } }, WALK_FIXED_DT, (dx, dz) => walkMove(ww, body, dx, dz, { swimming: false, grounded: true }));
    past = Math.max(past, -((body.x - p.mid[0]) * n[0] + (body.z - p.mid[1]) * n[1])); drop = Math.max(drop, s.y - body.y);
  }
  return { past, drop, deck: s.y };
}
const RAILS = [
  // The Reach (L2a, D-WW60–64)
  'reachBoardwalk.rails', 'reachBoardwalk.meetingRail', 'reachFootbridge.rails', 'quayBridge.meetingRail', 'highSpan.overlook.rails', 'notchBluff.rails', 'sunsetRail.rails',
  // The Greenway (L2a, D-WW65–68): the deck and its two bridges, and its places
  'greenway.rails.bight', 'greenway.rails.green', 'greenway.rails.lakeside', 'greenway.rails.steel.bight', 'greenway.rails.steel.green',
  'greenway.terrace.rails', 'greenway.gateBridge.rails', 'greenway.overlook.rails', 'greenway.archPier.rails', 'greenway.paddleDock.rails', 'greenway.sunsetBalcony.rails', 'greenway.bluffEnd.rails', 'greenway.dip.rails',
  // Long Sands (L2b, D-WW74) and Scholars' Edge (L3, D-WW87)
  'longSandsPier.rails', 'bightLookout.rails',
] as const;

describe('every open rail stops a walker between its posts (the merged bake, runtime walkSim)', () => {
  for (const id of RAILS) {
    it(id, () => {
      const group = solids.filter(s => s.id === id || s.id === `${id}.fine`);
      expect(group.length, id).toBeGreaterThan(0);
      for (const s of group) { expect(s.kind, s.id).toBe(OPEN_RAIL_KIND); expect(isOpenRail(s)).toBe(true); }
      const ps = probes(group); expect(ps.length, `${id}: mid-bay probes`).toBeGreaterThan(0);
      let pushed = 0;
      for (const p of ps) for (const side of [1, -1] as const) {
        const r = push(p, side); if (!r) continue; pushed++;
        const at = `${id} at [${p.mid[0].toFixed(1)},${p.mid[1].toFixed(1)}] from the ${side > 0 ? '+' : '−'} side (deck ${r.deck.toFixed(2)})`;
        // The body (radius 0.3) is held on its own side of the rail's line; it never stands past it and never falls.
        expect(r.past, at).toBeLessThan(0);
        expect(r.drop, at).toBeLessThan(.3);
      }
      expect(pushed, `${id}: walker pushes`).toBeGreaterThan(0);
    }, 120_000);
  }
  it('the stargazing deck needs no rail: it stands 0.35 on its pad, under the 0.48 step (D-WW84)', () => {
    const S = M.structures.stargazing as unknown as { h: number; deck: { top: number } };
    expect(S.deck.top - S.h).toBeLessThanOrEqual(.48);
    expect(solids.some(s => s.id === 'stargazing.deck')).toBe(true);
  });
});
