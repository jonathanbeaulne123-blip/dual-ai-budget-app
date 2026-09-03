// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettleStage } from "../src/SettleStage.tsx";
import {
  HOUSEHOLD_FUND_ID,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  openClaim,
  postEntry,
  projectHouseholdFund,
  proposeHouseholdFundContribution,
  settleView,
  type CommitResult,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";
const viewSource = readFileSync(resolve(process.cwd(), "src/core/settleWidget.ts"), "utf8");
const stageSource = readFileSync(resolve(process.cwd(), "src/SettleStage.tsx"), "utf8");
const officeSource = readFileSync(resolve(process.cwd(), "src/OfficeWide.tsx"), "utf8");

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-08-01",
    createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, amount: string): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: BIANCA,
    contributorMemberId: BIANCA,
    amount,
    date: "2026-09-01",
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  }).household;
}

function fundedPurchase(
  household: Household,
  input: { amount: string; date: string; note: string; accountId?: string; visibility?: "household" | "personal" },
): Household {
  const accountId = input.accountId ?? "ACC-VISA";
  return postEntry(household, {
    date: input.date,
    type: "expense",
    amount: input.amount,
    accountId,
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note: input.note,
    createdBy: BIANCA,
    visibility: input.visibility ?? "household",
    confirmDuplicate: true,
    funding: {
      fundId: HOUSEHOLD_FUND_ID,
      fundedCents: Math.round(Number(input.amount) * 100),
      destinationAccountId: accountId,
    },
  }).household;
}

function sharedClaim(household: Household, label: string, amount: string, visibility: "household" | "personal" = "household"): Household {
  const posted = postEntry(household, {
    date: "2026-09-08",
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-TRANSPORT-TRANSIT",
    note: label,
    createdBy: BIANCA,
    visibility,
    confirmDuplicate: true,
  }).household;
  return openClaim(posted, {
    expenseTransactionId: posted.transactions.at(-1)!.id,
    expectedRecovery: amount,
    claimKind: "employer",
    claimLabel: label,
    createdBy: BIANCA,
    visibility,
  }).household;
}

function owingHousehold(): Household {
  let household = contribute(configuredFund(), "500");
  household = fundedPurchase(household, { amount: "84.20", date: "2026-09-03", note: "Groceries" });
  household = fundedPurchase(household, { amount: "25.80", date: "2026-09-07", note: "Hydro" });
  return household;
}

