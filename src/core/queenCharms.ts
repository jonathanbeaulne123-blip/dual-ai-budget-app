import type { Household, KittyPart } from "./types.ts";
import { ValidationError } from "./types.ts";
import { charterIsSigned } from "./charter.ts";
import { projectRitualTasks } from "./chapterTasks.ts";

/**
 * Charms for the Queen (2026-09-14): small ceramic add-ons the couple sticks
 * onto her, the way a paint-your-own-pottery studio sells bisque cats and
 * mushrooms to press onto a mug. Cosmetic only. A charm never carries a
 * reading, never encodes state and is never how something is said.
 *
 * The record rides inside the household King design's `studio.draft` — the
 * shared Fund's existing cosmetic record — as `charms` on the piece, so there
 * is no new collection, no new command and nothing new to sync. Placement is
 * free: a charm keeps the part it was pressed onto and the surface uv it sits
 * at, exactly as a free-placed stamp does, plus a spin about the surface
 * normal, a small tilt off it, a bounded scale and a colour from the studio
 * palette. Both the 3D path and the flat path read the same numbers.
 *
 * Charms are earned. Every unlock below is derived from what the household
 * already recorded in `chapters.ts`, the Charter and the goals — acts, never
 * amounts. Nothing here is a new event or a new schema, and nothing here can
 * be bought with money in.
 */
export const QUEEN_CHARM_KINDS = [
  "sitting-cat", "paper-airplane", "coffee-mug", "teapot", "snail", "mushroom",
  "paper-boat", "small-bird", "bell", "key", "die", "spool",
] as const;
export type QueenCharmKind = typeof QUEEN_CHARM_KINDS[number];

export type QueenCharmPart = Extract<KittyPart, "body" | "head">;

export type QueenCharmV1 = {
  id: string;
  kind: QueenCharmKind;
  /** The surface it was pressed onto and where, in that part's own uv (0..1). */
  part: QueenCharmPart;
  u: number;
  v: number;
  /** Degrees about the surface normal, -180..180. */
  spin: number;
  /** Degrees off the surface, a small lean, -20..20. */
  tilt: number;
  /** 0.7 (small) .. 1.5 (larger). 1 is charm scale. */
  scale: number;
  /** A studio palette hex. */
  color: string;
  /** Who pressed it on. Visible authorship; not a consent rule. */
  by?: string;
};

export const QUEEN_CHARM_LIMITS = {
  /** The composition must hold at the maximum, not the average. */
  count: 16,
  scale: [0.7, 1.5] as const,
  tilt: 20,
  idLength: 40,
} as const;

export type QueenCharmEntry = {
  kind: QueenCharmKind;
  label: string;
  /** One word for a small button. */
  short: string;
  /** Present when the charm is earned; absent for the always-available starter set. */
  earnedBy?: string;
};

/** The bin. Six starters so a new household is not looking at nothing; six earned by what the household did. */
export const QUEEN_CHARM_LIBRARY: readonly QueenCharmEntry[] = [
  { kind: "sitting-cat", label: "A sitting cat", short: "Cat" },
  { kind: "teapot", label: "A teapot", short: "Teapot" },
  { kind: "mushroom", label: "A mushroom", short: "Mushroom" },
  { kind: "paper-boat", label: "A paper boat", short: "Boat" },
  { kind: "small-bird", label: "A small bird", short: "Bird" },
  { kind: "die", label: "A die", short: "Die" },
  { kind: "paper-airplane", label: "A paper airplane", short: "Airplane", earnedBy: "a travel goal filled and bought" },
  { kind: "coffee-mug", label: "A coffee mug", short: "Mug", earnedBy: "one Ritual held ten times" },
  { kind: "snail", label: "A snail", short: "Snail", earnedBy: "a Chapter closed after a hard month" },
  { kind: "key", label: "A key", short: "Key", earnedBy: "the Charter signed by both of you" },
  { kind: "bell", label: "A bell", short: "Bell", earnedBy: "the first Sitdown completed" },
  { kind: "spool", label: "A spool of thread", short: "Spool", earnedBy: "a correction mended — a gold seam" },
];
export const QUEEN_CHARM_STARTERS: readonly QueenCharmKind[] = QUEEN_CHARM_LIBRARY.filter((row) => !row.earnedBy).map((row) => row.kind);
export const queenCharmEntry = (kind: QueenCharmKind): QueenCharmEntry => QUEEN_CHARM_LIBRARY.find((row) => row.kind === kind)!;
export const queenCharmLabel = (kind: QueenCharmKind): string => queenCharmEntry(kind).label;

// ---------------------------------------------------------------------------
// Earning — pure over the household, from records that already exist.

export type QueenCharmEarning = { kind: QueenCharmKind; label: string; short: string; earned: boolean; starter: boolean; earnedBy: string | null };

/** The travel words the nest already uses to file a goal under Build (`nestCategoryFor`); no goal carries a travel flag. */
const TRAVEL_WORDS = /vacation|holiday|trip|travel/i;
type EarningInput = Pick<Household, "chapters" | "rituals" | "tasks" | "goals" | "transactions" | "sitDownSessions"> & { charter?: Household["charter"] };

