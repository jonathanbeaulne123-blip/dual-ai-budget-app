import { describe, expect, it } from "vitest";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import {
  addGoal,
  fundGoal,
  purchaseGoal,
  saveGoalEnvelope,
  splitForSync,
  assembleHousehold,
  reversePostedMoney,
  undoLedgerConfirm,
  reverseHouseholdFundEvent,
  postEntry,
  releaseHouseholdFundKitty,
  savePlanDraft,
  type Household,
} from "../src/core/index.ts";
import {
  defaultGoalEnvelope,
  shapeGoalEnvelope,
  goalEnvelopeUsedCents,
  goalFundReserve,
  assertGoalEnvelopeTransition,
} from "../src/core/goalEnvelopes.ts";
import {
  matchPlanEvidence,
  projectPlan,
  planSelectionForDraft,
} from "../src/core/planProjection.ts";
import { goalVaultCapacity } from "../src/core/goalVault.ts";
import { financialAuditHash } from "../src/core/commandIdentity.ts";
const date = "2026-09-11",
  memberId = "MEM-001";
const first = (h: Household) => h.goals[0]!;
const use = (h: Household, amount: number) =>
  purchaseGoal(h, {
    goalId: first(h).id,
    amount,
    date,
    createdBy: memberId,
    keepOpen: true,
    lines: [{ amount, note: "Fictional repair" }],
  }).household;
const reserve = (h: Household) =>
  matchPlanEvidence(
    h,
    h.planDrafts![0]!.lines[1]!,
    "2026-09",
    date,
    memberId,
    "personal",
  ).reduce((sum, row) => sum + (row.reserveCents ?? 0), 0);
