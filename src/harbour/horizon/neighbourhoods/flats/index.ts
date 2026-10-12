/**
 * The Flats & the Bight (STORY place 6: golden hour → night; the lagoon, the dry Wash, the sky) — the neighbourhood dressing
 * module (`neighbourhoods/types.ts`), the approved hybrid airfield (STYLE §2.4 amended 2026-10-05, protos/flats SPEC.md,
 * RULINGS 3/4). A pure, deterministic function of the bake-time world (`ctx.rng` only).
 *
 * The airport's walk and collision contract (airport/layout.ts boxes and decks) is kept whole. Its re-skin — THE hangar as the
 * tin Quonset, the terminal as the timber prairie station, pictogram boards for its words, no windsock of its own — is drawn by
 * airport/art.ts from the same boxes (one definition: the boxes are both the art's and the collision's). Only the tower's
 * footprint gets a dressing building: the grain elevator, the place's landmark, which must also be a Journey-map building, a
 * sight-chain target and a relay light; it encloses the tower's boxes and bakes its own collision (D-WW160).
 *
 * In order (STYLE §1.4.1): clearings (the approach and side boxes, the campus, the geoglyph, the balloon field, the porch),
 * buildings (the elevator, the observatory, the Wash Arch's dressing, the hoodoos, the clump rocks), planting (planting.ts),
 * ground paint, props (the windsock, the geoglyph, the balloon, benches, racks, the hoarding sets, the jetty kit), lights in
 * night order, life, the landmark.
 */
import type { LightAnchor, Point2, Point3 } from '../../world/definition.ts';
import type { BuildingRecord, DressingContext, GroundPaint, Landmark, LifeSpawn, NeighbourhoodDressing, NeighbourhoodModule, PropRecord } from '../types.ts';
import { storyLandmark, EVENING_RELAY } from '../../world/story.ts';
import {
  BALLOON, BIGHT_BRIDGE_ARCH, BIGHT_PLOTS, ELEVATOR, GEOGLYPH_YAW, HANGAR_BAY, PORCH_BENCH, STARGAZING, THERMAL, WASH_ARCH, WASH_BAND, WASH_HOODOOS, WINDSOCK,
  breaksStrip, geoglyphCentre, nearestOn, plotPoint, stripPoint, yawToward,
} from './plan.ts';
import { plantFlats, type Rock } from './planting.ts';
import { baseHeight } from '../../land/terrain/index.ts';

const STYLE = 'flats.prairie';
const ROOF_FLAT = { form: 'flat' as const, pitch: 0, overhang: 0, material: 'rock' };

/**
 * STYLE §2.4 "Night face, in order" (the amended sheet): the windsock's red lamp → the runway rows (the airport's own art,
 * between 1 and 2) → the elevator's beacon and lit band → the hangar door lamp → the observatory's red path lamps → the
 * balloon's burner → the hoodoos lit softly from below. (The PR 4 brief listed the hangar door before the beacon; the sheet,
 * canon, wins: D-WW167.)
 */
export const FLATS_NIGHT_ORDER = ['windsock', 'elevatorBeacon', 'hangarDoor', 'observatoryPath', 'burner', 'hoodooGlow'] as const;
export const FLATS_LIGHT_LINE = 'flats:night';

