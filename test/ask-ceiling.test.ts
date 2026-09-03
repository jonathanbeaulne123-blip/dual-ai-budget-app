import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Ask } from "../src/Ask.tsx";
import {
  ASK_EVERY_ROUTE_OVER_CEILING_COPY,
  addGoal,
  addRecurrence,
  askPanelView,
  askRouteOfferRank,
  askRoutesAriaLabel,
  askRoutes,
  catalogHousehold,
  ceilingVerdictCopy,
  everyRouteOverCeiling,
  foundHouseholdCharter,
  routeCeilingVerdict,
  seedDemoHousehold,
  weeklyDocument,
  type AskRoute,
  type CharterCeilingKind,
  type Household,
  type RouteShift,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function charter(
  household: Household,
  ceilingKind: CharterCeilingKind,
  ceilingValue?: string,
  cadenceWeekday = 3,
): Household {
  return foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady without overwork.",
    splitRule: "remainder",
    splitNote: "One income covers what it covers. The other closes the rest.",
    ceilingKind,
    ceilingValue,
    cadence: "weekly",
    cadenceWeekday,
    date: "2026-09-01",
  }).household;
}

function shift(date: string, hours: number, safeCents = 1_000): RouteShift {
  return {
    date,
    weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
    meal: "dinner",
    hours,
    safeCents,
    expectedCents: safeCents,
  };
}

function verdictRoute(shifts: RouteShift[], safeCents = 1_000): Pick<AskRoute, "shifts" | "safeCents"> {
  return { shifts, safeCents };
}

function halifaxWithShifts(): Household {
  const household = seedDemoHousehold({ today: "2026-09-12", environment: "development" });
  const goal = addGoal(household, { name: "Halifax", target: "10000", shared: true, ownerMemberId: BIANCA });
  return addRecurrence(goal.household, {
    cadence: "monthly",
    nextDate: "2026-09-30",
    type: "transfer",
    amount: "10000",
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!,
    note: "Standing · jar · Halifax",
  }).household;
}

