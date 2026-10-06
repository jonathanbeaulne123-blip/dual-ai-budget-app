/**
 * The Old Oak (STORY: the Green's landmark; prototype spec /protos/green §1): an authored single bur oak, ~300 years old,
 * 36 eu to the crown top and ~60 eu across at scale 1. Built once per dressing, tier and season look, drawn as one
 * instance on its own layer (family `landmark`, kept on lite).
 *
 * What makes it read as a bur oak (and not a flat-topped acacia) at 64 px, from 1 km, in every season (D-WW110):
 * - a BROAD DOME: the crown's outer surface is one rounded dome (`domeTop`: 36 at the axis, shoulders at ~23 by ρ 25,
 *   the rim sweeping down to ~9 eu at ρ 29), filled with cumulus billows — never a flat parasol of pads;
 * - a SHORT, MASSIVE, DEEPLY FURROWED TRUNK: a 16-sided column of alternating ridges and furrows (lighter grey-brown
 *   ridges, dark furrows, a slight twist), a buttressed flare whose roots dive into the turf inside r 5.6 (the ring bench
 *   stands at 6.2);
 * - HEAVY, LOW, NEAR-HORIZONTAL LIMBS: five of the eight scaffold limbs leave the trunk at 6.5–8.5 eu and run out
 *   20–25 eu nearly level, crooked (a kink, a drooping elbow, an upturned tip — the bur oak's zig-zag); three climb into
 *   the dome. Limb 0, the swing limb, is long and low (base 8, reach 21, tip 10.2) along local +z;
 * - LIGHT UNDERSIDES: a bur oak's leaves are silvery beneath, so every billow's underside is a pale sage (lifted so the
 *   hemisphere's ground light shows it mid-tone, never black), and the low skirt shows the limbs in its gaps.
 * Seasons: April a late, sparse leaf-out (fresh, small billows), May fresh, summer deep green in three tiers (STYLE
 * §1.3.2: ≥ 10 L* darker than the turf), October bronze-and-green, November russet and thinning (bur oaks hold their
 * leaves late), December–March bare: trunk, limbs and a fine twig dome, snow along the limbs' tops in the snow months
 * (STYLE §1.4.2 "bare / snow": trunks and branches).
 * The ink shell (full) repeats the billows pushed out 0.22 eu (a 0.09 rim is sub-pixel on a 60 eu crown).
 */
import type { MountainArtPalette } from '../../../mountain/art/palette.ts';
import { mix, rgb, shade, type RGB } from '../../../art/cardKit.ts';
import type { PlantTier } from './geometry.ts';
import { SNOW, wwColours } from './species.ts';
import { Draw, hashRand, type V, type WWGeometry, type WWLook } from './wwDraw.ts';

/** The oak's dimensions at scale 1 (the sight-chain proofs aim at `top`; the Green module places the swing from `oakSwing`). */
export const OAK = Object.freeze({ height: 36, spread: 30, trunkTop: 7.5, limbs: 8, rootReach: 5.6, swingLimb: { base: 8, reach: 21, end: 10.2 } });

type Limb = { a: number; base: V; kink: V; elbow: V; tip: V; low: boolean; secondaries: { from: V; to: V }[] };
const TAU = Math.PI * 2;
const dirOf = (a: number): V => [Math.sin(a), 0, Math.cos(a)];
const at = (a: number, r: number, y: number): V => { const d = dirOf(a); return [d[0] * r, y, d[2] * r]; };
const lerp = (a: V, b: V, u: number): V => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** The crown's outer surface at plan radius ρ: a broad dome, 36 at the axis, ~24 at ρ 25, the rim sweeping down to ~12 at ρ 29. */
export function domeTop(rho: number): number {
  const t = clamp01(rho / (OAK.spread - 0.5));
  return 6 + (OAK.height - 6) * Math.pow(Math.max(0, 1 - Math.pow(t, 2.6)), 0.5);
}

