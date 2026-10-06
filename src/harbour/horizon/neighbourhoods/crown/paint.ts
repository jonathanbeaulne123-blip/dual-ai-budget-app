/**
 * Ground paint for the Highlands (protos/highlands §2.9; STYLE §1.5, §2.7): fields cut from a scalar rule with marching
 * squares, so a zone's edge follows the ground (a contour, a lane's verge, a wall's line) instead of a grid. A rule is
 * `f(x, z) > 0` inside; whole cells inside a row merge into one strip, cells on the edge become the marching-squares piece.
 * Paint never re-shapes ground (the runtime drapes it); every triangle is budgeted, so zones are drawn where they read.
 */
import type { Point2 } from '../../world/definition.ts';
import type { GroundPaint } from '../types.ts';
import { round } from './site.ts';

export interface Box { x0: number; x1: number; z0: number; z1: number }

export function paintField(f: (x: number, z: number) => number, box: Box, step: number, surface: GroundPaint['surface'], tone: (x: number, z: number) => number = () => .5): GroundPaint[] {
  const nx = Math.max(1, Math.ceil((box.x1 - box.x0) / step)), nz = Math.max(1, Math.ceil((box.z1 - box.z0) / step));
  const X = (i: number) => box.x0 + i * step, Z = (j: number) => box.z0 + j * step;
  const v: number[][] = [];
  for (let j = 0; j <= nz; j++) { const row: number[] = []; for (let i = 0; i <= nx; i++) row.push(f(X(i), Z(j))); v.push(row); }
  const out: GroundPaint[] = [], P = (x: number, z: number): Point2 => [round(x), round(z)];
  const push = (polygon: Point2[]) => {
    if (polygon.length < 3) return;
    let cx = 0, cz = 0; for (const p of polygon) { cx += p[0]; cz += p[1]; }
    out.push({ polygon, surface, tone: round(Math.max(0, Math.min(1, tone(cx / polygon.length, cz / polygon.length))), 1000) });
  };
  for (let j = 0; j < nz; j++) {
    let run = -1;
    const flush = (end: number) => { if (run >= 0) push([P(X(run), Z(j)), P(X(end), Z(j)), P(X(end), Z(j + 1)), P(X(run), Z(j + 1))]); run = -1; };
    for (let i = 0; i < nx; i++) {
      const a = v[j]![i]!, b = v[j]![i + 1]!, c = v[j + 1]![i + 1]!, d = v[j + 1]![i]!;
      if (a > 0 && b > 0 && c > 0 && d > 0) { if (run < 0) run = i; continue; }
      flush(i);
      if (a <= 0 && b <= 0 && c <= 0 && d <= 0) continue;
      // The cell's boundary walked a → b → c → d, keeping inside corners and the zero crossings between them.
      const corners: [number, number, number][] = [[X(i), Z(j), a], [X(i + 1), Z(j), b], [X(i + 1), Z(j + 1), c], [X(i), Z(j + 1), d]], poly: Point2[] = [];
      for (let k = 0; k < 4; k++) {
        const p = corners[k]!, q = corners[(k + 1) % 4]!;
        if (p[2] > 0) poly.push(P(p[0], p[1]));
        if ((p[2] > 0) !== (q[2] > 0)) { const t = p[2] / (p[2] - q[2]); poly.push(P(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)); }
      }
      push(poly);
    }
    flush(nx);
  }
  return out;
}

/** An annulus round an ellipse (shingle shores, wet stone round a pool) as `n` quads from `inner` to `outer` (× radii). */
export function ring(at: Point2, radii: readonly [number, number], inner: number, outer: number, n: number, surface: GroundPaint['surface'], tone: number, keep: (x: number, z: number) => boolean = () => true): GroundPaint[] {
  const out: GroundPaint[] = [];
  for (let k = 0; k < n; k++) {
    const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, E = (a: number, s: number): Point2 => [round(at[0] + Math.cos(a) * radii[0] * s), round(at[1] + Math.sin(a) * radii[1] * s)];
    const mid = E((a0 + a1) / 2, (inner + outer) / 2); if (!keep(mid[0], mid[1])) continue;
    out.push({ polygon: [E(a0, inner), E(a1, inner), E(a1, outer), E(a0, outer)], surface, tone });
  }
  return out;
}
