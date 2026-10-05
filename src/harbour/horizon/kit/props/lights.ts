/**
 * Lit and signal props: THE island lantern (the road kit's 2.6 eu lantern post — one definition for the Green's
 * Lantern Ring, the Reach posts, the Greenway and the Harbour), the low lantern, the 0.8 eu bollard light (it fits the
 * Green's protected centre: nothing over 0.85), festoon strings, the airfield beacon, the windsock and its red lamp,
 * a flag and a bell. Every light is a glow card (the 'glow' bucket the runtime raises at night); none adds a point
 * light (LIGHT §3: the 6 / 2 pool is untouched).
 */
import type { RGB, V3 } from '../../../art/cardScene.ts';
import { drawLamp } from '../road/lamps.ts';
import { L, beam, box, cone, dome, glowBox, glowOrb, lineOf, mix, post, quad, shade, shadow, tri, type Ctx } from './kit.ts';

/** The island lantern: a stone foot and the road kit's lantern post (head ≈ 2.83 eu; Classic brass four-pane). */
export function lantern(c: Ctx) {
  box(c, 0, 0, 0.16, 0.16, 0, 0.22, c.P.coping, c.P.stone);
  drawLamp(c.b, c.P, 'bridgeLantern', [c.x, c.y + 0.2 * c.s, c.z], c.full ? 'full' : 'lite');
  shadow(c, 0.35, 0.35, 0.22);
}
/** A low lantern (path edges): a 0.9 eu post and a small lantern head lit at night. */
export function lanternLow(c: Ctx) {
  const P = c.P, postC = c.theme === 'classic' ? P.iron : c.theme === 'taylor' ? P.timberLight : P.trim, frame = c.theme === 'classic' ? P.brass : c.theme === 'taylor' ? P.paperEdge : P.galvanised;
  box(c, 0, 0, 0.09, 0.09, 0, 0.12, P.coping, P.stone, null);
  post(c, 0, 0, 0.1, 0.86, 0.045, postC, 6, 'steel');
  cone(c, 0, 0, 0.84, 0.88, 0.07, 0.11, frame, 4, 'steel');
  if (c.theme === 'taylor') { cone(c, 0, 0, 0.88, 1.02, 0.09, 0.12, P.glassNight, 8); glowBox(c, 0, 0.98, 0, 0.1, 0.08, P.glassNight); cone(c, 0, 0, 1.08, 1.13, 0.1, 0.06, P.lanternRoof, 8); }
  else { glowBox(c, 0, 0.98, 0, 0.095, 0.1, P.glassNight); cone(c, 0, 0, 1.08, 1.2, 0.13, 0.02, c.theme === 'newfoundland' ? P.galvanised : P.lanternRoof, 4, 'steel'); }
  shadow(c, 0.2, 0.2, 0.2);
}
/** The bollard light: 0.8 eu to the top of its cap (the Green Road's lanterns inside the protected circle, rule 12). */
export function bollard(c: Ctx) {
  const P = c.P, body = c.theme === 'taylor' ? P.walls[1]! : c.theme === 'newfoundland' ? P.walls[3]! : P.iron, cap = c.theme === 'classic' ? P.brass : P.trim, bucket = c.theme === 'taylor' ? 'card' : 'steel';
  post(c, 0, 0, 0, 0.56, 0.14, body, 8, bucket);
  cone(c, 0, 0, 0.56, 0.6, 0.14, 0.16, body, 8, bucket);
  // the lit band: a short glass drum (glow) under the cap
  for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, r = 0.115;
    quad(c, [Math.cos(a0) * r, 0.6, Math.sin(a0) * r], [Math.cos(a1) * r, 0.6, Math.sin(a1) * r], [Math.cos(a1) * r, 0.71, Math.sin(a1) * r], [Math.cos(a0) * r, 0.71, Math.sin(a0) * r], P.glassNight, 'glow'); }
  cone(c, 0, 0, 0.71, 0.74, 0.17, 0.17, cap, 8, 'steel');
  cone(c, 0, 0, 0.74, 0.8, 0.17, 0.04, cap, 8, 'steel');
  if (c.theme === 'newfoundland' && c.full) { const ring: V3[] = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI * 2; ring.push(L(c, Math.cos(a) * 0.16, 0.3 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.16)); } c.b.tube(ring, 0.03 * c.s, P.rope, 4); }
  if (c.theme === 'taylor' && c.full) box(c, 0, 0, 0.15, 0.15, 0.36, 0.42, P.tape[0]!, P.tape[0]!, null, 0.3);
  shadow(c, 0.22, 0.22, 0.2);
}
/** Taylor's one concert-light string colours (STYLE §1.3: concert lights in Taylor only). */
const CONCERT: readonly RGB[] = [[1, 0.56, 0.69], [0.56, 0.82, 1], [1, 0.88, 0.56], [0.72, 1, 0.6], [0.85, 0.63, 1]];
/** A festoon: a string of glow bulbs along `line` (sagging between its points; ~1.3 eu apart, every 4th warm pink). */
export function festoon(c: Ctx) {
  const pts = lineOf(c), b = c.b, warm: RGB = [1, 0.84, 0.59], pink: RGB = [1, 0.7, 0.63], wire = c.theme === 'taylor' ? c.P.paperEdge : c.P.iron;
  let n = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, d = pts[i]!, len = Math.hypot(d[0] - a[0], d[2] - a[2]), sag = Math.min(1.1, len * 0.07), at = (t: number): V3 => [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t - sag * Math.sin(Math.PI * t), a[2] + (d[2] - a[2]) * t];
    const seg = Math.max(4, Math.round(len / 1.3)); for (let k = 0; k < seg; k++) b.line(at(k / seg), at((k + 1) / seg), wire);
    const bulbs = Math.max(3, Math.round(len / (c.full ? 1.3 : 2.6)));
    for (let k = 1; k < bulbs; k++, n++) { const p = at(k / bulbs), col = c.theme === 'taylor' ? CONCERT[n % CONCERT.length]! : n % 4 === 3 ? pink : warm;
      const r = 0.07 * c.s; for (let q = 0; q < 4; q++) { const a0 = (q / 4) * Math.PI * 2, a1 = ((q + 1) / 4) * Math.PI * 2; for (const y of [r, -r * 1.3]) b.tri([p[0] + Math.cos(a0) * r, p[1] - 0.06, p[2] + Math.sin(a0) * r], [p[0] + Math.cos(a1) * r, p[1] - 0.06, p[2] + Math.sin(a1) * r], [p[0], p[1] - 0.06 + y, p[2]], col, 'glow'); }
      b.line(p, [p[0], p[1] - 0.04, p[2]], wire); }
  }
}
/** The airfield beacon (green / white): a lamp drum on a short mast, half its lens green, half white (a static glow; the
 * sweep comes with the night track in PR 5). */
