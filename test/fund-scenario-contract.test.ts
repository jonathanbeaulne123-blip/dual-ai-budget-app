import { describe, expect, it } from "vitest";
import { catalogHousehold, configureHouseholdFund } from "../src/core/index.ts";
import { reviewFundScenarioRequest, type FundScenarioRequest, type ScenarioBasis, type ScenarioScope } from "../src/core/fundScenario.ts";

function fixture(asOf = "2026-09-08", through = "2026-10-08") {
  const household = configureHouseholdFund(catalogHousehold(), { custodianMemberId: "MEM-001", openedOn: "2026-01-01", createdBy: "MEM-001" }).household;
  const basis: ScenarioBasis = {
    scope: { environment: household.environment, householdId: household.householdId, memberId: "MEM-002", subject: "signed-in-member", viewerRoom: "personal", targetRoom: "household", fundId: household.householdFund!.id, authorityGeneration: "generation-1" },
    acceptedRevision: household.revision, acceptedStateId: "accepted-state-1", sharedFactsDigest: "shared-facts-1", ownSourceFactsDigest: "own-source-facts-1", asOf, through,
  };
  const request: FundScenarioRequest = { version: 1, basis: structuredClone(basis), elections: [{ id: "choice-1", chosenByMemberId: "MEM-002", contributionOn: asOf, kind: "fixed", chosenCents: 4600, allocations: [{ trancheId: "reviewed-cash", cents: 4600 }], replaces: [] }] };
  return { household, basis, request, review: (r = request, b = basis) => reviewFundScenarioRequest(household, b, r) };
}
function code(value: ReturnType<typeof reviewFundScenarioRequest>) { return value.kind === "refused" ? value.reasons[0]!.code : value.kind; }

