import type { Household, KittyPaintV1, KittySculptV1 } from "./types.ts";
import { ValidationError } from "./types.ts";
import type { QueenCharmV1 } from "./queenCharms.ts";
import { shapeQueenCharms } from "./queenCharms.ts";

/**
 * Her creation and her history (2026-09-14): the form the couple threw on
 * the wheel, the growth rings her closed Chapters leave, and the yearly
 * portraits kept on the shelf. Cosmetic and historical only; none of it
 * carries a live reading and none of it touches money.
 *
 * Everything rides the household King design's `studio.draft` — the same
 * piece the paint and the charms already ride — so there is no new
 * collection, no new command and nothing new to sync:
 *
 * - The thrown form is the piece's existing `sculpt.profile` (four lathe
 *   handles: belly, waist, shoulder, neck) read within her own tighter bounds.
 *   `wheel` records who took each of the two turns and when.
 * - Rings are not stored at all: they are derived from closed Chapters, one
 *   band per closed Chapter, and nothing on the piece can add or remove one.
 * - Portraits are stored stills: what she looked like when a year was
 *   sealed. Once written a year's portrait is never replaced.
 */
export type QueenWheelTurn = { by: string; at: string };
/** Two turns, clearly handed over: one partner pulls the form, the other opens the rim. */
export type QueenWheelV1 = { pull: QueenWheelTurn; rim: QueenWheelTurn };

/** The four handles of `KittySculptV1.profile` as she reads them. */
export type QueenFormHandles = { belly: number; waist: number; shoulder: number; neck: number };

export const QUEEN_FORM_LIMITS = {
  /** Her range is tighter than a bank's 0.55..1.15: at 40px she must stay one solid seated shape, and no handle may reach a reserved channel. */
  min: 0.9,
  max: 1.1,
  /** How far one turn of the wheel moves its handles, per unit of the turn (-1..1). */
  pull: { belly: 0.1, waist: -0.06 },
  rim: { shoulder: 0.1, neck: 0.1 },
} as const;

export const QUEEN_FORM_REST: QueenFormHandles = { belly: 1, waist: 1, shoulder: 1, neck: 1 };

const clampHandle = (n: unknown): number => {
  const value = typeof n === "number" && Number.isFinite(n) ? n : 1;
  return Math.round(Math.max(QUEEN_FORM_LIMITS.min, Math.min(QUEEN_FORM_LIMITS.max, value)) * 1000) / 1000;
};
/** The handles, clamped to her range. A bank's wider profile on her draft is read within her bounds, never as given. */
export function queenFormHandles(profile: KittySculptV1["profile"] | readonly number[] | null | undefined): QueenFormHandles {
  if (!Array.isArray(profile)) return { ...QUEEN_FORM_REST };
  return { belly: clampHandle(profile[0]), waist: clampHandle(profile[1]), shoulder: clampHandle(profile[2]), neck: clampHandle(profile[3]) };
}
export const queenFormProfile = (handles: QueenFormHandles): [number, number, number, number] => [clampHandle(handles.belly), clampHandle(handles.waist), clampHandle(handles.shoulder), clampHandle(handles.neck)];

/** One turn of the wheel, -1..1, applied to its own two handles and nothing else. */
export function queenWheelPull(handles: QueenFormHandles, turn: number): QueenFormHandles {
  const t = Math.max(-1, Math.min(1, turn));
  return { ...handles, belly: clampHandle(1 + QUEEN_FORM_LIMITS.pull.belly * t), waist: clampHandle(1 + QUEEN_FORM_LIMITS.pull.waist * t) };
}
export function queenWheelRim(handles: QueenFormHandles, turn: number): QueenFormHandles {
  const t = Math.max(-1, Math.min(1, turn));
  return { ...handles, shoulder: clampHandle(1 + QUEEN_FORM_LIMITS.rim.shoulder * t), neck: clampHandle(1 + QUEEN_FORM_LIMITS.rim.neck * t) };
}
/** The turn value that would produce these handles, for a wheel that reopens on a kept form. */
export const queenWheelTurnOf = (handles: QueenFormHandles, turn: "pull" | "rim"): number =>
  Math.max(-1, Math.min(1, turn === "pull" ? (handles.belly - 1) / QUEEN_FORM_LIMITS.pull.belly : (handles.shoulder - 1) / QUEEN_FORM_LIMITS.rim.shoulder));

// ---------------------------------------------------------------------------
// Rings — derived, never stored.

/** How many rings she carries: one per closed Chapter. Nothing else adds or removes one. */
export function queenRingCount(household: Pick<Household, "chapters">, upTo?: string): number {
  return (household.chapters ?? []).filter((chapter) => chapter.closedAt !== null && (!upTo || chapter.closedAt <= upTo)).length;
}
export const QUEEN_RING = {
  /** Where the first ring sits on the skirt (v) and how far apart they are, until they must crowd. */
  first: 0.24,
  last: 0.68,
  spacing: 0.04,
  /** Half the band's width in v, and its depth as a fraction of the radius. Shallow: a band, not a stripe. */
  halfWidth: 0.012,
  depth: 0.009,
} as const;
/** The v of each ring, oldest lowest. Past eleven the bands crowd toward the shoulders rather than climbing off her. */
export function queenRingSeats(count: number): number[] {
  const n = Math.max(0, Math.floor(count));
  if (!n) return [];
  const spacing = Math.min(QUEEN_RING.spacing, (QUEEN_RING.last - QUEEN_RING.first) / Math.max(1, n - 1));
  return Array.from({ length: n }, (_, i) => Math.round((QUEEN_RING.first + i * spacing) * 1000) / 1000);
}

