import { useEffect, useMemo } from "react";
import type { DateKey } from "../core/calendar.ts";
import type { FundPulse } from "../core/fundPulse.ts";
import type { HouseCondition } from "../core/houseCondition.ts";
import type { QueenFeet, QueenFullness } from "../core/queenPresentation.ts";
import { SPENDING_UMBRELLAS, type UmbrellaId } from "../core/fundRules.ts";
import { PATH_BRUSHES, PATH_SIGNALS, type PathRecipe, type PathSignal } from "../core/pathWorld.ts";
import type { PathMonth } from "../core/pathSignals.ts";
import type { PathWeather, PathWeatherDay } from "../core/pathWeather.ts";
import type { Environment, Household, LedgerView } from "../core/types.ts";
import type { SyncFreshnessDisplay } from "../syncFreshness.ts";
import type { BloomEvidence } from "./world/bloom.ts";

/**
 * A device-local, read-only cache of bounded scene interpretations. It contains
 * no Household payload and grants no command authority. The identity includes
 * the viewer and ledger scope so Personal interpretations cannot cross a room.
 */
export type InterpretationIdentity = {
  environment: Environment;
  householdId: string;
  memberId: string;
  scope: LedgerView;
};

export type InterpretationFreshness = "current" | "connecting" | "stale" | "offline";
export type InterpretationGate = {
  current: boolean;
  freshness: InterpretationFreshness;
  detail: string;
};

export type QueenSceneInterpretation = {
  pulse: FundPulse;
  condition: HouseCondition;
  /** Bounded, non-command visual selectors. Financial amounts and presence stay live. */
  visual: {
    body: { level: number; fullness: QueenFullness; seams: number };
    vine: { chapter: boolean; title: string | null; week: number; acts: number; growth: 0 | 1 | 2 | 3 | 4 };
    buds: Array<{ name: string; size: "small" | "medium" | "large" }>;
    feet: QueenFeet;
  };
};
export type HouseSceneInterpretation = { bloom: BloomEvidence[] };
export type JourneySceneInterpretation = { months: PathMonth[]; recipes: PathRecipe[]; weather: PathWeather | null };

type InterpretationSections = {
  queen: QueenSceneInterpretation;
  house: HouseSceneInterpretation;
  journey: JourneySceneInterpretation;
};
export type InterpretationSectionName = keyof InterpretationSections;
export type SupportedSection<T> = {
  sourceRevision: number;
  supportedAt: string;
  value: T;
};
export type SupportedInterpretationCacheV1 = {
  version: 1;
  identity: string;
  /** One support boundary for every section in this identity. */
  support: { sourceRevision: number; supportedAt: string };
  queen?: QueenSceneInterpretation;
  house?: HouseSceneInterpretation;
  journey?: JourneySceneInterpretation;
};
export type SupportedInterpretationResult<T> = {
  value: T;
  source: "current" | "frozen" | "unavailable";
  sourceRevision: number | null;
  supportedAt: string | null;
  statusLine: string | null;
};

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const PREFIX = "hearth:scene-interpretation:v1";
const MAX_TEXT = 320;
const UMBRELLA_IDS = new Set<UmbrellaId>(SPENDING_UMBRELLAS.map((row) => row.id));

export function interpretationIdentity(identity: InterpretationIdentity): string {
  return [identity.environment, identity.householdId, identity.memberId, identity.scope].map(encodeURIComponent).join(":");
}
export function supportedInterpretationKey(identity: InterpretationIdentity): string {
  return `${PREFIX}:${interpretationIdentity(identity)}`;
}

/** `blocksSyncedLabel` is authoritative: neutral connecting/catching-up chrome is not supported evidence. */
export function interpretationGate(display: Pick<SyncFreshnessDisplay, "transportMode" | "transportPrimary" | "tone" | "blocksSyncedLabel">, booksReady: boolean): InterpretationGate {
  if (!booksReady) return { current: false, freshness: "stale", detail: "Books need attention" };
  if (display.transportMode === "offline") return { current: false, freshness: "offline", detail: "Offline" };
  // A local-only ledger has no remote copy to catch up with. Its accepted local books are the support boundary.
  if (display.transportMode === "hidden" || display.transportMode === "local") return { current: true, freshness: "current", detail: "Current local books" };
  if (display.transportMode === "connecting" || /catching up|sharing/i.test(display.transportPrimary)) {
    return { current: false, freshness: "connecting", detail: "Connecting" };
  }
  if (display.blocksSyncedLabel || display.tone !== "neutral") {
    return { current: false, freshness: "stale", detail: display.transportPrimary || "Shared evidence needs attention" };
  }
  return { current: true, freshness: "current", detail: display.transportPrimary || "Current shared books" };
}

