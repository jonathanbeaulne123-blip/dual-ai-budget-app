// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fundContributionReviewDigest } from "../src/core/fundContributionSources.ts";
import {
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  postEntry,
  proposeHouseholdFundContribution,
  type Household,
} from "../src/core/index.ts";
import { TimeMachine } from "../src/timeMachine/TimeMachine.tsx";
import { fabActionsFor } from "../src/core/fabActions.ts";
import { sceneTabFor } from "../src/core/ledgerExperience.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";

function household(): Household {
  let current = configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-07-01",
    createdBy: BIANCA,
  }).household;
  const proposal = proposeHouseholdFundContribution(current, {
    source: { version: 1, kind: "external-received", explanation: "Synthetic test contribution from untracked savings." },
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "800",
    date: "2026-07-03",
  });
  current = proposal.household;
  current = confirmHouseholdFundContribution(current, {
    received: true,
    expectedProposalDigest: fundContributionReviewDigest(current, proposal.postedIds[0]!),
    memberId: BIANCA,
    proposalEventId: proposal.postedIds[0]!,
  }).household;
  current = postEntry(current, {
    date: "2026-07-10",
    type: "expense",
    amount: "120",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy: BIANCA,
    visibility: "household",
    confirmDuplicate: true,
  }).household;
  return current;
}

let host: HTMLDivElement;
const mounted: { root: Root; host: HTMLDivElement }[] = [];

function props(initialPeriod?: string, current: Household = household()) {
  return { household: current, memberId: BIANCA, view: "household" as const, today: TODAY, initialPeriod };
}

function render(initialPeriod?: string): HTMLDivElement {
  const root = createRoot(host);
  mounted.push({ root, host });
  act(() => {
    root.render(createElement(TimeMachine, props(initialPeriod)));
  });
  return host;
}

function click(node: Element | null | undefined): void {
  act(() => {
    (node as HTMLElement | undefined)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  for (const row of mounted.splice(0)) {
    act(() => row.root.unmount());
    row.host.remove();
  }
});

describe("the time machine surface", () => {
  it("opens on the month you are in and says so", () => {
    const page = render();
    expect(page.querySelector("#time-machine-title")?.textContent).toBe("September 2026");
    expect(page.querySelector('.time-machine__chip[data-state="now"]')?.textContent).toBe("Now");
  });

  it("moves the whole page with the ribbon, never half of it", () => {
    const page = render();
    click(page.querySelector('[aria-label="Previous month"]'));
    expect(page.querySelector("#time-machine-title")?.textContent).toBe("August 2026");
    expect(page.querySelector(".time-machine")?.getAttribute("data-time-machine-state")).toBe("behind");
    // The bead the page is showing is the bead that reads as chosen.
    const checked = [...page.querySelectorAll('.time-machine__bead[aria-checked="true"]')];
    expect(checked).toHaveLength(1);
    expect(checked[0]?.textContent).toContain("Aug");
  });

  it("says a month ahead is expected, not posted, and offers no door into the books", () => {
    const page = render();
    click(page.querySelector('[aria-label="Next month"]'));
    expect(page.querySelector(".time-machine")?.getAttribute("data-time-machine-state")).toBe("ahead");
    expect(page.querySelector(".time-machine__state")?.textContent).toContain("Expected, not posted");
  });

  it("carries no control that could post money", () => {
    const page = render();
    for (const pane of ["Compare", "Ahead", "The year", "The month"]) {
      click([...page.querySelectorAll(".time-machine__pane-tab")].find((tab) => tab.textContent === pane));
      expect(page.querySelectorAll("form")).toHaveLength(0);
      expect(page.querySelectorAll('input[inputmode="decimal"]')).toHaveLength(0);
    }
  });

  it("reads a past month's Fund at that month's own close", () => {
    const page = render();
    click(page.querySelector('[aria-label="Previous month"]'));
    click(page.querySelector('[aria-label="Previous month"]'));
    expect(page.querySelector("#time-machine-title")?.textContent).toBe("July 2026");
    expect(page.querySelector(".time-machine__card .time-machine__big")?.textContent).toBe("$800.00");
    expect(page.querySelector(".time-machine__card .time-machine__muted")?.textContent).toContain("when July 2026 ended");
  });

  it("does not put a navigation verb on +; the room borrows the ledger scene (D-247 / row 5)", () => {
    for (const tab of ["ledger", "timeMachine", "home"] as const) {
      const actions = fabActionsFor("household", tab);
      expect(actions.every((row) => row.kind === "add" && row.money)).toBe(true);
      expect(actions.some((row) => row.id === "see-a-month")).toBe(false);
    }
    expect(sceneTabFor("timeMachine")).toBe("ledger");
  });
  it("opens on the month an island door asks for, and ignores a month outside the timeline", () => {
    const page = render("2026-07");
    expect(page.querySelector("#time-machine-title")?.textContent).toBe("July 2026");
    host = document.createElement("div");
    document.body.append(host);
    const far = render("2019-01");
    expect(far.querySelector("#time-machine-title")?.textContent).toBe("September 2026");
  });

  it("applies a new door request once and never snaps the person's scrub back when the timeline changes", () => {
    const page = render("2026-07");
    const { root } = mounted.at(-1)!;
    click(page.querySelector('[aria-label="Next month"]'));
    expect(page.querySelector("#time-machine-title")?.textContent).toBe("August 2026");
    // Same request, a fresh household (so the range is recomputed): the scrub stays.
    act(() => root.render(createElement(TimeMachine, props("2026-07", household()))));
    expect(page.querySelector("#time-machine-title")?.textContent).toBe("August 2026");
    // A new request from the island moves the ribbon, once.
    act(() => root.render(createElement(TimeMachine, props("2026-09"))));
    expect(page.querySelector("#time-machine-title")?.textContent).toBe("September 2026");
    click(page.querySelector('[aria-label="Previous month"]'));
    act(() => root.render(createElement(TimeMachine, props("2026-09", household()))));
    expect(page.querySelector("#time-machine-title")?.textContent).toBe("August 2026");
  });
});
