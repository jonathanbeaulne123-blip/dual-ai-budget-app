import { addDays, calendarDaysBetween, parseDateKey, weekdaySunday0, type DateKey } from "./calendar.ts";
import { charterCeilingLabel } from "./charter.ts";
import { formatCad } from "./money.ts";
import { SHIFT_ORACLE_MIN_SHIFTS, weekdayCadenceMap } from "./shiftGlance.ts";
import { observeTipShifts, shiftOutlook, type TipMeal } from "./tipScience.ts";
import type { Household } from "./types.ts";

export const ROUTE_MAX_SHIFTS = 4;
export const ROUTE_MAX_DAYS = 31;

export const ASK_ROUTES_HEADER_COPY = "bars are your safe number · whiskers reach the good night";
export const ASK_EVERY_ROUTE_OVER_CEILING_COPY = "Every way I can see to close this is more than you two agreed to work. Moving a goal is the better answer here.";

export type CeilingVerdict =
  | { kind: "none" }
  | { kind: "within"; ceilingLabel: string }
  | { kind: "over"; ceilingLabel: string; byHours: number }
  | { kind: "over"; ceilingLabel: string; byCents: number };

export type RouteShift = {
  date: DateKey;
  weekday: number;
  meal: TipMeal;
  hours: number;
  safeCents: number;
  expectedCents: number;
};

export type AskRoute = {
  shifts: RouteShift[];
  hours: number;
  safeCents: number;
  expectedCents: number;
  clearsAtSafe: boolean;
  shortfallCents: number;
  ceiling: CeilingVerdict;
};

export type AskRoutesResult =
  | { kind: "routes"; askCents: number; routes: AskRoute[]; watchedShifts: number }
  | { kind: "not-enough-data"; askCents: number; watchedShifts: number; copy: string };

function assertAskCents(askCents: number): void {
  if (!Number.isSafeInteger(askCents) || askCents < 0) {
    throw new Error("Ask cents must be a nonnegative safe integer.");
  }
}

function candidateShifts(
  household: Household,
  memberId: string,
  from: DateKey,
  to: DateKey,
): RouteShift[] {
  parseDateKey(from);
  parseDateKey(to);
  const horizonDays = calendarDaysBetween(from, to) + 1;
  if (horizonDays < 1) throw new Error("Ask route end date must not be before its start date.");
  if (horizonDays > ROUTE_MAX_DAYS) throw new Error(`Ask route horizon cannot exceed ${ROUTE_MAX_DAYS} days.`);

  const cadence = weekdayCadenceMap(household, memberId);
  const candidates: RouteShift[] = [];
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = addDays(from, offset);
    const weekday = weekdaySunday0(date);
    const workedPattern = cadence.get(weekday);
    if (!workedPattern) continue;
    const outlook = shiftOutlook(household, {
      date,
      hours: workedPattern.hours,
      meal: workedPattern.meal,
      memberId,
    });
    if (!outlook) continue;
    candidates.push({
      date,
      weekday,
      meal: workedPattern.meal,
      hours: workedPattern.hours,
      safeCents: outlook.lowTipCents,
      expectedCents: outlook.expectedTipCents,
    });
  }
  return candidates;
}

function isoWeekStart(date: DateKey): DateKey {
  return addDays(date, -((weekdaySunday0(date) + 6) % 7));
}

