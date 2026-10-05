/**
 * The Old Oak (STORY: the Green's landmark; prototype spec /protos/green §1): an authored single bur oak, ~300 years old,
 * 36 eu to the crown top and ~60 eu across at scale 1. Built once per dressing, tier and season look, drawn as one
 * instance on its own layer (family `landmark`, kept on lite).
 *
 * Construction, in the unit frame (root at the origin, y up; limb 0 — the swing limb — reaches along local +z, so the
 * neighbourhood module sets `yaw` to the bearing of the Drop Zone with the contract's yaw: local +z → (sin yaw, cos yaw)):
 * - trunk: a tapered column r 2.7 → 2.0 from −0.5 to 11.5, over a flare r 4.4 → 2.8; eight buttress roots running out
 *   8–14 eu and down into the turf;
 * - eight broad, low main limbs 45° apart (±0.175 rad jitter, none on limb 0), each two segments kinked at 45 % of its
 *   reach: limb 0 long and almost level (base 8, reach 21, end 10.2) for the swing; limbs 1–7 base 9–11.5, reach 16–23,
 *   end 15–23; three secondaries on each (24), rising 3–10 above the main tip, clamped within 29 eu of the trunk;
 * - leaf: broad flattened pads in tiers — clusters on the 32 tips and a gappy top dome (value noise leaves holes) — so
 *   the limbs read through the crown; colour by tier (top / mid / low, STYLE §1.3.2: ≥ 10 L* darker than the turf);
 * - seasons: fresh in April–May, russet in October–November (bur oaks hold their leaves late), bare December–March:
 *   the pads become sparse, flat twig-coloured branch flats with snow on their tops (STYLE §1.4.2 "bare / snow").
 * The ink shell (full) repeats the pads pushed out 0.22 eu (a 0.09 rim is sub-pixel on a 60 eu crown).
 */
import type { MountainArtPalette } from '../../../mountain/art/palette.ts';
import { mix, shade, type RGB } from '../../../art/cardKit.ts';
import type { PlantTier } from './geometry.ts';
import { SNOW, wwColours } from './species.ts';
import { Draw, hashRand, lens, lump, tube, type V, type WWGeometry, type WWLook } from './wwGeometry.ts';

/** The oak's dimensions at scale 1 (the sight-chain proofs aim at `top`; the Green module places the swing from `swing`). */
export const OAK = Object.freeze({ height: 36, spread: 30, trunkTop: 11.5, limbs: 8, swingLimb: { base: 8, reach: 21, end: 10.2 } });

type Limb = { a: number; base: V; kink: V; tip: V; secondaries: { from: V; to: V }[] };
const TAU = Math.PI * 2;
const dirOf = (a: number): V => [Math.sin(a), 0, Math.cos(a)];
const at = (a: number, r: number, y: number): V => { const d = dirOf(a); return [d[0] * r, y, d[2] * r]; };

