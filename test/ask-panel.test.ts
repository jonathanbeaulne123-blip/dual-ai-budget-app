// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Ask } from "../src/Ask.tsx";
import {
  ASK_ROUTES_HEADER_COPY,
  HOUSEHOLD_FUND_ID,
  ROUTE_VIEW,
  addGoal,
  addRecurrence,
  askBelongsOnDesk,
  askMarkLabel,
  askPanelView,
  askRouteHoursCopy,
  askRouteName,
  askRouteWindow,
  askRoutes,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  householdAsk,
  observeTipShifts,
  proposeHouseholdFundContribution,
  routeBarX,
  routeScale,
  routeSegmentLayout,
  seedDemoHousehold,
  type AskAlternative,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-08-21";

const viewSource = readFileSync(resolve(process.cwd(), "src/core/askView.ts"), "utf8");
const componentSource = readFileSync(resolve(process.cwd(), "src/Ask.tsx"), "utf8");
const cssSource = readFileSync(resolve(process.cwd(), "src/ask.css"), "utf8");
const officeWide = readFileSync(resolve(process.cwd(), "src/OfficeWide.tsx"), "utf8");
const officePhone = readFileSync(resolve(process.cwd(), "src/OfficePhone.tsx"), "utf8");

let container: HTMLDivElement;
let root: Root;

function configuredFund(openedOn = "2026-08-01"): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn,
    createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, contributorMemberId: string, amount: string, date: string): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: contributorMemberId,
    contributorMemberId,
    amount,
    date,
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  }).household;
}

