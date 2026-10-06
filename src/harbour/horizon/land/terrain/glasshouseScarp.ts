import type { XY, XYZ } from '../interfaces';
import { clamp, mix, smooth } from './geometry';

/**
 * The Water's Way, PR 2 land (L2b, D-WW72/D-WW73): the Green's north scarp and the Glasshouse stair-and-ramp down it.
 * ONE definition, read by the terrain (baseHeight: the batter and the stair's bench) and by structures (the ramp's legs,
 * its landings, the stair's flights and the terrace walk), so the ground and what stands on it never disagree.
 *
 * The scarp (bake 0b2dea0): a bare cut face 23–32 m tall over 10–15 m, x 990–1125, between the Lakeside terrace (45–51)
 * and the Green's north foot (18–22). It becomes a planted batter: through the line `table` F at x the ground is one plane
 * falling 1 : run. West of x 1045 F stands so the batter's top meets the terrace at z 900, Stillwater's band edge (the terrace
 * holds its band to its own edge, P01): the face is filled out onto the Green, not cut back; the plane falls 1 : run (1 : 2 west of x 1045, where the stair-and-ramp stands; easing to 1 : 1.5 east, where the
 * face is taller), cut above the midline, filled below it, between the terrace height hT and the foot height hG. It blends
 * back to the existing ground over `blend` eu of height at the top and the foot and over `feather` eu at the two ends.
 * Ground only: no skirt, no cover mesh; PR 3 plants it.
 */
export const GLASSHOUSE_SCARP = {
  /** [x, face midline z, terrace top hT, Green foot hG, run (horizontal eu per eu of fall)]. */
  table: [[990, 921, 43, 22, 2], [1000, 923, 45, 22, 2], [1020, 923, 45, 22, 2], [1035, 925, 47, 22, 2], [1045, 927, 49, 22, 2], [1060, 931, 50, 21, 2], [1080, 939, 51, 18, 2], [1100, 944, 51, 18, 2], [1112, 937, 51, 18, 1.5], [1122, 932, 50, 18, .9]] as readonly (readonly [number, number, number, number, number])[],
  x: [990, 1122] as const, feather: 10, blend: 1.5, z: [850, 1000] as const, reach: [24, 26] as const, fillOnly: [1028, 1048] as const,
} as const;

/**
 * The step-free ramp twin (MANIFEST structures.glasshouseRamp): four legs at an even 8 % (the stair twin's limit,
 * profiles.walk), lying on the batter (each leg's plan follows the batter's own contour at its falling height), joined by
 * level turning landings; legs leave a landing `turnGap` either side of the batter line and ease onto it over `ease` eu, so
 * the two legs of a switchback never share ground. The stair (structures.glasshouseStair) runs straight down the batter
 * west of the ramp's west landings, with a level landing at every `stairLevels` height, three of them shared with the ramp
 * (the head, the middle turn, the foot).
 */
export const GLASSHOUSE_RAMP = { xw: 1020, top: 44.5, foot: 22, legs: 4, grade: .08, width: 3, turnGap: 2.5, ease: 30, turnPad: [4, 8] as const, endPad: [6, 6] as const, legBlend: 4 } as const;
export const GLASSHOUSE_STAIR = { width: 3, gapToPads: .3, landing: 2, bench: .9, benchHalf: 2.5 } as const;

function row(x: number): { F: number; hT: number; hG: number; run: number } {
  const t = GLASSHOUSE_SCARP.table, xc = clamp(x, t[0]![0], t.at(-1)![0]);
  let i = 1; while (i < t.length - 1 && t[i]![0] < xc) i++;
  const a = t[i - 1]!, b = t[i]!, u = (xc - a[0]) / (b[0] - a[0] || 1);
  return { F: mix(a[1], b[1], u), hT: mix(a[2], b[2], u), hG: mix(a[3], b[3], u), run: mix(a[4], b[4], u) };
}
/** The batter plane's height at (x, z) (unclamped). */
export function batterHeight(x: number, z: number): number { const r = row(x); return (r.hT + r.hG) / 2 - (z - r.F) / r.run; }
/** Where the batter stands at height h at this x (its contour). */
export function batterContour(x: number, h: number): number { const r = row(x); return r.F + ((r.hT + r.hG) / 2 - h) * r.run; }

