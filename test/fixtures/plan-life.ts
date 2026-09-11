import { addGoal, addRecurrence, allocateHouseholdFundSurplus, catalogHousehold, configureHouseholdFund, confirmHouseholdFundContribution, fundGoal, lockPersonalPlan, postEntry, proposeHouseholdFundContribution, proposeHouseholdPlan, savePlanDraft, type LedgerView, type PlanLine } from "../../src/core/index.ts";
import { fundContributionReviewDigest } from "../../src/core/fundContributionSources.ts";
export function planLifeFixture(view: LedgerView) {
  const memberId = "MEM-001";
  let h = catalogHousehold();
  h.members = h.members.map((row, index) => ({ ...row, name: index === 0 ? "Alex (fictional)" : "Sam (fictional)" }));
  if (view === "personal") h.accounts = h.accounts.map(row => row.id === "ACC-CHEQUING" ? { ...row, scope: "personal", ownerMemberId: memberId } : row);
  h = postEntry(h, { type: "income", date: "2026-09-01", amount: "4000", accountId: "ACC-CHEQUING", subcategoryId: h.categories.find(row => row.recordType === "category" && row.transactionType === "income")!.id, createdBy: memberId, visibility: view }).household;
  if (view === "household") {
    h = configureHouseholdFund(h, { custodianMemberId: memberId, openedOn: "2026-09-01", createdBy: memberId }).household;
    const offer = proposeHouseholdFundContribution(h, { memberId: "MEM-002", contributorMemberId: "MEM-002", date: "2026-09-01", amount: "4000", source: { version: 1, kind: "external-received", explanation: "Fictional test savings, no connected account" } });
    h = confirmHouseholdFundContribution(offer.household, { memberId, proposalEventId: offer.postedIds[0]!, received: true, expectedProposalDigest: fundContributionReviewDigest(offer.household, offer.postedIds[0]!) }).household;
  }
  const bill = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-20", type: "expense", amount: "900", accountId: view === "personal" ? "ACC-CHEQUING" : "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional rent", ...(h.householdFund ? { fundingDefault: { fundId: h.householdFund.id, fundedCents: "full" as const, destinationAccountId: "ACC-VISA" } } : {}) });
  h = bill.household;
  const reserve = addGoal(h, { name: "Fictional seasonal reserve", target: "1200", shared: view === "household", ownerMemberId: memberId }); h = reserve.household;
  if (view === "household") h = allocateHouseholdFundSurplus(h, { memberId, date: "2026-09-02", allocations: [{ goalId: reserve.postedIds[0]!, amount: "300" }] }).household;
  else h = fundGoal(h, { goalId: reserve.postedIds[0]!, amount: "300", fromAccountId: "ACC-CHEQUING", date: "2026-09-02", createdBy: memberId, visibility: view }).household;
  const trip = addGoal(h, { name: "A slower week away", target: "2000", shared: view === "household", ownerMemberId: memberId }); h = trip.household;
  const common = { cadence: "monthly" as const, createdBy: memberId, responsibility: { kind: view === "household" ? "joint" as const : "member" as const, memberId }, assumptionIds: [], decision: { funding: "available" as const } };
  const lines: PlanLine[] = [
    { ...common, id: "life-rent", lens: "protect", kind: "obligation", labelSnapshot: "Fictional rent", amountCents: 90000, dueDate: "2026-09-20", sourceReference: { type: "recurrence", id: bill.postedIds[0]! } },
    { ...common, id: "life-reserve", lens: "prepare", kind: "true-expense", labelSnapshot: "Seasonal reserve", amountCents: 30000, dueDate: "2026-09-15", sourceReference: { type: "goal", id: reserve.postedIds[0]! }, decision: { funding: "available", targetCents: 120000, deadline: "2026-12-01", paydays: ["2026-09-15", "2026-10-01", "2026-10-15", "2026-11-01", "2026-11-15", "2026-12-01"], nextStep: "Get a quote before choosing the final target." } },
    { ...common, id: "life-trip", lens: "build", kind: "goal-contribution", labelSnapshot: "A slower week away", amountCents: 20000, dueDate: "2026-09-25", sourceReference: { type: "goal", id: trip.postedIds[0]! }, decision: { funding: "available", targetCents: 200000, deadline: "2027-06-01", nextStep: "Compare two dates with time off.", timeConstraint: "Keep Friday evenings free." } },
    { ...common, id: "life-everyday", lens: "everyday", kind: "everyday-pool", labelSnapshot: "Groceries and ordinary pleasures", amountCents: 50000, dueDate: "2026-09-30", sourceReference: { type: "category", id: h.categories.find(row => row.recordType === "category" && row.name.toLowerCase().includes("grocer"))!.id } },
  ];
  h = savePlanDraft(h, { id: "LIFE-DRAFT", memberId, scope: view, targetMonth: "2026-09", lines, assumptions: [], note: "Fictional private preparation", createdBy: memberId }).household;
  return view === "household" ? proposeHouseholdPlan(h, { memberId, draftId: "LIFE-DRAFT", reason: "Fictional shared possibilities", createdBy: memberId }).household : lockPersonalPlan(h, { memberId, draftId: "LIFE-DRAFT", reason: "Fictional private possibilities", createdBy: memberId }).household;
}
