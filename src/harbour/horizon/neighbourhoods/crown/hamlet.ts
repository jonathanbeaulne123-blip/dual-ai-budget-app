/**
 * Bench Hamlet (protos/highlands §2.1; RULINGS 6; MOUNTAIN_V3 §7): a crofting township of NINE crofts on the V3.1 shelf
 * beside the hamlet lane, each with its walled yard behind it and its strip of in-bye field running back from the lane
 * between dry-stone walls (the crofting pattern), a sheep fank, the roadside dyke down to Westwatch ("dry-stone walls begin
 * at the north pass") and a flock.
 *
 * The prototype's rule, ported to the real shelf (port the rule, not its coordinates): candidate sites beside the lanes on
 * flat shelf ground, scored by flatness and by a comfortable distance to the lane, taken greedily with their yards never
 * overlapping; four big crofts (11–14 × 6) and five small (7–9 × 5); each croft's long axis runs with the lane and its door
 * faces it. Deterministic: `ctx.rng('crown.hamlet')` only.
 */
import type { Point2 } from '../../world/definition.ts';
import type { LightAnchor } from '../../world/definition.ts';
import type { BuildingRecord, GroundPaint, LifeSpawn, PlantRecord, PropRecord } from '../types.ts';
import { V3_BENCHES, benchWeight } from '../../land/mountainV3/landform.ts';

const SHELF = V3_BENCHES.find(b => b.id === 'bench.hamlet')!;
import { freeRuns, linear, local, P3, rectCorners, rectsOverlap, segDist, type Rect, type Site } from './site.ts';

export const HAMLET = {
  /** The shelf (landform bench.hamlet [1078,416] 72 × 44 m at 104, graded 4 % to the north) and its search box. */
  box: { x: [1036, 1124], z: [366, 474] } as const,
  level: [99, 108] as const,
  lanes: ['walk hamletLane', 'walk fallswatch', 'walk liftFoot'] as const,
  /** Lane-edge distance band for a croft's front wall (m). */
  front: [2.2, 30] as const,
  crofts: 9, big: 4,
  /** A croft's walled yard behind it (m, from its back wall) and the gap kept between neighbours' house+yard plots. */
  yard: 5, gap: 2,
  maxSpan: 1.2, steepSpan: 2.0,
} as const;

/** The steepest ground a croft's yard wall follows (field walls: `WALL_GRADE`). */
export const YARD_GRADE = .34;

export interface Croft { id: string; rect: Rect; floor: number; big: boolean; lit: boolean }

