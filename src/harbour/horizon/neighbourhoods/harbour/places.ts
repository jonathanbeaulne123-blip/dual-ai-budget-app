/**
 * Little Harbour's public places (SPEC §7, §8, §10–§12): the square (fountain, sundial, benches toward the dam, café
 * tables, the Court's lanterns, the bocce court on the small green), the storefront lane's stalls, Lantern Row and the
 * quay (the island lantern west → east, gozzi, nets, crates), the Giro del Porto buoys, the thresholds' racks, the
 * pastime fixtures (placed and still), the belfry lookout, the campanile landmark, the night order and the life.
 *
 * Validation rules shape what collides (neighbourhoods/bake.ts rule 4): a colliding prop stands on no pad, on no bed's
 * inner tread and not in water. The square, the storefront lane and the quay are pads, so what stands on them is drawn
 * without a collider; Lantern Row's posts stand on the quay walk's edge band or the ground beside it and collide.
 */
import type { LightAnchor, Point2, Point3 } from '../../world/definition.ts';
import type { BuildingRecord, DressingContext, Landmark, LifeSpawn, Lookout, PropRecord } from '../types.ts';
import { pointInPolygon } from '../../world/geometry.ts';
import { storyEye, storyLandmark } from '../../world/story.ts';
import { HORIZON_MANIFEST } from '../../world/manifest.ts';
import {
  BOCCE, CAFE, CAMPANILE, belfryFloor, untouched, COURT_LANTERNS, CRATES, DAM_BENCHES, FISHING, FOUNTAIN, GIRO, GOZZI_HAULED, GOZZI_MOORED, NETS, QUAY, STALLS, SUNDIAL, tier, type TierId,
} from './plan.ts';
import { footprintQuads, frontOf } from './town.ts';

/** The night line every harbour anchor joins, in order (STYLE §2.1 "Night face, in order"; LIGHT §3). */
export const NIGHT_LINE = 'harbour.night';
export const NIGHT_ORDER = ['lanternRow', 'court', 'hosts', 'belfry', 'floatDock'] as const;
export type NightGroup = (typeof NIGHT_ORDER)[number];

const TIERS: readonly TierId[] = ['upperStreet', 'square', 'storefrontLane', 'quay'];
/** The floor a prop stands on: a town tier's slab where it is on one, else the ground. */
export function floorAt(ctx: DressingContext, x: number, z: number): number {
  for (const id of TIERS) { const t = tier(id); if (x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1) return Math.max(t.y, ctx.heightAt(x, z)); }
  return ctx.heightAt(x, z);
}
const inside = (q: readonly Point2[], x: number, z: number) => pointInPolygon(x, z, q as Point2[]);
function quadDistance(q: readonly Point2[], x: number, z: number): number {
  if (inside(q, x, z)) return 0;
  let best = Infinity;
  for (let i = 0; i < q.length; i++) { const a = q[i]!, b = q[(i + 1) % q.length]!, dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); }
  return best;
}

export interface Spot { clear: number; onPad: boolean; houses: readonly (readonly Point2[])[]; houseClear?: number }
/** Whether a prop can stand at (x, z): dry, `clear` eu off every bed edge, on a pad only where allowed, clear of houses. */
export function spotOk(ctx: DressingContext, x: number, z: number, o: Spot): boolean {
  if (ctx.waterLevelAt(x, z) !== null || ctx.bedClearance(x, z) < o.clear) return false;
  const pad = ctx.onPad?.(x, z, 0.3) ?? null;
  // The Kitty plaza and the homestead sites are left untouched (dressed around, never on).
  if (untouched(x, z, 0.3, ctx.onPad)) return false;
  if (!o.onPad && (pad !== null || ctx.occupied(x, z, 0.2))) return false;
  if (o.onPad && pad === null && ctx.occupied(x, z, 0.2)) return false;
  return o.houses.every(q => quadDistance(q, x, z) >= (o.houseClear ?? 0.8));
}
/** The nearest spot to `p` (rings of 0.5 eu out to `reach`) where a prop can stand; null when there is none. */
export function nearestSpot(ctx: DressingContext, p: Point2, o: Spot, reach = 6): Point2 | null {
  if (spotOk(ctx, p[0], p[1], o)) return p;
  for (let r = 0.5; r <= reach + 1e-9; r += 0.5) {
    const n = Math.max(8, Math.round(2 * Math.PI * r / 0.5));
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = p[0] + Math.cos(a) * r, z = p[1] + Math.sin(a) * r; if (spotOk(ctx, x, z, o)) return [x, z]; }
  }
  return null;
}
const yawToward = (from: Point2, to: Point2) => Math.atan2(to[0] - from[0], to[1] - from[1]);