describe("reusable Kitty Bank authority", () => {
  it("supports partial, partial, refill without retiring or double-reserving spent money", () => {
    let h = planLifeFixture("personal");
    const id = first(h).id;
    h = use(h, 100);
    expect(first(h).savedCents).toBe(30000);
    expect(first(h).purchaseId).toBeNull();
    expect(first(h).status).toBe("open");
    expect(reserve(h)).toBe(20000);
    h = use(h, 50);
    expect(reserve(h)).toBe(15000);
    expect(goalEnvelopeUsedCents(h, id, date)).toBe(15000);
    h = fundGoal(h, {
      goalId: id,
      amount: 70,
      fromAccountId: "ACC-CHEQUING",
      date,
      createdBy: memberId,
    }).household;
    expect(first(h).savedCents).toBe(37000);
    expect(reserve(h)).toBe(22000);
    expect(() => use(h, 221)).toThrow(/without raiding/);
    const p = projectPlan(h, {
      memberId,
      scope: "personal",
      acceptedRevision: h.revision,
      asOf: date,
      through: "2026-10-11",
      selection: planSelectionForDraft(h.planDrafts![0]!),
    });
    expect(p.lines[1]!.verifiedProgressCents).toBe(22000);
    expect(p.lines[1]!.issues).not.toContain(
      "Some goal progress lacks current backing evidence; it is not available reserve money.",
    );
  });
  it("protects another bank and cannot turn unallocated vault cash into this bank's allocation", () => {
    let h = planLifeFixture("personal");
    h = use(h, 100);
    const other = addGoal(h, {
      name: "Other private purpose",
      target: 100,
      shared: false,
      ownerMemberId: memberId,
    });
    h = fundGoal(other.household, {
      goalId: other.postedIds[0]!,
      amount: 100,
      fromAccountId: "ACC-CHEQUING",
      date,
      createdBy: memberId,
    }).household;
    const capacity = goalVaultCapacity(h, other.postedIds[0]!, date);
    expect(capacity.kind === "ready" && capacity.reservedCents).toBe(20000);
    h = postEntry(h, {
      date,
      type: "income",
      amount: 1000,
      accountId: "ACC-GOALS",
      subcategoryId: "SUB-INCOME-WAGES",
      createdBy: memberId,
      visibility: "personal",
    }).household;
    expect(() => use(h, 201)).toThrow();
  });
  it("archive preserves backing and history, restores, and rejects another owner", () => {
    const h = planLifeFixture("personal"),
      goal = first(h),
      before = reserve(h);
    const input = {
      goalId: goal.id,
      expectedUpdatedAt: goal.updatedAt,
      name: goal.name,
      target: goal.targetCents / 100,
      arrivalDate: goal.arrivalDate,
      envelope: {
        ...defaultGoalEnvelope(),
        archivedAt: new Date().toISOString(),
      },
      createdBy: memberId,
    };
    const archived = saveGoalEnvelope(h, input).household;
    expect(reserve(archived)).toBe(before);
    expect(archived.transactions).toEqual(h.transactions);
    expect(() => use(archived, 10)).toThrow(/Restore/);
    expect(() =>
      fundGoal(archived, {
        goalId: goal.id,
        amount: 10,
        fromAccountId: "ACC-CHEQUING",
        date,
        createdBy: memberId,
      }),
    ).toThrow(/Restore/);
    expect(() =>
      saveGoalEnvelope(h, { ...input, createdBy: "MEM-002" }),
    ).toThrow(/outside/);
    const restored = saveGoalEnvelope(archived, {
      ...input,
      expectedUpdatedAt: first(archived).updatedAt,
      envelope: defaultGoalEnvelope(),
    }).household;
    expect(reserve(restored)).toBe(before);
  });
  it("keeps cosmetic edits out of the financial identity and private sync", async () => {
    const h = planLifeFixture("personal"),
      goal = first(h);
    const next = saveGoalEnvelope(h, {
      goalId: goal.id,
      expectedUpdatedAt: goal.updatedAt,
      name: goal.name,
      target: goal.targetCents / 100,
      arrivalDate: goal.arrivalDate,
      envelope: {
        ...defaultGoalEnvelope(),
        purpose: "PRIVATE PURPOSE CANARY",
        glaze: "rose",
      },
      createdBy: memberId,
    }).household;
    expect(await financialAuditHash(next)).toBe(await financialAuditHash(h));
    const split = splitForSync(next, memberId);
    expect(JSON.stringify(split.shared)).not.toContain(
      "PRIVATE PURPOSE CANARY",
    );
    expect(
      assembleHousehold(split.shared, split.personal).goals.find(
        (row) => row.id === goal.id,
      )?.envelope?.glaze,
    ).toBe("rose");
  });
  it("restores reserve with exact reversal and reinstatement and preserves the marker through shaping", () => {
    let h = use(planLifeFixture("personal"), 100);
    const receipt = h.goalPurchases[0]!;
    const reversed = reversePostedMoney(h, receipt.transactionIds[0]!, {
      createdBy: memberId,
      visibility: "personal",
      reversalDate: date,
    });
    expect(reserve(reversed.household)).toBe(30000);
    h = reversePostedMoney(reversed.household, reversed.postedIds[0]!, {
      createdBy: memberId,
      visibility: "personal",
      reversalDate: date,
    }).household;
    expect(reserve(h)).toBe(20000);
    const split = splitForSync(h, memberId);
    const restored = assembleHousehold(split.shared, split.personal);
    expect(restored.goalPurchases[0]!.envelopeUse).toBe("vault");
    expect(reserve(restored)).toBe(20000);
    const tampered = structuredClone(h);
    delete tampered.goalPurchases[0]!.envelopeUse;
    expect(() => assertGoalEnvelopeTransition(h, tampered)).toThrow(
      /immutable/,
    );
  });
  it("does not restore one receipt's overrefund against another expense", () => {
    let h = use(use(planLifeFixture("personal"), 100), 50);
    const original = h.transactions.find(
      (tx) => tx.id === h.goalPurchases[0]!.transactionIds[0],
    )!;
    h.transactions.push({
      ...original,
      id: "BAD-REFUND",
      type: "refund",
      refundOfId: original.id,
      amountCents: 12000,
    });
    expect(() => goalEnvelopeUsedCents(h, first(h).id, date)).toThrow(
      /corrections/,
    );
    h.transactions.pop();
    h.transactions.find((tx) => tx.id === original.id)!.visibility =
      "household";
    expect(() => goalEnvelopeUsedCents(h, first(h).id, date)).toThrow(
      /attribution/,
    );
  });
  it("an exact Fund release changes only that bank and rejects over-release", () => {
    const h = planLifeFixture("household"),
      id = first(h).id;
    const next = releaseHouseholdFundKitty(h, {
      memberId,
      goalId: id,
      amount: 100,
      date,
    }).household;
    expect(goalFundReserve(next, id, date).reservedCents).toBe(20000);
    expect(next.transactions).toEqual(h.transactions);
    expect(() =>
      releaseHouseholdFundKitty(next, {
        memberId,
        goalId: id,
        amount: 201,
        date,
      }),
    ).toThrow();
    const legacy = releaseHouseholdFundKitty(h, {
      memberId,
      amount: 1,
      date,
    }).household;
    expect(goalFundReserve(legacy, id, date).unresolved).toBe(true);
    expect(() =>
      releaseHouseholdFundKitty(legacy, {
        memberId,
        goalId: id,
        amount: 1,
        date,
      }),
    ).toThrow();
  });

  it("undo reverses the partial purchase while preserving its exact original receipt", () => {
    const h = planLifeFixture("personal"),
      purchase = purchaseGoal(h, {
        goalId: first(h).id,
        amount: 50,
        date,
        createdBy: memberId,
        keepOpen: true,
      });
    const undone = undoLedgerConfirm(purchase.household, {
      ...purchase.undo,
      actorMemberId: memberId,
    }).household;
    expect(undone.goalPurchases).toEqual(purchase.household.goalPurchases);
    expect(reserve(undone)).toBe(30000);
    expect(() =>
      assertGoalEnvelopeTransition(purchase.household, undone),
    ).not.toThrow();
  });
  it("rejects reversing allocation beneath an attributed Fund release", () => {
    const h = planLifeFixture("household"),
      id = first(h).id,
      allocation = h.fundKittyAllocations![0]!;
    const released = releaseHouseholdFundKitty(h, {
      memberId,
      goalId: id,
      amount: 100,
      date,
    }).household;
    expect(() =>
      reverseHouseholdFundEvent(released, {
        memberId,
        eventId: allocation.eventId,
        date,
        reason: "Fictional correction",
      }),
    ).toThrow();
  });
  it("links an envelope to an obligation without treating reserve as its payment", () => {
    const h = planLifeFixture("personal"),
      draft = h.planDrafts![0]!,
      lines = draft.lines.map((line, i) =>
        i === 0 ? { ...line, envelopeGoalId: first(h).id } : line,
      );
    const linked = savePlanDraft(h, {
      id: draft.id,
      expectedUpdatedAt: draft.updatedAt,
      memberId,
      createdBy: memberId,
      scope: "personal",
      targetMonth: draft.targetMonth,
      lines,
      assumptions: draft.assumptions,
    }).household;
    const opts = {
      memberId,
      scope: "personal" as const,
      acceptedRevision: h.revision,
      asOf: date,
      through: "2026-10-11",
    };
    const before = projectPlan(h, {
      ...opts,
      selection: planSelectionForDraft(draft),
    });
    const after = projectPlan(linked, {
      ...opts,
      selection: planSelectionForDraft(linked.planDrafts![0]!),
    });
    expect(after.lines[0]!.actualCents).toBe(0);
    expect(after.cashNowCents).toBe(before.cashNowCents);
    expect(after.lowPoint).toEqual(before.lowPoint);
    expect(() =>
      savePlanDraft(h, {
        memberId,
        createdBy: memberId,
        scope: "personal",
        targetMonth: draft.targetMonth,
        lines: [{ ...lines[0]!, envelopeGoalId: "missing" }],
        assumptions: [],
      }),
    ).toThrow(/visible/);
  });
});