export function hamlet(site: Site): { buildings: BuildingRecord[]; props: PropRecord[]; plants: PlantRecord[]; ground: GroundPaint[]; lights: LightAnchor[]; life: LifeSpawn[]; crofts: Croft[] } {
  const { ctx, h } = site, rnd = ctx.rng('crown.hamlet');
  const crofts: Croft[] = [], plots: Rect[] = [];
  const nearWater = (x: number, z: number, r: number) => { for (let a = 0; a < 8; a++) if (ctx.waterLevelAt(x + Math.cos(a * Math.PI / 4) * r, z + Math.sin(a * Math.PI / 4) * r) !== null) return true; return ctx.waterLevelAt(x, z) !== null; };
  // Candidates: every 1 m on the shelf, oriented to the nearest lane (front to the lane, long axis along it).
  type Cand = { x: number; z: number; yaw: number; score: number };
  const candidates = (w: number, d: number, maxSpan: number = HAMLET.maxSpan): Cand[] => {
    const out: Cand[] = [];
    for (let x = HAMLET.box.x[0]; x <= HAMLET.box.x[1]; x += 1) for (let z = HAMLET.box.z[0]; z <= HAMLET.box.z[1]; z += 1) {
      const g = h(x, z); if (g < HAMLET.level[0] || g > HAMLET.level[1] || benchWeight(SHELF, x, z) < .55) continue;
      const lane = site.nearestBed(x, z, HAMLET.lanes); if (!lane) continue;
      const toLane: Point2 = [lane.at[0] - x, lane.at[1] - z], len = Math.hypot(toLane[0], toLane[1]); if (len < .5) continue;
      const frontGap = lane.d - d / 2; if (frontGap < HAMLET.front[0] || frontGap > HAMLET.front[1]) continue;
      const yaw = Math.atan2(toLane[0] / len, toLane[1] / len), house: Rect = { x, z, hx: w / 2, hz: d / 2, yaw };
      const span = site.groundSpan(house); if (span.max - span.min > maxSpan) continue;
      if (nearWater(x, z, 6 + d / 2)) continue;
      out.push({ x, z, yaw, score: -(span.max - span.min) * 2 - Math.abs(frontGap - 4.5) * .25 + rnd() * .35 });
    }
    return out.sort((a, b) => b.score - a.score || a.x - b.x || a.z - b.z);
  };
  const plotOf = (c: Cand, w: number, d: number): Rect => { const [px, pz] = local(c.x, c.z, c.yaw, 0, -HAMLET.yard / 2); return { x: px, z: pz, hx: w / 2 + 1.2, hz: d / 2 + HAMLET.yard / 2 + .4, yaw: c.yaw }; };
  for (let slot = 0; slot < HAMLET.crofts; slot++) {
    const big = slot < HAMLET.big, w = big ? 10 + Math.floor(rnd() * 6) / 2 : 6.5 + Math.floor(rnd() * 3) / 2, d = big ? 6 : 4.8;
    // A slot the flat ground cannot fill takes a site with a deeper plinth (≤ `steepSpan`) rather than leaving the township short.
    for (const c of [...candidates(w, d), ...candidates(w, d, HAMLET.steepSpan)]) {
      const house: Rect = { x: c.x, z: c.z, hx: w / 2, hz: d / 2, yaw: c.yaw }, plot = plotOf(c, w, d);
      if (plots.some(p => rectsOverlap(p, plot, HAMLET.gap))) continue;
      if (!site.rectFree({ ...house, hx: house.hx + 1, hz: house.hz + 1 }, .4)) continue;
      // The yard behind must be free ground too (it may lose a corner to a slope; never to a lane or water).
      const [yx, yz] = local(c.x, c.z, c.yaw, 0, -d / 2 - HAMLET.yard / 2);
      if (!site.rectFree({ x: yx, z: yz, hx: w / 2 - 1, hz: HAMLET.yard / 2 - 1, yaw: c.yaw }, 0)) continue;
      const span = site.groundSpan(house);
      crofts.push({ id: `hamlet.croft.${crofts.length + 1}`, rect: house, floor: span.max + .08, big, lit: false });
      plots.push(plot); site.claim(house, 'building');
      break;
    }
  }
  // Lit crofts at night: the four nearest the lane's bend (the hamlet's heart), never all of them.
  const heart: Point2 = [1084, 412];
  [...crofts].sort((a, b) => Math.hypot(a.rect.x - heart[0], a.rect.z - heart[1]) - Math.hypot(b.rect.x - heart[0], b.rect.z - heart[1])).slice(0, 4).forEach(c => { c.lit = true; });

  const buildings: BuildingRecord[] = [], props: PropRecord[] = [], plants: PlantRecord[] = [], ground: GroundPaint[] = [], lights: LightAnchor[] = [], life: LifeSpawn[] = [];
  const walls: [Point2, Point2][] = [];
  const nearWall = (x: number, z: number, r: number) => walls.some(([a, b]) => segDist(x, z, a, b).d < r);
  const addWall = (id: string, pts: Point2[], o: { closed?: boolean; minRun?: number; maxGrade?: number } = {}) => {
    const runs = freeRuns(site, pts, { margin: .9, minRun: o.minRun ?? 3, closed: o.closed, maxGrade: o.maxGrade, ok: (x, z) => !nearWall(x, z, 2) });
    for (const r of runs) for (let i = 1; i < r.length; i++) walls.push([[r[i - 1]![0], r[i - 1]![2]], [r[i]![0], r[i]![2]]]);
    props.push(...linear('drystoneWall', id, runs));
  };
  for (const c of crofts) {
    const { rect: r } = c, w = r.hx * 2, d = r.hz * 2;
    buildings.push({
      id: c.id, districtId: '', kind: 'croft', style: 'crown.croft', at: P3(r.x, c.floor, r.z), yaw: r.yaw,
      size: { w, d, h: c.big ? 2.7 : 2.5 }, roof: { form: 'gable', pitch: 38, overhang: .35, material: 'thatch' },
      door: { face: 'front', u: c.big ? 0 : (rnd() < .5 ? -1 : 1) * Math.min(1.2, w / 2 - 1.2) }, paint: Math.floor(rnd() * 3), collide: true,
    });
    // The yard: a dry-stone U behind the house, its gate in the back wall's middle.
    const Y = (lx: number, lz: number) => local(r.x, r.z, r.yaw, lx, lz), back = -r.hz - HAMLET.yard;
    // A yard's walls are short: they may follow a steeper yard (a croft on the shelf's edge) than a field wall does.
    addWall(`${c.id}.yard.l`, [Y(-r.hx - .6, -r.hz - .5), Y(-r.hx - .6, back), Y(-1.2, back)], { minRun: 2, maxGrade: YARD_GRADE });
    addWall(`${c.id}.yard.r`, [Y(1.2, back), Y(r.hx + .6, back), Y(r.hx + .6, -r.hz - .5)], { minRun: 2, maxGrade: YARD_GRADE });
    const yard: Rect = { x: Y(0, -r.hz - HAMLET.yard / 2)[0], z: Y(0, -r.hz - HAMLET.yard / 2)[1], hx: r.hx, hz: HAMLET.yard / 2, yaw: r.yaw };
    // In the yard: the kale bed (dug ground), a hay bale or two, a washing line on the bigger crofts.
    const kale = rectCorners({ ...yard, x: Y(-r.hx / 2, -r.hz - HAMLET.yard / 2)[0], z: Y(-r.hx / 2, -r.hz - HAMLET.yard / 2)[1], hx: Math.min(2.4, r.hx / 2 - .6), hz: HAMLET.yard / 2 - 1.4 });
    ground.push({ polygon: kale, surface: 'mud', tone: .35 + rnd() * .2 });
    const hay = Y(r.hx - 1.4, back + 1.4);
    if (site.free(hay[0], hay[1], .3)) props.push({ id: `${c.id}.hay`, kind: 'hayBale', at: P3(hay[0], h(hay[0], hay[1]), hay[1]), yaw: r.yaw + rnd() * .4, collide: true });
    const hay2 = Y(r.hx - 1.4, back + 3.1);
    if (c.big && site.free(hay2[0], hay2[1], .3)) props.push({ id: `${c.id}.hay.2`, kind: 'hayBale', at: P3(hay2[0], h(hay2[0], hay2[1]), hay2[1]), yaw: r.yaw + rnd() * .4, collide: true });
    if (c.big) {
      const a = Y(-r.hx + 1, back + 1.6), b = Y(r.hx * .2, back + 1.6);
      if (site.free(a[0], a[1], .3) && site.free(b[0], b[1], .3)) props.push({ id: `${c.id}.washing`, kind: 'laundryLine', at: P3(a[0], h(a[0], a[1]), a[1]), yaw: r.yaw, line: [P3(a[0], h(a[0], a[1]), a[1]), P3(b[0], h(b[0], b[1]), b[1])], collide: true });
    }
    site.claim(yard, 'yard');
    // A bench by the door on the lit crofts (the hamlet's evening).
    if (c.lit) {
      const s = Y(c.big ? 2.6 : -2.2, r.hz + .9);
      if (site.free(s[0], s[1], .5)) props.push({ id: `${c.id}.bench`, kind: 'bench', at: P3(s[0], h(s[0], s[1]), s[1]), yaw: r.yaw, collide: true });
      const l = Y(0, r.hz + 1.3);
      lights.push({ id: `crown.${c.id}.window`, kind: 'window', at: P3(l[0], h(l[0], l[1]) + .8, l[1]), pool: P3(l[0], h(l[0], l[1]), l[1]), poolRadius: 2.6, line: 'crown.night', order: 1, bestHour: 'night' });
    }
    // The door apron.
    const ap = Y(0, r.hz + 2); site.claim({ x: ap[0], z: ap[1], hx: 1.6, hz: 2, yaw: r.yaw }, 'clearing');
  }
  // The strips: from each croft's side, a dry-stone wall runs back from the lane across the in-bye ground to the shelf's edge.
  const onShelf = (x: number, z: number) => h(x, z) > HAMLET.level[0] - 1 && site.slope(x, z) < .3;
  for (const c of crofts) {
    const r = c.rect;
    for (const side of [-1, 1]) {
      const pts: Point2[] = []; let lz = r.hz + 1;
      for (; lz > -r.hz - 34; lz -= 2) { const p = local(r.x, r.z, r.yaw, side * (r.hx + 2.6), lz); if (!onShelf(p[0], p[1])) break; pts.push(p); }
      if (pts.length >= 4) addWall(`${c.id}.strip.${side < 0 ? 'l' : 'r'}`, pts, { minRun: 5 });
    }
  }
  // The roadside dyke from the north pass: the hamlet lane's downhill (west) side, 3 m off its line, Westwatch to the shelf.
  const lane = ctx.beds.find(b => b.id === 'walk hamletLane');
  if (lane) {
    const pts: Point2[] = [];
    for (let i = 1; i < lane.points.length; i++) {
      const a = lane.points[i - 1]!, b = lane.points[i]!; if (b[2] > 400) break;
      const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1; let nx = -dz / L, nz = dx / L; if (nx > 0) { nx = -nx; nz = -nz; }
      pts.push([b[0] + nx * 3.2, b[2] + nz * 3.2]);
    }
    if (pts.length >= 2) addWall('hamlet.dyke', pts, { minRun: 4 });
  }
  // The sheep fank: a stone pen on free shelf ground near the hamlet, its gate on the lane side.
  const fank = findFank(site, crofts);
  if (fank) {
    const F = (lx: number, lz: number) => local(fank.x, fank.z, fank.yaw, lx, lz);
    const pen = [F(-1, fank.hz), F(-fank.hx, fank.hz), F(-fank.hx, -fank.hz), F(fank.hx, -fank.hz), F(fank.hx, fank.hz), F(1, fank.hz)];
    const runs = freeRuns(site, pen, { margin: .6, minRun: 2 });
    props.push(...linear('sheepFank', 'hamlet.fank', runs));
    site.claim(fank, 'clearing');
    life.push({ kind: 'sheep', at: P3(fank.x, h(fank.x, fank.z), fank.z), radius: Math.min(fank.hx, fank.hz) - .8, count: 5 });
  }
  // The flock on the strips (data; PR 5 grazes them).
  life.push({ kind: 'sheep', at: P3(1072, h(1072, 430), 430), radius: 20, count: 4 });
  // Shelter birches behind a few yards (below the Shoulder; nothing on a lane, a yard or a door apron).
  for (const c of crofts.filter((_, i) => i % 3 !== 1)) {
    const r = c.rect;
    for (let k = 0; k < 2; k++) {
      const [x, z] = local(r.x, r.z, r.yaw, (rnd() - .5) * r.hx * 2, -r.hz - HAMLET.yard - 2.5 - rnd() * 3);
      if (!site.free(x, z, 1.5) || !site.clearOfSights(x, z, h(x, z) + 7) || nearWall(x, z, 1.2)) continue;
      plants.push({ species: 'birch', at: P3(x, h(x, z), z), scale: .62 + rnd() * .2, yaw: rnd() * 6.283, tint: rnd() });
    }
  }
  return { buildings, props, plants, ground, lights, life, crofts };
}

