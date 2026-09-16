import { captureCommand } from "../ledgerSync/capture.ts";
import { cloneHousehold } from "./household.ts";
import { nextId, nowIso } from "./ids.ts";
import type { Category, CommitResult, Household } from "./types.ts";
import { ValidationError } from "./types.ts";

/**
 * Our Path world (D-262): the household island that grows from the couple's life.
 *
 * The *ground* is computed on read from accepted household-scope facts
 * (`pathMonths`) and a set of recipes. This module owns the one shared,
 * synced collection that lets the couple shape what grows:
 *
 * - recipe rows (a Hearth recipe override, or a new recipe Hercules or a member proposed)
 * - the island name
 * - category → score corrections ("Hearth guesses, you fix")
 *
 * Recipes and the name change only when every active member agrees on the
 * exact proposal revision. Category corrections are decoration-only and apply
 * on one member's word. Nothing here is money: rows live in the Shared
 * envelope, are omitted from every financial hash, never reach model context,
 * and every command returns empty `postedIds`.
 */

export const PATH_SIGNALS = [
  "joy", "essentials", "saved", "cushionUsed", "travel", "home", "pets", "learning", "together",
  "rhythm", "social", "fitness", "garden", "generosity", "celebration", "creative", "calm", "firsts",
] as const;
export type PathSignal = typeof PATH_SIGNALS[number];

/** Scores a category can feed. The rest come from Chapters, goals, the Fund and Sitdowns. */
export const PATH_CATEGORY_SIGNALS = ["joy", "travel", "home", "pets", "social", "fitness", "garden", "generosity", "celebration", "creative"] as const satisfies readonly PathSignal[];
export type PathCategorySignal = typeof PATH_CATEGORY_SIGNALS[number];

export const PATH_SIGNAL_LABELS: Record<PathSignal, { label: string; from: string }> = {
  joy: { label: "Joy spending", from: "fun and treat categories" },
  essentials: { label: "Essentials pressure", from: "essential spending against income" },
  saved: { label: "Money set aside", from: "contributions to shared Kitty Banks" },
  cushionUsed: { label: "Cushion used", from: "money released from a Kitty Bank through the Fund" },
  travel: { label: "Travel", from: "travel categories and trips on the shared calendar" },
  home: { label: "Home", from: "home categories" },
  pets: { label: "Pets", from: "pet categories" },
  learning: { label: "Learning", from: "Chapters closed with their Lesson" },
  together: { label: "Together", from: "Sitdowns, shared Moves and Wins" },
  rhythm: { label: "Rhythm", from: "Ritual days held" },
  social: { label: "Friends & dining", from: "restaurant and social categories" },
  fitness: { label: "Moving", from: "fitness categories" },
  garden: { label: "Garden", from: "garden categories" },
  generosity: { label: "Generosity", from: "gift and giving categories" },
  celebration: { label: "Celebration", from: "celebration categories" },
  creative: { label: "Making things", from: "hobby and craft categories" },
  calm: { label: "Calm", from: "how steady spending was week to week" },
  firsts: { label: "Firsts", from: "a first Chapter, goal or Sitdown" },
};

export const PATH_BRUSHES = [
  "bloom", "dry", "fertile", "storm", "cove", "widen", "grove", "village", "observatory", "monument", "bench",
  "lanterns", "giftTree", "trailLoop", "cafe", "vegRows", "pond", "firstStar", "firstFire", "dogMeadow", "kiln", "workshop",
] as const;
export type PathBrush = typeof PATH_BRUSHES[number];

export const PATH_BRUSH_LABELS: Record<PathBrush, string> = {
  bloom: "flower meadows", dry: "a dry golden patch", fertile: "richer soil and taller trees",
  storm: "a storm creek, and a bridge once you recover", cove: "a coastline for the trip", widen: "a wider road",
  grove: "a grove of habit trees", village: "a cottage", observatory: "an observatory floor", monument: "a monument",
  bench: "a bench where we paused", lanterns: "bunting and lanterns", giftTree: "a ribbon tree", trailLoop: "a running loop",
  cafe: "string lights and tables", vegRows: "garden rows", pond: "a still pond", firstStar: "a star on a post",
  firstFire: "a campfire that never goes out", dogMeadow: "a pet meadow with a little house", kiln: "a kiln hut",
  workshop: "a little workshop",
};

