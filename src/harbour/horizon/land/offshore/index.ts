import { requireScaleFactor } from '../../world/manifest';
import type { StructureSolid, XY } from '../interfaces';

/** A sea stack. Wave 7 (R3-111: "the Stacks are octagonal prisms"): a 12-sided irregular plan (a fixed per-stack radius
 * wobble, not a regular polygon) in strata tiers that step in and out as they rise and lean with `shift`, so the stack
 * reads as bedded rock; the base ring stands at −3 (settleFoundations carries it to the seabed). */
function rock(id: string, cx: number, cz: number, radius: number, top: number, shift: XY = [0, 0]): StructureSolid {
  const s = requireScaleFactor(), positions: number[] = [], indices: number[] = [], N = 12;
  let seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const profile: XY[] = Array.from({ length: N }, (_, i) => { const a = i / N * Math.PI * 2 + (rnd() - .5) * .25, r = .78 + rnd() * .3; return [Math.cos(a) * r, Math.sin(a) * r]; });
  // Tiers: [height fraction, size]; paired rows make a ledge (a short step out, then back in).
  const rows: [number, number][] = top <= 5 ? [[-3 / Math.max(top, 1), 1.08], [.5, 1], [1, .7]] : [[-3 / top, 1.1], [.18, 1.02], [.2, .96], [.42, .92], [.44, .86], [.63, .83], [.65, .76], [.84, .7], [.86, .63], [1, .55]];
  const tiers = rows.map(([f, size]) => ({ y: Math.max(-3, f * top), size, x: shift[0] * Math.max(0, f), z: shift[1] * Math.max(0, f) }));
  for (const t of tiers) for (const p of profile) positions.push((cx + radius * (p[0] * t.size + t.x)) * s, t.y * s, (cz + radius * (p[1] * t.size + t.z)) * s);
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, c, b, a, d, c);
  for (let r = 0; r < tiers.length - 1; r++) for (let i = 0; i < N; i++) quad(r * N + i, r * N + (i + 1) % N, (r + 1) * N + (i + 1) % N, (r + 1) * N + i);
  const topRing = (tiers.length - 1) * N;
  for (let i = 1; i < N - 1; i++) { indices.push(0, i, i + 1); indices.push(topRing, topRing + i + 1, topRing + i); }
  return { id, kind: 'stratifiedRock', positions, indices, surface: 'rock.sea', districtId: 'offshore', bedIds: [], walkable: false, role: 'rock' };
}
/** Wave 7 (R3-111, D-D6): the Needle's Eye as a real natural arch, not a box with a notch. Two legs stand in the sea
 * either side of an opening that runs east–west (the sunrise gate, MANIFEST sky.gates.needle: 22 × 16 at h 14), a lintel
 * crownTop − crownIntrados = 9 eu thick spans them, and the intrados is a true round-headed opening (vertical jambs to h 19, a semi-
 * ellipse to the crown at h 28). The rock is built in strata: horizontal bands whose faces step in and out (ledges on
 * both faces and on the outer flanks), deepest at the legs (22 eu along x) and thinnest at the lintel (13), so the arch
 * reads as legs + lintel from J's line (along x, through the opening) and from the sea. Greybox: one closed hexahedron per
 * band and leg, no texture. The base ring stands at −3 and settleFoundations carries it to the seabed. */
