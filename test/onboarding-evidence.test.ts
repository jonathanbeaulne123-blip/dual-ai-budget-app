import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shapeAccounts } from "../src/core/accountKinds.ts";
import {
  ONBOARDING_REGISTRY,
  catalogHousehold,
  evidenceFor,
  postEntry,
  postOpeningBalances,
  witnessEvidenceFor,
  type CommandReceipt,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const AT = "2026-09-03T18:00:00.000Z";
const BIANCA_PRIVATE = [
  "PRIVATE-ACCOUNT-BIANCA",
  "PRIVATE-TX-BIANCA",
  "Bianca hidden savings",
  "PRIVATE-BANK-BIANCA",
  "PRIVATE-FUND-BIANCA",
  "CONFIRM-BIANCA",
] as const;
const JONATHAN_PRIVATE = [
  "PRIVATE-ACCOUNT-JONATHAN",
  "PRIVATE-TX-JONATHAN",
  "Jonathan hidden savings",
  "PRIVATE-BANK-JONATHAN",
  "PRIVATE-FUND-JONATHAN",
  "CONFIRM-JONATHAN",
] as const;

function receipt(confirmationId: string, commandKind: string, postedIds: string[]): CommandReceipt {
  return {
    confirmationId,
    identityHash: `identity-${confirmationId}`,
    auditHash: `audit-${confirmationId}`,
    commandKind,
    postedIds,
    revision: 1,
    acceptedAt: AT,
  };
}

function privacyFixture(): Household {
  let household = catalogHousehold("development");
  household.accounts = shapeAccounts([
    { id: "SHARED-CARD", name: "Shared card", kind: "credit", ownerMemberId: "joint", scope: "shared" },
    { id: BIANCA_PRIVATE[0], name: BIANCA_PRIVATE[2], kind: "savings", ownerMemberId: BIANCA, scope: "personal" },
    { id: JONATHAN_PRIVATE[0], name: JONATHAN_PRIVATE[2], kind: "savings", ownerMemberId: JONATHAN, scope: "personal" },
  ], "2026-09-01T00:00:00.000Z");
  const bianca = postEntry(household, {
    date: "2026-09-03",
    type: "expense",
    amount: 10,
    accountId: BIANCA_PRIVATE[0],
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: BIANCA_PRIVATE[1],
    createdBy: BIANCA,
    visibility: "personal",
    confirmDuplicate: true,
  });
  household = bianca.household;
  household.transactions = household.transactions.map((transaction) => transaction.createdBy === BIANCA
    ? { ...transaction, id: BIANCA_PRIVATE[1] }
    : transaction);
  const jonathan = postEntry(household, {
    date: "2026-09-03",
    type: "expense",
    amount: 12,
    accountId: JONATHAN_PRIVATE[0],
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: JONATHAN_PRIVATE[1],
    createdBy: JONATHAN,
    visibility: "personal",
    confirmDuplicate: true,
  });
  household = jonathan.household;
  household.transactions = household.transactions.map((transaction) => transaction.createdBy === JONATHAN
    ? { ...transaction, id: JONATHAN_PRIVATE[1] }
    : transaction);
  household.commandReceipts = [
    receipt(BIANCA_PRIVATE[5], "postEntry", [BIANCA_PRIVATE[1]]),
    receipt(JONATHAN_PRIVATE[5], "postEntry", [JONATHAN_PRIVATE[1]]),
  ];
  household.fundPrivate = {
    bankBindings: [
      {
        id: BIANCA_PRIVATE[3],
        fundId: BIANCA_PRIVATE[4],
        memberId: BIANCA,
        provider: "manual",
        accountId: BIANCA_PRIVATE[0],
        accountDigest: null,
        status: "manual",
        createdAt: AT,
        updatedAt: AT,
      },
      {
        id: JONATHAN_PRIVATE[3],
        fundId: JONATHAN_PRIVATE[4],
        memberId: JONATHAN,
        provider: "manual",
        accountId: JONATHAN_PRIVATE[0],
        accountDigest: null,
        status: "manual",
        createdAt: AT,
        updatedAt: AT,
      },
    ],
    reconciliations: [],
  };
  return household;
}

function expectNoTokens(value: unknown, tokens: readonly string[]): void {
  const serialized = JSON.stringify(value);
  for (const token of tokens) expect(serialized).not.toContain(token);
}

describe("onboarding evidence projector", () => {
  it.each(ONBOARDING_REGISTRY)("keeps owner and partner evidence private for $id", (chapter) => {
    const household = privacyFixture();
    const owner = evidenceFor(household, chapter.id, BIANCA);
    const partner = evidenceFor(household, chapter.id, JONATHAN);
    const ownerWitness = witnessEvidenceFor(household, chapter.id, BIANCA);
    const partnerWitness = witnessEvidenceFor(household, chapter.id, JONATHAN);
    expectNoTokens(owner, JONATHAN_PRIVATE);
    expectNoTokens(partner, BIANCA_PRIVATE);
    expectNoTokens(ownerWitness, [...BIANCA_PRIVATE, ...JONATHAN_PRIVATE]);
    expectNoTokens(partnerWitness, [...BIANCA_PRIVATE, ...JONATHAN_PRIVATE]);
    if (ownerWitness.kind === "accepted") expect(ownerWitness.card.scope).toBe("household");
    if (partnerWitness.kind === "accepted") expect(partnerWitness.card.scope).toBe("household");
  });

  it("returns self-personal evidence only to its owner and never to a witness", () => {
    const household = privacyFixture();
    household.accounts = household.accounts.filter((account) => account.scope === "personal");
    const owner = evidenceFor(household, "ch-04-accounts", BIANCA);
    expect(owner).toMatchObject({
      kind: "accepted",
      card: { scope: "self-personal", sourceIds: [BIANCA_PRIVATE[0]] },
    });
    expectNoTokens(owner, JONATHAN_PRIVATE);
    expect(witnessEvidenceFor(household, "ch-04-accounts", BIANCA)).toEqual({ kind: "empty" });

    household.accounts = household.accounts.filter((account) => account.ownerMemberId === BIANCA);
    const partner = evidenceFor(household, "ch-04-accounts", JONATHAN);
    expect(partner).toEqual({ kind: "empty" });
    expectNoTokens(partner, BIANCA_PRIVATE);
  });

  it("never accepts a card without at least one cited source row", () => {
    const household = privacyFixture();
    for (const chapter of ONBOARDING_REGISTRY) {
      for (const viewer of [BIANCA, JONATHAN]) {
        for (const result of [
          evidenceFor(household, chapter.id, viewer),
          witnessEvidenceFor(household, chapter.id, viewer),
        ]) {
          if (result.kind === "accepted") expect(result.card.sourceIds.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps ineligible distinct from empty and makes every reason reachable", () => {
    const empty = catalogHousehold("development");
    expect(evidenceFor(empty, "ch-09-categories", BIANCA)).toEqual({ kind: "empty" });
    expect(evidenceFor(empty, "missing-chapter", BIANCA)).toEqual({ kind: "ineligible", reason: "malformed" });
    expect(evidenceFor(empty, "ch-02-household", "missing-member")).toEqual({ kind: "ineligible", reason: "privacy" });

    const conflicted = catalogHousehold("development");
    const snapshot = structuredClone(conflicted);
    snapshot.conflicts = [];
    conflicted.conflicts = [{
      id: "CONFLICT-ONBOARDING",
      detectedAt: AT,
      environment: "development",
      localRevision: 1,
      remoteRevision: 1,
      localHash: "local",
      remoteHash: "remote",
      localSnapshot: snapshot,
      remoteSnapshot: structuredClone(snapshot),
      autoMerged: false,
      resolved: false,
    }];
    expect(evidenceFor(conflicted, "ch-02-household", BIANCA)).toEqual({ kind: "ineligible", reason: "conflicted" });

    const stale = postEntry(catalogHousehold("development"), {
      date: "2026-09-03",
      type: "expense",
      amount: 10,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    expect(evidenceFor(stale, "ch-05-opening", BIANCA)).toEqual({ kind: "ineligible", reason: "stale" });

    const untied = postOpeningBalances(catalogHousehold("development"), {
      asOfDate: "2026-09-03",
      createdBy: BIANCA,
      confirmationId: "OPEN-UNTIED",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 100_00 }],
    }).household;
    expect(evidenceFor(untied, "ch-05-opening", BIANCA)).toEqual({ kind: "ineligible", reason: "untied" });
  });

  it("accepts a tied opening receipt and cites the batch rows", () => {
    const posted = postOpeningBalances(catalogHousehold("development"), {
      asOfDate: "2026-09-03",
      createdBy: BIANCA,
      confirmationId: "OPEN-TIED",
      lines: [{ accountId: "ACC-CHEQUING", amountCents: 100_00 }],
    });
    posted.household.commandReceipts = [receipt("OPEN-TIED", "postOpeningBalances", posted.postedIds)];
    const result = evidenceFor(posted.household, "ch-05-opening", BIANCA);
    expect(result).toMatchObject({
      kind: "accepted",
      card: {
        scope: "household",
        kind: "receipt",
        sourceIds: ["OPEN-TIED", ...posted.postedIds].sort(),
      },
    });
  });

  it("lets witness projection remove self-personal evidence but never add evidence", () => {
    const household = privacyFixture();
    household.accounts = household.accounts.filter((account) => account.scope === "personal");
    expect(evidenceFor(household, "ch-04-accounts", BIANCA).kind).toBe("accepted");
    expect(witnessEvidenceFor(household, "ch-04-accounts", BIANCA)).toEqual({ kind: "empty" });

    const shared = privacyFixture();
    const owner = evidenceFor(shared, "ch-04-accounts", BIANCA);
    const witness = witnessEvidenceFor(shared, "ch-04-accounts", BIANCA);
    expect(witness).toEqual(owner);
    expect(witness).toMatchObject({ kind: "accepted", card: { scope: "household" } });
  });

  it("is deterministic and does not mutate canonical household facts", () => {
    const household = privacyFixture();
    const before = structuredClone(household);
    const first = ONBOARDING_REGISTRY.map((chapter) => ({
      owner: evidenceFor(household, chapter.id, BIANCA),
      witness: witnessEvidenceFor(household, chapter.id, BIANCA),
    }));
    const second = ONBOARDING_REGISTRY.map((chapter) => ({
      owner: evidenceFor(household, chapter.id, BIANCA),
      witness: witnessEvidenceFor(household, chapter.id, BIANCA),
    }));
    expect(second).toEqual(first);
    expect(household).toEqual(before);
  });

  it("has no DOM, browser-global, component, or command-module dependency", () => {
    const source = readFileSync(new URL("../src/core/onboarding/evidence.ts", import.meta.url), "utf8");
    expect(source).not.toContain("document");
    expect(source).not.toContain("window");
    expect(source).not.toMatch(/from\s+["'][^"']*\.tsx["']/);
    expect(source).not.toMatch(/from\s+["'][^"']*commands\.ts["']/);
    expect(source).not.toContain("onboardingHouseholdScope");
  });
});
