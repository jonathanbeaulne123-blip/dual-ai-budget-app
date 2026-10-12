/**
 * The prototype's value noise (protos/scholars render2.mjs `hash2` / `noise2` / `fbm`), ported exactly: integer hashing
 * with Math.imul, so every machine draws the same field. Used by the woods' keep threshold, the damp hollows for ferns
 * and the moss islands.
 */
export function hash2(x: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function noise2(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v) * 2 - 1;
}
export function fbm(x: number, z: number, octaves = 4): number {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) { s += a * noise2(x * f, z * f); a *= 0.5; f *= 2.03; }
  return s;
}
