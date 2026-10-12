/**
 * Stillwater's shore and the Glasshouse surroundings (STYLE §2.6 Lakeside, the water biome §3.2): reeds, cattails and sedge
 * in the shallows, water lilies off the reed beds, the lake-edge drifts (blue flag iris, marsh marigold, Joe-Pye weed),
 * willow at the inflow, tamarack (gold in October) and red-osier dogwood on the banks; loons on the water and dragonflies
 * over the reeds. Tree cover ~20 % of the shore, never between the Glasshouse and the lake (`GLASSHOUSE_VIEW`).
 * The Glasshouse's terrace keeps four low lanterns, lit first at dusk (the night face: the Glasshouse first, then the crest
 * and the Lantern Ring, then the moon path).
 *
 * The lakeside district has ~3k lite triangles left over its baked land (index: 68.8k / 57.0k), so the shore is planted for
 * the full tier and kept light: few trees, marsh clumps that lite thins (LITE_KEEP), no paint.
 */
import type { LightAnchor, Point2 } from '../../world/definition.ts';
import type { DressingContext, LifeSpawn, PlantRecord, PropRecord } from '../types.ts';
import { FLOWER_SET } from '../../kit/plants/sets.ts';
import { GLASSHOUSE, GLASSHOUSE_VIEW, STILLWATER, bearing, dist, polar } from './plan.ts';
import { groundKit } from './green.ts';

export type ShoreOut = { plants: PlantRecord[]; props: PropRecord[]; life: LifeSpawn[]; lights: LightAnchor[] };

/** Whether a point lies in the Glasshouse's view over the lake (no trees there). */
export function inGlasshouseView(p: Point2): boolean {
  const b = bearing(GLASSHOUSE, p), d = dist(GLASSHOUSE, p);
  return d < GLASSHOUSE_VIEW.reach && b >= GLASSHOUSE_VIEW.from && b <= GLASSHOUSE_VIEW.to;
}

