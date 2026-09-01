/**
 * The Ask panel — route geometry and desk presentation.
 *
 * Pure, testable, and deliberately separate from the component: bars, whiskers,
 * and the copper ask mark share one scale so a route that clears (or falls
 * short) is a picture of the same cents `askRoutes` already computed. This fold
 * does not allocate, post, or move a goal.
 */

import { addDays, calendarDaysBetween, parseDateKey, type DateKey } from "./calendar.ts";
import { formatCad } from "./money.ts";
import { houseRunRate, type RunRateConfidence } from "./houseRunRate.ts";
import {
  askAlternatives,
  householdAsk,
  type AskAlternative,
  type HouseholdAsk,
} from "./ask.ts";
import {
  ASK_ROUTES_HEADER_COPY,
  ROUTE_MAX_DAYS,
  askRouteCopy,
  askRoutes,
  type AskRoute,
  type AskRoutesResult,
  type RouteShift,
} from "./askRoutes.ts";
import type { Household } from "./types.ts";

export type { AskAlternative, HouseholdAsk } from "./ask.ts";

export const ROUTE_VIEW = {
  width: 900,
  barLeft: 250,
  barRight: 810,
  valueRight: 890,
  rowHeight: 60,
  barHeight: 16,
  barY: 4,
  header: 36,
  footer: 28,
  whiskerCap: 12,
  labelLeft: 0,
} as const;

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const CARDINALS = ["", "", "Two", "Three", "Four"] as const;
const WATCHING_TAIL = / — though I've only watched \d+ weeks of this house\.?$/;
const BAR_ROOM = ROUTE_VIEW.barRight - ROUTE_VIEW.barLeft;

export type AskRouteSegmentView = {
  x: number;
  width: number;
  opacity: number;
};

export type AskRouteRowView = {
  name: string;
  hoursCopy: string;
  status: string;
  clears: boolean;
  segments: AskRouteSegmentView[];
  whisker: { x1: number; x2: number } | null;
  capX: number | null;
};

export type AskRoutesDrawing = {
  width: number;
  height: number;
  scale: number;
  askX: number;
  askLabel: string;
  ariaLabel: string;
  header: typeof ASK_ROUTES_HEADER_COPY;
  rows: AskRouteRowView[];
};

export type AskPanelView = {
  monthAsk: HouseholdAsk;
  paydayAsk: HouseholdAsk;
  figure: string;
  covered: boolean;
  sentence: string;
  paydayLine: string | null;
  caveat: string | null;
  alternatives: AskAlternative[];
  routes: AskRoutesResult | null;
  showRoutes: boolean;
  showDoor: boolean;
  drawing: AskRoutesDrawing | null;
};

/** One scale for the ask mark, safe bars, and expected whiskers. */
export function routeScale(maxCents: number, room: number = BAR_ROOM): number {
  if (!Number.isFinite(maxCents) || maxCents <= 0 || !Number.isFinite(room) || room <= 0) return 0;
  return room / maxCents;
}

export function routeBarX(cents: number, scale: number): number {
  return ROUTE_VIEW.barLeft + Math.max(0, cents) * scale;
}

export function routeSegmentLayout(
  shifts: readonly RouteShift[],
  scale: number,
): AskRouteSegmentView[] {
  let x = ROUTE_VIEW.barLeft;
  const count = shifts.length;
  return shifts.map((shift, index) => {
    const width = Math.max(0, shift.safeCents) * scale;
    const opacity = count <= 1 ? 1 : 1 - (index / (count - 1)) * 0.45;
    const segment = { x, width, opacity };
    x += width;
    return segment;
  });
}

export function askBelongsOnDesk(
  memberId: string,
  custodianMemberId: string | null | undefined,
): boolean {
  return Boolean(memberId && custodianMemberId && memberId !== custodianMemberId);
}

export function askRouteWindow(today: DateKey, throughDate: DateKey): { from: DateKey; to: DateKey } | null {
  parseDateKey(today);
  parseDateKey(throughDate);
  const from = addDays(today, 1);
  if (from > throughDate) return null;
  const span = calendarDaysBetween(from, throughDate) + 1;
  if (span > ROUTE_MAX_DAYS) return { from, to: addDays(from, ROUTE_MAX_DAYS - 1) };
  return { from, to: throughDate };
}

export function stripAskCaveat(copy: string): string {
  const stripped = copy.replace(WATCHING_TAIL, "");
  if (stripped === copy) return copy;
  return /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
}