describe("settleView", () => {
  it("reads one destination row directly from the Fund projection and carries its transaction lineage", () => {
    const household = owingHousehold();
    const projection = projectHouseholdFund(household, TODAY);
    const expected = projection.destinationPositions.find((row) => row.destinationAccountId === "ACC-VISA")!;
    const view = settleView(household, BIANCA, TODAY);

    expect(view.out).toHaveLength(1);
    expect(view.out[0]).toMatchObject({
      destinationAccountId: "ACC-VISA",
      dueCents: expected.dueCents,
      creditCents: expected.creditCents,
      oldestDate: "2026-09-03",
    });
    expect(view.out[0]!.transactionIds).toHaveLength(2);
    expect(view.outTotalCents).toBe(projection.transferDueCents);
    expect(view.custodianCanSettle).toBe(true);
  });

  it("sorts destinations by due descending, then oldest first", () => {
    let household = contribute(configuredFund(), "800");
    household = fundedPurchase(household, { amount: "40", date: "2026-09-02", note: "Old Visa", accountId: "ACC-VISA" });
    household = fundedPurchase(household, { amount: "60", date: "2026-09-09", note: "Mastercard", accountId: "ACC-MC" });
    expect(settleView(household, BIANCA, TODAY).out.map((row) => row.destinationAccountId)).toEqual([
      "ACC-MC",
      "ACC-VISA",
    ]);
  });

  it("keeps Shared claim remainder separate and excludes a Personal-source claim entirely", () => {
    let household = sharedClaim(configuredFund(), "Work expense", "47");
    household = sharedClaim(household, "Private reimbursement", "35", "personal");
    const view = settleView(household, JONATHAN, TODAY);

    expect(view.in).toEqual([expect.objectContaining({
      label: "Work expense",
      remainingCents: 4700,
      sinceDate: "2026-09-08",
    })]);
    expect(view.inTotalCents).toBe(4700);
    expect(JSON.stringify(view)).not.toContain("Private reimbursement");
    expect(view.custodianCanSettle).toBe(false);
  });

  it("reduces the destination due through the existing command without changing journal transactions", () => {
    const household = owingHousehold();
    const beforeTransactions = structuredClone(household.transactions);
    const settled = confirmHouseholdFundSettlement(household, {
      memberId: BIANCA,
      amount: "60",
      destinationAccountId: "ACC-VISA",
      date: TODAY,
    }).household;

    expect(settleView(settled, BIANCA, TODAY).outTotalCents).toBe(5000);
    expect(settled.transactions).toEqual(beforeTransactions);
    expect(projectHouseholdFund(settled, TODAY).operatingBalanceCents).toBe(
      projectHouseholdFund(household, TODAY).operatingBalanceCents - 6000,
    );
  });

  it("shows only positive payable positions in lineage when a refund offsets the destination", () => {
    let household = contribute(configuredFund(), "500");
    household = fundedPurchase(household, { amount: "100", date: "2026-09-01", note: "First purchase" });
    const refundedPurchaseId = household.transactions.at(-1)!.id;
    household = confirmHouseholdFundSettlement(household, {
      memberId: BIANCA,
      amount: "100",
      destinationAccountId: "ACC-VISA",
      date: "2026-09-02",
    }).household;
    household = fundedPurchase(household, { amount: "100", date: "2026-09-10", note: "Still payable" });
    household = postEntry(household, {
      date: "2026-09-11",
      type: "refund",
      amount: "80",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Refund plus account credit",
      refundOfId: refundedPurchaseId,
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;

    const row = settleView(household, BIANCA, TODAY).out[0]!;
    expect(row).toMatchObject({ dueCents: 2000, oldestDate: "2026-09-10" });
    expect(row.transactionIds).toHaveLength(1);
  });

  it("shows no payable purchase lineage when mixed positions net to account credit", () => {
    let household = contribute(configuredFund(), "500");
    household = fundedPurchase(household, { amount: "100", date: "2026-09-01", note: "Settled purchase" });
    const refundedPurchaseId = household.transactions.at(-1)!.id;
    household = confirmHouseholdFundSettlement(household, {
      memberId: BIANCA,
      amount: "100",
      destinationAccountId: "ACC-VISA",
      date: "2026-09-02",
    }).household;
    household = fundedPurchase(household, { amount: "50", date: "2026-09-10", note: "New purchase" });
    household = postEntry(household, {
      date: "2026-09-11",
      type: "refund",
      amount: "80",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Later refund",
      refundOfId: refundedPurchaseId,
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;

    const row = settleView(household, BIANCA, TODAY).out[0]!;
    expect(row).toMatchObject({ dueCents: 0, creditCents: 3000, transactionIds: [] });
  });

  it("rechecks the current net destination due before accepting a stale confirmation", () => {
    let staleHousehold = contribute(configuredFund(), "500");
    staleHousehold = fundedPurchase(staleHousehold, { amount: "100", date: "2026-09-01", note: "Purchase" });
    const purchaseId = staleHousehold.transactions.at(-1)!.id;
    const currentHousehold = postEntry(staleHousehold, {
      date: "2026-09-11",
      type: "refund",
      amount: "80",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Intervening refund",
      refundOfId: purchaseId,
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;

    expect(settleView(staleHousehold, BIANCA, TODAY).outTotalCents).toBe(10000);
    expect(settleView(currentHousehold, BIANCA, TODAY).outTotalCents).toBe(2000);
    expect(() => confirmHouseholdFundSettlement(currentHousehold, {
      memberId: BIANCA,
      amount: "100",
      destinationAccountId: "ACC-VISA",
      date: TODAY,
    })).toThrow(/current amount due/i);
  });

  it("allocates oldest first when a Personal purchase uses an opaque Fund position id", () => {
    let household = contribute(configuredFund(), "500");
    household = fundedPurchase(household, { amount: "50", date: "2026-09-01", note: "Shared first" });
    const sharedPositionId = household.transactions.at(-1)!.funding!.positionId!;
    household = fundedPurchase(household, {
      amount: "50",
      date: "2026-09-10",
      note: "Private later",
      visibility: "personal",
    });
    const personalPositionId = household.transactions.at(-1)!.funding!.positionId!;
    expect(personalPositionId).not.toBe(household.transactions.at(-1)!.id);

    const settled = confirmHouseholdFundSettlement(household, {
      memberId: BIANCA,
      amount: "50",
      destinationAccountId: "ACC-VISA",
      date: TODAY,
    }).household;
    const allocation = settled.fundSettlementAllocations!.at(-1)!;
    expect(allocation.transactionId).toBe(sharedPositionId);
    expect(allocation.transactionId).not.toBe(personalPositionId);
  });
});

let root: Root;
let container: HTMLDivElement;

function renderStage(household: Household, memberId: string, onKitchen: (fn: (current: Household) => CommitResult) => void = () => undefined) {
  act(() => {
    root.render(createElement(SettleStage, {
      household,
      memberId,
      today: TODAY,
      busy: false,
      onKitchen,
    }));
  });
}

function typeAmount(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("SettleStage", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows both directions without netting their totals", () => {
    const household = sharedClaim(owingHousehold(), "Work expense", "47");
    renderStage(household, JONATHAN);
    expect(container.textContent).toContain("$110.00 to accounts");
    expect(container.textContent).toContain("The Fund owes Visa $110.00.");
    expect(container.textContent).toContain("Owed to the household");
    expect(container.textContent).toContain("Work expense");
    expect(container.textContent).toContain("$47.00");
    expect(container.textContent).not.toContain("$63.00");
  });

  it("renders a real Confirm only for the active Fund custodian", () => {
    const household = owingHousehold();
    renderStage(household, JONATHAN);
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("input")).toBeNull();

    renderStage(household, BIANCA);
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.textContent).toBe("Confirm transferred amount to Visa");
    expect(button.disabled).toBe(true);
    const input = container.querySelector("input") as HTMLInputElement;
    typeAmount(input, "60");
    expect(button.textContent).toBe("Confirm transferred $60.00 to Visa");
    expect(button.disabled).toBe(false);
  });

  it("uses the command's strict whole-cent grammar for visible validation", () => {
    renderStage(owingHousehold(), BIANCA);
    const input = container.querySelector("input") as HTMLInputElement;
    const button = container.querySelector("button") as HTMLButtonElement;
    typeAmount(input, "0.009");
    expect(button.disabled).toBe(true);
    typeAmount(input, "1e2");
    expect(button.disabled).toBe(true);
    typeAmount(input, "0.01");
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("$0.01");
  });

  it("routes the visible Confirm through onKitchen and the existing settlement command", () => {
    const household = owingHousehold();
    const results: Household[] = [];
    renderStage(household, BIANCA, (fn) => results.push(fn(household).household));
    const input = container.querySelector("input") as HTMLInputElement;
    typeAmount(input, "60");
    act(() => { (container.querySelector("button") as HTMLButtonElement).click(); });
    expect(results).toHaveLength(1);
    expect(settleView(results[0]!, BIANCA, TODAY).outTotalCents).toBe(5000);
  });
});

describe("settlement fences", () => {
  it("derives the two directions from their sealed projections and defines no combined total", () => {
    expect(viewSource).toContain("projectHouseholdFund(household, today)");
    expect(viewSource).toContain("outstandingClaims(household)");
    expect(viewSource).toContain("claimRemainingCents(claim)");
    expect(`${viewSource}\n${stageSource}`).not.toMatch(/netTotal|combinedTotal|outTotalCents\s*[-+]\s*inTotalCents/);
  });

  it("never frames a person as the debtor", () => {
    expect(`${viewSource}\n${stageSource}`).not.toMatch(/\bowes you\b|\byou owe\b/i);
    expect(stageSource).toContain("The Fund owes");
    expect(stageSource).not.toMatch(/memberName|members\.find/);
  });

  it("keeps the only write behind onKitchen and the existing command", () => {
    expect(stageSource).toContain("onKitchen((current) => confirmHouseholdFundSettlement(current,");
    expect(stageSource.match(/confirmHouseholdFundSettlement\s*\(/g) ?? []).toHaveLength(1);
    expect(viewSource).not.toMatch(/confirmHouseholdFundSettlement|postEntry|postTransfer|commit\s*\(/);
  });

  it("mounts only for the resolved Shared settle stage and receives scoped books", () => {
    expect(officeSource).toContain('activeFundWidget === "settle"');
    expect(officeSource).toContain("<SettleStage");
    expect(officeSource).toContain("household={booksHousehold}");
  });
});
