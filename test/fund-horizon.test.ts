import { fundContributionReviewDigest } from '../src/core/fundContributionSources.ts';
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contributeToGoal, allocateHouseholdFundSurplus, addGoal, addRecurrence, catalogHousehold, configureHouseholdFund, confirmHouseholdFundContribution, confirmHouseholdFundSettlement, fundWalk, fundWalkWith, postEntry, proposeHouseholdFundContribution, reverseHouseholdFundEvent, setHouseholdFundMonthPlan, type Household, type WalkHypothetical } from "../src/core/index.ts";
import { prepareFundHorizon, type FundHorizon } from "../src/core/fundHorizon.ts";
import { foldFundMovements } from "../src/core/fundMovements.ts";
const OWNER = "MEM-001", CONTRIBUTOR = "MEM-002";
function configured() { return configureHouseholdFund(catalogHousehold(), {custodianMemberId: OWNER, openedOn: "2026-01-01", createdBy: OWNER}).household; }
function contribution(h: Household, amount: string, date: string) {
  const proposal = proposeHouseholdFundContribution(h, { source: {version:1,kind:"external-received",explanation:"Synthetic test contribution from untracked savings."},memberId: CONTRIBUTOR, contributorMemberId: CONTRIBUTOR, amount, date});
  return confirmHouseholdFundContribution(proposal.household, { received:true, expectedProposalDigest:fundContributionReviewDigest(proposal.household,proposal.postedIds[0]!),memberId: OWNER, proposalEventId: proposal.postedIds[0]!});
}
function bill(h: Household, amount: string, date: string) { return addRecurrence(h, { cadence: "monthly", nextDate: date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Dated claim", fundingDefault: {fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA"} }).household; }
function purchase(h: Household, amount: string, date: string) { return postEntry(h, {date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", createdBy: OWNER, visibility: "household", confirmDuplicate: true, funding: {fundId: h.householdFund!.id, fundedCents: Number(amount)*100, destinationAccountId: "ACC-VISA"}}).household; }
function settle(h: Household, amount: string, date: string) { return confirmHouseholdFundSettlement(h, {memberId: OWNER, amount, date, destinationAccountId: "ACC-VISA"}).household; }
function horizon(h: Household, asOf: string, through: string): FundHorizon {
  const result = prepareFundHorizon(h, asOf, through);
  if (result.kind !== "horizon") throw Error(JSON.stringify(result.reasons));
  return result;
}
function refusal(h: Household, asOf: string, through: string) {
  const result = prepareFundHorizon(h, asOf, through);
  return result.kind === "unavailable" ? result.reasons[0]!.code : result.kind;
}
const parity = JSON.parse(readFileSync(new URL("./fixtures/fund-walk-parity.json", import.meta.url), "utf8")) as Array<{name: string; household: Household; month: string; today: string; hypothetical: WalkHypothetical; walk: unknown; with: unknown}>;

describe("canonical Fund fold and inclusive horizon", () => {
  it.each(parity)("preserves the pre-refactor $name monthly outputs exactly", fixture => {
    const before = JSON.stringify(fixture.household);
    expect(fundWalk(fixture.household, fixture.month, fixture.today)).toEqual(fixture.walk);
    expect(fundWalkWith(fixture.household, fixture.month, fixture.today, fixture.hypothetical)).toEqual(fixture.with);
    expect(JSON.stringify(fixture.household)).toBe(before);
  });
  it("includes Oct 1 rent once, carries the accepted opening once and conserves the real claims", () => {
    let h = contribution(configured(), "1685", "2026-09-07").household;
    h = bill(h, "586", "2026-09-30"); h = bill(h, "1650", "2026-10-01");
    const before = JSON.stringify(h), monthly = fundWalk(h, "2026-09", "2026-09-08");
    const result = horizon(h, "2026-09-08", "2026-10-01");
    expect(result.anchorCents).toBe(168500); expect(result.endBalanceCents).toBe(-55100);
    expect(result.future.map(p => [p.date, p.deltaCents, p.balanceCents])).toEqual([["2026-09-30", -58600, 109900], ["2026-10-01", -165000, -55100]]);
    expect(result.acceptedMonthlyWalk).toEqual(monthly); expect(monthly.endBalanceCents).toBe(109900);
    expect(foldFundMovements(result.anchorCents, result.movements).points).toEqual(result.future);
    expect(result.future.every(p => !p.actual && p.kind !== "opening")).toBe(true);
    expect(JSON.stringify(h)).toBe(before);
  });
  it("enumerates January, February and March within one inclusive 31-day horizon", () => {
    let h = contribution(configured(), "1000", "2026-01-30").household;
    h = bill(h, "10", "2026-01-31"); h = bill(h, "20", "2026-02-15"); h = bill(h, "30", "2026-03-02");
    const result = horizon(h, "2026-01-31", "2026-03-02");
    expect(result.monthlyBuffers.map(p => p.monthKey)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(result.future.some(p => p.date === "2026-02-15" && p.deltaCents === -2000)).toBe(true);
    expect(result.future.some(p => p.date === "2026-03-02" && p.deltaCents === -3000)).toBe(true);
    expect(refusal(h, "2026-01-31", "2026-03-03")).toBe("outside-horizon");
  });
  it("folds same-day future inflow before the bill regardless of record order", () => {
    let h = contribution(configured(), "100", "2026-09-01").household;
    h = contribution(h, "20", "2026-09-15").household; h = bill(h, "50", "2026-09-15");
    const result = horizon(h, "2026-09-08", "2026-09-15");
    expect(result.future.map(p => p.deltaCents)).toEqual([2000, -5000]);
    const permuted = {...h, fundEvents: [...(h.fundEvents ?? [])].reverse(), recurrences: [...h.recurrences].reverse()};
    expect(horizon(permuted, "2026-09-08", "2026-09-15")).toEqual(result);
  });
  it("carries old partially settled purchases once even when the monthly surplus tie hides them", () => {
    let h = contribution(configured(), "1000", "2026-08-01").household;
    h = purchase(h, "100", "2026-08-02"); h = settle(h, "40", "2026-08-03");
    const result = horizon(h, "2026-09-08", "2026-10-01");
    expect(result.acceptedMonthlyWalk.tiesToProjection).toBe(true);
    expect(result.acceptedMonthlyWalk.endBalanceCents).toBe(96000);
    expect(result.future.map(p => [p.date, p.deltaCents])).toEqual([["2026-09-08", -6000]]);
    expect(result.endBalanceCents).toBe(90000);
  });
  it("refuses future settlement effects even beyond the selected horizon", () => {
    let h = contribution(configured(), "1000", "2026-08-01").household;
    h = purchase(h, "100", "2026-08-02"); h = settle(h, "40", "2026-11-03");
    expect(refusal(h, "2026-09-08", "2026-10-01")).toBe("forecast-model-unsupported");
  });
  it("refuses a future accepted kitty allocation", () => {
    const goal = addGoal(contribution(configured(), "1000", "2026-08-01").household, {name: "Reserve", target: "100", shared: true, ownerMemberId: OWNER});
    const h = allocateHouseholdFundSurplus(goal.household, {memberId: OWNER, date: "2026-11-03", allocations: [{goalId: goal.postedIds[0]!, amount: "50"}]}).household;
    expect(refusal(h, "2026-09-08", "2026-10-01")).toBe("forecast-model-unsupported");
  });
  it("refuses a future refund that changes an outstanding position now", () => {
    const funded = contribution(configured(), "1000", "2026-08-01").household;
    const bought = purchase(funded, "100", "2026-08-02");
    const transaction = bought.transactions.find(t => !funded.transactions.some(previous => previous.id === t.id))!;
    const h = postEntry(bought, {date: "2026-11-03", type: "refund", amount: "20", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", refundOfId: transaction.id, createdBy: OWNER, visibility: "household", confirmDuplicate: true}).household;
    expect(refusal(h, "2026-09-08", "2026-10-01")).toBe("forecast-model-unsupported");
  });
  it("refuses future reversals which active-event readers otherwise erase", () => {
    const c = contribution(configured(), "1000", "2026-08-01");
    const h = reverseHouseholdFundEvent(c.household, {memberId: OWNER, eventId: c.postedIds[0]!, date: "2026-11-03", reason: "Future correction"}).household;
    expect(refusal(h, "2026-09-08", "2026-10-01")).toBe("forecast-model-unsupported");
  });
  it("refuses repeated goal claims that reuse the same remaining target", () => {
    let h = contribution(configured(), "1000", "2026-08-01").household;
    const goal = addGoal(h, {name: "Trip", target: "100", shared: true, ownerMemberId: OWNER});
    h = addRecurrence(goal.household, {cadence: "monthly", nextDate: "2026-09-01", type: "transfer", amount: "75", accountId: "ACC-CHEQUING", transferToAccountId: "ACC-GOALS", goalId: goal.postedIds[0]!, note: "Goal claim"}).household;
    expect(refusal(h, "2026-09-01", "2026-10-01")).toBe("forecast-model-unsupported");
  });
  it.each(["50", "100"])("refuses future goal progress %s that reduces today's undated remaining target", amount => {
    const goal = addGoal(contribution(configured(), "1000", "2026-08-01").household, {name: "Trip", target: "100", shared: true, ownerMemberId: OWNER});
    let h = addRecurrence(goal.household, {cadence: "monthly", nextDate: "2026-09-30", type: "transfer", amount: "100", accountId: "ACC-CHEQUING", transferToAccountId: "ACC-GOALS", goalId: goal.postedIds[0]!, note: "Goal claim"}).household;
    h = contributeToGoal(h, goal.postedIds[0]!, amount, {createdBy: OWNER, date: "2026-11-03"}).household;
    expect(refusal(h, "2026-09-08", "2026-10-01")).toBe("forecast-model-unsupported");
  });
  it("retains each month's own buffer without extending September's value", () => {
    let h = contribution(configured(), "1000", "2026-08-01").household;
    h = setHouseholdFundMonthPlan(h, {memberId: OWNER, monthKey: "2026-09", target: "0", buffer: "400"}).household;
    h = setHouseholdFundMonthPlan(h, {memberId: OWNER, monthKey: "2026-10", target: "0", buffer: "800"}).household;
    expect(horizon(h, "2026-09-08", "2026-10-01").monthlyBuffers).toEqual([{monthKey: "2026-09", bufferCents: 40000}, {monthKey: "2026-10", bufferCents: 80000}]);
  });
});
