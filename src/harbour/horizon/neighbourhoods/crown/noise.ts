/** Deterministic value noise for drifts and paint edges (no Math.random: the same field on every machine). */
const hash = (i: number, j: number, seed: number) => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const fade = (t: number) => t * t * (3 - 2 * t);
export function noise2(x: number, z: number, seed = 0): number {
  const i = Math.floor(x), j = Math.floor(z), u = fade(x - i), v = fade(z - j);
  const a = hash(i, j, seed), b = hash(i + 1, j, seed), c = hash(i, j + 1, seed), d = hash(i + 1, j + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
/** Fractal value noise in about [-1, 1]. */
export function fbm(x: number, z: number, seed = 0, octaves = 3): number {
  let s = 0, a = .5, f = 1, n = 0;
  for (let k = 0; k < octaves; k++) { s += a * (noise2(x * f, z * f, seed + k * 17) * 2 - 1); n += a; a *= .5; f *= 2.03; }
  return s / n;
}
