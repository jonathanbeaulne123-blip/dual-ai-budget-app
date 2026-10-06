/**
 * Scholars' Edge: the woods (protos/scholars SPEC "Tree placement rule", layout B), ported as a deterministic generator
 * over the bake-time world (`DressingContext`). The rule, as approved:
 *
 *  - a 4.3 m grid over x 560–960, z 220–620 with ±2 m jitter; kept with probability 0.95 within 120 m of the woods'
 *    centre, fading to 0 at 175 m (× 0.65 in the fade), the threshold moved by 0.12 × fbm(0.03) so the edge is ragged;
 *  - never in the eight glades, on or near a bed (crowns may overhang the walks; trunks stand 2 m off every tread and
 *    12 m off the roads, whose own framing groves line them), in the Library + 4 m, the courtyard + 3 m, the sun window,
 *    within 5 m of the lookout spur or 16 m of the lookout, below ground 30, on a slope over 0.7, or outside the
 *    `scholars` district (its budget holds the woods; nothing spills into a neighbour's);
 *  - species: at an edge (within 6 m of a glade or 10 m of a bed) a birch when r < 0.35, otherwise white pine 16 %,
 *    hemlock 34 %, sugar maple 20 %, paper birch 14 %, cedar 16 %;
 *  - saplings within 120 m (hemlock 70 %, maple 30 %) where the rule still finds room, near the walks.
 *
 * Then, for the island's kit and the district budget (measured per item, full / lite: birch 274 / 108, pine 146 / 63,
 * spruce 130 / 29, balsam 106 / 24, cedar 85 / 22, a woodland card 8 / 3.6):
 *  - FRONT ROWS are real trees: the `FRONT.max` trunks nearest an opening (a walk, a glade, the sun window, the
 *    courtyard, the Library, the lookout — `openness`, in units of each opening's front depth). White pine → `pine`
 *    (emergent, 19–24 m), hemlock → `spruce` / `balsam` (Newfoundland draws `spruce` as black spruce), birch → `birch`
 *    (at most `FRONT.birch`, the nearest; the rest spruce), cedar → `cedar`. Sugar maple is never a front-row tree:
 *    STYLE §1.4.4 swaps it for black spruce in Newfoundland and a record carries no dressing, so front-row maples stand as
 *    balsam and the maples' mass is the broadleaf back-row cards.
 *  - BACK ROWS are `woodlandCard`s: a conifer pick is a spire card (tint < 0.5), a broadleaf pick a round card
 *    (tint ≥ 0.5; Newfoundland draws every card as a spire: the maples' swap).
 *  - CLEARANCES are contracts: every crown keeps 1.5 m under every story eye → target line over the woods
 *    (`storySightlines`: the elevator gallery → the Library, the Bight lookout → Westwatch, the oak, the Lamp …); inside
 *    the lookout's open water (bearings 55°–175°, 22–170 m: nearer is the frame) no crown rises past the eye less 1 m; and no crown shades the
 *    courtyard at golden hour (the sun window, made exact: a crown under a courtyard sample's sun ray is cut to pass
 *    under it). A crown in the way is cut down to fit, or left out when it would be under half its size.
 */
import type { Point2 } from '../../world/definition.ts';
import type { DressingContext, PlantRecord, DressingSpecies } from '../types.ts';
import { DECK, LOOKOUT_EYE, LOOKOUT_VIEW, SPUR_LINE, WOODS_C, gladeDistance, inLibrary, libraryDistance, onTerrace, polylineDistance, sunWindowAt, sunWindowDistance, terraceDistance, W } from './frame.ts';
import { bearing, crownClearance, crownOf, storySightlines, sunRayUnder, terraceSamples, type Sightline } from './measure.ts';
import { fbm } from './noise.ts';

export const WOODS = {
  grid: 4.3, x0: 560, x1: 960, z0: 220, z1: 620, jitter: 4, inner: 120, outer: 175,
  minGround: 30, maxSlope: 0.7, trailClear: 2, roadClear: 12, spurClear: 5, lookoutClear: 16,
  /** Front rows: each opening's depth (m), the most real trees, and the most birches among them. */
  front: { trail: 9, glade: 6, sunWindow: 8, court: 12, lookout: 28, max: 300, birch: 50 },
  saplings: 60,
  sightMargin: 1.5, coneMargin: 1.0, sunMargin: 0.3, minShrink: 0.5,
} as const;
export const DISTRICT = 'scholars';
const ROADS = ['V01', 'VG', 'spur '] as const;

