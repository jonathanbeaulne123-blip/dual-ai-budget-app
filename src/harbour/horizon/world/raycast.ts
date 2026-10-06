import type { LandCuts, StructureSolid, TerrainField } from '../land/interfaces.ts';
import type { Point3 } from './definition.ts';
import { terrainTriangleVisible } from '../land/terrain/index.ts';
import { waterHeightAt } from '../land/water/index.ts';
import { terrainHeight } from './geometry.ts';
import { isOpenRail } from '../land/structures/openRail.ts';
export { isOpenRail };

/**
 * One first-hit ray caster over the SAME data the renderer draws: the heightfield (mouth masks
 * honoured), every water surface, every structure solid, and the open sea beyond the terrain grid.
 * It is the view proof's ID buffer (world/views.ts) and the probes' ray (scripts/horizon/report.mjs).
 * Adapted from the Stage A review's independent probe (Auditor 5, lib5.mjs) so the delivery measures
 * what the review measured.
 */
export type RayHit =
  | { kind: 'solid'; t: number; id: string; sourceId: string; role: StructureSolid['role']; point: Point3 }
  | { kind: 'water'; t: number; id: string; point: Point3 }
  | { kind: 'terrain'; t: number; id: 'terrain'; point: Point3 }
  | { kind: 'sky'; t: number; id: 'sky' };
export interface RayCaster { first(origin: Point3, direction: Point3, maxT?: number, options?: { underground?: boolean; step?: number; skip?: (solid: StructureSolid) => boolean }): RayHit; floorAt(x: number, z: number): number }

