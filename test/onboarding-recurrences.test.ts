// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  addAccount,
  addRecurrence,
  catalogHousehold,
  chapterById,
  compileHousehold,
  evidenceFor,
  onboardingRecurrencePauseDue,
  onboardingRecurrenceProbe,
  recordChapterAcknowledgement,
  type Household,
} from "../src/core/index.ts";
import { repeatingConfirmSummary } from "../src/RepeatingForm.tsx";
import { CalendarPage } from "../src/Calendar.tsx";

const BIANCA = "MEM-001";
const TODAY = "2026-09-04";

function addRegularExpense(
  household: Household,
  input: { note: string; amount: string; subcategoryId: string; accountId?: string },
): Household {
  return addRecurrence(household, {
    cadence: "monthly",
    nextDate: TODAY,
    type: "expense",
    amount: input.amount,
    accountId: input.accountId ?? "ACC-CHEQUING",
    subcategoryId: input.subcategoryId,
    note: input.note,
    origin: "manual",
  }).household;
}

function readyHousehold(): Household {
  let household = catalogHousehold("development");
  household = addRegularExpense(household, {
    note: "Rent",
    amount: "1850",
    subcategoryId: "SUB-HOUSING-RENT",
  });
  household = addRegularExpense(household, {
    note: "Toronto Hydro",
    amount: "95",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
  });
  return household;
}