/** Judge an optional route against the household's recorded Charter only. */
export function routeCeilingVerdict(
  household: Household,
  route: Pick<AskRoute, "shifts" | "safeCents">,
  from: DateKey,
): CeilingVerdict {
  parseDateKey(from);
  const charter = household.charter;
  if (!charter || charter.ceilingKind === "none") return { kind: "none" };
  if (!Number.isSafeInteger(charter.ceilingValue) || charter.ceilingValue < 0) return { kind: "none" };
  const ceilingLabel = charterCeilingLabel(charter);
  if (charter.ceilingKind === "amount-per-month") {
    return route.safeCents <= charter.ceilingValue
      ? { kind: "within", ceilingLabel }
      : { kind: "over", ceilingLabel, byCents: route.safeCents - charter.ceilingValue };
  }

  const ceilingHours = charter.ceilingValue / 10;
  const hoursByWeek = new Map<DateKey, number>();
  for (const shift of route.shifts) {
    const week = isoWeekStart(shift.date);
    hoursByWeek.set(week, (hoursByWeek.get(week) ?? 0) + shift.hours);
  }
  const mostHours = Math.max(0, ...hoursByWeek.values());
  return mostHours <= ceilingHours
    ? { kind: "within", ceilingLabel }
    : { kind: "over", ceilingLabel, byHours: Math.round((mostHours - ceilingHours) * 100) / 100 };
}

export function ceilingVerdictCopy(verdict: CeilingVerdict): string | null {
  if (verdict.kind !== "over") return null;
  if ("byHours" in verdict) {
    return `That's ${Number.isInteger(verdict.byHours) ? verdict.byHours : verdict.byHours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} hours past what you two agreed was too much.`;
  }
  return `That's ${formatCad(verdict.byCents)} past what you two agreed was too much.`;
}

function routeFrom(household: Household, shifts: RouteShift[], askCents: number, from: DateKey): AskRoute {
  const hours = shifts.reduce((sum, shift) => sum + shift.hours, 0);
  const safeCents = shifts.reduce((sum, shift) => sum + shift.safeCents, 0);
  const expectedCents = shifts.reduce((sum, shift) => sum + shift.expectedCents, 0);
  const route: AskRoute = {
    shifts,
    hours: Math.round(hours * 100) / 100,
    safeCents,
    expectedCents,
    clearsAtSafe: safeCents >= askCents,
    shortfallCents: Math.max(0, askCents - safeCents),
    ceiling: { kind: "none" },
  };
  route.ceiling = routeCeilingVerdict(household, route, from);
  return route;
}

/**
 * A later shift cannot enter a better route when four earlier candidates are
 * no longer and no less safe: any route can replace it with an unused earlier
 * candidate because a route contains at most four shifts total.
 */
function pruneDominatedCandidates(candidates: RouteShift[]): RouteShift[] {
  const retained: RouteShift[] = [];
  for (const candidate of candidates) {
    const earlierDominators = retained.filter((earlier) => earlier.hours <= candidate.hours
      && earlier.safeCents >= candidate.safeCents).length;
    if (earlierDominators < ROUTE_MAX_SHIFTS) retained.push(candidate);
  }
  return retained;
}

function finishDate(route: AskRoute): DateKey {
  return route.shifts[route.shifts.length - 1]?.date ?? "";
}

function routeIdentity(route: AskRoute): string {
  return route.shifts.map((shift) => `${shift.date}:${shift.meal}`).join("|");
}

/** Presentation rank: safe and within, safe but over, then a route that does not clear. */
export function askRouteOfferRank(route: Pick<AskRoute, "clearsAtSafe" | "ceiling">): 0 | 1 | 2 {
  if (!route.clearsAtSafe) return 2;
  return route.ceiling.kind === "over" ? 1 : 0;
}

function compareRoutes(left: AskRoute, right: AskRoute): number {
  return askRouteOfferRank(left) - askRouteOfferRank(right)
    || left.hours - right.hours
    || left.shifts.length - right.shifts.length
    || finishDate(left).localeCompare(finishDate(right))
    || routeIdentity(left).localeCompare(routeIdentity(right));
}

function isPlausiblyCheaper(nearMiss: AskRoute, clearing: AskRoute): boolean {
  return nearMiss.hours < clearing.hours
    || (nearMiss.hours === clearing.hours && nearMiss.shifts.length < clearing.shifts.length);
}

