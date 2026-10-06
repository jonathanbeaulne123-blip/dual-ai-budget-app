/**
 * The Highlands (The Water's Way, story place 1, dawn; module `crown`): the V3.1 ridge system dressed — Bench Hamlet's nine
 * crofts with their yards, strips, dyke, fank and flock; Westwatch Chapel with its verdigris bell cote (the landmark,
 * `westwatch`); the Fallswatch deck and its Lookout kit (the lookout, `fallswatch`); High Shieling Ranch; the drag lift's
 * stations, towers and rope; cairns on the Rim Walk; dwarf spruce (tuckamore in Newfoundland) below the Shoulder, birch by
 * the tarns, the walled dwarf orchard on Orchard Bench; highland flowers, ferns by the falls, lilies on the calm tarns; the
 * alpine zonation painted (pasture → turf → scree → snow), shingle tarn shores and wet stone by the falls; ravens and sheep.
 * Night order (LIGHT §3, STORY relay): the chapel lantern → the hamlet windows → the Fallswatch deck lamp → the ranch window.
 *
 * Pure and deterministic (`ctx.rng` streams only). Mountain v2's own footprint is never dressed (the region draws it).
 * Prototype: protos/highlands (SPEC.md, src/designs/v3-refined.mjs) — its rules ported onto the V3.1 land, not its boxes.
 */
import type { GroundPaint, LifeSpawn, NeighbourhoodDressing, NeighbourhoodModule, PropRecord } from '../types.ts';
import { GLACIER_PEAK, V3_BENCHES, benchWeight, glacierSurface } from '../../land/mountainV3/landform.ts';
import { V3_BASINS, V3_FALLS } from '../../land/mountainV3/water.ts';
import { chapel } from './chapel.ts';
import { fallswatch } from './fallswatch.ts';
import { hamlet } from './hamlet.ts';
import { lift } from './lift.ts';
import { ranch } from './ranch.ts';
import { planting } from './planting.ts';
import { paintField, ring } from './paint.ts';
import { fbm } from './noise.ts';
import { createSite, local, onV2Footprint, P3, type Rect, type Site } from './site.ts';
import { HAMLET } from './hamlet.ts';
import { storyEye, storyLandmark, aimPoint } from '../../world/story.ts';

export { HAMLET } from './hamlet.ts';
export { CHAPEL, COTE_TOP } from './chapel.ts';
export { DECK } from './fallswatch.ts';
export { LIFT } from './lift.ts';
export { ORCHARD, SPRUCE_SCALE } from './planting.ts';

const bench = (id: string) => V3_BENCHES.find(b => b.id === id)!;

/** Cairns along the Rim Walk (every ~55 m, off the tread on alternate sides) and at the col and Glacier Springs. */
function cairns(site: Site): PropRecord[] {
  const out: PropRecord[] = [], walk = site.ctx.beds.find(b => b.id === 'walk rimWalk');
  const place = (id: string, x: number, z: number) => { if (site.free(x, z, .9) && site.clearOfSights(x, z, site.h(x, z) + 1.6)) { out.push({ id, kind: 'cairn', at: P3(x, site.h(x, z), z), yaw: (x * 7 + z) % 6.283, collide: true }); site.claim({ x, z, hx: 1, hz: 1, yaw: 0 }, 'clearing'); return true; } return false; };
  if (walk) {
    let run = 0, next = 30, side = 1, k = 0;
    for (let i = 1; i < walk.points.length; i++) {
      const a = walk.points[i - 1]!, b = walk.points[i]!, L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      while (run + L >= next) {
        const t = (next - run) / L, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, nx = -(b[2] - a[2]) / L, nz = (b[0] - a[0]) / L;
        for (const off of [2.9, 3.6, 4.4]) if (place(`rim.cairn.${++k}`, x + nx * side * off, z + nz * side * off)) break;
        side = -side; next += 55;
      }
      run += L;
    }
  }
  place('col.cairn', 1462, 424); place('springs.cairn', 1394, 362);
  return out;
}

const inHayOne = (r: Rect, x: number, z: number) => { const c = Math.cos(r.yaw), s = Math.sin(r.yaw), dx = x - r.x, dz = z - r.z; return Math.min(r.hx - Math.abs(dx * c - dz * s), r.hz - Math.abs(dx * s + dz * c)); };

