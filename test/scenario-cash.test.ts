import { afterEach, describe, expect, it, vi } from "vitest";
import { markDuplicate, addAccount, catalogHousehold, configureHouseholdFund, confirmHouseholdFundContribution, postEntry, proposeHouseholdFundContribution, reversePostedMoney, shapeWorkJob, upsertWorkJob, postWorkShift, payDeferredWorkTipOut, type Household, type WorkJob } from "../src/core/index.ts";
import { reviewScenarioSources, type ScenarioAcceptedSource } from "../src/core/scenarioSources.ts";
import { resolveCashAvailability } from "../src/core/cashAvailability.ts";
import { reviewScenarioAllocations } from "../src/core/scenarioAllocation.ts";
import type { CashAvailabilityAssumption } from "../src/core/earningsAvailability.ts";
import type { FundScenarioRequest } from "../src/core/fundScenario.ts";
const MEMBER = "MEM-002", AS_OF = "2026-09-08", THROUGH = "2026-10-01";
function marker(h: Household): ScenarioAcceptedSource { return {kind: "accepted", scope: {environment: h.environment, householdId: h.householdId, memberId: MEMBER, subject: "fictional-member", viewerRoom: "personal", targetRoom: "household", fundId: h.householdFund!.id, authorityGeneration: "fixture-1"}, acceptedRevision: h.revision, acceptedStateId: `fictional-accepted:${h.revision}`, ownBooks: "ready"}; }
function fixture(amount = "46") {
  const configured = configureHouseholdFund(catalogHousehold(), {custodianMemberId: "MEM-001", openedOn: "2026-01-01", createdBy: "MEM-001"}).household;
  const added = addAccount(configured, {name: "Own cash", kind: "other", scope: "personal", ownerMemberId: MEMBER});
  const accountId = added.postedIds[0]!;
  const posted = postEntry(added.household, {date: "2026-09-07", type: "income", amount, accountId, subcategoryId: "SUB-INCOME-TIPS", createdBy: MEMBER, visibility: "personal", confirmDuplicate: true});
  return {h: posted.household, accountId, transactionId: posted.postedIds[0]!};
}
async function inputs(h: Household, accountId: string, availableCents: number) {
  const accepted = marker(h), sources = await reviewScenarioSources(h, accepted, AS_OF, THROUGH);
  if (sources.kind !== "source-review") throw Error(JSON.stringify(sources));
  const account = sources.cashAccounts.find(row => row.accountId === accountId)!;
  const assumptions: CashAvailabilityAssumption[] = [{accountId, reviewedFactsDigest: account.factsDigest, chosenByMemberId: MEMBER, availableCents, acknowledgesUnattributedCommitments: true}];
  const request: FundScenarioRequest = {version: 1, basis: sources.basis, elections: [{kind: "fixed", id: "choice", chosenByMemberId: MEMBER, contributionOn: AS_OF, chosenCents: availableCents, allocations: [{trancheId: `cash:${accountId}`, cents: availableCents}], replaces: []}]};
  return {accepted, sources, assumptions, request};
}
function reason(result: {kind: string; reasons?: readonly {code: string}[]}) { return result.reasons?.[0]?.code ?? result.kind; }
afterEach(() => vi.unstubAllGlobals());

