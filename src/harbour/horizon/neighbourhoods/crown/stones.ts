/**
 * Stones (protos/highlands §2.8 "boulders"; STYLE §2.7 "high, bare and old"): the Highlands' loose rock, placed last of the
 * built things (after clearings, buildings, walls and sightlines, before planting), so it fills only what is left.
 *  - The moraine: erratics in a ring round the glacier's lens and along both flanks of its tongue (the ice itself, the
 *    skylight keep-out and Glacier Springs stay clear) — the biggest stones on the island, a few as large as a croft's gable.
 *  - The tarns: shore stones (small, never colliders: lite drops them) on the shingle of the Upper and Lower Tarns, Spur
 *    Tarn, the Shieling Mere and Glacier Springs.
 *  - The benches: field stones cleared to the rims of the farmed shelves (the crofters' clearance cairns' leftovers).
 *  - The scree under the horn: a scatter of small stones on the screes the paint draws.
 * A stone of scale ≥ `STONES.collideFrom` is a collider (what is drawn: `boulder` kit, a rock box 1.7 × 1.5 × 1.1 × scale), so the
 * lite tier keeps it; smaller ones are set dressing (lite drops them, never substitutes). Deterministic (`ctx.rng` only).
 */
import type { Point2 } from '../../world/definition.ts';
import type { PropRecord } from '../types.ts';
import { GLACIER, GLACIER_PEAK, V3_BENCHES, V3_KEEP_OUT, glacierSurface } from '../../land/mountainV3/landform.ts';
import { V3_BASINS } from '../../land/mountainV3/water.ts';
import { P3, round, segDist, type Site } from './site.ts';

export const STONES = { collideFrom: .75, moraine: 70, shore: 8, field: 6, scree: 45 } as const;

const ellipse = (at: Point2, radii: readonly [number, number], yaw: number, x: number, z: number) => {
  const c = Math.cos(yaw), s = Math.sin(yaw), dx = x - at[0], dz = z - at[1];
  return Math.hypot((dx * c - dz * s) / radii[0], (dx * s + dz * c) / radii[1]);
};
const SKYLIGHT = V3_KEEP_OUT.find(k => k.id === 'skylight')!.poly;
const inSkylight = (x: number, z: number, grow: number) => x > SKYLIGHT[0]![0] - grow && x < SKYLIGHT[1]![0] + grow && z > SKYLIGHT[0]![1] - grow && z < SKYLIGHT[2]![1] + grow;