// ---------------------------------------------------------------------------
// Portraits — stored stills, immutable once written.

export type QueenPortraitV1 = {
  year: number;
  /** When the year was sealed: the first time Home was opened after it closed. */
  at: string;
  by: string;
  profile: [number, number, number, number];
  /** How many Chapters had closed by the end of that year. */
  rings: number;
  base: string;
  parts: KittyPaintV1["parts"];
  charms: QueenCharmV1[];
};
export const QUEEN_PORTRAIT_LIMITS = { count: 12, year: [2000, 2999] as const } as const;

const bad = () => new ValidationError("This Kitty Bank needs a compatible envelope reader. Reload Hearth.");
const isIso = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const HEX = /^#[0-9a-f]{6}$/;
const name = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 60;

export function shapeQueenWheel(value: unknown): QueenWheelV1 | undefined {
  if (value === undefined) return undefined;
  const row = value as QueenWheelV1;
  if (!row || typeof row !== "object" || Object.keys(row).some((key) => key !== "pull" && key !== "rim")) throw bad();
  const turn = (t: QueenWheelTurn): QueenWheelTurn => {
    if (!t || typeof t !== "object" || Object.keys(t).some((key) => key !== "by" && key !== "at") || !name(t.by) || !isIso(t.at)) throw bad();
    return { by: t.by, at: t.at };
  };
  return { pull: turn(row.pull), rim: turn(row.rim) };
}
const PORTRAIT_KEYS: readonly string[] = ["year", "at", "by", "profile", "rings", "base", "parts", "charms"];
export function shapeQueenPortraits(value: unknown): QueenPortraitV1[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > QUEEN_PORTRAIT_LIMITS.count) throw bad();
  const years = new Set<number>();
  return value.map((raw) => {
    const row = raw as QueenPortraitV1;
    if (
      !row || typeof row !== "object" || Object.keys(row).some((key) => !PORTRAIT_KEYS.includes(key)) ||
      !Number.isInteger(row.year) || row.year < QUEEN_PORTRAIT_LIMITS.year[0] || row.year > QUEEN_PORTRAIT_LIMITS.year[1] || years.has(row.year) ||
      !isIso(row.at) || !name(row.by) || !Array.isArray(row.profile) || row.profile.length !== 4 ||
      !Number.isInteger(row.rings) || row.rings < 0 || row.rings > 999 ||
      typeof row.base !== "string" || !row.base || row.base.length > 24 || !row.parts || typeof row.parts !== "object"
    ) throw bad();
    years.add(row.year);
    const parts: KittyPaintV1["parts"] = {};
    for (const [key, color] of Object.entries(row.parts)) { if ((key !== "body" && key !== "head") || typeof color !== "string" || !HEX.test(color)) throw bad(); parts[key] = color; }
    return { year: row.year, at: row.at, by: row.by, profile: queenFormProfile(queenFormHandles(row.profile)), rings: row.rings, base: row.base, parts, charms: shapeQueenCharms(row.charms) ?? [] };
  }).sort((a, b) => a.year - b.year);
}

/** The year that has closed without a portrait, if any: the earliest such year since she was created. Null when the shelf is up to date. */
export function queenPortraitDue(input: { createdAt: string; portraits?: readonly Pick<QueenPortraitV1, "year">[] }, today: string): number | null {
  const first = Number(input.createdAt.slice(0, 4)), current = Number(today.slice(0, 4));
  if (!Number.isFinite(first) || !Number.isFinite(current)) return null;
  const kept = new Set((input.portraits ?? []).map((row) => row.year));
  for (let year = first; year < current; year += 1) if (!kept.has(year)) return year;
  return null;
}
/** A portrait of her as she is now, sealed for `year`. Rings are exact for that year; form, paint and charms are as she stands at sealing. */
export function queenPortraitOf(input: { year: number; at: string; by: string; profile: KittySculptV1["profile"] | undefined; household: Pick<Household, "chapters">; paint: Pick<KittyPaintV1, "base" | "parts">; charms: readonly QueenCharmV1[] }): QueenPortraitV1 {
  const parts: KittyPaintV1["parts"] = {};
  if (input.paint.parts.body) parts.body = input.paint.parts.body;
  if (input.paint.parts.head) parts.head = input.paint.parts.head;
  return {
    year: input.year, at: input.at, by: input.by,
    profile: queenFormProfile(queenFormHandles(input.profile)),
    rings: queenRingCount(input.household, `${input.year}-12-31T23:59:59.999Z`),
    base: input.paint.base, parts, charms: input.charms.map((charm) => ({ ...charm })),
  };
}