export interface Places { props: PropRecord[]; lights: LightAnchor[]; landmarks: Landmark[]; lookouts: Lookout[]; life: LifeSpawn[]; lanternRow: Point3[] }

export function buildPlaces(ctx: DressingContext, buildings: readonly BuildingRecord[]): Places {
  const props: PropRecord[] = [], lights: LightAnchor[] = [], life: LifeSpawn[] = [], houses = footprintQuads(buildings), lanternRow: Point3[] = [];
  let order = 0;
  const light = (id: string, at: Point3, kind: string, group: NightGroup) => lights.push({ id: `harbour.${group}.${id}`, at, kind, bestHour: 'night', line: NIGHT_LINE, order: order++ });
  const prop = (r: PropRecord) => { props.push(r); return r; };
  const onSquare: Spot = { clear: 1.2, onPad: true, houses };

  /* ---- Lantern Row: the island lantern west → east along the town quay (STYLE §2.0, RULINGS 10) ---- */
  {
    const [a, b] = [QUAY.from, QUAY.to], len = Math.hypot(b[0] - a[0], b[1] - a[1]), u: Point2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], n: Point2 = [u[1], -u[0]];
    // n points inland (north-west of the line); a post stands 0.6 eu beyond the walk's inland edge, else on its edge band.
    const half = 1.25, posts = 14;
    for (let i = 0; i < posts; i++) {
      const s = len * i / (posts - 1), c: Point2 = [a[0] + u[0] * s, a[1] + u[1] * s];
      const options = [half + 0.6, half + 0.95, half - 0.25, -(half - 0.25)].flatMap(off => [0, -1.2, 1.2].map(ds => [c[0] + n[0] * off + u[0] * ds, c[1] + n[1] * off + u[1] * ds] as Point2));
      const free = (p: Point2) => ctx.waterLevelAt(p[0], p[1]) === null && ctx.bedClearance(p[0], p[1]) > -0.3 && houses.every(q => quadDistance(q, p[0], p[1]) >= 0.6);
      // Where the walk crosses the quay's pad (x ≈ 1456–1471) a post may not collide on the pad (bake rule 4): it stands there
      // drawn only, beside the walk on the pad, so the row stays one row (a gap of 24 eu otherwise).
      let at = options.find(p => free(p) && (ctx.onPad?.(p[0], p[1], 0.25) ?? null) === null), collide = true;
      if (!at) { at = options.find(free); collide = false; }
      if (!at) continue;
      const y = ctx.bedClearance(at[0], at[1]) <= 0 || (ctx.onPad?.(at[0], at[1]) ?? null) !== null ? QUAY.y : ctx.heightAt(at[0], at[1]);
      const p = prop({ id: `lanternRow.${lanternRow.length}`, kind: 'lantern', at: [at[0], y, at[1]], yaw: Math.atan2(u[0], u[1]), collide });
      lanternRow.push(p.at);
    }
    lanternRow.forEach((p, i) => light(`${i}`, [p[0], p[1] + 0.8, p[2]], 'lantern', 'lanternRow'));
  }

  /* ---- the square (SPEC §7, §8, §11) ---- */
  const squareY = tier('square').y;
  COURT_LANTERNS.forEach((p, i) => { const at = nearestSpot(ctx, p, onSquare, 4); if (!at) return; prop({ id: `court.lantern.${i}`, kind: 'lantern', at: [at[0], squareY, at[1]], yaw: 0, collide: false }); });
  props.filter(p => p.id?.startsWith('court.lantern')).forEach((p, i) => light(`${i}`, [p.at[0], p.at[1] + 0.8, p.at[2]], 'lantern', 'court'));
  { const at = nearestSpot(ctx, FOUNTAIN, { ...onSquare, clear: 3 }, 5); if (at) prop({ id: 'fountain', kind: 'fountain', at: [at[0], squareY, at[1]], yaw: 0, collide: false }); }
  { const at = nearestSpot(ctx, SUNDIAL, onSquare, 3); if (at) prop({ id: 'sundial', kind: 'sundial', at: [at[0], squareY, at[1]], yaw: 0, fixture: 'sundial', collide: false }); }
  const dam = HORIZON_MANIFEST.views.find(v => v.id === 'A')!.target as unknown as Point2;
  DAM_BENCHES.forEach((p, i) => { const at = nearestSpot(ctx, p, onSquare, 3); if (at) prop({ id: `square.bench.${i}`, kind: 'bench', at: [at[0], squareY, at[1]], yaw: yawToward(at, dam), collide: false }); });
  CAFE.forEach((p, i) => { const at = nearestSpot(ctx, p, onSquare, 3); if (at) prop({ id: `cafe.${i}`, kind: 'cafeTable', at: [at[0], squareY, at[1]], yaw: (i * 0.7) % 3.14, variant: 1, collide: false }); });
  // The bocce court wholly on the small green (RULINGS 10), its bench on the green's south side facing it.
  prop({ id: 'bocce', kind: 'bocceCourt', at: [BOCCE.centre[0], squareY, BOCCE.centre[1]], yaw: 0, fixture: 'bocce', collide: false });
  prop({ id: 'bocce.bench', kind: 'bench', at: [BOCCE.centre[0], squareY, BOCCE.centre[1] + BOCCE.size[1] / 2 + 0.75], yaw: Math.PI, collide: false });
  // Planters with geraniums by the café, along the upper street's west side and the market lane; a second café by the
  // fountain. Set dressing (lite drops it whole: kit/props `propDraws`).
  for (const [i, p] of ([[1444.5, 1198.5], [1466.5, 1198.5], [1476.5, 1180], [1433, 1150]] as Point2[]).entries()) { const at = nearestSpot(ctx, p, onSquare, 3); if (at) prop({ id: `square.planter.${i}`, kind: 'planter', at: [at[0], squareY, at[1]], yaw: 0, collide: false }); }
  const upper = tier('upperStreet');
  for (let i = 0; i < 6; i++) { const at = nearestSpot(ctx, [upper.x0 + 1.2, upper.z0 + 8 + i * 11], onSquare, 3); if (at && onTier('upperStreet', at[0], at[1])) prop({ id: `upper.planter.${i}`, kind: 'planter', at: [at[0], upper.y, at[1]], yaw: 0, collide: false }); }
  for (const [i, p] of ([[1476.5, 1196.5], [1472, 1199]] as Point2[]).entries()) { const at = nearestSpot(ctx, p, onSquare, 3); if (at) prop({ id: `cafe.east.${i}`, kind: 'cafeTable', at: [at[0], squareY, at[1]], yaw: 0.4 + i, variant: 1, collide: false }); }

  // A festoon along the café side: fixed to the fronts of the houses on the square's south edge, 3.4 over the paving,
  // sagging across the gaps (Classic warm bulbs; Taylor draws it as her one concert-light string; kit/props `festoon`).
  {
    const fronts = buildings.filter(b => b.id.startsWith('row.square-S.')).map(b => frontOf(b)).sort((p, q) => p.at[0] - q.at[0]);
    const line: Point3[] = fronts.flatMap(f => { const u: Point2 = [-f.n[1], f.n[0]]; return [-2.6, 2.6].map(o => [f.at[0] + f.n[0] * 0.15 + u[0] * o, squareY + 3.4, f.at[1] + f.n[1] * 0.15 + u[1] * o] as Point3); }).sort((p, q) => p[0] - q[0]);
    if (line.length >= 2) prop({ id: 'square.festoon', kind: 'festoon', at: line[Math.floor(line.length / 2)]!, yaw: 0, line, collide: false });
  }

  /* ---- the storefront lane's market (no prices, no lettering) ---- */
  const laneY = tier('storefrontLane').y;
  STALLS.forEach((p, i) => { const at = nearestSpot(ctx, p, { ...onSquare, clear: 1.6 }, 8); if (at) prop({ id: `stall.${i}`, kind: 'stall', at: [at[0], laneY, at[1]], yaw: Math.PI, variant: i, collide: false }); });
  props.filter(p => p.kind === 'stall').forEach((s, i) => { const at = nearestSpot(ctx, [s.at[0] + 2.2, s.at[2] - 0.8], { ...onSquare, clear: 0.8 }, 2); if (at) prop({ id: `stall.crate.${i}`, kind: 'crate', at: [at[0], laneY, at[1]], yaw: 0.3 * i, variant: i % 2, collide: false }); });

  /* ---- the quay: gozzi, nets and crates (SPEC §10) ---- */
  const quayClear: Spot = { clear: 0.3, onPad: true, houses };
  GOZZI_HAULED.forEach(([x, z, yaw, v], i) => { const at = nearestSpot(ctx, [x, z], { ...quayClear, clear: 0.6 }, 4); if (at) prop({ id: `gozzo.hauled.${i}`, kind: 'gozzo', at: [at[0], floorAt(ctx, at[0], at[1]), at[1]], yaw, variant: v, collide: false }); });
  GOZZI_MOORED.forEach(([x, z, yaw, v], i) => prop({ id: `gozzo.moored.${i}`, kind: 'gozzo', at: [x, -0.35, z], yaw, variant: v, collide: false }));
  NETS.forEach((p, i) => { const at = nearestSpot(ctx, p, quayClear, 4); if (at) prop({ id: `net.${i}`, kind: 'net', at: [at[0], floorAt(ctx, at[0], at[1]), at[1]], yaw: i * 1.1, variant: i, collide: false }); });
  CRATES.forEach((p, i) => { const at = nearestSpot(ctx, p, quayClear, 4); if (at) prop({ id: `crate.${i}`, kind: 'crate', at: [at[0], floorAt(ctx, at[0], at[1]), at[1]], yaw: 0.5 + i * 0.3, variant: i % 2, collide: false }); });

  /* ---- Giro del Porto: six buoys on the water (fixtures; PR 5 rows them) ---- */
  GIRO.forEach((p, i) => prop({ id: `giro.B${i}`, kind: 'buoy', at: [p[0], ctx.waterLevelAt(p[0], p[1]) ?? 0, p[1]], yaw: 0, variant: i === 0 ? 0 : 1, fixture: `giroDelPorto.B${i}`, collide: false }));

  /* ---- the harbour bell: a ship's bell at the campanile's foot (fixture; it answers the summit bell at noon) ---- */
  { const at = nearestSpot(ctx, [CAMPANILE.at[0] + 1.6, CAMPANILE.at[1] + 4.3], { clear: 1, onPad: false, houses: houses.filter((_, i) => buildings[i]!.id !== 'campanile'), houseClear: 0.3 }, 3);
    if (at) prop({ id: 'harbourBell', kind: 'bell', at: [at[0], ctx.heightAt(at[0], at[1]), at[1]], yaw: 0, variant: 1, fixture: 'harbourBell', collide: true }); }

  /* ---- thresholds: a rack beside each (STYLE §2.1 "Each has a threshold marker and a rack") ---- */
  const thresholds = HORIZON_MANIFEST.thresholds.filter(t => ['stairTop', 'quayWest', 'upperStreetSpur', 'floatDock'].includes(t.id)).map(t => ({ id: t.id, xy: t.xy as unknown as Point2 }));
  thresholds.push({ id: 'ferryLanding', xy: (HORIZON_MANIFEST.water_routes.FERRY.piers as Record<string, number[]>).landing as unknown as Point2 });
  for (const t of thresholds) {
    // Off the pad and the walk, on dry ground: seek out from the threshold (the docks' from their landward end).
    // The ferry pier is a deck 30 eu off the quay: its rack stands on the quay's edge opposite it.
    const seed: Point2 = t.id === 'floatDock' ? [t.xy[0] - 14, t.xy[1] - 6] : t.id === 'ferryLanding' ? [t.xy[0] - 4, t.xy[1] - 37] : t.xy;
    const at = nearestSpot(ctx, seed, { clear: 0.6, onPad: false, houses }, 10);
    if (at) prop({ id: `rack.${t.id}`, kind: 'bikeRack', at: [at[0], ctx.heightAt(at[0], at[1]), at[1]], yaw: yawToward(at, t.xy) + Math.PI / 2, collide: true });
  }

  /* ---- the belfry: the town's lookout and the dam view (STYLE §2.1; story eye `belfry`) ---- */
  const floorB = belfryFloor(), [bx, bz] = CAMPANILE.at, eye = storyEye('belfry');
  const damTarget: Point2 = [1316, 538], wheel = storyLandmark('wheel');
  prop({ id: 'belfry.viewer.dam', kind: 'viewer', at: [bx, floorB, bz - 1.45], yaw: yawToward([bx, bz], damTarget), collide: true });
  prop({ id: 'belfry.viewer.wheel', kind: 'viewer', at: [bx - 1.45, floorB, bz + 0.3], yaw: yawToward([bx, bz], [wheel.at[0], wheel.at[2]]), collide: true });
  prop({ id: 'belfry.panel', kind: 'panel', at: [bx + 1.4, floorB, bz + 0.9], yaw: -Math.PI / 2, variant: 2, collide: true });
  const lookouts: Lookout[] = [{ id: 'belfry', label: 'the belfry', eye: [eye.at[0], floorB + 1.6, eye.at[1]], facing: yawToward([bx, bz], damTarget), targets: ['wheel', 'dam', ...eye.targets.filter(t => t !== 'wheel')], viewer: 'standing', bestHour: 'golden hour' }];
  const l = storyLandmark('campanile');
  const landmarks: Landmark[] = [{ id: l.id, label: l.label, neighbourhood: 'harbour', at: l.at, top: l.top, ...(l.relayOrder ? { relayOrder: l.relayOrder } : {}), ...(l.bell ? { bell: l.bell } : {}) }];

  /* ---- the night order after the Court: the hosts' windows, the belfry, the floatplane dock ---- */
  for (const id of ['home', 'bank'] as const) { const h = ctx.hosts.find(q => q.id === id); const d = h?.door.xy; if (h && d) light(`${id}`, [d[0], (h.height ?? 0) + 0.8, d[1]], 'window', 'hosts'); }
  light('bell', [bx, floorB + 0.8, bz], 'belfry', 'belfry');
  { const t = thresholds.find(q => q.id === 'floatDock')!.xy;
    ([[-3.6, -8], [3.6, -8], [0, 9]] as Point2[]).forEach(([dx, dz], i) => light(`${i}`, [t[0] + dx, 2.2, t[1] + dz], 'runningLight', 'floatDock')); }

  /* ---- life: quay cats (placeholder tabbies, D11) and gulls ---- */
  life.push({ kind: 'cat', at: [1452.5, 3.8, 1305.6], radius: 5, count: 1 }, { kind: 'cat', at: [1489.5, 3.8, 1272.5], radius: 5, count: 1 }, { kind: 'cat', at: [1431, 12.5, 1175], radius: 6, count: 1 });
  for (const c of FISHING.cats) life.push({ kind: 'cat', at: c, radius: 1.5, count: 1 });
  life.push({ kind: 'gull', at: [1480, 20, 1290], radius: 50, count: 9 });

  return { props, lights, landmarks, lookouts, life, lanternRow };
}

/** Whether a prop record is drawn inside the square's slab (used by the tests' pad rule). */
export const onTier = (id: TierId, x: number, z: number) => { const t = tier(id); return x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1; };
