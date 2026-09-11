import { describe, expect, it } from "vitest";
import { addPotentialExpense, catalogHousehold, dismissPotentialExpenseNotice, movePotentialExpense, postPotentialExpense, removePotentialExpense, updatePotentialExpense, splitForSync, assembleHousehold } from "../src/core/index.ts";
import { personalCalendarUpdateAllowed } from "../src/core/personalCalendarAuthority.ts";
const input = { date: "2026-09-11", title: "Private travel", amount: "20", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: "MEM-001", visibility: "personal" as const };
it("allows the private plan lifecycle and round-trips only through its owner's envelope", () => {
  let h = catalogHousehold();
  let result = addPotentialExpense(h, input);
  expect(personalCalendarUpdateAllowed(h, result, input.createdBy)).toBe(true);
  h = result.household;
  const id = h.potentialExpenses[0]!.id;
  for (const command of [
    () => updatePotentialExpense(h, { ...input, id, title: "Updated private travel" }),
    () => movePotentialExpense(h, { id, date: "2026-09-12", createdBy: input.createdBy }),
    () => dismissPotentialExpenseNotice(h, { id, date: "2026-09-12", createdBy: input.createdBy }),
    () => postPotentialExpense(h, { id, createdBy: input.createdBy }),
  ]) {
    result = command();
    expect(personalCalendarUpdateAllowed(h, result, input.createdBy), result.undo.commandKind).toBe(true);
    h = result.household;
  }
  const pair = splitForSync(h, input.createdBy);
  expect(pair.shared.potentialExpenses).toEqual([]);
  expect(pair.shared.transactions).toEqual([]);
  expect(assembleHousehold(pair.shared, pair.personal).potentialExpenses[0]!.status).toBe("posted");
  const planned = addPotentialExpense(catalogHousehold(), input).household;
  expect(personalCalendarUpdateAllowed(planned, removePotentialExpense(planned, { id: planned.potentialExpenses[0]!.id, createdBy: input.createdBy }), input.createdBy)).toBe(true);
});
describe("rejects unrelated and cross-member mutations", () => {
  it.each(["member", "shared", "otherPlan", "account", "receipt", "kind"])("rejects %s", attack => {
    const h = catalogHousehold(), result = addPotentialExpense(h, input);
    if (attack === "member") result.personalMemberId = "MEM-002";
    if (attack === "shared") result.household.potentialExpenses[0]!.visibility = "household";
    if (attack === "otherPlan") result.household.potentialExpenses.push({ ...result.household.potentialExpenses[0]!, id: "other", createdBy: "MEM-002" });
    if (attack === "account") result.household.accounts[0]!.name = "Changed";
    if (attack === "receipt") result.household.transactions.push({ id: "smuggled" } as never);
    if (attack === "kind") result.undo.commandKind = "unknown";
    expect(personalCalendarUpdateAllowed(h, result, input.createdBy)).toBe(false);
  });
});

it("routes a Fund-backed Personal posting through the normal mixed-scope authority", async () => {
  const { configureHouseholdFund, proposeHouseholdFundContribution, confirmHouseholdFundContribution, HOUSEHOLD_FUND_ID } = await import("../src/core/index.ts");
  const { fundContributionReviewDigest } = await import("../src/core/fundContributionSources.ts");
  const { capturedIntent, clearCapturedIntent } = await import("../src/ledgerSync/capture.ts");
  const { commandFromCapture } = await import("../src/ledgerSync/protocol.ts");
  const { prepareCommand } = await import("../src/ledgerSync/authority.ts");
  let h = configureHouseholdFund(catalogHousehold(), { custodianMemberId: "MEM-001", openedOn: input.date, createdBy: "MEM-001" }).household;
  const proposal = proposeHouseholdFundContribution(h, { source: { version: 1, kind: "external-received", explanation: "Synthetic test savings" }, memberId: "MEM-001", contributorMemberId: "MEM-001", amount: "100", date: input.date });
  h = confirmHouseholdFundContribution(proposal.household, { received: true, expectedProposalDigest: fundContributionReviewDigest(proposal.household, proposal.postedIds[0]!), memberId: "MEM-001", proposalEventId: proposal.postedIds[0]! }).household;
  h = addPotentialExpense(h, input).household;
  clearCapturedIntent(h);
  const pair = splitForSync(h, input.createdBy);
  const result = postPotentialExpense(h, { id: h.potentialExpenses[0]!.id, createdBy: input.createdBy, funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 2000, destinationAccountId: input.accountId } });
  expect(result.persistenceScope).toBeUndefined();
  const scope = { environment: h.environment, householdId: h.householdId, memberId: input.createdBy, subject: "synthetic", role: "owner" as const, expires: Date.now() + 60000, aclEpoch: 1 };
  const command = await commandFromCapture(capturedIntent(result.household)!, scope, crypto.randomUUID());
  const accepted = await prepareCommand({ sequence: h.revision, shared: pair.shared, personal: new Map([[input.createdBy, pair.personal]]) }, command, scope, () => {});
  expect(accepted.personal.potentialExpenses?.[0]?.status).toBe("posted");
  expect(accepted.shared.potentialExpenses).toEqual([]);
  expect(accepted.shared.transactions).toEqual([]);
  expect(JSON.stringify(accepted.shared)).not.toContain(input.title);
});