it("replays partial purchases with the new reader capability and fences old writers", async () => {
  const { capturedIntent, clearCapturedIntent } = await import(
    "../src/ledgerSync/capture.ts"
  );
  const { commandFromCapture } = await import("../src/ledgerSync/protocol.ts");
  const { prepareCommand } = await import("../src/ledgerSync/authority.ts");
  const h = planLifeFixture("personal"),
    one = splitForSync(h, memberId),
    two = splitForSync(h, "MEM-002");
  const scope = {
    environment: h.environment,
    householdId: h.householdId,
    memberId,
    subject: "fictional-subject",
    role: "owner" as const,
    expires: Date.now() + 60000,
    aclEpoch: 1,
  };
  const state = {
    sequence: h.revision,
    shared: one.shared,
    personal: new Map([
      [memberId, one.personal],
      ["MEM-002", two.personal],
    ]),
  };
  clearCapturedIntent(h);
  const candidate = purchaseGoal(h, {
    goalId: first(h).id,
    amount: 25,
    date,
    keepOpen: true,
    createdBy: memberId,
  });
  const command = await commandFromCapture(
    capturedIntent(candidate.household)!,
    scope,
    crypto.randomUUID(),
  );
  expect(command.goalEnvelopeVersion).toBe(1);
  await expect(
    prepareCommand(
      state,
      { ...command, goalEnvelopeVersion: undefined },
      scope,
      () => {},
    ),
  ).rejects.toThrow(/CLIENT_RELOAD_REQUIRED/);
  const accepted = await prepareCommand(state, command, scope, () => {});
  expect(accepted.personal.goalPurchases![0]!.envelopeUse).toBe("vault");
  expect(JSON.stringify(accepted.shared)).not.toContain(
    "Fictional seasonal reserve",
  );
  const { captureExplicit } = await import("../src/ledgerSync/capture.ts");
  const preview = undoLedgerConfirm(accepted.household, {
    ...accepted.receipt.undo,
    snapshot: accepted.household,
  });
  captureExplicit(accepted.household, preview, "undoConfirm", [command.id]);
  const undo = await commandFromCapture(
    capturedIntent(preview.household)!,
    scope,
    crypto.randomUUID(),
  );
  const undone = await prepareCommand(
    {
      ...state,
      sequence: accepted.receipt.sequence,
      shared: accepted.shared,
      personal: new Map(state.personal).set(memberId, accepted.personal),
    },
    undo,
    scope,
    () => {},
    () => accepted.receipt,
  );
  expect(reserve(undone.household)).toBe(30000);
  expect(undone.personal.goalPurchases).toEqual(
    accepted.personal.goalPurchases,
  );
});