function insertLeadingRoute(leaders: AskRoute[], route: AskRoute): void {
  const index = leaders.findIndex((existing) => compareRoutes(route, existing) < 0);
  if (index < 0) leaders.push(route);
  else leaders.splice(index, 0, route);
  if (leaders.length > ROUTE_MAX_SHIFTS) leaders.pop();
}

/**
 * Visit the bounded 1–4 shift search without retaining or globally sorting every route.
 * Cadence fixes hours by weekday, so one best near miss per hours/count shape is enough.
 */
function selectRoutes(household: Household, candidates: RouteShift[], askCents: number, from: DateKey): AskRoute[] {
  const leaders: AskRoute[] = [];
  const nearMissByShape = new Map<string, AskRoute>();
  const selected: RouteShift[] = [];
  const visit = (start: number): void => {
    if (selected.length) {
      const route = routeFrom(household, [...selected], askCents, from);
      insertLeadingRoute(leaders, route);
      if (!route.clearsAtSafe && route.safeCents > 0) {
        const shape = `${route.shifts.length}:${route.hours.toFixed(2)}`;
        const existing = nearMissByShape.get(shape);
        if (!existing
          || route.shortfallCents < existing.shortfallCents
          || (route.shortfallCents === existing.shortfallCents && compareRoutes(route, existing) < 0)) {
          nearMissByShape.set(shape, route);
        }
      }
    }
    if (selected.length === ROUTE_MAX_SHIFTS) return;
    for (let index = start; index < candidates.length; index += 1) {
      selected.push(candidates[index]!);
      visit(index + 1);
      selected.pop();
    }
  };
  visit(0);

  const bestClearing = leaders.find((route) => route.clearsAtSafe);
  if (!bestClearing || leaders.some((route) => !route.clearsAtSafe)) return leaders;
  const nearMiss = [...nearMissByShape.values()]
    .filter((route) => isPlausiblyCheaper(route, bestClearing))
    .sort((left, right) => left.shortfallCents - right.shortfallCents || compareRoutes(left, right))[0];
  if (!nearMiss) return leaders;
  return [...leaders.slice(0, ROUTE_MAX_SHIFTS - 1), nearMiss].sort(compareRoutes);
}

/** Format route status from its conservative floor; expected cents stay a secondary whisker. */
export function askRouteCopy(route: AskRoute, askCents: number): string {
  assertAskCents(askCents);
  return route.clearsAtSafe
    ? `clears · ${formatCad(Math.max(0, route.safeCents - askCents))} spare`
    : `short ${formatCad(route.shortfallCents)}`;
}

/** True only when a concrete route result exists and every retained route crosses the Charter ceiling. */
export function everyRouteOverCeiling(result: AskRoutesResult | null | undefined): boolean {
  return result?.kind === "routes"
    && result.routes.length > 0
    && result.routes.every((route) => route.ceiling.kind === "over");
}

/** Build optional, read-only shift combinations from posted member cadence. */
export function askRoutes(household: Household, input: {
  askCents: number;
  memberId: string;
  from: DateKey;
  to: DateKey;
}): AskRoutesResult {
  assertAskCents(input.askCents);
  parseDateKey(input.from);
  parseDateKey(input.to);
  const watchedShifts = observeTipShifts(household, input.memberId).length;
  if (watchedShifts < SHIFT_ORACLE_MIN_SHIFTS) {
    return {
      kind: "not-enough-data",
      askCents: input.askCents,
      watchedShifts,
      copy: `I've only watched ${watchedShifts} of your shifts. Ask me again in a few weeks — I'd be guessing.`,
    };
  }
  if (input.askCents === 0) return { kind: "routes", askCents: 0, routes: [], watchedShifts };
  const candidates = pruneDominatedCandidates(
    candidateShifts(household, input.memberId, input.from, input.to),
  );
  const routes = selectRoutes(household, candidates, input.askCents, input.from);
  return { kind: "routes", askCents: input.askCents, routes, watchedShifts };
}
