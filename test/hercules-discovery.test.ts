import { describe, expect, it } from "vitest";
import { catalogHousehold, postEntry, configureHouseholdFund, addRecurrence, HOUSEHOLD_FUND_ID } from "../src/core/index.ts";
import { companionFor, commitCompanion } from "../src/core/herculesCompanion.ts";
import { buildDiscoveryFund, discoveryCandidates, discoverySelection, discoveryState, explainDiscovery, type DiscoveryInput } from "../src/core/herculesDiscovery.ts";
import { transactionsForHerculesSource } from "../src/core/herculesProvenance.ts";
import { splitForSync } from "../src/core/sync.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand } from "../src/ledgerSync/authority.ts";
function fixture(): DiscoveryInput { return { household: catalogHousehold(), memberId: "MEM-001", view: "household", tab: "home", today: "2026-09-10", now: Date.now() }; }
function state(input: DiscoveryInput, row: ReturnType<typeof discoveryState>) { return commitCompanion(input.household, { version: 1, id: crypto.randomUUID(), scope: companionFor(input.household,input.memberId).scope, operation: { kind: "suggestion.set", state: row, expectedRevision: row.revision, expectedState: input.household.companionProfile?.suggestions.find(old => old.issueId === row.issueId && old.view === row.view) ?? null } }); }
function spending(input: DiscoveryInput, date: string, amount = "4.00") { input.household = postEntry(input.household, { date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", note: "Synthetic groceries", createdBy: input.memberId, visibility: input.view, confirmDuplicate: true }).household; }
describe("Hercules useful discovery", () => {
  it("uses only drawable current-scope public Fund rows and explains the same obligation", () => {
    const input = fixture(); input.household = configureHouseholdFund(input.household,{ custodianMemberId: input.memberId, openedOn: "2026-09-01", createdBy: input.memberId }).household;
    input.household = addRecurrence(input.household,{ cadence: "monthly", nextDate: "2026-09-12", type: "expense", amount: "4.00", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Synthetic bill", fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" } }).household; input.fund = buildDiscoveryFund(input.household,input.memberId,input.view,input.today);
    expect(input.fund).not.toBeNull(); expect(input.fund!.rows.length).toBeGreaterThan(0);
    const row = discoveryCandidates(input).find(row => row.capabilityId === "explain-fund")!;
    expect(explainDiscovery(input,row.issueId)?.text).toContain("$4.00");
    expect(explainDiscovery(input,row.issueId)?.destination).toEqual({ kind: "fund", targetId: row.targetId });
    expect(discoveryCandidates({ ...input, fund: null }).some(row => row.capabilityId === "explain-fund")).toBe(false);
    expect(discoveryCandidates({ ...input, memberId: "MEM-002" }).some(row => row.capabilityId === "explain-fund")).toBe(false);
    expect(JSON.stringify(input.fund)).not.toMatch(/bankBindings|sourceClaims|accountId|sources/);
  });
  it("duplicate suggestions open only their exact pair without excluding either row", () => {
    const input = fixture(); spending(input,"2026-09-02"); spending(input,"2026-09-03");
    const row = discoveryCandidates(input).find(row => row.targetId.startsWith("duplicate:"))!;
    expect(row).toBeDefined(); const answer = explainDiscovery(input,row.issueId)!;
    expect(answer.destination?.kind).toBe("source");
    if (answer.destination?.kind !== "source") throw Error("missing source");
    expect(answer.destination.source.duplicateTransactionIds).toHaveLength(2);
    expect(transactionsForHerculesSource(input.household.transactions,answer.destination.source)).toHaveLength(2);
    expect(input.household.transactions.every(tx => !tx.isDuplicate)).toBe(true);
  });
  it("rejects an ABA renewal after an expired issue is reclaimed and recreated at revision1", () => {
    const input = fixture(), row = discoveryCandidates(input)[0]!;
    const expired = { ...discoveryState(input,row,"snooze"), revision: 1, until: "2026-01-01T00:00:00.000Z" };
    input.household.companionProfile = companionFor(input.household,input.memberId);
    input.household.companionProfile.suggestions = [expired];
    const stale = { version: 1 as const, id: crypto.randomUUID(), scope: input.household.companionProfile.scope, operation: { kind: "suggestion.set" as const, state: discoveryState(input,row,"snooze"), expectedRevision: 1, expectedState: expired } };
    input.household = commitCompanion(input.household,{ version: 1, id: crypto.randomUUID(), scope: stale.scope, operation: { kind: "remembering.set", enabled: false, expectedRevision: 0 } }).household;
    input.household = state(input,discoveryState(input,row,"snooze")).household;
    expect(input.household.companionProfile!.suggestions[0]!.revision).toBe(1);
    expect(() => commitCompanion(input.household,stale)).toThrow("STALE_SUGGESTION_STATE");
  });
  it("reclaims expired occurrence snoozes without allowing an expired create or stale update to return", () => {
    const input = fixture(), row = discoveryCandidates(input)[0]!;
    const profile = companionFor(input.household,input.memberId); input.household.companionProfile = profile;
    profile.suggestions = Array.from({ length: 100 }, (_, index) => ({ issueId: `explain-page:old-${index}`, capabilityId: "explain-page" as const, view: "household" as const, revision: 1, status: "snoozed" as const, until: "2026-01-01T00:00:00.000Z", targetId: null }));
    const expired = { ...profile.suggestions[0]! };
    input.household = state(input,discoveryState(input,row,"snooze")).household;
    expect(input.household.companionProfile!.suggestions).toHaveLength(1);
    expect(() => state(input,expired)).toThrow("STALE_COMPANION_RESOURCE");
    expect(() => state(input,{ ...expired, revision: 0 })).toThrow("SUGGESTION_EXPIRED");
  });
  it("does not fill all three recommendations with findings about the same transaction", () => {
    const input = fixture(); spending(input,"2026-09-02");
    const tx = input.household.transactions[0]!; tx.currency = "USD" as typeof tx.currency; tx.subcategoryId = "MISSING"; tx.splits = [];
    const rows = discoverySelection(input).now;
    expect(rows.filter(row => row.dedupe === `health:${tx.id}`)).toHaveLength(1);
    expect(new Set(rows.map(row => row.dedupe)).size).toBe(rows.length);
  });
  it("gives an empty household three working first choices without inventing missing data", () => {
    const input = fixture(); input.household.transactions = []; input.household.recurrences = []; input.household.kitchen.openShifts = []; input.household.kitchen.openShift = null;
    expect(new Set(discoverySelection(input).now.map(row => row.capabilityId))).toEqual(new Set(["explain-page", "guide-entry", "dress-hercules"]));
    const ids = discoveryCandidates(input).map(row => row.capabilityId);
    expect(ids).not.toContain("compare-periods"); expect(ids).not.toContain("explain-spending"); expect(ids).not.toContain("resume-shift");
  });
  it("excludes partner-private accounts and unsupported Shared tools in Personal", () => {
    const input = fixture(); input.view = "personal";
    const foreign = input.household.accounts.find(row => row.ownerMemberId === "MEM-002")!; foreign.name = "PARTNER-PRIVATE-CANARY"; foreign.scope = "personal";
    const rows = discoveryCandidates(input);
    expect(JSON.stringify(rows)).not.toContain("PARTNER-PRIVATE-CANARY");
    expect(rows.map(row => row.capabilityId)).not.toContain("bills-before-payday");
    expect(rows.map(row => row.capabilityId)).not.toContain("review-plan");
    expect(rows.map(row => row.capabilityId)).not.toContain("review-health");
  });
  it("snoozes exactly one occurrence for24hours and disables a capability across views with CAS re-enable", () => {
    const input = fixture(), row = discoveryCandidates(input).find(row => row.capabilityId === "explain-page")!;
    const snooze = discoveryState(input,row,"snooze"); input.household = state(input,snooze).household;
    expect(discoverySelection(input).now.some(item => item.issueId === row.issueId)).toBe(false);
    expect(discoverySelection({ ...input, now: input.now! + 86_400_001 }).now.some(item => item.issueId === row.issueId)).toBe(true);
    const disable = discoveryState(input,row,"disable"); input.household = state(input,disable).household;
    expect(discoverySelection({ ...input, view: "personal" }).disabled.has("explain-page")).toBe(true);
    input.household = state(input,discoveryState(input,row,"enable")).household;
    expect(discoverySelection(input).disabled.size).toBe(0);
    expect(() => state(input,disable)).toThrow("STALE_COMPANION_RESOURCE");
    expect(companionFor(input.household,input.memberId).suggestions.find(item => item.issueId === disable.issueId)?.revision).toBe(2);
  });
  it("bookmarks only an owned live shift and never resurrects a completed or foreign task", () => {
    const input = fixture(); const at = "2026-09-10T12:00:00.000Z";
    input.household.kitchen.openShifts = [{ id: "OWN-SHIFT", memberId: input.memberId, startedAt: at, endedAt: null, breaks: [], scheduledItemId: null, sourceDeviceId: null, updatedAt: at, status: "open" }, { id: "PARTNER-SHIFT", memberId: "MEM-002", startedAt: at, endedAt: null, breaks: [], scheduledItemId: null, sourceDeviceId: null, updatedAt: at, status: "open" }];
    const row = discoveryCandidates(input).find(row => row.capabilityId === "resume-shift")!;
    expect(row.targetId).toBe("OWN-SHIFT"); expect(discoverySelection(input).now[0]?.issueId).toBe(row.issueId);
    input.household = state(input,discoveryState(input,row,"resume")).household;
    expect(discoverySelection(input).resume).toHaveLength(1);
    input.household.kitchen.openShifts!.find(item => item.id === "OWN-SHIFT")!.status = "cleared";
    expect(discoverySelection(input).resume).toHaveLength(0); expect(explainDiscovery(input,row.issueId)).toBeNull();
  });
  it("requires both recorded periods and attaches coverage caveats and correct account ID sources", () => {
    const input = fixture(); spending(input,"2026-09-02");
    expect(discoveryCandidates(input).some(row => row.capabilityId === "compare-periods")).toBe(false);
    spending(input,"2026-08-20","7.00"); spending(input,"2026-09-25","16.00");
    const comparison = discoveryCandidates(input).find(row => row.capabilityId === "compare-periods")!;
    const answer = explainDiscovery(input,comparison.issueId)!;
    expect(answer.text).toContain("incomplete"); expect(answer.text).toContain("not equal-length"); expect(answer.facts.length).toBeGreaterThan(0);
    const account = discoveryCandidates(input).find(row => row.capabilityId === "explain-account" && row.targetId === "ACC-VISA")!;
    const detail = explainDiscovery(input,account.issueId)!;
    expect(detail.text).not.toContain("cannot match"); expect(detail.facts[0]?.source.accountId).toBe("ACC-VISA");
    expect(answer.text).toContain("2026-09-30"); expect(answer.facts[0]?.value).toBe("$20.00");
    expect(input.household.transactions).toHaveLength(3);
  });
  it("asks for a real payday instead of assuming one and refreshes recorded bills when selected", () => {
    const input = fixture(); input.household.recurrences[0] = { ...input.household.recurrences[0]!, id: "BILL", type: "expense", active: true, nextDate: "2026-09-12", amountCents: 1700, note: "Synthetic phone" };
    const row = discoveryCandidates(input).find(row => row.capabilityId === "bills-before-payday")!;
    expect(explainDiscovery(input,row.issueId)?.destination).toBeUndefined();
    const result = explainDiscovery({ ...input, payday: "2026-09-15" },row.issueId)!;
    expect(result.text).toContain("Next recorded occurrences only"); expect(result.facts[0]?.value).toBe("$17.00");
    expect(explainDiscovery({ ...input, payday: "2027-01-01" },row.issueId)?.destination).toBeUndefined();
    const old = row.issueId; input.household.recurrences[0]!.nextDate = "2026-09-20";
    expect(discoveryCandidates(input).find(row => row.capabilityId === "bills-before-payday")?.issueId).not.toBe(old);
  });
  it("persists suggestion settings through authenticated private authority without shared or money changes", async () => {
    const input = fixture(); const scope: Scope = { environment: input.household.environment, householdId: input.household.householdId, memberId: input.memberId, subject: "synthetic", role: "owner", expires: Date.now()+60_000, aclEpoch: 1 };
    const split = splitForSync(input.household,input.memberId), row = discoveryCandidates(input)[0]!;
    const result = state(input,discoveryState(input,row,"disable"));
    const command = await commandFromCapture(capturedIntent(result.household)!,scope,crypto.randomUUID());
    const authority = { sequence: input.household.revision, shared: split.shared, personal: new Map([[input.memberId,split.personal]]) };
    const accepted = await prepareCommand(authority,command,scope,()=>{});
    expect(accepted.receipt.postedIds).toEqual([]); expect(accepted.shared.kitchen).toEqual(split.shared.kitchen);
    expect(JSON.stringify(accepted.event.shared)).not.toContain("suggestions");
    expect(accepted.personal.companionProfile?.suggestions[0]?.status).toBe("disabled");
    await expect(prepareCommand(authority,command,{ ...scope, memberId: "MEM-002" },()=>{})).rejects.toThrow();
  });
});
