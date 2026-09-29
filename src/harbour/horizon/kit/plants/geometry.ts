/**
 * The corridor's new plant archetypes, drawn in Mountain v2's card language (`mountain/art/plantArt.ts`): faceted card,
 * flat shading, a cut-side darkening toward the foot, a light top and a dark underside (STYLE §1.1), baked vertex colours
 * that an instance colour only varies by a few percent (STYLE §1.4.1 rule 5: value ±4 %).
 *
 * Unit geometry, built once per dressing, tier and (for beds) bloom stage:
 * - `palm`: a curved, segmented trunk (each segment a cup, dark at its lip: the ring pencil marks) and 6–9 fronds as
 *   folded cards with a raised mid-rib, drooping from a crownshaft. Two heights come from the instance's y-scale:
 *   the palm material stretches the trunk only (`aCrown` marks crown vertices), so the fronds keep their shape.
 *   Taylor: paper fronds, flat with serrated cut edges and a white paper backing, washi-taped trunk bands.
 *   Newfoundland: the palm is a wind-bent pine (D-R4): a leaning trunk and wind-clipped tiers streaming downwind.
 * - `flowerBed`: a stadium bed 4 × 1.6 eu along local x (FLOWER_BED): a soil card, edging (Classic dressed stones,
 *   Taylor scalloped paper, Newfoundland granite setts) and low foliage mounds per drift; in winter mulch, snow patches
 *   and snow-dusted edging tops. The blooms are a second geometry per flower set (`bloomGeometry`): three drifts, one
 *   species each, the third threading the bed edge (STYLE §1.4.1 rule 4).
 * - `grassTuft`: Mountain v2's five-blade fan (same construction as plantArt's tufts).
 * The v2 shrub geometries (bush, hedge, heath) and the contact-shadow disc are rebuilt here exactly as plantArt builds
 * them inline, so the corridor's shrubs are the same objects as the mountain's.
 */
import * as THREE from 'three';
import { crownGeometry, gradient, ico, merged, trunkGeometry } from '../../../mountain/art/plantArt.ts';
import { crownOf, type TreeKind } from '../../../mountain/planting.ts';
import type { MountainArtPalette } from '../../../mountain/art/palette.ts';
import { mix, rgb, shade, type RGB } from '../../../art/cardKit.ts';
import type { BloomStage, FlowerSpecies, PlantTheme } from './sets.ts';

export type PlantTier = 'full' | 'lite';
/** The unit flower bed: length along local x, width along local z (engine units at scale 1). */
export const FLOWER_BED = Object.freeze({ length: 4, width: 1.6 });
/** The unit palm (scale 1): trunk top and the crown's reach. The tall variant stretches the trunk by `PALM.tall`. */
export const PALM = Object.freeze({ top: 5.4, reach: 3, tall: 1.38, pineTop: 4.8 });

type V = readonly [number, number, number];
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const UP: V = [0, 1, 0];

/** A non-indexed triangle writer with per-vertex colour, an optional crown flag and an optional ink direction. */
class Writer {
  p: number[] = []; c: number[] = []; crown: number[] = []; ink: number[] = [];
  /** A triangle facing `hint` (flipped if its normal points away), so every card's lit face is outward. */
  tri(a: V, b: V, c: V, ca: RGB, cb: RGB = ca, cc: RGB = ca, hint?: V, flags: { crown?: number; ink?: readonly [V, V, V] } = {}) {
    let A = a, B = b, C = c, CA = ca, CB = cb, CC = cc, ink = flags.ink;
    if (hint && dot(cross(sub(b, a), sub(c, a)), hint) < 0) { B = c; C = b; CB = cc; CC = cb; if (ink) ink = [ink[0], ink[2], ink[1]]; }
    this.p.push(...A, ...B, ...C); this.c.push(...CA, ...CB, ...CC);
    const k = flags.crown ?? 0; this.crown.push(k, k, k);
    if (ink) this.ink.push(...ink[0], ...ink[1], ...ink[2]); else this.ink.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
  quad(a: V, b: V, c: V, d: V, ca: RGB, cb: RGB, cc: RGB, cd: RGB, hint?: V, flags: { crown?: number; ink?: readonly [V, V, V, V] } = {}) {
    const i = flags.ink;
    this.tri(a, b, c, ca, cb, cc, hint, { crown: flags.crown, ink: i ? [i[0], i[1], i[2]] : undefined });
    this.tri(a, c, d, ca, cc, cd, hint, { crown: flags.crown, ink: i ? [i[0], i[2], i[3]] : undefined });
  }
  /** Appends a (non-indexed) three geometry's triangles, coloured by a y-gradient of `col`, facing away from `centre`. */
  solid(g: THREE.BufferGeometry, col: (y: number) => RGB, centre: V, flags: { crown?: number; ink?: number } = {}) {
    const q = g.index ? g.toNonIndexed() : g, pos = q.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      const v = [0, 1, 2].map(k => [pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)] as V) as [V, V, V];
      const mid: V = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3];
      const ink = flags.ink ? v.map(p => norm(sub(p, centre))) as unknown as [V, V, V] : undefined;
      this.tri(v[0], v[1], v[2], col(v[0][1]), col(v[1][1]), col(v[2][1]), sub(mid, centre), { crown: flags.crown, ink });
    }
    if (q !== g) q.dispose(); g.dispose();
  }
  geometry(opts: { crown?: boolean; ink?: boolean } = {}): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (opts.crown) g.setAttribute('aCrown', new THREE.Float32BufferAttribute(this.crown, 1));
    if (opts.ink) g.setAttribute('aInk', new THREE.Float32BufferAttribute(this.ink, 3));
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }
}
/** A low leafy mound: a six-sided faceted dome (6 triangles), lit on top, dark at the foot (a v2 heath in miniature). */
function mound(w: Writer, x: number, y: number, z: number, rx: number, rz: number, h: number, c: RGB, spin: number, snow?: RGB) {
  const apex: V = [x, y + h, z], ring = Array.from({ length: 6 }, (_, k) => { const a = spin + (k / 6) * Math.PI * 2, j = 0.85 + ((k * 5) % 3) * 0.1; return [x + Math.cos(a) * rx * j, y + h * 0.18, z + Math.sin(a) * rz * j] as V; });
  for (let k = 0; k < 6; k++) { const a = ring[k]!, b = ring[(k + 1) % 6]!; w.tri(apex, a, b, snow ?? shade(c, 1.1), shade(c, 0.68), shade(c, 0.68), sub([(a[0] + b[0]) / 2, y + h, (a[2] + b[2]) / 2], [x, y, z])); }
}
const hashRand = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

