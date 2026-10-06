/**
 * Scholars' Edge: the built place — the Library re-dress, courtyard B on the south-west gable terrace, the Bight
 * lookout's Lookout kit on the built deck, the knee-height bollards on the garden walk and the spur, the racks at the
 * wheels → feet thresholds, the night order, the life, and the ground paint. Positions from the land (frame.ts) and the
 * approved prototype (protos/scholars SPEC "Courtyard B", "Bight lookout and spur"); the kits draw them in all three
 * dressings (the `scholars.library` style sheet; props by dressing).
 */
import type { LightAnchor, Point2, Point3 } from '../../world/definition.ts';
import { storyLandmark } from '../../world/story.ts';
import type { BuildingRecord, DressingContext, GroundPaint, Landmark, LifeSpawn, Lookout, PropRecord } from '../types.ts';
import { CEN, DECK, FLOOR, GLADES, LOOKOUT_EYE, SHELL_EAVE, SPUR_LINE, TERRACE_LEVEL, TERRACE_RECTS, SUN_WINDOW, W, WOODS_C, YAW, rectPolygon, sunWindowPolygon } from './frame.ts';
import { DISTRICT } from './woods.ts';

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const P3 = (x: number, y: number, z: number): Point3 => [r3(x), r3(y), r3(z)];
/** Yaw that turns a prop's front (local +z) toward plan direction (dx, dz). */
const facing = (dx: number, dz: number) => Math.atan2(dx, dz);
/** Yaw that lays a building's local x along plan direction (dx, dz). */
const along = (dx: number, dz: number) => Math.atan2(-dz, dx);

/** The Library's drawn shape inside the host's baked shell (kit `library` params, D-WW170). */
export const LIBRARY_DRAWN = { eaveH: 5.2, rise: 9.2, ridgeCap: 0.2 } as const;

/* ---------------------------------------------------------------- the Library */

export function library(ctx: DressingContext): { building: BuildingRecord; landmark: Landmark } {
  const host = ctx.hosts.find(h => h.id === 'library');
  if (!host?.footprint || host.footprint.length !== 4) throw new Error('scholars: the Library host has no baked footprint');
  const f = host.footprint, c: Point2 = [f.reduce((s, p) => s + p[0], 0) / 4, f.reduce((s, p) => s + p[1], 0) / 4];
  const e0 = Math.hypot(f[1]![0] - f[0]![0], f[1]![1] - f[0]![1]), e1 = Math.hypot(f[2]![0] - f[1]![0], f[2]![1] - f[1]![1]);
  // Local x along the long edge, local +z toward the door (the reading-room face).
  const long = e0 >= e1 ? [f[0]!, f[1]!] : [f[1]!, f[2]!], ux = (long[1]![0] - long[0]![0]) / Math.max(e0, e1), uz = (long[1]![1] - long[0]![1]) / Math.max(e0, e1);
  let yaw = along(ux, uz);
  const door = host.door.xy, front = door ? (door[0] - c[0]) * Math.sin(yaw) + (door[1] - c[1]) * Math.cos(yaw) : 1;
  if (front < 0) yaw += Math.PI;
  const floor = host.height ?? FLOOR, top = floor + LIBRARY_DRAWN.eaveH + LIBRARY_DRAWN.rise + LIBRARY_DRAWN.ridgeCap, story = storyLandmark('library');
  const building: BuildingRecord = {
    id: 'library', districtId: DISTRICT, kind: 'library', style: 'scholars.library', at: P3(c[0], floor, c[1]), yaw: r3(yaw),
    size: { w: r3(Math.max(e0, e1)), d: r3(Math.min(e0, e1)), h: r3(SHELL_EAVE) }, roof: { form: 'gable', pitch: 50, overhang: 0.9, material: 'copper' },
    door: { face: 'front', u: 0 }, params: { eaveH: LIBRARY_DRAWN.eaveH, rise: LIBRARY_DRAWN.rise }, collide: false, hostId: 'library', landmarkId: 'library',
  };
  const landmark: Landmark = { id: 'library', label: 'the Library', neighbourhood: 'scholars', at: P3(c[0], floor, c[1]), top: P3(c[0], top, c[1]), ...(story.relayOrder ? { relayOrder: story.relayOrder } : {}) };
  return { building, landmark };
}