/**
 * The deterministic limb skeleton (the swing hangs from limb 0). Eight scaffold limbs 45° apart: limbs 0, 1, 3, 5, 7 are
 * the heavy low ones (near level, 20–25 out), 2, 4, 6 climb into the dome; each runs base → kink → elbow → tip.
 */
export function oakLimbs(): Limb[] {
  const r = hashRand(1165), out: Limb[] = [];
  for (let i = 0; i < OAK.limbs; i++) {
    const a = (i / OAK.limbs) * TAU + (i === 0 ? 0 : (r() - 0.5) * 0.35), low = i === 0 || i % 2 === 1;
    let base: V, kink: V, elbow: V, tip: V;
    if (i === 0) {
      // The swing limb: long and almost level, as the prototype (base 8, reach 21, end 10.2; kink at 45 % swung +0.12 rad).
      const { base: b, reach: R, end } = OAK.swingLimb;
      base = at(a, 1.8, b); kink = at(a + 0.12, R * 0.45, b + 0.35 * (end - b) + 1.2); tip = at(a, R, end); elbow = lerp(kink, tip, 0.5);
    } else if (low) {
      // Heavy and low: up a little to the kink, sagging to the elbow, the tip turned up again (the bur oak's zig-zag).
      const b = 6.5 + r() * 2, R = 20 + r() * 5, swing = (r() - 0.5) * 0.3;
      base = at(a, 1.7, b); kink = at(a + 0.1 + swing, R * 0.4, b + 1.0 + r() * 0.8);
      elbow = at(a - 0.06, R * 0.74, b - 0.8 + r() * 0.8); tip = at(a + 0.08, R, b + 0.6 + r() * 2.2);
    } else {
      const b = 7.5 + r() * 2, R = 14 + r() * 4;
      base = at(a, 1.5, b); kink = at(a + 0.12, R * 0.32, b + 5.5 + r() * 1.5);
      elbow = at(a - 0.08, R * 0.68, b + 11 + r() * 2); tip = at(a + 0.05, R, 25 + r() * 4);
    }
    // Secondaries: four per limb along its outer run, spreading out and up to just under the dome.
    const secondaries: Limb['secondaries'] = [];
    for (let j = 0; j < 4; j++) {
      const u = 0.25 + j * 0.25, from = j < 2 ? lerp(kink, elbow, u * 2) : lerp(elbow, tip, (u - 0.5) * 2);
      const sa = a + (j % 2 ? 1 : -1) * (0.35 + r() * 0.35), len = 6 + r() * 7, rr0 = Math.hypot(from[0], from[2]);
      const rho = Math.min(OAK.spread - 3, rr0 + len * 0.8), want = domeTop(rho) - 3 - r() * 4;
      let to: V = [from[0] + Math.sin(sa) * len, Math.max(from[1] + 1.5, want), from[2] + Math.cos(sa) * len];
      const rr = Math.hypot(to[0], to[2]); if (rr > OAK.spread - 3) to = [to[0] * (OAK.spread - 3) / rr, to[1], to[2] * (OAK.spread - 3) / rr];
      // Never through the dome: a branch ends ≥ 2 under it (the crown's billows cover its end).
      to = [to[0], Math.min(to[1], domeTop(Math.hypot(to[0], to[2])) - 2), to[2]];
      secondaries.push({ from, to });
    }
    out.push({ a, base, kink, elbow, tip, low, secondaries });
  }
  return out;
}
/** Where the rope swing hangs on limb 0 (62 % from the kink to the tip), in the unit frame: the two rope tops ±0.4 across the limb. */
export function oakSwing(): { at: V; ropes: [V, V] } {
  const l = oakLimbs()[0]!, u = 0.62, p: V = [l.kink[0] + (l.tip[0] - l.kink[0]) * u, l.kink[1] + (l.tip[1] - l.kink[1]) * u - 0.5, l.kink[2] + (l.tip[2] - l.kink[2]) * u];
  const s: V = [Math.cos(l.a), 0, -Math.sin(l.a)];
  return { at: p, ropes: [[p[0] + s[0] * 0.4, p[1], p[2] + s[2] * 0.4], [p[0] - s[0] * 0.4, p[1], p[2] - s[2] * 0.4]] };
}
/** Smooth value noise in [−1, 1] (the crown's few gaps). */
function noise(x: number, z: number): number {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return (h(i, j) * (1 - sx) + h(i + 1, j) * sx) * (1 - sz) + (h(i, j + 1) * (1 - sx) + h(i + 1, j + 1) * sx) * sz;
}