/** The painted ground (budgeted: zones where they read, never on a lane, a pad, water or a building). */
function paint(site: Site, hay: readonly Rect[]): GroundPaint[] {
  const { h, ctx } = site, out: GroundPaint[] = [];
  const clear = (x: number, z: number, m = .6) => Math.min(ctx.bedClearance(x, z) - m, onV2Footprint(x, z) || ctx.waterLevelAt(x, z) !== null || site.claimed(x, z, .3) ? -1 : 1);
  const tone = (x: number, z: number) => .5 + .35 * fbm(x * .04, z * .04, 31);
  // Pasture on the farmed benches: the hamlet's in-bye strips, the ranch, the orchard's grass (mown under the rows).
  // The hamlet's hay strips (every other croft's in-bye strip, mown) are cut out of its pasture so the two never overlap.
  const inHay = (x: number, z: number) => Math.max(-1, ...hay.map(r => { const c = Math.cos(r.yaw), s = Math.sin(r.yaw), dx = x - r.x, dz = z - r.z; return Math.min(r.hx - Math.abs(dx * c - dz * s), r.hz - Math.abs(dx * s + dz * c)); }));
  for (const [id, surface] of [['bench.hamlet', 'pasture'], ['bench.ranch', 'pasture'], ['bench.orchard', 'mown']] as const) {
    const b = bench(id), r = Math.max(...b.radii) + b.bank * .6, hayCut = id === 'bench.hamlet';
    out.push(...paintField((x, z) => Math.min(benchWeight(b, x, z) - .55 + .12 * fbm(x * .08, z * .08, 5), clear(x, z), hayCut ? -inHay(x, z) : 1), { x0: b.at[0] - r, x1: b.at[0] + r, z0: b.at[1] - r, z1: b.at[1] + r }, 4, surface, tone));
  }
  for (const r of hay) {
    const R = Math.hypot(r.hx, r.hz) + 2, shelf = bench('bench.hamlet');
    out.push(...paintField((x, z) => Math.min(inHayOne(r, x, z), benchWeight(shelf, x, z) - .55, clear(x, z)), { x0: r.x - R, x1: r.x + R, z0: r.z - R, z1: r.z + R }, 3, 'mown', () => .3));
  }
  // The alpine zone above the Shoulder off the benches: turf (112–126) giving way to scree (126–146) and snow (≥ 148, flat).
  const box = { x0: 1110, x1: 1530, z0: 300, z1: 480 }, steep = (x: number, z: number) => site.slope(x, z, 2);
  const benched = (x: number, z: number) => ['bench.orchard', 'bench.col', 'bench.tarns'].some(id => benchWeight(bench(id), x, z) > .2);
  const ice = (x: number, z: number) => { const s = glacierSurface(x, z); return s !== null && h(x, z) >= s - 1; };
  out.push(...paintField((x, z) => { const g = h(x, z) + 3 * fbm(x * .05, z * .05, 41); return Math.min(g - 113, 126 - g, .7 - steep(x, z), 22 - ctx.bedClearance(x, z, ['walk rimWalk', 'walk glacierWalk', 'walk eastRim']), benched(x, z) || ice(x, z) ? -1 : 1, clear(x, z)); }, box, 5, 'sedge', (x, z) => .62 + .3 * fbm(x * .06, z * .06, 43)));
  out.push(...paintField((x, z) => { const g = h(x, z) + 3 * fbm(x * .05, z * .05, 41); return Math.min(g - 126, 147 - g, 1.1 - steep(x, z), 75 - Math.hypot(x - GLACIER_PEAK.at[0], z - GLACIER_PEAK.at[1]), ice(x, z) ? -1 : 1, clear(x, z)); }, box, 5, 'scree', tone));
  out.push(...paintField((x, z) => Math.min(h(x, z) - 148, .35 - steep(x, z), Math.hypot(x - GLACIER_PEAK.at[0], z - GLACIER_PEAK.at[1]) < 60 ? 1 : -1, ice(x, z) ? -1 : 1, clear(x, z)), { x0: 1350, x1: 1450, z0: 350, z1: 450 }, 3, 'snow', () => .6));
  // Shingle shores round the tarns and the mere; wet stone round every fall's pool (the spray's reach).
  for (const id of ['water.v3.upperTarn', 'water.v3.lowerTarn', 'water.v3.spurTarn', 'water.v3.shielingMere', 'water.v3.glacierSprings']) {
    const t = V3_BASINS.find(b => b.id === id)!, k = 1 + 3.2 / Math.min(...t.radii);
    out.push(...ring(t.at, t.radii, .96, k, 18, 'gravel', .72, (x, z) => ctx.bedClearance(x, z) > .8 && !site.claimed(x, z)));
  }
  for (const f of V3_FALLS) {
    const p = V3_BASINS.find(b => b.id === f.pool)!, k = 1 + 3 / Math.min(...p.radii);
    out.push(...ring(p.at, p.radii, .97, k, 16, 'scree', .05, (x, z) => ctx.bedClearance(x, z) > .8 && !site.claimed(x, z)));
  }
  return out;
}

export function buildCrown(ctx: Parameters<NeighbourhoodModule['build']>[0]): NeighbourhoodDressing {
  const site = createSite(ctx);
  // The kept sightlines first (clearings before anything): the Bight lookout to Westwatch's cote crosses the west wall.
  const bight = storyEye('bightLookout'), cote = aimPoint(storyLandmark('westwatch'));
  site.sights.push({ from: [bight.at[0], bight.y ?? 0, bight.at[1]], to: cote, half: 3, margin: .8 });
  const w = chapel(site), f = fallswatch(site), l = lift(site), hm = hamlet(site), r = ranch(site), c = cairns(site), p = planting(site);
  // Every other croft's strip behind its yard is a hay meadow (mown), the rest pasture: the township's striped in-bye land.
  const hay = hm.crofts.filter((_, i) => i % 2 === 0).map(c => { const [x, z] = local(c.rect.x, c.rect.z, c.rect.yaw, 0, -c.rect.hz - HAMLET.yard - 11); return { x, z, hx: c.rect.hx + 2.2, hz: 10, yaw: c.rect.yaw }; });
  const ground = [...hm.ground, ...paint(site, hay)];
  const life: LifeSpawn[] = [...w.life, ...hm.life, ...r.life,
    // Ravens over the crest and the horn (STYLE §1.9: the Crown's ravens), dawn to dusk.
    { kind: 'raven', at: P3(1300, 150, 360), radius: 60, count: 2, hours: [5, 20] }];
  return {
    id: 'crown',
    buildings: [...w.buildings, ...f.buildings, ...l.buildings, ...hm.buildings, ...r.buildings],
    plants: p.plants.concat(hm.plants),
    props: [...w.props, ...f.props, ...l.props, ...hm.props, ...r.props, ...c, ...p.props],
    ground,
    pools: [],
    life,
    lights: [...w.lights, ...hm.lights, ...f.lights, ...r.lights],
    landmarks: [...w.landmarks, ...f.landmarks],
    lookouts: f.lookouts,
  };
}

export const crown: NeighbourhoodModule = { id: 'crown', build: buildCrown };