export const NEEDLE = { centre: [1790, 680] as XY, jamb: 14, springH: 19, crownIntrados: 28, crownTop: 37, base: -3, legDepth: 22, lintelDepth: 13 } as const;
/** Half-width (z) of the opening at height y; 0 above the crown's intrados. */
export function needleInner(y: number): number {
  const { jamb, springH, crownIntrados } = NEEDLE; if (y <= springH) return jamb; if (y >= crownIntrados) return 0;
  const t = (y - springH) / (crownIntrados - springH); return jamb * Math.sqrt(Math.max(0, 1 - t * t));
}
/** Half-width (z) of the rock's outer flank at height y (legs flare into the sea, the shoulders round over the crown). */
export function needleOuter(y: number): number {
  const pts: XY[] = [[-3, 28.5], [8, 27], [19, 25.5], [27, 21.5], [32, 15.5], [35.5, 8.5], [37, 0]];
  for (let i = 1; i < pts.length; i++) if (y <= pts[i]![0]) { const [y0, z0] = pts[i - 1]!, [y1, z1] = pts[i]!; return z0 + (z1 - z0) * Math.max(0, (y - y0) / (y1 - y0)); }
  return 0;
}
/** Hexahedron with an independent bottom and top rectangle (x0, x1, z0, z1): the box() topology, outward-wound. */
function hexa(positions: number[], indices: number[], bottom: readonly number[], top: readonly number[], yb: number, yt: number, s: number): void {
  const n = positions.length / 3, q = (r: readonly number[], y: number) => [[r[0]!, y, r[2]!], [r[0]!, y, r[3]!], [r[1]!, y, r[3]!], [r[1]!, y, r[2]!]];
  for (const p of [...q(bottom, yb), ...q(top, yt)]) positions.push(p[0]! * s, p[1]! * s, p[2]! * s);
  indices.push(...[0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7].map(i => n + i));
}
export function buildNeedleArch(): StructureSolid {
  const s = requireScaleFactor(), positions: number[] = [], indices: number[] = [], { centre: [cx, cz], base, crownIntrados, crownTop, legDepth, lintelDepth } = NEEDLE;
  const bands = [base, 3, 9, 14, 19, 21, 23, 24.5, 26, 27.2, crownIntrados, 31, 34.2, crownTop];
  const depth = (y: number) => legDepth - (legDepth - lintelDepth) * Math.min(1, Math.max(0, (y - 12) / (crownIntrados - 12)));
  for (let k = 1; k < bands.length; k++) {
    // Each band laps 0.02 under the one below: no two bands share a face plane (the sky proof's parity ray through the
    // opening counted a shared face once and read the open aperture as inside the rock).
    const y0 = bands[k - 1]! - (k > 1 ? .02 : 0), y1 = bands[k]!, ledge = k % 2 ? .7 : -.5, flank = k % 3 === 0 ? .6 : k % 3 === 1 ? -.3 : 0;
    // A band's own strata offset holds over its whole height: the steps between bands are the ledges.
    const half = depth((y0 + y1) / 2) / 2 + ledge;
    const rect = (_y: number, zA: number, zB: number) => [cx - half, cx + half, cz + zA, cz + zB];
    const oA = needleOuter(y0) + flank, oB = needleOuter(y1) + flank;
    if (y0 >= crownIntrados) hexa(positions, indices, rect(y0, -oA, oA), rect(y1, -oB, oB), y0, y1, s);
    else for (const side of [-1, 1]) {
      const iA = needleInner(y0), iB = needleInner(y1), lo = (o: number, i: number) => side < 0 ? [-o, -i] : [i, o];
      const [a0, a1] = lo(oA, iA), [b0, b1] = lo(oB, iB);
      hexa(positions, indices, rect(y0, a0!, a1!), rect(y1, b0!, b1!), y0, y1, s);
    }
  }
  return { id: 'offshore.needle', kind: 'naturalArch', positions, indices, surface: 'rock.sea', districtId: 'offshore', bedIds: [], walkable: false, role: 'rock' };
}
export function buildOffshoreSolids(): StructureSolid[] {
  return [
    buildNeedleArch(),
    rock('offshore.stacks.1', 1770, 880, 12, 24, [0.1, -0.12]),
    rock('offshore.stacks.2', 1810, 930, 13, 21, [-0.1, 0.08]),
    rock('offshore.stacks.3', 1750, 960, 11, 17, [0.06, 0.04]),
    rock('offshore.wreck.reef', 250, 1150, 30, 1.4),
    rock('offshore.wreck.ridge.1', 238, 1144, 9, 4),
    rock('offshore.wreck.ridge.2', 261, 1155, 7, 3.2),
  ];
}