type EarnedKind = "paper-airplane" | "coffee-mug" | "snail" | "key" | "bell" | "spool";
const EARNED: Record<EarnedKind, (h: EarningInput) => boolean> = {
  /** A travel goal closed: retired with a purchase behind it (the jar was filled and bought — `goalStatus` reads retired the same way), named the way the nest reads travel. */
  "paper-airplane": (h) => h.goals.some((goal) => (goal.status === "retired" || Boolean(goal.retiredAt)) && Boolean(goal.purchaseId) && TRAVEL_WORDS.test(goal.name)),
  /** Canonical completed occurrences, with earlier adopted history preserved; a gap costs nothing. */
  "coffee-mug": (h) => (h.rituals ?? []).some((ritual) => projectRitualTasks(h, ritual).heldOn.length >= 10),
  /** A Chapter closed after a hard month: closed as still-forming or life-changed — the honest outcomes that are not "established". */
  snail: (h) => (h.chapters ?? []).some((chapter) => chapter.closedAt !== null && (chapter.state === "still-forming" || chapter.state === "life-changed")),
  /** The Charter signed by every member. */
  key: (h) => Boolean(h.charter && charterIsSigned(h.charter)),
  /** The first Sitdown completed: a Chapter opened or closed at a Sitdown, or a Sitdown session closed. */
  bell: (h) => (h.chapters ?? []).some((chapter) => Boolean(chapter.openedAtSitdownId || chapter.closedAtSitdownId)) || (h.sitDownSessions ?? []).some((session) => session.status === "closed"),
  /** A correction mended: a reversal posted, the same evidence a gold seam reads, in any month. */
  spool: (h) => h.transactions.some((tx) => Boolean(tx.reversalOfId) && !tx.isDuplicate),
};

export function queenCharmsEarned(household: EarningInput): QueenCharmEarning[] {
  return QUEEN_CHARM_LIBRARY.map((row) => {
    const starter = !row.earnedBy;
    const earned = starter || EARNED[row.kind as EarnedKind](household);
    return { kind: row.kind, label: row.label, short: row.short, earned, starter, earnedBy: row.earnedBy ?? null };
  });
}
export function queenCharmKindsEarned(household: EarningInput): ReadonlySet<QueenCharmKind> {
  return new Set(queenCharmsEarned(household).filter((row) => row.earned).map((row) => row.kind));
}
/** The strictest reading when no household is at hand: only the starters. Used by the guard when a caller gives no context. */
export const QUEEN_CHARM_STARTER_SET: ReadonlySet<QueenCharmKind> = new Set(QUEEN_CHARM_STARTERS);

// ---------------------------------------------------------------------------
// Shape — fail closed, like the rest of the studio.

const HEX = /^#[0-9a-f]{6}$/;
const bad = () => new ValidationError("This Kitty Bank needs a compatible envelope reader. Reload Hearth.");
const q3 = (n: number) => Math.round(n * 1000) / 1000;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const CHARM_KEYS: readonly string[] = ["id", "kind", "part", "u", "v", "spin", "tilt", "scale", "color", "by"];

export function shapeQueenCharm(value: unknown, seen: Set<string>): QueenCharmV1 {
  const row = value as QueenCharmV1;
  if (
    !row || typeof row !== "object" || Object.keys(row).some((key) => !CHARM_KEYS.includes(key)) ||
    typeof row.id !== "string" || !row.id || row.id.length > QUEEN_CHARM_LIMITS.idLength || seen.has(row.id) ||
    !(QUEEN_CHARM_KINDS as readonly string[]).includes(row.kind) ||
    (row.part !== "body" && row.part !== "head") ||
    !finite(row.u) || row.u < 0 || row.u > 1 || !finite(row.v) || row.v < 0 || row.v > 1 ||
    !finite(row.spin) || row.spin < -180 || row.spin > 180 ||
    !finite(row.tilt) || row.tilt < -QUEEN_CHARM_LIMITS.tilt || row.tilt > QUEEN_CHARM_LIMITS.tilt ||
    !finite(row.scale) || row.scale < QUEEN_CHARM_LIMITS.scale[0] || row.scale > QUEEN_CHARM_LIMITS.scale[1] ||
    typeof row.color !== "string" || !HEX.test(row.color) ||
    (row.by !== undefined && (typeof row.by !== "string" || !row.by || row.by.length > 60))
  ) throw bad();
  seen.add(row.id);
  return {
    id: row.id, kind: row.kind, part: row.part, u: q3(row.u), v: q3(row.v),
    spin: Math.round(row.spin), tilt: Math.round(row.tilt), scale: Math.round(row.scale * 100) / 100, color: row.color,
    ...(row.by !== undefined ? { by: row.by } : {}),
  };
}
export function shapeQueenCharms(value: unknown): QueenCharmV1[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > QUEEN_CHARM_LIMITS.count) throw bad();
  const seen = new Set<string>();
  return value.map((row) => shapeQueenCharm(row, seen));
}
