import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  CONFLICT_BUNDLE_KIND,
  makeConflictBundle,
  makeHouseholdExport,
  parseConflictBundle,
  parseHouseholdExport,
  postEntry,
  redactedDiagnostics,
  booksRecoveryAdvice,
  validateHouseholdImport,
  verifyCurrentHouseholdRecovery,
} from "../src/core/index.ts";

describe("recovery import/export", () => {
  it("refuses import without Confirm and preserves the live household", async () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Recovery milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const file = await makeHouseholdExport(posted.household);
    await expect(validateHouseholdImport(JSON.stringify(file), "development", { confirm: false })).rejects.toThrow(
      /Confirm/,
    );
  });

  it("refuses a truncated export", () => {
    expect(() => parseHouseholdExport("{")).toThrow(/not a Hearth household export/);
  });

  it("redacts diagnostics by omitting partner personal notes and secrets", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Bianca's private clinic receipt",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const report = redactedDiagnostics({
      ...posted.household,
      transactions: posted.household.transactions.map((row) =>
        row.note.includes("clinic") ? { ...row, visibility: "personal" as const } : row,
      ),
    });
    const blob = JSON.stringify(report);
    expect(blob).not.toMatch(/private clinic|sb_secret|password|VITE_/i);
    expect(report).not.toHaveProperty("transactions");
  });

  it("exports both sides of a conflict without merging money", () => {
    const local = catalogHousehold();
    const remote = { ...local, revision: 4 };
    const conflicted = {
      ...local,
      conflicts: [
        {
          id: "CONF-1",
          detectedAt: "2026-08-24T12:00:00.000Z",
          environment: "development" as const,
          localRevision: 3,
          remoteRevision: 4,
          localHash: "local",
          remoteHash: "remote",
          localSnapshot: local,
          remoteSnapshot: remote,
          autoMerged: false,
          resolved: false,
        },
      ],
    };
    const bundle = makeConflictBundle(conflicted);
    expect(bundle.kind).toBe(CONFLICT_BUNDLE_KIND);
    expect(bundle.local.householdId).toBe(local.householdId);
    expect(bundle.remote.revision).toBe(4);
    const parsed = parseConflictBundle(JSON.stringify(bundle));
    expect(parsed.conflictId).toBe("CONF-1");
    expect(() => parseConflictBundle("{")).toThrow(/conflict bundle/);
  });

  it("names retryable vs permanent books recovery without discarding the ledger", () => {
    expect(booksRecoveryAdvice("missing-schema").retryable).toBe(true);
    expect(booksRecoveryAdvice("projection-mismatch").permanent).toBe(true);
    expect(booksRecoveryAdvice("invalid-stored-data").advice).toMatch(/will not overwrite|disagree/i);
  });

  it("refuses a schema-version mismatch without importing", async () => {
    const file = await makeHouseholdExport(catalogHousehold());
    const raw = JSON.stringify({ ...file, schemaVersion: 99 });
    await expect(validateHouseholdImport(raw, "development", { confirm: true })).rejects.toThrow(/schema/);
  });

  it("proves an exact current Development backup without replacing the live household", async () => {
    const current = postEntry(catalogHousehold("development"), {
      date: "2026-08-31",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Private rehearsal value",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const before = structuredClone(current);
    const file = await makeHouseholdExport(current);
    const proof = await verifyCurrentHouseholdRecovery(JSON.stringify(file), current);
    expect(proof).toMatchObject({
      environment: "development",
      revision: current.revision,
      lastCommittedAt: current.lastCommittedAt,
      booksHash: file.booksHash,
    });
    expect(proof.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(current).toEqual(before);
    expect(JSON.stringify(proof)).not.toMatch(/Private rehearsal value|transactions|amountCents/);
  });

  it("refuses a stale, different-household, or Production backup for rehearsal Start", async () => {
    const current = catalogHousehold("development");
    const staleFile = await makeHouseholdExport(current);
    const changed = postEntry(current, {
      date: "2026-08-31",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Changed after backup",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    await expect(verifyCurrentHouseholdRecovery(JSON.stringify(staleFile), changed)).rejects.toThrow(/not the current accepted books|not the exact current/);

    const other = { ...structuredClone(current), householdId: "HH-OTHER" };
    const otherFile = await makeHouseholdExport(other);
    await expect(verifyCurrentHouseholdRecovery(JSON.stringify(otherFile), current)).rejects.toThrow(/different household/);

    const production = { ...structuredClone(current), environment: "production" as const };
    const productionFile = await makeHouseholdExport(production);
    await expect(verifyCurrentHouseholdRecovery(JSON.stringify(productionFile), current)).rejects.toThrow(/Production|development household/i);
    await expect(verifyCurrentHouseholdRecovery(JSON.stringify(productionFile), production)).rejects.toThrow(/only in Development/);

    const mislabeled = { ...await makeHouseholdExport(current), environment: "production" as const };
    await expect(verifyCurrentHouseholdRecovery(JSON.stringify(mislabeled), current)).rejects.toThrow(/environment label/);
  });
});