/* ---------------------------------------------------------------- courtyard B */

type Edge = { u0: number; v0: number; u1: number; v1: number; out: [number, number] };
/** The terrace's outer edges (Library frame) and their outward normals; the gable side and the apron stay open. */
const TERRACE_EDGES: readonly Edge[] = (() => {
  const [main, north, door] = TERRACE_RECTS as [readonly number[], readonly number[], readonly number[]];
  return [
    { u0: main[0]!, v0: main[2]!, u1: main[0]!, v1: main[3]!, out: [-1, 0] },
    { u0: main[0]!, v0: main[3]!, u1: north[0]!, v1: main[3]!, out: [0, 1] },
    { u0: north[0]!, v0: north[2]!, u1: north[0]!, v1: north[3]!, out: [-1, 0] },
    { u0: north[0]!, v0: north[3]!, u1: door[1]!, v1: door[3]!, out: [0, 1] },
    { u0: main[0]!, v0: main[2]!, u1: main[1]!, v1: main[2]!, out: [0, -1] },
  ];
})();
export const COURT_WALL = { inset: 0.3, h: 1.05, d: 0.6, drop: 0.45, probe: 1.5, step: 1.5, minRun: 2.4 } as const;

/** Low stone walls along the terrace's battered edges where the ground falls away (> 0.45 m 1.5 m out): the
 * terrain-following `wall` kind, set 0.3 m in on the pad so it stands on the terrace level. */
export function courtyardWalls(ctx: DressingContext): BuildingRecord[] {
  const out: BuildingRecord[] = [];
  TERRACE_EDGES.forEach((e, ei) => {
    const len = Math.hypot(e.u1 - e.u0, e.v1 - e.v0), n = Math.max(1, Math.round(len / COURT_WALL.step)), du = (e.u1 - e.u0) / len, dv = (e.v1 - e.v0) / len;
    const drops: boolean[] = [];
    for (let k = 0; k <= n; k++) { const t = (k / n) * len, u = e.u0 + du * t + e.out[0] * COURT_WALL.probe, v = e.v0 + dv * t + e.out[1] * COURT_WALL.probe, [x, z] = W(u, v); drops.push(TERRACE_LEVEL - ctx.heightAt(x, z) > COURT_WALL.drop); }
    let k = 0, run = 0;
    while (k <= n) {
      if (!drops[k]) { k++; continue; }
      let j = k; while (j + 1 <= n && drops[j + 1]) j++;
      const t0 = Math.max(0, (k / n) * len - COURT_WALL.step / 2), t1 = Math.min(len, (j / n) * len + COURT_WALL.step / 2);
      if (t1 - t0 >= COURT_WALL.minRun) {
        const inU = -e.out[0] * COURT_WALL.inset, inV = -e.out[1] * COURT_WALL.inset, a = W(e.u0 + du * t0 + inU, e.v0 + dv * t0 + inV), b = W(e.u0 + du * t1 + inU, e.v0 + dv * t1 + inV);
        out.push({ id: `courtyard.wall.${ei}.${run++}`, districtId: DISTRICT, kind: 'wall', style: 'scholars.library', at: P3((a[0] + b[0]) / 2, TERRACE_LEVEL, (a[1] + b[1]) / 2), yaw: r3(along(b[0] - a[0], b[1] - a[1])),
          size: { w: r3(t1 - t0), d: COURT_WALL.d, h: COURT_WALL.h }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'stone' }, collide: true });
      }
      k = j + 1;
    }
  });
  return out;
}

/** The courtyard's furniture (still; pass 4 plays nothing here): reading tables with banker's lamps and chairs, benches
 * along the wall facing in, planters, the book cart, the bird feeder and the copper-hooded lantern. On the terrace pads,
 * so none collides (the bake keeps colliders off pads); the walls do. */