describe("Ask Charter ceiling", () => {
  it("keeps no-Charter and a none Charter route behavior identical", () => {
    const withoutCharter = halifaxWithShifts();
    const withNone = charter(structuredClone(withoutCharter), "none");
    const input = { askCents: 34_000, memberId: JONATHAN, from: "2026-09-13" as const, to: "2026-09-30" as const };

    const before = askRoutes(withoutCharter, input);
    const after = askRoutes(withNone, input);

    expect(after).toEqual(before);
    expect(after.kind).toBe("routes");
    if (after.kind !== "routes") throw new Error("Expected routes");
    expect(after.routes.every((route) => route.ceiling.kind === "none")).toBe(true);
  });

  it("marks 15.5 hours within and 31 hours over a 24-hour week", () => {
    const household = charter(catalogHousehold(), "hours-per-week", "24");
    const within = routeCeilingVerdict(household, verdictRoute([shift("2026-09-08", 15.5)]), "2026-09-01");
    const over = routeCeilingVerdict(household, verdictRoute([shift("2026-09-08", 31)]), "2026-09-01");

    expect(within).toEqual({ kind: "within", ceilingLabel: "24 hours a week" });
    expect(over).toEqual({ kind: "over", ceilingLabel: "24 hours a week", byHours: 7 });
    expect(ceilingVerdictCopy(over)).toBe("That's 7 hours past what you two agreed was too much.");
  });

  it("judges an ISO-week boundary per week instead of summing the route", () => {
    const household = charter(catalogHousehold(), "hours-per-week", "16");
    const verdict = routeCeilingVerdict(household, verdictRoute([
      shift("2026-09-06", 12),
      shift("2026-09-07", 8),
    ]), "2026-09-01");

    expect(verdict).toEqual({ kind: "within", ceilingLabel: "16 hours a week" });
  });

  it("uses conservative route cents for an amount ceiling without changing the route", () => {
    const household = charter(catalogHousehold(), "amount-per-month", "300");
    const route = verdictRoute([shift("2026-09-08", 4, 34_000)], 34_000);
    const before = structuredClone(route);
    const verdict = routeCeilingVerdict(household, route, "2026-09-01");

    expect(verdict).toEqual({ kind: "over", ceilingLabel: "$300 a month", byCents: 4_000 });
    expect(ceilingVerdictCopy(verdict)).toBe("That's $40.00 past what you two agreed was too much.");
    expect(route).toEqual(before);
  });

  it("orders clearing within, clearing over, then routes that do not clear", () => {
    const household = charter(
      seedDemoHousehold({ today: "2026-09-12", environment: "development" }),
      "hours-per-week",
      "5.5",
    );
    const result = askRoutes(household, {
      askCents: 15_000,
      memberId: JONATHAN,
      from: "2026-09-13",
      to: "2026-09-30",
    });
    expect(result.kind).toBe("routes");
    if (result.kind !== "routes") throw new Error("Expected routes");
    const ranks = result.routes.map(askRouteOfferRank);

    expect(askRouteOfferRank({ clearsAtSafe: true, ceiling: { kind: "within", ceilingLabel: "6 hours a week" } })).toBe(0);
    expect(askRouteOfferRank({ clearsAtSafe: true, ceiling: { kind: "over", ceilingLabel: "6 hours a week", byHours: 1 } })).toBe(1);
    expect(askRouteOfferRank({ clearsAtSafe: false, ceiling: { kind: "within", ceilingLabel: "6 hours a week" } })).toBe(2);
    expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
    const withinClearing = result.routes.filter((route) => route.clearsAtSafe && route.ceiling.kind !== "over");
    expect(withinClearing.map((route) => route.hours)).toEqual(
      withinClearing.map((route) => route.hours).sort((left, right) => left - right),
    );
    const overRoute: AskRoute = {
      ...result.routes[0]!,
      ceiling: { kind: "over", ceilingLabel: "6 hours a week", byHours: 1 },
    };
    expect(askRoutesAriaLabel(result.askCents, [overRoute])).toContain(
      "That's 1 hours past what you two agreed was too much.",
    );
  });

  it("retains every over-ceiling route as record while Ask opens the other door", () => {
    const household = charter(halifaxWithShifts(), "hours-per-week", "1");
    const view = askPanelView(household, "2026-09-12", JONATHAN);
    const html = renderToStaticMarkup(createElement(Ask, {
      household,
      today: "2026-09-12",
      memberId: JONATHAN,
      busy: false,
      onMove: () => {},
    }));

    expect(view.routes?.kind).toBe("routes");
    expect(everyRouteOverCeiling(view.routes)).toBe(true);
    expect(view.routes?.kind === "routes" ? view.routes.routes.length : 0).toBeGreaterThan(0);
    expect(view.drawing).toBeNull();
    expect(view.showRoutes).toBe(false);
    expect(view.showDoor).toBe(true);
    expect(view.ceilingCopy).toBe(ASK_EVERY_ROUTE_OVER_CEILING_COPY);
    expect(html).not.toContain("data-ask-routes");
    expect(html).toContain(`data-ask-ceiling="">${ASK_EVERY_ROUTE_OVER_CEILING_COPY}`);
    expect(html).toContain("data-ask-door");

    const weekly = weeklyDocument(household, { viewerMemberId: JONATHAN, today: "2026-09-02" });
    expect(weekly.routes?.kind).toBe("routes");
    expect(weekly.ceilingCopy).toBe(ASK_EVERY_ROUTE_OVER_CEILING_COPY);
  });

  it("keeps ceiling language in route logic and imperative work language out of Ask", () => {
    const routesSource = readFileSync(new URL("../src/core/askRoutes.ts", import.meta.url), "utf8");
    const askSource = readFileSync(new URL("../src/Ask.tsx", import.meta.url), "utf8");

    expect(routesSource).toMatch(/charter/i);
    expect(routesSource).toMatch(/ceiling/i);
    expect(askSource).not.toMatch(/you should work|you need to work|pick up (?:a )?shift/i);
  });
});
