import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  ValidationError,
  catalogHousehold,
  configureHouseholdFund,
  postEntry,
  postShift,
  proposeHouseholdFundContribution,
  reversePostedMoney,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const REFUSAL = "Only the person holding the card can post a household purchase.";

function configuredFund() {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

function fundPurchase(createdBy: string) {
  return {
    date: "2026-09-02",
    type: "expense" as const,
    amount: "40",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy,
    visibility: "household" as const,
    confirmDuplicate: true,
    funding: {
      fundId: HOUSEHOLD_FUND_ID,
      fundedCents: 4000,
      destinationAccountId: "ACC-VISA",
    },
  };
}

describe("Till slice 1 custody fence", () => {
  it("allows the Fund custodian to post a Household Fund purchase", () => {
    const posted = postEntry(configuredFund(), fundPurchase(BIANCA));

    expect(posted.household.fundEvents?.at(-1)).toMatchObject({
      kind: "purchase-funded",
      createdBy: BIANCA,
      amountCents: 4000,
    });
  });

  it("refuses a non-custodian before any transaction or Fund event is created", () => {
    const household = configuredFund();
    const before = structuredClone(household);

    expect(() => postEntry(household, fundPurchase(JONATHAN))).toThrow(ValidationError);
    expect(() => postEntry(household, fundPurchase(JONATHAN))).toThrow(REFUSAL);
    expect(household).toEqual(before);
  });

  it("keeps contribution proposals and shift posting available to the non-custodian", () => {
    const proposal = proposeHouseholdFundContribution(configuredFund(), {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "25",
      date: "2026-09-02",
    });
    const shift = postShift(proposal.household, {
      date: "2026-09-03",
      memberId: JONATHAN,
      accountId: "ACC-CHEQUING",
      hours: "1",
      sales: "0",
      cashTips: "0",
      ccTips: "0",
      createdBy: JONATHAN,
      visibility: "personal",
      confirmDuplicate: true,
    });

    expect(proposal.household.fundEvents?.at(-1)).toMatchObject({
      kind: "contribution-proposed",
      contributorMemberId: JONATHAN,
    });
    expect(shift.household.shifts.at(-1)).toMatchObject({ memberId: JONATHAN });
  });

  it("does not fence refund-funded corrections", () => {
    const purchase = postEntry(configuredFund(), fundPurchase(BIANCA));
    const purchaseId = purchase.postedIds[0]!;
    const refunded = postEntry(purchase.household, {
      ...fundPurchase(JONATHAN),
      date: "2026-09-03",
      type: "refund",
      refundOfId: purchaseId,
      funding: undefined,
    });
    const reversed = reversePostedMoney(purchase.household, purchaseId, {
      createdBy: JONATHAN,
      visibility: "household",
      reversalDate: "2026-09-04",
    });

    expect(refunded.household.fundEvents?.at(-1)).toMatchObject({
      kind: "refund-funded",
      createdBy: JONATHAN,
    });
    expect(reversed.household.fundEvents?.at(-1)).toMatchObject({
      kind: "refund-funded",
      createdBy: JONATHAN,
    });
  });

  it("fences a refund reversal because it restores a purchase-funded position", () => {
    const purchase = postEntry(configuredFund(), fundPurchase(BIANCA));
    const refunded = postEntry(purchase.household, {
      ...fundPurchase(BIANCA),
      date: "2026-09-03",
      type: "refund",
      refundOfId: purchase.postedIds[0]!,
      funding: undefined,
    });
    const refundId = refunded.postedIds[0]!;
    const before = structuredClone(refunded.household);

    expect(() => reversePostedMoney(refunded.household, refundId, {
      createdBy: JONATHAN,
      visibility: "household",
      reversalDate: "2026-09-04",
    })).toThrow(REFUSAL);
    expect(refunded.household).toEqual(before);

    const restored = reversePostedMoney(refunded.household, refundId, {
      createdBy: BIANCA,
      visibility: "household",
      reversalDate: "2026-09-04",
    });
    expect(restored.household.fundEvents?.at(-1)).toMatchObject({
      kind: "purchase-funded",
      createdBy: BIANCA,
    });
  });

  it("keeps the custodian check in the purchase-funded path before cloning", () => {
    const source = readFileSync(new URL("../src/core/commands.ts", import.meta.url), "utf8");
    const postEntrySource = source.slice(
      source.indexOf("export function postEntry"),
      source.indexOf("export function postOpeningBalances"),
    );
    const classificationAt = postEntrySource.indexOf('fundingEventKind === "purchase-funded"');
    const guardAt = postEntrySource.indexOf("requireFundCustodian(", classificationAt);
    const cloneAt = postEntrySource.indexOf("const previous = cloneHousehold", classificationAt);

    expect(classificationAt).toBeGreaterThanOrEqual(0);
    expect(guardAt).toBeGreaterThan(classificationAt);
    expect(guardAt).toBeLessThan(cloneAt);
    expect(postEntrySource).toContain(REFUSAL);
  });
});