export function courtyardProps(): PropRecord[] {
  const at = (u: number, v: number): Point3 => { const [x, z] = W(u, v); return P3(x, TERRACE_LEVEL, z); };
  const inU = facing(Math.SQRT1_2, -Math.SQRT1_2), inNegV = facing(-Math.SQRT1_2, -Math.SQRT1_2);
  const props: PropRecord[] = [];
  [[-28, -6], [-33, 2], [-27, 10], [-14, 19.5]].forEach(([u, v], i) => props.push({ id: `courtyard.table.${i}`, kind: 'readingTable', at: at(u!, v!), yaw: r3(YAW + i * 0.6) }));
  [[-38.6, -8], [-38.6, 3], [-38.6, 12.5]].forEach(([u, v], i) => props.push({ id: `courtyard.bench.${i}`, kind: 'bench', at: at(u!, v!), yaw: r3(inU) }));
  props.push({ id: 'courtyard.bench.3', kind: 'bench', at: at(-29.5, 22.3), yaw: r3(inNegV) });
  [[-23.5, -12], [-38, -13.6], [-33.4, 22.2], [-5.6, 22.2]].forEach(([u, v], i) => props.push({ id: `courtyard.planter.${i}`, kind: 'planter', at: at(u!, v!), yaw: r3(YAW) }));
  props.push({ id: 'courtyard.bookCart', kind: 'bookCart', at: at(-23.6, 0), yaw: r3(facing(-Math.SQRT1_2, Math.SQRT1_2)) });
  props.push({ id: 'courtyard.birdFeeder', kind: 'birdFeeder', at: at(-24, 21.4), yaw: r3(YAW) });
  props.push({ id: 'courtyard.lantern', kind: 'lantern', at: at(-38.9, 16.4), yaw: r3(YAW) });
  return props;
}
/** The courtyard's flags: the three terrace pads as `travertine` paint (STYLE §2.3: plaza flags). */
export function courtyardFlags(): GroundPaint[] {
  return TERRACE_RECTS.map(([u0, u1, v0, v1], i) => ({ polygon: rectPolygon(u0, u1, v0, v1).map(([x, z]) => [r3(x), r3(z)] as Point2), surface: 'travertine', tone: 0.35 + i * 0.1 }));
}

/* ---------------------------------------------------------------- the Bight lookout (Lookout kit) */

export function lookoutSet(): { props: PropRecord[]; lookout: Lookout } {
  const y = DECK.top, e: Point2 = [LOOKOUT_EYE[0], LOOKOUT_EYE[2]], dir = (to: Point2) => r3(facing(to[0] - e[0], to[1] - e[1]));
  const west = storyLandmark('westwatch'), oak = storyLandmark('oak'), flats = storyLandmark('elevator'), lamp = storyLandmark('lamp');
  // Everything on the deck stands within 0.5 m of a rail (the deck is the bake's walk bed: its inner tread stays clear).
  const props: PropRecord[] = [
    { id: 'bightLookout.viewer.flats', kind: 'viewer', at: P3(DECK.x0 + 0.38, y, DECK.z1 - 0.42), yaw: dir([flats.at[0], flats.at[2]]), variant: 0, collide: true },
    { id: 'bightLookout.viewer.oak', kind: 'viewerSeated', at: P3(DECK.x1 - 0.38, y, DECK.z1 - 0.42), yaw: dir([oak.at[0], oak.at[2]]), variant: 1, collide: true },
    { id: 'bightLookout.viewer.westwatch', kind: 'viewer', at: P3(DECK.x1 - 0.38, y, DECK.z0 + 0.5), yaw: dir([west.at[0], west.at[2]]), variant: 2, collide: true },
    { id: 'bightLookout.bench', kind: 'bench', at: P3(DECK.x0 + 0.42, y, (DECK.z0 + DECK.z1) / 2 + 0.8), yaw: r3(facing(1, 0)), collide: true },
    { id: 'bightLookout.panel', kind: 'panel', at: P3(DECK.x0 + 0.4, y, DECK.z0 + 0.42), yaw: 0, variant: 3, collide: true },
    // The lantern on the west rail, behind the eye: the line to Westwatch leaves over the north-east corner (D-WW176).
    { id: 'bightLookout.lantern', kind: 'lantern', at: P3(DECK.x0 + 0.3, y, DECK.z0 + 1.45), yaw: 0, collide: true },
  ];
  const lookout: Lookout = { id: 'bightLookout', label: 'the Bight lookout', eye: P3(LOOKOUT_EYE[0], LOOKOUT_EYE[1], LOOKOUT_EYE[2]), facing: dir([lamp.at[0], lamp.at[2]]),
    targets: ['westwatch', 'elevator', 'oak', 'lamp'], viewer: 'both', bestHour: 'golden hour' };
  return { props, lookout };
}

