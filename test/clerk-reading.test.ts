import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  postEntry,
  proposeHouseholdFundContribution,
} from "../src/core/index.ts";
import { clerkReading } from "../src/core/clerkReading.ts";
import * as sharedLedgerStory from "../src/core/sharedLedgerStory.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const SINCE = "2026-09-01";
const TODAY = "2026-09-04";

function canonicalMonth() {
  let household = configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: SINCE,
    createdBy: BIANCA,
  }).household;
  const confirmed = proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "150",
    date: "2026-09-02",
  });
  const confirmation = confirmHouseholdFundContribution(confirmed.household, {
    memberId: BIANCA,
    proposalEventId: confirmed.postedIds[0]!,
  });
  household = confirmation.household;
  const expense = postEntry(household, {
    date: "2026-09-03",
    type: "expense",
    amount: "120",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy: JONATHAN,
    visibility: "household",
    confirmDuplicate: true,
    funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 12000, destinationAccountId: "ACC-VISA" },
  });
  const waiting = proposeHouseholdFundContribution(expense.household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "40",
    date: TODAY,
  });
  return {
    household: waiting.household,
    expenseId: expense.postedIds[0]!,
    confirmationId: confirmation.postedIds[0]!,
    waitingId: waiting.postedIds[0]!,
  };
}

describe("clerk reading", () => {
  it("returns only cited rows from the canonical month", () => {
    const scenario = canonicalMonth();
    const reading = clerkReading(scenario.household, SINCE, TODAY);
    expect(reading.tiesToProjection).toBe(true);
    expect(reading.sentences).toEqual([
      {
        id: "expenses",
        text: "Since 2026-09-01, 1 expense row totalled $120.00.",
        transactionIds: [scenario.expenseId],
        fundEventIds: [],
      },
      {
        id: "confirmed-contributions",
        text: "$150.00 was confirmed into the Household Fund.",
        transactionIds: [],
        fundEventIds: [scenario.confirmationId],
      },
      {
        id: "waiting-motion",
        text: "1 contribution motion is waiting in the record.",
        transactionIds: [],
        fundEventIds: [scenario.waitingId],
      },
    ]);
  });

  it("drops every candidate without a cited row", () => {
    const reading = clerkReading(catalogHousehold(), SINCE, TODAY);
    expect(reading.sentences).toEqual([]);
    expect(reading.sentences.every((row) => row.transactionIds.length + row.fundEventIds.length >= 1)).toBe(true);
  });

  it("withholds the reading when the existing conservation guard does not tie", () => {
    const guard = vi.spyOn(sharedLedgerStory, "sharedMonthCourse").mockReturnValue({ tiesToProjection: false } as ReturnType<typeof sharedLedgerStory.sharedMonthCourse>);
    expect(clerkReading(canonicalMonth().household, SINCE, TODAY)).toMatchObject({
      tiesToProjection: false,
      sentences: [],
    });
    guard.mockRestore();
  });

  it("keeps the clerk as a record reader", () => {
    const source = readFileSync(new URL("../src/core/clerkReading.ts", import.meta.url), "utf8").toLowerCase();
    for (const forbidden of ["should move", "you should", "recommend", "shift", "hours", "work more"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
