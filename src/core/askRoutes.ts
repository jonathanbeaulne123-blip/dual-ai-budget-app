import { addDays, calendarDaysBetween, parseDateKey, weekdaySunday0, type DateKey } from "./calendar.ts";
import { formatCad } from "./money.ts";
import { SHIFT_ORACLE_MIN_SHIFTS, weekdayCadenceMap } from "./shiftGlance.ts";
import { observeTipShifts, shiftOutlook, type TipMeal } from "./tipScience.ts";
import type { Household } from "./types.ts";

export const ROUTE_MAX_SHIFTS = 4;
export const ROUTE_MAX_DAYS = 31;

export const ASK_ROUTES_HEADER_COPY = "bars are your safe number · whiskers reach the good night";

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

function routeFrom(shifts: RouteShift[], askCents: number): AskRoute {
  const hours = shifts.reduce((sum, shift) => sum + shift.hours, 0);
  const safeCents = shifts.reduce((sum, shift) => sum + shift.safeCents, 0);
  const expectedCents = shifts.reduce((sum, shift) => sum + shift.expectedCents, 0);
  return {
    shifts,
    hours: Math.round(hours * 100) / 100,
    safeCents,
    expectedCents,
    clearsAtSafe: safeCents >= askCents,
    shortfallCents: Math.max(0, askCents - safeCents),
  };
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

function compareRoutes(left: AskRoute, right: AskRoute): number {
  return Number(right.clearsAtSafe) - Number(left.clearsAtSafe)
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
function selectRoutes(candidates: RouteShift[], askCents: number): AskRoute[] {
  const leaders: AskRoute[] = [];
  const nearMissByShape = new Map<string, AskRoute>();
  const selected: RouteShift[] = [];
  const visit = (start: number): void => {
    if (selected.length) {
      const route = routeFrom([...selected], askCents);
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
  const routes = selectRoutes(candidates, input.askCents);
  return { kind: "routes", askCents: input.askCents, routes, watchedShifts };
}
