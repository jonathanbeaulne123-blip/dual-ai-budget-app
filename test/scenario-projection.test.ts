import { afterEach, describe, expect, it, vi } from "vitest";
import { addAccount, addRecurrence, catalogHousehold, configureHouseholdFund, confirmHouseholdFundContribution, fundWalk, householdAsk, postEntry, proposeHouseholdFundContribution, setHouseholdFundMonthPlan, recordEarningCadence, type Household } from "../src/core/index.ts";
import { reviewScenarioSources, type ScenarioAcceptedSource } from "../src/core/scenarioSources.ts";
import { projectFundScenario, reviewFundScenario, type FundScenarioResult, type ScenarioSourceAssumptions } from "../src/core/scenarioProjection.ts";
import { reviewScenarioAllocations } from "../src/core/scenarioAllocation.ts";
import type { FundScenarioRequest, ContributionElection, ScenarioBasis } from "../src/core/fundScenario.ts";
import { foldReviewedScenarioPaths } from "../src/core/scenarioPaths.ts";
import { reviewForecastRoutes, resolveForecastAvailability } from "../src/core/forecastAvailability.ts";
import { forecastReceiptHousehold } from "./fixtures/forecast-receipts.ts";
import type { EarningsAvailability } from "../src/core/earningsAvailability.ts";
const MEMBER = "MEM-002", AS_OF = "2026-09-08", THROUGH = "2026-10-01";
function marker(h: Household): ScenarioAcceptedSource { return {kind: "accepted", scope: {environment: h.environment, householdId: h.householdId, memberId: MEMBER, subject: "fictional-member", viewerRoom: "personal", targetRoom: "household", fundId: h.householdFund!.id, authorityGeneration: "fixture-1"}, acceptedRevision: h.revision, acceptedStateId: `fictional-accepted:${h.revision}`, ownBooks: "ready"}; }
function contribute(h: Household, amount: string, date: string, member = MEMBER) {
  const p = proposeHouseholdFundContribution(h, {memberId: member, contributorMemberId: member, amount, date});
  return confirmHouseholdFundContribution(p.household, {memberId: "MEM-001", proposalEventId: p.postedIds[0]!}).household;
}
function bill(h: Household, amount: string, date: string) { return addRecurrence(h, {cadence: "monthly", nextDate: date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", fundingDefault: {fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA"}}).household; }
function fixture() {
  let h = contribute(configureHouseholdFund(catalogHousehold(), {custodianMemberId: "MEM-001", openedOn: "2026-01-01", createdBy: "MEM-001"}).household, "1685", "2026-09-07");
  h = bill(bill(h, "586", "2026-09-30"), "1650", "2026-10-01");
  const a = addAccount(h, {name: "Own cash", kind: "other", scope: "personal", ownerMemberId: MEMBER}), accountId = a.postedIds[0]!;
  h = postEntry(a.household, {date: AS_OF, type: "income", amount: "46", accountId, subcategoryId: "SUB-INCOME-TIPS", createdBy: MEMBER, visibility: "personal", confirmDuplicate: true}).household;
  return {h, accountId};
}
async function inputs(h: Household, accountId: string) {
  const accepted = marker(h), source = await reviewScenarioSources(h, accepted, AS_OF, THROUGH);
  if (source.kind !== "source-review") throw Error(JSON.stringify(source));
  const assumptions: ScenarioSourceAssumptions = {cash: [{accountId, availableCents: 4600, reviewedFactsDigest: source.cashAccounts.find(row => row.accountId === accountId)!.factsDigest, chosenByMemberId: MEMBER, acknowledgesUnattributedCommitments: true}], forecast: []};
  const request: FundScenarioRequest = {version: 1, basis: source.basis, elections: []};
  return {accepted, source, assumptions, request};
}
const election = (accountId: string, cents: number, id = "chosen", contributionOn = AS_OF): ContributionElection => ({kind: "fixed", id, chosenByMemberId: MEMBER, contributionOn, replaces: [], chosenCents: cents, allocations: [{trancheId: `cash:${accountId}`, cents}]});
const scenario = (r: FundScenarioResult) => {if (r.kind !== "scenario") throw Error(JSON.stringify(r)); return r;};
const reason = (r: {kind: string; reasons?: readonly {code: string}[]}) => r.reasons?.[0]?.code ?? r.kind;
afterEach(() => vi.unstubAllGlobals());