export type PathRecipeWhen =
  | { signal: PathSignal; min: number; max?: number }
  | { tag: string }
  | { categoryId: string };
export type PathRecipeSpec = { name: string; when: PathRecipeWhen; brush: PathBrush; on: boolean };
export type PathRecipe = PathRecipeSpec & { id: string; by: "hearth" | "hercules" | "member" };

/** Hearth's built-in recipes. Overrides are rows whose `baseId` names one of these. */
export const PATH_BASE_RECIPES: readonly PathRecipe[] = [
  { id: "joy", name: "Good months bloom", when: { signal: "joy", min: 0.55 }, brush: "bloom", on: true, by: "hearth" },
  { id: "dry", name: "Lean months dry out", when: { signal: "essentials", min: 0.7 }, brush: "dry", on: true, by: "hearth" },
  { id: "save", name: "Saving feeds the soil", when: { signal: "saved", min: 0.45 }, brush: "fertile", on: true, by: "hearth" },
  { id: "storm", name: "Storms and the bridges after", when: { signal: "cushionUsed", min: 0.3 }, brush: "storm", on: true, by: "hearth" },
  { id: "life-changed", name: "A life-changed Chapter leaves a creek", when: { tag: "life-changed" }, brush: "storm", on: true, by: "hearth" },
  { id: "trip", name: "Trips shape the coast", when: { signal: "travel", min: 0.4 }, brush: "cove", on: true, by: "hearth" },
  { id: "together", name: "Together widens the road", when: { signal: "together", min: 0.6 }, brush: "widen", on: true, by: "hearth" },
  { id: "rhythm", name: "Three steady months plant a grove", when: { signal: "rhythm", min: 0.6 }, brush: "grove", on: true, by: "hearth" },
  { id: "home", name: "Home builds the village", when: { signal: "home", min: 0.5 }, brush: "village", on: true, by: "hearth" },
  { id: "learn", name: "Every Lesson adds a floor", when: { signal: "learning", min: 0.5 }, brush: "observatory", on: true, by: "hearth" },
  { id: "milestone", name: "Milestones leave monuments", when: { tag: "milestone" }, brush: "monument", on: true, by: "hearth" },
  { id: "first-fire", name: "The first campfire never goes out", when: { tag: "first-campfire" }, brush: "firstFire", on: true, by: "hearth" },
  { id: "pause", name: "A quiet month leaves a bench", when: { tag: "paused" }, brush: "bench", on: true, by: "hearth" },
  { id: "party", name: "Celebrations hang lanterns", when: { signal: "celebration", min: 0.5 }, brush: "lanterns", on: true, by: "hearth" },
  { id: "give", name: "Giving grows a ribbon tree", when: { signal: "generosity", min: 0.5 }, brush: "giftTree", on: true, by: "hearth" },
  { id: "move", name: "Moving wears a loop", when: { signal: "fitness", min: 0.5 }, brush: "trailLoop", on: true, by: "hearth" },
  { id: "social", name: "Friends string the lights", when: { signal: "social", min: 0.5 }, brush: "cafe", on: true, by: "hearth" },
  { id: "garden", name: "Gardening plants rows", when: { signal: "garden", min: 0.5 }, brush: "vegRows", on: true, by: "hearth" },
  { id: "calm", name: "Calm months settle a pond", when: { signal: "calm", min: 0.65 }, brush: "pond", on: true, by: "hearth" },
  { id: "first", name: "Firsts get a star", when: { signal: "firsts", min: 0.5 }, brush: "firstStar", on: true, by: "hearth" },
];

// ---------------------------------------------------------------------------
// The shared collection