/* ---------------------------------------------------------------- walks: bollards, racks */

export const BOLLARDS = { step: 14, offset: 2.0, reach: 150, poolRadius: 2 } as const;
/** Knee-height bollard lights along the garden walk (within 150 m of the woods' centre) and the lookout spur, alternating
 * sides 2 m off the centreline (STYLE §2.3 night face: dim, 2 eu pools). */
export function walkBollards(ctx: DressingContext): PropRecord[] {
  const garden = ctx.beds.find(b => b.id === 'walk garden')?.points.map(p => [p[0], p[2]] as Point2) ?? [];
  const runs: { id: string; line: Point2[]; step: number }[] = [{ id: 'garden', line: garden, step: BOLLARDS.step }, { id: 'spur', line: [...SPUR_LINE.slice(0, 4)], step: 9 }];
  const out: PropRecord[] = [];
  for (const run of runs) {
    let acc = run.step * 0.5, side = 1, k = 0;
    for (let i = 1; i < run.line.length; i++) {
      const a = run.line[i - 1]!, b = run.line[i]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-6) continue;
      const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
      for (let t = 0; t < len; t += 0.5) {
        acc += 0.5; if (acc < run.step) continue;
        const px = a[0] + (b[0] - a[0]) * (t / len), pz = a[1] + (b[1] - a[1]) * (t / len);
        if (Math.hypot(px - WOODS_C[0], pz - WOODS_C[1]) > BOLLARDS.reach) continue;
        for (const s of [side, -side]) {
          const x = px + nx * BOLLARDS.offset * s, z = pz + nz * BOLLARDS.offset * s;
          if (ctx.districtAt(x, z) !== DISTRICT || ctx.occupied(x, z, 0.3) || Math.hypot(x - CEN[0], z - CEN[1]) < 27) continue;
          out.push({ id: `walk.bollard.${run.id}.${k++}`, kind: 'bollard', at: P3(x, ctx.heightAt(x, z), z), yaw: r3(facing(-nx * s, -nz * s)), collide: true });
          acc = 0; side = -s; break;
        }
      }
    }
  }
  return out;
}

/** Bike racks where wheels give way to feet (STYLE §2.3 thresholds): where a road (the Library spur, Horizon Drive)
 * meets a walk or the spur meets Horizon Drive in the district, and at the spur's end by the Library; each on the walk's side, off every tread. */
