import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addRecurrence,
  buildProposal,
  catalogHousehold,
  configureHouseholdFund,
  currentSubmission,
  postEntry,
  proposalDigest,
  submitOnboardingCategories,
  submitOnboardingEstimates,
  type BudgetProposal,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const CATEGORY_ONE_AT = "2026-09-04T18:01:00.000Z";
const CATEGORY_TWO_AT = "2026-09-04T18:02:00.000Z";
const ESTIMATE_ONE_AT = "2026-09-04T18:03:00.000Z";
const ESTIMATE_TWO_AT = "2026-09-04T18:04:00.000Z";

function withCategories(categoryIds: string[]): Household {
  const first = submitOnboardingCategories(catalogHousehold("development"), {
    memberId: BIANCA,
    createdBy: BIANCA,
    categoryIds,
    at: CATEGORY_ONE_AT,
  });
  return submitOnboardingCategories(first.household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    categoryIds: [...categoryIds].reverse(),
    at: CATEGORY_TWO_AT,
  }).household;
}

function submitEstimates(
  household: Household,
  memberId: string,
  estimates: Array<{ subcategoryId: string; amountCents: number }>,
  at: string,
): Household {
  return submitOnboardingEstimates(household, {
    memberId,
    createdBy: memberId,
    estimates,
    at,
  }).household;
}

function addMonthlyExpense(
  household: Household,
  subcategoryId: string,
  dollars: number,
  accountId = "ACC-CHEQUING",
): Household {
  return addRecurrence(household, {
    cadence: "monthly",
    nextDate: "2027-01-01",
    type: "expense",
    amount: dollars,
    accountId,
    subcategoryId,
    note: subcategoryId,
  }).household;
}

function proposalInput(proposal: BudgetProposal): Omit<BudgetProposal, "sourceDigest"> {
  const { sourceDigest: _sourceDigest, ...input } = proposal;
  return input;
}

function rotate<T>(rows: T[], count: number): T[] {
  if (rows.length < 2) return rows;
  const offset = count % rows.length;
  return [...rows.slice(offset), ...rows.slice(0, offset)];
}