describe("explicit available-cash assumption from accepted sources", () => {
  it.each([0, 4599, 4600])("conserves an explicitly elected %s cents without asserting verified remaining cash", async amount => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId, 4600), before = JSON.stringify(h);
    const availability = await resolveCashAvailability(h, i.accepted, i.request, i.assumptions);
    expect(i.sources.cashAccounts.find(row => row.accountId === accountId)).toMatchObject({recordedCapacityCents: 4600, availableForFundCents: null});
    expect(availability.kind).toBe("available");
    if (availability.kind !== "available") throw Error("unavailable");
    expect(availability.tranches[0]).toMatchObject({evidence: "member-assumption", lowerCents: 4600, expectedCents: 4600});
    const request: FundScenarioRequest = {...i.request, elections: [{...i.request.elections[0]!, kind: "fixed", chosenCents: amount, allocations: [{trancheId: `cash:${accountId}`, cents: amount}]}]};
    expect(reviewScenarioAllocations(h, i.sources.basis, request, availability)).toMatchObject({kind: "allocated", contributions: amount ? [{lowerCents: amount, expectedCents: amount}] : []});
    expect(JSON.stringify(h)).toBe(before);
  });
  it("refuses 46.01 against a 46.00 assumption and against the recorded account cap", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId, 4600);
    const availability = await resolveCashAvailability(h, i.accepted, i.request, i.assumptions);
    const request: FundScenarioRequest = {...i.request, elections: [{...i.request.elections[0]!, kind: "fixed", chosenCents: 4601, allocations: [{trancheId: `cash:${accountId}`, cents: 4601}]}]};
    expect(reason(reviewScenarioAllocations(h, i.sources.basis, request, availability))).toBe("insufficient-lower-availability");
    expect(reason(await resolveCashAvailability(h, i.accepted, i.request, [{...i.assumptions[0]!, availableCents: 4601}]))).toBe("source-overallocated");
  });
  it("refuses stale/spent/reversed receipt cash instead of reusing its historic face", async () => {
    const {h, accountId, transactionId} = fixture(), i = await inputs(h, accountId, 4600);
    const spent = postEntry(h, {date: AS_OF, type: "expense", amount: "20", accountId, subcategoryId: "SUB-FOOD-GROCERIES", createdBy: MEMBER, visibility: "personal", confirmDuplicate: true}).household;
    expect(reason(await resolveCashAvailability(spent, marker(spent), i.request, i.assumptions))).toBe("baseline-stale");
    const fresh = await inputs(spent, accountId, 4600);
    expect(reason(await resolveCashAvailability(spent, fresh.accepted, fresh.request, fresh.assumptions))).toBe("source-overallocated");
    const reversed = reversePostedMoney(h, transactionId, {createdBy: MEMBER, reversalDate: AS_OF}).household;
    const reverseInput = await inputs(reversed, accountId, 4600);
    expect(reason(await resolveCashAvailability(reversed, reverseInput.accepted, reverseInput.request, reverseInput.assumptions))).toBe("source-overallocated");
  });
  it("prevents aliases and repeated elections from spending one account twice", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId, 4600);
    expect(reason(await resolveCashAvailability(h, i.accepted, i.request, [i.assumptions[0]!, i.assumptions[0]!]))).toBe("source-overallocated");
    const availability = await resolveCashAvailability(h, i.accepted, i.request, i.assumptions);
    expect(reason(reviewScenarioAllocations(h, i.sources.basis, {...i.request, elections: [i.request.elections[0]!, {...i.request.elections[0]!, id: "again"}]}, availability))).toBe("insufficient-lower-availability");
  });
  it("checks shared capacity aliases and a later availability date", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId, 4600);
    const availability = await resolveCashAvailability(h, i.accepted, i.request, i.assumptions);
    if (availability.kind !== "available") throw Error("unavailable");
    expect(reason(reviewScenarioAllocations(h, i.sources.basis, i.request, {...availability, tranches: [{...availability.tranches[0]!, availableOn: "2026-09-09"}]}))).toBe("availability-date-missing");
    const alias = {...availability.tranches[0]!, id: "cash-alias"};
    const request: FundScenarioRequest = {...i.request, elections: [i.request.elections[0]!, {...i.request.elections[0]!, id: "other-choice", kind: "fixed", chosenCents: 1, allocations: [{trancheId: alias.id, cents: 1}]}]};
    expect(reason(reviewScenarioAllocations(h, i.sources.basis, request, {...availability, tranches: [...availability.tranches, alias]}))).toBe("insufficient-lower-availability");
  });
  it("does not infer available money from a contribution which never debited its source account", async () => {
    const {h, accountId} = fixture(), old = await inputs(h, accountId, 4600);
    const proposed = proposeHouseholdFundContribution(h, {memberId: MEMBER, contributorMemberId: MEMBER, amount: "46", date: AS_OF});
    const contributed = confirmHouseholdFundContribution(proposed.household, {memberId: "MEM-001", proposalEventId: proposed.postedIds[0]!}).household;
    const fresh = await inputs(contributed, accountId, 4600);
    expect(fresh.sources.cashAccounts.find(row => row.accountId === accountId)?.recordedCapacityCents).toBe(4600);
    expect(fresh.sources.cashAccounts.find(row => row.accountId === accountId)?.availableForFundCents).toBeNull();
    expect(reason(await resolveCashAvailability(contributed, marker(contributed), old.request, old.assumptions))).toBe("baseline-stale");
    expect(reason(await resolveCashAvailability(contributed, fresh.accepted, fresh.request, [{...fresh.assumptions[0]!, acknowledgesUnattributedCommitments: false} as never]))).toBe("source-remaining-unknown");
  });
  it("distinguishes unavailable Personal books from accepted empty books", async () => {
    const {h} = fixture();
    expect(reason(await reviewScenarioSources(h, {...marker(h), ownBooks: "unavailable"}, AS_OF, THROUGH))).toBe("source-not-accepted");
    const empty = {...h, accounts: h.accounts.filter(account => account.ownerMemberId !== MEMBER), transactions: h.transactions.filter(tx => tx.createdBy !== MEMBER)};
    const result = await reviewScenarioSources(empty, marker(empty), AS_OF, THROUGH);
    expect(result).toMatchObject({kind: "source-review", cashAccounts: [], recordedNetCashCents: 0});
  });
  it("binds source metadata and never offers another member's cash", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId, 4600);
    const renamed = {...h, accounts: h.accounts.map(account => account.id === accountId ? {...account, name: "Changed source"} : account)};
    expect(reason(await resolveCashAvailability(renamed, marker(renamed), i.request, i.assumptions))).toBe("baseline-stale");
    expect(reason(await resolveCashAvailability(h, i.accepted, i.request, [{...i.assumptions[0]!, chosenByMemberId: "MEM-001"}]))).toBe("source-not-owned");
    const partner = addAccount(h, {name: "Partner secret cash", kind: "other", scope: "personal", ownerMemberId: "MEM-001"}).household;
    const source = await reviewScenarioSources(partner, marker(partner), AS_OF, THROUGH);
    expect(JSON.stringify(source)).not.toContain("Partner secret cash");
  });
  it("reads no network and snapshots inputs before asynchronous hashing", async () => {
    const {h, accountId} = fixture(), before = JSON.stringify(h), i = await inputs(h, accountId, 4600);
    const fetch = vi.fn(() => {throw Error("network forbidden");}); vi.stubGlobal("fetch", fetch);
    const result = await resolveCashAvailability(h, i.accepted, i.request, i.assumptions);
    expect(result.kind).toBe("available"); expect(fetch).not.toHaveBeenCalled(); expect(JSON.stringify(h)).toBe(before);
    const mutable = structuredClone(h), pending = reviewScenarioSources(mutable, marker(mutable), AS_OF, THROUGH);
    mutable.accounts.find(account => account.id === accountId)!.name = "Changed during digest";
    const reviewed = await pending;
    expect(JSON.stringify(reviewed)).not.toContain("Changed during digest");
  });
});