/** The deterministic limb skeleton (the swing hangs from limb 0). */
export function oakLimbs(): Limb[] {
  const r = hashRand(1165), out: Limb[] = [];
  for (let i = 0; i < OAK.limbs; i++) {
    const a = (i / OAK.limbs) * TAU + (i === 0 ? 0 : (r() - 0.5) * 0.35);
    const base = i === 0 ? OAK.swingLimb.base : 9 + r() * 2.5, R = i === 0 ? OAK.swingLimb.reach : 16 + r() * 7, end = i === 0 ? OAK.swingLimb.end : 15 + r() * 8;
    const b = at(a, 1.8, base), k = at(a + 0.12, R * 0.45, base + 0.35 * (end - base) + 1.2), t = at(a, R, end);
    const secondaries: Limb['secondaries'] = [];
    for (let j = 0; j < 3; j++) {
      const sa = a + (j - 1) * 0.55 + (r() - 0.5) * 0.3, u = j === 1 ? 1 : 0.55 + j * 0.15, from: V = [k[0] + (t[0] - k[0]) * u, k[1] + (t[1] - k[1]) * u, k[2] + (t[2] - k[2]) * u];
      const len = 6 + r() * 6, rise = 3 + r() * 7;
      let to: V = [from[0] + Math.sin(sa) * len, t[1] + rise, from[2] + Math.cos(sa) * len];
      const rr = Math.hypot(to[0], to[2]); if (rr > 29) to = [to[0] * 29 / rr, to[1], to[2] * 29 / rr];
      secondaries.push({ from, to });
    }
    out.push({ a, base: b, kink: k, tip: t, secondaries });
  }
  return out;
}
/** Where the rope swing hangs on limb 0 (62 % from the kink to the tip), in the unit frame: the two rope tops ±0.4 across the limb. */
export function oakSwing(): { at: V; ropes: [V, V] } {
  const l = oakLimbs()[0]!, u = 0.62, p: V = [l.kink[0] + (l.tip[0] - l.kink[0]) * u, l.kink[1] + (l.tip[1] - l.kink[1]) * u - 0.5, l.kink[2] + (l.tip[2] - l.kink[2]) * u];
  const s: V = [Math.cos(l.a), 0, -Math.sin(l.a)];
  return { at: p, ropes: [[p[0] + s[0] * 0.4, p[1], p[2] + s[2] * 0.4], [p[0] - s[0] * 0.4, p[1], p[2] - s[2] * 0.4]] };
}
/** Smooth value noise in [−1, 1] (the top dome's gaps). */
function noise(x: number, z: number): number {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return (h(i, j) * (1 - sx) + h(i + 1, j) * sx) * (1 - sz) + (h(i, j + 1) * (1 - sx) + h(i + 1, j + 1) * sx) * sz;
}

