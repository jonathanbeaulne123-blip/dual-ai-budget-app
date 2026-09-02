// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WeeklyDocument } from "../src/WeeklyDocument.tsx";
import {
  HOUSEHOLD_FUND_ID,
  WEEKLY_DOCUMENT_COPY,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  foundHouseholdCharter,
  proposeHouseholdFundContribution,
  stampWeeklyDocument,
  type CommitResult,
  type Household,
  type UndoToken,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const WEDNESDAY = "2026-09-02";
const FORBIDDEN = /governance|lite|simple mode|basic|denied|rejected|declined|pending|action required|overdue|you should|you need to|pick up a shift|budget variance|on track|off track|great job|oops|whoops|waiting for/i;

const css = [
  readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8"),
  readFileSync(resolve(process.cwd(), "src/clerk-reading.css"), "utf8"),
  readFileSync(resolve(process.cwd(), "src/weekly-document.css"), "utf8"),
].join("\n");
const weeklySource = readFileSync(resolve(process.cwd(), "src/WeeklyDocument.tsx"), "utf8");
const sitDownSource = readFileSync(resolve(process.cwd(), "src/SitDownGuide.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

let root: Root;
let container: HTMLDivElement;
let styleTag: HTMLStyleElement;

function weeklyHousehold(): Household {
  let household = configureHouseholdFund(catalogHousehold("development"), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
  household = foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady.",
    splitRule: "remainder",
    splitNote: "Bianca's pay covers what it covers.",
    ceilingKind: "none",
    cadence: "weekly",
    cadenceWeekday: 3,
    date: "2026-09-01",
  }).household;
  household = addRecurrence(household, {
    cadence: "monthly",
    nextDate: "2026-09-20",
    type: "expense",
    amount: "40",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note: "Phone",
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
  const goal = addGoal(household, { name: "Halifax", target: "300", shared: true, ownerMemberId: BIANCA });
  household = addRecurrence(goal.household, {
    cadence: "monthly",
    nextDate: "2026-09-30",
    type: "transfer",
    amount: "300",
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!,
    note: "Standing · jar · Halifax",
  }).household;
  return proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "40",
    date: WEDNESDAY,
  }).household;
}

function noneCadence(): Household {
  const household = configureHouseholdFund(catalogHousehold("development"), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
  return foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady.",
    splitRule: "remainder",
    splitNote: "Bianca's pay covers what it covers.",
    ceilingKind: "none",
    cadence: "none",
    date: "2026-09-01",
  }).household;
}

function StatefulWeekly({
  initial,
  viewerMemberId,
  householdRef,
  surface = "ready",
}: {
  initial: Household;
  viewerMemberId: string;
  householdRef: { current: Household };
  surface?: "ready" | "loading" | "error" | "offline";
}) {
  const [household, setHousehold] = useState(initial);
  householdRef.current = household;
  return createElement(WeeklyDocument, {
    household,
    viewerMemberId,
    today: WEDNESDAY,
    now: "2026-09-02T16:00:00.000Z",
    surface,
    onApply: (next: Household, _undo?: UndoToken) => {
      householdRef.current = next;
      setHousehold(next);
    },
  });
}

function renderWeekly(
  household: Household,
  viewerMemberId: string,
  onApply: (next: Household, undo?: UndoToken) => void = () => undefined,
  surface: "ready" | "loading" | "error" | "offline" = "ready",
) {
  act(() => {
    root.render(createElement(WeeklyDocument, {
      household,
      viewerMemberId,
      today: WEDNESDAY,
      now: "2026-09-02T16:00:00.000Z",
      surface,
      onApply,
    }));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  container.style.width = "320px";
  document.body.appendChild(container);
  root = createRoot(container);
  styleTag = document.createElement("style");
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  styleTag.remove();
});

describe("weekly document presentation", () => {
  it("stamps only the viewer's line and leaves the partner line blank", () => {
    const householdRef = { current: weeklyHousehold() };
    act(() => {
      root.render(createElement(StatefulWeekly, {
        initial: householdRef.current,
        viewerMemberId: JONATHAN,
        householdRef,
      }));
    });
    const own = container.querySelector(`[data-weekly-stamp-line="${JONATHAN}"] button`) as HTMLButtonElement;
    const partner = container.querySelector(`[data-weekly-stamp-line="${BIANCA}"] button`);
    expect(own?.textContent).toBe(WEEKLY_DOCUMENT_COPY.stamp);
    expect(partner).toBeNull();
    act(() => own.click());
    expect(container.querySelector(".weekly-document")?.getAttribute("data-weekly-complete")).toBe("true");
    expect(container.querySelector(`[data-weekly-stamp-line="${JONATHAN}"] button`)).toBeNull();
    expect(container.querySelector(`[data-weekly-stamp-line="${BIANCA}"] button`)).toBeNull();
    const partnerViewLog: CommitResult[] = [];
    renderWeekly(householdRef.current, BIANCA, (next, undo) => {
      partnerViewLog.push({ household: next, warnings: [], undo: undo!, postedIds: undo?.postedIds ?? [] });
    });
    const biancaStamp = container.querySelector(`[data-weekly-stamp-line="${BIANCA}"] button`);
    const jonathanStamp = container.querySelector(`[data-weekly-stamp-line="${JONATHAN}"] button`);
    expect(biancaStamp).toBeTruthy();
    expect(jonathanStamp).toBeNull();
    expect(partnerViewLog).toEqual([]);
  });

  it("keeps partner-work facts out of the custodian DOM and serialized markup", () => {
    renderWeekly(weeklyHousehold(), BIANCA);
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    const markup = container.innerHTML;
    expect(markup).toContain("Or move Halifax to next month, and the ask is $40.00.");
    expect(markup).toContain(WEEKLY_DOCUMENT_COPY.otherDoorNote);
    expect(markup).not.toContain("data-weekly-routes");
    expect(markup).not.toMatch(/watchedShifts|safeCents|expectedCents/);
    expect(markup).not.toMatch(/\b\d+(\.\d+)?h\b/);
    expect(container.querySelector("[data-weekly-other-door='readonly']")).toBeTruthy();
  });

  it("shows the Ask owner the other door and a not-enough-data route refusal", () => {
    renderWeekly(weeklyHousehold(), JONATHAN);
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("Or move Halifax to next month, and the ask is $40.00.");
    expect(container.querySelector("[data-weekly-routes='not-enough-data']")?.textContent).toMatch(/I've only watched/);
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it("renders no offer when cadence is none", () => {
    renderWeekly(noneCadence(), JONATHAN);
    expect(container.querySelector(".weekly-document")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("preserves Clerk citation states and register/motion copy without ranking", () => {
    renderWeekly(weeklyHousehold(), JONATHAN);
    expect(container.querySelector("[data-clerk-state]")).toBeTruthy();
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    expect(container.textContent).not.toMatch(/%|ratio|ranking|share of/);
    expect(container.querySelector(".weekly-unfunded")).toBeTruthy();
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    expect(container.querySelector("[data-weekly-motion-status='open']")).toBeTruthy();
    expect(container.textContent).toContain("open");
  });

  it("keeps empty-motion, loading, error, offline, and untied states readable", () => {
    const empty = foundHouseholdCharter(configureHouseholdFund(catalogHousehold("development"), {
      custodianMemberId: BIANCA,
      openedOn: "2026-09-01",
      createdBy: BIANCA,
    }).household, {
      memberId: JONATHAN,
      custodianMemberId: BIANCA,
      purpose: "Keep the household steady.",
      splitRule: "remainder",
      splitNote: "Bianca's pay covers what it covers.",
      ceilingKind: "none",
      cadence: "weekly",
      cadenceWeekday: 3,
      date: "2026-09-01",
    }).household;
    renderWeekly(empty, JONATHAN);
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector(".primary") as HTMLButtonElement).click();
    });
    expect(container.querySelector("[data-weekly-motions='empty']")?.textContent).toBe(WEEKLY_DOCUMENT_COPY.emptyMotions);
    renderWeekly(weeklyHousehold(), JONATHAN, undefined, "loading");
    expect(container.querySelector("[role='status']")?.textContent).toBe(WEEKLY_DOCUMENT_COPY.loading);
    renderWeekly(weeklyHousehold(), JONATHAN, undefined, "error");
    expect(container.querySelector("[role='status']")?.textContent).toBe(WEEKLY_DOCUMENT_COPY.error);
    renderWeekly(weeklyHousehold(), JONATHAN, undefined, "offline");
    expect(container.querySelector("[role='status']")?.textContent).toBe(WEEKLY_DOCUMENT_COPY.offline);
    expect(container.querySelector("[data-weekly-stamp-line]")).toBeTruthy();
  });

  it("keeps keyboard-sized controls at 320px and does not reuse monthly sit-down acts", () => {
    renderWeekly(weeklyHousehold(), JONATHAN);
    const stamp = container.querySelector(".weekly-stamp-link") as HTMLButtonElement;
    const next = container.querySelector(".primary") as HTMLButtonElement;
    expect(stamp.tagName).toBe("BUTTON");
    expect(getComputedStyle(stamp).minHeight).toBe("44px");
    expect(getComputedStyle(next).minHeight).toBe("44px");
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 1);
    expect(sitDownSource).toContain("useState<1 | 2 | 3>");
    expect(weeklySource).not.toContain("saveSitDownSession");
    expect(weeklySource).not.toContain("SitDownSession");
    expect(weeklySource).toContain("memberId: viewerMemberId");
    expect(weeklySource).not.toContain("place");
    expect(appSource).toContain("actingMemberId: memberId");
    window.matchMedia = ((query: string) => ({
      matches: String(query).includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    })) as typeof window.matchMedia;
    renderWeekly(weeklyHousehold(), JONATHAN);
    expect(container.querySelector(".weekly-document")).toBeTruthy();
    expect(getComputedStyle(container.querySelector(".weekly-document")!).transition).toMatch(/none|^$/);
  });

  it("does not let stamping rewrite a partner line from the component", () => {
    const household = weeklyHousehold();
    const partnerStamp = stampWeeklyDocument(household, {
      memberId: BIANCA,
      today: WEDNESDAY,
      now: "2026-09-02T16:00:00.000Z",
    });
    renderWeekly(partnerStamp.household, JONATHAN);
    expect(container.querySelector(`[data-weekly-stamp-line="${BIANCA}"] button`)).toBeNull();
    const own = container.querySelector(`[data-weekly-stamp-line="${JONATHAN}"] button`);
    expect(own).toBeTruthy();
  });
});
