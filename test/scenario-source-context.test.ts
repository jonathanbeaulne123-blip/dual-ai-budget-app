import { describe, expect, it } from "vitest";
import { catalogHousehold, configureHouseholdFund, financialAuditHash } from "../src/core/index.ts";
import { acceptedScenarioPair, issueScenarioSource, scenarioAuthIdentityKey, type ScenarioPairScope } from "../src/scenarioSourceContext.ts";
const auth = {userId: "own-user", sessionId: "own-session", googleSubject: "own-google"};
async function fixture() {
  const h = configureHouseholdFund(catalogHousehold(), {custodianMemberId: "MEM-001", openedOn: "2026-01-01", createdBy: "MEM-001"}).household;
  h.booksAcceptedHash = await financialAuditHash(h);
  const scope: ScenarioPairScope = {environment: h.environment, householdId: h.householdId, memberId: "MEM-002", subject: auth.userId, authIdentityKey: scenarioAuthIdentityKey(h.environment, auth), authorityMode: "v2", pairEpoch: 1};
  const lease = acceptedScenarioPair(h, scope, 1)!;
  const input = {household: h, scope, lease, booksReady: true, viewerRoom: "household" as const, roomGeneration: 1, isCurrent: () => true};
  return {h, scope, lease, input};
}
describe("App scenario source issuance", () => {
  it("binds a validated pair to exact accepted object, revision and bounded receipt identity", async () => {
    const {h, input} = await fixture(), context = issueScenarioSource(input)!;
    expect(context.household).toBe(h);
    expect(context.accepted).toMatchObject({kind: "accepted", acceptedRevision: h.revision, ownBooks: "ready", scope: {targetRoom: "household", viewerRoom: "household"}});
    expect(context.accepted.acceptedStateId.length).toBeLessThanOrEqual(512);
    const sharedOnly = issueScenarioSource({...input, lease: null})!;
    expect(sharedOnly.accepted.ownBooks).toBe("unavailable");
    expect(issueScenarioSource({...input, household: {...h}})?.accepted.ownBooks).toBe("unavailable");
    expect(issueScenarioSource({...input, booksReady: false})).toBeNull();
  });
  it.each(["memberId", "subject", "authIdentityKey", "authorityMode", "pairEpoch"] as const)("does not reuse a lease after changing %s", async field => {
    const {input, scope} = await fixture();
    const changed = {...scope, [field]: field === "pairEpoch" ? 2 : field === "memberId" ? "MEM-001" : field === "authorityMode" ? "legacy" : "other"};
    expect(issueScenarioSource({...input, scope: changed})?.accepted.ownBooks).toBe("unavailable");
  });
  it("changes room authority without discarding a proven own pair", async () => {
    const {input} = await fixture(), shared = issueScenarioSource(input)!, personal = issueScenarioSource({...input, viewerRoom: "personal", roomGeneration: 2})!;
    expect(personal.accepted.ownBooks).toBe("ready");
    expect(personal.accepted.scope.viewerRoom).toBe("personal");
    expect(personal.accepted.scope.authorityGeneration).not.toBe(shared.accepted.scope.authorityGeneration);
    expect(personal.accepted.acceptedStateId).toBe(shared.accepted.acceptedStateId);
  });
  it("refuses mismatched environment/household and unaccepted receipts", async () => {
    const {h, scope, input} = await fixture();
    expect(issueScenarioSource({...input, scope: {...scope, environment: "production"}})).toBeNull();
    expect(issueScenarioSource({...input, scope: {...scope, householdId: "other"}})).toBeNull();
    expect(acceptedScenarioPair({...h, booksAcceptedHash: null}, scope, 2)).toBeNull();
    expect(acceptedScenarioPair(h, {...scope, memberId: "absent"}, 2)).toBeNull();
  });
  it("uses token-free auth identity while distinguishing new sessions and sign-ins", () => {
    const withTokens = {...auth, accessToken: "fictional-private-access", refreshToken: "fictional-private-refresh"};
    const key = scenarioAuthIdentityKey("development", withTokens);
    expect(key).toBe(scenarioAuthIdentityKey("development", auth));
    expect(key).not.toContain("fictional-private");
    expect(key).not.toBe(scenarioAuthIdentityKey("development", {...auth, sessionId: "other"}));
    expect(key).not.toBe(scenarioAuthIdentityKey("development", {...auth, userId: "other"}));
    expect(key).not.toBe(scenarioAuthIdentityKey("production", auth));
  });
});
