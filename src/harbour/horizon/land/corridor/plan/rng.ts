/**
 * Deterministic hashing for the corridor plan (no Math.random). `hash2` is the card kit's hash
 * (`src/harbour/art/cardKit.ts`), copied so the bake-side plan does not import three.js.
 */
/** Deterministic hash in [0, 1) of two integers (the card kit's `hash2`). */
export const hash2 = (i: number, j: number): number => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

/** A small positive integer from a seed string (FNV-1a), kept small so `hash2`'s argument stays well inside double precision. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % 9973;
}

/** A keyed stream: `r(i, k)` is a stable value in [0, 1) for item i, draw k, under (seed, tag). */
export function stream(seed: number, tag: number): (i: number, k?: number) => number {
  return (i, k = 0) => hash2(i * 7 + k * 1013 + tag * 17, seed + tag * 97 + k * 3);
}

/** Weighted pick with u in [0, 1). */
export function pick<T>(list: readonly (readonly [T, number])[], u: number): T {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let t = u * total;
  for (const [v, w] of list) { t -= w; if (t <= 0) return v; }
  return list[list.length - 1]![0];
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const smooth = (a: number, b: number, v: number): number => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** Round to a fixed number of decimals so the plan's JSON is stable and compact. */
export const r3 = (v: number): number => Math.round(v * 1000) / 1000;