describe("paired Fund scenario composition", () => {
  it("conserves real1685 and2236 including Oct1: zero -551, explicit46 -505", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId), before = JSON.stringify(h);
    const zero = scenario(await projectFundScenario(h, i.accepted, i.request, {cash: [], forecast: []}));
    expect(zero.baseline.anchorCents).toBe(168500);
    expect(zero.baseline.movements.reduce((sum, row) => sum + row.deltaCents, 0)).toBe(-223600);
    expect(zero.lower.future).toEqual(zero.baseline.future); expect(zero.expected.future).toEqual(zero.baseline.future);
    expect(zero.lower.endBalanceCents).toBe(-55100);
    expect(zero.baselineTerminalDeficitCents).toBe(55100);
    const chosen = scenario(await projectFundScenario(h, i.accepted, {...i.request, elections: [election(accountId, 4600)]}, i.assumptions));
    expect(chosen.lower.endBalanceCents).toBe(-50500); expect(chosen.lower.terminalDeficitCents).toBe(50500);
    expect(chosen.lower).toEqual(chosen.expected);
    expect(chosen.baseline).toEqual(zero.baseline); expect(chosen.baseline.acceptedMonthlyWalk).toEqual(fundWalk(h, "2026-09", AS_OF));
    expect(chosen.currentAsk).toEqual(householdAsk(h, AS_OF)); expect(chosen.currentAsk).toEqual(zero.currentAsk);
    expect(JSON.stringify(h)).toBe(before);
  });
  it("does not elect a contribution merely by assuming cash remains", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId);
    const r = scenario(await projectFundScenario(h, i.accepted, i.request, i.assumptions));
    expect(r.contributions).toEqual([]); expect(r.lower.future).toEqual(r.baseline.future);
    const zero = scenario(await projectFundScenario(h, i.accepted, {...i.request, elections: [election(accountId, 0)]}, i.assumptions));
    expect(zero.lower.future).toEqual(r.baseline.future);
  });
  it("refuses unbacked, stale, foreign and duplicate capacity without a partial path", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId), request = {...i.request, elections: [election(accountId, 4601)]};
    expect(reason(await projectFundScenario(h, i.accepted, request, i.assumptions))).toBe("insufficient-lower-availability");
    expect(reason(await projectFundScenario(h, {...i.accepted, scope: {...i.accepted.scope, authorityGeneration: "new-room"}}, i.request, i.assumptions))).toBe("scope-mismatch");
    expect(reason(await projectFundScenario(h, {...i.accepted, ownBooks: "unavailable"}, i.request, i.assumptions))).toBe("source-not-accepted");
    const duplicate = {...i.request, elections: [election(accountId, 4600), election(accountId, 1, "again")]};
    expect(reason(await projectFundScenario(h, i.accepted, duplicate, i.assumptions))).toBe("insufficient-lower-availability");
    expect(reason(await projectFundScenario(h, i.accepted, i.request, {...i.assumptions, cash: [{...i.assumptions.cash[0]!, chosenByMemberId: "MEM-001"}]}))).toBe("source-not-owned");
  });
  it("uses each month's buffer and keeps it out of the terminal deficit", async () => {
    const f = fixture();
    let h = setHouseholdFundMonthPlan(f.h, {memberId: "MEM-001", monthKey: "2026-09", target: "0", buffer: "2000"}).household;
    h = setHouseholdFundMonthPlan(h, {memberId: "MEM-001", monthKey: "2026-10", target: "0", buffer: "800"}).household;
    const i = await inputs(h, f.accountId), r = scenario(await projectFundScenario(h, i.accepted, i.request, i.assumptions));
    expect(r.lower.underBufferDates[0]).toBe(AS_OF); expect(r.lower.underBufferDates.at(-1)).toBe(THROUGH);
    expect(r.lower.terminalDeficitCents).toBe(55100);
  });
  it("is deterministic for unrelated order and captures inputs before hashing", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId), request = {...i.request, elections: [election(accountId, 100, "b"), election(accountId, 100, "a")]};
    const fetch = vi.fn(() => {throw Error("no network");}); vi.stubGlobal("fetch", fetch);
    const first = await projectFundScenario(h, i.accepted, request, i.assumptions);
    const permuted = {...h, accounts: [...h.accounts].reverse(), transactions: [...h.transactions].reverse(), fundEvents: [...h.fundEvents!].reverse(), recurrences: [...h.recurrences].reverse()};
    expect(await projectFundScenario(permuted, i.accepted, {...request, elections: [...request.elections].reverse()}, i.assumptions)).toEqual(first);
    const mutable = structuredClone(h), pending = projectFundScenario(mutable, i.accepted, request, i.assumptions);
    mutable.accounts.find(row => row.id === accountId)!.name = "Changed while hashing";
    expect(await pending).toEqual(first); expect(fetch).not.toHaveBeenCalled();
  });
});