export type TreePick = 'whitepine' | 'hemlock' | 'maple' | 'birch' | 'cedar';
type Cand = { x: number; z: number; pick: TreePick; s: number; v: number; yaw: number; alt: number; keep?: boolean; sapling?: boolean };

const slopeAt = (ctx: DressingContext, x: number, z: number) => { const d = 2.5; return Math.hypot(ctx.heightAt(x + d, z) - ctx.heightAt(x - d, z), ctx.heightAt(x, z + d) - ctx.heightAt(x, z - d)) / (2 * d); };
const lookoutD = (x: number, z: number) => Math.hypot(x - LOOKOUT_EYE[0], z - LOOKOUT_EYE[2]);

/** Where a trunk may stand (the rule's `free`, plus the island's beds, pads, water and solids). */
export function treeGround(ctx: DressingContext, x: number, z: number, clear: number = WOODS.trailClear): boolean {
  if (ctx.districtAt(x, z) !== DISTRICT) return false;
  if (inLibrary(x, z, 4) || onTerrace(x, z, 3) || sunWindowAt(x, z)) return false;
  if (polylineDistance(x, z, SPUR_LINE) < WOODS.spurClear || lookoutD(x, z) < WOODS.lookoutClear) return false;
  if (ctx.heightAt(x, z) < WOODS.minGround || slopeAt(ctx, x, z) > WOODS.maxSlope) return false;
  if (ctx.occupied(x, z, clear) || ctx.bedClearance(x, z, ROADS) < WOODS.roadClear) return false;
  return true;
}
/** How open a trunk's place is: its distance to the nearest opening in units of that opening's front depth (< 1: front row). */
export function openness(ctx: DressingContext, x: number, z: number): number {
  const F = WOODS.front;
  return Math.min(ctx.bedClearance(x, z) / F.trail, gladeDistance(x, z) / F.glade, sunWindowDistance(x, z) / F.sunWindow, terraceDistance(x, z) / F.court, libraryDistance(x, z) / F.court, lookoutD(x, z) / F.lookout);
}

function pickOf(r: number, edge: boolean): TreePick {
  if (edge && r < 0.35) return 'birch';
  return r < 0.16 ? 'whitepine' : r < 0.5 ? 'hemlock' : r < 0.7 ? 'maple' : r < 0.84 ? 'birch' : 'cedar';
}

/** The candidates of the rule (grid, frame trees, saplings), before the kit mapping. */
function candidates(ctx: DressingContext): Cand[] {
  const rnd = ctx.rng('scholars.woods'), out: Cand[] = [];
  for (let x = WOODS.x0; x <= WOODS.x1 + 1e-9; x += WOODS.grid) for (let z = WOODS.z0; z <= WOODS.z1 + 1e-9; z += WOODS.grid) {
    const jx = x + (rnd() - 0.5) * WOODS.jitter, jz = z + (rnd() - 0.5) * WOODS.jitter, r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd(), r6 = rnd();
    const d = Math.hypot(jx - WOODS_C[0], jz - WOODS_C[1]);
    const keep = d < WOODS.inner ? 0.95 : d < WOODS.outer ? 0.9 * (1 - (d - WOODS.inner) / (WOODS.outer - WOODS.inner)) * 0.65 : 0;
    if (r1 > keep + 0.12 * fbm(jx * 0.03, jz * 0.03)) continue;
    const gd = gladeDistance(jx, jz); if (gd < 0 || !treeGround(ctx, jx, jz)) continue;
    const edge = gd < 6 || ctx.bedClearance(jx, jz) < 10, pick = pickOf(r2, edge);
    out.push({ x: jx, z: jz, pick, s: pick === 'whitepine' ? 1.05 + r3 * 0.3 : 0.95 + r3 * 0.35, v: r4, yaw: r5 * Math.PI * 2, alt: r6 });
  }
  // The courtyard's frame (beside the terrace, out of the sun window) and the lookout's: a white pine west of the deck, a
  // birch east of it, a hemlock behind (SPEC "framed by a pine and a birch"; kept on lite). Each only where a trunk may.
  const frame: [Point2, TreePick, number][] = [
    [W(-38, 31), 'whitepine', 1.3], [W(-46, 26), 'hemlock', 1.2], [W(-47, 13), 'birch', 1.0], [W(-41, 34), 'birch', 0.9], [W(-23, -21), 'birch', 1.0],
    // The lookout's frame stands at the edges of the porch view (bearings ~35° and ~190° from the eye), clear of the story's
    // lines (Westwatch ~327°, the oak ~60°, the Lamp ~107°, the elevator ~151°).
    [[DECK.x0 - 9.5, DECK.z0 + 2.4], 'whitepine', 0.9], [[DECK.x1 + 4.5, DECK.z1 + 4.9], 'birch', 1.0], [[DECK.x0 - 13.8, DECK.z0 - 2.6], 'hemlock', 1.0],
  ];
  for (const [[x, z], pick, s] of frame) if (ctx.districtAt(x, z) === DISTRICT && !ctx.occupied(x, z, 1.2) && !onTerrace(x, z, 1) && !inLibrary(x, z, 2) && !sunWindowAt(x, z)) out.push({ x, z, pick, s, v: rnd(), yaw: rnd() * Math.PI * 2, alt: rnd(), keep: true });
  // Saplings in the gaps by the walks.
  let n = 0;
  for (let k = 0; k < 400 && n < WOODS.saplings; k++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * WOODS.inner, x = WOODS_C[0] + Math.cos(a) * rr, z = WOODS_C[1] + Math.sin(a) * rr, r = rnd(), s = 0.22 + rnd() * 0.25, v = rnd(), yaw = rnd() * Math.PI * 2, alt = rnd();
    if (gladeDistance(x, z) < 0 || !treeGround(ctx, x, z) || ctx.bedClearance(x, z) > 7 || out.some(c => Math.abs(c.x - x) < 2.5 && Math.abs(c.z - z) < 2.5)) continue;
    out.push({ x, z, pick: r < 0.7 ? 'hemlock' : 'maple', s, v, yaw, alt, sapling: true }); n++;
  }
  return out;
}

