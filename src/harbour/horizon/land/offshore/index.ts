import { requireScaleFactor } from '../../world/manifest';
import type { StructureSolid, XY } from '../interfaces';

function rock(id: string, cx: number, cz: number, radius: number, top: number, shift: XY = [0, 0]): StructureSolid {
  const s = requireScaleFactor(), positions: number[] = [], indices: number[] = [];
  const profile: XY[] = [[-0.91, -0.3], [-0.62, -0.83], [0.12, -1], [0.83, -0.52], [1, 0.18], [0.61, 0.78], [-0.24, 1], [-0.84, 0.48]];
  const tiers = [{ y: -3, size: 1.08, x: 0, z: 0 }, { y: top * 0.28, size: 1, x: -0.06, z: 0.04 }, { y: top * 0.72, size: 0.8, x: 0.08, z: -0.05 }, { y: top, size: 0.55, x: shift[0], z: shift[1] }];
  for (const t of tiers) for (const p of profile) positions.push((cx + radius * (p[0] * t.size + t.x)) * s, t.y * s, (cz + radius * (p[1] * t.size + t.z)) * s);
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, c, b, a, d, c);
  for (let r = 0; r < tiers.length - 1; r++) for (let i = 0; i < profile.length; i++) quad(r * 8 + i, r * 8 + (i + 1) % 8, (r + 1) * 8 + (i + 1) % 8, (r + 1) * 8 + i);
  for (let i = 1; i < 7; i++) { indices.push(0, i, i + 1); indices.push(24, 24 + i + 1, 24 + i); }
  return { id, kind: 'stratifiedRock', positions, indices, surface: 'rock.sea', districtId: 'offshore', bedIds: [], walkable: false, role: 'rock' };
}
/** A thick U-shaped geological solid. The 22 × 16 m gate rectangle at y=14 is
 * fully open; the intrados is actual mesh geometry, visible from below. */
export function buildNeedleArch(): StructureSolid {
  const s = requireScaleFactor(), positions: number[] = [], indices: number[] = [];
  // Points run up the south leg, across the crown and down the north leg.
  const outer: XY[] = [[-34, -3], [-31, 17], [-22, 28], [17, 30], [29, 18], [34, -3]];
  const inner: XY[] = [[-13, -3], [-13, 12], [-11.2, 22.2], [11.2, 22.2], [13, 12], [13, -3]];
  for (const x of [-10, 10]) for (const contour of [outer, inner]) for (const p of contour) positions.push((1790 + x) * s, p[1] * s, (680 + p[0]) * s);
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
  for (let i = 0; i < 5; i++) {
    quad(i, i + 1, i + 7, i + 6); // West face, five solid bands around opening.
    quad(i + 12, i + 18, i + 19, i + 13);
    quad(i, i + 12, i + 13, i + 1); // Outer rock and intrados.
    quad(i + 6, i + 7, i + 19, i + 18);
  }
  quad(0, 6, 18, 12); quad(5, 17, 23, 11);
  // The contour traversal above is inward in xyz; reverse once so west/east
  // faces, the intrados and both submerged feet all face out of the rock volume.
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
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