function capacity(basis: ScenarioBasis, rows: Array<[string, number, number]>, groupLower: number, groupExpected: number): EarningsAvailability {
  return {kind: "available", basis, modelVersion: "internal-allocation-fixture", assumptions: [], capacityGroups: [{id: "shared", lowerCents: groupLower, expectedCents: groupExpected}], tranches: rows.map(([id, lowerCents, expectedCents]) => ({id, lowerCents, expectedCents, availableOn: AS_OF, component: "net-tips", capacityGroupId: "shared", evidence: "forecast-availability", source: {kind: "named-route", id, ownerMemberId: MEMBER, factsDigest: `fixture:${id}`}, deductions: []}))};
}
function cap(id: string, trancheId: string, maximumCents: number, date = AS_OF): ContributionElection { return {kind: "available-up-to", id, chosenByMemberId: MEMBER, contributionOn: date, replaces: [], maximumCents, allocations: [{trancheId, maximumCents}]}; }
describe("paired source allocation", () => {
  it("checks expected shared residuals before a fixed choice after an up-to choice", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId);
    const availability = capacity(i.source.basis, [["a", 50, 100], ["b", 50, 50]], 100, 100);
    const fixed: ContributionElection = {kind: "fixed", id: "b", contributionOn: "2026-09-09", chosenByMemberId: MEMBER, replaces: [], chosenCents: 50, allocations: [{trancheId: "b", cents: 50}]};
    expect(reason(reviewScenarioAllocations(h, i.source.basis, {...i.request, elections: [cap("a", "a", 100), fixed]}, availability))).toBe("insufficient-lower-availability");
  });
  it("conserves repeated up-to choices even when a later increment narrows the earlier gap", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId);
    const availability = capacity(i.source.basis, [["a", 50, 100], ["b", 50, 50]], 100, 100);
    const r = reviewScenarioAllocations(h, i.source.basis, {...i.request, elections: [cap("a", "a", 100), cap("b", "b", 100, "2026-09-09")]}, availability);
    expect(r).toMatchObject({kind: "allocated", contributions: [{lowerCents: 50, expectedCents: 100}, {lowerCents: 50, expectedCents: 0}]});
  });
  it("sorts allocation identities so incidental array order cannot change the result", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId);
    const availability = capacity(i.source.basis, [["a", 50, 100], ["b", 50, 50]], 100, 100);
    const e: ContributionElection = {kind: "available-up-to", id: "choice", contributionOn: AS_OF, chosenByMemberId: MEMBER, replaces: [], maximumCents: 200, allocations: [{trancheId: "a", maximumCents: 100}, {trancheId: "b", maximumCents: 100}]};
    const r = reviewScenarioAllocations(h, i.source.basis, {...i.request, elections: [e]}, availability);
    expect(reviewScenarioAllocations(h, i.source.basis, {...i.request, elections: [{...e, allocations: [...e.allocations].reverse()}]}, availability)).toEqual(r);
  });
});