function text(value: unknown, max = MAX_TEXT): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}
function iso(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}
function integer(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function enumValue<T extends string>(value: unknown, values: readonly T[]): T | null {
  return typeof value === "string" && values.includes(value as T) ? value as T : null;
}

const PULSE_STATES = ["checking", "reset", "needs-us", "covered", "building"] as const;
const PULSE_DESTINATIONS = ["fund", "together", "path", "status"] as const;
const CONDITION_STATES = ["checking", "settled", "growing", "wilting", "weathered"] as const;
const QUEEN_FULLNESS = ["empty", "low", "half", "full", "held"] as const;
const QUEEN_BUD_SIZES = ["small", "medium", "large"] as const;
const QUEEN_NEARNESS = ["near", "soon", "later"] as const;
function decodeQueen(value: unknown): QueenSceneInterpretation | null {
  const row = object(value), pulse = object(row?.pulse), condition = object(row?.condition), visual = object(row?.visual);
  const body = object(visual?.body), vine = object(visual?.vine), feet = object(visual?.feet);
  if (!row || !pulse || !condition || !visual || !body || !vine || !feet || !Array.isArray(visual.buds) || visual.buds.length > 4) return null;
  const state = enumValue(pulse.state, PULSE_STATES), destination = enumValue(pulse.destination, PULSE_DESTINATIONS);
  const conditionState = enumValue(condition.state, CONDITION_STATES), days = integer(condition.days);
  const glyph = text(pulse.glyph, 8), headline = text(pulse.headline), detail = text(pulse.detail, 700), words = text(condition.words, 700);
  const amountCents = pulse.amountCents === null ? null : Number.isSafeInteger(pulse.amountCents) ? Number(pulse.amountCents) : undefined;
  const level = integer(body.level), fullness = enumValue(body.fullness, QUEEN_FULLNESS), seams = integer(body.seams);
  const title = vine.title === null ? null : text(vine.title, 200);
  const week = integer(vine.week), acts = integer(vine.acts), growth = integer(vine.growth);
  const buds = visual.buds.map((raw) => { const bud = object(raw), name = text(bud?.name, 200), size = enumValue(bud?.size, QUEEN_BUD_SIZES); return bud && name !== null && size ? { name, size } : null; });
  const count = integer(feet.count);
  if (!Array.isArray(feet.nearness) || feet.nearness.length > 4) return null;
  const nearness = feet.nearness.map((raw) => enumValue(raw, QUEEN_NEARNESS));
  if (!state || !destination || !conditionState || days === null || glyph === null || headline === null || detail === null || words === null || amountCents === undefined
    || level === null || level > 10 || !fullness || seams === null || seams > 3 || typeof vine.chapter !== "boolean" || title === null && vine.title !== null
    || week === null || acts === null || growth === null || growth > 4 || buds.some((bud) => bud === null) || count === null || nearness.some((item) => item === null)) return null;
  return {
    pulse: { state, destination, glyph, headline, detail, amountCents },
    condition: { state: conditionState, days, words },
    visual: {
      body: { level, fullness, seams },
      vine: { chapter: vine.chapter, title, week, acts, growth: growth as 0 | 1 | 2 | 3 | 4 },
      buds: buds as Array<{ name: string; size: "small" | "medium" | "large" }>,
      feet: { count, nearness: nearness as QueenFeet["nearness"] },
    },
  };
}

const BLOOM_KINDS = ["intention", "lived", "revision", "care"] as const;
function decodeBloom(value: unknown): BloomEvidence | null {
  const row = object(value);
  if (!row) return null;
  const id = text(row.id, 200), title = text(row.title, 200), kind = enumValue(row.kind, BLOOM_KINDS), revision = integer(row.revision);
  const date = row.date === null ? null : typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : undefined;
  return id !== null && title !== null && kind && revision !== null && date !== undefined ? { id, title, kind, revision, date } : null;
}
function decodeHouse(value: unknown): HouseSceneInterpretation | null {
  const row = object(value);
  if (!row || !Array.isArray(row.bloom) || row.bloom.length > 36) return null;
  const bloom = row.bloom.map(decodeBloom);
  return bloom.every((item): item is BloomEvidence => item !== null) ? { bloom } : null;
}

function unit(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
function decodeMonth(value: unknown): PathMonth | null {
  const row = object(value), scores = object(row?.scores), why = object(row?.why);
  if (!row || !scores || !why) return null;
  const key = typeof row.key === "string" && /^\d{4}-\d{2}$/.test(row.key) ? row.key : null;
  const geographyId = row.geographyId === undefined ? undefined : text(row.geographyId, 200) ?? null;
  const decodedScores = {} as Record<PathSignal, number>;
  for (const signal of PATH_SIGNALS) { const score = unit(scores[signal]); if (score === null) return null; decodedScores[signal] = score; }
  const decodedWhy: Record<string, string> = {};
  const whyEntries = Object.entries(why);
  if (whyEntries.length > 64) return null;
  for (const [name, reason] of whyEntries) { const safeName = text(name, 100), safeReason = text(reason); if (safeName === null || safeReason === null) return null; decodedWhy[safeName] = safeReason; }
  if (!Array.isArray(row.tags) || row.tags.length > 64 || !row.tags.every((tag) => text(tag, 120) !== null)) return null;
  let trip: PathMonth["trip"] = null;
  if (row.trip !== null) {
    const candidate = object(row.trip), name = text(candidate?.name, 160), type = enumValue(candidate?.type, ["sea", "mountain", "city"] as const);
    if (!candidate || name === null || !type) return null;
    trip = { name, type };
  }
  if (!Array.isArray(row.unmappedCategories) || row.unmappedCategories.length > 64) return null;
  const unmappedCategories = row.unmappedCategories.map((item) => { const candidate = object(item), id = text(candidate?.id, 160), name = text(candidate?.name, 160); return candidate && id !== null && name !== null ? { id, name } : null; });
  if (unmappedCategories.some((item) => item === null)) return null;
  let umbrellas: PathMonth["umbrellas"];
  if (row.umbrellas !== undefined) {
    const source = object(row.umbrellas); if (!source) return null;
    umbrellas = {};
    for (const [name, raw] of Object.entries(source)) { if (!UMBRELLA_IDS.has(name as UmbrellaId)) return null; const score = unit(raw); if (score === null) return null; umbrellas[name as UmbrellaId] = score; }
  }
  if (!key || geographyId === null) return null;
  return { key, ...(geographyId ? { geographyId } : {}), scores: decodedScores, why: decodedWhy, tags: row.tags as string[], trip, unmappedCategories: unmappedCategories as { id: string; name: string }[], ...(umbrellas ? { umbrellas } : {}) };
}

const RECIPE_BY = ["hearth", "hercules", "member"] as const;
function decodeRecipe(value: unknown): PathRecipe | null {
  const row = object(value), when = object(row?.when);
  if (!row || !when) return null;
  const id = text(row.id, 160), name = text(row.name, 160), brush = enumValue(row.brush, PATH_BRUSHES), by = enumValue(row.by, RECIPE_BY);
  if (id === null || name === null || !brush || !by || typeof row.on !== "boolean") return null;
  let decodedWhen: PathRecipe["when"];
  if (Object.hasOwn(when, "signal")) {
    const signal = enumValue(when.signal, PATH_SIGNALS), min = unit(when.min), max = when.max === undefined ? undefined : unit(when.max);
    if (!signal || min === null || max === null) return null;
    decodedWhen = { signal, min, ...(max === undefined ? {} : { max }) };
  } else if (Object.hasOwn(when, "tag")) {
    const tag = text(when.tag, 160); if (tag === null) return null; decodedWhen = { tag };
  } else {
    const categoryId = text(when.categoryId, 160); if (categoryId === null) return null; decodedWhen = { categoryId };
  }
  return { id, name, brush, by, on: row.on, when: decodedWhen };
}
const WEATHER_KINDS = ["cloud", "storm", "sunrise", "sunlit", "mist", "clear"] as const;
function dateKey(value: unknown): DateKey | null { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value as DateKey : null; }
function decodeWeatherDay(value: unknown): PathWeatherDay | null {
  const row = object(value), date = dateKey(row?.date), kind = enumValue(row?.kind, WEATHER_KINDS), label = text(row?.label, 160), why = text(row?.why), weight = unit(row?.weight);
  const sourceId = row?.sourceId === undefined ? undefined : text(row.sourceId, 200) ?? null;
  return row && date && kind && label !== null && why !== null && weight !== null && sourceId !== null ? { date, kind, label, why, weight, ...(sourceId ? { sourceId } : {}) } : null;
}
function decodeWeather(value: unknown): PathWeather | null {
  const row = object(value), asOf = dateKey(row?.asOf), through = dateKey(row?.through), forecast = enumValue(row?.forecast, ["clear", "mist", "unavailable"] as const);
  if (!row || !asOf || !through || !forecast || !Array.isArray(row.days) || row.days.length > 31 || !Array.isArray(row.mistWhy) || row.mistWhy.length > 16 || !Array.isArray(row.covered) || row.covered.length > 31) return null;
  const days = row.days.map(decodeWeatherDay); if (!days.every((day): day is PathWeatherDay => day !== null)) return null;
  if (!row.mistWhy.every((reason) => text(reason) !== null)) return null;
  const covered = row.covered.map((range) => { const item = object(range), from = dateKey(item?.from), to = dateKey(item?.to); return item && from && to ? { from, to } : null; });
  if (covered.some((range) => range === null)) return null;
  return { asOf, through, forecast, days, mistWhy: row.mistWhy as string[], covered: covered as { from: DateKey; to: DateKey }[] };
}
function decodeJourney(value: unknown): JourneySceneInterpretation | null {
  const row = object(value);
  if (!row || !Array.isArray(row.months) || row.months.length > 120 || !Array.isArray(row.recipes) || row.recipes.length > 64) return null;
  const months = row.months.map(decodeMonth), recipes = row.recipes.map(decodeRecipe);
  const weather = row.weather === null ? null : decodeWeather(row.weather);
  return weather !== null || row.weather === null
    ? months.every((item): item is PathMonth => item !== null) && recipes.every((item): item is PathRecipe => item !== null) ? { months, recipes, weather } : null
    : null;
}

function decodeValue<K extends InterpretationSectionName>(name: K, value: unknown): InterpretationSections[K] | null {
  const decoded = name === "queen" ? decodeQueen(value) : name === "house" ? decodeHouse(value) : decodeJourney(value);
  return decoded as InterpretationSections[K] | null;
}

export function readSupportedInterpretation(storage: Store | null | undefined, identity: InterpretationIdentity): SupportedInterpretationCacheV1 | null {
  if (!storage) return null;
  try {
    const row = object(JSON.parse(storage.getItem(supportedInterpretationKey(identity)) ?? "null"));
    if (!row || row.version !== 1 || row.identity !== interpretationIdentity(identity)) return null;
    const support = object(row.support), sourceRevision = integer(support?.sourceRevision), supportedAt = iso(support?.supportedAt);
    if (!support || sourceRevision === null || !supportedAt) return null;
    const queen = row.queen === undefined ? undefined : decodeValue("queen", row.queen);
    const house = row.house === undefined ? undefined : decodeValue("house", row.house);
    const journey = row.journey === undefined ? undefined : decodeValue("journey", row.journey);
    if (queen === null || house === null || journey === null) return null;
    return { version: 1, identity: row.identity, support: { sourceRevision, supportedAt }, ...(queen ? { queen } : {}), ...(house ? { house } : {}), ...(journey ? { journey } : {}) };
  } catch { return null; }
}

export function writeSupportedInterpretation<K extends InterpretationSectionName>(storage: Store | null | undefined, identity: InterpretationIdentity, name: K, section: SupportedSection<InterpretationSections[K]>): void {
  if (!storage) return;
  const existing = readSupportedInterpretation(storage, identity);
  const sameSupport = existing?.support.sourceRevision === section.sourceRevision && existing.support.supportedAt === section.supportedAt;
  // A revision/date change invalidates every old derived section. Never relabel an old room with a new support stamp.
  const record: SupportedInterpretationCacheV1 = {
    version: 1,
    identity: interpretationIdentity(identity),
    support: { sourceRevision: section.sourceRevision, supportedAt: section.supportedAt },
    ...(sameSupport ? existing : {}),
    [name]: section.value,
  };
  try {
    const next = JSON.stringify(record), key = supportedInterpretationKey(identity);
    if (storage.getItem(key) !== next) storage.setItem(key, next);
  } catch { /* A private window may forget presentation state; ledger truth is unaffected. */ }
}

export function supportedAtFor(_household: { lastCommittedAt: string | null }, today: DateKey): string {
  // The scene's effective civil date is shared across Queen, House and Journey.
  // Do not use Household.lastCommittedAt: assembled Personal recency can be newer and must not leak into a Household label.
  return `${today}T12:00:00.000Z`;
}
/** Shared revision is authoritative for Household; Personal uses its owner-visible accepted commit stamp. */
export function interpretationSourceRevision(household: Pick<Household, "revision" | "lastCommittedAt">, scope: LedgerView): number {
  if (scope === "household") return household.revision;
  const acceptedAt = household.lastCommittedAt ? Date.parse(household.lastCommittedAt) : Number.NaN;
  return Number.isSafeInteger(acceptedAt) && acceptedAt >= 0 ? acceptedAt : household.revision;
}
/** Preserve the dated cadence without inventing growth when no supported scene has been captured yet. */
export function quietJourneyMonths(months: readonly PathMonth[]): PathMonth[] {
  return months.map((month) => ({
    key: month.key,
    ...(month.geographyId ? { geographyId: month.geographyId } : {}),
    scores: Object.fromEntries(PATH_SIGNALS.map((signal) => [signal, 0])) as Record<PathSignal, number>,
    why: {}, tags: [], trip: null, unmappedCategories: [],
  }));
}
export function resolveSupportedInterpretation<T>(input: {
  gate: InterpretationGate;
  current: T;
  fallback: T;
  cached?: SupportedSection<T>;
  sourceRevision: number;
  supportedAt: string;
}): { result: SupportedInterpretationResult<T>; capture: SupportedSection<T> | null } {
  if (input.gate.current) {
    const capture = { sourceRevision: input.sourceRevision, supportedAt: input.supportedAt, value: input.current };
    return { capture, result: { value: input.current, source: "current", sourceRevision: input.sourceRevision, supportedAt: input.supportedAt, statusLine: null } };
  }
  if (input.cached) {
    const date = input.cached.supportedAt.slice(0, 10);
    return { capture: null, result: { value: input.cached.value, source: "frozen", sourceRevision: input.cached.sourceRevision, supportedAt: input.cached.supportedAt, statusLine: `Supported as of ${date} · ${input.gate.detail}` } };
  }
  return { capture: null, result: { value: input.fallback, source: "unavailable", sourceRevision: null, supportedAt: null, statusLine: `No supported interpretation stored · ${input.gate.detail}` } };
}

function browserStorage(): Store | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
type UseSectionInput<K extends InterpretationSectionName> = {
  identity: InterpretationIdentity;
  gate: InterpretationGate;
  current: InterpretationSections[K];
  fallback: InterpretationSections[K];
  sourceRevision: number;
  supportedAt: string;
};
function useSection<K extends InterpretationSectionName>(input: UseSectionInput<K> & { name: K }): SupportedInterpretationResult<InterpretationSections[K]> {
  const identityKey = interpretationIdentity(input.identity);
  // Identity participates in the synchronous read, so a scope/member switch can never paint the prior room once.
  const cached = useMemo(() => {
    const record = readSupportedInterpretation(browserStorage(), input.identity);
    const value = record?.[input.name] as InterpretationSections[K] | undefined;
    return record && value ? { ...record.support, value } : undefined;
  }, [identityKey, input.name, input.gate.current]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentKey = JSON.stringify(input.current);
  const fallbackKey = JSON.stringify(input.fallback);
  const resolved = useMemo(() => resolveSupportedInterpretation({ ...input, current: input.current, fallback: input.fallback, cached }), [identityKey, input.name, input.gate.current, input.gate.detail, input.sourceRevision, input.supportedAt, currentKey, fallbackKey, cached]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!resolved.capture) return;
    writeSupportedInterpretation(browserStorage(), input.identity, input.name, resolved.capture);
  }, [identityKey, input.name, resolved.capture?.sourceRevision, resolved.capture?.supportedAt, currentKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return resolved.result;
}

export const useSupportedQueenInterpretation = (input: UseSectionInput<"queen">) => useSection({ ...input, name: "queen" });
export const useSupportedHouseInterpretation = (input: UseSectionInput<"house">) => useSection({ ...input, name: "house" });
export const useSupportedJourneyInterpretation = (input: UseSectionInput<"journey">) => useSection({ ...input, name: "journey" });
