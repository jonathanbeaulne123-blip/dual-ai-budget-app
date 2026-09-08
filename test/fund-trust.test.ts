import { describe, expect, it } from "vitest";
import type { FundHorizon } from "../src/core/fundHorizon.ts";
import { foldFundMovements } from "../src/core/fundMovements.ts";
import { foldReviewedScenarioPaths } from "../src/core/scenarioPaths.ts";
import { fundTrustReading, fundTrustStorageKey, type TrustScenario } from "../src/core/fundTrust.ts";
import type { ElectedScenarioContribution } from "../src/core/scenarioAllocation.ts";
import { trustFixture } from "./fixtures/fund-trust.ts";
const today = "2026-09-08", through = "2026-10-08", member = "MEM-002";
function ready(result: ReturnType<typeof fundTrustReading>) { if (result.kind !== "trust-reading") throw Error(JSON.stringify(result)); return result; }
function scenario(horizon: FundHorizon, lowerCents = 1000, expectedCents = 2000, date = "2026-09-16", removed = new Set<string>()): TrustScenario {
  const contribution = { id: "chosen", date, memberId: member, lowerCents, expectedCents } as ElectedScenarioContribution;
  const paths = foldReviewedScenarioPaths(horizon, [contribution], removed); if (paths.kind !== "paths") throw Error(JSON.stringify(paths));
  const basis = { scope: { environment: "development", householdId: "fixture", memberId: member, viewerRoom: "personal", targetRoom: "household", subject: "own", fundId: "fund", authorityGeneration: "fixture" }, acceptedRevision: 1, acceptedStateId: "accepted-fixture", sharedFactsDigest: "shared", ownSourceFactsDigest: "own", asOf: today, through } as TrustScenario["currentBasis"];
  return { currentBasis: basis, scenario: { kind: "scenario", basis, baseline: horizon, baselineTerminalDeficitCents: Math.max(0,-horizon.endBalanceCents), lower: paths.lower, expected: paths.expected, contributions: [contribution], replacedEstimates: [], assumptions: [], currentAsk: {} as TrustScenario["scenario"]["currentAsk"] } };
}
describe("Trust source inclusion", () => {
  it("keeps every scheduled obligation while removing observed inflows and refolding", () => {
    const { h, horizon } = trustFixture(), before = JSON.stringify({ h, horizon });
    const confirmed = ready(fundTrustReading(horizon, "confirmed")), observed = ready(fundTrustReading(horizon, "observed"));
    expect(confirmed.anchorCents).toBe(188500); expect(confirmed.lower.endBalanceCents).toBe(-35100);
    expect(confirmed.lower.future.map(p => [p.date,p.deltaCents])).toEqual([["2026-09-30",-58600],["2026-10-01",-165000]]);
    expect(confirmed.lastSourceDate).toBe("2026-10-01"); expect(confirmed.endWidthCents).toBeNull();
    expect(observed.lastSourceDate).toBe("2026-10-04"); expect(observed.lower.future).toEqual(horizon.future);
    expect(observed.obligationCount).toBe(2); expect(observed.endWidthCents).toBeNull();
    expect(JSON.stringify({h,horizon})).toBe(before);
  });
  it("allows equal walls when an obligation is later than the added observed source", () => {
    const { horizon } = trustFixture(); const movements = horizon.movements.filter(p => p.date !== "2026-10-04");
    const folded = foldFundMovements(horizon.anchorCents,movements), h = {...horizon,movements,future:folded.points,endBalanceCents:folded.endBalanceCents};
    expect(ready(fundTrustReading(h,"confirmed")).lastSourceDate).toBe(ready(fundTrustReading(h,"observed")).lastSourceDate);
  });
  it("stops an empty selection at today and refuses unsupported Observed", () => {
    const { horizon }=trustFixture(); const empty={...horizon,movements:[],future:[],endBalanceCents:horizon.anchorCents};
    expect(ready(fundTrustReading(empty,"confirmed")).lastSourceDate).toBe(today);
    expect(fundTrustReading(empty,"observed").kind).toBe("unavailable");
  });
  it("refuses filtered overflow although the original interleaved path is safe", () => {
    const { horizon }=trustFixture();const movements=[{date:"2026-09-15",deltaCents:Number.MAX_SAFE_INTEGER,label:"Observed",kind:"contribution" as const,estimated:true,memberId:member,sourceId:"estimate"},{date:"2026-09-16",deltaCents:-1,label:"Scheduled",kind:"obligation" as const,estimated:false,memberId:null,sourceId:"bill"}];
    const folded=foldFundMovements(-Number.MAX_SAFE_INTEGER,movements), h={...horizon,anchorCents:-Number.MAX_SAFE_INTEGER,movements,future:folded.points,endBalanceCents:folded.endBalanceCents};
    expect(fundTrustReading(h,"observed").kind).toBe("trust-reading");
    expect(fundTrustReading(h,"confirmed").kind).toBe("unavailable");
  });
  it("retains real paired order, requires an effective contribution and accepts fixed coincident paths", () => {
    const {horizon}=trustFixture(), reviewed=scenario(horizon), before=JSON.stringify(reviewed);
    const reading=ready(fundTrustReading(horizon,"estimated",reviewed));
    expect(reading.lower.future).toBe(reviewed.scenario.lower.future);expect(reading.expected.future).toBe(reviewed.scenario.expected.future);expect(reading.endWidthCents).toBe(1000);
    expect(fundTrustReading(horizon,"estimated",scenario(horizon,0,0)).kind).toBe("unavailable");
    expect(ready(fundTrustReading(horizon,"estimated",scenario(horizon,1000,1000))).endWidthCents).toBe(0);
    expect(JSON.stringify(reviewed)).toBe(before);
  });
  it("allows the last source to be earlier after replacing a late estimate", () => {
    const {horizon}=trustFixture();const late=horizon.movements.find(p=>p.date==="2026-10-04")!;
    const reading=ready(fundTrustReading(horizon,"estimated",scenario(horizon,1000,1000,"2026-09-16",new Set([late.sourceId!]))));
    expect(reading.lastSourceDate).toBe("2026-10-01");
  });
  it("rejects stale basis, scope or baseline even when the accepted amount matches", () => {
    const {horizon}=trustFixture();
    for(const modify of [(r:TrustScenario)=>({...r,currentBasis:{...r.currentBasis,acceptedStateId:"new"}}),(r:TrustScenario)=>({...r,currentBasis:{...r.currentBasis,scope:{...r.currentBasis.scope,viewerRoom:"household" as const}}}),(r:TrustScenario)=>({...r,scenario:{...r.scenario,baseline:{...horizon,endBalanceCents:horizon.endBalanceCents+1}}})]) expect(fundTrustReading(horizon,"estimated",modify(scenario(horizon))).kind).toBe("unavailable");
  });
  it("separates preference keys by environment, household, member, room and civil date", () => {
    const keys=[fundTrustStorageKey("development","h","a","household",today),fundTrustStorageKey("production","h","a","household",today),fundTrustStorageKey("development","h2","a","household",today),fundTrustStorageKey("development","h","b","household",today),fundTrustStorageKey("development","h","a","personal",today),fundTrustStorageKey("development","h","a","household","2026-09-09")];expect(new Set(keys).size).toBe(6);
  });
});
