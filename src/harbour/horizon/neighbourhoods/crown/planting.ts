/**
 * Highland planting (protos/highlands §2.8; STYLE §1.4.1, §2.7 as amended, §3.2 highland): planted LAST, into what the
 * clearings, buildings, yards, walls and sightlines left.
 *  - Dwarf spruce in drifts below the Shoulder (110), never on the horn: `spruce` at scale ≤ 0.7, which the plant kit draws
 *    as tuckamore (wind-clipped mats) in Newfoundland (kit/plants/species.ts) and as dwarf white spruce elsewhere. Groves of
 *    5–12 inside a drift, single trees only at a drift's ragged edge.
 *  - Birch by the tarns (below the Shoulder).
 *  - The walled dwarf orchard on Orchard Bench (117): apple at dwarf scale (≤ 2.6 m), in rows along the contour that break
 *    at their ends (rule 3). The one planting above the Shoulder, sheltered by its wall (the brief; see D-WW notes).
 *  - Highland flowers (fireweed, harebell, mountain avens; Newfoundland partridgeberry) in drifts, heath on the rims, ferns
 *    and sedge by the becks and the falls' pools, lilies on the calm tarns.
 */
import type { Point2 } from '../../world/definition.ts';
import type { PlantRecord, PropRecord } from '../types.ts';
import { SPECIES_HEIGHT } from '../bake.ts';
import { FLOWER_SET } from '../../kit/plants/sets.ts';
import { GLACIER_PEAK, V3_BENCHES, benchWeight } from '../../land/mountainV3/landform.ts';
import { V3_BASINS, V3_FALLS, V3_REACHES } from '../../land/mountainV3/water.ts';
import { fbm } from './noise.ts';
import { freeRuns, linear, local, P3, segDist, SHOULDER, type Site } from './site.ts';

/** Lanes whose verges carry the highland flower beds, and the beds' island-wide cap for the module (each bed ≈ 330 triangles). */
export const VERGES = ['walk hamletLane', 'walk rimWalk', 'walk fallswatch', 'walk ranchLane', 'walk liftFoot'] as const;
export const FLOWER_BEDS = 70;
export const SPRUCE_SCALE = [.42, .68] as const;
export const ORCHARD = { bench: 'bench.orchard', scale: [.5, .58] as const, rows: 6, along: 4.5 } as const;
const bench = (id: string) => V3_BENCHES.find(b => b.id === id)!;
const CALM = ['water.v3.upperTarn', 'water.v3.lowerTarn', 'water.v3.spurTarn', 'water.v3.shielingMere'];

/** Distance (plan) to the nearest V3 brook line or basin edge. */
function waterNear(x: number, z: number): number {
  let d = Infinity;
  for (const r of V3_REACHES) for (let i = 1; i < r.pts.length; i++) d = Math.min(d, segDist(x, z, [r.pts[i - 1]![0], r.pts[i - 1]![1]], [r.pts[i]![0], r.pts[i]![1]]).d - r.width / 2);
  for (const b of V3_BASINS) d = Math.min(d, (Math.hypot((x - b.at[0]) / b.radii[0], (z - b.at[1]) / b.radii[1]) - 1) * Math.min(...b.radii));
  return d;
}

