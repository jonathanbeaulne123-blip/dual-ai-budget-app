import { PATH_GEOGRAPHY_VERSION, pathMonthGeographyId, type PathMonth } from "../core/pathSignals.ts";
import type { PathBrush, PathRecipe } from "../core/pathWorld.ts";
import { SPENDING_UMBRELLAS, type UmbrellaId } from "../core/fundRules.ts";

/**
 * The grower (D-262). Pure and deterministic: the same months and recipes grow
 * the same island on every phone, so nothing about the land is stored or
 * synced. Months are replayed in order onto soft fields (moisture, bloom),
 * pieces are placed beside the month's spot on a spiral, and the coastline is
 * carved by the trips.
 */

export const GRID = 152;
export const SIZE = 184;
export const CELL = SIZE / (GRID - 1);
export const HALF = SIZE / 2;
export const idx = (i: number, j: number) => j * GRID + i;

export type Spot = { x: number; z: number; a: number };
export type GeographyAnchor = { id: string; version: typeof PATH_GEOGRAPHY_VERSION; key: string };
/**
 * Where month `m` sits on the spiral. `span` is the index of the household's
 * latest month: the spiral tightens for long histories so the newest month
 * always stands inside the coast (which grows 1.45 per month from 30).
 */
export function monthSpot(m: number, span = 0): Spot {
  const step = Math.min(2.3, (9 + 1.45 * Math.max(1, span)) / Math.max(1, span));
  const a = m * 0.72 + 0.4;
  const r = 9 + m * step;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, a };
}

function monthOrdinal(key: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : 0;
}

/**
 * Stable geography v2: an absolute calendar month always occupies the same
 * anchor. The fixed 120-slot constellation covers an era's maximum window;
 * its coordinates never depend on how many months happen to be rendered.
 * monthSpot remains the legacy index alias for older callers.
 */
export function monthGeographyAnchor(month: Pick<PathMonth, "key" | "geographyId">): GeographyAnchor {
  return { id: month.geographyId ?? pathMonthGeographyId(month.key), version: PATH_GEOGRAPHY_VERSION, key: month.key };
}
export function stableMonthSpot(month: Pick<PathMonth, "key" | "geographyId">): Spot {
  const slot = ((monthOrdinal(month.key) % 120) + 120) % 120;
  const a = slot * 2.399963229728653 + 0.4;
  const r = 8 + slot * 0.62;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, a };
}

export type PieceKind =
  | "grove" | "cottage" | "observatory" | "monument" | "bench" | "lanterns" | "giftTree" | "loop" | "cafe"
  | "rows" | "pond" | "star" | "firstFire" | "dogMeadow" | "kiln" | "workshop" | "creek" | "frost" | "umbrella";
export type Piece = {
  /** Stable v2 object identity; born remains the legacy renderer/focus index. */
  id?: string;
  kind: PieceKind;
  x: number;
  z: number;
  ang: number;
  born: number;
  /** Months since it was placed (for growth). */
  age: number;
  recipeId: string | null;
  /** Evidence lines for "why is this here". */
  why: string[];
  n?: number;
  floors?: number;
  bridge?: number | null;
  active?: boolean;
  /** Slice 11: the umbrella this pennant stands for, and its presentation hue (keyed by umbrella id). */
  umbrellaId?: UmbrellaId;
  hue?: string;
};
export type Cove = { month: number; a: number; type: "sea" | "mountain" | "city"; name: string; depth: number; visits: number[]; why: string[] };
export type GrownIsland = {
  cur: number;
  H: Float32Array;
  M: Float32Array;
  B: Float32Array;
  S: Float32Array;
  R: Float32Array;
  /** First frost (0–1): only around the household's first winter month, never a later one. */
  F: Float32Array;
  pieces: Piece[];
  coves: Cove[];
  widths: number[];
  fired: Record<string, number[]>;
  radiusAt: (a: number) => number;
  spot: (m: number) => Spot;
};

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export { hash as islandHash };
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number): number {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.28 + vnoise(x * 4.3 + 1, y * 4.3 + 9) * 0.17;
}

