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
 * - LOBED, NOT TILED (re-shoot): the crown is ~45 irregular lobes — a high crown on the three climbing limbs and over the trunk,
 *   a mid lobe over each low limb's elbow and the low tier at its tip, small lobes on the secondaries' ends (a few left out),
 *   dark core masses round the trunk's head — each lobe a cauliflower of rounded billows with its own tone, lit on top and
 *   darker on its inward side, so the crown reads as masses in light and shade with gaps where the limbs show.
 * No ink shell: an unlit shell drew every billow's rim as a bright tile edge at night (the far silhouette carries no ink either).
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
 * A billow: the crown's unit of foliage, a rounded faceted lump (6n triangles: a bottom apex, a low ring, a wide middle
 * ring, an upper ring, a top apex — round enough that a lobe of them reads as a cauliflower mass, not a stack of pads).
 * Lit top, mid sides and a PALE underside (`under`, the leaves' silvery backs) so that seen from beneath it reads mid-tone,
 * not black. `snow` whitens the top. No ink shell: the shell is unlit, and on a 60 eu crown it drew every billow's rim as
 * a bright tile edge at night and a stacked-pad outline by day (D-WW110).
 */
function billow(d: Draw, c: V, rx: number, ry: number, rz: number, n: number, top: RGB, side: RGB, under: RGB, o: { seed?: number; spin?: number; snow?: number } = {}) {
  const r = hashRand(o.seed ?? 7), spin = o.spin ?? 0, L: V[] = [], A: V[] = [], B: V[] = [];
  for (let k = 0; k < n; k++) {
    const a = spin + (k / n) * TAU, ja = 0.82 + r() * 0.34, h = a + Math.PI / n, jb = 0.84 + r() * 0.3, jl = 0.85 + r() * 0.25;
    L.push([c[0] + Math.cos(h) * rx * 0.72 * jl, c[1] - 0.5 * ry, c[2] + Math.sin(h) * rz * 0.72 * jl]);
    A.push([c[0] + Math.cos(a) * rx * ja, c[1] + (r() - 0.4) * 0.3 * ry, c[2] + Math.sin(a) * rz * ja]);
    B.push([c[0] + Math.cos(h) * rx * 0.74 * jb, c[1] + 0.62 * ry, c[2] + Math.sin(h) * rz * 0.74 * jb]);
  }
  const T: V = [c[0] + (r() - 0.5) * rx * 0.25, c[1] + ry, c[2] + (r() - 0.5) * rz * 0.25], Bt: V = [c[0], c[1] - 0.78 * ry, c[2]], snow = o.snow ?? 0;
  const hi = snow ? mix(top, SNOW, snow) : top, mid = snow ? mix(side, SNOW, snow * 0.3) : side, low = mix(under, side, 0.45), base = mix(under, side, 0.15);
  for (let k = 0; k < n; k++) {
    const l0 = L[k]!, l1 = L[(k + 1) % n]!, a0 = A[k]!, a1 = A[(k + 1) % n]!, b0 = B[k]!, b1 = B[(k + 1) % n]!, a2 = A[(k + 1) % n]!;
    d.tri(Bt, l1, l0, under, base, base, c);
    d.tri(l0, l1, a2, base, base, low, c); d.tri(l0, a2, a0, base, low, low, c);
    d.tri(a0, a1, b0, mid, mid, hi, c); d.tri(a1, b1, b0, mid, hi, hi, c);
    d.tri(b0, b1, T, hi, hi, shade(hi, 1.06), c);
  }
}

/** The leaves' silvery backs per dressing (bur oak undersides are pale and felted). */
const UNDER: Record<MountainArtPalette['theme'], RGB> = { classic: rgb('#9fb08f'), taylor: rgb('#dfe8d2'), newfoundland: rgb('#8c9c86') };

export function oakGeometry(pal: MountainArtPalette, tier: PlantTier, look: WWLook): WWGeometry {
  const C = wwColours(pal), full = tier === 'full', d = new Draw(full, false), r = hashRand(52), m = ((Math.round(look.month) - 1) % 12 + 12) % 12 + 1;
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
  // 4. The crown: LOBES — irregular masses of rounded billows over the limbs, each lobe its own tone, darker inside, lit on
  // top; gaps between them (and under the high crown, above the low tier) where the limbs and the sky read (D-WW110).
  const tierSet = (y: number) => { const f = (y - 9) / 27; return f > 0.72 ? C.oakLeaf.top : f > 0.42 ? C.oakLeaf.mid : C.oakLeaf.low; };
  const leafAt = (y: number, i: number): RGB => {
    const set = tierSet(y); let c = set[i % set.length]!;
    c = mix(c, [0.68, 0.78, 0.4], fresh); c = mix(c, C.oakLeaf.autumn[i % 3]!, fall * (i % 4 === 0 ? 0.55 : 1)); return c;
  };
  const underOf = (c: RGB): RGB => shade(mix(c, under, 0.38), 1.1);
  /** Keeps a billow inside the ~60 eu crown and under the dome (the Green's clearances are measured on that envelope). */
  const clampIn = (x: number, y: number, z: number, rad: number): V => {
    const rr = Math.hypot(x, z) || 1, k = Math.min(1, (OAK.spread - rad * 0.95) / rr), px = x * k, pz = z * k;
    return [px, Math.min(y, domeTop(Math.hypot(px, pz)) - rad * 0.7, OAK.height - rad * 0.72), pz];
  };
  // Size by season: April's late leaf-out is sparse and small; November thins.
  const keepShare = april ? 0.45 : m === 11 ? 0.72 : 1, sizeK = april ? 0.62 : m === 11 ? 0.9 : 1, sides = full ? 5 : 4;
  let i = 0;
  /** One billow of a lobe: `tone` the lobe's light (its own shade × its place: tops lit, the inward side and the core dark). */
  const put = (x: number, y: number, z: number, rad: number, tone: number, squash = 0.78) => {
    i++;
    if (bare) return; // the bare crown is the limbs and the twig dome
    if (keepShare < 1) { const h = Math.sin(i * 12.9898 + 4.1) * 43758.5453; if (h - Math.floor(h) > keepShare) return; }
    const R = rad * sizeK, c = clampIn(x, y, z, R), base = shade(leafAt(c[1], i), tone);
    billow(d, c, R, R * squash * (0.92 + (i % 3) * 0.06), R * (0.86 + (i % 4) * 0.06), sides, shade(base, 1.18), base, underOf(base), { seed: 300 + i, spin: i * 0.7 });
  };
  /** A lobe: `n` billows on its upper hemisphere round a core billow; the lobe's tone varies, the inward billows darker. */
  const lobe = (c: V, R: number, n: number, tone: number, squash = 0.78) => {
    const out: V = [c[0], 0, c[2]], ol = Math.hypot(c[0], c[2]) || 1;
    put(c[0], c[1], c[2], R * 0.62, tone * 0.86, squash);
    for (let k = 0; k < n; k++) {
      // golden-angle points on the upper 70 % of a sphere, so the lobe's top and outer face are covered, its belly open
      const t = (k + 0.5) / n, yv = 0.95 - t * 1.15, rr = Math.sqrt(Math.max(0, 1 - yv * yv)), a = k * 2.399963 + tone * 7;
      const dir: V = [Math.cos(a) * rr, yv, Math.sin(a) * rr], facing = (dir[0] * out[0] + dir[2] * out[2]) / ol;
      const lit = tone * (0.9 + 0.16 * yv + 0.08 * facing), rad = R * (0.42 + ((k * 7 + i) % 5) * 0.045);
      put(c[0] + dir[0] * R * 0.6, c[1] + dir[1] * R * 0.5, c[2] + dir[2] * R * 0.6, rad, lit, squash);
    }
  };
  const lt = () => 0.8 + r() * 0.36;
  // 4a. The core: a few big dark masses round the trunk's head, filling the middle so the gaps show depth, not sky through
  // the trunk.
  for (let k = 0; k < (full ? 5 : 2); k++) { const a = k * 2.2 + 0.6, rho = 6 + r() * 4; put(Math.sin(a) * rho, 17 + r() * 5, Math.cos(a) * rho, full ? 6 : 7, 0.6 + r() * 0.08, 0.7); }
  // 4b. The high crown: the three climbing limbs carry the top lobes; a crown lobe over the trunk rounds the dome.
  for (const l of limbs) if (!l.low) {
    lobe([l.tip[0] * 0.92, l.tip[1] + 1.2, l.tip[2] * 0.92], 8 + r() * 1.5, full ? 7 : 4, 1.06 + r() * 0.12);
    lobe([l.elbow[0], l.elbow[1] + 2.5, l.elbow[2]], 6 + r(), full ? 5 : 3, lt());
  }
  lobe([0.5, 30.5, -0.5], 7, full ? 6 : 2, 1.14);
  // 4c. The low limbs: a mid lobe over each elbow and the low tier at the tip, with a gap between (the bur oak's tiers; the
  // limbs read between them). The swing limb's tip lobe stays small and past the swing (it hangs at 62 % along the limb).
  for (const [li, l] of limbs.entries()) if (l.low) {
    const swing = li === 0;
    lobe([l.elbow[0] * 1.02, l.elbow[1] + 6.5 + r() * 1.5, l.elbow[2] * 1.02], 5.6 + r(), full ? 5 : 3, lt());
    const out = Math.hypot(l.tip[0], l.tip[2]) || 1, push = swing ? 2.2 : 0.6;
    lobe([l.tip[0] * (1 + push / out), l.tip[1] + (swing ? 2.4 : 1.4), l.tip[2] * (1 + push / out)], swing ? 4.4 : 5.4 + r() * 1.2, full ? 5 : 3, lt() * 0.96, 0.62);
  }
  // 4d. The secondaries' ends: small lobes that fill the dome between the limb lobes (some skipped: the gaps the crown reads by).
  let s2 = 0;
  for (const l of limbs) for (const sc of l.secondaries) {
    s2++; if (!full && s2 % 2 === 0) continue;
    // A few ends stay small (a single billow on the twig's tip: the gaps the crown reads by, never a bare stick poking out).
    if (noise(sc.to[0] * 0.11 + 2.3, sc.to[2] * 0.11 - 0.7) < -0.35) { if (full) put(sc.to[0], sc.to[1] + 0.8, sc.to[2], 2.6, lt() * 0.9); continue; }
    lobe([sc.to[0], sc.to[1] + 1.4, sc.to[2]], 4.2 + r() * 1.4, full ? 3 : 2, lt());
  }
  return d.result(false);
}