export function askCaveatLine(confidence: RunRateConfidence, weeksWatched: number): string | null {
  if (confidence !== "watching") return null;
  return `though I've only watched ${weeksWatched} weeks of this house.`;
}

export function askMarkLabel(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) return "$0 · the ask";
  const dollars = cents / 100;
  const amount = Number.isInteger(dollars) ? `$${dollars}` : formatCad(cents);
  return `${amount} · the ask`;
}

export function askRouteHoursCopy(route: AskRoute): string {
  const nights = route.shifts.length;
  const nightWord = nights === 1 ? "night" : "nights";
  return `${route.hours.toFixed(1)} hours · ${nights} ${nightWord}`;
}

export function askRouteName(route: AskRoute): string {
  const labels = route.shifts.map((shift) => {
    const weekday = WEEKDAY_LONG[shift.weekday] ?? "Day";
    return shift.meal === "lunch" ? `${weekday} lunch` : weekday;
  });
  if (labels.length === 0) return "Route";
  const unique = [...new Set(labels)];
  if (unique.length === 1) {
    const count = labels.length;
    if (count === 1) return unique[0]!;
    const weekday = WEEKDAY_LONG[route.shifts[0]!.weekday] ?? "Day";
    return `${CARDINALS[count] ?? count} ${weekday}s`;
  }
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, ${labels[labels.length - 1]}`;
}

export function askRoutesAriaLabel(askCents: number, routes: AskRoute[]): string {
  const top = routes[0];
  if (!top) return `The ask is ${formatCad(askCents)}.`;
  const name = askRouteName(top);
  const outcome = top.clearsAtSafe
    ? "clears it at the safe number"
    : `is short ${formatCad(top.shortfallCents)}`;
  return `Routes toward ${formatCad(askCents)}; ${name} ${outcome}.`;
}

export function buildAskRoutesDrawing(askCents: number, routes: AskRoute[]): AskRoutesDrawing {
  const maxCents = Math.max(
    askCents,
    ...routes.flatMap((route) => [route.safeCents, route.expectedCents]),
    0,
  );
  const scale = routeScale(maxCents);
  return {
    width: ROUTE_VIEW.width,
    height: ROUTE_VIEW.header + routes.length * ROUTE_VIEW.rowHeight + ROUTE_VIEW.footer,
    scale,
    askX: routeBarX(askCents, scale),
    askLabel: askMarkLabel(askCents),
    ariaLabel: askRoutesAriaLabel(askCents, routes),
    header: ASK_ROUTES_HEADER_COPY,
    rows: routes.map((route) => {
      const safeEnd = routeBarX(route.safeCents, scale);
      const expectedEnd = routeBarX(route.expectedCents, scale);
      const hasWhisker = expectedEnd > safeEnd + 0.5;
      return {
        name: askRouteName(route),
        hoursCopy: askRouteHoursCopy(route),
        status: askRouteCopy(route, askCents),
        clears: route.clearsAtSafe,
        segments: routeSegmentLayout(route.shifts, scale),
        whisker: hasWhisker ? { x1: safeEnd, x2: expectedEnd } : null,
        capX: hasWhisker ? expectedEnd : null,
      };
    }),
  };
}

/** Compose the existing Ask, payday, alternatives, and routes for the desk. */
export function askPanelView(household: Household, today: DateKey, memberId: string): AskPanelView {
  const monthAsk = householdAsk(household, today, "month");
  const paydayAsk = householdAsk(household, today, "payday");
  const runRate = houseRunRate(household, today);
  const covered = monthAsk.askCents === 0;
  const alternatives = covered ? [] : askAlternatives(monthAsk);
  const window = covered ? null : askRouteWindow(today, monthAsk.throughDate);
  const routes = !covered && window
    ? askRoutes(household, {
      askCents: monthAsk.askCents,
      memberId,
      from: window.from,
      to: window.to,
    })
    : null;
  const drawing = routes?.kind === "routes" && routes.routes.length > 0
    ? buildAskRoutesDrawing(monthAsk.askCents, routes.routes)
    : null;

  return {
    monthAsk,
    paydayAsk,
    figure: formatCad(monthAsk.askCents),
    covered,
    sentence: stripAskCaveat(monthAsk.copy),
    paydayLine: !covered && paydayAsk.horizon === "payday" ? stripAskCaveat(paydayAsk.copy) : null,
    caveat: askCaveatLine(monthAsk.confidence, runRate.weeksWatched),
    alternatives,
    routes,
    showRoutes: !covered,
    showDoor: !covered && alternatives.length > 0,
    drawing,
  };
}
