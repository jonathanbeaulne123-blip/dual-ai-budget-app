// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { CharterFounding } from "../src/CharterFounding.tsx";
import {
  catalogHousehold,
  CHARTER_FOUNDING_COPY,
  commitCharterFounding,
  emptyCharterFoundingDraft,
  emptyHousehold,
  householdNeedsCharterFounding,
  postEntry,
  skipCharterFoundingStep,
} from "../src/core/index.ts";
import type { Household } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";

describe("charter founding conversation", () => {
  it("walks the answered draft through foundHouseholdCharter and grants the named permission", () => {
    const draft = emptyCharterFoundingDraft(catalogHousehold());
    draft.purpose = "The roof, the cat, and one week away a year.";
    draft.splitRule = "remainder";
    draft.splitNote = "Bianca puts in what she can spare. I make up the difference.";
    draft.cadence = "weekly";
    draft.cadenceWeekday = 0;
    draft.ceilingKind = "hours-per-week";
    draft.ceilingHours = "24";

    const result = commitCharterFounding(catalogHousehold(), {
      memberId: JONATHAN,
      today: DATE,
      draft,
    });

    expect(result.household.charter).toMatchObject({
      purpose: "The roof, the cat, and one week away a year.",
      custodianMemberId: BIANCA,
      splitRule: "remainder",
      splitNote: "Bianca puts in what she can spare. I make up the difference.",
      ceilingKind: "hours-per-week",
      ceilingValue: 240,
      cadence: "weekly",
      cadenceWeekday: 0,
    });
    expect(result.household.charter?.signatures.every((row) => row.signedAt === null)).toBe(true);
    expect(result.household.charter?.permissions).toEqual([
      expect.objectContaining({
        label: "Bianca can spend from the Fund on anything we've already agreed is a household bill.",
        grantedByMemberId: JONATHAN,
        actorMemberId: BIANCA,
        revokedAt: null,
      }),
    ]);
  });

  it("still founds when every step is skipped", () => {
    let draft = emptyCharterFoundingDraft(catalogHousehold());
    for (let step = 0; step < 5; step += 1) draft = skipCharterFoundingStep(draft, step);
    const result = commitCharterFounding(catalogHousehold(), {
      memberId: JONATHAN,
      today: DATE,
      draft,
    });
    expect(result.household.charter).toMatchObject({
      purpose: "",
      splitRule: "remainder",
      splitNote: "",
      ceilingKind: "none",
      ceilingValue: 0,
      cadence: "none",
      permissions: [],
    });
  });

  it("takes over only an empty household, not the catalog demo", () => {
    expect(householdNeedsCharterFounding(catalogHousehold())).toBe(false);
    const empty = catalogHousehold();
    empty.householdFund = null;
    empty.transactions = [];
    empty.fundEvents = [];
    empty.accounts = [];
    empty.charter = null;
    expect(householdNeedsCharterFounding(empty)).toBe(true);
  });

  it("founds an empty household with members and no CAD accounts, and still refuses money posts", () => {
    const empty = emptyHousehold("development");
    empty.members = [
      { id: BIANCA, name: "Bianca", color: "#c45c26", active: true, updatedAt: "2026-09-01T00:00:00.000Z" },
      { id: JONATHAN, name: "Jonathan", color: "#2f6b4f", active: true, updatedAt: "2026-09-01T00:00:00.000Z" },
    ];
    expect(householdNeedsCharterFounding(empty)).toBe(true);
    let draft = emptyCharterFoundingDraft(empty);
    for (let step = 0; step < 5; step += 1) draft = skipCharterFoundingStep(draft, step);
    const result = commitCharterFounding(empty, {
      memberId: JONATHAN,
      today: DATE,
      draft,
    });
    expect(result.household.charter?.splitRule).toBe("remainder");
    expect(result.household.accounts).toHaveLength(0);
    expect(() => postEntry(result.household, {
      date: DATE,
      type: "expense",
      amount: "12.00",
      accountId: "ACC-MISSING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "milk",
      createdBy: JONATHAN,
    })).toThrow();
  });

  it("renders the ceiling question and never shows a dollar figure or step count", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let household: Household = catalogHousehold();
    household.householdFund = null;
    household.transactions = [];
    household.fundEvents = [];
    household.charter = null;

    act(() => {
      root.render(createElement(CharterFounding, {
        household,
        memberId: JONATHAN,
        today: DATE,
        onCommit: (fn) => {
          household = fn(household).household;
        },
        onDismiss: () => {},
      }));
    });
    expect(host.textContent).toContain("What is this money for?");
    expect(host.textContent).not.toContain("Step 2 of 5");
    expect(host.textContent).not.toMatch(/\$\d/);

    for (let i = 0; i < 4; i += 1) {
      const next = [...host.querySelectorAll("button")].find((button) => button.textContent === "Next");
      expect(next).toBeTruthy();
      act(() => next!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }
    expect(host.textContent).toContain(CHARTER_FOUNDING_COPY.q5);
    expect(host.textContent).toContain("How much work is too much?");
    act(() => root.unmount());
    host.remove();
  });

  it("marks the selected split card as pressed", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const household = catalogHousehold();

    act(() => {
      root.render(createElement(CharterFounding, {
        household,
        memberId: JONATHAN,
        today: DATE,
        onCommit: () => {},
        onDismiss: () => {},
      }));
    });
    const next = [...host.querySelectorAll("button")].find((button) => button.textContent === "Next");
    act(() => next!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const remainder = [...host.querySelectorAll("button")].find((button) => (
      button.textContent?.includes("One of us covers what's left")
    ));
    expect(remainder?.getAttribute("aria-pressed")).toBe("false");
    act(() => remainder!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(remainder?.getAttribute("aria-pressed")).toBe("true");
    act(() => root.unmount());
    host.remove();
  });

  it("keeps the no-ratio fence and the ceiling copy in the flow source", () => {
    const source = readFileSync(join(process.cwd(), "src/CharterFounding.tsx"), "utf8");
    const helper = readFileSync(join(process.cwd(), "src/core/charterFounding.ts"), "utf8");
    const commands = readFileSync(join(process.cwd(), "src/core/commands.ts"), "utf8");
    expect(helper).toContain("How much work is too much?");
    expect(source).toContain("CHARTER_FOUNDING_COPY.q5");
    expect(source).not.toMatch(/\bpercent\b/i);
    expect(source).not.toMatch(/\bratio\b/i);
    expect(helper).not.toMatch(/\bpercent\b/i);
    expect(helper).not.toMatch(/\bratio\b/i);
    expect(commands).toContain("if (isLedgerWrite({ postedIds }))");
    expect(commands).toContain("requireCadAccounts(next);");
  });
});
