import { monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { PATH_SIGNALS, pathCategoryMappings, type PathCategorySignal, type PathSignal } from "./pathWorld.ts";
import type { Household } from "./types.ts";
import { belongsToSharedLedger } from "./visibility.ts";
import { fundModelMode, householdFundMarker, SPENDING_UMBRELLAS, umbrellaOfCategory, type UmbrellaId } from "./fundRules.ts";

/**
 * Our Path world read-model (D-262). Pure: household-scope facts in, one row per
 * month out. Scores are 0–1 shapes of what happened, never amounts, and every
 * non-zero score carries the plain-language evidence that earned it so the
 * island can always say why something grew.
 *
 * Personal-only transactions, private events and Personal goals never feed it.
 */

export type PathTripType = "sea" | "mountain" | "city";
export type PathMonth = {
  key: string;
  scores: Record<PathSignal, number>;
  /** Plain-language reasons, keyed by score or tag. */
  why: Partial<Record<PathSignal | string, string>>;
  tags: string[];
  trip: { name: string; type: PathTripType } | null;
  /** Household categories with spending this month that feed no score yet. */
  unmappedCategories: { id: string; name: string }[];
  /**
   * Slice 11 (D-281): once the money model sorted the household, a 0–1 shape
   * per spending umbrella (by umbrella id, never by name, never an amount).
   * Absent before the migration, so a v1 island is unchanged.
   */
  umbrellas?: Partial<Record<UmbrellaId, number>>;
};

/**
 * The month the island's umbrella slots are seeded (Slice 11): the month of the
 * first household plan agreed under the money model, or null.
 */
export function umbrellaSeedMonth(household: Pick<Household, "fundModelRows" | "planVersions">): string | null {
  const marker = householdFundMarker(household as Household);
  if (!marker) return null;
  const agreed = (household.planVersions ?? [])
    .filter((row) => row.scope === "household" && ["active", "scheduled", "superseded"].includes(row.state) && (row.activatedAt ?? row.createdAt) >= marker.migratedAt)
    .map((row) => row.monthKey)
    .sort();
  return agreed[0] ?? null;
}

const MAX_MONTHS = 36;
const clamp = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

function monthOfIso(iso: string | null | undefined): string | null {
  return typeof iso === "string" && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null;
}
function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number) as [number, number];
  const [ly, lm] = last.split("-").map(Number) as [number, number];
  while ((y < ly || (y === ly && m <= lm)) && out.length < 600) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out.slice(-MAX_MONTHS);
}

const MOUNTAIN = /\b(ski|skiing|snowboard|mountain|mountains|hike|hiking|cabin|banff|whistler|jasper|tremblant|blue mountain|rockies|chalet)\b/i;
const CITY = /\b(city|montr[eé]al|toronto|ottawa|qu[eé]bec city|vancouver|new york|nyc|chicago|boston|paris|london|weekend in)\b/i;
const TRAVEL_EVENT = /\b(trip|vacation|holiday|getaway|flight|beach|cottage|camping|ski|visit to|weekend in)\b/i;

export function pathTripType(text: string): PathTripType {
  if (MOUNTAIN.test(text)) return "mountain";
  if (CITY.test(text)) return "city";
  return "sea";
}

function weeklySpread(rows: { date: DateKey; cents: number }[]): number | null {
  if (rows.length < 3) return null;
  const weeks = [0, 0, 0, 0, 0];
  for (const row of rows) weeks[Math.min(4, Math.floor((Number(row.date.slice(8, 10)) - 1) / 7))]! += row.cents;
  const used = weeks.slice(0, 4);
  const mean = used.reduce((a, b) => a + b, 0) / used.length;
  if (mean <= 0) return null;
  const sd = Math.sqrt(used.reduce((a, b) => a + (b - mean) ** 2, 0) / used.length);
  return sd / mean;
}

