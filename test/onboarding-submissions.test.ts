import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assembleHousehold,
  acceptHouseholdWrite,
  catalogHousehold,
  compileHousehold,
  currentSubmission,
  mergeShared,
  mergedCategorySelection,
  mergeSubmissions,
  postEntry,
  shapeOnboardingSubmissions,
  splitForSync,
  submitOnboardingCategories,
  submitOnboardingEstimates,
  type Household,
  type OnboardingSubmission,
} from "../src/core/index.ts";
import {
  commandMaterializationFacts,
  financialAuditHashForScope,
  sha256Hex,
} from "../src/core/commandIdentity.ts";
import {
  applyCommandEventLocally,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
} from "../src/ledger/materializeSnapshotFromEvents.ts";
import {
  compactedCommandPayload,
  type ContinuityCommandRef,
} from "../src/ledger/continuityCommandLog.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const AT = "2026-09-04T18:00:00.000Z";

function submitCategories(
  household: Household,
  memberId: string,
  categoryIds: string[],
  at = AT,
) {
  return submitOnboardingCategories(household, {
    memberId,
    createdBy: memberId,
    categoryIds,
    at,
  });
}

function submitEstimates(
  household: Household,
  memberId: string,
  estimates: Array<{ subcategoryId: string; amountCents: number }>,
  at = AT,
) {
  return submitOnboardingEstimates(household, {
    memberId,
    createdBy: memberId,
    estimates,
    at,
  });
}

