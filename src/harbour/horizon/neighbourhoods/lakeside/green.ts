/**
 * The Green (STORY place 2, morning → noon): the Old Oak and what it carries, the Oak Clock, the turf labyrinth, the apiary,
 * the kites, the mown desire lines and benches, the Lantern Ring, the rim fixtures (windsock, windpump, Meadow Pavilion, hay
 * bales), the rim groves, the meadow's drifts and long grass, and the Green's life. Ported from /protos/green (SPEC v2) on
 * the real context; every count, keep-out and clearance is here, one definition (D-WW110…119).
 *
 * The protected Green (STYLE §1.4.1 rule 12 as amended): inside r 160 nothing stands over 0.85 eu but the oak (a plant at
 * its own landmark's base) and what it carries — the rope swing and the kites, listed in `allowInProtected`.
 */
import type { LightAnchor, Point2, Point3 } from '../../world/definition.ts';
import type { BuildingRecord, DressingContext, GroundPaint, Landmark, LifeSpawn, PlantRecord, PropRecord } from '../types.ts';
import { FLOWER_SET } from '../../kit/plants/sets.ts';
import {
  APIARY, APRIL, BALES, BASKETS, CENTRE, CLOCK_R, DROP_ZONE, FIELD_R, LAB_ENTRANCE, LAB_GAP, LAB_PATH, LAB_R, LAB_RINGS, LABYRINTH, MEADOW, OAK_AT, OAK_BEARING_TO_FIELD,
  OAK_CROWN, OAK_HEIGHT, OAK_YAW, PAVILION, PROTECT_R, RING_POST_R, RING_SLOTS, RING_STONE_CLEAR, RING_WALK_R, STAIR_FOOT, WINDPUMP, WINDSOCK,
  arcQuads, bearing, bend, disc, dist, inPolygon, monthStones, polar, quadStrip, swingPlan, yawToward,
} from './plan.ts';

export type GreenOut = { buildings: BuildingRecord[]; plants: PlantRecord[]; props: PropRecord[]; ground: GroundPaint[]; life: LifeSpawn[]; lights: LightAnchor[]; landmarks: Landmark[]; allow: string[] };

/** The ground helpers every part shares (all from the context). */
export function groundKit(ctx: DressingContext) {
  const h = (x: number, z: number) => ctx.heightAt(x, z);
  const slope = (x: number, z: number) => { const e = 1.5; return Math.max(Math.abs(h(x + e, z) - h(x - e, z)), Math.abs(h(x, z + e) - h(x, z - e))) / (2 * e); };
  /** Plantable / placeable: off every bed by `road`, off pads, solids and water by `margin`, not steep. */
  const ok = (x: number, z: number, road = 4, margin = 0.6, maxSlope = 0.55) => ctx.bedClearance(x, z) > road && !ctx.occupied(x, z, margin) && ctx.waterLevelAt(x, z) === null && slope(x, z) < maxSlope;
  const at3 = (p: Point2, lift = 0): Point3 => [p[0], h(p[0], p[1]) + lift, p[1]];
  return { h, slope, ok, at3 };
}

