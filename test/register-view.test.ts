// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Register } from "../src/Register.tsx";
import {
  HOUSEHOLD_FUND_ID,
  REGISTER_EMPTY_LINE,
  REGISTER_UNTIED_LINE,
  REGISTER_VIEW,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  contributionRegister,
  postEntry,
  proposeHouseholdFundContribution,
  registerCad,
  registerMaxRowCents,
  registerScale,
  segmentWidth,
  type ContributionRegister,
  type Household,
  type RegisterMemberView,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const MEMBERS: RegisterMemberView[] = [
  { memberId: BIANCA, displayName: "Bianca", tone: "hers" },
  { memberId: JONATHAN, displayName: "Jonathan", tone: "his" },
];

const viewSource = readFileSync(resolve(process.cwd(), "src/core/registerView.ts"), "utf8");
const componentSource = readFileSync(resolve(process.cwd(), "src/Register.tsx"), "utf8");
const cssSource = readFileSync(resolve(process.cwd(), "src/register.css"), "utf8");

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-08-01",
    createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, contributorMemberId: string, amount: string, date: string) {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: contributorMemberId,
    contributorMemberId,
    amount,
    date,
  });
  const confirmed = confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  });
  return { household: confirmed.household, eventId: confirmed.postedIds[0]! };
}

function addExpenseRecurrence(household: Household, amount: string, date: string, note: string): Household {
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

function canonicalRegister(): ContributionRegister {
  let household = configuredFund();
  household = contribute(household, BIANCA, "240", "2026-08-31").household;
  household = contribute(household, BIANCA, "980", "2026-09-04").household;
  household = contribute(household, JONATHAN, "310", "2026-09-06").household;
  household = contribute(household, JONATHAN, "225", "2026-09-11").household;
  household = contribute(household, BIANCA, "980", "2026-09-18").household;

  for (const posted of [
    { date: "2026-09-04", amount: "128", note: "Hydro" },
    { date: "2026-09-05", amount: "1450", note: "Rent · our share" },
    { date: "2026-09-10", amount: "186", note: "Insurance" },
  ]) {
    household = postEntry(household, {
      date: posted.date,
      type: "expense",
      amount: posted.amount,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: posted.note,
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: Math.round(Number(posted.amount) * 100), destinationAccountId: "ACC-VISA" },
    }).household;
  }
  household = addExpenseRecurrence(household, "520", "2026-09-15", "Groceries · planned");
  household = addExpenseRecurrence(household, "92", "2026-09-20", "Internet");
  household = addExpenseRecurrence(household, "74", "2026-09-22", "Gas");
  household = addExpenseRecurrence(household, "110", "2026-09-25", "Phone");
  household = addExpenseRecurrence(household, "215", "2026-09-26", "Vet · Marmalade");
  const goal = addGoal(household, { name: "Winter reserve", target: "300", shared: true, ownerMemberId: BIANCA });
  household = addRecurrence(goal.household, {
    cadence: "monthly",
    nextDate: "2026-09-30",
    type: "transfer",
    amount: "300",
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!,
    note: "Standing · jar · Winter reserve",
  }).household;
  return contributionRegister(household, "2026-09", "2026-09-12");
}

function emptyRegister(tiesToProjection: boolean): ContributionRegister {
  return {
    monthKey: "2026-09",
    sources: [],
    rows: [],
    carriedCents: 0,
    byMember: [],
    owedCents: 0,
    unfundedCents: 0,
    tiesToProjection,
  };
}

let root: Root;
let container: HTMLDivElement;