type Agreement<T> = {
  active: T | null;
  pending: T | null;
  pendingBy: string | null;
  pendingRevision: number;
  agreedByMemberIds: string[];
};
export type PathRecipeRow = {
  version: 1;
  id: string;
  kind: "recipe";
  /** A built-in recipe id this row overrides, or null for a new recipe. */
  baseId: string | null;
  proposedBy: "hercules" | "member";
  updatedAt: string;
} & Agreement<PathRecipeSpec>;
export type PathNameRow = {
  version: 1;
  id: typeof PATH_NAME_ID;
  kind: "name";
  namedAt: string | null;
  updatedAt: string;
} & Agreement<string>;
export type PathCategoryRow = {
  version: 1;
  id: string;
  kind: "category";
  categoryId: string;
  signal: PathCategorySignal | "none";
  setByMemberId: string;
  updatedAt: string;
};
export type PathWorldRow = PathRecipeRow | PathNameRow | PathCategoryRow;

export const PATH_NAME_ID = "PATH-NAME" as const;
const EPOCH = "1970-01-01T00:00:00.000Z";
const MAX_ROWS = 400;

function validIso(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}
function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
function ids(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((row): row is string => typeof row === "string" && row.length > 0))].slice(0, 8).sort() : [];
}
function clamp01(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n)) * 100) / 100 : null;
}

export function shapeRecipeSpec(value: unknown): PathRecipeSpec | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PathRecipeSpec> & { when?: Record<string, unknown> };
  const name = str(raw.name, 80);
  if (!name || !PATH_BRUSHES.includes(raw.brush as PathBrush) || !raw.when || typeof raw.when !== "object") return null;
  let when: PathRecipeWhen | null = null;
  if (typeof raw.when.signal === "string") {
    if (!PATH_SIGNALS.includes(raw.when.signal as PathSignal)) return null;
    const min = clamp01(raw.when.min);
    const max = raw.when.max === undefined ? undefined : clamp01(raw.when.max);
    if (min === null || max === null) return null;
    when = { signal: raw.when.signal as PathSignal, min, ...(max !== undefined ? { max } : {}) };
  } else if (typeof raw.when.tag === "string" && /^[a-z0-9:-]{1,60}$/i.test(raw.when.tag)) {
    when = { tag: raw.when.tag };
  } else if (typeof raw.when.categoryId === "string" && raw.when.categoryId.length > 0 && raw.when.categoryId.length <= 80) {
    when = { categoryId: raw.when.categoryId };
  }
  if (!when) return null;
  return { name, when, brush: raw.brush as PathBrush, on: raw.on !== false };
}
function shapeName(value: unknown): string | null {
  const name = str(value, 40);
  return name || null;
}

function shapeAgreement<T>(row: Record<string, unknown>, shape: (value: unknown) => T | null): Agreement<T> | null {
  const active = row.active === null || row.active === undefined ? null : shape(row.active);
  const pending = row.pending === null || row.pending === undefined ? null : shape(row.pending);
  if ((row.active != null && active === null) || (row.pending != null && pending === null)) return null;
  const revision = typeof row.pendingRevision === "number" && Number.isSafeInteger(row.pendingRevision) && row.pendingRevision >= 0 ? row.pendingRevision : 0;
  return {
    active,
    pending,
    pendingBy: pending && typeof row.pendingBy === "string" ? row.pendingBy : null,
    pendingRevision: revision,
    agreedByMemberIds: pending ? ids(row.agreedByMemberIds) : [],
  };
}

