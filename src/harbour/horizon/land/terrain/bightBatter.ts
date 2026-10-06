import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, PadCut, XY } from '../interfaces';
import { buildWaterCuts } from '../water';

/**
 * The Water's Way (D-WW89, MANIFEST reserves.bightShore.batter): the Bight Shore plots' lagoon faces are battered at 1 : 1.5 —
 * real ground, raise only, over the lagoon floor (an authored earthwork: the one place a fill may raise that basin's floor).
 *
 * Each plot's crest is its retaining-wall rectangle (the pad and its 6 eu margin) at the pad's level; the plot is filled to
 * that level where the lagoon reached into it (plot 1's pad stood over the water), and outside it the ground falls along the
 * crest's outward normal. The batter's toe keeps `toeKeepOff.greenway_m` off the Greenway line and `toeKeepOff.jetty_m` off the
 * Bight Shore jetty's deck. Where the full height fits before that line the face is one 1 : 1.5 batter from the crest to the
 * natural ground (the wall becomes the crest's parapet); where it does not, the batter rises from the lagoon floor at its toe at
 * 1 : 1.5 and the plot's retaining wall keeps the rest (`bightBatterReport`). Pads never move or change size.
 *
 * Pure: the plots' pads (land/reserves) and a natural-ground query; the terrain solve (cutHeight) and the land build's
 * diagnostics call the same function, so the baked ground and the report agree.
 */
export interface BightPlotFrame { id: string; centre: XY; h: number; cos: number; sin: number; a: number; b: number }
interface Prepared { plots: BightPlotFrame[]; greenway: XY[]; channels: { line: XY[]; keep: number }[]; jetty: { centre: XY; half: XY } | null; slope: number; keepGreenway: number; keepJetty: number; runs: Map<string, { nat: number; keep: number; toe: number }> }
const cache = new WeakMap<readonly PadCut[], Prepared>();
/** Reach of the march along a face normal (eu): 1.5 × the deepest drop (pad 21 to the floor −8). */
const MARCH = 45, STEP = .25;
/** A channel's bank zone either side of its water (applyWaters: 12 eu outer reach). */
const CHANNEL_BANK = 12;

function prepare(pads: readonly PadCut[]): Prepared {
  let p = cache.get(pads);
  if (p) return p;
  const spec = (M.reserves.bightShore as unknown as { batter?: { slope: number; toeKeepOff: { greenway_m: number; jetty_m: number } } }).batter;
  // The keep-off reference is the built Greenway's line (MANIFEST structures.greenway.pts, plan [x, z]: the bed
  // `structure.greenway` is drawn on these points), not the prototype's route.
  const greenwayPts = ((M.structures as unknown as Record<string, { pts?: number[][] }>).greenway?.pts ?? []).map(q => [q[0]!, q[1]!] as XY);
  const plots: BightPlotFrame[] = [];
  if (spec) for (const pad of pads) {
    if (!/^plot\.bight\.\d+$/.test(pad.id)) continue;
    const r = pad.rotationDegrees * Math.PI / 180;
    plots.push({ id: pad.id, centre: [pad.centre[0], pad.centre[2]], h: pad.centre[1], cos: Math.cos(r), sin: Math.sin(r), a: pad.size[0] / 2 + pad.margin, b: pad.size[1] / 2 + pad.margin });
  }
  const j = (M.structures.jetties as unknown as Record<string, number[]>).bightShore;
  // A stream reaching the lagoon (the brook past plot 1's corner) keeps its banks: no fill within its bank's reach (the water's own
  // 12 eu bank zone, applyWaters) of its centreline.
  const near = (q: readonly number[]) => plots.some(f => Math.hypot(q[0]! - f.centre[0], q[2]! - f.centre[1]) < Math.max(f.a, f.b) + MARCH + 30);
  const channels = spec ? buildWaterCuts().filter(w => !w.underground && w.kind !== 'dry' && w.points.length > 1 && w.points.some(near)).map(w => ({ line: w.points.map(q => [q[0], q[2]] as XY), keep: w.width / 2 + CHANNEL_BANK })) : [];
  p = { plots, channels, greenway: spec ? greenwayPts : [], jetty: j ? { centre: [j[0]!, j[1]!], half: [2.5, 6] } : null, slope: spec?.slope ?? 1.5, keepGreenway: spec?.toeKeepOff.greenway_m ?? 6, keepJetty: spec?.toeKeepOff.jetty_m ?? 4, runs: new Map() };
  cache.set(pads, p);
  return p;
}
function lineDistance(q: XY, line: readonly XY[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, c = line[i]!, dx = c[0] - a[0], dz = c[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t));
  }
  return best;
}
/** Distance from a point to the Greenway line (the batter's keep-off reference). */
export function bightGreenwayDistance(pads: readonly PadCut[], q: XY): number { return lineDistance(q, prepare(pads).greenway); }
/** The march tests the keep-offs this much wider, so the lattice between two marched normals (and a corner's fan) stays clear. */
const KEEP_MARGIN = .75;
function kept(p: Prepared, q: XY): boolean {
  if (p.greenway.length > 1 && lineDistance(q, p.greenway) < p.keepGreenway + KEEP_MARGIN) return false;
  for (const c of p.channels) if (lineDistance(q, c.line) < c.keep + KEEP_MARGIN) return false;
  if (p.jetty) { const dx = Math.max(0, Math.abs(q[0] - p.jetty.centre[0]) - p.jetty.half[0]), dz = Math.max(0, Math.abs(q[1] - p.jetty.centre[1]) - p.jetty.half[1]); if (Math.hypot(dx, dz) < p.keepJetty + KEEP_MARGIN) return false; }
  return true;
}
/** Local frame of a plot: x along its rotation, z across (as land/reserves lays its walls). */
const toLocal = (f: BightPlotFrame, x: number, z: number): XY => { const dx = x - f.centre[0], dz = z - f.centre[1]; return [dx * f.cos + dz * f.sin, -dx * f.sin + dz * f.cos]; };
const toWorld = (f: BightPlotFrame, lx: number, lz: number): XY => [f.centre[0] + lx * f.cos - lz * f.sin, f.centre[1] + lx * f.sin + lz * f.cos];

