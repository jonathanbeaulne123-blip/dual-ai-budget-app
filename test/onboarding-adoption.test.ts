import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ONBOARDING_REGISTRY_VERSION,
  acceptHouseholdWrite,
  addCategory,
  adoptFirstBudget,
  approveOnboardingProposal,
  buildProposal,
  catalogHousehold,
  compileHousehold,
  onboardingAdoptionIdentity,
  onboardingAdoptionPlanId,
  onboardingPlanApprovalPrefix,
  setBudget,
  submitOnboardingCategories,
  submitOnboardingEstimates,
  type CommitResult,
  type Household,
} from "../src/core/index.ts";
import {
  commandIdentityHash,
  commandReceiptEnvelopeHash,
  financialAuditHashForScope,
} from "../src/core/commandIdentity.ts";
import { selectCommandConfirmationId } from "../src/core/commandConfirmation.ts";
import {
  applyCommandEventLocally,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
} from "../src/ledger/materializeSnapshotFromEvents.ts";
import { receiptToCommandRef } from "../src/ledger/continuityCommandLog.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const MONTH = "2026-10";
const NOW = "2026-09-05T15:00:00.000Z";
const CATEGORIES = ["SUB-FOOD-GROCERIES", "SUB-HOUSING-RENT"];

function activeOnboarding(household: Household): Household {
  return {
    ...household,
    householdOnboarding: {
      id: `ONBOARDING-${household.environment}-${household.householdId}`,
      environment: household.environment,
      householdId: household.householdId,
      registryVersion: ONBOARDING_REGISTRY_VERSION,
      state: "active",
      proposedByMemberId: BIANCA,
      proposedAt: "2026-09-05T14:30:00.000Z",
      handshakeExpiresAt: "2026-09-05T14:45:00.000Z",
      confirmedByMemberIds: [BIANCA, JONATHAN],
      startedAt: "2026-09-05T14:31:00.000Z",
      stoppedAt: null,
      stoppedByMemberIds: [],
      stoppedSolo: false,
      forcedUnlock: false,
      completedAt: null,
      completionDigest: null,
      createdAt: "2026-09-05T14:30:00.000Z",
      updatedAt: "2026-09-05T14:31:00.000Z",
    },
  };
}

function proposedHousehold(): { household: Household; digest: string } {
  let household = activeOnboarding(catalogHousehold("development"));
  household = submitOnboardingCategories(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    categoryIds: CATEGORIES,
    at: "2026-09-05T14:32:00.000Z",
  }).household;
  household = submitOnboardingCategories(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    categoryIds: [...CATEGORIES].reverse(),
    at: "2026-09-05T14:33:00.000Z",
  }).household;
  household = submitOnboardingEstimates(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    estimates: [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 50_000 },
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 180_000 },
    ],
    at: "2026-09-05T14:34:00.000Z",
  }).household;
  household = submitOnboardingEstimates(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    estimates: [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 60_000 },
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 190_000 },
    ],
    at: "2026-09-05T14:35:00.000Z",
  }).household;
  return { household, digest: buildProposal(household, MONTH, "2026-09-05").sourceDigest };
}

function approvedHousehold(): { household: Household; digest: string } {
  const proposed = proposedHousehold();
  let household = approveOnboardingProposal(proposed.household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    digest: proposed.digest,
  }).household;
  household = approveOnboardingProposal(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    digest: proposed.digest,
  }).household;
  return { household, digest: proposed.digest };
}

function adopt(household: Household, digest: string): CommitResult {
  return adoptFirstBudget(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    monthKey: MONTH,
    proposalDigest: digest,
  });
}

async function accept(previous: Household, committed: CommitResult) {
  return acceptHouseholdWrite({
    previous,
    candidate: committed.household,
    confirmationId: committed.undo.id,
    commandKind: committed.undo.commandKind,
    postedIds: committed.postedIds,
    actingMemberId: BIANCA,
    adapters: {
      persist: async () => undefined,
      ingest: async () => ({ ok: true }),
      validateCandidate: async () => ({ ok: true }),
      restoreIngest: async () => undefined,
    },
  });
}

