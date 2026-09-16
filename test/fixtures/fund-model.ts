import { addGoal, addRecurrence, allocateHouseholdFundSurplus, catalogHousehold, configureHouseholdFund, confirmHouseholdFundContribution, proposeHouseholdFundContribution, setHouseholdFundMonthPlan, type Household } from "../../src/core/index.ts";
import { fundContributionReviewDigest } from "../../src/core/fundContributionSources.ts";
import { migrateFundModel } from "../../src/core/fundModelCommands.ts";

export const ALEX = "MEM-001";
export const SAM = "MEM-002";
export const TODAY = "2026-09-21";

/** Fictional two-member household with a configured Fund. Nothing here is real data. */
export function fundedHousehold(contribution = "4000"): Household {
  let h = catalogHousehold();
  h.members = h.members.map((row, index) => ({ ...row, name: index === 0 ? "Alex (fictional)" : "Sam (fictional)" }));
  h = configureHouseholdFund(h, { custodianMemberId: ALEX, openedOn: "2026-09-01", createdBy: ALEX }).household;
  return contribute(h, SAM, contribution, "2026-09-01");
}

export function contribute(h: Household, contributor: string, amount: string, date: string): Household {
  const offer = proposeHouseholdFundContribution(h, { memberId: contributor, contributorMemberId: contributor, date, amount, source: { version: 1, kind: "external-received", explanation: "Fictional test savings, no connected account" } });
  const confirmer = contributor === ALEX ? SAM : ALEX;
  return confirmHouseholdFundContribution(offer.household, { memberId: confirmer, proposalEventId: offer.postedIds[0]!, received: true, expectedProposalDigest: fundContributionReviewDigest(offer.household, offer.postedIds[0]!) }).household;
}

export function fundBill(h: Household, input: { note: string; amount: string; subcategoryId: string; day?: number; kind?: "bill" | "subscription" | "other" }): { household: Household; id: string } {
  const result = addRecurrence(h, {
    cadence: "monthly", nextDate: `2026-09-${String(input.day ?? 25).padStart(2, "0")}`, type: "expense", amount: input.amount,
    accountId: "ACC-VISA", subcategoryId: input.subcategoryId, note: input.note, ...(input.kind ? { kind: input.kind } : {}),
    fundingDefault: { fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  });
  return { household: result.household, id: result.postedIds[0]! };
}

export function buffer(h: Household, amount: string): Household {
  return setHouseholdFundMonthPlan(h, { memberId: ALEX, monthKey: "2026-09", target: "4000", buffer: amount }).household;
}

export function reserveGoal(h: Household, name: string, amount: string, kind?: "build" | "prepare" | "protect" | "everyday"): { household: Household; id: string } {
  const goal = addGoal(h, { name, target: "5000", shared: true, ownerMemberId: ALEX, ...(kind ? { envelope: { version: 1, kind, purpose: "", refill: "target", glaze: "cream", archivedAt: null } } : {}) });
  const funded = allocateHouseholdFundSurplus(goal.household, { memberId: ALEX, date: "2026-09-02", allocations: [{ goalId: goal.postedIds[0]!, amount }] });
  return { household: funded.household, id: goal.postedIds[0]! };
}

export function migrated(h: Household, at = "2026-09-16T12:00:00.000Z"): Household {
  return migrateFundModel(h, { memberId: ALEX, at }).household;
}