export function beacon(c: Ctx) {
  const P = c.P, mast = c.theme === 'taylor' ? P.paperEdge : P.iron;
  post(c, 0, 0, 0, 0.75, 0.06, mast, 6, 'steel');
  cone(c, 0, 0, 0.75, 0.82, 0.32, 0.32, mast, 8, 'steel');
  const r = 0.26;
  for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, col = k < 4 ? P.signalGreen : P.signalWhite;
    quad(c, [Math.cos(a0) * r, 0.84, Math.sin(a0) * r], [Math.cos(a1) * r, 0.84, Math.sin(a1) * r], [Math.cos(a1) * r, 1.2, Math.sin(a1) * r], [Math.cos(a0) * r, 1.2, Math.sin(a0) * r], col, 'glow'); }
  cone(c, 0, 0, 1.2, 1.26, 0.3, 0.3, mast, 8, 'steel'); dome(c, 0, 1.26, 0, 0.24, mast, 8, 2, 'steel');
  if (c.full) post(c, 0, 0, 1.5, 1.75, 0.012, mast, 3, 'steel');
}
/** A windsock: a 6.2 eu mast, an iron ring, the sock streaming toward local +z (downwind) and drooping 0.25 rad in its
 * dressing's stripes, a red lamp on the mast top. */