/**
 * A limb or the trunk as a tapered, fluted tube: `n` sides alternating ridge (r) and furrow (r × (1 − flute)), the ridges a
 * lighter bark, the furrows dark; the upper side lit (and snow-capped in the snow months). 2n triangles per segment.
 */
function bough(d: Draw, a: V, b: V, ra: number, rb: number, n: number, ridge: RGB, furrow: RGB, o: { flute?: number; twist?: number; spin?: number; snow?: number; lit?: number } = {}) {
  const t0: V = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], tl = Math.hypot(...t0) || 1, t: V = [t0[0] / tl, t0[1] / tl, t0[2] / tl];
  const s0: V = [-t[2], 0, t[0]], sl = Math.hypot(...s0), s: V = sl < 1e-4 ? [1, 0, 0] : [s0[0] / sl, s0[1] / sl, s0[2] / sl];
  const u: V = [s[1] * t[2] - s[2] * t[1], s[2] * t[0] - s[0] * t[2], s[0] * t[1] - s[1] * t[0]];
  const flute = o.flute ?? 0, twist = o.twist ?? 0, lit = o.lit ?? 0.3, snow = o.snow ?? 0;
  const ring = (p: V, r: number, tw: number) => Array.from({ length: n }, (_, k) => {
    const ang = tw + (k / n) * TAU, c = Math.cos(ang), sn = Math.sin(ang), rr = r * (k % 2 ? 1 - flute : 1), dir: V = [s[0] * c + u[0] * sn, s[1] * c + u[1] * sn, s[2] * c + u[2] * sn];
    return { p: [p[0] + dir[0] * rr, p[1] + dir[1] * rr, p[2] + dir[2] * rr] as V, up: dir[1], ridge: k % 2 === 0 };
  });
  const spin = o.spin ?? 0.2, A = ring(a, ra, spin), B = ring(b, rb, spin + twist), mid: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const tone = (q: { up: number; ridge: boolean }) => { const c = shade(q.ridge ? ridge : furrow, 0.88 + lit * q.up); return snow && q.up > 0.55 ? mix(c, SNOW, snow * clamp01((q.up - 0.55) * 2.5)) : c; };
  for (let k = 0; k < n; k++) {
    const a0 = A[k]!, a1 = A[(k + 1) % n]!, b0 = B[k]!, b1 = B[(k + 1) % n]!;
    d.tri(a0.p, a1.p, b1.p, tone(a0), tone(a1), tone(b1), mid);
    d.tri(a0.p, b1.p, b0.p, tone(a0), tone(b1), tone(b0), mid);
  }
}

/**
 * A billow: the crown's unit of foliage, a faceted cumulus lump (4n triangles: a low apex, a wide lower ring, a narrower
 * upper ring, a top apex). Lit top, mid sides and a PALE underside (`under`, the leaves' silvery backs) so that seen from
 * beneath it reads mid-tone, not black. `snow` whitens the top (branch flats in the snow months).
 */