async function observedFixture() {
  const f = fixture();
  let h = recordEarningCadence(f.h, {memberId: MEMBER, createdBy: MEMBER, detailAction: "skip", paySchedule: {cadence: "custom", anchorDate: "2026-08-01", weekday: 5, monthDays: [15, 30], customDates: ["2026-09-15"], reminderTime: "09:00"}}).household;
  h = contribute(contribute(h, "100", "2026-08-20"), "100", "2026-08-27");
  const i = await inputs(h, f.accountId), review = await reviewFundScenario(h, i.accepted, AS_OF, THROUGH);
  if (review.kind !== "scenario-review" || review.replacements.length !== 1) throw Error(JSON.stringify(review));
  return {...f, h, ...i, review, replacement: review.replacements[0]!};
}
describe("exact reviewed estimate replacement", () => {
  it("can replace a larger estimate on a different explicit date and worsen the scenario", async () => {
    const i = await observedFixture(), before = JSON.stringify(i.h);
    expect(i.replacement.amountCents).toBe(10000);
    const e = {...election(i.accountId, 4600, "replacement", "2026-09-16"), replaces: [i.replacement]};
    const r = scenario(await projectFundScenario(i.h, i.accepted, {...i.request, elections: [e]}, i.assumptions));
    expect(r.replacedEstimates).toEqual([i.replacement]);
    expect(r.lower.future.some(row => row.sourceId === i.replacement.id)).toBe(false);
    expect(r.lower.future.find(row => row.sourceId === "scenario:replacement")?.date).toBe("2026-09-16");
    expect(r.lower.endBalanceCents).toBe(r.baseline.endBalanceCents - 10000 + 4600);
    expect(r.currentAsk).toEqual(householdAsk(i.h, AS_OF)); expect(JSON.stringify(i.h)).toBe(before);
  });
  it("refuses stale, missing, duplicated and zero replacement choices", async () => {
    const i = await observedFixture(), base = {...election(i.accountId, 2000), replaces: [i.replacement]};
    expect(reason(await projectFundScenario(i.h, i.accepted, {...i.request, elections: [{...base, replaces: [{...i.replacement, factsDigest: "stale"}]}]}, i.assumptions))).toBe("baseline-stale");
    expect(reason(await projectFundScenario(i.h, i.accepted, {...i.request, elections: [{...base, replaces: [{id: "absent", factsDigest: "not-real"}]}]}, i.assumptions))).toBe("replacement-missing");
    expect(reason(await projectFundScenario(i.h, i.accepted, {...i.request, elections: [base, {...base, id: "again"}]}, i.assumptions))).toBe("replacement-duplicated");
    expect(reason(await projectFundScenario(i.h, i.accepted, {...i.request, elections: [{...election(i.accountId, 0), replaces: [i.replacement]}]}, i.assumptions))).toBe("zero-election-replacement");
    const empty = {...i.assumptions, cash: [{...i.assumptions.cash[0]!, availableCents: 0}]};
    const conditional = {...cap("choice", `cash:${i.accountId}`, 100), replaces: [i.replacement]};
    expect(reason(await projectFundScenario(i.h, i.accepted, {...i.request, elections: [conditional]}, empty))).toBe("zero-election-replacement");
  });
  it("refuses obligations, future confirmed contributions and another member's estimate", async () => {
    const i = await observedFixture();
    let h = contribute(i.h, "10", "2026-09-20");
    h = recordEarningCadence(h, {memberId: "MEM-001", createdBy: "MEM-001", detailAction: "skip", paySchedule: {cadence: "custom", anchorDate: "2026-08-01", weekday: 5, monthDays: [15, 30], customDates: ["2026-09-15"], reminderTime: "09:00"}}).household;
    for (const date of ["2026-08-01", "2026-08-08", "2026-08-15"]) h = contribute(h, "10", date, "MEM-001");
    const fresh = await inputs(h, i.accountId);
    const rows = fresh.source.horizon.movements;
    const obligation = rows.find(row => row.kind === "obligation")!, confirmed = rows.find(row => row.kind === "contribution" && !row.estimated)!, partner = rows.find(row => row.estimated && row.memberId === "MEM-001")!;
    expect(partner).toBeDefined();
    for (const [row, code] of [[obligation, "replacement-not-observed"], [confirmed, "replacement-not-observed"], [partner, "replacement-scope-mismatch"]] as const) {
      const request = {...fresh.request, elections: [{...election(i.accountId, 100), replaces: [{id: row.sourceId!, factsDigest: "unreviewed"}]}]};
      expect(reason(await projectFundScenario(h, fresh.accepted, request, fresh.assumptions))).toBe(code);
    }
  });
});