export function thresholdRacks(ctx: DressingContext): PropRecord[] {
  const plan = (id: string) => ctx.beds.find(b => b.id === id)?.points.map(p => [p[0], p[2]] as Point2) ?? [];
  const roads = ['spur library', 'V01'], walks = ['walk coveWalk', 'yearWalk', 'walk garden', 'spur library'], spots: Point2[] = [];
  for (const r of roads) for (const w of walks) if (w !== r) for (const p of crossings(plan(r), plan(w))) if (ctx.districtAt(p[0], p[1]) === DISTRICT && !spots.some(s => Math.hypot(s[0] - p[0], s[1] - p[1]) < 8)) spots.push(p);
  const spur = plan('spur library'), end = spur.length ? (Math.hypot(spur[0]![0] - CEN[0], spur[0]![1] - CEN[1]) < Math.hypot(spur.at(-1)![0] - CEN[0], spur.at(-1)![1] - CEN[1]) ? spur[0]! : spur.at(-1)!) : null;
  if (end && !spots.some(s => Math.hypot(s[0] - end[0], s[1] - end[1]) < 8)) spots.push(end);
  const out: PropRecord[] = [];
  spots.forEach((p, i) => {
    // The nearest free spot 4–12 m from the crossing (rings of 12 bearings), facing it.
    for (let r = 4; r <= 12; r += 0.5) {
      let hit: Point2 | null = null;
      for (let k = 0; k < 12 && !hit; k++) { const a = (k / 12) * Math.PI * 2 + i, x = p[0] + Math.cos(a) * r, z = p[1] + Math.sin(a) * r; if (ctx.districtAt(x, z) === DISTRICT && !ctx.occupied(x, z, 1.6) && ctx.heightAt(x, z) > 30) hit = [x, z]; }
      if (hit) { out.push({ id: `threshold.rack.${i}`, kind: 'bikeRack', at: P3(hit[0], ctx.heightAt(hit[0], hit[1]), hit[1]), yaw: r3(along(p[0] - hit[0], p[1] - hit[1]) + Math.PI / 2), collide: true }); break; }
    }
  });
  return out;
}
function crossings(a: readonly Point2[], b: readonly Point2[]): Point2[] {
  const out: Point2[] = [];
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) {
    const p = a[i - 1]!, q = a[i]!, r = b[j - 1]!, s = b[j]!, d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]); if (Math.abs(d) < 1e-9) continue;
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return out;
}

/* ---------------------------------------------------------------- night, life, ground */

/** The night order (STYLE §2.3 night face; LIGHT §3): 0 the reading-room windows (the relay's last card, STORY §4.4),
 * 1 the knee-height bollards on the garden walk and the spur, 2 the courtyard lantern and the tables' banker's lamps,
 * 3 the lookout lantern. (4, the ferry's running lights on the Bight, is the ferry's.) Emissive cards only. */
export const NIGHT_ORDER = ['window', 'bollard', 'courtyard', 'lookout'] as const;
export const NIGHT_LINE = 'scholars:night';
export function nightLights(props: readonly PropRecord[]): LightAnchor[] {
  const out: LightAnchor[] = [], y = TERRACE_LEVEL;
  const order = (k: (typeof NIGHT_ORDER)[number]) => NIGHT_ORDER.indexOf(k);
  // Window spill: the door face either side of the porch and the south-west gable over the courtyard.
  ([[-12, 15.2, -12, 19, 9], [12, 15.2, 12, 19, 9], [-21.2, -4, -25, -2, 10], [-21.2, 6, -25, 6, 9]] as const).forEach(([hu, hv, pu, pv, r], i) => {
    const h = W(hu, hv), p = W(pu, pv);
    out.push({ id: `scholars.window.${i}`, at: P3(h[0], y + 2.6, h[1]), head: P3(h[0], y + 2.6, h[1]), pool: P3(p[0], y, p[1]), poolRadius: r, kind: 'window', line: NIGHT_LINE, order: order('window') });
  });
  for (const p of props) {
    if (p.kind === 'bollard') out.push({ id: `scholars.${p.id}`, at: p.at, head: P3(p.at[0], p.at[1] + 0.66, p.at[2]), pool: p.at, poolRadius: BOLLARDS.poolRadius, kind: 'bollard', line: NIGHT_LINE, order: order('bollard') });
    if (p.id === 'courtyard.lantern') out.push({ id: 'scholars.courtyard.lantern', at: p.at, head: P3(p.at[0], p.at[1] + 2.8, p.at[2]), pool: p.at, poolRadius: 5, kind: 'lantern', line: NIGHT_LINE, order: order('courtyard') });
    if (p.kind === 'readingTable') out.push({ id: `scholars.${p.id}.lamp`, at: p.at, head: P3(p.at[0], p.at[1] + 1.1, p.at[2]), pool: p.at, poolRadius: 2.2, kind: 'tableLamp', line: NIGHT_LINE, order: order('courtyard') });
    if (p.id === 'bightLookout.lantern') out.push({ id: 'scholars.bightLookout.lantern', at: p.at, head: P3(p.at[0], p.at[1] + 2.8, p.at[2]), pool: p.at, poolRadius: 4, kind: 'lantern', line: NIGHT_LINE, order: order('lookout') });
  }
  return out;
}