export function windsock(c: Ctx) {
  const P = c.P, mast = c.theme === 'taylor' ? P.paperEdge : c.theme === 'newfoundland' ? P.trim : P.chalkLine, H = 6.2;
  cone(c, 0, 0, 0, H, 0.1, 0.07, mast, 6, 'steel');
  box(c, 0, 0, 0.18, 0.18, 0, 0.12, P.concrete, shade(P.concrete, 0.85));
  const ring: V3[] = []; for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI * 2; ring.push(L(c, Math.cos(a) * 0.36, H - 0.2, 0.36 + Math.sin(a) * 0.36)); } c.b.tube(ring, 0.025 * c.s, P.iron, 4);
  beam(c, [0, H - 0.2, 0.02], [0, H - 0.2, 0.2], 0.04, 0.04, P.iron, 'steel', false);
  const bands = 5, len = 2.6, n = c.full ? 8 : 6, pitch = 0.25;
  for (let j = 0; j < bands; j++) {
    const t0 = j / bands, t1 = (j + 1) / bands, r0 = 0.36 - 0.24 * t0, r1 = 0.36 - 0.24 * t1, z0 = 0.36 + len * t0, z1 = 0.36 + len * t1, y0 = H - 0.2 - Math.sin(pitch) * len * t0, y1 = H - 0.2 - Math.sin(pitch) * len * t1, col = P.sock[j % 2]!;
    for (let k = 0; k < n; k++) { const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, lit = 0.86 + 0.18 * Math.sin((a0 + a1) / 2);
      quad(c, [Math.cos(a0) * r0, y0 + Math.sin(a0) * r0, z0], [Math.cos(a1) * r0, y0 + Math.sin(a1) * r0, z0], [Math.cos(a1) * r1, y1 + Math.sin(a1) * r1, z1], [Math.cos(a0) * r1, y1 + Math.sin(a0) * r1, z1], shade(col, lit)); }
  }
  glowOrb(c, [0, H + 0.1, 0], 0.08, P.signalRed);
  shadow(c, 0.3, 0.3, 0.2);
}
/** A flag on a pole (no text): three bands of the dressing's colours, flying toward local +z. */
export function flag(c: Ctx) {
  const P = c.P, H = 6, pole = c.theme === 'classic' ? P.chalkLine : P.trim;
  cone(c, 0, 0, 0, H, 0.06, 0.04, pole, 6, 'steel'); dome(c, 0, H, 0, 0.07, c.theme === 'classic' ? P.brass : P.accent, 6, 2, 'steel');
  const w = 1.5, h = 0.95, top = H - 0.15, wave = (z: number) => Math.sin(z * 2.6) * 0.08;
  for (let j = 0; j < 3; j++) { const y1 = top - (h / 3) * j, y0 = y1 - h / 3, col = P.bands[j % P.bands.length]!;
    for (let k = 0; k < (c.full ? 3 : 1); k++) { const z0 = (w * k) / (c.full ? 3 : 1), z1 = (w * (k + 1)) / (c.full ? 3 : 1);
      quad(c, [wave(z0), y0, z0 + 0.05], [wave(z1), y0 - 0.03 * z1, z1 + 0.05], [wave(z1), y1 - 0.03 * z1, z1 + 0.05], [wave(z0), y1, z0 + 0.05], shade(col, 0.95 + 0.08 * Math.cos(z0 * 2.6))); } }
  shadow(c, 0.2, 0.2, 0.2);
}
/** A bell: a bronze bell hung in a timber gallows (variant 0) or a ship's bell on a post with a bracket (variant 1). */
export function bell(c: Ctx) {
  const P = c.P, wood = P.woodDark, bronze = P.bronze, ship = (c.rec.variant ?? 0) === 1;
  const hang = (y: number, r: number, z = 0) => { const n = c.full ? 10 : 7; cone(c, 0, z, y - r * 1.5, y - r * 0.2, r, r * 0.55, bronze, n, 'steel'); dome(c, 0, y - r * 0.2, z, r * 0.55, bronze, n, 2, 'steel'); cone(c, 0, z, y - r * 1.62, y - r * 1.5, r * 1.08, r, shade(bronze, 0.85), n, 'steel'); if (c.full) c.b.line(L(c, 0, y - r * 1.5, z), L(c, 0.02, y - r * 3.2, z + 0.05), P.rope); };
  if (ship) { box(c, 0, 0, 0.07, 0.07, 0, 1.9, shade(wood, 1.05), wood); beam(c, [0, 1.8, 0], [0, 1.8, 0.45], 0.06, 0.08, P.iron, 'steel', false); hang(1.76, 0.16, 0.42); shadow(c, 0.25, 0.25, 0.2); return; }
  for (const x of [-0.6, 0.6]) box(c, x, 0, 0.08, 0.08, 0, 2.4, shade(wood, 1.05), wood);
  beam(c, [-0.75, 2.35, 0], [0.75, 2.35, 0], 0.14, 0.16, wood);
  for (const x of [-0.6, 0.6]) beam(c, [x, 1.9, 0], [x * 0.55, 2.3, 0], 0.06, 0.06, wood, 'card', false);
  hang(2.27, 0.26);
  shadow(c, 0.8, 0.3, 0.22);
}
export { tri, mix };