export interface BightBatterSample { plot: string; fill: number; crestFill: number; d: number; run: number; full: boolean }
/**
 * The batter's ground at a plan point (raise only: the caller keeps the higher of this and its own ground), or null away from
 * every plot's batter. `ground` is the natural ground (terrain baseHeight) the batter meets at its toe.
 */
export function bightBatterAt(pads: readonly PadCut[], ground: HeightQuery, x: number, z: number): BightBatterSample | null {
  const p = prepare(pads);
  let best: BightBatterSample | null = null;
  for (const f of p.plots) {
    const reach = Math.max(f.a, f.b) + MARCH;
    if (Math.abs(x - f.centre[0]) > reach || Math.abs(z - f.centre[1]) > reach) continue;
    const [lx, lz] = toLocal(f, x, z);
    if (Math.abs(lx) <= f.a && Math.abs(lz) <= f.b) { const s = { plot: f.id, fill: f.h, crestFill: f.h, d: 0, run: 0, full: true }; if (!best || s.fill > best.fill) best = s; continue; }
    const qx = Math.max(-f.a, Math.min(f.a, lx)), qz = Math.max(-f.b, Math.min(f.b, lz)), d = Math.hypot(lx - qx, lz - qz);
    if (d > MARCH) continue;
    // The runs depend on the crest point and the normal only, marched from that key's own snapped point and direction (0.5 eu along
    // the crest, 0.01 rad round a corner's fan): the same answer whichever plan point asks first (the bake and the tests agree).
    const ki = Math.round(qx * 2), kj = Math.round(qz * 2), ka = Math.round(Math.atan2(lz - qz, lx - qx) * 100), key = `${f.id}:${ki}:${kj}:${ka}`;
    let run = p.runs.get(key);
    if (!run) {
      const sx = Math.max(-f.a, Math.min(f.a, ki / 2)), sz = Math.max(-f.b, Math.min(f.b, kj / 2)), nx = Math.cos(ka / 100), nz = Math.sin(ka / 100);
      const at = (t: number) => toWorld(f, sx + nx * t, sz + nz * t);
      let nat = 0; while (nat < MARCH && f.h - nat / p.slope > ground(...at(nat))) nat += STEP;
      let keep = 0; while (keep + STEP <= nat && kept(p, at(keep + STEP))) keep += STEP;
      run = { nat, keep, toe: ground(...at(Math.min(nat, keep))) };
      p.runs.set(key, run);
    }
    const r = Math.min(run.nat, run.keep);
    if (d > r || r <= 0) continue;
    const full = run.nat <= run.keep, fill = full ? f.h - d / p.slope : Math.min(f.h, run.toe + (r - d) / p.slope);
    const s = { plot: f.id, fill, crestFill: full ? f.h : Math.min(f.h, run.toe + r / p.slope), d, run: r, full };
    if (!best || s.fill > best.fill) best = s;
  }
  return best;
}
/** The plots' frames (for the land build's report and tests). */
export function bightPlotFrames(pads: readonly PadCut[]): readonly BightPlotFrame[] { return prepare(pads).plots; }
export { toWorld as bightPlotToWorld };