function findFank(site: Site, crofts: readonly Croft[]): Rect | null {
  const rnd = site.ctx.rng('crown.hamlet.fank');
  let best: { r: Rect; s: number } | null = null;
  for (let x = HAMLET.box.x[0]; x <= HAMLET.box.x[1]; x += 3) for (let z = HAMLET.box.z[0]; z <= HAMLET.box.z[1]; z += 3) {
    const g = site.h(x, z); if (g < HAMLET.level[0] || g > HAMLET.level[1]) continue;
    const lane = site.nearestBed(x, z, HAMLET.lanes); if (!lane || lane.d < 6 || lane.d > 18) continue;
    const yaw = Math.atan2(lane.at[0] - x, lane.at[1] - z), r: Rect = { x, z, hx: 4.5, hz: 3.5, yaw };
    if (crofts.some(c => rectsOverlap(c.rect, r, 5))) continue;
    if (!site.rectFree({ ...r, hx: r.hx + .8, hz: r.hz + .8 }, .3)) continue;
    const span = site.groundSpan(r); if (span.max - span.min > 1.6) continue;
    const s = -(span.max - span.min) - Math.abs(lane.d - 10) * .1 + rnd() * .2;
    if (!best || s > best.s) best = { r, s };
  }
  return best?.r ?? null;
}
