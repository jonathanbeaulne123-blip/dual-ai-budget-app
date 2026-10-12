/**
 * The Flats & the Bight planting (STYLE §1.4.1 grammar, §2.4 sheet, protos/flats §9–§10), after the clearings:
 *  - A's tallgrass: little bluestem (`prairieGrass`, ≤ 0.99 m so it may stand in the approach box) in drifts following one fbm
 *    field, crowberry/lichen mats (`heath`) threading the drift edges, coneflower/yarrow/bergamot drifts (`flowerBed`, the
 *    prairie set; Newfoundland's set carries the lupine) at the drift cores and along the strip's edges;
 *  - B's steppe: rock clumps (1–2 low strata drums, sunk 30 %) with 3–5 junipers and red cedars 3–8 m in their lee (north, the
 *    shared south wind), sage mounds and junipers on the Wash's banks (≥ 6 m off S2), never in the approach or side boxes;
 *  - the one wind-shaped pine by the Quonset; juniper and cedar thickening into spruce and balsam toward Scholars along the Drive;
 *  - the Bight: eelgrass at the shallow margins, marram, thrift and rugosa on the plots' battered lagoon faces.
 * Tree cover over the landform stays ≤ 3 % (≈ 1 %), open ground ≥ 70 %. Deterministic (`ctx.rng` streams only).
 */
import type { Point2, Point3 } from '../../world/definition.ts';
import type { DressingContext, DressingSpecies, GroundPaint, PlantRecord } from '../types.ts';
import {
  BALLOON, BIGHT_PLOTS, CROWN_RADIUS, FLATS_LANDFORM, PINE, PORCH_BENCH, BIGHT_BRIDGE_ARCH, WASH_BAND, WASH_HOODOOS, breaksStrip, fbm,
  inAirport, inElevator, inGeoglyph, plotPoint, pointInPoly,
} from './plan.ts';

export type Rock = { at: Point3; w: number; h: number; yaw: number };
/** Nominal plant heights at scale 1 for the species planted here (neighbourhoods/bake.ts SPECIES_HEIGHT, never smaller). */
const PLANT_HEIGHT: Partial<Record<DressingSpecies, number>> = { prairieGrass: 0.9, heath: 0.5, flowerBed: 0.4, grassTuft: 0.4, sedge: 0.6, shrub: 1.3, juniper: 3, cedar: 10, pine: 8, spruce: 11, balsam: 9 };
export interface FlatsPlanting { plants: PlantRecord[]; rocks: Rock[]; ground: GroundPaint[] }

/** Counts the plan aims at (the test reads them). */
export const FLATS_PLANTING = { clumps: 40, clumpSpacing: 26, eelgrass: 64, shorePerPlot: 36 } as const;