/** Fails closed: an unreadable row is dropped rather than guessed at. */
export function shapePathWorld(value: unknown): PathWorldRow[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows = value.flatMap((raw): PathWorldRow[] => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    if (row.version !== 1 || typeof row.id !== "string" || !row.id || row.id.length > 120 || seen.has(row.id)) return [];
    const updatedAt = validIso(row.updatedAt, EPOCH);
    if (row.kind === "recipe") {
      const agreement = shapeAgreement(row, shapeRecipeSpec);
      if (!agreement) return [];
      const baseId = typeof row.baseId === "string" && PATH_BASE_RECIPES.some((base) => base.id === row.baseId) ? row.baseId : null;
      if (row.baseId != null && !baseId) return [];
      seen.add(row.id);
      return [{ version: 1, id: row.id, kind: "recipe", baseId, proposedBy: row.proposedBy === "hercules" ? "hercules" : "member", updatedAt, ...agreement }];
    }
    if (row.kind === "name") {
      if (row.id !== PATH_NAME_ID) return [];
      const agreement = shapeAgreement(row, shapeName);
      if (!agreement) return [];
      seen.add(row.id);
      return [{ version: 1, id: PATH_NAME_ID, kind: "name", namedAt: row.namedAt ? validIso(row.namedAt, updatedAt) : null, updatedAt, ...agreement }];
    }
    if (row.kind === "category") {
      const categoryId = str(row.categoryId, 80);
      const signal = row.signal === "none" || PATH_CATEGORY_SIGNALS.includes(row.signal as PathCategorySignal) ? row.signal as PathCategorySignal | "none" : null;
      if (!categoryId || !signal || row.id !== pathCategoryRowId(categoryId) || typeof row.setByMemberId !== "string" || !row.setByMemberId) return [];
      seen.add(row.id);
      return [{ version: 1, id: row.id, kind: "category", categoryId, signal, setByMemberId: row.setByMemberId, updatedAt }];
    }
    return [];
  });
  return rows.sort((a, b) => a.id.localeCompare(b.id)).slice(0, MAX_ROWS);
}

export function pathCategoryRowId(categoryId: string): string {
  return `PATH-CAT-${categoryId}`;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
/** Newest wins; an exact timestamp tie resolves the same way on every replica. */
function newer<T extends PathWorldRow>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}
function mergeAgreementRow<T extends PathRecipeRow | PathNameRow>(a: T, b: T): T {
  if (a.pendingRevision !== b.pendingRevision) return a.pendingRevision > b.pendingRevision ? a : b;
  // Same proposal revision: a promoted row outranks the still-pending copy of the same proposal.
  if (!a.pending && b.pending && sameJson(a.active, b.pending)) return a;
  if (!b.pending && a.pending && sameJson(b.active, a.pending)) return b;
  const newest = newer(a, b);
  if (a.pending && b.pending && sameJson(a.pending, b.pending)) {
    return { ...newest, agreedByMemberIds: [...new Set([...a.agreedByMemberIds, ...b.agreedByMemberIds])].sort() };
  }
  return newest;
}