/** Every month from the household's first shared fact through `today`, at most 36. */
export function pathMonths(household: Household, today: DateKey): PathMonth[] {
  const shared = household.transactions.filter((tx) => belongsToSharedLedger(tx) && !tx.isDuplicate && (tx.type === "expense" || tx.type === "income"));
  const sharedGoals = household.goals.filter((goal) => goal.shared);
  const sharedGoalIds = new Set(sharedGoals.map((goal) => goal.id));
  const contributions = (household.goalContributions ?? []).filter((row) => sharedGoalIds.has(row.goalId));
  const chapters = household.chapters ?? [];
  const wins = household.wins ?? [];
  const sitdowns = household.sitDownSessions ?? [];
  // The one check-in (Plan Studio v3) closes a Shared Sitdown session; a closed one counts as that month's Sitdown.
  const sorted = fundModelMode(household) === 2;
  // Only once the money model sorted the household (D-281, review M3), so a flags-off island is unchanged.
  const checkIns = sorted ? (household.planHerculesSessions ?? []).filter((row) => row?.state === "closed" && row.monthKey) : [];
  const events = (household.nativeEvents ?? []).filter((row) => row.visibility === "household" && !row.deleted);
  const nowMonth = monthKeyFromDateKey(today);

  const starts = [
    ...shared.map((tx) => tx.date.slice(0, 7)),
    ...sharedGoals.map((goal) => monthOfIso(goal.createdAt)),
    ...chapters.map((row) => monthOfIso(row.openedAt)),
    ...contributions.map((row) => row.date.slice(0, 7)),
  ].filter((key): key is string => Boolean(key) && key! <= nowMonth && key! >= "2000-01");
  const first = starts.length ? starts.sort()[0]! : nowMonth;
  const keys = monthsBetween(first, nowMonth);

  const mapping = new Map(pathCategoryMappings(household).map((row) => [row.category.id, row]));
  const categoryName = new Map(household.categories.map((row) => [row.id, row]));
  // An agreed plan for next month seeds the slots now; the island never shows a month that hasn't come.
  const seedRaw = umbrellaSeedMonth(household);
  const seedMonth = seedRaw ? (seedRaw > nowMonth ? nowMonth : seedRaw < keys[0]! ? keys[0]! : seedRaw) : null;
  const firstChapterMonth = chapters.map((row) => monthOfIso(row.openedAt)).filter(Boolean).sort()[0] ?? null;
  const firstGoalMonth = sharedGoals.map((row) => monthOfIso(row.createdAt)).filter(Boolean).sort()[0] ?? null;
  const firstSitdownMonth = [...sitdowns.map((row) => row.monthKey), ...checkIns.map((row) => row.monthKey)].filter(Boolean).sort()[0] ?? null;

  // Cumulative shared-goal backing by month, for 50% / 100% milestones.
  const targetById = new Map(sharedGoals.map((goal) => [goal.id, goal.targetCents]));
  const running = new Map<string, number>();
  const crossings = new Map<string, string[]>();
  for (const row of [...contributions].sort((a, b) => a.date.localeCompare(b.date))) {
    const target = targetById.get(row.goalId) ?? 0;
    if (target <= 0) continue;
    const before = running.get(row.goalId) ?? 0;
    const after = before + row.amountCents;
    running.set(row.goalId, after);
    for (const mark of [0.5, 1]) {
      if (before < target * mark && after >= target * mark) {
        const name = sharedGoals.find((goal) => goal.id === row.goalId)?.name ?? "A goal";
        const key = row.date.slice(0, 7);
        crossings.set(key, [...(crossings.get(key) ?? []), `${name} reached ${mark === 1 ? "its target" : "halfway"}`]);
      }
    }
  }

  return keys.map((key) => {
    const scores = Object.fromEntries(PATH_SIGNALS.map((s) => [s, 0])) as Record<PathSignal, number>;
    const why: PathMonth["why"] = {};
    const tags: string[] = [];
    const inMonth = shared.filter((tx) => tx.date.startsWith(key));
    const expenses = inMonth.filter((tx) => tx.type === "expense");
    const expenseCents = expenses.reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const incomeCents = inMonth.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);

    // Essentials against income (or spending when income was not recorded).
    const essentialCents = expenses.filter((tx) => {
      const category = categoryName.get(tx.subcategoryId ?? tx.categoryId ?? "");
      const parent = category?.parentId ? categoryName.get(category.parentId) : undefined;
      return Boolean(category?.essential || parent?.essential);
    }).reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const base = Math.max(incomeCents, expenseCents);
    if (base > 0 && essentialCents > 0) {
      scores.essentials = clamp(essentialCents / base * 1.15);
      why.essentials = `Essentials took ${Math.round(essentialCents / base * 100)}% of the month`;
    }

    // Category-fed scores.
    const bySignal = new Map<PathCategorySignal, { cents: number; names: Set<string> }>();
    const unmapped = new Map<string, string>();
    for (const tx of expenses) {
      const id = tx.subcategoryId ?? tx.categoryId;
      if (!id) continue;
      const row = mapping.get(id) ?? (tx.categoryId ? mapping.get(tx.categoryId) : undefined);
      if (!row) continue;
      // A category the couple set to "Nothing on the island" is muted, not new.
      if (!row.signal) { if (row.source === "none" && !categoryName.get(id)?.essential) unmapped.set(row.category.id, row.category.name); continue; }
      const entry = bySignal.get(row.signal) ?? { cents: 0, names: new Set<string>() };
      entry.cents += Math.abs(tx.amountCents);
      entry.names.add(row.category.name);
      bySignal.set(row.signal, entry);
    }
    for (const [signal, entry] of bySignal) {
      if (entry.cents <= 0 || expenseCents <= 0) continue;
      const share = entry.cents / expenseCents;
      scores[signal] = clamp(0.35 + share * (signal === "joy" ? 2.5 : 4));
      why[signal] = `Spending in ${[...entry.names].slice(0, 3).join(", ")}`;
    }

    // Money set aside for shared goals.
    const saved = contributions.filter((row) => row.date.startsWith(key));
    if (saved.length) {
      const sum = saved.reduce((total, row) => total + row.amountCents, 0);
      const scale = Math.max(1, sharedGoals.reduce((total, goal) => total + goal.targetCents, 0) * 0.06);
      scores.saved = clamp(0.4 + sum / scale);
      why.saved = `${saved.length} contribution${saved.length === 1 ? "" : "s"} to shared Kitty Banks`;
    }

    // Cushion used through the Fund.
    const released = (household.fundEvents ?? []).filter((row) => row.kind === "kitty-released" && row.date.startsWith(key));
    if (released.length) {
      const target = Math.max(1, ...released.map((row) => targetById.get(row.goalId ?? "") ?? 0));
      scores.cushionUsed = clamp(0.3 + released.reduce((t, row) => t + row.amountCents, 0) / target);
      why.cushionUsed = "Money came out of a Kitty Bank to cover something";
    }

    // Together: Sitdowns, shared Moves, Wins and Chapter moments.
    let together = 0;
    const reasons: string[] = [];
    if (sitdowns.some((row) => row.monthKey === key) || checkIns.some((row) => row.monthKey === key)) { together += 0.4; reasons.push("a Sitdown"); }
    const movesDone = (household.moves ?? []).filter((row) => row.state === "done" && monthOfIso(row.completedAt) === key).length;
    if (movesDone) { together += 0.15 * movesDone; reasons.push(`${movesDone} Move${movesDone === 1 ? "" : "s"} done`); }
    const winsHere = wins.filter((row) => monthOfIso(row.shownAt) === key);
    if (winsHere.length) { together += 0.1 * winsHere.length; reasons.push(`${winsHere.length} Win${winsHere.length === 1 ? "" : "s"}`); }
    const chapterMoments = chapters.filter((row) => monthOfIso(row.openedAt) === key || monthOfIso(row.closedAt) === key).length;
    if (chapterMoments) { together += 0.3; reasons.push("a Chapter opened or closed"); }
    if (together > 0) { scores.together = clamp(together); why.together = reasons.join(", "); }

    // Rhythm: Ritual days held.
    const held = (household.rituals ?? []).reduce((count, row) => count + row.heldOn.filter((day) => day.startsWith(key)).length, 0);
    if (held) { scores.rhythm = clamp(held * 0.2); why.rhythm = `Rituals held on ${held} day${held === 1 ? "" : "s"}`; }

    // Learning and Chapter outcomes.
    for (const chapter of chapters.filter((row) => monthOfIso(row.closedAt) === key)) {
      if (chapter.state === "established" || chapter.state === "still-forming" || chapter.state === "closed") {
        scores.learning = Math.max(scores.learning, chapter.state === "established" ? 0.8 : 0.55);
        why.learning = `Closed “${chapter.title}”`;
      }
      if (chapter.state === "life-changed") { tags.push("life-changed"); why["life-changed"] = `“${chapter.title}” closed because life changed`; }
    }

    // Calm: steady week-to-week spending.
    const spread = weeklySpread(expenses.map((tx) => ({ date: tx.date, cents: Math.abs(tx.amountCents) })));
    if (spread !== null && key < nowMonth) { scores.calm = clamp(1 - spread); if (scores.calm > 0) why.calm = "Spending stayed steady week to week"; }

    // Firsts.
    const firsts: string[] = [];
    if (firstChapterMonth === key) firsts.push("your first Chapter");
    if (firstGoalMonth === key) firsts.push("your first shared goal");
    if (firstSitdownMonth === key) firsts.push("your first Sitdown");
    if (firsts.length) { scores.firsts = clamp(0.5 + 0.15 * firsts.length); why.firsts = firsts.join(", "); }
    if (seedMonth === key) { tags.push("umbrella-slots"); why["umbrella-slots"] = "Our first plan agreed the new way: every part of life got a place"; }
    if (firstChapterMonth === key) { tags.push("first-campfire"); why["first-campfire"] = "Your first Chapter began here"; }

    // Milestones.
    const bigWins = winsHere.filter((row) => row.level === "first" || row.level === "graduation");
    const crossed = crossings.get(key) ?? [];
    if (bigWins.length || crossed.length) {
      tags.push("milestone");
      why.milestone = [...bigWins.map((row) => row.title), ...crossed].filter(Boolean).join(" · ") || "A milestone";
    }

    // A quiet month: nothing shared happened at all.
    // Only after the couple began meeting: months before the first Chapter or Sitdown are not "missed".
    const began = [firstChapterMonth, firstSitdownMonth].filter((row): row is string => Boolean(row)).sort()[0];
    if (began && key > began && key < nowMonth && together === 0 && held === 0 && !saved.length) {
      tags.push("paused");
      why.paused = "No Sitdown, Move or Ritual this month";
    }

    // Travel from the shared calendar, and trip naming.
    const tripEvents = events.filter((row) => row.start.startsWith(key) && TRAVEL_EVENT.test(`${row.title} ${row.location}`));
    if (tripEvents.length && scores.travel < 0.6) { scores.travel = Math.max(scores.travel, 0.6); why.travel = `On the calendar: ${tripEvents[0]!.title}`; }
    let trip: PathMonth["trip"] = null;
    if (scores.travel >= 0.4) {
      const event = tripEvents[0];
      const travelNames = [...(bySignal.get("travel")?.names ?? [])];
      const name = (event?.title || travelNames[0] || "A trip").slice(0, 60);
      trip = { name, type: pathTripType(`${event?.title ?? ""} ${event?.location ?? ""} ${travelNames.join(" ")}`) };
    }
    for (const id of unmapped.keys()) tags.push(`category:${id}`);

    // Slice 11: a shape per umbrella, from the share of the month's shared spending filed under it.
    let umbrellas: PathMonth["umbrellas"];
    if (sorted) {
      const byUmbrella = new Map<UmbrellaId, number>();
      for (const tx of expenses) {
        const umbrella = umbrellaOfCategory(household, tx.subcategoryId ?? tx.categoryId);
        if (!umbrella) continue;
        byUmbrella.set(umbrella, (byUmbrella.get(umbrella) ?? 0) + Math.abs(tx.amountCents));
      }
      umbrellas = {};
      for (const umbrella of SPENDING_UMBRELLAS) {
        const cents = byUmbrella.get(umbrella.id) ?? 0;
        if (cents <= 0 || expenseCents <= 0) continue;
        umbrellas[umbrella.id] = clamp(0.3 + (cents / expenseCents) * 2);
        why[`umbrella:${umbrella.id}`] = `Spending under ${umbrella.name}`;
      }
    }

    return {
      key,
      scores,
      why,
      tags: [...new Set(tags)],
      trip,
      unmappedCategories: [...unmapped].map(([id, name]) => ({ id, name })),
      ...(umbrellas ? { umbrellas } : {}),
    };
  });
}

/** How a month reads at a glance (Our Path plan §2.1). Presentation only. */
export type PathMonthCharacter = "steady" | "bloom" | "milestone" | "uphill" | "storm" | "paused";
export function pathMonthCharacter(month: PathMonth): PathMonthCharacter {
  if (month.tags.includes("milestone")) return "milestone";
  if (month.scores.cushionUsed >= 0.3 || month.tags.includes("life-changed")) return "storm";
  if (month.tags.includes("paused")) return "paused";
  if (month.scores.essentials >= 0.7) return "uphill";
  if (month.scores.joy >= 0.6 || (month.scores.saved >= 0.5 && month.scores.rhythm >= 0.6)) return "bloom";
  return "steady";
}