// ---------------------------------------------------------------------------------------------------------------- palm

/** The colours a palm is painted in, per dressing (re-materialised, never re-tinted: STYLE §1.3.4). */
export function palmColours(pal: MountainArtPalette) {
  const bark = pal.theme === 'taylor' ? pal.timberLight : pal.theme === 'newfoundland' ? pal.timber : mix(pal.plank, pal.stone, 0.45);
  const frond = pal.theme === 'taylor' ? mix(pal.leaf[1]!, rgb('#c9dca0'), 0.25) : pal.theme === 'newfoundland' ? pal.pine[0]! : mix(pal.leaf[1]!, rgb('#9aa64a'), 0.35);
  return { bark, frond, rib: mix(frond, rgb('#efe3a0'), 0.45), shaft: shade(mix(frond, bark, 0.35), 0.8), nut: mix(pal.timber, rgb('#6f7a3a'), 0.4), tape: pal.tape, paper: pal.paperEdge };
}

/** The trunk's centreline at t ∈ [0, 1] (local x is the lean direction). */
const palmCurve = (t: number, top: number, lean: number): V => [lean * Math.pow(t, 1.8), top * t, 0];

/**
 * A palm (Classic, Taylor) or the Newfoundland wind-bent pine that replaces it. Returns the body (trunk + crown, with
 * `aCrown`) and the crown's ink shell (with `aInk`, full tier only).
 */