/** Chickadees at the feeder and in two glades (all year, by day); moths at the courtyard and lookout lanterns (night,
 * May–September). In priority order: lite keeps the first spawns up to 10 creatures. */
export function life(): LifeSpawn[] {
  const feeder = W(-24, 21.4), lantern = W(-38.9, 16.4), y = TERRACE_LEVEL;
  const summer = [5, 6, 7, 8, 9];
  return [
    { kind: 'chickadee', at: P3(feeder[0], y + 1.8, feeder[1]), radius: 6, count: 3, hours: [6, 19] },
    { kind: 'moth', at: P3(lantern[0], y + 3.2, lantern[1]), radius: 1.2, count: 6, months: summer, hours: [21, 4] },
    { kind: 'moth', at: P3(DECK.x0 + 0.3, DECK.top + 3, DECK.z0 + 1.45), radius: 1, count: 4, months: summer, hours: [21, 4] },
    { kind: 'chickadee', at: P3(GLADES[3]![0], 55, GLADES[3]![1]), radius: 18, count: 3, hours: [6, 19] },
    { kind: 'chickadee', at: P3(GLADES[0]![0], 52, GLADES[0]![1]), radius: 18, count: 2, hours: [6, 19] },
  ];
}
export const LIFE_CAP = { full: 24, lite: 10 } as const;

/** Moss (the `sedge` token, dark) on the floors of the glades a walk passes and on the sun window's near end; the
 * terrain's own duff carries the rest of the woods (land/terrain biomeGround: `duff` inside the Scholars' Edge landform).
 * Paint is draped in ≤ 2.5 eu triangles on both tiers, so it is spent where it is seen (D-WW174). */
export const MOSS = { gladeReach: 14, gladeShare: 0.62, sunWindowTo: 40 } as const;
export function mossPaint(ctx: DressingContext): GroundPaint[] {
  const out: GroundPaint[] = [];
  for (const [gx, gz, r] of GLADES) {
    if (ctx.districtAt(gx, gz) !== DISTRICT || ctx.bedClearance(gx, gz) > r + MOSS.gladeReach) continue;
    const poly: Point2[] = Array.from({ length: 9 }, (_, k) => { const a = (k / 9) * Math.PI * 2, rr = r * MOSS.gladeShare * (0.85 + 0.15 * Math.sin(k * 2.3 + gx)); return [r3(gx + Math.cos(a) * rr), r3(gz + Math.sin(a) * rr)] as Point2; });
    out.push({ polygon: poly, surface: 'sedge', tone: 0.15 });
  }
  const sw = sunWindowPolygon(), near = sw[0]!, far0 = sw[1]!, far1 = sw[2]!, nearB = sw[3]!, t = (MOSS.sunWindowTo - SUN_WINDOW.near) / (SUN_WINDOW.far - SUN_WINDOW.near);
  const mid = (a: Point2, b: Point2): Point2 => [r3(a[0] + (b[0] - a[0]) * t), r3(a[1] + (b[1] - a[1]) * t)];
  out.push({ polygon: [[r3(near[0]), r3(near[1])], mid(near, far0), mid(nearB, far1), [r3(nearB[0]), r3(nearB[1])]], surface: 'sedge', tone: 0.3 });
  return out;
}
