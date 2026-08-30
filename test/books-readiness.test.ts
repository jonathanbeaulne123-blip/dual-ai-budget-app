import { describe, expect, it } from "vitest";
import { catalogHousehold, seedDemoHousehold } from "../src/core/index.ts";
import {
  booksWriteGate,
  knownMetadataUpdateAllowed,
  readinessForHousehold,
  readinessMatches,
} from "../src/startup/booksReadiness.ts";

describe("startup books readiness", () => {
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
      herculesProPermissions: {
        personalWrite: true,
        householdWrite: false,
        updatedAt: "2026-08-30T12:00:00.000Z",
      },
    };
    expect(knownMetadataUpdateAllowed(household, metadataOnly, household.revision)).toBe(true);

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