it("does not let a backdated partial purchase consume a later purchase's reserve", () => {
  const h = planLifeFixture("personal"),
    goalId = first(h).id;
  const later = purchaseGoal(h, {
    goalId,
    amount: 200,
    date: "2026-09-20",
    createdBy: memberId,
    keepOpen: true,
  }).household;
  expect(() =>
    purchaseGoal(later, {
      goalId,
      amount: 200,
      date: "2026-09-11",
      createdBy: memberId,
      keepOpen: true,
    }),
  ).toThrow(/accepted vault activity/);
});
it("keeps a Fund release in historical reserve until its dated reversal", () => {
  const h = planLifeFixture("household"),
    goalId = first(h).id;
  const release = releaseHouseholdFundKitty(h, {
    memberId,
    goalId,
    amount: 100,
    date,
  });
  const correction = reverseHouseholdFundEvent(release.household, {
    memberId,
    eventId: release.postedIds[0]!,
    date: "2026-10-01",
    reason: "Fictional correction",
  }).household;
  expect(goalFundReserve(correction, goalId, date).reservedCents).toBe(20000);
  expect(goalFundReserve(correction, goalId, "2026-10-01").reservedCents).toBe(
    30000,
  );
});

it("Hercules distinguishes remaining reserve from lifetime contributions", async () => {
  const { executeHerculesReadToolPlan } = await import(
    "../src/core/herculesTools.ts"
  );
  const h = use(planLifeFixture("personal"), 100);
  const result = executeHerculesReadToolPlan(
    h,
    { calls: [{ name: "goal_progress", args: { goal: first(h).id } }] },
    date,
    { memberId, view: "personal" },
  );
  const fact = result.results[0]!.facts[0]!;
  expect(fact.value).toContain("$200.00 vault reserve");
  expect(fact.value).toContain("lifetime contributions $300.00");
  expect(fact.source.goalId).toBe(first(h).id);
  expect(result.results[0]!.sentence).not.toContain("% funded");
});

it("carries studio pieces in the shared half without touching the financial identity", async () => {
  const { newKittyPiece } = await import("../src/core/kittyStudio.ts");
  const h = planLifeFixture("household"),
    goal = first(h);
  const draft = newKittyPiece("STUDIO-CANARY", "2026-09-11T10:00:00.000Z", "sea-glass");
  const next = saveGoalEnvelope(h, {
    goalId: goal.id,
    expectedUpdatedAt: goal.updatedAt,
    name: goal.name,
    target: goal.targetCents / 100,
    arrivalDate: goal.arrivalDate,
    envelope: { ...defaultGoalEnvelope(), studio: { version: 1, draft, fired: [] } },
    createdBy: memberId,
  }).household;
  expect(await financialAuditHash(next)).toBe(await financialAuditHash(h));
  expect(first(next).envelope?.glaze).toBe("sea-glass");
  const split = splitForSync(next, memberId);
  expect(JSON.stringify(split.shared)).toContain("STUDIO-CANARY");
  expect(JSON.stringify(split.personal)).not.toContain("STUDIO-CANARY");
  const restored = assembleHousehold(split.shared, split.personal);
  expect(first(restored).envelope?.studio?.draft?.id).toBe("STUDIO-CANARY");
  const fired = saveGoalEnvelope(next, {
    goalId: goal.id,
    expectedUpdatedAt: first(next).updatedAt,
    name: goal.name,
    target: goal.targetCents / 100,
    arrivalDate: goal.arrivalDate,
    envelope: first(next).envelope!,
    createdBy: memberId,
    fire: true,
  }).household;
  expect(first(fired).envelope?.studio?.fired[0]?.firedBy).toBe(memberId);
  // A fired piece is editable again (2026-09-12): reshaping one on the shelf is
  // an ordinary envelope change, not a rejected transition.
  const reshaped = structuredClone(fired);
  reshaped.goals[0]!.envelope!.studio!.fired[0]!.sculpt.head = "wedge";
  expect(() => assertGoalEnvelopeTransition(fired, reshaped)).not.toThrow();
  expect(shapeGoalEnvelope(defaultGoalEnvelope())?.studio).toBeUndefined();
});