export function buildGreen(ctx: DressingContext): GreenOut {
  const { h, slope, ok, at3 } = groundKit(ctx);
  const out: GreenOut = { buildings: [], plants: [], props: [], ground: [], life: [], lights: [], landmarks: [], allow: [] };
  const rng = (seed: string) => ctx.rng(`lakeside.${seed}`);
  const rCentre = (x: number, z: number) => dist([x, z], CENTRE);
  const nearBasket = (x: number, z: number, r = 4) => BASKETS.some(b => dist(b, [x, z]) < r);

  /* ------------------------------------------------------------------ 1. the Old Oak and what it carries */
  const oakY = h(OAK_AT[0], OAK_AT[1]);
  out.plants.push({ species: 'oakGiant', at: [OAK_AT[0], oakY, OAK_AT[1]], scale: 1, yaw: OAK_YAW, tint: 0.5, keep: true });
  out.landmarks.push({ id: 'oak', label: 'the Old Oak', neighbourhood: 'lakeside', at: [OAK_AT[0], oakY, OAK_AT[1]], top: [OAK_AT[0], oakY + OAK_HEIGHT, OAK_AT[1]], relayOrder: 3, yaw: OAK_YAW });
  // The ring bench at r 6.2 (16 segments, back 0.85, sitters facing out), on the mean ground of its ring.
  const ringY = Array.from({ length: 16 }, (_, k) => h(OAK_AT[0] + Math.sin(k / 16 * Math.PI * 2) * 6.2, OAK_AT[1] + Math.cos(k / 16 * Math.PI * 2) * 6.2)).reduce((a, b) => a + b, 0) / 16;
  out.props.push({ id: 'green.oak.ringBench', kind: 'ringBench', at: [OAK_AT[0], ringY, OAK_AT[1]], yaw: 0, collide: true });
  // The rope swing on the long WNW limb (bearing ≈ 299°): the ropes from the limb to a seat 0.5 over the turf.
  const sw = swingPlan(), swingGround = h(sw.at[0], sw.at[1]);
  out.props.push({ id: 'green.oak.swing', kind: 'swing', at: [sw.at[0], swingGround, sw.at[1]], yaw: OAK_YAW, scale: +(oakY + sw.ropeTop - swingGround).toFixed(3) });
  out.allow.push('green.oak.swing');
  // Three picnic tables at the drip line on the meadow side (bearings ≈ 296°, 319°, 345°), long side along the drip line.
  [-0.05, 0.35, 0.8].forEach((off, i) => {
    const b = OAK_BEARING_TO_FIELD + (off * 180) / Math.PI, p = polar(OAK_AT, b, OAK_CROWN - 3);
    out.props.push({ id: `green.oak.table.${i + 1}`, kind: 'picnicTable', at: at3(p), yaw: yawToward(b), collide: true });
  });
  // The Oak Clock: twelve month stones (January north, clockwise), each facing the trunk, on a mown ring.
  for (const s of monthStones()) out.props.push({ id: `green.clock.${String(s.month + 1).padStart(2, '0')}`, kind: 'monthStone', at: at3(s.at), yaw: yawToward((s.bearing + 180) % 360), variant: s.month, collide: true });
  const paint = (polys: Point2[][], surface: GroundPaint['surface'], tone: number) => { for (const polygon of polys) out.ground.push({ polygon, surface, tone }); };
  paint(arcQuads(OAK_AT, CLOCK_R, 2.2, 0, 360), 'mown', 0.75);
  // The packed earth at the foot where everyone sits, under the ring bench (the crown's shade is its contact shadow).
  paint(arcQuads(OAK_AT, 5.9, 4.2, 0, 360, 1.4), 'duff', 0.95);

  /* ------------------------------------------------------------------ 2. the turf labyrinth (paint + long grass) */
  const g = LAB_ENTRANCE, gapDeg = (LAB_GAP * 180) / Math.PI;
  for (const r of LAB_RINGS) {
    // Each circuit runs from just past the entrance gap round to just before it, in pieces of ≤ 120°.
    const a0 = g + gapDeg, a1 = g + 360 - gapDeg;
    paint(arcQuads(LABYRINTH, r, LAB_PATH, a0, a1, 1.2), 'mown', 1);
  }
  paint(quadStrip([polar(LABYRINTH, g, LAB_R + 3), polar(LABYRINTH, g, LAB_RINGS[6] + LAB_PATH / 2)], LAB_PATH), 'mown', 1);
  for (let i = 0; i < 6; i++) { const b = g + (i % 2 ? gapDeg : -gapDeg) * 0.6; paint(quadStrip([polar(LABYRINTH, b, LAB_RINGS[i]! + LAB_PATH / 2), polar(LABYRINTH, b, LAB_RINGS[i + 1]! - LAB_PATH / 2)], LAB_PATH), 'mown', 1); }
  out.ground.push({ polygon: disc(LABYRINTH, 1.5, 12), surface: 'travertine', tone: 0.5 });
  // The walls: long grass between the circuits, broken at the entrance and where the path turns.
  { const r = rng('labyrinth.walls');
    const walls = [2, ...LAB_RINGS.slice(0, -1).map((x, i) => (x + LAB_RINGS[i + 1]!) / 2), LAB_R + 0.4];
    walls.forEach((wr, i) => {
      const n = Math.round((Math.PI * 2 * wr) / 0.5);
      for (let k = 0; k < n; k++) {
        const b = (k / n) * 360, da = Math.abs(((b - g + 540) % 360) - 180);
        if (da < (i === walls.length - 1 ? 4 : 2.6) || (i > 0 && i < walls.length - 1 && Math.abs(da - gapDeg * 0.6) < 2.4)) continue;
        const p = polar(LABYRINTH, b + (r() - 0.5) * 1.2, wr + (r() - 0.5) * 0.3);
        out.plants.push({ species: 'grassTuft', at: at3(p), scale: 0.95 + r() * 0.45, yaw: r() * 6.283, tint: FLOWER_SET.meadow + r() * 0.99 });
      }
    });
  }

  /* ------------------------------------------------------------------ 3. the apiary in the clover */
  for (let k = 0; k < 6; k++) {
    const phi = -0.9 + k * 0.32, p: Point2 = [APIARY[0] + Math.cos(phi) * 7, APIARY[1] + Math.sin(phi) * 7];
    out.props.push({ id: `green.apiary.hive.${k + 1}`, kind: 'hive', at: at3(p), yaw: Math.atan2(Math.cos(phi), Math.sin(phi)), variant: k, collide: true });
  }

  /* ------------------------------------------------------------------ 4. kites over the April station (tree and sky) */
  // Stakes off the station pad; the kites fly north on the south wind.
  ([[[959, 986], [955, 957.4], 26, 0], [[949, 1009], [951, 979], 19, 1]] as const).forEach(([stake, kite, up, v], i) => {
    const s = at3(stake as unknown as Point2), id = `green.kite.${i + 1}`;
    out.props.push({ id, kind: 'kite', at: s, yaw: 0, variant: v, line: [[s[0], s[1] + 0.5, s[2]], [kite[0], s[1] + up, kite[1]]] });
    out.allow.push(id);
  });

  /* ------------------------------------------------------------------ 5. mown desire lines and benches */
  const labMouth = polar(LABYRINTH, g, LAB_R + 3);
  const lines: [Point2, Point2, number][] = [
    [labMouth, polar(OAK_AT, OAK_BEARING_TO_FIELD - 52, CLOCK_R + 1.8), 0.12],
    [[DROP_ZONE[0] + 40, DROP_ZONE[1] + 30], polar(OAK_AT, OAK_BEARING_TO_FIELD + 23, CLOCK_R + 1.8), -0.1],
    [[971, 1016], polar(APIARY, 350, 10), 0.15],
    // From the Glasshouse stair-and-ramp's foot landing onto the Green: to the labyrinth and to the landing field.
    [STAIR_FOOT, polar(LABYRINTH, g, LAB_R + 3.5), -0.14],
    [STAIR_FOOT, [DROP_ZONE[0] + 2, DROP_ZONE[1] - FIELD_R - 3], 0.08],
  ];
  const keepOff = (x: number, z: number) => dist([x, z], LABYRINTH) < LAB_R + 2.2 || dist([x, z], OAK_AT) < CLOCK_R + 1.4 || dist([x, z], DROP_ZONE) < FIELD_R + 1;
  for (const [a, b, k] of lines) {
    let run: Point2[] = [];
    const flush = () => { if (run.length >= 3) paint(quadStrip(run, 1.8, 1.5), 'mown', 0.75); run = []; };
    for (const p of bend(a, b, k)) { if (ctx.bedClearance(p[0], p[1]) > 1.6 && !ctx.occupied(p[0], p[1], 1) && !keepOff(p[0], p[1])) run.push(p); else flush(); }
    flush();
  }
  const bench = (id: string, p: Point2, facing: number) => out.props.push({ id: `green.bench.${id}`, kind: 'bench', at: at3(p), yaw: yawToward(facing), collide: true });
  bench('field', [DROP_ZONE[0] + 4, DROP_ZONE[1] - FIELD_R - 4], 180);
  bench('labyrinth', polar(LABYRINTH, g + 28, LAB_R + 3.2), (g + 28 + 180) % 360);
  bench('apiary', [APIARY[0] - 4, APIARY[1] + 8], 70);
  bench('stairFoot', [STAIR_FOOT[0] + 7, STAIR_FOOT[1] + 6], 160);
  bench('clockWest', polar(OAK_AT, OAK_BEARING_TO_FIELD - 20, CLOCK_R + 3.2), (OAK_BEARING_TO_FIELD - 20 + 180) % 360);

  /* ------------------------------------------------------------------ 6. the Lantern Ring (outside r 160) */
  const stones = monthStones().map(s => s.at), ringWalk: Point2[][] = [];
  { let run: Point2[] = [];
    for (let k = 0; k <= 360; k++) {
      // (none in the bight or the lakeside districts: their lite budgets are spent by their baked land, D-WW115)
      const p = polar(CENTRE, k, RING_WALK_R), dd = ctx.districtAt(p[0], p[1]), good = ctx.bedClearance(p[0], p[1]) > 4 && !ctx.occupied(p[0], p[1], 1) && slope(p[0], p[1]) < 0.5 && h(p[0], p[1]) > 3 && dd !== 'bight' && dd !== 'lakeside';
      if (good && k < 360) run.push(p); else { if (run.length >= 3) ringWalk.push(run); run = []; }
    }
    for (const w of ringWalk) paint(quadStrip(w, 2, 1.5), 'mown', 0.75);
  }
  const posts: { p: Point2; b: number }[] = [];
  for (let k = 0; k < RING_SLOTS; k++) {
    // Slot k from due east clockwise (prototype); re-spaced along the ring (≤ ±6°) to clear the month stones by 8 m.
    const b0 = 90 + (k * 360) / RING_SLOTS;
    for (const db of [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6]) {
      const b = b0 + db, p = polar(CENTRE, b, RING_POST_R);
      if (stones.some(s => dist(s, p) < RING_STONE_CLEAR) || nearBasket(p[0], p[1]) || ctx.bedClearance(p[0], p[1]) < 5 || ctx.occupied(p[0], p[1], 0.6) || slope(p[0], p[1]) > 0.5 || h(p[0], p[1]) < 3) continue;
      // The bight's lite budget is spent (index 59.4k of 60k): its stretch of the ring is lit by the Meadow Pavilion's lantern.
      if (ctx.districtAt(p[0], p[1]) === 'bight') break;
      posts.push({ p, b }); break;
    }
  }
  // Night order: the ring lights outward from the oak both ways (it is the oak's relay light, STORY §4.4).
  const oakB = bearing(CENTRE, OAK_AT), ang = (b: number) => Math.abs(((b - oakB + 540) % 360) - 180);
  [...posts].sort((a, b) => ang(a.b) - ang(b.b) || a.b - b.b).forEach((q, order) => {
    const id = `green.lanternRing.${String(Math.round(q.b) % 360).padStart(3, '0')}`, y = h(q.p[0], q.p[1]);
    out.props.push({ id, kind: 'lantern', at: [q.p[0], y, q.p[1]], yaw: yawToward(bearing(q.p, CENTRE)), collide: true });
    out.lights.push({ id, at: [q.p[0], y + 2.83, q.p[1]], kind: 'lantern', head: [q.p[0], y + 2.83, q.p[1]], pool: [q.p[0], y, q.p[1]], poolRadius: 3.5, line: 'green.lanternRing', order: order + 1 });
  });

  /* ------------------------------------------------------------------ 7. rim fixtures */
  // The windsock on the south rim, the glider approach: mouth into the south wind, the sock streaming north.
  out.props.push({ id: 'green.windsock', kind: 'windsock', at: at3(WINDSOCK), yaw: Math.PI, collide: true });
  // The windpump (wheel to the south wind, tail vane north) with its tank and trough.
  out.buildings.push({ id: 'green.windpump', districtId: '', kind: 'windpump', style: 'shared', at: at3(WINDPUMP, 0.1), yaw: 0, size: { w: 3.4, d: 3.4, h: 11 }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'none' }, collide: true });
  // The Meadow Pavilion on the west rim, its open bay toward the Bight (south-west).
  { const g8 = Array.from({ length: 8 }, (_, k) => h(PAVILION[0] + Math.cos(k * Math.PI / 4) * 4.1, PAVILION[1] + Math.sin(k * Math.PI / 4) * 4.1));
    out.buildings.push({ id: 'green.pavilion', districtId: '', kind: 'pavilion', style: 'shared', at: [PAVILION[0], Math.max(...g8) + 0.3, PAVILION[1]], yaw: yawToward(225), size: { w: 7.2, d: 7.2, h: 3.1 }, roof: { form: 'cone', pitch: 0, overhang: 1, material: 'slate' }, door: { face: 'front', u: 0 }, collide: true });
    out.lights.push({ id: 'green.pavilion.lantern', at: [PAVILION[0], Math.max(...g8) + 0.3 + 2.6, PAVILION[1]], kind: 'lantern', line: 'green.lanternRing', order: posts.length + 1 }); }
  // Round hay bales on the south slope below the ring.
  { const r = rng('bales'); let n = 0;
    for (let k = 0; k < 40 && n < 9; k++) {
      const x = BALES[0] + (r() - 0.5) * 60, z = BALES[1] + (r() - 0.5) * 18, yaw = r() * 3;
      if (!ok(x, z, 4, 1.5) || rCentre(x, z) < RING_WALK_R + 4 || out.props.some(p => p.kind === 'hayBale' && dist([p.at[0], p.at[2]], [x, z]) < 3.5)) continue;
      out.props.push({ id: `green.bale.${++n}`, kind: 'hayBale', at: at3([x, z], -0.05), yaw, collide: true });
    } }

  /* ------------------------------------------------------------------ 8. rim groves (maple, a fifth white elm), outside r 166 */
  const groves: { c: Point2; n: number; seed: string }[] = [
    { c: [872, 1168], n: 7, seed: 'west' },
    { c: [1222, 1012], n: 10, seed: 'east' },
    { c: [906, 962], n: 5, seed: 'northWest' },
  ];
  const trees: Point2[] = [];
  for (const gr of groves) {
    const r = rng(`grove.${gr.seed}`); let placed = 0;
    for (let t = 0; t < 400 && placed < gr.n; t++) {
      const a = r() * 360, rr = Math.sqrt(r()) * (6 + gr.n * 1.6), p = polar(gr.c, a, rr);
      if (!ok(p[0], p[1], 7, 1.5) || rCentre(p[0], p[1]) < PROTECT_R + 6 || dist(p, PAVILION) < 14 || dist(p, WINDPUMP) < 12 || nearBasket(p[0], p[1], 6) || ctx.districtAt(p[0], p[1]) === 'bight') continue;
      if (trees.some(q => dist(q, p) < 3.6) || posts.some(q => dist(q.p, p) < 4)) continue;
      const elm = r() < 0.2;
      trees.push(p); placed++;
      out.plants.push({ species: elm ? 'poplar' : 'round', at: at3(p), scale: elm ? 1.15 + r() * 0.25 : 1.35 + r() * 0.35, yaw: r() * 6.283, tint: r() });
    }
  }

  /* ------------------------------------------------------------------ 9. the meadow: drifts, dandelion clocks, long grass */
  const inMeadow = (x: number, z: number) => inPolygon(x, z, MEADOW) || rCentre(x, z) < PROTECT_R;
  const pathy = (x: number, z: number) => out.ground.some(gp => gp.surface === 'mown' && gp.polygon.length < 80 && dist(gp.polygon[0]!, [x, z]) < 60 && inPolygon(x, z, gp.polygon));
  const keepMeadow = (x: number, z: number) => dist([x, z], OAK_AT) < OAK_CROWN - 2 || Math.abs(dist([x, z], OAK_AT) - CLOCK_R) < 2.6 || dist([x, z], LABYRINTH) < LAB_R + 2.5 || dist([x, z], DROP_ZONE) < FIELD_R + 2
    || Math.abs(rCentre(x, z) - RING_WALK_R) < 2.2 || dist([x, z], APIARY) < 9 || nearBasket(x, z, 3) || ['bight', 'landing', 'reach', 'lakeside'].includes(ctx.districtAt(x, z));
  const drift = (x: number, z: number, set: number, units: number, yaw: number, r: () => number) => {
    const dx = Math.cos(yaw), dz = -Math.sin(yaw);
    for (let u = 0; u < units; u++) {
      const px = x + dx * (u - (units - 1) / 2) * 3.4 + (r() - 0.5) * 0.8, pz = z + dz * (u - (units - 1) / 2) * 3.4 + (r() - 0.5) * 0.8;
      if (!ok(px, pz, 4.5, 1.2) || keepMeadow(px, pz) || pathy(px, pz)) continue;
      out.plants.push({ species: 'flowerBed', at: at3([px, pz]), scale: 0.85 + r() * 0.35, yaw: yaw + (r() - 0.5) * 0.5, tint: set + r() * 0.99 });
    }
  };
  // Budget (D-WW115): ~85 beds (each drift 1–3 beds of one set) — most within 70 eu of where people stand and look.
  const FOCI: Point2[] = [OAK_AT, LABYRINTH, STAIR_FOOT, APIARY, DROP_ZONE, [990, 1185], WINDPUMP, [1075, 1085]];
  { const r = rng('meadow.drifts'); let made = 0;
    for (let k = 0; k < 3000 && made < 78; k++) {
      const focal = r() < 0.65, c = FOCI[Math.floor(r() * FOCI.length)]!, q = focal ? polar(c, r() * 360, 10 + Math.sqrt(r()) * 62) : [800 + r() * 500, 880 + r() * 380] as Point2, x = q[0], z = q[1];
      if (!inMeadow(x, z) || !ok(x, z, 4.5, 1.2) || keepMeadow(x, z)) continue;
      // Clover thick round the apiary; elsewhere the clover/daisy/Susan meadow, goldenrod and milkweed toward the rim.
      const nearHives = dist([x, z], APIARY) < 30, rim = rCentre(x, z) > 120;
      const set = nearHives ? FLOWER_SET.meadowWild : rim && r() < 0.55 ? FLOWER_SET.fieldEdge : FLOWER_SET.meadowWild;
      drift(x, z, set, 1 + Math.floor(r() * 3), r() * Math.PI, r); made++;
    } }
  // Dandelion clocks round the landing field's rim (June: they lift when a glider lands) and by the labyrinth.
  { const r = rng('meadow.clocks');
    for (let k = 0; k < 20; k++) {
      const c = k < 14 ? DROP_ZONE : LABYRINTH, rr = k < 18 ? FIELD_R + 4 + r() * 14 : LAB_R + 4 + r() * 10, p = polar(c, r() * 360, rr);
      if (!ok(p[0], p[1], 4.5, 1.2) || keepMeadow(p[0], p[1]) || pathy(p[0], p[1])) continue;
      drift(p[0], p[1], FLOWER_SET.clocks, 1, r() * Math.PI, r);
    } }
  // Long grass: a light scatter over the meadow, denser where the pages and the walkers look (the oak, the labyrinth, the stair foot).
  { const r = rng('meadow.tufts');
    const scatter = (n: number, pick: () => Point2) => { for (let k = 0; k < n; k++) { const [x, z] = pick(); if (!inMeadow(x, z) || !ok(x, z, 3.5, 0.8) || keepMeadow(x, z) || pathy(x, z)) continue; out.plants.push({ species: 'grassTuft', at: at3([x, z]), scale: 0.8 + r() * 0.5, yaw: r() * 6.283, tint: FLOWER_SET.meadow + r() * 0.99 }); } };
    scatter(3200, () => [800 + r() * 500, 880 + r() * 380]);
    for (const c of [OAK_AT, LABYRINTH, STAIR_FOOT, APIARY, WINDPUMP, DROP_ZONE]) scatter(650, () => polar(c, r() * 360, 4 + Math.sqrt(r()) * 50));
  }

  /* ------------------------------------------------------------------ 10. life (data; PR 5 plays it) */
  // Fireflies June–August, dusk to 23:00: a cloud under the oak and a scatter in the long grass (specks, not light cards).
  out.life.push({ kind: 'firefly', at: [OAK_AT[0], oakY + 1.5, OAK_AT[1]], radius: 34, count: 14, months: [6, 7, 8], hours: [21, 23] });
  out.life.push({ kind: 'firefly', at: at3(polar(CENTRE, 230, 90), 1), radius: 60, count: 8, months: [6, 7, 8], hours: [21, 23] });
  out.life.push({ kind: 'bee', at: at3(APIARY, 0.8), radius: 26, count: 6, months: [5, 6, 7, 8, 9], hours: [9, 18] });
  out.life.push({ kind: 'monarch', at: at3(polar(CENTRE, 260, 135), 1.2), radius: 40, count: 4, months: [8, 9], hours: [10, 17] });
  out.life.push({ kind: 'swallow', at: at3(DROP_ZONE, 6), radius: 70, count: 4, months: [5, 6, 7, 8], hours: [7, 20] });
  return out;
}