export function planting(site: Site): { plants: PlantRecord[]; props: PropRecord[] } {
  const { ctx, h } = site, plants: PlantRecord[] = [], props: PropRecord[] = [];
  const top = (species: PlantRecord['species'], x: number, z: number, scale: number) => h(x, z) + (SPECIES_HEIGHT[species] ?? 10) * scale;
  const ok = (species: PlantRecord['species'], x: number, z: number, scale: number, margin: number) => site.free(x, z, margin, .8) && site.clearOfSights(x, z, top(species, x, z, scale));
  const nearPlant = (x: number, z: number, r: number) => plants.some(p => Math.abs(p.at[0] - x) < r && Math.abs(p.at[2] - z) < r && Math.hypot(p.at[0] - x, p.at[2] - z) < r);

  // ---- the walled dwarf orchard on Orchard Bench (rows along the contour, the bench's own yaw) ----
  {
    const rnd = ctx.rng('crown.orchard'), b = bench(ORCHARD.bench), rows: Point2[][] = [];
    for (let row = 0; row < ORCHARD.rows; row++) {
      const v = -b.radii[1] * .62 + row * 4.2, pts: Point2[] = [];
      for (let u = -b.radii[0] * .8; u <= b.radii[0] * .8; u += ORCHARD.along) pts.push(local(b.at[0], b.at[1], b.yaw, u, v));
      rows.push(pts);
    }
    rows.forEach((pts, row) => {
      const kept = pts.filter(([x, z]) => h(x, z) > b.level - 3 && site.slope(x, z) < .2 && ok('apple', x, z, ORCHARD.scale[1], 1.8));
      kept.forEach(([x, z], i) => {
        // Rows break at their ends: drop one in four of the last three, jitter the last two (STYLE §1.4.1 rule 3).
        const end = Math.min(i, kept.length - 1 - i);
        if (end < 3 && rnd() < .25) return;
        const j = end < 2 ? 1 : .25, px = x + (rnd() - .5) * j, pz = z + (rnd() - .5) * j;
        if (!ok('apple', px, pz, ORCHARD.scale[1], 1.6)) return;
        plants.push({ species: 'apple', at: P3(px, h(px, pz), pz), scale: ORCHARD.scale[0] + rnd() * (ORCHARD.scale[1] - ORCHARD.scale[0]), yaw: rnd() * 6.283, tint: rnd(), keep: row === 0 && end > 2 && i % 3 === 0 });
      });
    });
    // Its wall on the windward (north) side, a dry-stone L round the rows' west and north.
    const corner = (u: number, v: number) => local(b.at[0], b.at[1], b.yaw, u, v);
    const n = -b.radii[1] * .62 - 3.2, w = -b.radii[0] * .85;
    props.push(...linear('drystoneWall', 'orchard.wall', freeRuns(site, [corner(b.radii[0] * .85, n), corner(w, n), corner(w, n + 14)], { margin: .9, minRun: 3 })));
  }

  // ---- birch by the tarns (a loose ring of shelter trees, below the Shoulder) ----
  {
    const rnd = ctx.rng('crown.birch');
    for (const id of ['water.v3.upperTarn', 'water.v3.lowerTarn', 'water.v3.spurTarn']) {
      const t = V3_BASINS.find(q => q.id === id)!;
      for (let k = 0; k < 9; k++) {
        const a = rnd() * Math.PI * 2, r = 1 + (5 + rnd() * 7) / Math.min(...t.radii), x = t.at[0] + Math.cos(a) * t.radii[0] * r, z = t.at[1] + Math.sin(a) * t.radii[1] * r, s = .6 + rnd() * .25;
        if (h(x, z) > SHOULDER - 1 || site.slope(x, z) > .45 || !ok('birch', x, z, s, 2) || nearPlant(x, z, 3)) continue;
        plants.push({ species: 'birch', at: P3(x, h(x, z), z), scale: s, yaw: rnd() * 6.283, tint: rnd(), lean: (rnd() - .5) * .06 });
      }
    }
  }

  // ---- dwarf spruce (tuckamore in Newfoundland) in drifts below the Shoulder ----
  {
    const rnd = ctx.rng('crown.spruce'), step = 3.4;
    for (let z = 292; z <= 758; z += step) for (let x = 992; x <= 1548; x += step) {
      const px = x + (rnd() - .5) * step * .8, pz = z + (rnd() - .5) * step * .8, g = h(px, pz), s = SPRUCE_SCALE[0] + rnd() * (SPRUCE_SCALE[1] - SPRUCE_SCALE[0]), roll = rnd();
      if (g < 48 || g > SHOULDER - 2) continue;
      if (Math.hypot(px - GLACIER_PEAK.at[0], pz - GLACIER_PEAK.at[1]) < 90) continue;
      const drift = fbm(px * .022 + 11, pz * .022, 7);
      if (drift < .14) continue;
      if (drift < .24 && roll < .6) continue;   // the drift's ragged edge
      if (site.slope(px, pz) > .55) continue;
      // Open pasture stays open: the hamlet shelf, the ranch, the orchard and the tarns' shelf hold only their own trees.
      if (['bench.hamlet', 'bench.ranch', 'bench.orchard', 'bench.tarns', 'bench.westwatch', 'bench.col'].some(id => benchWeight(bench(id), px, pz) > .3)) continue;
      if (waterNear(px, pz) < 3 || !ok('spruce', px, pz, s, 2.2) || nearPlant(px, pz, 2.3)) continue;
      plants.push({ species: 'spruce', at: P3(px, g, pz), scale: Math.round(s * 1000) / 1000, yaw: rnd() * 6.283, tint: rnd(), lean: (rnd() - .5) * .08 });
    }
  }

  // ---- flowers and heath in drifts; ferns and sedge by the water; lilies on the calm tarns ----
  {
    const rnd = ctx.rng('crown.flowers'); let beds = 0;
    for (let z = 300; z <= 760; z += 6) for (let x = 1000; x <= 1540; x += 6) {
      const px = x + (rnd() - .5) * 5, pz = z + (rnd() - .5) * 5, g = h(px, pz), roll = rnd(), wet = waterNear(px, pz);
      if (g < 50 || g > 128 || site.slope(px, pz) > .5) continue;
      const drift = fbm(px * .05, pz * .05, 23);
      if (wet < 6 && wet > .8) {
        if (roll < .55 && site.free(px, pz, .8)) plants.push({ species: roll < .35 ? 'fern' : 'sedge', at: P3(px, g, pz), scale: .8 + rnd() * .5, yaw: rnd() * 6.283, tint: rnd() });
        continue;
      }
      // Flower beds are costly (a bed is a whole drift of heads): they line the lanes only, where they are seen close.
      const verge = ctx.bedClearance(px, pz, VERGES);
      if (drift > .3 && verge > 1.2 && verge < 5 && beds < FLOWER_BEDS && roll < .8 && site.free(px, pz, .9)) {
        plants.push({ species: 'flowerBed', at: P3(px, g, pz), scale: .9 + rnd() * .3, yaw: rnd() * 6.283, tint: FLOWER_SET.highland + Math.min(.99, Math.max(0, (drift - .3) * 2.5)) });
        beds++;
      } else if (Math.abs(drift) > .26 && roll < .45 && g > 80 && site.free(px, pz, .8)) {
        // Heath (and, on the wetter side of a drift, grass tussocks) in drifts across the open benches and rims.
        plants.push({ species: drift > 0 ? 'heath' : 'grassTuft', at: P3(px, g, pz), scale: .9 + rnd() * .4, yaw: rnd() * 6.283, tint: drift > 0 ? rnd() : FLOWER_SET.highland + rnd() * .99 });
      }
    }
    // Lilies where the water is calm (the tarns and the mere; never a plunge pool).
    for (const id of CALM) {
      const t = V3_BASINS.find(q => q.id === id); if (!t) continue;
      for (let k = 0; k < 7; k++) {
        const a = rnd() * Math.PI * 2, r = .55 + rnd() * .3, x = t.at[0] + Math.cos(a) * t.radii[0] * r, z = t.at[1] + Math.sin(a) * t.radii[1] * r;
        if (ctx.waterLevelAt(x, z) === null) continue;
        plants.push({ species: 'lily', at: P3(x, t.level, z), scale: .8 + rnd() * .4, yaw: rnd() * 6.283, tint: rnd() });
      }
    }
    // Spray-fed fern and sedge round every fall's pool (the falls' wet banks).
    for (const f of V3_FALLS) {
      const pool = V3_BASINS.find(b => b.id === f.pool); if (!pool) continue;
      for (let k = 0; k < 10; k++) {
        const a = rnd() * Math.PI * 2, r = 1.15 + rnd() * .5, x = pool.at[0] + Math.cos(a) * pool.radii[0] * r, z = pool.at[1] + Math.sin(a) * pool.radii[1] * r;
        if (!site.free(x, z, .6)) continue;
        plants.push({ species: k % 3 ? 'fern' : 'sedge', at: P3(x, h(x, z), z), scale: .9 + rnd() * .5, yaw: rnd() * 6.283, tint: rnd() });
      }
    }
  }
  return { plants, props };
}