export function palmGeometry(pal: MountainArtPalette, tier: PlantTier): { body: THREE.BufferGeometry; shell: THREE.BufferGeometry | null } {
  if (pal.theme === 'newfoundland') return bentPineGeometry(pal, tier);
  const col = palmColours(pal), full = tier === 'full', taylor = pal.theme === 'taylor';
  const body = new Writer(), shell = full ? new Writer() : null;
  const top = PALM.top, lean = 0.95, segs = full ? 5 : 4, sides = 5;
  // Trunk: stacked cups, each narrow at its foot and flared at its lip; the lip is dark (the ring pencil mark) or, in
  // Taylor, a washi-tape band on every other segment.
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs, c0 = palmCurve(t0, top, lean), c1 = palmCurve(t1, top, lean);
    const r0 = (i === 0 ? 0.34 : (0.25 - 0.08 * t0) * 0.9), r1 = (0.25 - 0.08 * t1) * 1.07;
    const tape = taylor && i % 2 === 1 ? col.tape[(i >> 1) % col.tape.length]! : null;
    const foot = shade(col.bark, i === 0 ? 0.74 : 1.02), lip = tape ?? shade(col.bark, taylor ? 0.9 : 0.7);
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2 + i * 0.4, a1 = ((k + 1) / sides) * Math.PI * 2 + i * 0.4;
      const p = (c: V, r: number, a: number): V => [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r];
      const out: V = [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)];
      body.quad(p(c0, r0, a0), p(c0, r0, a1), p(c1, r1, a1), p(c1, r1, a0), foot, foot, lip, lip, out);
    }
  }
  const crown = palmCurve(1, top, lean);
  // Crownshaft: a small faceted knob the fronds spring from; Classic hangs three nuts under it.
  body.solid(new THREE.CylinderGeometry(0.2, 0.3, 0.5, 5, 1, false).translate(crown[0], crown[1] + 0.05, 0), y => shade(col.shaft, 0.8 + (y - crown[1] + 0.2) * 0.5), crown, { crown: 1 });
  if (!taylor) for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; body.solid(new THREE.TetrahedronGeometry(0.15, 0).translate(crown[0] + Math.cos(a) * 0.27, crown[1] - 0.2, Math.sin(a) * 0.27), () => shade(col.nut, 0.9 + k * 0.06), [crown[0], crown[1] - 0.2, 0], { crown: 1 }); }
  // Fronds: folded cards (Classic) or flat serrated paper with a white backing (Taylor), drooping from the crown.
  const count = full ? 7 : 6, stations = full ? 3 : 2;
  for (let f = 0; f < count; f++) {
    const young = f % 3 === 0, az = (f / count) * Math.PI * 2 + (f % 2) * 0.25, dir: V = [Math.cos(az), 0, Math.sin(az)], side: V = [-dir[2], 0, dir[0]];
    const L = (young ? 2.3 : 2.9) * (0.92 + ((f * 37) % 10) / 60), rise = young ? 1.35 : 0.85, droop = young ? 1.25 : 2.05;
    const W = taylor ? 0.46 : 0.5, fold = taylor ? 0.02 : 0.1;
    const at = (u: number): V => add(add(crown, dir, L * u), UP, rise * u - droop * u * u + 0.05);
    const width = (u: number, j: number) => Math.max(0.03, W * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, 0.14 + u * 0.93))), 0.8) * (taylor && j % 2 === 1 ? 0.62 : 1));
    for (let j = 0; j < stations; j++) {
      const u0 = j / stations, u1 = (j + 1) / stations, p0 = at(u0), p1 = at(u1), w0 = width(u0, j), w1 = width(u1, j + 1);
      const r0 = add(p0, UP, fold * w0 / W), r1 = add(p1, UP, fold * w1 / W);
      const l0 = add(add(p0, side, w0), UP, -0.05), l1 = add(add(p1, side, w1), UP, -0.05), q0 = add(add(p0, side, -w0), UP, -0.05), q1 = add(add(p1, side, -w1), UP, -0.05);
      const g0 = shade(col.frond, 0.86 + u0 * 0.3), g1 = shade(col.frond, 0.86 + u1 * 0.3);
            // Top faces: two halves meeting at the fold; the fold vertices carry the pale mid-rib (Classic) or a pencil-dark
      // crease (Taylor), so the rib reads as a line down the frond at no extra cost.
      const rib0 = taylor ? shade(col.frond, 0.74) : mix(g0, col.rib, full ? 0.7 : 0.4), rib1 = taylor ? shade(col.frond, 0.74) : mix(g1, col.rib, full ? 0.7 : 0.4);
      body.quad(r0, r1, l1, l0, rib0, rib1, g1, g0, UP, { crown: 1 });
      body.quad(r0, q0, q1, r1, rib0, g0, g1, rib1, UP, { crown: 1 });
      // Underside: the card's own back face (the palm material is double-sided); the shader darkens back faces to
      // 0.62 of the top (STYLE §1.1) or, in Taylor, shows the paler paper backing (`backFace` in materials.ts).
      if (shell && j > 0) {
        // (Not on the first station: it sits in the crownshaft's shadow.) Ink on a card is a rim, not a back-face shell (a flat card has no inside): a ribbon along each outer edge
        // whose outer vertices the shader pushes out by `aInk` (drawn double-sided in ink, so it reads from above
        // and below as the cut-paper outline).
        const last = j === stations - 1, tip: V = norm(add(dir, UP, -0.1)), k: RGB = [0, 0, 0], o: V = [0, 0, 0];
        const eL: V = norm(side), eR: V = [-side[0], 0, -side[2]], eL1 = last ? norm(add(eL, tip)) : eL, eR1 = last ? norm(add(eR, tip)) : eR;
        shell.quad(l0, l1, l1, l0, k, k, k, k, undefined, { crown: 1, ink: [o, o, eL1, eL] });
        shell.quad(q1, q0, q0, q1, k, k, k, k, undefined, { crown: 1, ink: [o, o, eR, eR1] });
      }
    }
  }
  return { body: body.geometry({ crown: true }), shell: shell ? shell.geometry({ crown: true, ink: true }) : null };
}