/** Converges two replicas: higher proposal revision wins; agreements on the same proposal union. */
export function mergePathWorld(left: PathWorldRow[] = [], right: PathWorldRow[] = []): PathWorldRow[] {
  const rows = new Map(shapePathWorld(left).map((row) => [row.id, row]));
  for (const incoming of shapePathWorld(right)) {
    const existing = rows.get(incoming.id);
    if (!existing) { rows.set(incoming.id, incoming); continue; }
    if (existing.kind !== incoming.kind || existing.kind === "category" || incoming.kind === "category") {
      rows.set(incoming.id, newer<PathWorldRow>(existing, incoming));
      continue;
    }
    rows.set(incoming.id, mergeAgreementRow(existing as PathRecipeRow | PathNameRow, incoming as PathRecipeRow | PathNameRow));
  }
  return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function activeMemberIds(household: Pick<Household, "members">): string[] {
  return household.members.filter((member) => member.active).map((member) => member.id).sort();
}
/** Read-time promotion: concurrent agreements that together cover every active member count as agreed. */
export function agreedValue<T>(row: Agreement<T>, household: Pick<Household, "members">): T | null {
  if (row.pending && activeMemberIds(household).every((id) => row.agreedByMemberIds.includes(id))) return row.pending;
  return row.active;
}

/** The recipes the island grows from: built-ins with agreed overrides applied, then agreed new recipes. */
export function effectivePathRecipes(household: Pick<Household, "members" | "pathWorld">): PathRecipe[] {
  const rows = shapePathWorld(household.pathWorld).filter((row): row is PathRecipeRow => row.kind === "recipe");
  const overrides = new Map(rows.filter((row) => row.baseId).map((row) => [row.baseId!, row]));
  const base = PATH_BASE_RECIPES.map((recipe) => {
    const row = overrides.get(recipe.id);
    const agreed = row ? agreedValue(row, household) : null;
    return agreed ? { ...agreed, id: recipe.id, by: "member" as const } : recipe;
  });
  const added = rows.filter((row) => !row.baseId).flatMap((row) => {
    const agreed = agreedValue(row, household);
    return agreed ? [{ ...agreed, id: row.id, by: row.proposedBy }] : [];
  });
  return [...base, ...added];
}

export function pathIslandName(household: Pick<Household, "members" | "pathWorld">): string | null {
  const row = shapePathWorld(household.pathWorld).find((r): r is PathNameRow => r.kind === "name");
  return row ? agreedValue(row, household) : null;
}

/** Proposals still waiting on at least one active member. */
export function pendingPathProposals(household: Pick<Household, "members" | "pathWorld">): (PathRecipeRow | PathNameRow)[] {
  return shapePathWorld(household.pathWorld).filter((row): row is PathRecipeRow | PathNameRow => (
    row.kind !== "category" && row.pending !== null && agreedValue<unknown>(row as Agreement<unknown>, household) !== row.pending
  ));
}

// ---------------------------------------------------------------------------
// Category guesses — Hearth guesses, the couple fixes

const GUESSES: [RegExp, PathCategorySignal][] = [
  [/\b(travel|trips?|vacations?|holidays? away|flights?|airfare|hotels?|airbnb|lodging|cottage rentals?|getaways?)\b/i, "travel"],
  [/\b(pets?|vets?|dogs?|cats?|kibble|litter|grooming)\b/i, "pets"],
  [/\b(garden|gardening|plants?|nursery|seeds?|soil)\b/i, "garden"],
  [/\b(gym|fitness|yoga|sport|sports|running|climbing|swim|bike|cycling|pilates)\b/i, "fitness"],
  [/\b(gift|gifts|charity|donation|donations|giving|tithe)\b/i, "generosity"],
  [/\b(birthday|party|parties|wedding|anniversary|celebration|christmas|holidays)\b/i, "celebration"],
  [/\b(craft|crafts|pottery|ceramics|art supplies|hobby|hobbies|music|instrument|sewing|knitting)\b/i, "creative"],
  [/\b(restaurant|restaurants|dining|dining out|takeout|take-out|bar|bars|coffee|cafe|café|social|friends)\b/i, "social"],
  [/\b(home|house|furniture|decor|renovation|repairs?|household|hardware|appliance)\b/i, "home"],
  [/\b(fun|entertainment|treat|treats|concert|concerts|movies?|games?|streaming|shopping|clothes|clothing|books?)\b/i, "joy"],
];

export function guessCategorySignal(name: string, parentName = ""): PathCategorySignal | null {
  for (const text of [name, parentName]) {
    for (const [pattern, signal] of GUESSES) if (pattern.test(text)) return signal;
  }
  return null;
}

export type PathCategoryMapping = { category: Category; signal: PathCategorySignal | null; source: "guess" | "fixed" | "none" };

export function pathCategoryMappings(household: Pick<Household, "categories" | "pathWorld">): PathCategoryMapping[] {
  const fixed = new Map(shapePathWorld(household.pathWorld).filter((row): row is PathCategoryRow => row.kind === "category").map((row) => [row.categoryId, row]));
  const byId = new Map(household.categories.map((row) => [row.id, row]));
  return household.categories
    .filter((row) => row.active && row.recordType !== "group" && row.transactionType === "expense")
    .map((category) => {
      const row = fixed.get(category.id);
      if (row) return { category, signal: row.signal === "none" ? null : row.signal, source: "fixed" as const };
      const parent = category.parentId ? byId.get(category.parentId) : undefined;
      const own = guessCategorySignal(category.name);
      const fromParent = own ? null : guessCategorySignal("", parent?.name ?? "");
      // Money model (D-269): the Housing group is now the fixed "Home" umbrella. Its label alone never grows a
      // cottage, so relabelling cannot change the island; a child's own name still can.
      const guessed = own ?? (fromParent === "home" && parent?.umbrellaId === "home" ? null : fromParent);
      // Essential home costs (rent, utilities) already shape "Essentials pressure"; they do not build cottages.
      const guess = guessed === "home" && category.essential ? null : guessed;
      return { category, signal: guess, source: guess ? "guess" as const : "none" as const };
    });
}

/** What Hercules suggests (on device, no model call) for a part of life with no recipe yet. */
export function herculesPathSuggestion(input: { signal?: PathSignal; categoryId?: string; categoryName?: string }): PathRecipeSpec {
  if (input.signal) {
    const brush: PathBrush = input.signal === "pets" ? "dogMeadow" : input.signal === "creative" ? "kiln" : "workshop";
    const name = input.signal === "pets" ? "Pet days" : input.signal === "creative" ? "The kiln" : `${PATH_SIGNAL_LABELS[input.signal].label} corner`;
    return { name, when: { signal: input.signal, min: 0.4 }, brush, on: true };
  }
  const label = str(input.categoryName, 40) || "Something new";
  const brush: PathBrush = /pottery|ceramic|clay|kiln/i.test(label) ? "kiln"
    : /dog|pet|cat|vet/i.test(label) ? "dogMeadow"
      : /garden|plant/i.test(label) ? "vegRows"
        : "workshop";
  return { name: `A place for ${label}`, when: { categoryId: input.categoryId ?? "" }, brush, on: true };
}

// ---------------------------------------------------------------------------
// Commands — non-money, member-validated, "updatePathWorld".

function requireMember(household: Household, memberId: string): void {
  if (!household.members.some((member) => member.active && member.id === memberId)) {
    throw new ValidationError("Only an active household member can do this.");
  }
}
function commitPathWorld(previous: Household, next: Household, label: string, at: string): CommitResult {
  next.lastCommittedAt = at;
  return {
    household: next,
    warnings: [],
    postedIds: [],
    undo: { id: nextId("UNDO-PATH-", []), label, snapshot: previous, postedIds: [], commandKind: "updatePathWorld" },
  };
}
function promoteIfAgreed<T extends PathRecipeRow | PathNameRow>(household: Household, row: T, at: string): T {
  if (!row.pending || !activeMemberIds(household).every((id) => row.agreedByMemberIds.includes(id))) return row;
  return { ...row, active: row.pending, pending: null, pendingBy: null, agreedByMemberIds: [], ...(row.kind === "name" ? { namedAt: at } : {}) };
}
function withRow(next: Household, row: PathWorldRow): void {
  const rows = shapePathWorld([...shapePathWorld(next.pathWorld).filter((existing) => existing.id !== row.id), row]);
  // What is accepted must be exactly what replays: the collection is stored shaped, and a row the shaper would drop is refused.
  if (!rows.some((existing) => existing.id === row.id)) throw new ValidationError("The island can't hold that change.");
  next.pathWorld = rows;
}

export type ProposePathRecipeInput = {
  memberId: string;
  /** Existing row to revise; omitted for a new recipe or a first override. */
  rowId?: string | null;
  /** Built-in recipe to override. */
  baseId?: string | null;
  spec: PathRecipeSpec;
  proposedBy?: "hercules" | "member";
  at?: string;
};
export const proposePathRecipe = captureCommand("proposePathRecipe", function proposePathRecipe(household: Household, input: ProposePathRecipeInput): CommitResult {
  requireMember(household, input.memberId);
  const spec = shapeRecipeSpec(input.spec);
  if (!spec) throw new ValidationError("That recipe needs a name, a rule and something to grow.");
  if (input.baseId && !PATH_BASE_RECIPES.some((row) => row.id === input.baseId)) throw new ValidationError("That Hearth recipe is not available.");
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const rows = shapePathWorld(next.pathWorld);
  const existing = rows.find((row): row is PathRecipeRow => row.kind === "recipe" && (
    (input.rowId ? row.id === input.rowId : false) || (!!input.baseId && row.baseId === input.baseId)
  ));
  if (input.rowId && !existing) throw new ValidationError("That recipe changed. Review its latest version.");
  if (existing && sameJson(agreedValue(existing, household), spec)) throw new ValidationError("That is already how the island grows.");
  if (existing?.pending && sameJson(existing.pending, spec)) {
    return agreePathProposal(household, { memberId: input.memberId, rowId: existing.id, revision: existing.pendingRevision, ...(input.at ? { at: input.at } : {}) });
  }
  const id = existing?.id ?? (input.baseId ? `PATH-RCP-${input.baseId}` : nextId("PATH-RCP-", rows.map((row) => row.id)));
  const row: PathRecipeRow = promoteIfAgreed(next, {
    version: 1,
    id,
    kind: "recipe",
    baseId: existing?.baseId ?? input.baseId ?? null,
    proposedBy: existing?.proposedBy ?? (input.proposedBy === "hercules" ? "hercules" : "member"),
    active: existing ? agreedValue(existing, household) : null,
    pending: spec,
    pendingBy: input.memberId,
    pendingRevision: (existing?.pendingRevision ?? 0) + 1,
    agreedByMemberIds: [input.memberId],
    updatedAt: at,
  }, at);
  withRow(next, row);
  return commitPathWorld(household, next, row.pending ? `Proposed “${spec.name}” for the island` : `“${spec.name}” now grows on the island`, at);
});

export const proposePathName = captureCommand("proposePathName", function proposePathName(household: Household, input: { memberId: string; name: string; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const name = shapeName(input.name);
  if (!name) throw new ValidationError("Give the island a name first.");
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const existing = shapePathWorld(next.pathWorld).find((row): row is PathNameRow => row.kind === "name");
  if (existing && agreedValue(existing, household) === name) throw new ValidationError("The island already has that name.");
  if (existing?.pending === name) return agreePathProposal(household, { memberId: input.memberId, rowId: PATH_NAME_ID, revision: existing.pendingRevision, ...(input.at ? { at: input.at } : {}) });
  const row: PathNameRow = promoteIfAgreed(next, {
    version: 1,
    id: PATH_NAME_ID,
    kind: "name",
    namedAt: existing?.namedAt ?? null,
    active: existing ? agreedValue(existing, household) : null,
    pending: name,
    pendingBy: input.memberId,
    pendingRevision: (existing?.pendingRevision ?? 0) + 1,
    agreedByMemberIds: [input.memberId],
    updatedAt: at,
  }, at);
  withRow(next, row);
  return commitPathWorld(household, next, row.pending ? `Suggested the island name “${name}”` : `Named the island “${name}”`, at);
});

export const agreePathProposal = captureCommand("agreePathProposal", function agreePathProposal(household: Household, input: { memberId: string; rowId: string; revision: number; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const row = shapePathWorld(next.pathWorld).find((r): r is PathRecipeRow | PathNameRow => r.id === input.rowId && r.kind !== "category");
  if (!row || !row.pending || row.pendingRevision !== input.revision) throw new ValidationError("That suggestion changed. Review its latest version.");
  const agreed = promoteIfAgreed(next, { ...row, agreedByMemberIds: [...new Set([...row.agreedByMemberIds, input.memberId])].sort(), updatedAt: at }, at);
  withRow(next, agreed);
  const label = row.kind === "name" ? `the island name “${row.pending}”` : `“${(row.pending as PathRecipeSpec).name}”`;
  return commitPathWorld(household, next, agreed.pending ? `Agreed to ${label}` : `We both agreed: ${label}`, at);
});

export const declinePathProposal = captureCommand("declinePathProposal", function declinePathProposal(household: Household, input: { memberId: string; rowId: string; revision: number; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const row = shapePathWorld(next.pathWorld).find((r): r is PathRecipeRow | PathNameRow => r.id === input.rowId && r.kind !== "category");
  if (!row || !row.pending || row.pendingRevision !== input.revision) throw new ValidationError("That suggestion changed. Review its latest version.");
  // The revision stays, so a later proposal can never reuse agreement given to this one.
  withRow(next, { ...row, pending: null, pendingBy: null, agreedByMemberIds: [], updatedAt: at });
  return commitPathWorld(household, next, "Set a suggestion aside", at);
});

export const setPathCategorySignal = captureCommand("setPathCategorySignal", function setPathCategorySignal(household: Household, input: { memberId: string; categoryId: string; signal: PathCategorySignal | "none"; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  if (input.categoryId.length > 80 || !household.categories.some((row) => row.id === input.categoryId && row.recordType !== "group")) throw new ValidationError("That category is not available.");
  if (input.signal !== "none" && !PATH_CATEGORY_SIGNALS.includes(input.signal)) throw new ValidationError("Choose one of the island's scores.");
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  withRow(next, { version: 1, id: pathCategoryRowId(input.categoryId), kind: "category", categoryId: input.categoryId, signal: input.signal, setByMemberId: input.memberId, updatedAt: at });
  return commitPathWorld(household, next, "Changed how a category shows on the island", at);
});

/** Ledger step kinds that write the Our Path world, plus its undo/continuity kind (D-262). */
export const PATH_WORLD_COMMAND_KINDS = ["proposePathRecipe", "proposePathName", "agreePathProposal", "declinePathProposal", "setPathCategorySignal", "updatePathWorld"];

/** True once the household holds any Our Path world row; older clients must not write over it. */
export function hasPathWorldData(household: Pick<Household, "pathWorld">): boolean {
  return Boolean(household.pathWorld?.length) && shapePathWorld(household.pathWorld).length > 0;
}

/**
 * Replay authority: every change in `incoming` must be one the acting member
 * could make. A member may only add their own agreement, propose under their
 * own name, fix a category as themselves, and promote a proposal when theirs
 * is the last agreement missing (or they are the household's only member).
 */
export function pathWorldChangeAuthorized(household: Pick<Household, "members" | "pathWorld">, incoming: PathWorldRow[], actorId: string): boolean {
  const local = new Map(shapePathWorld(household.pathWorld).map((row) => [row.id, row]));
  const active = activeMemberIds(household);
  for (const row of incoming) {
    const before = local.get(row.id);
    if (before && sameJson(before, row)) continue;
    if (row.kind === "category") {
      if (row.setByMemberId !== actorId) return false;
      continue;
    }
    if (before && before.kind !== row.kind) return false;
    const prior = before as PathRecipeRow | PathNameRow | undefined;
    const priorRevision = prior?.pendingRevision ?? 0;
    if (row.pendingRevision < priorRevision) continue; // older copy; the merge keeps the local row
    const sameProposal = prior && row.pendingRevision === priorRevision;
    const previouslyAgreed = sameProposal ? prior.agreedByMemberIds : [];
    if (row.agreedByMemberIds.some((id) => id !== actorId && !previouslyAgreed.includes(id))) return false;
    if (!sameProposal && row.pending && row.pendingBy !== actorId) return false;
    const priorValue = prior ? agreedValue<unknown>(prior as Agreement<unknown>, household) : null;
    if (!sameJson(row.active, priorValue) && !sameJson(row.active, prior?.active ?? null)) {
      // A newly agreed value: either the actor completed the agreement on this exact proposal,
      // or the actor is the only member and proposed it in this command.
      const completes = sameProposal && prior?.pending !== null && sameJson(prior?.pending, row.active)
        && active.every((id) => id === actorId || prior!.agreedByMemberIds.includes(id));
      const alone = active.length === 1 && active[0] === actorId;
      if (!completes && !alone) return false;
    }
  }
  return true;
}

/** Replay validation: rows must reference current members. */
export function pathWorldRowsValid(household: Pick<Household, "members">, rows: PathWorldRow[]): boolean {
  const members = new Set(household.members.map((member) => member.id));
  if (new Set(rows.map((row) => row.id)).size !== rows.length) return false;
  return rows.every((row) => row.kind === "category"
    ? members.has(row.setByMemberId)
    : (!row.pendingBy || members.has(row.pendingBy)) && row.agreedByMemberIds.every((id) => members.has(id)));
}