/** The kit species and scale of a candidate in the front rows (real trees). */
function frontTree(c: Cand, birch: boolean): { species: DressingSpecies; scale: number } {
  if (c.sapling) return { species: c.alt < 0.6 ? 'spruce' : 'balsam', scale: 0.45 + (c.s - 0.22) * 1.6 };
  switch (c.pick) {
    case 'whitepine': return { species: 'pine', scale: c.s * 2.95 };
    case 'hemlock': return c.alt < 0.62 ? { species: 'spruce', scale: c.s * 1.55 } : { species: 'balsam', scale: c.s * 1.45 };
    case 'maple': return { species: 'balsam', scale: c.s * 1.4 };
    case 'birch': return birch ? { species: 'birch', scale: c.s * 2.15 } : { species: 'spruce', scale: c.s * 1.5 };
    case 'cedar': return { species: 'cedar', scale: c.s * 1.05 };
  }
}
/** A back-row card: spire for a conifer pick, round for a broadleaf one (tint), sized to the prototype's heights. */
function backCard(c: Cand): { species: DressingSpecies; scale: number; tint: number } {
  const conifer = c.pick === 'whitepine' || c.pick === 'hemlock' || c.pick === 'cedar', tint = conifer ? 0.04 + c.v * 0.42 : 0.54 + c.v * 0.42;
  const scale = c.pick === 'whitepine' ? 1.45 + (c.s - 1.05) * 1.2 : c.pick === 'hemlock' ? 1.1 + (c.s - 0.95) * 1.1 : c.pick === 'cedar' ? 0.72 + (c.s - 0.95) * 0.7 : c.pick === 'maple' ? 1.05 + (c.s - 0.95) * 1.1 : 0.95 + (c.s - 0.95);
  return { species: 'woodlandCard', scale, tint };
}

export type WoodsResult = { trees: PlantRecord[]; front: number; back: number; broadleafFront: number; cut: number; dropped: number };