/** Newfoundland's palm: a wind-bent pine (D-R4, STYLE §2.5 "wind-bent pines … leaning away from the prevailing wind"). */
export function bentPineGeometry(pal: MountainArtPalette, tier: PlantTier): { body: THREE.BufferGeometry; shell: THREE.BufferGeometry | null } {
  // A shore pine shaped by the wind: the trunk bows hard downwind (+x) from a buttressed foot, the windward side is
  // bare, and the crown is three or four flat, wind-clipped tiers that stream downwind off the trunk like flags,
  // the top one lying almost flat (STYLE §2.5 "wind-bent pines … leaning away from the prevailing wind").
  const full = tier === 'full', body = new Writer(), shell = full ? new Writer() : null, top = PALM.pineTop, lean = 2.3, sides = full ? 6 : 5, segs = full ? 5 : 3;
  const bark = pal.timber;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs, c0 = palmCurve(t0, top, lean), c1 = palmCurve(t1, top, lean), r0 = 0.27 - 0.13 * t0 + (i === 0 ? 0.08 : 0), r1 = 0.27 - 0.13 * t1;
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2, p = (c: V, r: number, a: number): V => [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r];
      body.quad(p(c0, r0, a0), p(c0, r0, a1), p(c1, r1, a1), p(c1, r1, a0), shade(bark, 0.72 + t0 * 0.3), shade(bark, 0.72 + t0 * 0.3), shade(bark, 0.72 + t1 * 0.3), shade(bark, 0.72 + t1 * 0.3), [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
    }
  }
  // Tiers: [trunk t, radius, height, downwind reach]; a flattened, skewed cone per tier.
  const tiers: [number, number, number, number][] = [[0.5, 1.35, 0.7, 1.1], [0.68, 1.25, 0.6, 1.35], [0.84, 1.05, 0.5, 1.5], [0.98, 0.8, 0.38, 1.4]];
  tiers.forEach(([t, R, h, reach], k) => {
    if (!full && k === 1) return;
    const c = palmCurve(t, top, lean), seg = full ? 7 : 6, cx = c[0] + reach * 0.55, cy = c[1] - 0.12;
    const g = new THREE.ConeGeometry(R, h, seg, 1); g.translate(0, h / 2, 0);
    // Skew: the downwind half stretches out (×reach), the windward half is clipped short (×0.45).
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setX(i, x > 0 ? x * (1 + reach * 0.55) : x * 0.45); pos.setZ(i, pos.getZ(i) * 0.82); pos.setY(i, pos.getY(i) - Math.max(0, x) * 0.12); }
    g.translate(cx - reach * 0.55 + 0.1, cy, 0);
    const tone = k % 2 ? pal.pine[1]! : pal.pine[0]!, colour = (y: number) => shade(tone, 0.58 + 0.56 * Math.max(0, Math.min(1, (y - cy + 0.25) / (h + 0.25))));
    const s2 = shell ? g.clone() : null, centre: V = [cx, cy - 0.15, 0];
    // Not flagged `aCrown`: a tall variant stretches the whole pine (its tiers are spread up the trunk).
    body.solid(g, colour, centre);
    if (shell && s2) shell.solid(s2, () => [0, 0, 0], centre, { ink: 1 });
  });
  return { body: body.geometry({ crown: true }), shell: shell ? shell.geometry({ crown: true, ink: true }) : null };
}

// ----------------------------------------------------------------------------------------------------------- flower bed