function stamp(F: Float32Array, cx: number, cz: number, r: number, amount: number, seed: number): void {
  const i0 = Math.max(0, Math.floor((cx - r + HALF) / CELL)), i1 = Math.min(GRID - 1, Math.ceil((cx + r + HALF) / CELL));
  const j0 = Math.max(0, Math.floor((cz - r + HALF) / CELL)), j1 = Math.min(GRID - 1, Math.ceil((cz + r + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL;
    const d = Math.hypot(x - cx, z - cz);
    if (d >= r) continue;
    const w = 1 - d / r, ww = w * w * (3 - 2 * w);
    F[idx(i, j)]! += amount * ww * (0.65 + 0.7 * vnoise(x * 0.35 + seed * 3.1, z * 0.35 - seed));
  }
}
function blur(F: Float32Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(F.length);
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    let s = 0, c = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= GRID || b >= GRID) continue;
      s += F[idx(a, b)]!; c++;
    }
    out[idx(i, j)] = s / c;
  }
  return out;
}

export const FIRST_FROST_WHY = "Your first winter on the island. It never quite melts.";
/** The index of the first month whose key is December, January or February, or null. */
export function firstWinterMonth(months: Pick<PathMonth, "key">[]): number | null {
  const at = months.findIndex((month) => { const m = Number(month.key.slice(5, 7)); return m === 12 || m === 1 || m === 2; });
  return at < 0 ? null : at;
}

export function recipeValue(recipe: PathRecipe, month: PathMonth): number | null {
  const when = recipe.when;
  if ("signal" in when) {
    const v = month.scores[when.signal] ?? 0;
    if (when.max !== undefined ? v <= when.max : v >= when.min) return Math.max(0.3, Math.min(1, v));
    return null;
  }
  if ("tag" in when) return month.tags.includes(when.tag) ? 1 : null;
  return month.tags.includes(`category:${when.categoryId}`) ? 0.8 : null;
}

const PIECE_FOR: Partial<Record<PathBrush, { kind: PieceKind; d: number; ang: number }>> = {
  monument: { kind: "monument", d: 3.2, ang: 1.6 },
  bench: { kind: "bench", d: 2.2, ang: -1.6 },
  lanterns: { kind: "lanterns", d: 2.6, ang: 1.6 },
  giftTree: { kind: "giftTree", d: 4.2, ang: -1.3 },
  trailLoop: { kind: "loop", d: 8, ang: 1.9 },
  cafe: { kind: "cafe", d: 4, ang: 1.2 },
  vegRows: { kind: "rows", d: 6.5, ang: -1.9 },
  pond: { kind: "pond", d: 6, ang: -1.1 },
  firstStar: { kind: "star", d: 2, ang: -1.1 },
  firstFire: { kind: "firstFire", d: 3, ang: -2.2 },
  dogMeadow: { kind: "dogMeadow", d: 8, ang: 1.3 },
  kiln: { kind: "kiln", d: 5, ang: -1.7 },
  workshop: { kind: "workshop", d: 5.5, ang: 2.3 },
};