/** The highest a crown may reach: under every story sightline over it, the lookout's open water and the courtyard's sun. */
function crownCeiling(rec: PlantRecord, lines: readonly Sightline[], sun: readonly Point2[]): number {
  const c = crownOf(rec); if (!c) return Infinity;
  let allowed = Infinity;
  for (const l of lines) { const clear = crownClearance(l, c); if (clear < WOODS.sightMargin) allowed = Math.min(allowed, c.hi + clear - WOODS.sightMargin); }
  const d = Math.hypot(c.x - LOOKOUT_EYE[0], c.z - LOOKOUT_EYE[2]), b = bearing([LOOKOUT_EYE[0], LOOKOUT_EYE[2]], [c.x, c.z]);
  // Inside the open water's bearings (the crown's disc counts: its edge may reach into the cone).
  const spread = d > 0 ? (Math.asin(Math.min(1, c.r / d)) * 180) / Math.PI : 180;
  if (d > LOOKOUT_VIEW.frame && d < LOOKOUT_VIEW.reach && b + spread >= LOOKOUT_VIEW.from && b - spread <= LOOKOUT_VIEW.to) allowed = Math.min(allowed, LOOKOUT_EYE[1] - WOODS.coneMargin);
  // The sun: a crown that the golden-hour ray from a courtyard sample crosses (between its base and its top) is cut to pass
  // under the ray (the ray rises 0.18 m per metre: across a disc of radius r it climbs at most 0.36 r).
  for (const [x, z] of sun) { const under = sunRayUnder(x, z, c); if (under === Infinity || under + 0.36 * c.r < c.lo || under >= c.hi + WOODS.sunMargin) continue; allowed = Math.min(allowed, under - WOODS.sunMargin); }
  return allowed;
}
/** Fit a tree under its ceiling (cut down), or null when it would be under half its size. */
function fitUnder(p: PlantRecord, lines: readonly Sightline[], sun: readonly Point2[]): PlantRecord | null {
  let rec = p;
  for (let pass = 0; pass < 3; pass++) {
    const c = crownOf(rec); if (!c) return rec;
    const allowed = crownCeiling(rec, lines, sun);
    if (c.hi <= allowed) return rec;
    const unit = (c.hi - rec.at[1]) / rec.scale, scale = (allowed - rec.at[1]) / unit;
    if (!(scale >= p.scale * WOODS.minShrink) || scale <= 0.2) return null;
    rec = { ...rec, scale: Math.round(scale * 1000) / 1000 };
  }
  return crownOf(rec)!.hi <= crownCeiling(rec, lines, sun) ? rec : null;
}

export function plantWoods(ctx: DressingContext): WoodsResult {
  const cands = candidates(ctx), sun = terraceSamples(), lines = storySightlines(ctx.heightAt).filter(l => {
    // Only the lines that pass over the woods' box matter here.
    const xs = [l.a[0], l.b[0]], zs = [l.a[2], l.b[2]];
    return Math.max(...xs) > WOODS.x0 - 20 && Math.min(...xs) < WOODS.x1 + 20 && Math.max(...zs) > WOODS.z0 - 20 && Math.min(...zs) < WOODS.z1 + 20;
  });
  // The front rows: the most open places first (the frame trees always), at most FRONT.max; the nearest FRONT.birch
  // birch picks stay birch.
  const open = cands.map(c => openness(ctx, c.x, c.z)), rank = cands.map((_, i) => i).filter(i => cands[i]!.keep || open[i]! < 1)
    .sort((a, b) => (cands[b]!.keep ? 1 : 0) - (cands[a]!.keep ? 1 : 0) || open[a]! - open[b]! || a - b).slice(0, WOODS.front.max);
  const front = new Set(rank), birches = new Set(rank.filter(i => cands[i]!.pick === 'birch' && !cands[i]!.sapling).slice(0, WOODS.front.birch));
  const trees: PlantRecord[] = [];
  let nFront = 0, back = 0, broadleaf = 0, cut = 0, dropped = 0;
  cands.forEach((c, i) => {
    if (c.sapling && !front.has(i)) return;
    const y = ctx.heightAt(c.x, c.z), at: [number, number, number] = [round(c.x), round(y), round(c.z)];
    let rec: PlantRecord;
    if (front.has(i)) {
      const t = frontTree(c, birches.has(i));
      rec = { species: t.species, at, scale: round(t.scale), yaw: round(c.yaw), tint: round(c.v), ...(c.keep ? { keep: true } : {}) };
    } else {
      const t = backCard(c);
      rec = { species: t.species, at, scale: round(t.scale), yaw: round(c.yaw), tint: round(t.tint) };
    }
    const fit = fitUnder(rec, lines, sun);
    if (!fit) { dropped++; return; }
    if (fit.scale !== rec.scale) cut++;
    trees.push(fit);
    if (fit.species === 'woodlandCard') back++; else { nFront++; if (fit.species === 'birch' || fit.species === 'round') broadleaf++; }
  });
  return { trees, front: nFront, back, broadleafFront: broadleaf, cut, dropped };
}

const round = (v: number) => Math.round(v * 1000) / 1000;