export function stones(site: Site): PropRecord[] {
  const { ctx, h } = site, out: PropRecord[] = [];
  const near = (x: number, z: number, r: number) => out.some(p => Math.abs(p.at[0] - x) < r + 3 && Math.abs(p.at[2] - z) < r + 3 && Math.hypot(p.at[0] - x, p.at[2] - z) < r + (p.scale ?? 1) * 1.1);
  const onIce = (x: number, z: number) => { const s = glacierSurface(x, z); return s !== null && h(x, z) >= s - 1.5; };
  const place = (id: string, x: number, z: number, scale: number, rnd: () => number, gap = 1.6): boolean => {
    const r = 1.05 * scale;
    if (!site.free(x, z, r + .4, .6) || onIce(x, z) || inSkylight(x, z, 6) || near(x, z, r + gap)) return false;
    // Never on a ledge's lip: the ground under the stone's foot spans ≤ 0.9 × its height (it sits, it does not overhang).
    let lo = Infinity, hi = -Infinity; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, g = h(x + Math.cos(a) * r, z + Math.sin(a) * r); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    if (hi - lo > 1.1 * scale * .9 + .25) return false;
    if (!site.clearOfSights(x, z, hi + 1.3 * scale)) return false;
    site.claim({ x, z, hx: r, hz: r, yaw: 0 }, 'stone');
    out.push({ id, kind: 'boulder', at: P3(x, h(x, z), z), yaw: round(rnd() * 6.283, 1000), scale: round(scale, 1000), variant: Math.floor(rnd() * 997), collide: scale >= STONES.collideFrom });
    return true;
  };

  // ---- the moraine: a ring 1.0–1.5 × the lens, and 10–18 m off the tongue's axis (both flanks), ground 124–150 ----
  {
    const rnd = ctx.rng('crown.stones.moraine'); let n = 0;
    for (let k = 0; k < 900 && n < STONES.moraine; k++) {
      const x = 1290 + rnd() * 140, z = 340 + rnd() * 120, roll = rnd(), g = h(x, z);
      if (g < 124 || g > 150) continue;
      const e = ellipse(GLACIER.at, GLACIER.radii, GLACIER.yaw, x, z), axis = segDist(x, z, GLACIER.at, GLACIER.tongue.to);
      const ring = e > 1.02 && e < 1.5, flank = axis.t > .25 && axis.d > GLACIER.tongue.half + 1 && axis.d < GLACIER.tongue.half + 9;
      if (!ring && !flank) continue;
      // Big erratics are few: most stones 0.45–0.9, one in six up to 1.7.
      const s = roll < .16 ? 1.05 + rnd() * .65 : .45 + rnd() * .45;
      if (place(`moraine.stone.${n + 1}`, x, z, s, rnd)) n++;
    }
  }
  // ---- shore stones on the tarns' shingle ----
  {
    const rnd = ctx.rng('crown.stones.shore');
    for (const id of ['water.v3.upperTarn', 'water.v3.lowerTarn', 'water.v3.spurTarn', 'water.v3.shielingMere', 'water.v3.glacierSprings']) {
      const t = V3_BASINS.find(b => b.id === id)!; let n = 0;
      for (let k = 0; k < 40 && n < STONES.shore; k++) {
        const a = rnd() * Math.PI * 2, f = 1 + (1.2 + rnd() * 3.4) / Math.min(...t.radii), s = .3 + rnd() * .42;
        const x = t.at[0] + Math.cos(a) * t.radii[0] * f, z = t.at[1] + Math.sin(a) * t.radii[1] * f;
        if (ctx.waterLevelAt(x, z) !== null) continue;
        if (place(`${id.slice(9)}.stone.${n + 1}`, x, z, s, rnd, 1)) n++;
      }
    }
  }
  // ---- field stones on the farmed benches' rims ----
  {
    const rnd = ctx.rng('crown.stones.field');
    for (const id of ['bench.hamlet', 'bench.tarns', 'bench.orchard', 'bench.col', 'bench.westwatch', 'bench.hamlet.lower']) {
      const b = V3_BENCHES.find(q => q.id === id)!; let n = 0;
      for (let k = 0; k < 50 && n < STONES.field; k++) {
        const a = rnd() * Math.PI * 2, f = 1 + rnd() * .35, c = Math.cos(b.yaw), sn = Math.sin(b.yaw), u = Math.cos(a) * b.radii[0] * f, v = Math.sin(a) * b.radii[1] * f;
        const x = b.at[0] + u * c + v * sn, z = b.at[1] - u * sn + v * c, s = .4 + rnd() * .45;
        if (place(`${id.slice(6)}.stone.${n + 1}`, x, z, s, rnd, 4)) n++;
      }
    }
  }
  // ---- the scree under the horn: small stones, 30–85 m from the peak on ground 126–150 ----
  {
    const rnd = ctx.rng('crown.stones.scree'); let n = 0;
    for (let k = 0; k < 500 && n < STONES.scree; k++) {
      const a = rnd() * Math.PI * 2, r = 30 + rnd() * 55, x = GLACIER_PEAK.at[0] + Math.cos(a) * r, z = GLACIER_PEAK.at[1] + Math.sin(a) * r, g = h(x, z), s = .25 + rnd() * .35;
      if (g < 126 || g > 150 || site.slope(x, z) > .9) continue;
      if (place(`scree.stone.${n + 1}`, x, z, s, rnd, 1.2)) n++;
    }
  }
  return out;
}