describe("common source slots and explicit forecast contributions", () => {
  it("keeps a zero lower contribution in the same source slot as its expected contribution", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId);
    const r = foldReviewedScenarioPaths(i.source.horizon, [{id: "a", date: AS_OF, lowerCents: 0, expectedCents: 1, memberId: MEMBER}, {id: "b", date: AS_OF, lowerCents: 10, expectedCents: 10, memberId: MEMBER}], new Set());
    if (r.kind !== "paths") throw Error(JSON.stringify(r));
    expect(r.lower.future.slice(0, 2).map(row => [row.sourceId, row.balanceCents])).toEqual([["scenario:a", 168500], ["scenario:b", 168510]]);
    expect(r.expected.future.slice(0, 2).map(row => [row.sourceId, row.balanceCents])).toEqual([["scenario:a", 168501], ["scenario:b", 168511]]);
    expect(r.lower.future.every((row, index) => row.balanceCents <= r.expected.future[index]!.balanceCents)).toBe(true);
  });
  it("refuses crossing intermediate paths even if their terminal totals tie", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId);
    const r = foldReviewedScenarioPaths(i.source.horizon, [{id: "a", date: AS_OF, lowerCents: 10, expectedCents: 0, memberId: MEMBER}, {id: "b", date: "2026-09-09", lowerCents: 0, expectedCents: 10, memberId: MEMBER}], new Set());
    expect(reason(r)).toBe("forecast-model-unsupported");
    const overflow = foldReviewedScenarioPaths(i.source.horizon, [{id: "huge", date: AS_OF, lowerCents: Number.MAX_SAFE_INTEGER, expectedCents: Number.MAX_SAFE_INTEGER, memberId: MEMBER}], new Set());
    expect(reason(overflow)).toBe("unsafe-cents");
  });
  it("re-resolves a real named forecast and only folds its separately elected up-to amount", async () => {
    const h = forecastReceiptHousehold(), accepted = marker(h), review = await reviewForecastRoutes(h, accepted, AS_OF, THROUGH);
    if (review.kind !== "forecast-review") throw Error(JSON.stringify(review));
    const route = review.families[1]!.routes[0]!, request: FundScenarioRequest = {version: 1, basis: review.basis, elections: []};
    const forecast: ScenarioSourceAssumptions["forecast"] = [{routeId: route.id, reviewedRouteDigest: route.factsDigest, reviewedPolicyDigest: review.policyDigest, chosenByMemberId: MEMBER, policy: review.policy, acknowledgesForecastReceiptAssumption: true}];
    const availability = await resolveForecastAvailability(h, accepted, request, forecast);
    if (availability.kind !== "available") throw Error(JSON.stringify(availability));
    const t = availability.tranches[0]!, baseline = scenario(await projectFundScenario(h, accepted, request, {cash: [], forecast}));
    expect(baseline.contributions).toEqual([]); expect(baseline.lower.future).toEqual(baseline.baseline.future);
    const choice = cap("route-choice", t.id, t.expectedCents, t.availableOn);
    const r = scenario(await projectFundScenario(h, accepted, {...request, elections: [choice]}, {cash: [], forecast}));
    expect(r.lower.endBalanceCents).toBe(r.baseline.endBalanceCents + t.lowerCents);
    expect(r.expected.endBalanceCents).toBe(r.baseline.endBalanceCents + t.expectedCents);
    expect(r.lower.future.every((row, index) => row.sourceId === r.expected.future[index]!.sourceId && row.balanceCents <= r.expected.future[index]!.balanceCents)).toBe(true);
    expect(r.currentAsk).toEqual(baseline.currentAsk);
    const early = {...choice, contributionOn: AS_OF};
    expect(reason(await projectFundScenario(h, accepted, {...request, elections: [early]}, {cash: [], forecast}))).toBe("availability-date-missing");
  });
});

describe("scenario public refusal boundary", () => {
  it("returns typed refusals for missing acceptance or malformed source choices", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId);
    expect(reason(await reviewFundScenario(h, null as never, AS_OF, THROUGH))).toBe("source-not-accepted");
    expect(reason(await projectFundScenario(h, null as never, i.request, i.assumptions))).toBe("source-not-accepted");
    expect(reason(await projectFundScenario(h, i.accepted, null as never, i.assumptions))).toBe("invalid-election");
    expect(reason(await projectFundScenario(h, i.accepted, i.request, {cash: [null as never], forecast: []}))).toBe("invalid-election");
  });
  it("refuses a choice identity colliding with a retained baseline source", async () => {
    const {h, accountId} = fixture(), i = await inputs(h, accountId);
    const horizon = {...i.source.horizon, movements: [{...i.source.horizon.movements[0]!, sourceId: "scenario:collision"}]};
    const result = foldReviewedScenarioPaths(horizon, [{id: "collision", date: AS_OF, memberId: MEMBER, lowerCents: 1, expectedCents: 1}], new Set());
    expect(reason(result)).toBe("invalid-election");
  });
});