describe("in-memory Fund scenario request boundary", () => {
  it("reviews intent without projecting or changing accepted money; detaches the reviewed request", () => {
    const f = fixture(), before = JSON.stringify(f.household), input = JSON.stringify(f.request);
    const result = f.review();
    expect(result.kind).toBe("request-reviewed");
    expect(result).not.toHaveProperty("balanceCents");
    if (result.kind !== "request-reviewed") throw Error("unexpected refusal");
    expect(result.request).toEqual(f.request); expect(result.request).not.toBe(f.request);
    expect(result.request.basis.scope).not.toBe(f.request.basis.scope);
    expect(JSON.stringify(f.household)).toBe(before); expect(JSON.stringify(f.request)).toBe(input);
  });
  it.each(["environment", "householdId", "memberId", "subject", "viewerRoom", "targetRoom", "fundId", "authorityGeneration"] as const)("refuses changed %s", field => {
    const f = fixture();
    const scope = { ...f.request.basis.scope, [field]: "changed" } as ScenarioScope;
    expect(code(f.review({ ...f.request, basis: { ...f.basis, scope } }))).toBe("scope-mismatch");
  });
  it.each(["acceptedRevision", "acceptedStateId", "sharedFactsDigest", "ownSourceFactsDigest", "asOf", "through"] as const)("refuses a stale %s", field => {
    const f = fixture();
    expect(code(f.review({ ...f.request, basis: { ...f.basis, [field]: field === "acceptedRevision" ? f.basis.acceptedRevision + 1 : "changed" } }))).toBe("baseline-stale");
  });
  it("refuses an untied live revision, missing Fund, inactive contributor and custodian", () => {
    const f = fixture();
    expect(code(f.review(f.request, { ...f.basis, acceptedRevision: f.household.revision + 1 }))).toBe("baseline-stale");
    expect(code(reviewFundScenarioRequest({ ...f.household, householdFund: undefined }, f.basis, f.request))).toBe("fund-missing");
    expect(code(reviewFundScenarioRequest({ ...f.household, members: f.household.members.map(m => ({ ...m, active: false })) }, f.basis, f.request))).toBe("member-ineligible");
    const basis = { ...f.basis, scope: { ...f.basis.scope, memberId: "MEM-001" } };
    expect(code(f.review({ ...f.request, basis }, basis))).toBe("member-ineligible");
  });
  it.each([["2026-01-31", "2026-03-02", "request-reviewed"], ["2026-01-31", "2026-03-03", "outside-horizon"], ["2026-02-29", "2026-03-01", "outside-horizon"], ["2026-09-08", "2026-09-07", "outside-horizon"], ["2026-09-08", "2026-09-08", "request-reviewed"]])("checks inclusive horizon %s through %s", (from, through, expected) => {
    expect(code(fixture(from, through).review())).toBe(expected);
  });
  it.each([-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("refuses unsupported cent amount %s", amount => {
    const f = fixture(), election = f.request.elections[0]!;
    expect(code(f.review({ ...f.request, elections: [{ ...election, kind: "fixed", chosenCents: amount, allocations: [{ trancheId: "cash", cents: amount }] }] }))).toBe("unsafe-cents");
  });
  it("refuses aggregate overflow across otherwise valid choices", () => {
    const f = fixture(), election = f.request.elections[0]!;
    const a = { ...election, kind: "fixed" as const, chosenCents: Number.MAX_SAFE_INTEGER, allocations: [{ trancheId: "cash", cents: Number.MAX_SAFE_INTEGER }] };
    expect(code(f.review({ ...f.request, elections: [a, { ...a, id: "another", chosenCents: 1, allocations: [{ trancheId: "cash", cents: 1 }] }] }))).toBe("unsafe-cents");
  });
  it("requires own dated choices, distinct identities and exact allocation totals", () => {
    const f = fixture(), a = f.request.elections[0]!;
    expect(code(f.review({ ...f.request, elections: [{ ...a, chosenByMemberId: "MEM-001" }] }))).toBe("source-not-owned");
    expect(code(f.review({ ...f.request, elections: [{ ...a, contributionOn: "2026-10-09" }] }))).toBe("outside-horizon");
    expect(code(f.review({ ...f.request, elections: [a, a] }))).toBe("invalid-election");
    expect(code(f.review({ ...f.request, elections: [{ ...a, kind: "fixed", chosenCents: 4600, allocations: [{ trancheId: "cash", cents: 2300 }, { trancheId: "cash", cents: 2300 }] }] }))).toBe("invalid-election");
    expect(code(f.review({ ...f.request, elections: [{ ...a, kind: "fixed", chosenCents: 4600, allocations: [{ trancheId: "cash", cents: 1 }] }] }))).toBe("invalid-election");
  });
  it("keeps zero as baseline identity and requires explicit distinct replacement references", () => {
    const f = fixture(), a = f.request.elections[0]!;
    const zero = { ...a, kind: "fixed" as const, chosenCents: 0, allocations: [] };
    expect(code(f.review({ ...f.request, elections: [] }))).toBe("request-reviewed");
    expect(code(f.review({ ...f.request, elections: [zero] }))).toBe("request-reviewed");
    const replacement = { id: "estimate:MEM-002:2026-09-15", factsDigest: "reviewed-estimate" };
    expect(code(f.review({ ...f.request, elections: [{ ...zero, replaces: [replacement] }] }))).toBe("zero-election-replacement");
    expect(code(f.review({ ...f.request, elections: [{ ...a, replaces: [replacement] }, { ...a, id: "other", replaces: [replacement] }] }))).toBe("replacement-duplicated");
    expect(code(f.review({ ...f.request, elections: [{ ...a, replaces: [{ ...replacement, factsDigest: "" }] }] }))).toBe("replacement-missing");
  });
  it("represents an explicitly chosen up-to cap without inferring it from earnings", () => {
    const f = fixture(), a = f.request.elections[0]!;
    const request: FundScenarioRequest = { ...f.request, elections: [{ ...a, kind: "available-up-to", maximumCents: 4600, allocations: [{ trancheId: "named-availability", maximumCents: 4600 }] }] };
    expect(f.review(request)).toEqual({ kind: "request-reviewed", request });
    expect(code(f.review({ ...request, elections: [{ ...request.elections[0]!, kind: "available-up-to", maximumCents: 4600, allocations: [] }] }))).toBe("invalid-election");
  });
});
