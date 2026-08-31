import { describe, expect, it } from "vitest";
import {
  acceptHouseholdWrite,
  addGoal,
  canAutoMergeConflict,
  catalogHousehold,
  compileHousehold,
  contributeToGoal,
  postEntry,
  type Household,
  type WriteAdapters,
} from "../src/core/index.ts";

function grocery(note: string, amount = "4.00") {
  return {
    date: "2026-08-24" as const,
    type: "expense" as const,
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy: "MEM-001",
    confirmDuplicate: true,
  };
}

function memoryAdapters(options?: {
  ingestOk?: boolean;
  persistOk?: boolean;
  transport?: WriteAdapters["transport"];
}) {
  let persisted: Household | null = null;
  let ingested: Household | null = null;
  const adapters: WriteAdapters = {
    persist: async (household) => {
      if (options?.persistOk === false) throw new Error("disk full");
      persisted = household;
    },
    ingest: async (household) => {
      if (options?.ingestOk === false) return { ok: false, error: "PGlite refused the journal." };
      ingested = household;
      return { ok: true };
    },
    restoreIngest: async (household) => {
      ingested = household;
    },
    transport: options?.transport,
  };
  return {
    adapters,
    persisted: () => persisted,
    ingested: () => ingested,
  };
}

describe("atomic household writes", () => {
  it("commits a balanced command exactly once", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Milk"));
    const store = memoryAdapters();
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-milk",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.postedExactlyOnce).toBe(true);
    expect(outcome.postedNothing).toBe(false);
    expect(store.persisted()?.revision).toBe((previous.revision ?? 0) + 1);
    expect(store.ingested()?.transactions.some((row) => row.note === "Milk")).toBe(true);
    expect(compileHousehold(outcome.household).entries.length).toBeGreaterThan(0);
  });

  it("threads one accepted compiled artifact through ingest and verification", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Artifact milk"));
    let ingestCompiled: ReturnType<typeof compileHousehold> | undefined;
    let verifyCompiled: ReturnType<typeof compileHousehold> | undefined;
    let ingestHash: string | undefined;
    let verifyHash: string | undefined;
    const adapters: WriteAdapters = {
      persist: async () => undefined,
      ingest: async (_household, artifact) => {
        ingestCompiled = artifact?.compiled;
        ingestHash = artifact?.auditHash;
        expect(artifact?.previous?.householdId).toBe(previous.householdId);
        return { ok: true };
      },
      verifyBooks: async (_household, artifact) => {
        verifyCompiled = artifact?.compiled;
        verifyHash = artifact?.auditHash;
        return { ok: true };
      },
    };
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-artifact",
      postedIds: posted.postedIds,
      adapters,
    });

    expect(outcome.ok).toBe(true);
    expect(ingestCompiled).toBe(verifyCompiled);
    expect(ingestHash).toBe(verifyHash);
    expect(ingestHash).toBe(outcome.household.booksAcceptedHash);
    expect(ingestCompiled?.revision).toBe(outcome.revision);
    expect(ingestCompiled?.entries.some((entry) => entry.memo === "Artifact milk")).toBe(true);
  });

  it("restores previous PGlite books when post-ingest hash verify fails", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Milk"));
    const store = memoryAdapters();
    store.adapters.verifyBooks = async () => ({ ok: false, error: "projection-mismatch" });
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-verify-fail",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.postedNothing).toBe(true);
    expect(store.persisted()).toBeNull();
    expect(store.ingested()?.householdId).toBe(previous.householdId);
    expect(store.ingested()?.transactions.some((row) => row.note === "Milk")).toBeFalsy();
  });

  it("rejects an invalid command without writing JSON, books, or transport", async () => {
    const previous = catalogHousehold();
    const store = memoryAdapters();
    const transports: number[] = [];
    store.adapters.transport = async () => {
      transports.push(1);
      return { ok: true };
    };
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: { ...previous, environment: "production" },
      confirmationId: "confirm-env",
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.postedNothing).toBe(true);
    expect(store.persisted()).toBeNull();
    expect(store.ingested()).toBeNull();
    expect(transports).toEqual([]);
  });

  it("rejects an unbalanced journal without mutation", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Unbalanced"));
    const store = memoryAdapters();
    store.adapters.ingest = async () => ({ ok: false, error: "Journal is unbalanced. Nothing was posted." });
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-unbalanced",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.errorClass).toBe("unbalanced-journal");
    expect(outcome.postedNothing).toBe(true);
    expect(store.persisted()).toBeNull();
  });

  it("keeps the previous household when PGlite ingest fails", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Bread"));
    const store = memoryAdapters({ ingestOk: false });
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-ingest",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.postedNothing).toBe(true);
    expect(outcome.household.revision).toBe(previous.revision);
    expect(store.persisted()).toBeNull();
  });

  it("restores books and keeps the previous snapshot when persist fails", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Eggs"));
    const store = memoryAdapters({ persistOk: false });
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-persist",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.postedNothing).toBe(true);
    expect(store.ingested()?.householdId).toBe(previous.householdId);
    expect(store.ingested()?.revision).toBe(previous.revision);
  });

  it("posts once when Confirm is repeated with the same confirmation id", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Butter"));
    const store = memoryAdapters();
    const first = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-butter",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    const second = await acceptHouseholdWrite({
      previous: first.household,
      candidate: posted.household,
      confirmationId: "confirm-butter",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(first.postedExactlyOnce).toBe(true);
    expect(second.postedExactlyOnce).toBe(true);
    expect(second.duplicateOfReceiptId).toBe("confirm-butter");
    expect(second.household.commandReceipts.filter((row) => row.confirmationId === "confirm-butter")).toHaveLength(1);
  });

  it("does not claim postedNothing when persist fails and books restore fails", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Jam"));
    const store = memoryAdapters({ persistOk: false });
    store.adapters.restoreIngest = async () => {
      throw new Error("restore exploded");
    };
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-uncertain",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.kind).toBe("recovery-available");
    expect(outcome.postedNothing).toBe(false);
    expect(outcome.postedExactlyOnce).toBe(false);
    expect(outcome.recoveryAvailable).toBe(true);
  });

  it("rejects a structurally unbalanced journal before ingest or persist", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Skew"));
    const last = posted.household.transactions.at(-1)!;
    const broken = {
      ...posted.household,
      transactions: posted.household.transactions.map((row) =>
        row.id === last.id ? { ...row, amountCents: last.amountCents + 1 } : row,
      ),
    };
    const store = memoryAdapters();
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: broken,
      confirmationId: "confirm-skew",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.postedNothing).toBe(true);
    expect(store.persisted()).toBeNull();
    expect(store.ingested()).toBeNull();
  });

  it("queues retry when auto-resolve ingest fails", async () => {
    const previous = {
      ...addGoal(catalogHousehold(), { name: "Trip", target: "100.00" }).household,
      linked: true,
      revision: 3,
      baseRevision: 3,
    };
    const goalId = previous.goals[0]!.id;
    const posted = contributeToGoal(previous, goalId, "3.00", { createdBy: "MEM-001", date: "2026-08-24" });
    const remote = contributeToGoal(previous, goalId, "2.00", { createdBy: "MEM-002", date: "2026-08-24" }).household;
    let ingestCount = 0;
    const store = memoryAdapters({
      transport: async () => ({
        ok: false,
        errorClass: "conflict-detected",
        remote: { ...remote, linked: true, revision: 4, baseRevision: 3 },
        message: "Another phone posted a newer household snapshot. Nothing was overwritten.",
      }),
    });
    store.adapters.ingest = async () => {
      ingestCount += 1;
      if (ingestCount > 1) return { ok: false, error: "auto-merge ingest refused" };
      return { ok: true };
    };
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: { ...posted.household, linked: true },
      confirmationId: "confirm-merge-fail",
      postedIds: posted.postedIds,
      transportRequested: true,
      adapters: store.adapters,
    });
    expect(outcome.kind).toBe("pending-transport");
    expect(outcome.postedExactlyOnce).toBe(true);
    expect(outcome.retryable).toBe(true);
  });

  it("ingests an automatic contribution merge before persisting it", async () => {
    const previous = {
      ...addGoal(catalogHousehold(), { name: "Trip", target: "100.00" }).household,
      linked: true,
      revision: 3,
      baseRevision: 3,
    };
    const goalId = previous.goals[0]!.id;
    const local = contributeToGoal(previous, goalId, "3.00", { createdBy: "MEM-001", date: "2026-08-24" });
    const remote = contributeToGoal(previous, goalId, "2.00", { createdBy: "MEM-002", date: "2026-08-24" }).household;
    const events: string[] = [];
    let ingestCount = 0;
    let persistCount = 0;
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: { ...local.household, linked: true },
      confirmationId: "confirm-contribution-merge",
      postedIds: local.postedIds,
      transportRequested: true,
      adapters: {
        ingest: async () => {
          events.push(`ingest-${++ingestCount}`);
          return { ok: true };
        },
        persist: async () => {
          events.push(`persist-${++persistCount}`);
        },
        transport: async () => ({
          ok: false,
          errorClass: "conflict-detected",
          remote: { ...remote, linked: true, revision: 4, baseRevision: 3 },
          message: "stale",
        }),
      },
    });
    expect(outcome.kind).toBe("pending-transport");
    expect(events).toEqual(["ingest-1", "persist-1", "ingest-2", "persist-2"]);
  });

  it("returns pending-transport after local accept when share fails", async () => {
    const previous = { ...catalogHousehold(), linked: true, revision: 1, baseRevision: 1 };
    const posted = postEntry(previous, grocery("Rice"));
    const store = memoryAdapters({
      transport: async () => ({
        ok: false,
        errorClass: "pending-transport",
        message: "Saved on this phone. Sharing can retry from More.",
      }),
    });
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: { ...posted.household, linked: true },
      confirmationId: "confirm-pending",
      postedIds: posted.postedIds,
      transportRequested: true,
      adapters: store.adapters,
    });
    expect(outcome.kind).toBe("pending-transport");
    expect(outcome.ok).toBe(true);
    expect(outcome.postedExactlyOnce).toBe(true);
  });

  it("returns synchronized when continuity transport is requested and succeeds", async () => {
    const previous = { ...catalogHousehold(), linked: true, revision: 1, baseRevision: 1 };
    const posted = postEntry(previous, grocery("Oats"));
    const store = memoryAdapters({
      transport: async () => ({ ok: true }),
    });
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: { ...posted.household, linked: true },
      confirmationId: "confirm-sync",
      postedIds: posted.postedIds,
      transportRequested: true,
      adapters: store.adapters,
    });
    expect(outcome.kind).toBe("synchronized");
    expect(outcome.postedExactlyOnce).toBe(true);
  });

  it("allows explicit Google continuity transport without reviving implicit unlinked upload", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Cloud oats"));
    let transports = 0;
    const store = memoryAdapters({
      transport: async () => {
        transports += 1;
        return { ok: true };
      },
    });
    const localOnly = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-local-default",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(localOnly.kind).toBe("accepted-local");
    expect(transports).toBe(0);

    const continuity = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "confirm-google-continuity",
      postedIds: posted.postedIds,
      transportRequested: true,
      adapters: store.adapters,
    });
    expect(continuity.kind).toBe("synchronized");
    expect(transports).toBe(1);
  });

  it("does not publish a rejected command", async () => {
    const previous = { ...catalogHousehold(), linked: true };
    const posted = postEntry(previous, grocery("Reject me"));
    const broken = {
      ...posted.household,
      linked: true,
      transactions: posted.household.transactions.map((row, index) =>
        index === posted.household.transactions.length - 1 ? { ...row, amountCents: 1 } : row,
      ),
    };
    let published = 0;
    const store = memoryAdapters({
      transport: async () => {
        published += 1;
        return { ok: true };
      },
    });
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: broken,
      confirmationId: "confirm-no-publish",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(published).toBe(0);
  });

  it("auto-resolves stale linked writes without blocking review UI", async () => {
    const previous = { ...catalogHousehold(), linked: true, revision: 3, baseRevision: 3 };
    const posted = postEntry(previous, grocery("Coffee"));
    const remote = { ...previous, revision: 4, lastCommittedAt: "2026-08-24T12:00:00.000Z" };
    const store = memoryAdapters({
      transport: async () => ({
        ok: false,
        errorClass: "conflict-detected",
        remote,
        message: "Another phone posted a newer household snapshot. Nothing was overwritten.",
      }),
    });
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: { ...posted.household, linked: true },
      confirmationId: "confirm-conflict",
      postedIds: posted.postedIds,
      transportRequested: true,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.kind).toBe("pending-transport");
    expect(outcome.retryable).toBe(true);
  });

  it("does not auto-merge when claims money differs", () => {
    const local = catalogHousehold();
    const remote: Household = {
      ...local,
      claims: [
        ...(local.claims ?? []),
        {
          id: "CLM-TEST",
          kind: "insurance",
          label: "Dental",
          appointmentId: null,
          expenseTransactionId: "TX-1",
          recoveryTransactionId: null,
          settleTransferIds: [],
          writeOffTransactionId: null,
          expectedCents: 12000,
          receivedCents: 0,
          writtenOffCents: 0,
          receivableAccountId: "ACC-RECEIVABLE",
          status: "pending",
          submittedAt: null,
          settledAt: null,
          craEligible: false,
          lines: [],
          createdAt: "2026-08-24T00:00:00.000Z",
          updatedAt: "2026-08-24T00:00:00.000Z",
        },
      ],
    };
    expect(canAutoMergeConflict(local, remote)).toBe(false);
  });

  it("does not auto-merge changed transaction, shift, goal-purchase, or tombstone facts", () => {
    const base = addGoal(catalogHousehold(), { name: "Trip", target: "100.00" }).household;
    const posted = postEntry(base, grocery("Complete comparison"));
    const tx = posted.household.transactions.at(-1)!;
    expect(
      canAutoMergeConflict(posted.household, {
        ...posted.household,
        transactions: posted.household.transactions.map((row) =>
          row.id === tx.id ? { ...row, categoryId: "CAT-CHANGED" } : row,
        ),
      }),
    ).toBe(false);

    const shift = {
      id: "SHF-COMPARE",
      date: "2026-08-24" as const,
      memberId: "MEM-001",
      accountId: "ACC-CHEQUING",
      salesCents: 10000,
      cashTipsCents: 1000,
      ccTipsCents: 500,
      hours: 4,
      floorTipOutCents: 100,
      barTipOutCents: 100,
      ccTipOutCents: 10,
      netTipsCents: 1290,
      wagesCents: 6800,
      settings: { floorPct: 1, barPct: 1, barRoundCents: 100, ccPct: 2, hourlyRateCents: 1700 },
      settingsFingerprint: "settings",
      wagesTransactionId: "TX-WAGES",
      tipsTransactionId: "TX-TIPS",
      createdBy: "MEM-001",
      visibility: "household" as const,
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    };
    const withShift = { ...base, shifts: [shift] };
    expect(canAutoMergeConflict(withShift, { ...withShift, shifts: [{ ...shift, salesCents: 10001 }] })).toBe(false);

    const purchase = {
      id: "GPUR-COMPARE",
      goalId: base.goals[0]!.id,
      spentCents: 5000,
      vaultAccountId: "ACC-SAVINGS",
      transactionIds: ["TX-PURCHASE"],
      lines: [{ note: "Item", amountCents: 5000 }],
      memberId: "MEM-001",
      date: "2026-08-24" as const,
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    };
    const withPurchase = { ...base, goalPurchases: [purchase] };
    expect(
      canAutoMergeConflict(withPurchase, {
        ...withPurchase,
        goalPurchases: [{ ...purchase, spentCents: 5001 }],
      }),
    ).toBe(false);
    expect(
      canAutoMergeConflict(base, {
        ...base,
        tombstones: [{ id: tx.id, deletedAt: "2026-08-24T00:00:00.000Z" }],
      }),
    ).toBe(false);
  });
});