function renderRegister(
  register: ContributionRegister,
  members: readonly RegisterMemberView[] = MEMBERS,
  extra: { presentation?: "ready" | "loading" | "error" | "offline"; errorLine?: string } = {},
) {
  act(() => {
    root.render(createElement(Register, {
      register,
      members,
      presentation: extra.presentation,
      errorLine: extra.errorLine,
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

describe("register view geometry", () => {
  it("locks the true-width staff", () => {
    expect(REGISTER_VIEW).toEqual({
      width: 900,
      barLeft: 250,
      barRight: 810,
      rowHeight: 30,
      barHeight: 13,
      labelLeft: 0,
      dateLeft: 152,
      valueRight: 890,
    });
    expect(REGISTER_VIEW.barRight - REGISTER_VIEW.barLeft).toBe(560);
  });

  it("shares one scale across the canonical $128 and $1,450 rows", () => {
    expect(registerScale(145_000)).toBe(560 / 145_000);
    const scale = registerScale(145_000);
    expect(segmentWidth(145_000, scale)).toBe(560);
    expect(segmentWidth(12_800, scale)).toBeCloseTo(49.43, 2);
    expect(registerScale(0)).toBe(0);
    expect(registerScale(-10)).toBe(0);
    expect(Number.isFinite(registerScale(0))).toBe(true);
    expect(segmentWidth(12_800, 0)).toBe(0);
    expect(segmentWidth(-1, scale)).toBe(0);
  });

  it("conserves every canonical row within 1px of the shared amount width", () => {
    const register = canonicalRegister();
    const scale = registerScale(registerMaxRowCents(register.rows));
    expect(register.tiesToProjection).toBe(true);
    for (const row of register.rows) {
      const funded = row.segments.reduce((sum, segment) => sum + segmentWidth(segment.amountCents, scale), 0);
      const unfunded = segmentWidth(row.unfundedCents, scale);
      expect(Math.abs(funded + unfunded - segmentWidth(row.amountCents, scale))).toBeLessThanOrEqual(1);
    }
  });
});

describe("register drawing", () => {
  it("draws arrival order, unfunded outline, and canonical totals", () => {
    const register = canonicalRegister();
    const before = structuredClone(register);
    renderRegister(register);
    expect(register).toEqual(before);

    const rent = container.querySelector('[data-register-row="Rent · our share"]');
    expect(rent).toBeTruthy();
    expect(Array.from(rent!.querySelectorAll("[data-register-segment]")).map((node) => node.getAttribute("data-register-segment")))
      .toEqual(["carried", "hers", "his", "his"]);

    const insurance = container.querySelector('[data-register-row="Insurance"]');
    expect(Array.from(insurance!.querySelectorAll("[data-register-segment]")).map((node) => node.getAttribute("data-register-segment")))
      .toEqual(["his", "hers"]);

    const vet = container.querySelector('[data-register-row="Vet · Marmalade"]');
    const unfunded = vet!.querySelector("[data-register-segment='unfunded']") as SVGRectElement;
    expect(unfunded.getAttribute("fill")).toBe("none");
    expect(unfunded.getAttribute("stroke-dasharray")).toBe("3 2");
    const fundedWidth = Array.from(vet!.querySelectorAll("[data-register-segment]:not([data-register-segment='unfunded'])"))
      .reduce((sum, node) => sum + Number((node as SVGRectElement).getAttribute("width")), 0);
    expect(Number(unfunded.getAttribute("x"))).toBeCloseTo(250 + fundedWidth, 5);

    expect(container.textContent).toContain("$3,075.00");
    expect(container.textContent).toContain("$1,960.00");
    expect(container.textContent).toContain("$535.00");
    expect(container.textContent).toContain("$240.00");
    expect(container.textContent).toContain("Bianca");
    expect(container.textContent).toContain("Jonathan");
    expect(container.textContent).toContain("carried in from August");
    expect(registerCad(register.unfundedCents)).toBe("$340.00");
    expect(container.textContent).not.toContain("%");
    expect(container.textContent).not.toMatch(/you covered|leaderboard|fairness|on track|off track|great job|oops|whoops|action required|overdue/i);
  });

  it("refuses an untied register with the exact line and no financial bars", () => {
    renderRegister(emptyRegister(false));
    expect(container.textContent).toContain(REGISTER_UNTIED_LINE);
    expect(container.querySelector("[data-register-segment]")).toBeNull();
    expect(container.textContent).not.toContain("$3,075.00");
    expect(container.textContent).not.toContain("the month owes");
  });

  it("renders the empty tied month line", () => {
    renderRegister(emptyRegister(true));
    expect(container.textContent).toContain(REGISTER_EMPTY_LINE);
    expect(container.textContent).not.toContain(REGISTER_UNTIED_LINE);
  });

  it("fails closed when member metadata cannot map a contribution source", () => {
    const register = canonicalRegister();
    renderRegister(register, [{ memberId: BIANCA, displayName: "Bianca", tone: "hers" }]);
    expect(container.textContent).toContain(REGISTER_UNTIED_LINE);
    expect(container.querySelector("[data-register-segment]")).toBeNull();
    expect(container.textContent).not.toContain("$1,960.00");
  });

  it("repeats the same facts in the phone list", () => {
    const register = canonicalRegister();
    renderRegister(register);
    const list = container.querySelector(".register-list")!;
    expect(list.textContent).toContain("Hydro");
    expect(list.textContent).toContain("04 sep");
    expect(list.textContent).toContain("$128.00");
    expect(list.textContent).toContain("Rent · our share");
    expect(list.textContent).toContain("$1,450.00");
    expect(list.textContent).toContain("the month owes");
    expect(list.textContent).toContain("$3,075.00");
    expect(list.textContent).toContain("Bianca · $1,960.00");
    expect(list.textContent).toContain("Jonathan · $535.00");
    expect(list.textContent).toContain("carried in from August · $240.00");
    expect(list.textContent).toContain("not yet $340.00");
  });

  it("keeps loading, error, and offline as presentation-only", () => {
    const register = canonicalRegister();
    renderRegister(register, MEMBERS, { presentation: "loading" });
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
    expect(container.querySelector("[data-register-segment]")).toBeNull();
    renderRegister(register, MEMBERS, { presentation: "error" });
    expect(container.textContent).toContain("I couldn't draw the register from these books.");
    expect(container.querySelector("[data-register-segment]")).toBeNull();
    renderRegister(register, MEMBERS, { presentation: "offline" });
    expect(container.textContent).toContain("This drawing uses the books already on this device.");
    expect(container.textContent).toContain("$3,075.00");
  });
});

describe("register fences", () => {
  it("does not grow a second allocator or writer path", () => {
    expect(viewSource).toContain("REGISTER_VIEW");
    expect(viewSource).not.toMatch(/monthObligations|householdFund|postEntry|localStorage|fetch\(|indexedDB/);
    expect(componentSource).not.toMatch(/monthObligations|householdFund|postEntry|localStorage|fetch\(|indexedDB|MEM-001|MEM-002/);
    expect(componentSource).not.toMatch(/\bpurpose\b/);
    expect(cssSource).toContain("--reg-hers: var(--pine)");
    expect(cssSource).toContain("--reg-his: var(--copper)");
    expect(cssSource).toContain("--reg-carried:");
    expect(cssSource).toContain("--reg-unfunded: var(--copper)");
    expect(cssSource).toContain("stroke-dasharray: 3 2");
    expect(cssSource).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