describe("deterministic first-plan proposal", () => {
  it("uses the half-up mean, raises to exact Shared recurrence floors, and keeps first-run history absent", () => {
    let household = withCategories(["SUB-FOOD-GROCERIES", "SUB-HOUSING-RENT"]);
    household = submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 50_000 },
    ], ESTIMATE_ONE_AT);
    household = submitEstimates(household, JONATHAN, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 60_001 },
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 180_000 },
    ], ESTIMATE_TWO_AT);
    household = addMonthlyExpense(household, "SUB-HOUSING-RENT", 1850);

    const proposal = buildProposal(household, "2027-01", "2026-09-04");

    expect(proposal.rows).toEqual([
      {
        subcategoryId: "SUB-FOOD-GROCERIES",
        label: "Groceries",
        estimatesCents: [
          { memberId: BIANCA, amountCents: 50_000 },
          { memberId: JONATHAN, amountCents: 60_001 },
        ],
        recurrenceFloorCents: 0,
        runRate: { eligible: false, reason: "insufficient-weeks" },
        proposedCents: 55_001,
        basis: "both-estimates",
      },
      {
        subcategoryId: "SUB-HOUSING-RENT",
        label: "Rent",
        estimatesCents: [
          { memberId: BIANCA, amountCents: null },
          { memberId: JONATHAN, amountCents: 180_000 },
        ],
        recurrenceFloorCents: 185_000,
        runRate: { eligible: false, reason: "insufficient-weeks" },
        proposedCents: 185_000,
        basis: "recurrence-floor",
      },
    ]);
    expect(proposal.totalCents).toBe(240_001);
    expect(proposal.capacityCents).toBeNull();
    expect(proposal.capacitySourceRevision).toBeNull();
    expect(proposal.source?.categoryIds).toEqual(["SUB-FOOD-GROCERIES", "SUB-HOUSING-RENT"]);
    expect(proposal.source?.estimateSubmissions).toEqual([
      expect.objectContaining({ memberId: BIANCA, revision: 1 }),
      expect.objectContaining({ memberId: JONATHAN, revision: 1 }),
    ]);
    expect(proposal.sourceDigest).toMatch(/^proposal-v1-[a-f0-9]{64}$/);
    expect(proposalDigest(proposalInput(proposal))).toBe(proposal.sourceDigest);
    expect(proposal.rows.every((row) => row.proposedCents >= row.recurrenceFloorCents)).toBe(true);
  });

  it("produces the same source digest across twenty input permutations", () => {
    let household = withCategories(["SUB-FOOD-GROCERIES", "SUB-HOUSING-RENT", "SUB-LIFE-PHONE"]);
    household = submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-LIFE-PHONE", amountCents: 9_000 },
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 50_000 },
    ], ESTIMATE_ONE_AT);
    household = submitEstimates(household, JONATHAN, [
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 180_000 },
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 60_001 },
    ], ESTIMATE_TWO_AT);
    household = addMonthlyExpense(household, "SUB-HOUSING-RENT", 1850);
    household = addMonthlyExpense(household, "SUB-LIFE-PHONE", 95);
    const expected = buildProposal(household, "2027-01", "2026-09-04");

    for (let index = 0; index < 20; index += 1) {
      const candidate = structuredClone(household);
      candidate.members = index % 2 ? [...candidate.members].reverse() : rotate(candidate.members, index);
      candidate.categories = index % 3 ? rotate(candidate.categories, index) : [...candidate.categories].reverse();
      candidate.recurrences = index % 4 ? rotate(candidate.recurrences, index) : [...candidate.recurrences].reverse();
      candidate.onboardingSubmissions = index % 5
        ? rotate(candidate.onboardingSubmissions ?? [], index)
        : [...(candidate.onboardingSubmissions ?? [])].reverse();
      const actual = buildProposal(candidate, "2027-01", "2026-09-04");
      expect(actual.rows).toEqual(expected.rows);
      expect(actual.sourceDigest).toBe(expected.sourceDigest);
    }
  });

  it("distinguishes absent, answered zero, conflicting estimates, and the current revision", () => {
    let household = withCategories([
      "SUB-FOOD-GROCERIES",
      "SUB-HOUSING-RENT",
      "SUB-LIFE-FUN",
      "SUB-LIFE-PHONE",
    ]);
    household = submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 10_000 },
      { subcategoryId: "SUB-LIFE-FUN", amountCents: 100 },
    ], ESTIMATE_ONE_AT);
    const staleId = currentSubmission(household, BIANCA, "estimates")!.id;
    household = submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 30_000 },
      { subcategoryId: "SUB-LIFE-FUN", amountCents: 100 },
    ], "2026-09-04T18:05:00.000Z");
    household = submitEstimates(household, JONATHAN, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 20_001 },
      { subcategoryId: "SUB-LIFE-FUN", amountCents: 101 },
    ], ESTIMATE_TWO_AT);

    const proposal = buildProposal(household, "2027-01", "2026-09-04");
    const byId = new Map(proposal.rows.map((row) => [row.subcategoryId, row]));

    expect(byId.get("SUB-FOOD-GROCERIES")).toMatchObject({ proposedCents: 0, basis: "both-estimates" });
    expect(byId.get("SUB-HOUSING-RENT")).toMatchObject({ proposedCents: 25_001, basis: "both-estimates" });
    expect(byId.get("SUB-LIFE-FUN")).toMatchObject({ proposedCents: 101, basis: "both-estimates" });
    expect(byId.get("SUB-LIFE-PHONE")).toMatchObject({ proposedCents: 0, basis: "recurrence-floor" });
    expect(proposal.source?.estimateSubmissions.find((row) => row.memberId === BIANCA)).toMatchObject({ revision: 2 });
    expect(proposal.source?.estimateSubmissions.map((row) => row.submissionId)).not.toContain(staleId);
  });

  it("handles a category added after the first submissions as one answer or as a recurring floor", () => {
    let household = withCategories(["SUB-FOOD-GROCERIES"]);
    household = submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 50_000 },
    ], ESTIMATE_ONE_AT);
    household = submitEstimates(household, JONATHAN, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 60_000 },
    ], ESTIMATE_TWO_AT);
    household = submitOnboardingCategories(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      categoryIds: ["SUB-FOOD-GROCERIES", "SUB-LIFE-PHONE"],
      at: "2026-09-04T18:05:00.000Z",
    }).household;

    const floorHousehold = addMonthlyExpense(household, "SUB-LIFE-PHONE", 95);
    expect(buildProposal(floorHousehold, "2027-01", "2026-09-04").rows.find(
      (row) => row.subcategoryId === "SUB-LIFE-PHONE",
    )).toMatchObject({
      estimatesCents: [
        { memberId: BIANCA, amountCents: null },
        { memberId: JONATHAN, amountCents: null },
      ],
      recurrenceFloorCents: 9_500,
      proposedCents: 9_500,
      basis: "recurrence-floor",
    });

    household = submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 50_000 },
      { subcategoryId: "SUB-LIFE-PHONE", amountCents: 8_000 },
    ], "2026-09-04T18:06:00.000Z");
    expect(buildProposal(household, "2027-01", "2026-09-04").rows.find(
      (row) => row.subcategoryId === "SUB-LIFE-PHONE",
    )).toMatchObject({ proposedCents: 8_000, basis: "single-estimate" });
  });

  it("uses eligible Fund history only as an upward category bound", () => {
    let household = configureHouseholdFund(catalogHousehold("development"), {
      custodianMemberId: BIANCA,
      openedOn: "2026-01-01",
      createdBy: BIANCA,
    }).household;
    for (const date of ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"]) {
      household = postEntry(household, {
        date,
        type: "expense",
        amount: 100,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        createdBy: BIANCA,
        visibility: "household",
        confirmDuplicate: true,
        funding: {
          fundId: HOUSEHOLD_FUND_ID,
          fundedCents: 10_000,
          destinationAccountId: "ACC-VISA",
        },
      }).household;
    }
    const first = submitOnboardingCategories(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      categoryIds: ["SUB-FOOD-GROCERIES"],
      at: CATEGORY_ONE_AT,
    });
    household = submitOnboardingCategories(first.household, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      categoryIds: ["SUB-FOOD-GROCERIES"],
      at: CATEGORY_TWO_AT,
    }).household;
    household = submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 10_000 },
    ], ESTIMATE_ONE_AT);
    household = submitEstimates(household, JONATHAN, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 20_000 },
    ], ESTIMATE_TWO_AT);

    expect(buildProposal(household, "2026-02", "2026-02-10").rows[0]).toMatchObject({
      runRate: { eligible: true, monthlyCents: 43_333, weeksWatched: 5 },
      proposedCents: 43_333,
      basis: "run-rate-raised",
    });
  });

  it("does not let a Personal recurrence enter the household floor", () => {
    let household = withCategories(["SUB-LIFE-PHONE"]);
    household.accounts.push({
      ...household.accounts.find((row) => row.id === "ACC-CHEQUING")!,
      id: "ACC-PRIVATE",
      name: "Private account",
      ownerMemberId: BIANCA,
      scope: "personal",
    });
    household = addMonthlyExpense(household, "SUB-LIFE-PHONE", 95, "ACC-PRIVATE");

    expect(buildProposal(household, "2027-01", "2026-09-04").rows[0]).toMatchObject({
      recurrenceFloorCents: 0,
      proposedCents: 0,
    });
  });

  it("counts every daily occurrence in a long month from a safely advanced old anchor", () => {
    let household = withCategories(["SUB-LIFE-PHONE"]);
    household = addRecurrence(household, {
      cadence: "daily",
      nextDate: "2026-01-01",
      type: "expense",
      amount: 1,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-LIFE-PHONE",
      note: "Daily household item",
    }).household;

    expect(buildProposal(household, "2027-01", "2026-09-04").rows[0]).toMatchObject({
      recurrenceFloorCents: 3_100,
      proposedCents: 3_100,
      basis: "recurrence-floor",
    });
  });

  it("binds capacity, capacity revision, source revisions, floors, and history into the digest", () => {
    const proposal = buildProposal(withCategories(["SUB-FOOD-GROCERIES"]), "2027-01", "2026-09-04");
    const input = proposalInput(proposal);
    const withCapacity = {
      ...input,
      capacityCents: 250_000,
      capacitySourceRevision: "capacity-1",
    };
    const first = proposalDigest(withCapacity);

    expect(proposalDigest({ ...withCapacity, rows: [...withCapacity.rows].reverse() })).toBe(first);
    expect(proposalDigest({ ...withCapacity, capacityCents: 250_001 })).not.toBe(first);
    expect(proposalDigest({ ...withCapacity, capacitySourceRevision: "capacity-2" })).not.toBe(first);
    expect(proposalDigest({
      ...withCapacity,
      source: {
        ...withCapacity.source!,
        estimateSubmissions: withCapacity.source!.estimateSubmissions.map((row, index) => (
          index === 0 ? { ...row, submissionId: "new-submission", revision: 2 } : row
        )),
      },
    })).not.toBe(first);
    expect(proposalDigest({
      ...withCapacity,
      rows: withCapacity.rows.map((row) => ({
        ...row,
        recurrenceFloorCents: row.recurrenceFloorCents + 1,
        proposedCents: row.proposedCents + 1,
      })),
      totalCents: withCapacity.totalCents + withCapacity.rows.length,
    })).not.toBe(first);
  });

  it("uses the standard SHA-256 value for the normalized approval source", () => {
    const proposal = buildProposal(withCategories(["SUB-FOOD-GROCERIES"]), "2027-01", "2026-09-04");
    const input = proposalInput(proposal);
    const normalized = JSON.stringify({
      monthKey: input.monthKey,
      formulaVersion: input.formulaVersion,
      source: {
        categoryIds: [...input.source.categoryIds].sort(),
        estimateSubmissions: [...input.source.estimateSubmissions].sort((left, right) => left.memberId.localeCompare(right.memberId)),
      },
      rows: [...input.rows].sort((left, right) => left.subcategoryId.localeCompare(right.subcategoryId)).map((row) => ({
        subcategoryId: row.subcategoryId,
        recurrenceFloorCents: row.recurrenceFloorCents,
        runRate: row.runRate,
        proposedCents: row.proposedCents,
      })),
      capacityCents: input.capacityCents,
      capacitySourceRevision: input.capacitySourceRevision,
    });
    const expected = createHash("sha256").update(normalized).digest("hex");

    expect(proposal.sourceDigest).toBe(`proposal-v1-${expected}`);
  });

  it("refuses incomplete provenance, invalid run-rate states, and any result below its required bound", () => {
    const proposal = buildProposal(withCategories(["SUB-FOOD-GROCERIES"]), "2027-01", "2026-09-04");
    const input = proposalInput(proposal);
    const row = input.rows[0]!;

    expect(() => proposalDigest({
      ...input,
      source: { ...input.source, estimateSubmissions: [] },
    })).toThrow("Proposal source needs both household members.");
    expect(() => proposalDigest({ ...input, formulaVersion: 2 }))
      .toThrow("Proposal formula version is invalid.");
    expect(() => proposalDigest({
      ...input,
      rows: [{ ...row, recurrenceFloorCents: 100, proposedCents: 0 }],
      totalCents: 0,
    })).toThrow("Proposal row does not match the frozen formula.");
    expect(() => proposalDigest({
      ...input,
      rows: [{
        ...row,
        runRate: { eligible: true, monthlyCents: 200, weeksWatched: 3 },
        proposedCents: 0,
      }],
      totalCents: 0,
    })).toThrow("Proposal row does not match the frozen formula.");
    expect(() => proposalDigest({
      ...input,
      rows: [{
        ...row,
        runRate: { eligible: false, reason: "made-up" },
      }] as unknown as typeof input.rows,
    })).toThrow("Run-rate reason is invalid.");

    const withAnswer = structuredClone(input);
    withAnswer.rows[0]!.estimatesCents[0]!.amountCents = 100;
    withAnswer.rows[0]!.proposedCents = 100;
    withAnswer.rows[0]!.basis = "single-estimate";
    expect(() => proposalDigest(withAnswer))
      .toThrow("A proposal estimate needs an accepted submission source.");
  });

  it("computes the safe half-up mean at the largest supported cent value", () => {
    let household = withCategories(["SUB-FOOD-GROCERIES"]);
    household = submitEstimates(household, BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: Number.MAX_SAFE_INTEGER },
    ], ESTIMATE_ONE_AT);
    household = submitEstimates(household, JONATHAN, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: Number.MAX_SAFE_INTEGER },
    ], ESTIMATE_TWO_AT);

    expect(buildProposal(household, "2027-01", "2026-09-04").rows[0]).toMatchObject({
      proposedCents: Number.MAX_SAFE_INTEGER,
      basis: "both-estimates",
    });
  });

  it("fails closed before a two-member category set is accepted", () => {
    const one = submitOnboardingCategories(catalogHousehold("development"), {
      memberId: BIANCA,
      createdBy: BIANCA,
      categoryIds: ["SUB-FOOD-GROCERIES"],
      at: CATEGORY_ONE_AT,
    });
    expect(() => buildProposal(one.household, "2027-01", "2026-09-04"))
      .toThrow("Finish the household category set before building its first plan.");
  });

  it("stores only whole-number numeric proposal facts and keeps the deterministic source fenced", () => {
    const proposal = buildProposal(withCategories(["SUB-FOOD-GROCERIES"]), "2027-01", "2026-09-04");
    const numericValues: number[] = [];
    const visit = (value: unknown): void => {
      if (typeof value === "number") numericValues.push(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") Object.values(value).forEach(visit);
    };
    visit(proposal);
    expect(numericValues.every(Number.isSafeInteger)).toBe(true);

    const source = readFileSync(new URL("../src/core/onboarding/proposal.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/percent|ratio|rank|trim/i);
    expect(source).not.toMatch(/gemini|groq|openai|workers ai|fetch\s*\(/i);
    expect(source).toContain("currentSubmission");
    expect(source).toContain("onboardingRecurrenceProbe");
    expect(source).toContain("houseRunRate");
    expect(source).toContain("projectCadence");
  });
});