function billow(d: Draw, c: V, rx: number, ry: number, rz: number, n: number, top: RGB, side: RGB, under: RGB, o: { seed?: number; spin?: number; snow?: number; flat?: number } = {}) {
  const r = hashRand(o.seed ?? 7), spin = o.spin ?? 0, A: V[] = [], B: V[] = [];
  for (let k = 0; k < n; k++) {
    const a = spin + (k / n) * TAU, ja = 0.84 + r() * 0.3, b = a + Math.PI / n, jb = 0.84 + r() * 0.3;
    A.push([c[0] + Math.cos(a) * rx * ja, c[1] + (r() - 0.5) * 0.25 * ry, c[2] + Math.sin(a) * rz * ja]);
    B.push([c[0] + Math.cos(b) * rx * 0.8 * jb, c[1] + 0.6 * ry, c[2] + Math.sin(b) * rz * 0.8 * jb]);
  }
  const T: V = [c[0], c[1] + ry, c[2]], Bt: V = [c[0], c[1] - (o.flat ?? 0.6) * ry, c[2]], ink = 0.22 / 0.07, snow = o.snow ?? 0;
  const hi = snow ? mix(top, SNOW, snow) : top, mid = snow ? mix(side, SNOW, snow * 0.3) : side, low = mix(under, side, 0.3);
  for (let k = 0; k < n; k++) {
    const a0 = A[k]!, a1 = A[(k + 1) % n]!, b0 = B[k]!, b1 = B[(k + 1) % n]!;
    d.tri(Bt, a1, a0, under, low, low, c, undefined, ink);
    d.tri(a0, a1, b0, mid, mid, hi, c, undefined, ink);
    d.tri(a1, b1, b0, mid, hi, hi, c, undefined, ink);
    d.tri(b0, b1, T, hi, hi, shade(hi, 1.05), c, undefined, ink);
  }
}

/** The leaves' silvery backs per dressing (bur oak undersides are pale and felted). */
const UNDER: Record<MountainArtPalette['theme'], RGB> = { classic: rgb('#9fb08f'), taylor: rgb('#dfe8d2'), newfoundland: rgb('#8c9c86') };