function addBill(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly",
    nextDate: date,
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

function addGoalClaim(household: Household, name: string, amount: string, date: string): Household {
  const goal = addGoal(household, { name, target: amount, shared: true, ownerMemberId: BIANCA });
  return addRecurrence(goal.household, {
    cadence: "monthly",
    nextDate: date,
    type: "transfer",
    amount,
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!,
    note: `Standing · jar · ${name}`,
  }).household;
}

function householdWithPostedShifts(count: number, netTipsCents?: number): Household {
  const household = seedDemoHousehold({ today: TODAY, environment: "development" });
  const observations = observeTipShifts(household, JONATHAN).slice(-count);
  const kept = new Set(observations.map((row) => row.shiftId));
  return {
    ...household,
    shifts: household.shifts
      .filter((shift) => shift.memberId !== JONATHAN || kept.has(shift.id))
      .map((shift) => kept.has(shift.id) && netTipsCents != null
        ? { ...shift, shiftBible: { ...shift.shiftBible!, netTipsCents } }
        : shift),
  };
}

function halifaxAskHousehold(): Household {
  let household = configuredFund("2026-09-01");
  household = addBill(household, "40", "2026-09-20", "Phone");
  household = addGoalClaim(household, "Halifax", "300", "2026-09-30");
  return household;
}

function renderAsk(
  household: Household,
  extra: { today?: string; memberId?: string; busy?: boolean; onMove?: (alternative: AskAlternative) => void } = {},
) {
  act(() => {
    root.render(createElement(Ask, {
      household,
      today: extra.today ?? "2026-09-12",
      memberId: extra.memberId ?? JONATHAN,
      busy: extra.busy ?? false,
      onMove: extra.onMove ?? (() => {}),
    }));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Ask route geometry", () => {
  it("locks one scale for the ask mark, bars, and whiskers", () => {
    expect(ROUTE_VIEW).toEqual({
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
    });
    expect(ROUTE_VIEW.barRight - ROUTE_VIEW.barLeft).toBe(560);
    expect(routeScale(34_000)).toBe(560 / 34_000);
    expect(routeBarX(34_000, routeScale(34_000))).toBe(ROUTE_VIEW.barRight);
    expect(routeScale(0)).toBe(0);
    expect(routeScale(-10)).toBe(0);
    expect(askMarkLabel(34_000)).toBe("$340 · the ask");
    expect(askRouteWindow("2026-09-12", "2026-09-30")).toEqual({ from: "2026-09-13", to: "2026-09-30" });
    expect(askRouteWindow("2026-09-30", "2026-09-30")).toBeNull();
  });

  it("conserves shift segments to the safe bar width", () => {
    const household = householdWithPostedShifts(12, 12_000);
    const result = askRoutes(household, {
      askCents: 34_000,
      memberId: JONATHAN,
      from: "2026-08-22",
      to: "2026-09-20",
    });
    expect(result.kind).toBe("routes");
    if (result.kind !== "routes") throw new Error("Expected routes");
    const scale = routeScale(Math.max(34_000, ...result.routes.flatMap((route) => [route.safeCents, route.expectedCents])));
    for (const route of result.routes) {
      const segments = routeSegmentLayout(route.shifts, scale);
      const total = segments.reduce((sum, segment) => sum + segment.width, 0);
      expect(Math.abs(total - route.safeCents * scale)).toBeLessThan(0.001);
      expect(askRouteHoursCopy(route)).toMatch(/hours · \d+ nights?$/);
      expect(askRouteName(route).length).toBeGreaterThan(0);
    }
  });
});

describe("Ask panel states", () => {
  it("keeps the other door in the open on the canonical Halifax ask", () => {
    const household = halifaxAskHousehold();
    const before = structuredClone(household);
    const view = askPanelView(household, "2026-09-12", JONATHAN);
    renderAsk(household);

    expect(household).toEqual(before);
    expect(view.figure).toBe("$340.00");
    expect(view.covered).toBe(false);
    expect(view.sentence).toBe("September still needs $340.00.");
    expect(view.showDoor).toBe(true);
    expect(view.alternatives[0]?.copy).toBe("Or move Halifax to next month, and the ask is $40.00.");
    expect(container.querySelector("[data-ask-figure]")?.textContent).toBe("$340.00");
    expect(container.querySelector("[data-ask-sentence]")?.textContent).toBe("September still needs $340.00.");
    expect(container.querySelector("[data-ask-door]")?.textContent).toContain("Or move Halifax to next month, and the ask is $40.00.");
    expect(container.querySelector("[data-ask-raise]")?.textContent).toBe("Raise it");
    expect(container.querySelector(".ask-figure")?.classList.contains("is-covered")).toBe(false);
    expect(view.caveat).toMatch(/though I've only watched \d+ weeks? of this house\./);
    expect(container.querySelector("[data-ask-caveat]")?.textContent).toBe(view.caveat);
    expect(view.sentence).not.toMatch(/though I've only watched/);
  });

  it("covers the month in pine and hides routes and the door", () => {
    let household = configuredFund("2026-09-01");
    household = contribute(household, BIANCA, "100", "2026-09-01");
    household = addBill(household, "100", "2026-09-20", "Phone");
    const view = askPanelView(household, "2026-09-12", JONATHAN);
    renderAsk(household);

    expect(view.figure).toBe("$0.00");
    expect(view.covered).toBe(true);
    expect(view.sentence).toBe("September is covered.");
    expect(view.showRoutes).toBe(false);
    expect(view.showDoor).toBe(false);
    expect(container.querySelector("[data-ask-figure]")?.textContent).toBe("$0.00");
    expect(container.querySelector(".ask-figure")?.classList.contains("is-covered")).toBe(true);
    expect(container.querySelector("[data-ask-routes]")).toBeNull();
    expect(container.querySelector("[data-ask-door]")).toBeNull();
    expect(container.querySelector("[data-ask-raise]")).toBeNull();
  });

  it("keeps the amount visible when routes refuse for thin history", () => {
    const household = halifaxAskHousehold();
    const view = askPanelView(household, "2026-09-12", JONATHAN);
    renderAsk(household);

    expect(view.figure).toBe("$340.00");
    expect(view.routes?.kind).toBe("not-enough-data");
    if (view.routes?.kind !== "not-enough-data") throw new Error("Expected refusal");
    expect(container.querySelector("[data-ask-figure]")?.textContent).toBe("$340.00");
    expect(container.querySelector("[data-ask-refusal]")?.textContent).toBe(view.routes.copy);
    expect(container.querySelector("[data-ask-routes]")).toBeNull();
    expect(container.querySelector("[data-ask-door]")).toBeTruthy();
  });

  it("opens a small date-only confirmation before asking to move Halifax", () => {
    const household = halifaxAskHousehold();
    const before = structuredClone(household);
    const moved: AskAlternative[] = [];
    renderAsk(household, {
      onMove: (alternative) => moved.push(alternative),
    });
    const button = container.querySelector("[data-ask-raise]");
    expect(button).toBeTruthy();
    act(() => {
      (button as HTMLButtonElement).click();
    });
    expect(household).toEqual(before);
    expect(moved).toHaveLength(0);
    expect(container.querySelector("[data-ask-confirm]")?.textContent).toContain("Move the date only. No money moves.");
    const confirm = container.querySelector("[data-ask-confirm-move]") as HTMLButtonElement;
    expect(confirm.textContent?.trim()).toBe("Move Halifax to next month");
    expect(document.activeElement).toBe(confirm);
    act(() => confirm.click());
    expect(household).toEqual(before);
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({
      label: "Halifax",
      claimDate: "2026-09-30",
      recurrenceId: expect.any(String),
    });
    expect(container.querySelector("[data-ask-confirm]")).toBeNull();
  });
});

describe("Ask placement and copy fences", () => {
  it("belongs on Jonathan's desk and never on the custodian's", () => {
    expect(askBelongsOnDesk(JONATHAN, BIANCA)).toBe(true);
    expect(askBelongsOnDesk(BIANCA, BIANCA)).toBe(false);
    expect(askBelongsOnDesk(JONATHAN, undefined)).toBe(false);
    expect(officeWide).toContain("askBelongsOnDesk");
    expect(officeWide).toMatch(/<Ask\s+household=\{booksHousehold\}/);
    expect(officeWide).toContain("moveAskGoalClaimToNextMonth");
    expect(officePhone).not.toMatch(/from "\.\/Ask/);
    expect(officePhone).not.toContain("askPanelView");
    expect(officePhone).not.toContain("askRoutes");
  });

  it("never instructs, scores, or writes money", () => {
    expect(ASK_ROUTES_HEADER_COPY).toBe("bars are your safe number · whiskers reach the good night");
    expect(componentSource).not.toMatch(/you should/i);
    expect(componentSource).not.toMatch(/you need to/i);
    expect(componentSource).not.toMatch(/pick up a shift/i);
    expect(componentSource).not.toMatch(/\brequired\b/i);
    expect(componentSource).not.toMatch(/\btarget\b/i);
    expect(componentSource).not.toMatch(/goal met/i);
    expect(componentSource).not.toContain("%");
    expect(componentSource).not.toMatch(/postEntry/);
    expect(componentSource).toContain("tabIndex={0}");
    expect(componentSource).toContain('role="img"');
    expect(viewSource).not.toMatch(/you should/i);
    expect(viewSource).not.toMatch(/pick up a shift/i);
    expect(viewSource).not.toMatch(/postEntry/);
    expect(cssSource).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(cssSource).toContain("--ask-figure: var(--copper)");
    expect(householdAsk(halifaxAskHousehold(), "2026-09-12").askCents).toBe(34_000);
  });
});
