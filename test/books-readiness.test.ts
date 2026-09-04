import { describe, expect, it } from "vitest";
import { catalogHousehold, financialAuditHash, seedDemoHousehold } from "../src/core/index.ts";
import {
  acceptedSnapshotRebuildCheck,
  booksWriteGate,
  knownMetadataUpdateAllowed,
  readinessForHousehold,
  readinessMatches,
} from "../src/startup/booksReadiness.ts";

describe("startup books readiness", () => {
  it("trusts an interrupted rebuild only when the saved financial receipt still matches", async () => {
    const household = seedDemoHousehold();
    await expect(acceptedSnapshotRebuildCheck(household)).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/no accepted-books receipt/i),
    });

    const accepted = { ...household, booksAcceptedHash: await financialAuditHash(household) };
    await expect(acceptedSnapshotRebuildCheck(accepted)).resolves.toEqual({
      ok: true,
      auditHash: accepted.booksAcceptedHash,
    });

    const first = accepted.transactions[0]!;
    const altered = {
      ...accepted,
      transactions: accepted.transactions.map((row) => row.id === first.id
        ? { ...row, amountCents: row.amountCents + 1 }
        : row),
    };
    await expect(acceptedSnapshotRebuildCheck(altered)).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/money facts changed after/i),
    });
  });

  it("only opens the write gate for the exact validated replica revision", () => {
    const household = seedDemoHousehold();
    const ready = readinessForHousehold("ready", 3, household);

    expect(readinessMatches(ready, household)).toBe(true);
    expect(booksWriteGate(ready, household)).toEqual({ ready: true, reason: null });
    expect(booksWriteGate(ready, { ...household, revision: household.revision + 1 }).ready).toBe(false);
    expect(booksWriteGate(ready, { ...household, householdId: "HH-OTHER" }).ready).toBe(false);
    expect(booksWriteGate(ready, { ...household, environment: "production" }).ready).toBe(false);
  });

  it("keeps a recovery reason attached to the matching blocked replica", () => {
    const household = catalogHousehold();
    const blocked = readinessForHousehold("blocked", 4, household, {
      issue: "projection-mismatch",
      message: "The cached snapshot and journal do not agree.",
    });

    expect(booksWriteGate(blocked, household)).toEqual({
      ready: false,
      reason: "The cached snapshot and journal do not agree.",
    });
  });

  it("carries readiness only across financially identical metadata updates", () => {
    const household = seedDemoHousehold();
    const metadataOnly = {
      ...household,
      revision: household.revision + 1,
      sharing: {
        ...household.sharing,
        lastTransportAt: "2026-08-30T12:00:00.000Z",
      },
    };
    expect(knownMetadataUpdateAllowed(household, metadataOnly, household.revision)).toBe(true);

    const permissionShortcut = {
      ...metadataOnly,
      herculesProPermissions: {
        personalWrite: true,
        householdWrite: false,
        updatedAt: "2026-08-30T12:00:00.000Z",
      },
    };
    expect(knownMetadataUpdateAllowed(household, permissionShortcut, household.revision)).toBe(false);

    const transaction = household.transactions[0];
    expect(transaction).toBeDefined();
    const changedMoney = {
      ...metadataOnly,
      transactions: household.transactions.map((row) => row.id === transaction!.id
        ? { ...row, amountCents: row.amountCents + 1 }
        : row),
    };
    expect(knownMetadataUpdateAllowed(household, changedMoney, household.revision)).toBe(false);
  });
});