function build(ctx: DressingContext): NeighbourhoodDressing {
  const g = (x: number, z: number) => ctx.heightAt(x, z);
  const d: NeighbourhoodDressing = { id: 'flats', buildings: [], plants: [], props: [], ground: [], pools: [], life: [], lights: [], landmarks: [], lookouts: [] };
  const B = (r: Omit<BuildingRecord, 'districtId' | 'style'> & { style?: string }) => { d.buildings.push({ districtId: '', style: STYLE, ...r }); };

  /* ---------------------------------------------------------------- buildings */

  // The grain elevator on the tower footprint: red clapboard, a plain band (no lettering), the stepped head-house, the beacon.
  B({ id: 'flats.elevator', kind: 'elevator', at: ELEVATOR.at, yaw: ELEVATOR.yaw, size: { ...ELEVATOR.size }, roof: { form: 'gable', pitch: 40, overhang: 0.35, material: 'tin' },
    door: { face: 'front', u: 0.45 }, params: { headH: ELEVATOR.headH, annex: true }, collide: true, landmarkId: 'elevator' });

  // The stargazing hut on its PR 2 pad (D-WW84): a 4.4 m drum and dome (top 4.5 ≤ 5), door to the deck (west), slit to the sky.
  const obs = STARGAZING.observatory;
  B({ id: 'flats.observatory', kind: 'observatory', at: [obs.xy[0], obs.top, obs.xy[1]], yaw: Math.PI / 2, size: { w: 4.4, d: 4.4, h: 2.4 }, roof: { form: 'cone', pitch: 0, overhang: 0, material: 'steel' },
    params: { allowOnBed: true }, collide: true });

  // The Wash Arch (D-WW85) is baked land (legs + lintel solids over S2): this record only DRAWS it as ochre drums over those
  // solids (collide false: the land's collision is the arch's). The kit's legs sit at ±(w/2 − legW/2) = ±9.6 = the baked
  // leg offset; the lintel's drawn underside stays at or above the baked 45.0 (the rider envelope's contract).
  const s2 = ctx.beds.find(b => b.id === 'S2');
  if (s2) {
    const n = nearestOn(s2.points, WASH_ARCH.at[0], WASH_ARCH.at[1]), nrm: Point2 = [n.dir[1], -n.dir[0]], top = WASH_ARCH.lintel.underside + WASH_ARCH.lintel.thickness_m - 0.1, floor = n.at[1];
    B({ id: 'flats.washArch', kind: 'arch', at: [n.at[0], floor, n.at[2]], yaw: Math.atan2(-nrm[1], nrm[0]), size: { w: 2 * (WASH_ARCH.legOffset_m + WASH_ARCH.legRadius_m[0]! * 1.5), d: WASH_ARCH.lintel.width_m + 0.6, h: top - floor }, roof: ROOF_FLAT, collide: false });
  }
  // The small hoodoo cluster on the five PR 2 footings (3–9 m drums in the ochre bands); they collide (what is drawn).
  // Wide at the foot (3.0–4.0 of the 4 m footing: the drum's base hides the footing's rise; talus planting takes its corners).
  const HOODOO_H = [6.6, 8.8, 4.4, 7.4, 3.4], HOODOO_W = [3.6, 4.0, 3.2, 3.8, 3.0];
  // Each stands on its footing's top: the land's own rule (land/structures/westLand.ts washArch: the highest of five samples of the
  // pre-structure ground `baseHeight` over the 4 × 4 footing, + rise), so the drum meets the plinth exactly (the test reads the solid).
  WASH_HOODOOS.xy.forEach(([x, z], i) => {
    const h = WASH_HOODOOS.footing_m / 2, top = Math.max(...[[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => baseHeight(x + a! * h, z + b! * h))) + WASH_HOODOOS.rise_m;
    B({ id: `flats.hoodoo.${i + 1}`, kind: 'hoodoo', at: [x, top, z], yaw: i * 1.3, size: { w: HOODOO_W[i]!, d: HOODOO_W[i]!, h: HOODOO_H[i]! }, roof: ROOF_FLAT, params: { allowOnBed: true }, collide: true });
  });

  /* ---------------------------------------------------------------- planting (clump rocks are buildings: they collide) */

  const planted = plantFlats(ctx);
  planted.rocks.forEach((r: Rock, i) => B({ id: `flats.rock.${i + 1}`, kind: 'hoodoo', at: [r.at[0], r.at[1], r.at[2]], yaw: r.yaw, size: { w: r.w, d: r.w, h: r.h }, roof: ROOF_FLAT, collide: true }));
  d.plants.push(...planted.plants);
  d.ground.push(...planted.ground);

  /* ---------------------------------------------------------------- ground paint */

  // The Wash's ochre floor and banks (STYLE §2.4 ground: `ochre` on the Wash and the strip's rim).
  d.ground.push({ polygon: WASH_BAND, surface: 'ochre', tone: 0.45 } satisfies GroundPaint);

  /* ---------------------------------------------------------------- props */

  const P = (p: PropRecord) => d.props.push(p);
  // The island's one windsock on its moved footing (RULINGS 3), streaming north on the shared south wind; its red lamp is the
  // kit's. On its 1 × 1 pad (a colliding prop may not stand on a pad: the footing's slab is its collision).
  P({ id: 'flats.windsock', kind: 'windsock', at: [WINDSOCK[0], g(WINDSOCK[0], WINDSOCK[1]) + 0.02, WINDSOCK[1]], yaw: Math.PI, collide: false });
  // The chalk bush-plane geoglyph, flat (≤ 0.2) on the north approach's centreline (nothing over 1 m in the approach box).
  const gc = geoglyphCentre();
  P({ id: 'flats.geoglyph', kind: 'geoglyph', at: [gc[0], g(gc[0], gc[1]), gc[1]], yaw: GEOGLYPH_YAW, scale: 1 });
  // The balloon at its mooring (MANIFEST sky.balloon): on the footing pad, so its basket draws without a collider (the ride is PR 5's).
  P({ id: 'flats.balloon', kind: 'balloon', at: [BALLOON[0], g(BALLOON[0], BALLOON[1]), BALLOON[1]], yaw: 0.4, collide: false });
  // The porch: the hangar's bench by the hangar bay, facing the Bight Bridge's arch over the rim, the strip and the take-offs on its right.
  P({ id: 'flats.porch.bench', kind: 'bench', at: [PORCH_BENCH[0], g(PORCH_BENCH[0], PORCH_BENCH[1]), PORCH_BENCH[1]], yaw: yawToward(PORCH_BENCH, BIGHT_BRIDGE_ARCH), collide: true });
  // The stargazing deck (D-WW84): three benches turned to the dark north sky, on the deck (no collider on a pad).
  const deck = STARGAZING.deck;
  for (const [k, dx] of [-3.4, 0, 3.4].entries()) P({ id: `flats.stargazing.bench.${k + 1}`, kind: 'bench', at: [deck.xy[0] + dx, deck.top, deck.xy[1] - 1.2], yaw: Math.PI + (k - 1) * 0.18, collide: false });
  // Racks at the thresholds the sheet names (feet on, wheels parked): the balloon, the stargazing walk's junction, the Flats pier.
  const rack = (id: string, near: Point2, yaw: number) => {
    for (let r = 4; r <= 12; r += 1) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, x = near[0] + Math.cos(a) * r, z = near[1] + Math.sin(a) * r;
      if (ctx.occupied(x, z, 1.6) || ctx.bedClearance(x, z) < 1.6 || ctx.districtAt(x, z) !== 'flats' || breaksStrip(x, z, 1.5)) continue;
      P({ id, kind: 'bikeRack', at: [x, g(x, z), z], yaw, collide: true }); return;
    }
  };
  rack('flats.rack.balloon', BALLOON, 0.4);
  rack('flats.rack.washRun', [480, 480], 0);
  rack('flats.rack.ferry', [285, 720], Math.PI / 2);
  // The hangar bay's hoarding set (a reserve: hoarding only, nothing collides on its pad). The bay's west half lies inside the
  // strip's 28 m side clearance (nothing over 1 m there), so the boards run on its east face and the east of its north edge,
  // with the one pictogram sign on that corner; the timber stack (0.6) by the service walk's end.
  const [bx, bz] = HANGAR_BAY.centre, ex = bx + HANGAR_BAY.size[0] / 2 - 0.4, nz = bz - HANGAR_BAY.size[1] / 2 + 0.4;
  P({ id: 'flats.bay.hoarding.e', kind: 'fence', at: [ex, 38, bz], yaw: 0, line: [[ex, 38, nz], [ex, 38, bz + HANGAR_BAY.size[1] / 2 - 0.4]], collide: false });
  P({ id: 'flats.bay.hoarding.n', kind: 'fence', at: [ex - 2.4, 38, nz], yaw: 0, line: [[ex - 4.6, 38, nz], [ex, 38, nz]], collide: false });
  P({ id: 'flats.bay.sign', kind: 'panel', at: [ex - 2.2, 38, nz - 0.3], yaw: Math.PI, variant: 0 });
  for (const [k, [dx, dz]] of ([[-3.6, -1.6], [-3.6, -0.4], [-2.4, -1.6]] as const).entries()) P({ id: `flats.bay.timber.${k + 1}`, kind: 'crate', at: [bx + dx, 38, bz + dz], yaw: 0.1 * k, variant: 0 });
  // Each plot's apron side is its −v edge (MANIFEST plot.bight.N.apron); its lagoon face is the edge whose ground falls furthest.
  const lagoonSide = (p: (typeof BIGHT_PLOTS)[number]) => ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([su, sv]) => { const q = plotPoint(p, su * (p.size[0] / 2 + 10), sv * (p.size[1] / 2 + 10)); return { su, sv, gz: g(q[0], q[1]) }; }).sort((a, b) => a.gz - b.gz)[0]!;
  for (const p of BIGHT_PLOTS) {
    const sign = plotPoint(p, 3, -p.size[1] / 2 + 1.2), out = plotPoint(p, 3, -p.size[1] / 2 - 10), stack = plotPoint(p, -p.size[0] / 2 + 6, -p.size[1] / 2 + 5);
    P({ id: `flats.${p.id}.sign`, kind: 'panel', at: [sign[0], g(sign[0], sign[1]), sign[1]], yaw: yawToward(sign, out), variant: 0 });
    P({ id: `flats.${p.id}.timber`, kind: 'crate', at: [stack[0], g(stack[0], stack[1]), stack[1]], yaw: p.rot, variant: 1 });
  }
  const benchPlot = BIGHT_PLOTS[2]!, side = lagoonSide(benchPlot), bp = plotPoint(benchPlot, side.su * (benchPlot.size[0] / 2 - 2.5), side.sv * (benchPlot.size[1] / 2 - 2.5));
  P({ id: 'flats.bightShore.bench', kind: 'bench', at: [bp[0], g(bp[0], bp[1]), bp[1]], yaw: yawToward(bp, plotPoint(benchPlot, side.su * 80, side.sv * 80)), collide: false });
  // The Bight pier: a life ring at its landward head (on the deck's edge, never on its tread; nothing stands on open water).
  const pier = ctx.beds.find(b => b.id === 'jetty.bightPier');
  if (pier && pier.points.length >= 2) {
    const pts = pier.points, w = (pier.width ?? 4) / 2 - 0.25;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, c = pts[i + 1]!, L = Math.hypot(c[0] - a[0], c[2] - a[2]) || 1, dir: Point2 = [(c[0] - a[0]) / L, (c[2] - a[2]) / L];
      let done = false;
      for (let t = 0; t <= L && !done; t += 0.5) for (const side of [1, -1]) {
        const x = a[0] + dir[0] * t + dir[1] * w * side, z = a[2] + dir[1] * t - dir[0] * w * side;
        if (ctx.waterLevelAt(x, z) !== null) continue;
        P({ id: 'flats.bightPier.lifeRing', kind: 'lifeRing', at: [x, a[1] + (c[1] - a[1]) * (t / L), z], yaw: Math.atan2(dir[1] * side, -dir[0] * side), collide: false }); done = true; break;
      }
      if (done) break;
    }
  }

  /* ---------------------------------------------------------------- lights, in the sheet's night order (anchors at ground) */

  // Each anchor is an emissive pool and bead (runtime/roadLights.ts draws non-road anchors 0.8 above their pool): set on the
  // ground under its light; the lamp itself is the kit's glow card (the sock's red lamp, the beacon's lens, the path lamps).
  const L = (key: (typeof FLATS_NIGHT_ORDER)[number], suffix: string, x: number, z: number, kind: string, floor = g(x, z)) => {
    d.lights.push({ id: `flats.${key}${suffix}`, at: [x, floor + 0.8, z], kind, line: FLATS_LIGHT_LINE, order: FLATS_NIGHT_ORDER.indexOf(key), bestHour: 'night' } satisfies LightAnchor);
  };
  L('windsock', '', WINDSOCK[0] - 1.2, WINDSOCK[1], 'obstruction');
  L('hangarDoor', '', 400, 597.2, 'door', 38);
  L('elevatorBeacon', '', ELEVATOR.at[0] + 6.2, ELEVATOR.at[2] + 2.1, 'beacon');
  L('observatoryPath', '', obs.xy[0] - 4.2, obs.xy[1], 'pathLamp', STARGAZING.h);
  L('burner', '', BALLOON[0] + 1.6, BALLOON[1] + 1.6, 'burner');
  for (const i of [1, 3]) { const [x, z] = WASH_HOODOOS.xy[i]!; L('hoodooGlow', `.${i + 1}`, x - 2.6, z, 'uplight'); }

  /* ---------------------------------------------------------------- life (STYLE §1.9; data, PR 5 animates) */

  d.life.push(
    { kind: 'swallow', at: [stripPoint(170, 0)[0], 40, stripPoint(170, 0)[1]], radius: 120, count: 8, months: [5, 6, 7, 8] } satisfies LifeSpawn,
    { kind: 'hawk', at: [THERMAL.xy[0], 90, THERMAL.xy[1]], radius: THERMAL.r, count: 3, hours: THERMAL.hours },
    { kind: 'butterfly', at: [470, 39, 760], radius: 60, count: 6, months: [6, 7, 8], hours: [9, 18] },
    { kind: 'gull', at: [660, 6, 1000], radius: 160, count: 8 },
  );

  /* ---------------------------------------------------------------- the landmark */

  const e = storyLandmark('elevator');
  d.landmarks.push({ id: 'elevator', label: e.label, neighbourhood: 'flats', at: [...e.at] as Point3, top: [...e.top] as Point3, relayOrder: (EVENING_RELAY.order as readonly string[]).indexOf('elevator') + 1 } satisfies Landmark);
  return d;
}

export const flatsModule: NeighbourhoodModule = { id: 'flats', build };
export default flatsModule;