export function buildShore(ctx: DressingContext): ShoreOut {
  const { h, ok, at3 } = groundKit(ctx), out: ShoreOut = { plants: [], props: [], life: [], lights: [] };
  const r = ctx.rng('lakeside.shore');
  const level = ctx.waterLevelAt(STILLWATER[0], STILLWATER[1]) ?? 50;
  // The lake's edge, found from the context (no outline is needed): march out from Stillwater's middle on 150 bearings to
  // the last wet point; the outward normal is the bearing's direction.
  const edge: { p: Point2; n: Point2 }[] = [];
  for (let k = 0; k < 150; k++) {
    const b = (k / 150) * 360; let last: Point2 | null = null;
    for (let rr = 10; rr < 220; rr += 0.75) { const q = polar(STILLWATER, b, rr); if (ctx.waterLevelAt(q[0], q[1]) === null) break; last = q; }
    if (last) { const d = polar([0, 0], b, 1); edge.push({ p: last, n: d }); }
  }
  const shallow = (p: Point2) => { const w = ctx.waterLevelAt(p[0], p[1]); return w !== null && h(p[0], p[1]) > w - 0.9; };
  const marshKinds = ['reed', 'reed', 'cattail', 'sedge'] as const;
  edge.forEach(({ p, n }, i) => {
    // Reed beds in runs: about half the shore, broken where the Glasshouse looks out and where the crest walks meet the water.
    const run = Math.sin(i * 0.37 + 1.3) + Math.sin(i * 0.11) * 0.8;
    if (run < 0.1) return;
    for (let k = 0; k < 3; k++) {
      const q: Point2 = [p[0] - n[0] * (0.6 + r() * 2.8) + (r() - 0.5) * 2, p[1] - n[1] * (0.6 + r() * 2.8) + (r() - 0.5) * 2];
      if (!shallow(q) || ctx.bedClearance(q[0], q[1]) < 3 || ctx.occupied(q[0], q[1], 0.3) && ctx.waterLevelAt(q[0], q[1]) === null) continue;
      const sp = marshKinds[Math.floor(r() * marshKinds.length)]!;
      out.plants.push({ species: sp, at: [q[0], Math.max(h(q[0], q[1]), level - 0.5), q[1]], scale: 0.85 + r() * 0.35, yaw: r() * 6.283, tint: r() });
    }
    // Lilies off the reed beds (on the water surface), every fourth station.
    if (i % 4 === 0) { const q: Point2 = [p[0] - n[0] * (4 + r() * 3), p[1] - n[1] * (4 + r() * 3)];
      if (ctx.waterLevelAt(q[0], q[1]) !== null && !inGlasshouseView(q)) out.plants.push({ species: 'lily', at: [q[0], level, q[1]], scale: 0.9 + r() * 0.4, yaw: r() * 6.283, tint: r() }); }
  });
  // The bank: lake-edge drifts, dogwood clumps and tamarack groups on dry ground just above the water.
  const bank = (p: Point2, n: Point2, off: number): Point2 => [p[0] + n[0] * off, p[1] + n[1] * off];
  let drifts = 0, dogwood = 0, tamarack = 0;
  edge.forEach(({ p, n }, i) => {
    if (i % 9 === 2 && drifts < 3) { const q = bank(p, n, 3 + r() * 2); if (ok(q[0], q[1], 3.5, 1) && !inGlasshouseView(q)) { out.plants.push({ species: 'flowerBed', at: at3(q), scale: 0.9, yaw: Math.atan2(n[1], -n[0]), tint: FLOWER_SET.lakeEdge + r() * 0.99 }); drifts++; } }
    if (i % 11 === 5 && dogwood < 6) { const q = bank(p, n, 4 + r() * 3); if (ok(q[0], q[1], 3.5, 1) && !inGlasshouseView(q)) { out.plants.push({ species: 'dogwood', at: at3(q), scale: 0.9 + r() * 0.3, yaw: r() * 6.283, tint: r() }); dogwood++; } }
    if (i % 17 === 9 && tamarack < 6) { for (let k = 0; k < 2; k++) { const q = bank(p, n, 7 + r() * 5 + k * 3.5); if (ok(q[0], q[1], 4, 1.5) && !inGlasshouseView(q)) { out.plants.push({ species: 'tamarack', at: at3(q), scale: 0.85 + r() * 0.3, yaw: r() * 6.283, tint: r() }); tamarack++; } } }
  });
  // Willow at the inflow (the mountain river's mouth, east shore).
  for (const [b, rr] of [[200, 9], [235, 12]] as const) { const q = polar([1243, 836], b, rr); if (ok(q[0], q[1], 3, 1, 0.8)) out.plants.push({ species: 'willow', at: at3(q), scale: 1, yaw: r() * 6.283, tint: r() }); }
  // The Glasshouse terrace's four low lanterns (lit first at dusk), along its walk where the ground is free.
  const terrace: Point2[] = [[994, 828], [1006, 834], [1013, 842], [1012, 853]];
  let lit = 0;
  terrace.forEach(t => {
    // a step off the walk's edge
    const q: Point2 = [t[0] + 2.1, t[1]]; if (ctx.occupied(q[0], q[1], 0.2) || ctx.waterLevelAt(q[0], q[1]) !== null) return;
    const k = lit++, id = `lakeside.glasshouse.lantern.${k + 1}`, y = h(q[0], q[1]);
    out.props.push({ id, kind: 'lanternLow', at: [q[0], y, q[1]], yaw: 0, collide: true });
    out.lights.push({ id, at: [q[0], y + 0.98, q[1]], kind: 'lanternLow', head: [q[0], y + 0.98, q[1]], pool: [q[0], y, q[1]], poolRadius: 2, line: 'lakeside.glasshouse', order: k });
  });
  // Loons on the open water; dragonflies over the reeds (June–August, warm hours).
  out.life.push({ kind: 'loon', at: [STILLWATER[0] + 10, level, STILLWATER[1] + 5], radius: 45, count: 2, hours: [5, 21] });
  out.life.push({ kind: 'dragonfly', at: [1070, level + 0.8, 895], radius: 30, count: 4, months: [6, 7, 8], hours: [10, 17] });
  out.life.push({ kind: 'dragonfly', at: [1200, level + 0.8, 880], radius: 25, count: 3, months: [6, 7, 8], hours: [10, 17] });
  return out;
}