const BED_HALF = FLOWER_BED.width / 2, BED_STRAIGHT = FLOWER_BED.length / 2 - BED_HALF;
/** The stadium outline of the unit bed, `n` points anticlockwise from +x, inset by `inset`. */
function bedOutline(n: number, inset = 0): [number, number][] {
  // Evenly spaced by arc length round the stadium (straight sides included), so edging pieces are all one size.
  const r = BED_HALF - inset, arc = Math.PI * r, total = 4 * BED_STRAIGHT + 2 * arc, out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    let d = (k / n) * total;
    if (d < arc) { const a = -Math.PI / 2 + d / r; out.push([BED_STRAIGHT + Math.cos(a) * r, Math.sin(a) * r]); continue; } d -= arc;
    if (d < 2 * BED_STRAIGHT) { out.push([BED_STRAIGHT - d, r]); continue; } d -= 2 * BED_STRAIGHT;
    if (d < arc) { const a = Math.PI / 2 + d / r; out.push([-BED_STRAIGHT + Math.cos(a) * r, Math.sin(a) * r]); continue; } d -= arc;
    out.push([-BED_STRAIGHT + d, -r]);
  }
  return out;
}
export function bedColours(pal: MountainArtPalette, stage: BloomStage) {
  const soil = pal.theme === 'taylor' ? mix(pal.plank, pal.paperEdge, 0.18) : pal.theme === 'newfoundland' ? mix(pal.timber, rgb('#2b2622'), 0.45) : mix(pal.timber, rgb('#3a2c20'), 0.35);
  const mulch = pal.theme === 'taylor' ? mix(pal.timberLight, pal.paperEdge, 0.2) : mix(pal.timberLight, pal.timber, 0.45);
  const edge = pal.theme === 'taylor' ? pal.paperEdge : pal.theme === 'newfoundland' ? pal.stone : pal.stone;
  const foliage = stage === 'leaf' ? mix(pal.leaf[2]!, rgb('#8a6a3a'), 0.45) : mix(pal.leaf[1]!, pal.leaf[0]!, 0.3);
  return { soil: stage === 'mulch' ? mulch : soil, edge, coping: pal.theme === 'taylor' ? pal.paperEdge : pal.coping, foliage, snow: rgb('#f1f1ec'), tape: pal.tape };
}
/** The bed's soil card, edging and foliage (or winter mulch and snow). One geometry per dressing, tier and stage. */
export function bedGeometry(pal: MountainArtPalette, tier: PlantTier, stage: BloomStage, wild = false): THREE.BufferGeometry {
  if (wild) return driftGeometry(pal, tier, stage);
  const w = new Writer(), full = tier === 'full', col = bedColours(pal, stage), winter = stage === 'mulch', rand = hashRand(9127 + (winter ? 7 : 0));
  // Soil card: a raised stadium slab (top 0.09), its skirt dark toward the foot and buried 0.12.
  const rim = bedOutline(full ? 12 : 8, 0.02), topY = 0.09, footY = -0.12;
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i]!, b = rim[(i + 1) % rim.length]!;
    w.tri([0, topY, 0], [a[0], topY, a[1]], [b[0], topY, b[1]], shade(col.soil, 1.02), shade(col.soil, 0.96), shade(col.soil, 0.96), UP);
    w.quad([a[0], footY, a[1]], [b[0], footY, b[1]], [b[0], topY, b[1]], [a[0], topY, a[1]], shade(col.soil, 0.72), shade(col.soil, 0.72), shade(col.soil, 0.9), shade(col.soil, 0.9), [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]);
  }
  // Edging, per dressing.
  const ring = bedOutline(full ? (pal.theme === 'taylor' ? 16 : 14) : 10, -0.04);
  const snowy = (c: RGB, y: number, top: number) => (winter && y > top - 0.02 ? mix(c, col.snow, 0.85) : c);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!, mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], along = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (pal.theme === 'taylor') {
      // Scalloped paper: a standing half-disc card, white and washi colours in turn, each face drawn (paper has two sides).
      const c = i % 3 === 2 ? col.tape[(i / 3 | 0) % col.tape.length]! : col.edge, seg = full ? 3 : 2, r = len * 0.55, t: V = [Math.cos(along), 0, Math.sin(along)], n: V = [-t[2], 0, t[0]];
      for (let k = 0; k < seg; k++) {
        const q0 = Math.PI * k / seg, q1 = Math.PI * (k + 1) / seg, base: V = [mid[0], 0.02, mid[1]];
        const p0 = add(add(base, t, Math.cos(q0) * r), UP, Math.sin(q0) * r * 0.75), p1 = add(add(base, t, Math.cos(q1) * r), UP, Math.sin(q1) * r * 0.75);
        const cc = snowy(c, Math.max(p0[1], p1[1]), 0.02 + r * 0.75);
        w.tri(base, p0, p1, shade(c, 0.9), cc, cc, n); w.tri(base, p1, p0, shade(c, 0.8), shade(cc, 0.9), shade(cc, 0.9), [-n[0], 0, -n[2]]);
      }
      continue;
    }
    // Classic dressed stones with a chalked coping; Newfoundland irregular granite setts.
    const nf = pal.theme === 'newfoundland', h = nf ? 0.16 + rand() * 0.1 : 0.2, wd = nf ? 0.2 + rand() * 0.08 : 0.2, l = len * (nf ? 0.8 + rand() * 0.15 : 0.9);
    // One stone: its top (coping) and its outer and inner faces (6 triangles; the ends butt against the neighbours).
    const stone = shade(nf ? mix(col.edge, pal.stoneDark, rand() * 0.5) : col.edge, 0.94 + rand() * 0.1), top = h - 0.06, turn = nf ? (rand() - 0.5) * 0.2 : 0;
    const t: V = [Math.cos(along + turn), 0, Math.sin(along + turn)], nrm: V = [-t[2], 0, t[0]], outward = dot(nrm, [mid[0], 0, mid[1]]) >= 0 ? 1 : -1, n2: V = [nrm[0] * outward, 0, nrm[2] * outward];
    const c: V = [mid[0], 0, mid[1]], P = (u: number, v: number, y: number): V => add(add(add(c, t, u * l / 2), n2, v * wd / 2), UP, y);
    const cop = snowy(nf ? shade(stone, 1.08) : col.coping, top, top), sideTop = snowy(stone, top - 0.03, top), foot = shade(stone, 0.72);
    w.quad(P(-1, -1, top), P(1, -1, top), P(1, 1, top), P(-1, 1, top), cop, cop, cop, cop, UP);
    w.quad(P(-1, 1, -0.06), P(1, 1, -0.06), P(1, 1, top), P(-1, 1, top), foot, foot, sideTop, sideTop, n2);
    w.quad(P(1, -1, -0.06), P(-1, -1, -0.06), P(-1, -1, top), P(1, -1, top), foot, foot, sideTop, sideTop, [-n2[0], 0, -n2[2]]);
  }
  if (winter) {
    // Mulch mounds and snow patches lying on the bed.
    for (let k = 0; k < (full ? 5 : 3); k++) {
      const x = (rand() - 0.5) * FLOWER_BED.length * 0.62, z = (rand() - 0.5) * FLOWER_BED.width * 0.45, r = 0.22 + rand() * 0.25, n = 6;
      for (let s = 0; s < n; s++) { const a0 = (s / n) * Math.PI * 2, a1 = ((s + 1) / n) * Math.PI * 2, k0 = 0.8 + ((s * 7 + k) % 3) * 0.12;
        w.tri([x, topY + 0.03, z], [x + Math.cos(a0) * r * k0, topY + 0.015, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, topY + 0.015, z + Math.sin(a1) * r * k0], col.snow, shade(col.snow, 0.96), shade(col.snow, 0.96), UP); }
    }
    return w.geometry();
  }
  // Foliage: low mounds under each drift (the leaves the blooms rise from).
  const mounds = full ? 6 : 4;
  for (let k = 0; k < mounds; k++) {
    const x = -FLOWER_BED.length / 2 + 0.55 + (k / (mounds - 1)) * (FLOWER_BED.length - 1.1) + (rand() - 0.5) * 0.25, z = (rand() - 0.5) * 0.5, r = 0.36 + rand() * 0.14;
    mound(w, x, topY - 0.02, z, r * 1.2, r, r * 0.42, shade(col.foliage, 0.9 + rand() * 0.16), rand() * 6);
  }
  return w.geometry();
}