export function createRayCaster(field: TerrainField, cuts: Pick<LandCuts, 'solids' | 'waters' | 'mouths'>): RayCaster {
  const width = (field.columns - 1) * field.step, depth = (field.rows - 1) * field.step;
  // Water level grid (5 eu) for the surface waters; underground waters are tested exactly.
  const WS = 5, WW = Math.ceil(width / WS) + 1, WD = Math.ceil(depth / WS) + 1, level = new Float32Array(WW * WD).fill(-Infinity), levelId: (string | null)[] = new Array(WW * WD).fill(null);
  const surface = cuts.waters.filter(w => !w.underground && w.kind !== 'dry'), below = cuts.waters.filter(w => w.underground && w.kind !== 'dry');
  // The sea is the default water everywhere offshore; a named body at the same level (the Bight's lagoon) wins the tie.
  for (let j = 0; j < WD; j++) for (let i = 0; i < WW; i++) for (const w of surface) { const l = waterHeightAt(w, i * WS, j * WS), k = j * WW + i; if (l !== null && (l > level[k]! || l === level[k]! && w.kind !== 'sea')) { level[k] = l; levelId[k] = w.id; } }
  const waterAt = (x: number, z: number, underground: boolean): { level: number; id: string | null } => {
    if (underground) { let best: { level: number; id: string | null } = { level: -Infinity, id: null }; for (const w of below) { const l = waterHeightAt(w, x, z); if (l !== null && l > best.level) best = { level: l, id: w.id }; } return best; }
    const i = Math.round(x / WS), j = Math.round(z / WS);
    if (i < 0 || j < 0 || i >= WW || j >= WD) return { level: 0, id: 'water.sea' };
    return { level: level[j * WW + i]!, id: levelId[j * WW + i] ?? null };
  };
  // Triangle grid (25 eu cells) over every solid.
  const C = 25, GW = Math.ceil((width + 200) / C), GD = Math.ceil((depth + 200) / C), cells: number[][] = Array.from({ length: GW * GD }, () => []), tris: number[] = [], owner: number[] = [];
  const cellMin = new Float32Array(GW * GD).fill(Infinity), cellMax = new Float32Array(GW * GD).fill(-Infinity);
  cuts.solids.forEach((solid, si) => {
    // One rule (land/structures/openRail.ts `isOpenRail`): an open rail — posts and bars, never a wall (the Water's Way open
    // timber rails, D-WW18; the road main's post-and-rail guard collider, whose visible kit is the corridor art) — is seen
    // through as the eye does, by the view proofs and the story sight chain alike. A stone parapet or a solid rail stays opaque.
    if (isOpenRail(solid)) return;
    const p = solid.positions, ix = solid.indices;
    for (let k = 0; k < ix.length; k += 3) {
      const a = ix[k]! * 3, b = ix[k + 1]! * 3, c = ix[k + 2]! * 3, t = owner.length;
      tris.push(p[a]!, p[a + 1]!, p[a + 2]!, p[b]!, p[b + 1]!, p[b + 2]!, p[c]!, p[c + 1]!, p[c + 2]!); owner.push(si);
      const x0 = Math.max(0, Math.floor(Math.min(p[a]!, p[b]!, p[c]!) / C)), x1 = Math.min(GW - 1, Math.floor(Math.max(p[a]!, p[b]!, p[c]!) / C));
      const z0 = Math.max(0, Math.floor(Math.min(p[a + 2]!, p[b + 2]!, p[c + 2]!) / C)), z1 = Math.min(GD - 1, Math.floor(Math.max(p[a + 2]!, p[b + 2]!, p[c + 2]!) / C));
      const y0 = Math.min(p[a + 1]!, p[b + 1]!, p[c + 1]!), y1 = Math.max(p[a + 1]!, p[b + 1]!, p[c + 1]!);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const ci = z * GW + x; cells[ci]!.push(t); if (y0 < cellMin[ci]!) cellMin[ci] = y0; if (y1 > cellMax[ci]!) cellMax[ci] = y1; }
    }
  });
  const stamp = new Uint32Array(owner.length); let stampId = 0;
  const rayTri = (o: Point3, d: Point3, t: number): number => {
    const T = t * 9, e1x = tris[T + 3]! - tris[T]!, e1y = tris[T + 4]! - tris[T + 1]!, e1z = tris[T + 5]! - tris[T + 2]!, e2x = tris[T + 6]! - tris[T]!, e2y = tris[T + 7]! - tris[T + 1]!, e2z = tris[T + 8]! - tris[T + 2]!;
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) return Infinity;
    const inv = 1 / det, tx = o[0] - tris[T]!, ty = o[1] - tris[T + 1]!, tz = o[2] - tris[T + 2]!, u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return Infinity;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) return Infinity;
    const h = (e2x * qx + e2y * qy + e2z * qz) * inv; return h > 1e-4 ? h : Infinity;
  };
  /** Exact 2D grid traversal (Amanatides–Woo); a cell is tested only if the ray's height span over it meets the cell's solids. */
  function raySolids(o: Point3, d: Point3, maxT: number, skip?: (solid: StructureSolid) => boolean): { t: number; si: number } | null {
    stampId++; let best = Infinity, bestS = -1;
    let cx = Math.floor(o[0] / C), cz = Math.floor(o[2] / C);
    const sx = d[0] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1, dx = Math.abs(d[0]) < 1e-12 ? Infinity : C / Math.abs(d[0]), dz = Math.abs(d[2]) < 1e-12 ? Infinity : C / Math.abs(d[2]);
    let tx = Math.abs(d[0]) < 1e-12 ? Infinity : ((sx > 0 ? (cx + 1) * C : cx * C) - o[0]) / d[0], tz = Math.abs(d[2]) < 1e-12 ? Infinity : ((sz > 0 ? (cz + 1) * C : cz * C) - o[2]) / d[2], t0 = 0;
    for (let guard = 0; guard < 4 * (GW + GD) && t0 <= Math.min(maxT, best); guard++) {
      const t1 = Math.min(tx, tz, maxT);
      if (cx >= 0 && cz >= 0 && cx < GW && cz < GD) {
        const ci = cz * GW + cx, ya = o[1] + d[1] * t0, yb = o[1] + d[1] * t1;
        if (Math.min(ya, yb) <= cellMax[ci]! + 1e-3 && Math.max(ya, yb) >= cellMin[ci]! - 1e-3)
          for (const ti of cells[ci]!) { if (stamp[ti] === stampId) continue; stamp[ti] = stampId; if (skip?.(cuts.solids[owner[ti]!]!)) continue; const h = rayTri(o, d, ti); if (h < best && h <= maxT) { best = h; bestS = owner[ti]!; } }
      } else if ((cx < 0 && sx < 0) || (cz < 0 && sz < 0) || (cx >= GW && sx > 0) || (cz >= GD && sz > 0)) break;
      if (t1 >= maxT) break;
      t0 = t1; if (tx < tz) { tx += dx; cx += sx; } else { tz += dz; cz += sz; }
    }
    return bestS < 0 ? null : { t: best, si: bestS };
  }
  const H = (x: number, z: number) => terrainHeight(field, x, z);
  function first(o: Point3, d: Point3, maxT = 2600, options: { underground?: boolean; step?: number; skip?: (solid: StructureSolid) => boolean } = {}): RayHit {
    const step = options.step ?? 2, underground = options.underground === true;
    let terrainT = Infinity, waterT = Infinity, waterId = '';
    // One march over terrain and water. The step grows with the ray's clearance over max(ground, water)
    // (never below `step`, never more than 0.4 × the clearance), so open-sky rays stay cheap.
    // An underground eye starts below the heightfield: its rooms are closed by their solids, and the
    // terrain only counts once the ray has come out into the air (the Throat's mouth).
    let prev = 0, inAir = !underground || o[1] >= H(o[0], o[2]), exited = false;
    for (let t = step; t <= maxT;) {
      const x = o[0] + d[0] * t, z = o[2] + d[2] * t, y = o[1] + d[1] * t;
      if (x < -50 || z < -50 || x > width + 50 || z > depth + 50) { exited = true; break; }
      const inside = x >= 0 && z >= 0 && x <= width && z <= depth, ground = inside ? H(x, z) : -Infinity;
      const w = waterAt(x, z, underground && y < ground);
      if (w.id && y < w.level && (inAir || y < w.level)) { waterT = t; waterId = w.id; break; }
      if (!inAir) { if (y >= ground) inAir = true; prev = t; t += step; continue; }
      if (inside && y < ground && terrainTriangleVisible(x, z, cuts)) { let lo = prev, hi = t; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (o[1] + d[1] * m < H(o[0] + d[0] * m, o[2] + d[2] * m)) hi = m; else lo = m; } terrainT = hi; break; }
      if (y > 400 && d[1] >= 0) break;
      prev = t; t += Math.max(step, .4 * (y - Math.max(ground, w.id ? w.level : -Infinity, 0)));
    }
    if (waterT < terrainT && waterT > step) { let lo = Math.max(0, waterT - step * 8), hi = waterT; for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2, x = o[0] + d[0] * m, z = o[2] + d[2] * m, q = waterAt(x, z, false); if (q.id && o[1] + d[1] * m < q.level) hi = m; else lo = m; } waterT = hi; }
    // The open sea beyond the terrain grid is a plane at sea level (page H's west sea lies beyond the 2 km grid).
    if (!underground && waterT === Infinity && terrainT === Infinity && d[1] < 0) { const t = -o[1] / d[1]; if (t > 0 && (exited ? t < 8000 : t <= maxT)) { waterT = t; waterId = 'water.sea'; } }
    const limit = Math.min(maxT, terrainT, waterT), solid = raySolids(o, d, limit, options.skip);
    const at = (t: number): Point3 => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    if (solid) { const s = cuts.solids[solid.si]!; return { kind: 'solid', t: solid.t, id: s.id, sourceId: (s as StructureSolid & { sourceId?: string }).sourceId ?? s.id.split('@')[0]!, role: s.role, point: at(solid.t) }; }
    if (waterT < terrainT) { const p = at(waterT); return { kind: 'water', t: waterT, id: waterId, point: p }; }
    if (terrainT < Infinity) return { kind: 'terrain', t: terrainT, id: 'terrain', point: at(terrainT) };
    return { kind: 'sky', t: Infinity, id: 'sky' };
  }
  function floorAt(x: number, z: number): number {
    const hit = raySolids([x, 400, z], [0, -1, 0], 400, solid => !solid.walkable);
    return Math.max(H(x, z), hit ? 400 - hit.t : -Infinity);
  }
  return { first, floorAt };
}