function job(accountId: string): WorkJob {
  return shapeWorkJob({
    id: "",
    memberId: "MEM-002",
    name: "Café Nola",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: true,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [
        { id: "RATE-OLD", effectiveDate: "2026-01-01", grossHourlyRateCents: 1800, takeHomeMode: "direct", takeHomeHourlyRateCents: 1500, deductions: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "RATE-NEW", effectiveDate: "2026-09-01", grossHourlyRateCents: 2000, takeHomeMode: "deductions", takeHomeHourlyRateCents: 0, deductions: [{ id: "TAX", label: "Tax", percent: 20 }], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [
      { id: "BAR", label: "Bar", basis: "total-sales", value: 1, roundingCents: 500, roundingMode: "up", timing: "immediate", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "FLOOR", label: "Floor", basis: "card-tips", value: 2, roundingCents: 1, roundingMode: "nearest", timing: "withheld", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    salesFields: [{ id: "FOOD", label: "Food", requirement: "required", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: accountId, cardTipsDepositAccountId: "ACC-CASH" },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
}

async function shiftFixture() {
  const f = fixture("1");
  const j = job(f.accountId);
  j.tipOutRules.push({...j.tipOutRules[0]!, id: "DEFER", label: "Deferred", timing: "deferred", value: 1, roundingCents: 1});
  const saved = upsertWorkJob(f.h, {job: j}).household;
  const h = postWorkShift(saved, {date: "2026-09-07", memberId: MEMBER, jobId: saved.workJobs[0]!.id, roleId: "ROLE-SERVER", workedHours: 4, paidBreakHours: 0, salesByField: {FOOD: 1000}, cashTips: 50, cardTips: 100, customersServed: 40, staffingCount: 4, eventTag: "regular", createdBy: MEMBER, confirmDuplicate: true}).household;
  return {...f, h};
}
describe("cash capacity and tip-out obligations", () => {
  it("deducts immediate and paid amounts once and retains unpaid liabilities after a job is archived", async () => {
    const {h, accountId} = await shiftFixture();
    const i = await inputs(h, accountId, 3100);
    expect(i.sources).toMatchObject({recordedNetCashCents: 4100, outstandingDeferredTipOutCents: 1000, cashCapacityLimitCents: 3100});
    const paid = payDeferredWorkTipOut(h, {jobId: h.workJobs[0]!.id, amount: 10, accountId, date: AS_OF, createdBy: MEMBER}).household;
    expect((await inputs(paid, accountId, 3100)).sources).toMatchObject({recordedNetCashCents: 3100, outstandingDeferredTipOutCents: 0, cashCapacityLimitCents: 3100});
    const archived = upsertWorkJob(h, {job: {...h.workJobs[0]!, active: false, defaults: {...h.workJobs[0]!.defaults, cashTipsAccountId: "ACC-CASH"}}}).household;
    expect((await inputs(archived, accountId, 3100)).sources.outstandingDeferredTipOutCents).toBe(1000);
  });
  it.each(["reversed", "duplicate", "missing"])("refuses %s payment evidence with an unchanged paid counter", async kind => {
    const {h, accountId} = await shiftFixture();
    const paid = payDeferredWorkTipOut(h, {jobId: h.workJobs[0]!.id, amount: 10, accountId, date: AS_OF, createdBy: MEMBER});
    const txId = paid.postedIds[0]!;
    const changed = kind === "reversed" ? reversePostedMoney(paid.household, txId, {createdBy: MEMBER, reversalDate: AS_OF}).household
      : kind === "duplicate" ? markDuplicate(paid.household, txId, true).household
      : {...paid.household, transactions: paid.household.transactions.filter(row => row.id !== txId)};
    expect(reason(await reviewScenarioSources(changed, marker(changed), AS_OF, THROUGH))).toBe("source-remaining-unknown");
  });
  it("retains known deferred cents without a legacy job link or paid counter", async () => {
    const {h, accountId} = await shiftFixture();
    const legacy = {...h, shifts: h.shifts.map(shift => ({...shift, jobId: undefined, deferredTipOutPaidCents: undefined}))};
    expect((await inputs(legacy, accountId, 3100)).sources).toMatchObject({outstandingDeferredTipOutCents: 1000, timingComplete: false});
  });
  it("refuses a future shift reversal that prematurely removes today's deferred liability", async () => {
    const {h} = await shiftFixture();
    const reversed = reversePostedMoney(h, h.shifts[0]!.transactionIds![0]!, {createdBy: MEMBER, reversalDate: "2026-11-03"}).household;
    expect(reason(await reviewScenarioSources(reversed, marker(reversed), AS_OF, THROUGH))).toBe("source-remaining-unknown");
  });
  it.each(["duplicate", "re-reversed"])("refuses %s shift-reversal evidence that disagrees with the cash books", async kind => {
    const {h} = await shiftFixture();
    const original = h.shifts[0]!.cashTipsTransactionId!;
    const reversed = reversePostedMoney(h, original, {createdBy: MEMBER, reversalDate: AS_OF}).household;
    const cashReversal = reversed.transactions.find(row => row.reversalOfId === original)!;
    const changed = kind === "duplicate" ? markDuplicate(reversed, cashReversal.id, true).household
      : reversePostedMoney(reversed, cashReversal.id, {createdBy: MEMBER, reversalDate: AS_OF}).household;
    expect(reason(await reviewScenarioSources(changed, marker(changed), AS_OF, THROUGH))).toBe("source-remaining-unknown");
  });
  it("refuses future paid counters before the cash debit date", async () => {
    const {h, accountId} = await shiftFixture();
    const paid = payDeferredWorkTipOut(h, {jobId: h.workJobs[0]!.id, amount: 10, accountId, date: "2026-11-03", createdBy: MEMBER}).household;
    expect(reason(await reviewScenarioSources(paid, marker(paid), AS_OF, THROUGH))).toBe("source-remaining-unknown");
  });
});