/**
 * A wild drift (the prairie set, ROAD R7): no soil card and no edging — a loose low mat of grass-green mounds in the bed's
 * footprint that the blooms rise from; in winter a few straw-and-snow mounds. Same footprint and bloom layout as a bed.
 */
function driftGeometry(pal: MountainArtPalette, tier: PlantTier, stage: BloomStage): THREE.BufferGeometry {
  const w = new Writer(), full = tier === 'full', rand = hashRand(5531), winter = stage === 'mulch';
  const green = mix(pal.leaf[1]!, rgb('#a9a86c'), 0.45), straw = mix(rgb('#c89a5b'), rgb('#d9c9a0'), 0.35);
  const tone = winter || stage === 'leaf' ? straw : stage === 'fade' ? mix(green, straw, 0.5) : green;
  const n = full ? 9 : 5;
  for (let k = 0; k < n; k++) {
    const x = -FLOWER_BED.length / 2 + 0.4 + rand() * (FLOWER_BED.length - 0.8), z = (rand() - 0.5) * (FLOWER_BED.width - 0.5), r = 0.34 + rand() * 0.22, c = shade(tone, 0.9 + rand() * 0.14);
    mound(w, x, -0.03, z, r * 1.3, r * 1.05, r * (winter ? 0.32 : 0.5), c, rand() * 6, winter ? mix(c, rgb('#f1f1ec'), 0.85) : undefined);
  }
  return w.geometry();
}

/** Flower positions in the unit bed: three drifts (A left, B right, C threading the edge), ranked for thinning. */
type Bloom = { x: number; z: number; h: number; slot: 0 | 1 | 2; rank: number; spin: number };
const bloomLayouts = new Map<string, Bloom[]>();
function bloomLayout(tier: PlantTier): Bloom[] {
  const hit = bloomLayouts.get(tier); if (hit) return hit;
  const rand = hashRand(40117), full = tier === 'full', out: Bloom[] = [], half = FLOWER_BED.length / 2 - 0.35, wz = BED_HALF - 0.3;
  const inside = (x: number, z: number) => { const cx = Math.max(-BED_STRAIGHT, Math.min(BED_STRAIGHT, x)); return Math.hypot(x - cx, z) < BED_HALF - 0.22; };
  const counts: [number, number, number] = full ? [10, 9, 6] : [7, 6, 4];
  counts.forEach((n, slot) => {
    let made = 0;
    for (let tries = 0; made < n && tries < n * 30; tries++) {
      const x = slot === 0 ? -half + rand() * (half - 0.1) : slot === 1 ? 0.1 + rand() * (half - 0.1) : (rand() - 0.5) * 2 * half;
      const z = slot === 2 ? (rand() < 0.5 ? -1 : 1) * (wz - rand() * 0.18) : (rand() - 0.5) * 2 * (wz - 0.12);
      if (!inside(x, z) || out.some(b => Math.hypot(b.x - x, b.z - z) < 0.2)) continue;
      out.push({ x, z, h: (slot === 0 ? 0.44 : slot === 1 ? 0.36 : 0.28) + rand() * 0.12, slot: slot as 0 | 1 | 2, rank: rand(), spin: rand() * Math.PI * 2 }); made++;
    }
  });
  bloomLayouts.set(tier, out); return out;
}
/** The eye of a flower head: yellow in white and pale flowers, dark cones in coneflower and black-eyed Susan. */
function eyeOf(f: FlowerSpecies): RGB {
  if (/coneflower|Susan/.test(f.name)) return rgb('#5a3a22');
  const lum = f.colour[0] * 0.3 + f.colour[1] * 0.59 + f.colour[2] * 0.11;
  return lum > 0.78 ? rgb('#e9c25a') : mix(f.colour, [1, 0.95, 0.8], 0.4);
}
/**
 * The blooms of one flower set in the unit bed at a bloom stage (STYLE §1.4.2): bud 25 % density at 40 % chroma, bloom
 * full, fade 40 % density with chroma −30 %; `leaf` and `mulch` draw none (null).
 */