describe("onboarding submission contract", () => {
  it("accepts only an explicitly attributed self submission", () => {
    const household = catalogHousehold("development");

    expect(() => submitOnboardingCategories(household, {
      memberId: BIANCA,
      createdBy: JONATHAN,
      categoryIds: ["SUB-FOOD"],
      at: AT,
    })).toThrow("Only you can submit your own.");
    expect(() => submitOnboardingCategories(household, {
      memberId: BIANCA,
      createdBy: undefined as unknown as string,
      categoryIds: ["SUB-FOOD"],
      at: AT,
    })).toThrow("Only you can submit your own.");
    expect(() => submitOnboardingCategories(household, {
      memberId: "MEM-GHOST",
      createdBy: "MEM-GHOST",
      categoryIds: ["SUB-FOOD"],
      at: AT,
    })).toThrow("Only you can submit your own.");
    expect(household.onboardingSubmissions).toBeUndefined();
  });

  it("publishes only normalized ids at Submit and changes no journal entry", () => {
    const household = catalogHousehold("development");
    const journalBefore = compileHousehold(household).entries;
    const saved = submitCategories(household, BIANCA, ["SUB-TRANSIT", "SUB-FOOD", "SUB-FOOD"]);
    const row = currentSubmission(saved.household, BIANCA, "categories");

    expect(saved.postedIds).toEqual([row?.id]);
    expect(row).toEqual({
      id: expect.stringMatching(/^ONB-SUB-/),
      householdId: household.householdId,
      memberId: BIANCA,
      kind: "categories",
      revision: 1,
      categoryIds: ["SUB-FOOD", "SUB-TRANSIT"],
      estimates: [],
      submittedAt: AT,
      supersededBy: null,
    });
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "categoryIds",
      "estimates",
      "householdId",
      "id",
      "kind",
      "memberId",
      "revision",
      "submittedAt",
      "supersededBy",
    ]);
    expect(saved.household.transactions).toEqual(household.transactions);
    expect(compileHousehold(saved.household).entries).toEqual(journalBefore);
  });

  it("replaces by appending a new revision and linking the prior record without mutating the input", () => {
    const first = submitCategories(catalogHousehold("development"), BIANCA, ["SUB-FOOD"]);
    const firstRow = currentSubmission(first.household, BIANCA, "categories")!;
    const second = submitCategories(
      first.household,
      BIANCA,
      ["SUB-HOUSING", "SUB-FOOD"],
      "2026-09-04T18:01:00.000Z",
    );
    const secondRow = currentSubmission(second.household, BIANCA, "categories")!;
    const retained = second.household.onboardingSubmissions?.find((row) => row.id === firstRow.id);

    expect(first.household.onboardingSubmissions?.[0]?.supersededBy).toBeNull();
    expect(retained).toMatchObject({ revision: 1, supersededBy: secondRow.id });
    expect(secondRow).toMatchObject({ revision: 2, supersededBy: null });
    expect(second.postedIds).toEqual([firstRow.id, secondRow.id]);
    expect(second.household.onboardingSubmissions).toHaveLength(2);
  });

  it("keeps one canonical copy of linked history when command refs compact", async () => {
    const first = submitCategories(catalogHousehold("development"), BIANCA, ["SUB-FOOD"]);
    const firstId = currentSubmission(first.household, BIANCA, "categories")!.id;
    const second = submitCategories(
      first.household,
      BIANCA,
      ["SUB-FOOD", "SUB-TRANSIT"],
      "2026-09-04T18:01:00.000Z",
    );
    const secondId = currentSubmission(second.household, BIANCA, "categories")!.id;
    const ref = (
      confirmationId: string,
      postedIds: string[],
      resultRevision: number,
      acceptedAt: string,
    ): ContinuityCommandRef => ({
      idempotencyKey: confirmationId,
      confirmationId,
      identityHash: `identity-${confirmationId}`,
      baseRevision: resultRevision - 1,
      resultRevision,
      ledgerScope: "shared",
      commandType: "submitOnboardingCategories",
      commandPayload: {
        confirmationId,
        identityHash: `identity-${confirmationId}`,
        commandKind: "submitOnboardingCategories",
        postedIds,
        auditHash: "",
        revision: resultRevision,
        acceptedAt,
      },
    });
    const firstRef = ref("CONF-FIRST", [firstId], 1, AT);
    const secondRef = ref("CONF-SECOND", [firstId, secondId], 2, "2026-09-04T18:01:00.000Z");
    const payload = await compactedCommandPayload(
      { confirmationIds: ["CONF-FIRST", "CONF-SECOND"], commandRefs: [firstRef, secondRef] },
      secondRef,
      second.household,
      BIANCA,
    );
    const facts = payload.materializationFacts as { onboardingSubmissions?: OnboardingSubmission[] };

    expect(facts.onboardingSubmissions).toHaveLength(2);
    expect(facts.onboardingSubmissions?.find((row) => row.id === firstId)?.supersededBy).toBe(secondId);
    expect(new Set(facts.onboardingSubmissions?.map((row) => row.id)).size).toBe(2);
  });

  it("converges simultaneous member submissions without loss and unions categories by id", () => {
    const base = catalogHousehold("development");
    const bianca = submitCategories(base, BIANCA, ["SUB-Z", "SUB-A"]);
    const jonathan = submitCategories(base, JONATHAN, ["SUB-M", "SUB-A"]);
    const forward = mergeSubmissions(bianca.household.onboardingSubmissions, jonathan.household.onboardingSubmissions);
    const reverse = mergeSubmissions(jonathan.household.onboardingSubmissions, bianca.household.onboardingSubmissions);
    const converged: Household = { ...base, onboardingSubmissions: forward };

    expect(forward).toEqual(reverse);
    expect(forward).toHaveLength(2);
    expect(mergedCategorySelection(converged)).toEqual({
      unionIds: ["SUB-A", "SUB-M", "SUB-Z"],
      bySubmitter: {
        [BIANCA]: ["SUB-A", "SUB-Z"],
        [JONATHAN]: ["SUB-A", "SUB-M"],
      },
    });

    const mergedShared = mergeShared(
      splitForSync(bianca.household, BIANCA).shared,
      splitForSync(jonathan.household, JONATHAN).shared,
    );
    const roundTrip = assembleHousehold(mergedShared, splitForSync(bianca.household, BIANCA).personal);
    expect(mergedCategorySelection(roundTrip)).toEqual(mergedCategorySelection(converged));
  });

  it("rejects divergent same-id records regardless of arrival order", () => {
    const saved = submitCategories(catalogHousehold("development"), BIANCA, ["SUB-FOOD"]);
    const row = currentSubmission(saved.household, BIANCA, "categories")!;
    const divergent = { ...row, categoryIds: ["SUB-TRANSIT"] };

    expect(() => shapeOnboardingSubmissions([row, divergent]))
      .toThrow("Conflicting onboarding submission history.");
    expect(() => shapeOnboardingSubmissions([divergent, row]))
      .toThrow("Conflicting onboarding submission history.");
    expect(() => mergeSubmissions([row], [divergent]))
      .toThrow("Conflicting onboarding submission history.");
    expect(() => mergeSubmissions([divergent], [row]))
      .toThrow("Conflicting onboarding submission history.");

    const dangling = { ...row, supersededBy: "ONB-SUB-GHOST" };
    expect(() => shapeOnboardingSubmissions([dangling]))
      .toThrow("Conflicting onboarding submission history.");
    expect(() => mergeSubmissions([dangling], []))
      .toThrow("Conflicting onboarding submission history.");
  });

  it("keeps each member's estimates separate and distinguishes zero from missing", () => {
    const base = catalogHousehold("development");
    const bianca = submitEstimates(base, BIANCA, [
      { subcategoryId: "SUB-FOOD", amountCents: 0 },
    ]);
    const jonathan = submitEstimates(base, JONATHAN, [
      { subcategoryId: "SUB-TRANSIT", amountCents: 12_300 },
    ]);
    const rows = mergeSubmissions(bianca.household.onboardingSubmissions, jonathan.household.onboardingSubmissions);
    const converged: Household = { ...base, onboardingSubmissions: rows };

    expect(currentSubmission(converged, BIANCA, "estimates")?.estimates).toEqual([
      { subcategoryId: "SUB-FOOD", amountCents: 0 },
    ]);
    expect(currentSubmission(converged, BIANCA, "estimates")?.estimates)
      .not.toContainEqual({ subcategoryId: "SUB-TRANSIT", amountCents: 0 });
    expect(currentSubmission(converged, JONATHAN, "estimates")?.estimates).toEqual([
      { subcategoryId: "SUB-TRANSIT", amountCents: 12_300 },
    ]);
  });

  it("rejects ambiguous or non-integer estimate rows", () => {
    const household = catalogHousehold("development");
    expect(() => submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD", amountCents: 100 },
      { subcategoryId: "SUB-FOOD", amountCents: 200 },
    ])).toThrow(/each category estimate once/i);
    expect(() => submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD", amountCents: 12.5 },
    ])).toThrow(/whole cents/i);
    expect(() => submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD", amountCents: -1 },
    ])).toThrow(/whole cents/i);
  });

  it("binds the bounded command-event payload to the submitting member", async () => {
    const base = catalogHousehold("development");
    const saved = submitCategories(base, BIANCA, ["SUB-FOOD"]);
    const facts = extractMaterializationFacts(saved.household, saved.postedIds, {
      ledgerScope: "shared",
      memberId: BIANCA,
      commandKind: "submitOnboardingCategories",
      acceptedAt: AT,
    });
    const materializationHash = await sha256Hex(commandMaterializationFacts({
      onboardingSubmissions: facts.onboardingSubmissions,
    }));
    const auditHash = await financialAuditHashForScope(base, "shared", BIANCA);
    const event: ContinuityCommandEvent = {
      id: "EVENT-SUBMISSION",
      environment: "development",
      household_id: base.householdId,
      member_id: BIANCA,
      idempotency_key: "CONF-SUBMISSION",
      confirmation_id: "CONF-SUBMISSION",
      identity_hash: "identity",
      base_revision: base.revision,
      result_revision: base.revision + 1,
      ledger_scope: "shared",
      command_type: "submitOnboardingCategories",
      payload_json: {
        confirmationId: "CONF-SUBMISSION",
        identityHash: "identity",
        commandKind: "submitOnboardingCategories",
        postedIds: saved.postedIds,
        auditHash,
        revision: base.revision + 1,
        acceptedAt: AT,
        materializationHash,
        materializationFacts: facts,
      },
      created_at: AT,
    };

    expect(facts.onboardingSubmissions).toEqual(saved.household.onboardingSubmissions);
    const applied = await applyCommandEventLocally({ local: base, event, memberId: BIANCA });
    expect(applied).toEqual(expect.objectContaining({ ok: true, duplicate: false }));
    if (applied.ok) {
      expect(currentSubmission(applied.household, BIANCA, "categories")?.categoryIds).toEqual(["SUB-FOOD"]);
    }

    const forged = await applyCommandEventLocally({
      local: base,
      event: { ...event, member_id: JONATHAN },
      memberId: JONATHAN,
    });
    expect(forged).toEqual({ ok: false, reason: "onboarding-submission-authority-mismatch", fallback: true });

    const empty = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        payload_json: {
          ...event.payload_json,
          materializationFacts: {},
          materializationHash: await sha256Hex(commandMaterializationFacts({})),
        },
      },
      memberId: BIANCA,
    });
    expect(empty).toEqual({ ok: false, reason: "onboarding-submission-missing", fallback: true });

    const danglingRows = saved.household.onboardingSubmissions!.map((row) => ({
      ...row,
      supersededBy: "ONB-SUB-GHOST",
    }));
    const dangling = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        payload_json: {
          ...event.payload_json,
          materializationFacts: { onboardingSubmissions: danglingRows },
          materializationHash: await sha256Hex(commandMaterializationFacts({
            onboardingSubmissions: danglingRows,
          })),
        },
      },
      memberId: BIANCA,
    });
    expect(dangling).toEqual({
      ok: false,
      reason: "onboarding-submission-invalid",
      fallback: true,
    });

    const skippedRevisionRows = saved.household.onboardingSubmissions!.map((row) => ({
      ...row,
      revision: 99,
    }));
    const skippedRevision = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        payload_json: {
          ...event.payload_json,
          materializationFacts: { onboardingSubmissions: skippedRevisionRows },
          materializationHash: await sha256Hex(commandMaterializationFacts({
            onboardingSubmissions: skippedRevisionRows,
          })),
        },
      },
      memberId: BIANCA,
    });
    expect(skippedRevision).toEqual({
      ok: false,
      reason: "onboarding-submission-authority-mismatch",
      fallback: true,
    });

    const extraFieldRows = saved.household.onboardingSubmissions!.map((row) => ({
      ...row,
      note: "must never cross Shared",
      sourceAccountId: "ACC-VISA",
    }));
    const extraFields = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        payload_json: {
          ...event.payload_json,
          materializationFacts: { onboardingSubmissions: extraFieldRows },
          materializationHash: await sha256Hex(commandMaterializationFacts({
            onboardingSubmissions: saved.household.onboardingSubmissions,
          })),
        },
      },
      memberId: BIANCA,
    });
    expect(extraFields).toEqual({
      ok: false,
      reason: "onboarding-submission-invalid",
      fallback: true,
    });

    const estimateSaved = submitEstimates(base, BIANCA, [
      { subcategoryId: "SUB-FOOD", amountCents: 0 },
    ]);
    const nestedExtraRows = estimateSaved.household.onboardingSubmissions!.map((row) => ({
      ...row,
      estimates: row.estimates.map((estimate) => ({
        ...estimate,
        note: "must never cross Shared",
      })),
    }));
    const nestedExtraFields = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        command_type: "submitOnboardingEstimates",
        payload_json: {
          ...event.payload_json,
          commandKind: "submitOnboardingEstimates",
          postedIds: estimateSaved.postedIds,
          materializationFacts: { onboardingSubmissions: nestedExtraRows },
          materializationHash: await sha256Hex(commandMaterializationFacts({
            onboardingSubmissions: estimateSaved.household.onboardingSubmissions,
          })),
        },
      },
      memberId: BIANCA,
    });
    expect(nestedExtraFields).toEqual({
      ok: false,
      reason: "onboarding-submission-invalid",
      fallback: true,
    });
  });

  it("accepts through the books boundary with a bounded materialization receipt and unchanged financial hash", async () => {
    const base = catalogHousehold("development");
    const saved = submitEstimates(base, BIANCA, [
      { subcategoryId: "SUB-FOOD", amountCents: 45_000 },
    ]);
    const beforeHash = await financialAuditHashForScope(base, "shared", BIANCA);
    const outcome = await acceptHouseholdWrite({
      previous: base,
      candidate: saved.household,
      confirmationId: "CONF-ACCEPT-SUBMISSION",
      commandKind: saved.undo.commandKind,
      postedIds: saved.postedIds,
      actingMemberId: BIANCA,
      adapters: {
        persist: async () => undefined,
        ingest: async () => ({ ok: true }),
        validateCandidate: async () => ({ ok: true }),
        restoreIngest: async () => undefined,
      },
    });

    expect(outcome.ok).toBe(true);
    expect(await financialAuditHashForScope(outcome.household, "shared", BIANCA)).toBe(beforeHash);
    expect(outcome.household.commandReceipts.at(-1)).toMatchObject({
      confirmationId: "CONF-ACCEPT-SUBMISSION",
      commandKind: "submitOnboardingEstimates",
      postedIds: saved.postedIds,
      materializationHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("refuses a forged candidate at the accepted-write boundary before persistence", async () => {
    const base = catalogHousehold("development");
    const saved = submitCategories(base, BIANCA, ["SUB-FOOD"]);
    let persisted = false;
    const adapters = {
      persist: async () => { persisted = true; },
      ingest: async () => ({ ok: true }),
      validateCandidate: async () => ({ ok: true }),
      restoreIngest: async () => undefined,
    };
    const wrongMember = await acceptHouseholdWrite({
      previous: base,
      candidate: saved.household,
      confirmationId: "CONF-FORGED-MEMBER",
      commandKind: saved.undo.commandKind,
      postedIds: saved.postedIds,
      actingMemberId: JONATHAN,
      adapters,
    });
    const missingMember = await acceptHouseholdWrite({
      previous: base,
      candidate: saved.household,
      confirmationId: "CONF-MISSING-MEMBER",
      commandKind: saved.undo.commandKind,
      postedIds: saved.postedIds,
      adapters,
    });

    expect(wrongMember).toMatchObject({ ok: false, postedNothing: true, userMessage: "Only you can submit your own." });
    expect(missingMember).toMatchObject({ ok: false, postedNothing: true, userMessage: "Only you can submit your own." });
    expect(persisted).toBe(false);
  });

  it("refuses submission changes under a non-submit command and bundled money changes", async () => {
    const withMoney = postEntry(catalogHousehold("development"), {
      date: "2026-09-04",
      type: "expense",
      amount: "10.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    const saved = submitCategories(withMoney, BIANCA, ["SUB-FOOD"]);
    let persisted = false;
    const adapters = {
      persist: async () => { persisted = true; },
      ingest: async () => ({ ok: true }),
      validateCandidate: async () => ({ ok: true }),
      restoreIngest: async () => undefined,
    };

    const disguised = await acceptHouseholdWrite({
      previous: withMoney,
      candidate: saved.household,
      confirmationId: "CONF-DISGUISED-SUBMISSION",
      commandKind: "commit",
      postedIds: saved.postedIds,
      actingMemberId: BIANCA,
      adapters,
    });

    const candidateWithMoneyChange: Household = {
      ...saved.household,
      transactions: saved.household.transactions.map((row, rowIndex) => rowIndex === 0
        ? {
          ...row,
          amountCents: row.amountCents + 100,
          splits: row.splits.map((split, splitIndex) => splitIndex === 0
            ? { ...split, amountCents: split.amountCents + 100 }
            : split),
        }
        : row),
    };
    const bundled = await acceptHouseholdWrite({
      previous: withMoney,
      candidate: candidateWithMoneyChange,
      confirmationId: "CONF-BUNDLED-MONEY",
      commandKind: saved.undo.commandKind,
      postedIds: saved.postedIds,
      actingMemberId: BIANCA,
      adapters,
    });

    expect(disguised).toMatchObject({
      ok: false,
      postedNothing: true,
      userMessage: "Only you can submit your own.",
    });
    expect(bundled).toMatchObject({
      ok: false,
      postedNothing: true,
      userMessage: "Only you can submit your own.",
    });
    expect(persisted).toBe(false);
  });

  it("keeps the pure module bounded to choices and cents", () => {
    const source = readFileSync(new URL("../src/core/onboarding/submissions.ts", import.meta.url), "utf8");
    expect(source).toContain("currentSubmission");
    expect(source).toContain("mergedCategorySelection");
    expect(source).toContain("mergeSubmissions");
    expect(source).not.toMatch(/fundPrivate|bankBindings|reconciliations/);
    expect(source).not.toMatch(/ratio|share|percent|ranking|owner/i);
    expect(source).not.toContain("/ total");
    expect(source).not.toMatch(/draft|document|window|\.tsx|provider/i);
  });
});