describe("atomic first-budget adoption", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => vi.useRealTimers());

  it("applies every approved integer-cent row together and changes plans only", async () => {
    const { household, digest } = approvedHousehold();
    const beforeJournal = structuredClone(compileHousehold(household).entries);
    const beforeTransactions = structuredClone(household.transactions);
    const committed = adopt(household, digest);

    expect(committed.undo).toMatchObject({
      id: onboardingAdoptionIdentity(MONTH, digest),
      commandKind: "adoptFirstBudget",
      actorMemberId: BIANCA,
    });
    expect(committed.postedIds).toHaveLength(CATEGORIES.length);
    expect(committed.household.budgetPlans.filter((row) => row.monthKey === MONTH).map((row) => ({
      subcategoryId: row.subcategoryId,
      amountCents: row.amountCents,
    })).sort((left, right) => left.subcategoryId.localeCompare(right.subcategoryId))).toEqual([
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 55_000 },
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 185_000 },
    ]);
    expect(committed.household.transactions).toEqual(beforeTransactions);
    expect(compileHousehold(committed.household).entries).toEqual(beforeJournal);

    const outcome = await accept(household, committed);
    expect(outcome).toMatchObject({ ok: true, postedExactlyOnce: true, confirmationId: committed.undo.id });
    expect(outcome.household.commandReceipts.find((row) => row.confirmationId === committed.undo.id)).toMatchObject({
      commandKind: "adoptFirstBudget",
      postedIds: committed.postedIds,
      materializationHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(compileHousehold(outcome.household).entries).toEqual(beforeJournal);
  });

  it("returns the same durable receipt and performs no second write after a post-commit retry", async () => {
    const { household, digest } = approvedHousehold();
    const first = await accept(household, adopt(household, digest));
    expect(first.ok).toBe(true);
    const receipt = first.household.commandReceipts.find((row) => row.commandKind === "adoptFirstBudget")!;
    const revision = first.household.revision;
    const plans = structuredClone(first.household.budgetPlans);

    const retriedCommand = adopt(first.household, digest);
    expect(retriedCommand.household).toBe(first.household);
    expect(retriedCommand.undo.id).toBe(receipt.confirmationId);
    const duplicate = await accept(first.household, retriedCommand);
    expect(duplicate).toMatchObject({
      ok: true,
      postedExactlyOnce: true,
      duplicateOfReceiptId: receipt.confirmationId,
      confirmationId: receipt.confirmationId,
      revision: receipt.revision,
    });
    expect(duplicate.household.revision).toBe(revision);
    expect(duplicate.household.budgetPlans).toEqual(plans);
    expect(duplicate.household.commandReceipts.filter((row) => row.commandKind === "adoptFirstBudget")).toEqual([receipt]);
  });

  it("builds the same hosted command identity on two devices for one approved adoption", async () => {
    const { household, digest } = approvedHousehold();
    const phoneA = adopt(structuredClone(household), digest);
    const phoneBHousehold = structuredClone(household);
    phoneBHousehold.members.reverse();
    phoneBHousehold.categories.reverse();
    phoneBHousehold.onboardingSubmissions?.reverse();
    phoneBHousehold.onboardingApprovals?.reverse();
    const phoneB = adopt(phoneBHousehold, digest);

    expect(phoneB.undo.id).toBe(phoneA.undo.id);
    expect(phoneB.postedIds).toEqual(phoneA.postedIds);
    expect(phoneB.household.budgetPlans.filter((row) => phoneB.postedIds.includes(row.id))).toEqual(
      phoneA.household.budgetPlans.filter((row) => phoneA.postedIds.includes(row.id)),
    );
    expect(await commandIdentityHash(household, phoneA.household, phoneA.postedIds)).toBe(
      await commandIdentityHash(phoneBHousehold, phoneB.household, phoneB.postedIds),
    );
  });

  it("rejects a stale proposal digest before changing any plan", () => {
    const { household, digest } = approvedHousehold();
    const edited = submitOnboardingEstimates(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      estimates: [
        { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 70_000 },
        { subcategoryId: "SUB-HOUSING-RENT", amountCents: 180_000 },
      ],
      at: "2026-09-05T14:40:00.000Z",
    }).household;
    const before = structuredClone(edited.budgetPlans);
    expect(() => adopt(edited, digest)).toThrow("The first-plan proposal changed");
    expect(edited.budgetPlans).toEqual(before);
  });

  it("requires the active actor, active household mode, and exact target-month category set", () => {
    const { household, digest } = approvedHousehold();
    expect(() => adoptFirstBudget(household, {
      memberId: BIANCA,
      createdBy: JONATHAN,
      monthKey: MONTH,
      proposalDigest: digest,
    })).toThrow("Only an active household member");

    const paused: Household = {
      ...household,
      householdOnboarding: { ...household.householdOnboarding!, state: "paused-safe" },
    };
    expect(() => adopt(paused, digest)).toThrow("Resume household setup together");

    const extraPlan = setBudget(household, {
      monthKey: MONTH,
      subcategoryId: "SUB-LIFE-PHONE",
      amount: 95,
    }).household;
    expect(() => adopt(extraPlan, digest)).toThrow("categories outside this proposal");
    expect(household.budgetPlans).not.toEqual(extraPlan.budgetPlans);
  });

  it("never overwrites an existing accepted plan without both exact approvals", () => {
    const proposed = proposedHousehold();
    const withPlan = setBudget(proposed.household, {
      monthKey: MONTH,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: 10,
    }).household;
    const oneApproval = approveOnboardingProposal(withPlan, {
      memberId: BIANCA,
      createdBy: BIANCA,
      digest: buildProposal(withPlan, MONTH, "2026-09-05").sourceDigest,
    }).household;
    const before = structuredClone(oneApproval.budgetPlans);
    expect(() => adopt(oneApproval, proposed.digest)).toThrow("Both household members must approve");
    expect(oneApproval.budgetPlans).toEqual(before);

    const approved = approvedHousehold();
    vi.setSystemTime(new Date("2026-09-05T14:00:00.000Z"));
    const skewedAfterApproval = setBudget(approved.household, {
      monthKey: MONTH,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: 10,
    }).household;
    expect(() => adopt(skewedAfterApproval, approved.digest)).toThrow("current plan changed after an approval");

    vi.setSystemTime(new Date(NOW));
    const equalClockAfterApproval = setBudget(approved.household, {
      monthKey: MONTH,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: 10,
    }).household;
    expect(() => adopt(equalClockAfterApproval, approved.digest)).toThrow("current plan changed after an approval");

    vi.setSystemTime(new Date("2026-09-05T15:01:00.000Z"));
    const changedAfterApproval = setBudget(approved.household, {
      monthKey: MONTH,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: 10,
    }).household;
    expect(() => adopt(changedAfterApproval, approved.digest)).toThrow("current plan changed after an approval");

    vi.setSystemTime(new Date("2026-09-05T15:02:00.000Z"));
    let reviewed = approveOnboardingProposal(changedAfterApproval, {
      memberId: BIANCA,
      createdBy: BIANCA,
      digest: approved.digest,
    }).household;
    reviewed = approveOnboardingProposal(reviewed, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      digest: approved.digest,
    }).household;
    expect(adopt(reviewed, approved.digest).household.budgetPlans.find(
      (row) => row.active && row.monthKey === MONTH && row.subcategoryId === "SUB-FOOD-GROCERIES",
    )?.amountCents).toBe(55_000);
  });

  it("preflights every deterministic row identity before starting the batch", () => {
    const { household, digest } = approvedHousehold();
    const proposal = buildProposal(household, MONTH, "2026-09-05");
    const seeded = setBudget(household, {
      monthKey: MONTH,
      subcategoryId: proposal.rows[0]!.subcategoryId,
      amount: 1,
    }).household.budgetPlans.at(-1)!;
    const poisoned: Household = {
      ...household,
      budgetPlans: [{
        ...seeded,
        id: onboardingAdoptionPlanId(MONTH, digest, 1),
        active: false,
      }],
    };
    const before = structuredClone(poisoned.budgetPlans);

    expect(() => adopt(poisoned, digest)).toThrow("identity is already in use");
    expect(poisoned.budgetPlans).toEqual(before);
  });

  it("binds proposal approvals to a collision-resistant exact plan snapshot", () => {
    const household = catalogHousehold("development");
    const plans = [...household.budgetPlans]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((plan) => ({
        id: plan.id,
        monthKey: plan.monthKey,
        subcategoryId: plan.subcategoryId,
        amountCents: plan.amountCents,
        essential: plan.essential,
        incomeStability: plan.incomeStability,
        active: plan.active,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      }));
    const expected = createHash("sha256").update(JSON.stringify(plans)).digest("hex");
    expect(onboardingPlanApprovalPrefix(household)).toBe(`ONB-APP-PLAN-${expected}-`);

    const changed = setBudget(household, {
      monthKey: MONTH,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: 10,
    }).household;
    expect(onboardingPlanApprovalPrefix(changed)).not.toBe(onboardingPlanApprovalPrefix(household));
  });

  it("rejects a forced partial candidate at the acceptance boundary and keeps the prior batch deep-equal", async () => {
    const { household, digest } = approvedHousehold();
    const full = adopt(household, digest);
    const firstId = full.postedIds[0]!;
    const partial: Household = {
      ...full.household,
      budgetPlans: full.household.budgetPlans.filter((row) => row.id === firstId),
    };
    let persisted = false;
    const outcome = await acceptHouseholdWrite({
      previous: household,
      candidate: partial,
      confirmationId: full.undo.id,
      commandKind: full.undo.commandKind,
      postedIds: full.postedIds,
      actingMemberId: BIANCA,
      adapters: {
        persist: async () => { persisted = true; },
        ingest: async () => ({ ok: true }),
      },
    });
    expect(outcome).toMatchObject({ ok: false, postedNothing: true, errorClass: "validation-rejected" });
    expect(outcome.household.budgetPlans).toEqual(household.budgetPlans);
    expect(persisted).toBe(false);
  });

  it("replays the bounded plan batch and rejects tampered adoption facts", async () => {
    const { household, digest } = approvedHousehold();
    const accepted = await accept(household, adopt(household, digest));
    expect(accepted.ok).toBe(true);
    const receipt = accepted.household.commandReceipts.find((row) => row.commandKind === "adoptFirstBudget")!;
    const ref = receiptToCommandRef({ household: accepted.household, receipt, baseRevision: household.revision });
    const event: ContinuityCommandEvent = {
      id: "EVT-ONBOARDING-ADOPTION",
      environment: household.environment,
      household_id: household.householdId,
      member_id: BIANCA,
      idempotency_key: receipt.confirmationId,
      confirmation_id: receipt.confirmationId,
      identity_hash: receipt.identityHash,
      base_revision: household.revision,
      result_revision: accepted.household.revision,
      ledger_scope: "shared",
      command_type: "adoptFirstBudget",
      payload_json: {
        ...ref.commandPayload,
        auditHash: await financialAuditHashForScope(accepted.household, "shared", BIANCA),
        materializationFacts: extractMaterializationFacts(accepted.household, receipt.postedIds, {
          ledgerScope: "shared",
          memberId: BIANCA,
          commandKind: "adoptFirstBudget",
        }),
      },
      created_at: NOW,
    };
    const applied = await applyCommandEventLocally({ local: household, event, memberId: BIANCA });
    expect(applied).toEqual(expect.objectContaining({ ok: true, duplicate: false }));
    if (applied.ok) {
      expect(applied.household.budgetPlans).toEqual(accepted.household.budgetPlans);
      expect(applied.household.commandReceipts.at(-1)).toMatchObject({ commandKind: "adoptFirstBudget" });
    }

    const plans = event.payload_json.materializationFacts!.budgetPlans!;
    const tampered = await applyCommandEventLocally({
      local: household,
      event: {
        ...event,
        payload_json: {
          ...event.payload_json,
          materializationFacts: {
            ...event.payload_json.materializationFacts,
            budgetPlans: plans.map((row, index) => index === 0 ? { ...row, amountCents: row.amountCents + 1 } : row),
          },
        },
      },
      memberId: BIANCA,
    });
    expect(tampered).toEqual({
      ok: false,
      reason: "onboarding-adoption-materialization-mismatch",
      fallback: true,
    });

    for (const [index, malformed] of [
      null,
      7,
      {},
      { ...plans[0]!, note: "smuggled" },
    ].entries()) {
      const rejected = await applyCommandEventLocally({
        local: household,
        event: {
          ...event,
          id: `EVT-ONBOARDING-ADOPTION-MALFORMED-${index}`,
          payload_json: {
            ...event.payload_json,
            materializationFacts: {
              ...event.payload_json.materializationFacts,
              budgetPlans: [malformed] as unknown as typeof plans,
            },
          },
        },
        memberId: BIANCA,
      });
      expect(rejected).toEqual({
        ok: false,
        reason: "onboarding-adoption-plan-invalid",
        fallback: true,
      });
    }

    const descriptorFields = {
      confirmationId: event.confirmation_id,
      commandKind: event.command_type,
      ledgerScope: event.ledger_scope,
      materializationHash: ref.commandPayload.materializationHash,
      auditHash: ref.commandPayload.auditHash,
      identityHash: ref.commandPayload.identityHash,
      revision: ref.commandPayload.revision,
      acceptedAt: ref.commandPayload.acceptedAt,
      postedIds: [...event.payload_json.postedIds],
    };
    const descriptor = {
      ...descriptorFields,
      receiptHash: await commandReceiptEnvelopeHash(descriptorFields),
    };
    const compactedEvent: ContinuityCommandEvent = {
      ...event,
      id: "EVT-ONBOARDING-ADOPTION-COMPACTED",
      payload_json: {
        ...event.payload_json,
        compactedCommands: [descriptor],
        compactedConfirmationIds: [descriptor.confirmationId],
      },
    };
    expect(await applyCommandEventLocally({ local: household, event: compactedEvent, memberId: BIANCA }))
      .toEqual(expect.objectContaining({ ok: true, duplicate: false }));

    const laterDescriptorFields = {
      confirmationId: "CONF-LATER-SHARED",
      commandKind: "laterSharedCatalogCommand",
      ledgerScope: "shared" as const,
      identityHash: "later-command-identity",
      auditHash: descriptor.auditHash,
      revision: receipt.revision + 1,
      acceptedAt: "2026-09-06T15:00:00.000Z",
      postedIds: [] as string[],
    };
    const laterDescriptor = {
      ...laterDescriptorFields,
      receiptHash: await commandReceiptEnvelopeHash(laterDescriptorFields),
    };
    const adoptionBundledBehindLater: ContinuityCommandEvent = {
      ...compactedEvent,
      id: "EVT-ONBOARDING-ADOPTION-NONPRIMARY",
      idempotency_key: laterDescriptor.confirmationId,
      confirmation_id: laterDescriptor.confirmationId,
      identity_hash: laterDescriptor.identityHash,
      result_revision: laterDescriptor.revision,
      command_type: laterDescriptor.commandKind,
      payload_json: {
        ...compactedEvent.payload_json,
        confirmationId: laterDescriptor.confirmationId,
        identityHash: laterDescriptor.identityHash,
        commandKind: laterDescriptor.commandKind,
        revision: laterDescriptor.revision,
        acceptedAt: laterDescriptor.acceptedAt,
        compactedCommands: [descriptor, laterDescriptor],
        compactedConfirmationIds: [descriptor.confirmationId, laterDescriptor.confirmationId],
      },
    };
    const bundled = await applyCommandEventLocally({
      local: household,
      event: adoptionBundledBehindLater,
      memberId: BIANCA,
    });
    expect(bundled).toEqual(expect.objectContaining({ ok: true, duplicate: false }));
    if (bundled.ok) {
      expect(bundled.household.commandReceipts.find(
        (row) => row.confirmationId === descriptor.confirmationId,
      )).toMatchObject({
        identityHash: descriptor.identityHash,
        commandKind: "adoptFirstBudget",
        postedIds: descriptor.postedIds,
        revision: descriptor.revision,
        acceptedAt: descriptor.acceptedAt,
      });
    }

    for (const [index, changedDescriptor] of [
      { ...descriptor, auditHash: "0".repeat(64) },
      { ...descriptor, identityHash: "0".repeat(64) },
      { ...descriptor, revision: event.result_revision + 1 },
      { ...descriptor, acceptedAt: "2026-09-05T14:59:00.000Z" },
    ].entries()) {
      expect(await applyCommandEventLocally({
        local: household,
        event: {
          ...compactedEvent,
          id: `EVT-ONBOARDING-ADOPTION-RECEIPT-TAMPER-${index}`,
          payload_json: {
            ...compactedEvent.payload_json,
            compactedCommands: [changedDescriptor],
          },
        },
        memberId: BIANCA,
      })).toEqual({
        ok: false,
        reason: "onboarding-adoption-authority-mismatch",
        fallback: true,
      });
    }

    for (const [index, payload] of [
      { compactedConfirmationIds: [] },
      { postedIds: event.payload_json.postedIds.slice(1) },
      { compactedCommands: [descriptor, descriptor], compactedConfirmationIds: [descriptor.confirmationId, descriptor.confirmationId] },
    ].entries()) {
      const rejected = await applyCommandEventLocally({
        local: household,
        event: {
          ...compactedEvent,
          id: `EVT-ONBOARDING-ADOPTION-COMPACTED-TAMPER-${index}`,
          payload_json: { ...compactedEvent.payload_json, ...payload },
        },
        memberId: BIANCA,
      });
      expect(rejected).toEqual({
        ok: false,
        reason: "onboarding-adoption-materialization-mismatch",
        fallback: true,
      });
    }

    expect(await applyCommandEventLocally({
      local: household,
      event: { ...event, id: "EVT-ONBOARDING-ADOPTION-WRONG-ACTOR", member_id: "MEM-GHOST" },
      memberId: BIANCA,
    })).toEqual({
      ok: false,
      reason: "onboarding-adoption-authority-mismatch",
      fallback: true,
    });
  });

  it("rejects activity truncation, extra Shared fields, and inactive duplicate retries", async () => {
    const { household, digest } = approvedHousehold();
    const full = adopt(household, digest);
    for (const candidate of [
      { ...full.household, activity: full.household.activity.slice(1) },
      {
        ...full.household,
        activity: full.household.activity.map((row, index, rows) => (
          index === rows.length - 1 ? { ...row, note: "smuggled" } : row
        )),
      },
    ] as Household[]) {
      const outcome = await acceptHouseholdWrite({
        previous: household,
        candidate,
        confirmationId: full.undo.id,
        commandKind: full.undo.commandKind,
        postedIds: full.postedIds,
        actingMemberId: BIANCA,
        adapters: { persist: async () => undefined, ingest: async () => ({ ok: true }) },
      });
      expect(outcome).toMatchObject({ ok: false, postedNothing: true, errorClass: "validation-rejected" });
      expect(outcome.household.activity).toEqual(household.activity);
    }

    const accepted = await accept(household, full);
    expect(accepted.ok).toBe(true);
    expect(() => adoptFirstBudget(accepted.household, {
      memberId: "MEM-GHOST",
      createdBy: "MEM-GHOST",
      monthKey: MONTH,
      proposalDigest: digest,
    })).toThrow("Only an active household member");
    let persisted = false;
    const duplicate = await acceptHouseholdWrite({
      previous: accepted.household,
      candidate: accepted.household,
      confirmationId: full.undo.id,
      commandKind: full.undo.commandKind,
      postedIds: full.postedIds,
      actingMemberId: "MEM-GHOST",
      adapters: {
        persist: async () => { persisted = true; },
        ingest: async () => ({ ok: true }),
      },
    });
    expect(duplicate).toMatchObject({ ok: false, postedNothing: true, errorClass: "validation-rejected" });
    expect(persisted).toBe(false);
  });

  it("does not widen ordinary category commands into adoption plan materialization", () => {
    const household = catalogHousehold("development");
    const category = addCategory(household, {
      name: "First-plan neighbor",
      type: "expense",
      parentId: "CAT-LIFE",
      monthlyBudget: 75,
      monthKey: MONTH,
    });

    expect(category.postedIds.some((id) => id.startsWith("BUD-"))).toBe(true);
    expect(extractMaterializationFacts(category.household, category.postedIds, {
      ledgerScope: "shared",
      memberId: BIANCA,
      commandKind: category.undo.commandKind,
    }).budgetPlans).toBeUndefined();
  });

  it("clears an older ambient retry id when adoption supplies its own identity", () => {
    const adoption = selectCommandConfirmationId("ONB-ADOPT-EXACT", "CONF-OLDER", () => "CONF-NEW");
    expect(adoption).toEqual({
      confirmationId: "ONB-ADOPT-EXACT",
      pendingConfirmationId: null,
    });
    expect(selectCommandConfirmationId(undefined, adoption.pendingConfirmationId, () => "CONF-NEXT"))
      .toEqual({ confirmationId: "CONF-NEXT", pendingConfirmationId: "CONF-NEXT" });
  });

  it("keeps the adoption path out of journal, transfer, schema, and provider code", () => {
    const adoption = readFileSync("src/core/onboarding/adoption.ts", "utf8");
    const commands = readFileSync("src/core/commands.ts", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");
    expect(adoption).not.toMatch(/postEntry|postTransfer|journal|supabase|localStorage|fetch\s*\(/);
    expect(commands).toContain("export function adoptFirstBudget");
    expect(app).toContain('token?.commandKind === "adoptFirstBudget" ? token.id : undefined');
    expect(app).toContain("confirmationRef.current = confirmation.pendingConfirmationId");
  });
});