export function growIsland(months: PathMonth[], recipes: PathRecipe[], cur: number): GrownIsland {
  const last = Math.max(0, Math.min(months.length - 1, cur));
  // The numeric index remains the renderer's legacy focus alias. Coordinates
  // come from immutable month identities, so appending or trimming history
  // cannot move an existing landmark.
  const spot = (m: number) => stableMonthSpot(months[m] ?? { key: "2000-01" });
  const M = new Float32Array(GRID * GRID).fill(0.55);
  let B: Float32Array<ArrayBuffer> = new Float32Array(GRID * GRID);
  const fired: Record<string, number[]> = Object.fromEntries(recipes.map((r) => [r.id, []]));
  const pieces: Piece[] = [];
  const coves: Cove[] = [];
  const widths: number[] = [];
  const storms: { m: number; spot: Spot; why: string[] }[] = [];
  let fertility = 0.2, cottages = 0, floors = 0, streak = 0;
  let villageAt: { x: number; z: number } | null = null;
  const floorWhy: string[] = [];
  const label = (m: number) => months[m]?.key ?? "";
  const anchor = (m: number) => monthGeographyAnchor(months[m] ?? { key: "2000-01" });
  const ageAt = (m: number) => Math.max(0, monthOrdinal(months[last]?.key ?? "2000-01") - monthOrdinal(months[m]?.key ?? "2000-01"));

  for (let m = 0; m <= last && months.length; m++) {
    const month = months[m]!;
    const p = spot(m);
    widths[m] = 0.22;
    let rhythmHit = false;
    const off = (d: number, ang: number) => ({ x: p.x + Math.cos(p.a + ang) * d, z: p.z + Math.sin(p.a + ang) * d });
    for (const recipe of recipes) {
      if (!recipe.on) continue;
      const k = recipeValue(recipe, month);
      if (k === null) continue;
      const reason = "signal" in recipe.when ? month.why[recipe.when.signal] : "tag" in recipe.when ? month.why[recipe.when.tag] : undefined;
      const why = [`${label(m)} · ${recipe.name}${reason ? ` — ${reason}` : ""}`];
      const place = (kind: PieceKind, d: number, ang: number, extra: Partial<Piece> = {}) => {
        const q = off(d, ang);
        pieces.push({ id: `${anchor(m).id}:object:${recipe.id}:${kind}`, kind, x: q.x, z: q.z, ang: p.a, born: m, age: ageAt(m), recipeId: recipe.id, why, ...extra });
      };
      let did = true;
      switch (recipe.brush) {
        case "bloom": stamp(B, p.x, p.z, 6 + 8 * k, 1.2 * k, monthOrdinal(month.key)); break;
        case "dry": stamp(M, p.x, p.z, 7 + 6 * k, -0.75 * k, monthOrdinal(month.key)); break;
        case "fertile": stamp(M, p.x, p.z, 8, 0.25 * k, monthOrdinal(month.key)); fertility += 0.07 * k; break;
        case "storm": stamp(M, p.x, p.z, 6, 0.3, monthOrdinal(month.key)); if (!storms.some((s) => s.m === m)) storms.push({ m, spot: p, why }); else did = false; break;
        case "cove": {
          if (!month.trip) { did = false; break; }
          const same = coves.find((c) => c.name === month.trip!.name && c.type === month.trip!.type);
          if (same) { same.depth += 3; same.visits.push(m); same.why.push(...why); }
          else coves.push({ month: m, a: p.a, type: month.trip.type, name: month.trip.name, depth: 5 + 5 * k, visits: [m], why: [...why] });
          break;
        }
        case "widen": widths[m] = 0.22 + 0.38 * k; break;
        case "grove":
          rhythmHit = true;
          streak++;
          if (streak === 3) place("grove", 5.5, 1.6); else did = false;
          break;
        case "village": {
          villageAt ??= off(7, -1.5);
          const a = cottages * 1.2, r = 2.5 + cottages * 0.4;
          pieces.push({ id: `${anchor(m).id}:object:${recipe.id}:cottage:${cottages}`, kind: "cottage", x: villageAt.x + Math.cos(a) * r, z: villageAt.z + Math.sin(a) * r, ang: a, born: m, age: ageAt(m), recipeId: recipe.id, why, n: cottages });
          cottages++;
          break;
        }
        case "observatory": floors++; floorWhy.push(...why); break;
        default: {
          const spec = PIECE_FOR[recipe.brush];
          if (!spec) { did = false; break; }
          if (recipe.brush === "dogMeadow") stamp(M, off(spec.d, spec.ang).x, off(spec.d, spec.ang).z, 6, 0.35, monthOrdinal(month.key));
          if (recipe.brush === "vegRows") stamp(M, off(spec.d, spec.ang).x, off(spec.d, spec.ang).z, 5, 0.2, monthOrdinal(month.key));
          if (recipe.brush === "bench") widths[m] = 0.1;
          // Pieces that belong to a part of life appear once and then keep growing.
          if ((recipe.brush === "dogMeadow" || recipe.brush === "kiln" || recipe.brush === "workshop") && pieces.some((piece) => piece.recipeId === recipe.id)) {
            const existing = pieces.find((piece) => piece.recipeId === recipe.id)!;
            existing.why.push(...why);
            break;
          }
          place(spec.kind, spec.d, spec.ang);
        }
      }
      if (did) fired[recipe.id]!.push(m);
    }
    if (!rhythmHit) streak = 0;
    for (let k = 0; k < M.length; k++) { M[k]! += (0.55 - M[k]!) * 0.26; B[k]! *= 0.9; }
    B = blur(B);
  }

  for (const storm of storms) {
    let recovered: number | null = null;
    for (let k = storm.m + 1; k <= Math.min(last, storm.m + 3); k++) {
      if ((months[k]?.scores.saved ?? 0) >= 0.5) { recovered = k; break; }
    }
    pieces.push({
      id: `${anchor(storm.m).id}:object:storm-creek`, kind: "creek", x: storm.spot.x, z: storm.spot.z, ang: storm.spot.a, born: storm.m, age: ageAt(storm.m), recipeId: null, bridge: recovered,
      why: [...storm.why, recovered !== null ? `${label(recovered)} · money was set aside again, so the bridge was built` : "No recovery yet. A bridge appears once money is set aside again."],
    });
  }
  // The first winter in the household's history leaves a frost that never quite melts.
  const F = new Float32Array(GRID * GRID);
  const firstWinter = firstWinterMonth(months);
  if (firstWinter !== null && firstWinter <= last) {
    const p = spot(firstWinter);
    stamp(F, p.x, p.z, 7, 1, monthOrdinal(months[firstWinter]!.key));
    for (let k = 0; k < F.length; k++) F[k] = Math.min(1, F[k]!);
    const q = { x: p.x + Math.cos(p.a - 0.4) * 4.2, z: p.z + Math.sin(p.a - 0.4) * 4.2 };
    pieces.push({ id: `${anchor(firstWinter).id}:object:first-frost`, kind: "frost", x: q.x, z: q.z, ang: p.a, born: firstWinter, age: ageAt(firstWinter), recipeId: null, why: [FIRST_FROST_WHY, `${label(firstWinter)} · the first December, January or February on the island`] });
  }
  pieces.push(...umbrellaPieces(months, last, spot));
  if (floors) pieces.push({ id: `${anchor(0).id}:object:observatory`, kind: "observatory", x: -6, z: -10, ang: 0, born: 0, age: ageAt(0), recipeId: null, floors, why: floorWhy });
  for (const piece of pieces) {
    if (piece.kind === "kiln") piece.active = (months[last]?.scores.creative ?? 0) >= 0.3;
  }

  // Stable anchors can begin anywhere in the fixed constellation. Keep every
  // reached anchor on land without reintroducing a span-dependent coordinate.
  const Rbase = Math.max(30 + last * 1.45, ...Array.from({ length: last + 1 }, (_, m) => Math.hypot(spot(m).x, spot(m).z) + 8));
  const radiusAt = (a: number): number => {
    let R = Rbase + 3 * (vnoise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5) - 0.5) * 2;
    for (const c of coves) {
      const d = Math.atan2(Math.sin(a - c.a), Math.cos(a - c.a));
      const g = Math.exp(-(d * d) / (0.09 * (1 + (c.visits.length - 1) * 0.5)));
      R += c.type === "mountain" ? 5 * g : -c.depth * g;
    }
    return R;
  };
  const H = new Float32Array(GRID * GRID), S = new Float32Array(GRID * GRID), R = new Float32Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    const x = -HALF + i * CELL, z = -HALF + j * CELL, k = idx(i, j);
    const d = Math.hypot(x, z), a = Math.atan2(z, x), rad = radiusAt(a);
    const t = Math.max(0, Math.min(1, (rad + 1 - d) / 8));
    const s = t * t * (3 - 2 * t);
    let h = 1.2 + 3.2 * fbm(x * 0.045 + 3, z * 0.045 + 1) + 1.3 * Math.exp(-(d * d) / 300) + fertility * 0.8 * fbm(x * 0.1, z * 0.1);
    let sand = 0, rock = 0;
    for (const c of coves) {
      const da = Math.atan2(Math.sin(a - c.a), Math.cos(a - c.a));
      const g = Math.exp(-(da * da) / (0.12 * (1 + (c.visits.length - 1) * 0.5)));
      if (g < 0.02) continue;
      if (c.type === "mountain") {
        const rim = Math.max(0, 1 - Math.abs(d - (rad - 5)) / 9);
        h += 10 * g * rim * (0.7 + 0.6 * fbm(x * 0.2, z * 0.2));
        rock = Math.max(rock, g * rim);
      } else {
        const shore = Math.max(0, 1 - (rad - d) / 9);
        h = h * (1 - g * shore) + 0.35 * g * shore;
        sand = Math.max(sand, g * shore * 1.2);
      }
    }
    if (s < 0.7 && s > 0) sand = Math.max(sand, (1 - s / 0.7) * 0.8);
    H[k] = h * s - 2.6 * (1 - s);
    S[k] = Math.min(1, sand);
    R[k] = rock;
  }
  return { cur: last, H, M, B, S, R, F, pieces, coves, widths, fired, radiusAt, spot };
}