describe("onboarding Chapter 7 regular money", () => {
  it("requires rent or an equivalent plus one other valid Shared standing fact", () => {
    let household = catalogHousehold("development");
    expect(onboardingRecurrenceProbe(household)).toMatchObject({ complete: false, rows: [] });

    household = addRegularExpense(household, {
      note: "Rent",
      amount: "1850",
      subcategoryId: "SUB-HOUSING-RENT",
    });
    expect(onboardingRecurrenceProbe(household)).toMatchObject({
      complete: false,
      missing: ["another-recurrence"],
    });

    household = addRegularExpense(household, {
      note: "Phone",
      amount: "95",
      subcategoryId: "SUB-LIFE-PHONE",
    });
    expect(onboardingRecurrenceProbe(household)).toMatchObject({
      complete: true,
      missing: [],
    });
  });

  it("does not let two non-housing recurrences or Personal data satisfy the household gate", () => {
    let household = catalogHousehold("development");
    household = addRegularExpense(household, {
      note: "Phone",
      amount: "95",
      subcategoryId: "SUB-LIFE-PHONE",
    });
    household = addRegularExpense(household, {
      note: "Toronto Hydro",
      amount: "95",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
    });
    const personal = addAccount(household, {
      name: "Bianca private bills",
      kind: "chequing",
      scope: "personal",
      ownerMemberId: BIANCA,
    });
    household = addRegularExpense(personal.household, {
      note: "Rent",
      amount: "900",
      subcategoryId: "SUB-HOUSING-RENT",
      accountId: personal.postedIds[0],
    });

    const probe = onboardingRecurrenceProbe(household);
    expect(probe.complete).toBe(false);
    expect(probe.rows.map((row) => row.note)).toEqual(expect.arrayContaining(["Phone", "Toronto Hydro"]));
    expect(evidenceFor(household, "ch-07-recurrences", BIANCA)).toEqual({ kind: "empty" });
  });

  it("projects household-scoped label, cadence, amount, and next date for every accepted row", () => {
    const result = evidenceFor(readyHousehold(), "ch-07-recurrences", BIANCA);
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") throw new Error("Expected accepted Chapter 7 evidence.");
    expect(result.card).toMatchObject({ scope: "household", kind: "recurrence" });
    expect(result.card.lines).toHaveLength(2);
    expect(result.card.lines).toEqual(expect.arrayContaining([
      { label: "Rent", value: "Monthly · $1850.00 · next 2026-09-04" },
      { label: "Toronto Hydro", value: "Monthly · $95.00 · next 2026-09-04" },
    ]));
  });

  it("acknowledges existing evidence without adding a row or posting an occurrence", () => {
    const household = readyHousehold();
    const recurrencesBefore = structuredClone(household.recurrences);
    const transactionsBefore = structuredClone(household.transactions);
    const journalBefore = compileHousehold(household).entries;

    const accepted = recordChapterAcknowledgement(household, {
      memberId: BIANCA,
      chapterId: "ch-07-recurrences",
      createdBy: BIANCA,
      at: "2026-09-04T12:00:00.000Z",
    });

    expect(accepted.postedIds).toEqual([]);
    expect(accepted.household.recurrences).toEqual(recurrencesBefore);
    expect(accepted.household.transactions).toEqual(transactionsBefore);
    expect(compileHousehold(accepted.household).entries).toEqual(journalBefore);
  });

  it("blocks acknowledgement until the live household evidence is complete", () => {
    expect(() => recordChapterAcknowledgement(catalogHousehold("development"), {
      memberId: BIANCA,
      chapterId: "ch-07-recurrences",
      createdBy: BIANCA,
      at: "2026-09-04T12:00:00.000Z",
    })).toThrow(/rent or its equivalent and one other valid Shared recurrence/i);
  });

  it("explains the three money states and makes the chapter save summary post-free", () => {
    const draft = {
      cadence: "monthly" as const,
      nextDate: TODAY,
      type: "expense" as const,
      amount: "1850",
      accountId: "ACC-CHEQUING",
      transferToAccountId: "",
      goalId: "",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Rent",
      kind: "bill" as const,
      kindLocked: true,
      useHouseholdFund: false,
      fundAmount: "",
      fundDestinationAccountId: "ACC-CHEQUING",
    };
    const summary = repeatingConfirmSummary(draft, { standingFactOnly: true });
    expect(summary).toContain("standing fact");
    expect(summary).toContain("does not post an occurrence or move money");
    expect(summary).not.toContain("choose to post below");
  });

  it("renders the real Calendar and form in standing-fact mode without posting affordances", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(CalendarPage, {
        household: readyHousehold(),
        today: TODAY,
        environment: "development",
        memberId: BIANCA,
        busy: false,
        onboardingStandingFactOnly: true,
        onCommand: () => undefined,
        onAskPost: () => undefined,
        onAskPostDue: () => undefined,
        onAskSaveRepeating: () => undefined,
        onAskVisit: () => undefined,
        onAskSettle: () => undefined,
        onAskWriteOff: () => undefined,
        onAskStartJar: () => undefined,
        onOpenPlan: () => undefined,
        onOpenShiftEnvelope: () => undefined,
      }));
    });

    const bills = [...host.querySelectorAll("button")].find((button) => button.textContent === "Bills");
    await act(async () => bills?.click());
    expect(host.textContent).toContain("A reminder helps you remember");
    expect(host.textContent).toContain("The two anchors are here");
    expect(host.textContent).not.toContain("Mark paid");
    expect(host.textContent).not.toContain("Mark due paid");
    expect(host.textContent).not.toContain("Skip once");

    const add = [...host.querySelectorAll("button")].find((button) => button.textContent === "Add a standing fact");
    await act(async () => add?.click());
    expect(host.textContent).toContain("Add regular money");
    expect(host.textContent).toContain("Standing fact, not a post");
    expect(host.textContent).toContain("doesn't post an occurrence or move money");

    await act(async () => root.unmount());
    host.remove();
  });

  it("uses the manual's six-minute target and pause after each third recurrence", () => {
    expect(chapterById("ch-07-recurrences")).toMatchObject({
      timeBudgetSeconds: 360,
      pausePoints: ["every-third-recurrence"],
    });
    expect(onboardingRecurrencePauseDue(2)).toBe(false);
    expect(onboardingRecurrencePauseDue(3)).toBe(true);
    expect(onboardingRecurrencePauseDue(6)).toBe(true);
  });

  it("keeps the chapter projector pure and unable to import or invoke posting", () => {
    const projector = readFileSync("src/core/onboarding/recurrences.ts", "utf8");
    const evidence = readFileSync("src/core/onboarding/evidence.ts", "utf8");
    const calendar = readFileSync("src/Calendar.tsx", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");

    expect(projector).not.toMatch(/postOneRecurrence|document|window|\.tsx/);
    expect(evidence).not.toMatch(/document|window|\.tsx/);
    expect(calendar).toContain("due.length > 0 && !props.onboardingStandingFactOnly");
    expect(calendar).toContain("due && !props.standingFactOnly");
    expect(app).toContain("const postFirst = onboardingStandingFactOnly ? false");
    expect(app).toContain("option={onboardingStandingFactOnly ? undefined");
    expect(app).toContain("if (onboardingStandingFactOnly) return;");
  });
});
