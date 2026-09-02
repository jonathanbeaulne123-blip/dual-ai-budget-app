// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Till, TILL_COPY, TILL_DESK_HASH } from "../src/Till.tsx";
import {
  HOUSEHOLD_FUND_HOLD_COPY,
  SWIPE_COPY,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  formatCad,
  holdHouseholdFundContribution,
  householdFundContributionMotions,
  householdFundMotionActorActions,
  monthKeyFromDateKey,
  monthSummary,
  postEntry,
  projectHouseholdFund,
  projectLedgerExperience,
  proposeHouseholdFundContribution,
  releaseHouseholdFundHold,
  tillActionableMotions,
  withdrawHouseholdFundContribution,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";
const tillSource = readFileSync(resolve(process.cwd(), "src/Till.tsx"), "utf8");
const tillCss = readFileSync(resolve(process.cwd(), "src/till.css"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const experienceSource = readFileSync(resolve(process.cwd(), "src/core/ledgerExperience.ts"), "utf8");
const fundCore = readFileSync(resolve(process.cwd(), "src/core/householdFund.ts"), "utf8");

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

function scoped(household: Household, memberId = BIANCA): Household {
  const experience = projectLedgerExperience(household, memberId, "household", TODAY);
  if (!experience.ok) throw new Error(experience.spoken);
  return experience.scopedHousehold;
}

function buy(household: Household, amount = "12.34"): Household {
  return postEntry(household, {
    date: TODAY,
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy: BIANCA,
    visibility: "household",
    confirmDuplicate: true,
    funding: {
      fundId: household.householdFund!.id,
      fundedCents: Math.round(Number(amount) * 100),
      destinationAccountId: "ACC-VISA",
    },
  }).household;
}

function proposeFromJonathan(household: Household): Household {
  return proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "100",
    date: TODAY,
  }).household;
}

let root: Root;
let container: HTMLDivElement;

function renderTill(
  household: Household,
  options: {
    memberId?: string;
    showSwipe?: boolean;
    offlinePending?: boolean;
    onOpenSwipe?: () => void;
    onSeeEverything?: () => void;
    strip?: ReturnType<typeof createElement>;
  } = {},
) {
  const memberId = options.memberId ?? BIANCA;
  act(() => {
    root.render(createElement(Till, {
      household: scoped(household, memberId),
      memberId,
      today: TODAY,
      busy: false,
      showSwipe: options.showSwipe ?? true,
      offlinePending: options.offlinePending ?? false,
      strip: options.strip,
      onOpenSwipe: options.onOpenSwipe ?? (() => undefined),
      onSeeEverything: options.onSeeEverything ?? (() => undefined),
      onCommand: () => undefined,
    }));
  });
}

function tillOrder(): string[] {
  return Array.from(container.querySelectorAll("[data-till]"))
    .map((node) => node.getAttribute("data-till") ?? "")
    .filter((value) => value && value !== "surface");
}

describe("Till slice 3 surface", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the exact 390px DOM order and required copy", () => {
    renderTill(configuredFund());
    expect(tillOrder()).toEqual(["swipe", "custody", "spend", "empty", "desk"]);
    expect(container.querySelector("[data-till='swipe']")?.textContent).toBe(SWIPE_COPY.action);
    expect(container.querySelector("[data-till='custody']")?.textContent).toBe(TILL_COPY.nothingMoved);
    expect(container.querySelector("[data-till='spend']")?.textContent).toBe(TILL_COPY.spent(formatCad(0)));
    expect(container.querySelector("[data-till='empty']")?.textContent).toBe(TILL_COPY.empty);
    const desk = container.querySelector("[data-till='desk']") as HTMLAnchorElement;
    expect(desk.tagName).toBe("A");
    expect(desk.getAttribute("href")).toBe(TILL_DESK_HASH);
    expect(desk.textContent).toBe(TILL_COPY.seeEverything);
    expect(container.querySelector("[data-till='waiting']")).toBeNull();
  });

  it("opens Swipe through the 96px control and can render the posted strip first", () => {
    let opened = false;
    renderTill(configuredFund(), {
      onOpenSwipe: () => { opened = true; },
      strip: createElement("div", { className: "swipe-strip", "data-till": "strip" }, SWIPE_COPY.success),
    });
    expect(tillOrder()[0]).toBe("strip");
    expect(container.querySelector(".swipe-open")?.textContent).toBe(SWIPE_COPY.action);
    expect(getComputedStyle(document.documentElement)).toBeDefined();
    expect(readFileSync(resolve(process.cwd(), "src/swipe.css"), "utf8")).toContain("height: 96px");
    act(() => {
      (container.querySelector("[data-till='swipe']") as HTMLButtonElement).click();
    });
    expect(opened).toBe(true);
    expect(appSource).toContain("<Swipe");
    expect(appSource).toContain("tab === \"till\"");
    expect(appSource).toContain("SWIPE_COPY.success");
    expect(appSource).toContain("<Till");
  });

  it("omits Waiting on you when the actor has no actionable motion", () => {
    renderTill(configuredFund(), { memberId: JONATHAN, showSwipe: false });
    expect(container.querySelector("[data-till='waiting']")).toBeNull();
    expect(container.textContent).not.toContain(TILL_COPY.waiting);
    expect(container.querySelector("[data-till='swipe']")).toBeNull();
    expect(container.querySelector("[data-till='custody']")?.textContent).toBe(TILL_COPY.nothingMoved);
  });

  it("lets a non-custodian act on their own proposal without granting swipe", () => {
    renderTill(proposeFromJonathan(configuredFund()), { memberId: JONATHAN, showSwipe: false });
    expect(container.querySelector("[data-till='waiting']")).not.toBeNull();
    expect(container.textContent).toContain("Withdraw proposal");
    expect(container.querySelector("[data-till='swipe']")).toBeNull();
  });

  it("inherits open, Held, released, and withdrawn action availability", () => {
    let household = proposeFromJonathan(configuredFund());
    const proposalId = householdFundContributionMotions(household)[0]!.proposal.id;
    const openForBianca = householdFundMotionActorActions(
      householdFundContributionMotions(household)[0]!,
      BIANCA,
      true,
    );
    expect(openForBianca).toMatchObject({ canConfirm: true, canHold: true, canRelease: false, canWithdraw: false });
    expect(tillActionableMotions(household, BIANCA)).toHaveLength(1);
    expect(tillActionableMotions(household, JONATHAN)).toHaveLength(1);

    household = holdHouseholdFundContribution(household, {
      memberId: BIANCA,
      proposalEventId: proposalId,
      note: "Need the date.",
    }).household;
    const held = householdFundContributionMotions(household)[0]!;
    expect(held.status).toBe("held");
    expect(householdFundMotionActorActions(held, BIANCA, true)).toMatchObject({
      canConfirm: true,
      canHold: false,
      canRelease: true,
      canWithdraw: false,
    });
    expect(householdFundMotionActorActions(held, JONATHAN, false)).toMatchObject({
      canConfirm: false,
      canHold: false,
      canRelease: false,
      canWithdraw: true,
    });

    renderTill(household);
    expect(container.querySelector("[data-till='waiting']")?.textContent).toContain(TILL_COPY.waiting);
    expect(container.textContent).toContain(HOUSEHOLD_FUND_HOLD_COPY.status);
    expect(container.textContent).toContain("Confirm received");
    expect(container.textContent).toContain("Release Hold");

    household = releaseHouseholdFundHold(household, {
      memberId: BIANCA,
      holdEventId: held.activeHold!.id,
    }).household;
    expect(householdFundContributionMotions(household)[0]!.status).toBe("open");

    household = withdrawHouseholdFundContribution(household, {
      memberId: JONATHAN,
      proposalEventId: proposalId,
    }).household;
    expect(householdFundContributionMotions(household)[0]!.status).toBe("withdrawn");
    expect(tillActionableMotions(household, BIANCA)).toHaveLength(0);
    expect(tillActionableMotions(household, JONATHAN)).toHaveLength(0);
  });

  it("changes Fund operating balance only through Confirm, not Hold or release", () => {
    let household = proposeFromJonathan(configuredFund());
    const before = projectHouseholdFund(household, TODAY).operatingBalanceCents;
    const proposalId = householdFundContributionMotions(household)[0]!.proposal.id;
    household = holdHouseholdFundContribution(household, {
      memberId: BIANCA,
      proposalEventId: proposalId,
    }).household;
    expect(projectHouseholdFund(household, TODAY).operatingBalanceCents).toBe(before);
    household = releaseHouseholdFundHold(household, {
      memberId: BIANCA,
      holdEventId: householdFundContributionMotions(household)[0]!.activeHold!.id,
    }).household;
    expect(projectHouseholdFund(household, TODAY).operatingBalanceCents).toBe(before);
    household = confirmHouseholdFundContribution(household, {
      memberId: BIANCA,
      proposalEventId: proposalId,
    }).household;
    expect(projectHouseholdFund(household, TODAY).operatingBalanceCents).toBe(before + 10000);
  });

  it("quotes monthSummary expense actuals including refunds and duplicates", () => {
    let household = buy(configuredFund(), "20.00");
    household = postEntry(household, {
      date: TODAY,
      type: "refund",
      amount: "5.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
      funding: {
        fundId: household.householdFund!.id,
        fundedCents: 500,
        destinationAccountId: "ACC-VISA",
      },
    }).household;
    const expected = monthSummary(scoped(household), monthKeyFromDateKey(TODAY)).expenseActualCents;
    renderTill(household);
    expect(container.querySelector("[data-till='spend']")?.textContent).toBe(TILL_COPY.spent(formatCad(expected)));
    expect(container.querySelector("[data-till='empty']")).toBeNull();
    expect(tillSource).not.toMatch(/projectHouseholdFund|expenseActualCents\s*\+/);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("uses the empty and offline lines without blocking the swipe control", () => {
    renderTill(configuredFund(), { offlinePending: true });
    expect(container.querySelector("[data-till='empty']")?.textContent).toBe(TILL_COPY.empty);
    expect(container.querySelector("[data-till='offline']")?.textContent).toBe(TILL_COPY.offline);
    const swipe = container.querySelector("[data-till='swipe']") as HTMLButtonElement;
    expect(swipe.disabled).toBe(false);
    expect(tillOrder().at(-1)).toBe("desk");
  });

  it("returns through a real focusable see everything link", () => {
    let home = false;
    renderTill(configuredFund(), { onSeeEverything: () => { home = true; } });
    const desk = container.querySelector("[data-till='desk']") as HTMLAnchorElement;
    expect(desk.tabIndex).toBeGreaterThanOrEqual(0);
    act(() => desk.click());
    expect(home).toBe(true);
    expect(appSource).toContain("TILL_HOME_HASH");
    expect(appSource).toContain("TILL_DESK_HASH");
    expect(appSource).toContain("data-till-home-door");
    expect(appSource).toContain("goTab(\"home\")");
  });

  it("fences Ask, routes, workload, models, raw Fund folds, and landing preference", () => {
    expect(tillSource).not.toMatch(/from ["'][^"']*(Ask|askRoutes|ask\.ts)/);
    expect(tillSource).not.toMatch(/Clerk|workload|openai|anthropic|landingSurface/i);
    expect(tillSource).not.toMatch(/camera|ocr|file input/i);
    expect(JSON.stringify({
      waiting: TILL_COPY.waiting,
      nothingMoved: TILL_COPY.nothingMoved,
      empty: TILL_COPY.empty,
      offline: TILL_COPY.offline,
      seeEverything: TILL_COPY.seeEverything,
      homeDoor: TILL_COPY.homeDoor,
      spent: TILL_COPY.spent("$0.00"),
    })).not.toMatch(/lite|simple|basic|denied|rejected|declined|pending|action required|overdue|you should|you need to|pick up a shift|on track|off track|great job|oops|whoops/i);
    expect(tillSource).not.toContain("projectHouseholdFund");
    expect(tillSource).toContain("monthSummary");
    expect(tillSource).toContain("tillActionableMotions");
    expect(appSource).not.toContain("landingSurface");
    expect(experienceSource).not.toContain("landingSurface");
    expect(experienceSource).toContain('"till"');
    expect(experienceSource).not.toContain('return ["home", "calendar", "plan", "more", "till"]');
    expect(appSource).toContain("kitchenPrimaryNav(view).includes(\"home\")");
    expect(appSource).not.toMatch(/kitchenPrimaryNav\(view\)\.includes\("till"\)/);
    expect(fundCore).toContain("tillActionableMotions");
  });

  it("keeps 44px targets and reduced-motion treatment without a default takeover", () => {
    expect(tillCss).toContain("min-height: 44px");
    expect(tillCss).toContain("prefers-reduced-motion");
    expect(appSource).toContain('useState<Tab>("home")');
    expect(appSource).toContain("if (hash === \"till\") setTab(\"till\")");
    expect(appSource).toContain("if (tab !== \"till\")");
    expect(appSource).toContain("setSwipeStrip(null)");
  });
});