export function oakGeometry(pal: MountainArtPalette, tier: PlantTier, look: WWLook): WWGeometry {
  const C = wwColours(pal), full = tier === 'full', d = new Draw(full, true), r = hashRand(52), m = ((Math.round(look.month) - 1) % 12 + 12) % 12 + 1;
  const bare = m === 12 || m <= 3, fresh = m === 4 ? 0.45 : m === 5 ? 0.2 : 0, fall = m === 10 ? 0.45 : m === 11 ? 0.8 : 0;
  const bark = C.oakBark, n = full ? 10 : 7;
  // Flare and trunk.
  tube(d, [0, -1.5, 0], [0, 1.1, 0], 4.4, 2.8, n, shade(bark, 0.62), shade(bark, 0.8), { lit: 0.15 });
  tube(d, [0, 1.0, 0], [0, OAK.trunkTop, 0], 2.7, 2.0, n, shade(bark, 0.95), shade(bark, 1.15), { lit: 0.15, spin: 0.2 });
  // Buttress roots running into the turf.
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + r() * 0.4, R = 8 + r() * 6;
    tube(d, at(a, 2.4, 1.0), at(a, R, -0.5), 1.2, 0.25, full ? 5 : 4, shade(bark, 0.78), shade(bark, 0.62), { lit: 0.3 }); }
  // Limbs: two tapered segments each, then the secondaries.
  const limbs = oakLimbs(), tips: V[] = [];
  for (const l of limbs) {
    tube(d, l.base, l.kink, 1.35, 1.0, full ? 6 : 4, shade(bark, 1.15), shade(bark, 1.2), { lit: 0.3 });
    tube(d, l.kink, l.tip, 1.0, 0.45, full ? 6 : 4, shade(bark, 1.2), shade(bark, 1.3), { lit: 0.3 });
    tips.push(l.tip);
    for (const s of l.secondaries) { tube(d, s.from, s.to, 0.45, 0.2, full ? 4 : 3, shade(bark, 1.25), shade(bark, 1.3), { lit: 0.3 }); tips.push(s.to); }
  }
  // The pads: tiered, broad and gappy so the limbs read.
  const tierColour = (y: number, i: number): RGB => {
    const f = (y - 9) / 27, set = f > 0.72 ? C.oakLeaf.top : f > 0.45 ? C.oakLeaf.mid : C.oakLeaf.low;
    let c = shade(set[i % set.length]!, 1.06); c = mix(c, [0.68, 0.76, 0.4], fresh); c = mix(c, C.oakLeaf.autumn[i % 3]!, fall); return c;
  };
  // A pad is a billowing, flattened mass (the prototype's spheres squashed to 0.5–0.65): lit on top, never black beneath.
  const pad = (c: V, rad: number, i: number) => {
    if (bare) { lens(d, c, rad * 0.55, rad * 0.22, full ? 5 : 4, () => C.twig, { seed: 300 + i, snow: 0.75, ink: 0 }); return; }
    const base = tierColour(c[1], i), ry = rad * (0.5 + (i % 4) * 0.05), col = (y: number) => shade(base, 0.8 + 0.38 * Math.max(0, Math.min(1, (y - c[1] + ry * 0.5) / (ry * 1.4))));
    lump(d, c, rad, ry, rad * (0.85 + (i % 3) * 0.08), full ? 5 : 4, col, { seed: 300 + i, spin: i * 0.7, ink: 0.22 / 0.07, flat: 0.45 });
  };
  let i = 0;
  // Pads stay inside the ~60 eu crown (the Green's protected-circle and glider-approach clearances are measured on it).
  const place = (x: number, y: number, z: number, rad: number) => { const k2 = Math.min(1, (OAK.spread - rad * 0.7) / (Math.hypot(x, z) || 1)); pad([x * k2, Math.min(OAK.height - rad * 0.45, y), z * k2], rad, i++); };
  // 1. Clusters on the 32 tips.
  const perTip = bare ? (full ? 2 : 1) : full ? 4 : 2;
  for (const t of tips) for (let k = 0; k < perTip; k++) { const a = r() * TAU, rr = Math.sqrt(r()) * 5; place(t[0] + Math.cos(a) * rr, t[1] + 1.0 + r() * 1.4 - 0.4, t[2] + Math.sin(a) * rr, 2.6 + r() * 1.6); }
  // 2. Along the broad low limbs (over the kink and the outer half): the limbs carry leaf along their length, so the
  //    crown comes down to them and the silhouette is a dome, not a parasol.
  if (!bare) for (const l of limbs) for (const u of [0, 0.5]) for (let k = 0; k < (full ? 3 : 1); k++) {
    const p: V = [l.kink[0] + (l.tip[0] - l.kink[0]) * u, l.kink[1] + (l.tip[1] - l.kink[1]) * u, l.kink[2] + (l.tip[2] - l.kink[2]) * u], a = r() * TAU, rr = r() * 3;
    place(p[0] + Math.cos(a) * rr, p[1] + 2.2 + r(), p[2] + Math.sin(a) * rr, 2.8 + r() * 1.4);
  }
  // The rim droops: under each main limb's tip a pair of pads hangs a little below it (open-grown oaks sweep low).
  if (!bare && full) for (const l of limbs) for (let k = 0; k < 2; k++) { const a = r() * TAU, rr = 1.5 + r() * 2.5; place(l.tip[0] + Math.cos(a) * rr, l.tip[1] - 1.2 - r() * 1.2, l.tip[2] + Math.sin(a) * rr, 2.4 + r() * 1.2); }
  // 3. The top dome: pads on a dome shell (y 19 → 34), value noise leaving holes so the limbs read through.
  const tries = bare ? 0 : full ? 110 : 45, per = full ? 2 : 1;
  for (let k = 0; k < tries; k++) {
    const rho = Math.sqrt(r()) * 26, a = r() * TAU, x = Math.cos(a) * rho, z = Math.sin(a) * rho;
    if (noise(x * 0.11 + 3.1, z * 0.11 - 1.7) < -0.3) continue;
    const y = 19 + 15 * Math.sqrt(Math.max(0, 1 - (rho / 29) ** 2)) - r() * 2.5;
    for (let q = 0; q < per; q++) { const b = r() * TAU, s2 = r() * 3.2; place(x + Math.cos(b) * s2, y + (r() - 0.5), z + Math.sin(b) * s2, 3.0 + r() * 1.6); }
  }
  void SNOW;
  return d.result(false);
}