export function plantFlats(ctx: DressingContext): FlatsPlanting {
  const g = (x: number, z: number) => ctx.heightAt(x, z);
  const slope = (x: number, z: number) => Math.hypot(g(x + 1, z) - g(x - 1, z), g(x, z + 1) - g(x, z - 1)) / 2;
  const plants: PlantRecord[] = [], rocks: Rock[] = [], ground: GroundPaint[] = [];
  // The porch's clearing holds for every planting below (nothing over 0.5 there; heights as the bake's SPECIES_HEIGHT).
  const add = (species: DressingSpecies, x: number, z: number, scale: number, yaw: number, extra: Partial<PlantRecord> = {}) => {
    if ((PLANT_HEIGHT[species] ?? 10) * scale > 0.5 && inPorchClearing(x, z)) return;
    plants.push({ species, at: [x, g(x, z), z], scale, yaw, ...extra });
  };
  const onFlats = (x: number, z: number) => ctx.districtAt(x, z) === 'flats' && pointInPoly(x, z, FLATS_LANDFORM);
  /** Free unbuilt ground on the Flats: no bed, pad, water or solid within `m`, not the campus, the elevator or the sea. */
  const free = (x: number, z: number, m: number) => onFlats(x, z) && g(x, z) > 3 && !ctx.occupied(x, z, m) && !inAirport(x, z, m + 0.5) && !inElevator(x, z, m);
  // The porch's frame: nothing taller than the grass in a 24° cone from the hangar's bench toward the Bight Bridge's arch.
  const porchDir = Math.atan2(BIGHT_BRIDGE_ARCH[0] - PORCH_BENCH[0], BIGHT_BRIDGE_ARCH[1] - PORCH_BENCH[1]);
  const inPorchFrame = (x: number, z: number) => { const dx = x - PORCH_BENCH[0], dz = z - PORCH_BENCH[1], a = Math.atan2(dx, dz) - porchDir; return Math.hypot(dx, dz) < 260 && Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < (12 * Math.PI) / 180; };
  // The porch's own clearing: short turf for 7 m round the bench and along the frame's first 45 m, so the seated eye (0.98)
  // looks over the grass, not into it.
  const inPorchClearing = (x: number, z: number) => Math.hypot(x - PORCH_BENCH[0], z - PORCH_BENCH[1]) < 7 || (inPorchFrame(x, z) && Math.hypot(x - PORCH_BENCH[0], z - PORCH_BENCH[1]) < 45);
  const tall = (x: number, z: number, r: number) => !breaksStrip(x, z, r) && !inGeoglyph(x, z, 8) && Math.hypot(x - BALLOON[0], z - BALLOON[1]) > 26 && !inPorchFrame(x, z);

  /* ---------------------------------------------------------------- A's tallgrass drifts */
  {
    const r = ctx.rng('flats.prairie');
    for (let z = 336; z <= 1004; z += 3.1) for (let x = 300; x <= 565; x += 3.1) {
      const px = x + (r() - 0.5) * 2.6, pz = z + (r() - 0.5) * 2.6, n = fbm(px * 0.03, pz * 0.03), roll = r(), yaw = r() * 6.283, sc = r();
      if (n < 0.02 || !free(px, pz, 0.6) || slope(px, pz) > 0.45 || inGeoglyph(px, pz, 6) || pointInPoly(px, pz, WASH_BAND) || inPorchClearing(px, pz)) continue;
      add('prairieGrass', px, pz, 0.8 + sc * 0.3, yaw, { tint: n });
      // Drift cores thicken (two, then three tufts a cell) so the drifts read as patches of grass, not an even scatter.
      if (n > 0.2 && roll < 0.7) { const qx = px + 1.3 * Math.cos(yaw), qz = pz + 1.3 * Math.sin(yaw); if (free(qx, qz, 0.6) && !inGeoglyph(qx, qz, 6) && !inPorchClearing(qx, qz)) add('prairieGrass', qx, qz, 0.85 + sc * 0.25, yaw + 1, { tint: n }); }
      if (n > 0.4 && roll < 0.6) { const qx = px - 1.2 * Math.sin(yaw), qz = pz + 1.2 * Math.cos(yaw); if (free(qx, qz, 0.6) && !inGeoglyph(qx, qz, 6) && !inPorchClearing(qx, qz)) add('prairieGrass', qx, qz, 0.9 + sc * 0.2, yaw + 2, { tint: n }); }
      else if (n < 0.12 && roll < 0.2) { const qx = px - 1.1, qz = pz + 0.8; if (free(qx, qz, 0.6) && !inPorchClearing(qx, qz)) add('heath', qx, qz, 0.9 + sc * 0.4, yaw, { tint: 0.3 + sc * 0.4 }); }
      if (n > 0.52 && roll > 0.9 && !inGeoglyph(px, pz, 8)) add('flowerBed', px + 1.6, pz - 1.2, 0.9 + sc * 0.3, yaw, { tint: 1 + Math.min(0.99, n) });
    }
    // Coneflower drifts along the strip's edges (Newfoundland's set is the lupine at the strip edge, STYLE §1.4.4).
    for (let s = 30; s <= 320; s += 29) for (const o of [-20, 20]) {
      const [lx, lz] = [425 + 0.0587 * s + 0.998 * o, 520 + 0.998 * s - 0.0587 * o];
      if (free(lx, lz, 1) && slope(lx, lz) < 0.3) add('flowerBed', lx, lz, 1, r() * 6.283, { tint: 1.2 + r() * 0.7 });
    }
  }

  /* ---------------------------------------------------------------- B's rock clumps with junipers and red cedars in their lee */
  {
    const r = ctx.rng('flats.clumps');
    const placed: Point2[] = [];
    for (let tries = 0; tries < 900 && placed.length < FLATS_PLANTING.clumps; tries++) {
      const x = 300 + r() * 265, z = 345 + r() * 655, w = 2.4 + r() * 1.2, h = 1.5 + r() * 0.6, yaw = r() * 6.283, second = r() < 0.5, nTrees = 3 + Math.floor(r() * 3);
      const seeds = Array.from({ length: 10 }, () => r());
      if (!free(x, z, 3) || ctx.bedClearance(x, z) < 8 || !tall(x, z, 14) || inElevator(x, z, 10) || inAirport(x, z, 8) || slope(x, z) > 0.3 || pointInPoly(x, z, WASH_BAND) || ctx.bedClearance(x, z, ['S2']) < 12) continue;
      if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < FLATS_PLANTING.clumpSpacing)) continue;
      placed.push([x, z]);
      rocks.push({ at: [x, g(x, z) - h * 0.3, z], w, h, yaw });   // low banded boulders, a third sunk (STYLE §3.3 rounded tops)
      if (second) { const ox = x + (seeds[0]! < 0.5 ? -1 : 1) * (w * 0.5 + 1.6), oz = z + (seeds[1]! - 0.5) * 2; if (free(ox, oz, 1.5)) rocks.push({ at: [ox, g(ox, oz) - 0.45, oz], w: w * 0.7, h: 1.4, yaw: yaw + 1 }); }
      for (let k = 0; k < nTrees; k++) {
        const tx = x + (seeds[2 + k]! - 0.5) * 8, tz = z - 3 - seeds[(k + 6) % 10]! * 5, juniper = seeds[(k + 3) % 10]! < 0.55, sc = juniper ? 0.6 + seeds[(k + 1) % 10]! * 0.4 : 0.5 + seeds[(k + 4) % 10]! * 0.3;
        const crown = (CROWN_RADIUS[juniper ? 'juniper' : 'cedar'] ?? 2) * sc;
        if (!free(tx, tz, 1) || ctx.bedClearance(tx, tz) < 3 || !tall(tx, tz, crown) || rocks.some(q => Math.hypot(q.at[0] - tx, q.at[2] - tz) < q.w / 2 + 1)) continue;
        add(juniper ? 'juniper' : 'cedar', tx, tz, sc, seeds[(k + 5) % 10]! * 6.283, { lean: juniper ? 0 : 0.06, tint: seeds[(k + 7) % 10]! });
      }
    }
  }

  /* ---------------------------------------------------------------- the one pine (by THE hangar, in its lee) */
  {
    let at: Point2 | null = null;
    for (let rr = 0; rr <= 12 && !at; rr += 1) for (let k = 0; k < 12 && !at; k++) { const x = PINE[0] + Math.cos(k * 0.5236) * rr, z = PINE[1] + Math.sin(k * 0.5236) * rr; if (free(x, z, 2) && ctx.bedClearance(x, z) > 4 && !breaksStrip(x, z, 3)) at = [x, z]; }
    if (at) add('pine', at[0], at[1], 0.62, Math.PI, { lean: 0.2, keep: true, tint: 0.4 });
  }

  /* ---------------------------------------------------------------- B's steppe on the Wash's banks */
  {
    const r = ctx.rng('flats.wash');
    for (let i = 0; i < 260; i++) {
      const z = 560 + r() * 250, side = r() < 0.5 ? -1 : 1, x = (z < 700 ? 466 - (z - 560) * 0.05 : 466 + (z - 700) * 0.2) + side * (9 + r() * 22), roll = r(), sc = r();
      if (!free(x, z, 0.8) || ctx.bedClearance(x, z, ['S2']) < 6 || slope(x, z) > 0.6) continue;
      if (roll < 0.62) add('heath', x, z, 1.3 + sc * 0.6, sc * 6.283, { tint: 0.1 + sc * 0.3 });
      else if (roll < 0.8) add('prairieGrass', x, z, 0.8 + sc * 0.3, sc * 6.283, { tint: 0.6 });
      else if (roll < 0.9 && !breaksStrip(x, z, 1.2)) add('shrub', x, z, 0.8 + sc * 0.4, sc * 6.283, { tint: 0.2 });
    }
    // Talus at the hoodoos' feet: sage mounds and bluestem at the footing's corners (just off its solid), where the rim's fines
    // collect; they take the footing's square corners out of the silhouette.
    for (const [hx, hz] of WASH_HOODOOS.xy) {
      const h = WASH_HOODOOS.footing_m / 2 + 0.55;
      for (const [k, [sx, sz]] of ([[1, 1], [1, -1], [-1, 1], [-1, -1]] as const).entries()) {
        const x = hx + sx * h, z = hz + sz * h, sc = r();
        if (!free(x, z, 0.3)) continue;
        add(k % 2 ? 'prairieGrass' : 'heath', x, z, k % 2 ? 0.75 + sc * 0.2 : 1.5 + sc * 0.5, sc * 6.283, { tint: k % 2 ? 0.55 : 0.15 + sc * 0.2 });
        const ex = hx + sx * (h + 0.9), ez = hz + sz * (h - 1.1);
        if (free(ex, ez, 0.3)) add('heath', ex, ez, 1.1 + sc * 0.4, sc * 3, { tint: 0.2 });
      }
    }
    // Junipers in the lee of the hoodoos (3–4 behind two of the five), ≥ 6 m off S2.
    for (const i of [1, 3]) {
      const [hx, hz] = WASH_HOODOOS.xy[i]!;
      for (let k = 0; k < 6; k++) { const x = hx + 1 + (r() - 0.3) * 7, z = hz - 4 - r() * 4, sc = 0.6 + r() * 0.4; if (free(x, z, 1) && ctx.bedClearance(x, z, ['S2']) >= 6 && !breaksStrip(x, z, 2)) add('juniper', x, z, sc, r() * 6.283, { tint: r() }); }
    }
  }

  /* ---------------------------------------------------------------- toward Scholars: juniper and cedar thicken into spruce and balsam */
  {
    const r = ctx.rng('flats.blend');
    for (let i = 0; i < 70; i++) {
      const x = 470 + r() * 95, z = 392 + r() * 70, near = (470 - z) / 70, roll = r(), sc = r();   // near → 1 toward the north tip
      if (!free(x, z, 1.2) || ctx.bedClearance(x, z) < 4 || !tall(x, z, 3) || slope(x, z) > 0.5 || roll > 0.35 + near * 0.4) continue;
      const species: DressingSpecies = sc < near * 0.55 ? (sc < near * 0.3 ? 'spruce' : 'balsam') : sc < 0.7 ? 'juniper' : 'cedar';
      add(species, x, z, species === 'juniper' ? 0.7 + sc * 0.3 : 0.5 + sc * 0.3, sc * 6.283, { tint: roll });
    }
  }

  /* ---------------------------------------------------------------- the Bight */
  {
    const r = ctx.rng('flats.bight');
    // Eelgrass at the shallow margins (sedge cards, their tips through 0.05–0.45 of water).
    let eel = 0;
    for (let i = 0; i < 12000 && eel < FLATS_PLANTING.eelgrass; i++) {
      const x = 560 + r() * 330, z = 880 + r() * 330, y = g(x, z), patch = fbm(x * 0.07, z * 0.07);
      if (ctx.districtAt(x, z) !== 'bight' || ctx.waterLevelAt(x, z) === null || y > -0.08 || y < -0.45 || patch < -0.1) continue;
      add('sedge', x, z, 0.75 + r() * 0.3, r() * 6.283, { tint: 0.3 }); eel++;
    }
    // Shore planting on the plots' battered lagoon faces (above the water, off the pads and beds).
    for (const p of BIGHT_PLOTS) {
      let n = 0;
      for (let i = 0; i < 1800 && n < FLATS_PLANTING.shorePerPlot; i++) {
        const face = Math.floor(r() * 4), t = (r() - 0.5) * 0.9, out = 1.5 + r() * 14;
        const [u, v] = face === 0 ? [p.size[0] / 2 + out, t * p.size[1]] : face === 1 ? [-p.size[0] / 2 - out, t * p.size[1]] : face === 2 ? [t * p.size[0], p.size[1] / 2 + out] : [t * p.size[0], -p.size[1] / 2 - out];
        const [x, z] = plotPoint(p, u, v), y = g(x, z), roll = r();
        if (ctx.districtAt(x, z) !== 'bight' || y < 0.6 || ctx.occupied(x, z, 0.8) || ctx.bedClearance(x, z) < 1.5 || (g(...plotPoint(p, 0, 0)) - y) < 1.5) continue;
        // Marram (bluestem cards, cool tint) in drifts, thrift and rugosa as low cushions (the lite budget allows no shrubs).
        if (roll < 0.9) add('prairieGrass', x, z, 0.75 + r() * 0.3, r() * 6.283, { tint: 0.62 + r() * 0.2 });
        else add('heath', x, z, 0.8 + r() * 0.4, r() * 6.283, { tint: 0.8 });
        n++;
      }
    }
  }

  // No paint round the geoglyph: the tallgrass keeps 6 m off it (short native turf), so it reads on final without a decal
  // (a 75 × 52 decal would cost ~5k triangles of the district's budget in both tiers).
  return { plants, rocks, ground };
}