export function oakGeometry(pal: MountainArtPalette, tier: PlantTier, look: WWLook): WWGeometry {
  const C = wwColours(pal), full = tier === 'full', d = new Draw(full, true), r = hashRand(52), m = ((Math.round(look.month) - 1) % 12 + 12) % 12 + 1;
  const bare = m === 12 || m <= 3, snowy = m === 12 || m <= 2, april = m === 4, fresh = april ? 0.55 : m === 5 ? 0.22 : 0, fall = m === 10 ? 0.5 : m === 11 ? 0.85 : 0;
  const ridge = C.oakBark, furrow = shade(mix(C.oakBark, [0.12, 0.1, 0.09], 0.35), 0.62), limbBark = shade(mix(C.oakBark, C.twig, 0.35), 1.08), snowOn = snowy ? 0.85 : 0;
  const under = UNDER[pal.theme] ?? UNDER.classic;
  // 1. The trunk: a buttressed flare and a short, massive, fluted column with a slight twist.
  const tn = full ? 16 : 10;
  // The three segments share their rings (each starts at the last one's twist), so the column has no seams.
  bough(d, [0, -1.2, 0], [0, 1.2, 0], 4.0, 2.75, tn, shade(ridge, 0.92), furrow, { flute: 0.18, twist: 0.08, spin: 0.2, lit: 0.12 });
  bough(d, [0, 1.2, 0], [0, 4.4, 0], 2.75, 2.45, tn, ridge, furrow, { flute: 0.18, twist: 0.12, spin: 0.28, lit: 0.12 });
  bough(d, [0, 4.4, 0], [0, OAK.trunkTop + 0.6, 0], 2.45, 2.1, tn, shade(ridge, 1.04), furrow, { flute: 0.18, twist: 0.12, spin: 0.4, lit: 0.15 });
  // Buttress roots: eight short spurs that dive into the turf inside OAK.rootReach (the ring bench stands at r 6.2).
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2 + r() * 0.35, R = 4.4 + r() * (OAK.rootReach - 4.6);
    bough(d, at(a, 2.1, 1.6), at(a, R, -0.45), 1.15, 0.22, full ? 6 : 4, shade(ridge, 0.9), furrow, { flute: 0.12, lit: 0.3 });
  }
  // 2. Limbs: base → kink → elbow → tip, heavy and crooked; then the secondaries.
  const limbs = oakLimbs(), tips: V[] = [], ln = full ? 8 : 5;
  for (const l of limbs) {
    const r0 = l.low ? 1.45 : 1.25;
    bough(d, l.base, l.kink, r0, r0 * 0.78, ln, limbBark, furrow, { flute: 0.1, snow: snowOn, lit: 0.35 });
    bough(d, l.kink, l.elbow, r0 * 0.78, r0 * 0.55, ln, limbBark, furrow, { flute: 0.08, snow: snowOn, lit: 0.35 });
    bough(d, l.elbow, l.tip, r0 * 0.55, 0.32, full ? 6 : 4, limbBark, furrow, { snow: snowOn, lit: 0.35 });
    tips.push(l.tip);
    for (const s of l.secondaries) { bough(d, s.from, s.to, 0.42, 0.16, full ? 5 : 3, limbBark, shade(limbBark, 0.75), { snow: snowOn * 0.8, lit: 0.35 }); tips.push(s.to); }
  }
  // 3. Bare months: a fine twig dome — every tip sprays twigs up and out toward the dome surface.
  if (bare) for (const t of tips) for (let k = 0; k < (full ? 6 : 3); k++) {
    const a = r() * TAU, out = Math.hypot(t[0], t[2]) || 1, len = 2.5 + r() * 3.5;
    const dir: V = [t[0] / out * 0.5 + Math.cos(a) * 0.55, 0.75 + r() * 0.5, t[2] / out * 0.5 + Math.sin(a) * 0.55];
    let e: V = [t[0] + dir[0] * len, t[1] + dir[1] * len, t[2] + dir[2] * len]; const er = Math.hypot(e[0], e[2]);
    if (er > OAK.spread - 0.5) e = [e[0] * (OAK.spread - 0.5) / er, e[1], e[2] * (OAK.spread - 0.5) / er];
    e = [e[0], Math.max(t[1] + 0.8, Math.min(domeTop(Math.hypot(e[0], e[2])) - 0.3, OAK.height - 0.5, e[1])), e[2]];
    bough(d, t, e, 0.13, 0.03, 3, C.twig, shade(C.twig, 0.8), { snow: snowOn * 0.6, lit: 0.4 });
    // A twiglet off each twig's middle (the fine winter dome reads by these at a distance).
    if (full || k % 2 === 0) { const m = lerp(t, e, 0.55), b = r() * TAU, f: V = [m[0] + Math.cos(b) * 1.6, Math.min(OAK.height - 0.5, m[1] + 1.4), m[2] + Math.sin(b) * 1.6];
      bough(d, m, f, 0.06, 0.02, 3, C.twig, shade(C.twig, 0.8), { lit: 0.4 }); }
  }
  // 4. The crown: billows on and under the dome, tiered colour, pale undersides.
  const tierSet = (y: number) => { const f = (y - 9) / 27; return f > 0.72 ? C.oakLeaf.top : f > 0.42 ? C.oakLeaf.mid : C.oakLeaf.low; };
  const leafAt = (y: number, i: number): RGB => {
    const set = tierSet(y); let c = set[i % set.length]!;
    c = mix(c, [0.68, 0.78, 0.4], fresh); c = mix(c, C.oakLeaf.autumn[i % 3]!, fall * (i % 4 === 0 ? 0.55 : 1)); return c;
  };
  const underOf = (c: RGB): RGB => shade(mix(c, under, 0.38), 1.1);
  /** Keeps a billow inside the ~60 eu crown and under the dome (the Green's clearances are measured on that envelope). */
  const clampIn = (x: number, y: number, z: number, rad: number): V => {
    const rr = Math.hypot(x, z) || 1, k = Math.min(1, (OAK.spread - rad * 0.95) / rr), px = x * k, pz = z * k;
    return [px, Math.min(y, domeTop(Math.hypot(px, pz)) - rad * 0.62, OAK.height - rad * 0.62), pz];
  };
  // Size by season: April's late leaf-out is sparse and small; November thins.
  const keepShare = april ? 0.45 : m === 11 ? 0.72 : 1, sizeK = april ? 0.62 : m === 11 ? 0.9 : 1, sides = full ? 5 : 4;
  let i = 0;
  const put = (x: number, y: number, z: number, rad: number, sat: number) => {
    i++;
    if (bare) return; // the bare crown is the limbs and the twig dome
    if (keepShare < 1) { const h = Math.sin(i * 12.9898 + 4.1) * 43758.5453; if (h - Math.floor(h) > keepShare) return; }
    const R = rad * sizeK, c = clampIn(x, y, z, R), base = leafAt(c[1], i);
    billow(d, c, R, R * (0.68 + (i % 4) * 0.04), R * (0.86 + (i % 3) * 0.07), sides, shade(base, 1.16), base, underOf(base), { seed: 300 + i, spin: i * 0.7 });
    // Satellites make the cumulus texture (cauliflower lobes) the silhouette reads by.
    for (let k = 0; k < sat; k++) {
      const a = (i * 2.4 + k * 2.1) % TAU, q = clampIn(c[0] + Math.cos(a) * R * 0.85, c[1] - R * 0.08 + (k % 2) * R * 0.18, c[2] + Math.sin(a) * R * 0.85, R * 0.62), sb = leafAt(q[1], i + k + 1);
      billow(d, q, R * 0.62, R * 0.62 * 0.7, R * 0.58, full ? 5 : 4, shade(sb, 1.16), sb, underOf(sb), { seed: 700 + i * 3 + k, spin: k * 1.3 + i });
    }
  };
  // 4a. The outer dome: a golden-angle spiral of billows just under the dome surface; the noise leaves a few gaps low down.
  const N = full ? 78 : 40;
  for (let k = 0; k < N; k++) {
    const rho = (OAK.spread - 3.5) * Math.sqrt((k + 0.5) / N), a = k * 2.399963 + 0.4, x = Math.sin(a) * rho, z = Math.cos(a) * rho;
    const rad = (full ? 4.4 : 5.4) + r() * 1.4 - (rho > 22 ? 0.4 : 0);
    if (rho > 12 && noise(x * 0.09 + 3.1, z * 0.09 - 1.7) < -0.5) { i++; continue; }
    put(x, domeTop(rho) - rad * 0.55 - r() * 1.6, z, rad, full ? (rho > 8 ? 2 : 1) : 1);
  }
  // 4b. The secondaries' ends carry the crown down to the limbs (the dome's inner layer).
  for (const l of limbs) for (const s of l.secondaries) put(s.to[0], s.to[1] + 0.6, s.to[2], (full ? 3.8 : 4.6) + r() * 1.2, full ? 1 : 0);
  // 4c. The low skirt: billows riding on the heavy low limbs' outer halves (the tiers a bur oak shows), a little below their tips.
  for (const l of limbs) if (l.low) for (const u of full ? [0.35, 0.7, 1] : [0.6, 1]) {
    const p = u < 0.5 ? lerp(l.kink, l.elbow, u * 2) : lerp(l.elbow, l.tip, (u - 0.5) * 2);
    put(p[0], p[1] + 1.4 - (u === 1 ? 1.6 : 0), p[2], (full ? 3.6 : 4.4) + r(), full ? 1 : 0);
  }
  return d.result(false);
}
