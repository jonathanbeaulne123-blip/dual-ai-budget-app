/**
 * Tideline Skate Club v2 · world — the analytic profiles every skate surface
 * is made of. Pure numbers: no three.js, no allocation in the hot path.
 *
 * Physics (`field.ts`) and the meshes (`meshes.ts`) both call these, so a
 * transition you ride is the transition you see.
 */

export const DEG = Math.PI / 180;

/** Frame convention shared with the island (`rampWorld`, `intoWorld`):
 *  world = origin + lx·(cos y, −sin y) + lz·(sin y, cos y). Local +lz is heading `yaw`. */
export type Frame = { readonly x: number; readonly z: number; readonly yaw: number };

export function frameToWorld(f: Frame, lx: number, lz: number): [number, number] {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  return [f.x + lx * c + lz * s, f.z + lz * c - lx * s];
}
export function worldToFrame(f: Frame, x: number, z: number): [number, number] {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = x - f.x, dz = z - f.z;
  return [dx * c - dz * s, dz * c + dx * s];
}
/** A child frame authored inside a parent frame. */
export function composeFrame(parent: Frame, lx: number, lz: number, yaw: number): Frame {
  const [x, z] = frameToWorld(parent, lx, lz);
  return { x, z, yaw: parent.yaw + yaw };
}
/** Local gradient (d/dlx, d/dlz) → world gradient (d/dx, d/dz). */
export function gradToWorld(yaw: number, glx: number, glz: number): [number, number] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [glx * c + glz * s, glz * c - glx * s];
}
export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------------------------------------------------------------- transitions */

/** A circular transition of radius R whose last strip stands at `angle` (radians from flat). */
export type Arc = { readonly R: number; readonly T: number; readonly H: number; readonly angle: number };
/** Solve the arc for a height and the angle its lip reaches. Transitions stop at ≤ 84°. */
export function arcFor(height: number, angleDeg: number): Arc {
  const angle = Math.min(84, Math.max(5, angleDeg)) * DEG;
  const R = height / (1 - Math.cos(angle));
  return { R, T: R * Math.sin(angle), H: height, angle };
}
/** Height of the arc at horizontal distance d from its toe (0 ≤ d ≤ T). */
export function arcHeight(a: Arc, d: number): number {
  const q = Math.sqrt(Math.max(0, a.R * a.R - d * d));
  return a.R - q;
}
/** dh/dd of the arc. */
export function arcSlope(a: Arc, d: number): number {
  const q = Math.sqrt(Math.max(1e-12, a.R * a.R - d * d));
  return d / q;
}

/* ---------------------------------------------------------------- banks */

/**
 * A C1 bank: flat at s ≤ 0, rises to `rise` at s = run, with quadratic fillets
 * of length `f` at the toe and the top so there is no crease for the sim to
 * trip on. Slope in the straight part is rise / (run − f).
 */
export type Bank = { readonly run: number; readonly rise: number; readonly f: number; readonly m: number };
export function bankFor(run: number, rise: number, fillet = 0.25): Bank {
  const f = Math.max(0, Math.min(fillet, run / 2 - 1e-6));
  return { run, rise, f, m: rise / (run - f) };
}
export function bankHeight(b: Bank, s: number): number {
  if (s <= 0) return 0;
  if (s >= b.run) return b.rise;
  if (b.f > 0 && s < b.f) return b.m * s * s / (2 * b.f);
  if (b.f > 0 && s > b.run - b.f) { const t = b.run - s; return b.rise - b.m * t * t / (2 * b.f); }
  return b.m * (s - b.f / 2);
}
export function bankSlope(b: Bank, s: number): number {
  if (s <= 0 || s >= b.run) return 0;
  if (b.f > 0 && s < b.f) return b.m * s / b.f;
  if (b.f > 0 && s > b.run - b.f) return b.m * (b.run - s) / b.f;
  return b.m;
}

/* ---------------------------------------------------------------- rounded rectangles */

/**
 * Signed distance to a rounded rectangle of half extents (a, b) and corner
 * radius r (r ≤ min(a, b)), written into `out` = [d, gx, gz] where (gx, gz) is
 * the unit gradient. Outside the shape the field is C1 (the shape is convex),
 * so a transition built on it has continuous normals round the corners.
 */
export function sdRoundRect(px: number, pz: number, a: number, b: number, r: number, out: Float64Array): void {
  const sx = px < 0 ? -1 : 1, sz = pz < 0 ? -1 : 1;
  const qx = Math.abs(px) - (a - r), qz = Math.abs(pz) - (b - r);
  if (qx > 0 && qz > 0) {
    const l = Math.hypot(qx, qz);
    out[0] = l - r; out[1] = sx * qx / l; out[2] = sz * qz / l;
  } else if (qx > qz) {
    out[0] = qx - r; out[1] = sx; out[2] = 0;
  } else {
    out[0] = qz - r; out[1] = 0; out[2] = sz;
  }
}

/**
 * Points round a rounded rectangle (counter-clockwise seen from +y, starting
 * at the +lx side's middle), with `perCorner` segments per quarter arc.
 * Returned as [lx, lz, nx, nz] with the outward unit normal.
 */
export function roundRectLoop(a: number, b: number, r: number, perCorner: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const corners: [number, number, number][] = [[a - r, b - r, 0], [-(a - r), b - r, Math.PI / 2], [-(a - r), -(b - r), Math.PI], [a - r, -(b - r), 1.5 * Math.PI]];
  // Walk: for each corner, its quarter arc from angle start to start+90°. Angles measured from +lx toward +lz.
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const t = start + (i / perCorner) * Math.PI / 2, nx = Math.cos(t), nz = Math.sin(t);
      const p: [number, number, number, number] = [cx + nx * r, cz + nz * r, nx, nz];
      const last = out[out.length - 1];
      if (last && Math.abs(last[0] - p[0]) < 1e-9 && Math.abs(last[1] - p[1]) < 1e-9) continue;
      out.push(p);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- polylines */

export function polyLength(points: readonly (readonly [number, number, number])[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) { const a = points[i - 1]!, b = points[i]!; l += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
  return l;
}
