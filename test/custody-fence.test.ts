import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  HOUSEHOLD_PURCHASE_CUSTODY_REFUSAL,
  catalogHousehold,
  configureHouseholdFund,
  postEntry,
  postShift,
  projectHouseholdFund,
  proposeHouseholdFundContribution,
  reversePostedMoney,
  ValidationError,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";
const commandsSource = readFileSync(new URL("../src/core/commands.ts", import.meta.url), "utf8");

function configuredFund() {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: DATE,
    createdBy: BIANCA,
  }).household;
}

function purchaseInput(createdBy: string) {
  return {
    date: "2026-09-02",
    type: "expense" as const,
    amount: "40",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy,
    visibility: "household" as const,
    confirmDuplicate: true,
    funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" },
  };
}

describe("Till Slice 1 custody fence", () => {
  it("lets the custodian record a Fund-backed purchase", () => {
    const posted = postEntry(configuredFund(), purchaseInput(BIANCA));
    expect(posted.household.fundEvents?.some((event) => event.kind === "purchase-funded" && event.amountCents === 4000)).toBe(true);
    expect(posted.household.transactions.some((row) => row.id === posted.postedIds[0])).toBe(true);
  });

  it("refuses a non-custodian before any clone or mutation", () => {
    const household = configuredFund();
    const before = structuredClone(household);
    expect(() => postEntry(household, purchaseInput(JONATHAN))).toThrow(ValidationError);
    try {
      postEntry(household, purchaseInput(JONATHAN));
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as Error).message).toBe(HOUSEHOLD_PURCHASE_CUSTODY_REFUSAL);
    }
    expect(household).toEqual(before);
    expect(household.transactions).toHaveLength(before.transactions.length);
    expect(household.fundEvents ?? []).toHaveLength(before.fundEvents?.length ?? 0);
  });

  it("leaves contribution proposals and shifts unfenced", () => {
    const household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "25",
      date: DATE,
    });
    expect(proposal.postedIds.length).toBeGreaterThan(0);
    const shift = postShift(proposal.household, {
      date: "2026-09-03",
      memberId: JONATHAN,
      accountId: "ACC-CASH",
      sales: "100",
      cashTips: "10",
      ccTips: "5",
      hours: "4",
      customersServed: 40,
      staffingCount: 1,
      createdBy: JONATHAN,
      confirmDuplicate: true,
    });
    expect(shift.household.shifts.some((row) => row.memberId === JONATHAN)).toBe(true);
  });

  it("keeps ordinary refunds and purchase reversals refund-funded without a new fence", () => {
    const purchase = postEntry(configuredFund(), purchaseInput(BIANCA));
    const refund = postEntry(purchase.household, {
      date: "2026-09-04",
      type: "refund",
      amount: "10",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      refundOfId: purchase.postedIds[0],
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
    });
    expect(refund.household.fundEvents?.at(-1)?.kind).toBe("refund-funded");
    const reversedPurchase = reversePostedMoney(purchase.household, purchase.postedIds[0]!, { createdBy: JONATHAN });
    expect(reversedPurchase.household.fundEvents?.at(-1)?.kind).toBe("refund-funded");
  });

  it("treats reversing a refund as a custodian-only purchase-funded restore", () => {
    const purchase = postEntry(configuredFund(), purchaseInput(BIANCA));
    const refund = postEntry(purchase.household, {
      date: "2026-09-04",
      type: "refund",
      amount: "10",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      refundOfId: purchase.postedIds[0],
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    });
    const refundTxId = refund.postedIds[0]!;
    expect(refund.household.fundEvents?.at(-1)?.kind).toBe("refund-funded");
    expect(() => reversePostedMoney(refund.household, refundTxId, { createdBy: JONATHAN })).toThrow(HOUSEHOLD_PURCHASE_CUSTODY_REFUSAL);
    const restored = reversePostedMoney(refund.household, refundTxId, { createdBy: BIANCA });
    expect(restored.household.fundEvents?.at(-1)?.kind).toBe("purchase-funded");
  });

  it("does not change Fund operating balance when a purchase claim is posted", () => {
    const household = configuredFund();
    const before = projectHouseholdFund(household, "2026-09-02").operatingBalanceCents;
    const posted = postEntry(household, purchaseInput(BIANCA));
    expect(projectHouseholdFund(posted.household, "2026-09-02").operatingBalanceCents).toBe(before);
  });

  it("keeps the purchase-funded guard in postEntry before cloning", () => {
    const start = commandsSource.indexOf("export function postEntry");
    const end = commandsSource.indexOf("export function postOpeningBalances");
    const postEntrySource = commandsSource.slice(start, end);
    expect(postEntrySource).toContain("requireFundCustodian");
    expect(postEntrySource).toContain("HOUSEHOLD_PURCHASE_CUSTODY_REFUSAL");
    expect(postEntrySource.indexOf("requireFundCustodian")).toBeLessThan(postEntrySource.indexOf("cloneHousehold"));
    expect(postEntrySource.indexOf("householdFundEventKindForPost")).toBeLessThan(postEntrySource.indexOf("cloneHousehold"));
  });
});