/**
 * Slice 11 (D-282): a ring of twelve pennant slots, one per spending umbrella,
 * seeded around the month the first plan was agreed under the money model
 * (`umbrella-slots`). An umbrella's pennant rises the first month from then on
 * that the couple's shared spending touched it, and grows a little with every
 * such month. Existing pieces are untouched; no amount is ever carried.
 */
export function umbrellaPieces(months: PathMonth[], last: number, spot: (m: number) => Spot): Piece[] {
  const seed = months.findIndex((month, m) => m <= last && month.tags.includes("umbrella-slots"));
  if (seed < 0) return [];
  const centre = spot(seed);
  const out: Piece[] = [];
  SPENDING_UMBRELLAS.forEach((umbrella, i) => {
    const hits: number[] = [];
    for (let m = seed; m <= last; m++) if ((months[m]?.umbrellas?.[umbrella.id] ?? 0) > 0) hits.push(m);
    if (!hits.length) return;
    const a = centre.a + (i / SPENDING_UMBRELLAS.length) * Math.PI * 2;
    const born = hits[0]!;
    out.push({
      id: `${monthGeographyAnchor(months[seed]!).id}:object:umbrella:${umbrella.id}`, kind: "umbrella", x: centre.x + Math.cos(a) * 6.5, z: centre.z + Math.sin(a) * 6.5, ang: a, born,
      age: Math.max(0, monthOrdinal(months[last]?.key ?? "2000-01") - monthOrdinal(months[born]?.key ?? "2000-01")),
      recipeId: null, umbrellaId: umbrella.id, hue: umbrella.hue, n: hits.length,
      why: [
        `${months[seed]!.key} · ${months[seed]!.why["umbrella-slots"] ?? "Our first plan agreed the new way"}`,
        ...hits.slice(-3).map((m) => `${months[m]!.key} · ${umbrella.name} — ${months[m]!.why[`umbrella:${umbrella.id}`] ?? `Spending under ${umbrella.name}`}`),
      ],
    });
  });
  return out;
}

export function heightAt(island: Pick<GrownIsland, "H">, x: number, z: number): number {
  const fi = (x + HALF) / CELL, fj = (z + HALF) / CELL;
  const i = Math.max(0, Math.min(GRID - 2, Math.floor(fi))), j = Math.max(0, Math.min(GRID - 2, Math.floor(fj)));
  const u = fi - i, v = fj - j, H = island.H;
  return H[idx(i, j)]! * (1 - u) * (1 - v) + H[idx(i + 1, j)]! * u * (1 - v) + H[idx(i, j + 1)]! * (1 - u) * v + H[idx(i + 1, j + 1)]! * u * v;
}
