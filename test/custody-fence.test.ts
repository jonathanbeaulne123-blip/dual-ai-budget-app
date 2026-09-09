import { clearCapturedIntent, capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand } from "../src/ledgerSync/authority.ts";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  ValidationError,
  splitForSync,
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
    const proposal = proposeHouseholdFundContribution(configuredFund(), { source: {version:1,kind:"external-received",explanation:"Synthetic test contribution from untracked savings."},
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

  it("refuses a captured custodian purchase submitted under the other principal", async () => {
    const household=configuredFund();clearCapturedIntent(household);
    const preview=postEntry(household,fundPurchase(BIANCA));
    const scope:Scope={environment:household.environment,householdId:household.householdId,memberId:JONATHAN,subject:'synthetic-contributor',role:'owner',expires:Date.now()+60000,aclEpoch:1};
    const command=await commandFromCapture(capturedIntent(preview.household)!,scope,crypto.randomUUID());
    const state={sequence:household.revision,shared:splitForSync(household,JONATHAN).shared,personal:new Map([[JONATHAN,splitForSync(household,JONATHAN).personal],[BIANCA,splitForSync(household,BIANCA).personal]])};
    const before=JSON.stringify(state.shared);
    await expect(prepareCommand(state,command,scope,()=>{})).rejects.toThrow();
    expect(JSON.stringify(state.shared)).toBe(before);
  });
});