export function bloomGeometry(pal: MountainArtPalette, tier: PlantTier, set: readonly FlowerSpecies[], stage: BloomStage): THREE.BufferGeometry | null {
  if (stage === 'leaf' || stage === 'mulch') return null;
  const w = new Writer(), full = tier === 'full', paper = pal.theme === 'taylor', stem = mix(pal.leaf[1]!, rgb('#a9b86a'), 0.3), bud = rgb('#8fae5a');
  const density = stage === 'bud' ? 0.25 : stage === 'fade' ? 0.4 : 1, size = stage === 'bud' ? 0.62 : stage === 'fade' ? 0.9 : 1, topY = 0.09;
  for (const b of bloomLayout(tier)) {
    if (b.rank >= density) continue;
    const f = set[b.slot]!, c0 = stage === 'bud' ? mix(f.colour, bud, 0.6) : stage === 'fade' ? mix(f.colour, rgb('#8c8270'), 0.3) : f.colour;
    const h = b.h * (stage === 'bud' ? 0.8 : 1), base: V = [b.x, topY, b.z], head: V = [b.x, topY + h, b.z], t: V = [Math.cos(b.spin), 0, Math.sin(b.spin)], n: V = [-t[2], 0, t[0]];
    // Stem: one narrow card triangle (the material is double-sided).
    w.tri(add(base, t, -0.022), add(base, t, 0.022), add(head, t, 0), shade(stem, 0.78), shade(stem, 0.78), stem, n);
    if (f.form === 'spike') {
      // Stacked florets up the top half of the stem (lupine, foxglove, iris): three-sided cones, or Taylor paper stars.
      const florets = full ? 3 : 2;
      for (let k = 0; k < florets; k++) {
        const y = topY + h * (0.52 + (k / florets) * 0.5), r = (0.11 - k * 0.016) * size * (paper ? 1.2 : 1), c = shade(c0, 0.9 + k * 0.07), p: V = [b.x, y, b.z], tip = add(p, UP, r * 1.5);
        for (let s = 0; s < 3; s++) { const a0 = b.spin + (s / 3) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / 3, q0 = add(p, [Math.cos(a0), 0, Math.sin(a0)], r), q1 = add(p, [Math.cos(a1), 0, Math.sin(a1)], r);
          if (paper) w.tri(p, q0, add(p, [Math.cos(a0 + 1.05), 0.2, Math.sin(a0 + 1.05)], r * 1.3), c, c, shade(c, 1.1), UP);
          else w.tri(q0, q1, tip, shade(c, 0.8), shade(c, 0.8), shade(c, 1.12), [Math.cos(a0 + Math.PI / 3), 0.3, Math.sin(a0 + Math.PI / 3)]); }
      }
      continue;
    }
    // A five-petal head (five triangle petals round a raised eye), tipped toward the light; Taylor's is a flat paper
    // cut-out with a pale paper rim behind it.
    const r = (paper ? 0.2 : 0.175) * size, tilt = 0.22, face = norm(add(UP, t, tilt)), u = norm(cross(face, n)), v = norm(cross(face, u));
    const eye = eyeOf(f), petals = 5, rim = paper ? shade(mix(c0, pal.paperEdge, 0.7), 1) : null;
    for (let s = 0; s < petals; s++) {
      const a = (s / petals) * Math.PI * 2 + b.spin, l = add(add(head, u, Math.cos(a - 0.5) * r * 0.45), v, Math.sin(a - 0.5) * r * 0.45), rr = add(add(head, u, Math.cos(a + 0.5) * r * 0.45), v, Math.sin(a + 0.5) * r * 0.45), tip = add(add(head, u, Math.cos(a) * r), v, Math.sin(a) * r);
      const c = shade(c0, 0.93 + (s % 2) * 0.1);
      if (rim) w.tri(add(head, face, -0.012), add(add(add(head, u, Math.cos(a - 0.5) * r * 0.5), v, Math.sin(a - 0.5) * r * 0.5), face, -0.012), add(add(add(head, u, Math.cos(a) * r * 1.16), v, Math.sin(a) * r * 1.16), face, -0.012), rim, rim, rim, face);
      w.tri(l, tip, rr, c, shade(c, 1.08), c, face);
    }
    if (full || paper) { const e = add(head, face, 0.025), er = r * 0.34;
      w.tri(add(add(e, u, er), v, 0), add(add(e, u, -er * 0.5), v, er * 0.87), add(add(e, u, -er * 0.5), v, -er * 0.87), eye, shade(eye, 0.85), shade(eye, 0.9), face); }
  }
  return w.p.length ? w.geometry() : null;
}

