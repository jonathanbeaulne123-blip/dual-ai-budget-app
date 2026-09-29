/**
 * Low-poly shape kit for the board (T3; pure arrays, no three). Every board mark is authored in DESIGN UNITS
 * (≈ 1 CSS px at the reference zoom): the mark material places a shape at an anchor and multiplies it by the
 * camera's world-per-pixel, so spaces, posts and the piece keep a readable screen size at every tier (clamped).
 * Shapes are flat-shaded triangle soups (a normal per face) with a base colour, a `tint` (0 = keep the base colour,
 * 1 = take the instance/state colour) and a `shade` multiplier for sides and insets.
 */

export type Vec3 = [number, number, number];
export type Shape = { positions: number[]; normals: number[]; colors: number[]; tints: number[]; shades: number[] };
export type Paint = { color?: string | Vec3; tint?: number; shade?: number };

export const emptyShape = (): Shape => ({ positions: [], normals: [], colors: [], tints: [], shades: [] });

export function hexToRgb(hex: string): Vec3 {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const rgb = (c: Paint["color"]): Vec3 => (c === undefined ? [1, 1, 1] : typeof c === "string" ? hexToRgb(c) : c);

function pushTri(s: Shape, a: Vec3, b: Vec3, c: Vec3, paint: Paint) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  const col = rgb(paint.color), tint = paint.tint ?? 0, shade = paint.shade ?? 1;
  for (const p of [a, b, c]) {
    s.positions.push(p[0], p[1], p[2]);
    s.normals.push(nx, ny, nz);
    s.colors.push(col[0], col[1], col[2]);
    s.tints.push(tint);
    s.shades.push(shade);
  }
}

/** Counter-clockwise quad (a, b, c, d) seen from its front. */
function pushQuad(s: Shape, a: Vec3, b: Vec3, c: Vec3, d: Vec3, paint: Paint) {
  pushTri(s, a, b, c, paint);
  pushTri(s, a, c, d, paint);
}

export function merge(...shapes: Shape[]): Shape {
  const out = emptyShape();
  for (const s of shapes) {
    out.positions.push(...s.positions); out.normals.push(...s.normals); out.colors.push(...s.colors);
    out.tints.push(...s.tints); out.shades.push(...s.shades);
  }
  return out;
}

export function triangleCount(s: Shape): number {
  return s.positions.length / 9;
}