/** baseHeight step: the batter replacing the face (lowering above its midline, raising below it). `pre` is the ground before
 * this step anywhere (the terrace's own top and the Green's own foot are read from it, `reach` eu either side of the
 * midline, so the batter meets both with no step). */
export function glasshouseScarp(x: number, z: number, height: number, pre: (x: number, z: number) => number): number {
  const S = GLASSHOUSE_SCARP; if (x < S.x[0] || x > S.x[1] || z < S.z[0] || z > S.z[1]) return height;
  const wx = smooth((x - S.x[0]) / S.feather) * (1 - smooth((x - (S.x[1] - S.feather)) / S.feather)); if (wx <= 0) return height;
  const r = row(x), line = batterHeight(x, z), { top } = levelsAt(x, pre);
  // Above the face (and through it, to 3 eu past the midline) the batter cuts the terrace down to the line, meeting the terrace
  // at its own top; below, it fills the foot up to the line and meets the Green wherever the line falls under the ground.
  const cut = line >= top ? height : mix(height, line, smooth((top - line) / S.blend)), fill = Math.max(height, line);
  // East of x 1045 the 'terrace' is Stillwater's own raised bank (applyWaters, after this step): there the batter only fills,
  // capped at the bank's crest (hT), and the lake's bank decays onto it (no cut into the lake's rim).
  const east = smooth((x - S.fillOnly[0]) / (S.fillOnly[1] - S.fillOnly[0])), fillOnly = Math.max(height, Math.min(line, r.hT));
  let h = mix(height, mix(z < r.F + 3 ? cut : fill, fillOnly, east), wx);
  // The stair's bench: under its flights the ground stands `bench` below the treads' pitch line (never buried treads).
  const st = glasshouseStairLine();
  if (Math.abs(x - st.x) <= GLASSHOUSE_STAIR.benchHalf + 2.5 && z >= st.levels[0]![1] - 1 && z <= st.levels.at(-1)![1] + 1) {
    const tread = stairPitchAt(z) - GLASSHOUSE_STAIR.bench, k = 1 - smooth((Math.abs(x - st.x) - GLASSHOUSE_STAIR.benchHalf) / 2.5);
    if (tread < h) h = mix(h, tread, k);
  }
  return h;
}
const levelCache = new Map<number, { top: number; foot: number }>();
/** The terrace top and the Green's foot either side of the face at this x (1 eu columns). */
function levelsAt(x: number, pre: (x: number, z: number) => number): { top: number; foot: number } {
  const key = Math.round(x * 4) / 4, hit = levelCache.get(key); if (hit) return hit;
  const r = row(key), S = GLASSHOUSE_SCARP, out = { top: pre(key, r.F - S.reach[0]), foot: pre(key, r.F + S.reach[1]) };
  levelCache.set(key, out); return out;
}

export interface RampLeg { index: number; points: XYZ[]; from: XYZ; to: XYZ }
export interface RampPlan { legs: RampLeg[]; pads: { id: string; at: XY; h: number; size: XY }[]; length: number }
let rampPlan: RampPlan | undefined;
/** The ramp, solved once from the batter: the legs' natural lines (on the contour of their own falling height), then the
 * turn offsets. Plan length per leg = fall / grade; heights fall linearly with plan arc (exactly the grade). */