// -------------------------------------------------------------------------------- v2's own shapes (as plantArt builds them)

/** Mountain v2's grass tuft: a fan of five thin cut-paper blades leaning out from one root, dark at the foot. */
export function tuftGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), p: number[] = [];
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3, lean = 0.12 + (k % 2) * 0.1, h = 0.34 + (k % 3) * 0.09, w = 0.045, ca = Math.cos(a), sa = Math.sin(a);
    p.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * lean * 1.6, h, sa * lean * 1.6); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return gradient(g, 0.55, 1.02, 0, 0.45);
}
/** Mountain v2's shrub shapes: bush (shrub, flowering), clipped hedge, heath. */
export function shrubGeometry(kind: 'bush' | 'hedge' | 'heath'): THREE.BufferGeometry {
  if (kind === 'hedge') return gradient(new THREE.BoxGeometry(1, 1, 1, 2, 1, 1).translate(0, 0.5, 0), 0.66, 1.08, 0, 1);
  if (kind === 'heath') return gradient(ico(0.6, 0, 0.18, 0, 1.4, 0.45, 1.3, 0), 0.7, 1.08, -0.1, 0.5);
  return gradient(merged([ico(0.7, 0, 0.45, 0, 1.2, 0.75, 1.1, 0), ico(0.5, 0.4, 0.62, 0.2, 1, 0.8, 1, 0)]), 0.62, 1.1, 0, 1.1);
}
/** The soft contact shadow disc (STYLE §1.1: alpha 0.34 at the centre, 0 at the rim), as plantArt draws it. */
export function shadowGeometry(): THREE.BufferGeometry {
  const seg = 10, pos: number[] = [], col: number[] = [];
  for (let k = 0; k < seg; k++) { const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2; pos.push(0, 0, 0, Math.cos(a0), 0, Math.sin(a0), Math.cos(a1), 0, Math.sin(a1)); col.push(0, 0, 0, 0.34, 0, 0, 0, 0, 0, 0, 0, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); return g;
}
/** A blossom or fruit dot (as plantArt's orchard dots). */
export const dotGeometry = (r: number) => new THREE.OctahedronGeometry(r, 0);
export type { PlantTheme };

/** Concatenates non-indexed geometries' position, normal and colour (and zero-fills `extra` 1-float attributes). */
export function concat(parts: readonly THREE.BufferGeometry[], extra: readonly string[] = []): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry(), keys: [string, number][] = [['position', 3], ['normal', 3], ['color', 3], ...extra.map(k => [k, parts.some(p => p.getAttribute(k)?.itemSize === 3) ? 3 : 1] as [string, number])];
  for (const [key, size] of keys) {
    const data: number[] = [];
    for (const p of parts) { const q = p.index ? p.toNonIndexed() : p, a = q.getAttribute(key), n = q.getAttribute('position').count;
      if (a) { for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) data.push(a.getComponent(i, k)); } else for (let i = 0; i < n * size; i++) data.push(key === 'color' ? 1 : 0);
      if (q !== p) q.dispose(); }
    out.setAttribute(key, new THREE.Float32BufferAttribute(data, size));
  }
  out.computeBoundingSphere(); return out;
}
/**
 * A Mountain v2 tree as ONE unit geometry (size 1): v2's trunk (`trunkGeometry`, scaled by `crownOf` exactly as plantArt
 * scales it, sunk 0.25) and v2's crown (`crownGeometry`). `aPart` is 1 on trunk vertices: the corridor tree material
 * paints those with the instance's trunk colour (`aTrunk`) and the rest with its leaf colour, so a tree is one draw.
 */
export function treeGeometry(kind: TreeKind): THREE.BufferGeometry {
  const t = trunkGeometry(), q = t.index ? t.toNonIndexed() : t; if (q !== t) t.dispose(); q.deleteAttribute('uv');
  const e = crownOf({ kind, size: 1 });
  q.scale(e.trunk, e.trunkTop + 0.4, e.trunk); q.translate(0, -0.25, 0); q.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(q.getAttribute('position').count).fill(1), 1));
  const c = crownGeometry(kind), g = concat([q, c], ['aPart']); q.dispose(); c.dispose(); return g;
}