/** Translate / rotate about +y (radians) / scale a shape (returns a new one). */
export function transform(s: Shape, t: { at?: Vec3; yaw?: number; scale?: number | Vec3; tilt?: number }): Shape {
  const [tx, ty, tz] = t.at ?? [0, 0, 0];
  const sc: Vec3 = typeof t.scale === "number" ? [t.scale, t.scale, t.scale] : t.scale ?? [1, 1, 1];
  const cy = Math.cos(t.yaw ?? 0), sy = Math.sin(t.yaw ?? 0), cx = Math.cos(t.tilt ?? 0), sx = Math.sin(t.tilt ?? 0);
  const out: Shape = { positions: [], normals: [], colors: [...s.colors], tints: [...s.tints], shades: [...s.shades] };
  for (let i = 0; i < s.positions.length; i += 3) {
    // scale → tilt about +z → yaw about +y → translate
    let x = s.positions[i]! * sc[0], y = s.positions[i + 1]! * sc[1], z = s.positions[i + 2]! * sc[2];
    [x, y] = [x * cx - y * sx, x * sx + y * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    out.positions.push(x + tx, y + ty, z + tz);
    let nx = s.normals[i]! / sc[0], ny = s.normals[i + 1]! / sc[1], nz = s.normals[i + 2]! / sc[2];
    [nx, ny] = [nx * cx - ny * sx, nx * sx + ny * cx];
    [nx, nz] = [nx * cy + nz * sy, -nx * sy + nz * cy];
    const len = Math.hypot(nx, ny, nz) || 1;
    out.normals.push(nx / len, ny / len, nz / len);
  }
  return out;
}

/**
 * A (possibly tapered) prism around +y: `sides` corners, radius r0 at y0 and r1 at y1, with caps. `phase` rotates
 * the corners (radians). Caps and sides take their own paints.
 */
export function prism(o: { sides: number; r0: number; r1?: number; y0: number; y1: number; phase?: number; side?: Paint; top?: Paint | null; bottom?: Paint | null }): Shape {
  const s = emptyShape();
  const r1 = o.r1 ?? o.r0, phase = o.phase ?? Math.PI / o.sides;
  const ring = (r: number, y: number): Vec3[] => Array.from({ length: o.sides }, (_, i) => {
    const a = phase + (i / o.sides) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  const lo = ring(o.r0, o.y0), hi = ring(r1, o.y1);
  const side = o.side ?? {};
  for (let i = 0; i < o.sides; i += 1) {
    const j = (i + 1) % o.sides;
    pushQuad(s, lo[i]!, hi[i]!, hi[j]!, lo[j]!, side);
  }
  if (o.top !== null && r1 > 0) for (let i = 1; i + 1 < o.sides; i += 1) pushTri(s, hi[0]!, hi[i + 1]!, hi[i]!, o.top ?? side);
  if (o.bottom !== null && o.bottom !== undefined && o.r0 > 0) for (let i = 1; i + 1 < o.sides; i += 1) pushTri(s, lo[0]!, lo[i]!, lo[i + 1]!, o.bottom);
  return s;
}

/** A flat ring (annulus) band between radii at height y, optionally with an outer wall down to y0. */
export function ring(o: { sides: number; rIn: number; rOut: number; y: number; y0?: number; phase?: number; top?: Paint; wall?: Paint; innerWall?: Paint; innerY?: number }): Shape {
  const s = emptyShape();
  const phase = o.phase ?? Math.PI / o.sides;
  const at = (r: number, y: number, i: number): Vec3 => {
    const a = phase + (i / o.sides) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  for (let i = 0; i < o.sides; i += 1) {
    const j = (i + 1) % o.sides;
    pushQuad(s, at(o.rIn, o.y, i), at(o.rIn, o.y, j), at(o.rOut, o.y, j), at(o.rOut, o.y, i), o.top ?? {});
    if (o.y0 !== undefined) pushQuad(s, at(o.rOut, o.y0, i), at(o.rOut, o.y, i), at(o.rOut, o.y, j), at(o.rOut, o.y0, j), o.wall ?? o.top ?? {});
    if (o.innerY !== undefined) pushQuad(s, at(o.rIn, o.innerY, j), at(o.rIn, o.y, j), at(o.rIn, o.y, i), at(o.rIn, o.innerY, i), o.innerWall ?? o.top ?? {});
  }
  return s;
}

/** Axis-aligned box centred at (cx, ·, cz), from y0 to y1. */
export function box(o: { w: number; d: number; y0: number; y1: number; at?: [number, number]; paint?: Paint; top?: Paint }): Shape {
  const s = emptyShape();
  const [cx, cz] = o.at ?? [0, 0], hw = o.w / 2, hd = o.d / 2;
  const x0 = cx - hw, x1 = cx + hw, z0 = cz - hd, z1 = cz + hd, y0 = o.y0, y1 = o.y1;
  const p = o.paint ?? {}, top = o.top ?? p;
  pushQuad(s, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top); // +y
  pushQuad(s, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], p); // +z
  pushQuad(s, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], p); // −z
  pushQuad(s, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], p); // +x
  pushQuad(s, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], p); // −x
  return s;
}

/** A vertical plate (flag, pennant, slip) in the x/y plane with thickness `t`, from polygon points (x, y). */
export function plate(points: readonly [number, number][], t: number, paint: Paint): Shape {
  const s = emptyShape();
  const hz = t / 2;
  for (let i = 1; i + 1 < points.length; i += 1) {
    const a = points[0]!, b = points[i]!, c = points[i + 1]!;
    pushTri(s, [a[0], a[1], hz], [b[0], b[1], hz], [c[0], c[1], hz], paint);
    pushTri(s, [a[0], a[1], -hz], [c[0], c[1], -hz], [b[0], b[1], -hz], paint);
  }
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    pushQuad(s, [a[0], a[1], -hz], [b[0], b[1], -hz], [b[0], b[1], hz], [a[0], a[1], hz], { ...paint, shade: (paint.shade ?? 1) * 0.85 });
  }
  return s;
}

/** A square pyramid (roof) centred on +y from y0 (base half-size h) to apex y1. */
export function pyramid(o: { half: number; y0: number; y1: number; paint: Paint; sides?: number }): Shape {
  const sides = o.sides ?? 4;
  return prism({ sides, r0: o.half * Math.SQRT2, r1: 0, y0: o.y0, y1: o.y1, phase: Math.PI / 4, side: o.paint, top: null, bottom: o.paint });
}

/** A flat polygon (floor, inset) facing +y. */
export function cap(o: { sides: number; r: number; y: number; phase?: number; paint: Paint }): Shape {
  const s = emptyShape();
  const phase = o.phase ?? Math.PI / o.sides;
  const at = (i: number): Vec3 => {
    const a = phase + (i / o.sides) * Math.PI * 2;
    return [Math.cos(a) * o.r, o.y, Math.sin(a) * o.r];
  };
  for (let i = 1; i + 1 < o.sides; i += 1) pushTri(s, at(0), at(i + 1), at(i), o.paint);
  return s;
}