export function glasshouseRampPlan(): RampPlan {
  if (rampPlan) return rampPlan;
  // The natural lines are laid 6 % longer than the grade needs (the turn offsets shorten a leg's plan, and a chord of the kept
  // 2.5 eu samples is shorter than its arc); heights are then set by each leg's own kept-polyline arc, so every chord falls at
  // fall / arc < the grade.
  const R = GLASSHOUSE_RAMP, fall = (R.top - R.foot) / R.legs, L = fall / (R.grade * .94), dt = .5, legs: RampLeg[] = [], pads: RampPlan['pads'] = [];
  let x: number = R.xw, h: number = R.top;
  const turns: XY[] = [[x, batterContour(x, h)]];
  const naturals: XYZ[][] = [];
  for (let k = 0; k < R.legs; k++) {
    const dir = k % 2 ? -1 : 1, pts: XYZ[] = [[x, h, batterContour(x, h)]];
    for (let t = dt; t <= L + 1e-6; t += dt) {
      const h1 = R.top - k * fall - fall * t / L, z0 = pts.at(-1)![2], x0 = pts.at(-1)![0];
      let dx = dt;
      for (let it = 0; it < 4; it++) { const dz = batterContour(x0 + dir * dx, h1) - z0; dx = Math.sqrt(Math.max(1e-6, dt * dt - dz * dz)); }
      pts.push([x0 + dir * dx, h1, batterContour(x0 + dir * dx, h1)]);
    }
    naturals.push(pts); x = pts.at(-1)![0]; h = pts.at(-1)![1]; turns.push([x, pts.at(-1)![2]]);
  }
  naturals.forEach((pts, k) => {
    const n = pts.length - 1, arcs = pts.map((_, i) => i * dt);
    const shifted = pts.map((p, i): XYZ => {
      let dz = 0;
      if (k > 0) dz += R.turnGap * Math.max(0, 1 - arcs[i]! / R.ease);            // leaving a turn landing: down-slope
      if (k < R.legs - 1) dz -= R.turnGap * Math.max(0, 1 - (arcs[n]! - arcs[i]!) / R.ease); // arriving at one: up-slope
      return [p[0], p[1], p[2] + dz];
    });
    // Keep every 5th sample (2.5 eu) and the ends; heights by the kept polyline's own plan arc.
    const kept = shifted.filter((_, i) => i % 5 === 0 || i === n), arc = [0];
    for (let i = 1; i < kept.length; i++) arc.push(arc[i - 1]! + Math.hypot(kept[i]![0] - kept[i - 1]![0], kept[i]![2] - kept[i - 1]![2]));
    const h0 = R.top - k * fall, graded = kept.map((p, i): XYZ => [p[0], h0 - fall * arc[i]! / arc.at(-1)!, p[2]]);
    legs.push({ index: k, points: graded, from: graded[0]!, to: graded.at(-1)! });
  });
  turns.forEach((at, i) => {
    const end = i === 0 || i === R.legs, h0 = R.top - i * fall;
    pads.push({ id: i === 0 ? 'glasshouseRamp.head' : i === R.legs ? 'glasshouseRamp.foot' : `glasshouseRamp.turn.${i}`, at, h: h0, size: end ? [R.endPad[0], R.endPad[1]] : [R.turnPad[0], R.turnPad[1]] });
  });
  return rampPlan = { legs, pads, length: legs.reduce((n, l) => n + l.points.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - l.points[i]![0], p[2] - l.points[i]![2]), 0), 0) };
}

/** The stair: x west of the ramp's west landings; a level landing at the head, every half-leg fall and the foot. */
let stairLine: { x: number; levels: [number, number][] } | undefined;
export function glasshouseStairLine(): { x: number; levels: [number, number][] } {
  if (stairLine) return stairLine;
  const R = GLASSHOUSE_RAMP, S = GLASSHOUSE_STAIR, west = Math.min(R.xw, ...glasshouseRampPlanWestTurns()) - R.endPad[0] / 2;
  const x = west - S.gapToPads - S.width / 2, fall = (R.top - R.foot) / R.legs, levels: [number, number][] = [];
  for (let i = 0; i <= R.legs; i++) { const h = R.top - i * fall; levels.push([h, batterContour(x, h)]); }
  return stairLine = { x, levels };
}
function glasshouseRampPlanWestTurns(): number[] { const p = glasshouseRampPlan(); return p.pads.filter((_, i) => i % 2 === 0).map(q => q.at[0]); }
/** The stair's flights between level landings (each landing `landing` eu long, centred on its level's batter contour). */
export function glasshouseStairFlights(): { from: XYZ; to: XYZ }[] {
  const { x, levels } = glasshouseStairLine(), half = GLASSHOUSE_STAIR.landing / 2;
  return levels.slice(1).map(([h, z], i) => ({ from: [x, levels[i]![0], levels[i]![1] + half], to: [x, h, z - half] }));
}
/** The stair's tread pitch line (landings level) at z. */
export function stairPitchAt(z: number): number {
  const { levels } = glasshouseStairLine(), half = GLASSHOUSE_STAIR.landing / 2;
  if (z <= levels[0]![1] + half) return levels[0]![0];
  for (let i = 1; i < levels.length; i++) {
    const [h0, z0] = levels[i - 1]!, [h1, z1] = levels[i]!;
    if (z <= z1 - half) return mix(h0, h1, clamp((z - (z0 + half)) / (z1 - z0 - 2 * half)));
    if (z <= z1 + half) return h1;
  }
  return levels.at(-1)![0];
}
