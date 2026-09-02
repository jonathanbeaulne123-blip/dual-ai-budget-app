import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearUndoHistory,
  loadUndoHistory,
  saveUndoHistory,
  undoHistoryKey,
} from "../src/undoHistory.ts";
import type { UndoToken } from "../src/core/types.ts";
import { catalogHousehold } from "../src/core/index.ts";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
    },
  });
});

afterEach(() => {
  clearUndoHistory("development", "HH-test", "MEM-001");
  clearUndoHistory("development", "HH-test", "MEM-002");
});

function token(id: string): UndoToken {
  return {
    id,
    label: id,
    snapshot: catalogHousehold(),
    postedIds: [`TXN-${id}`],
    actorMemberId: "MEM-001",
  };
}

function currentWithFundEvent(eventId: string) {
  const current = catalogHousehold();
  current.fundEvents = [{
    id: eventId,
    fundId: current.householdFund?.id ?? "FUND-HOUSEHOLD",
    kind: "purchase-funded",
    amountCents: 1234,
    date: "2026-09-02",
    createdBy: "MEM-001",
    confirmedByMemberId: "MEM-001",
    contributorMemberId: null,
    destinationAccountId: "ACC-CARD",
    relatedEventId: null,
    relatedTransactionIds: ["TXN-funded"],
    evidenceDigests: [],
    reconciliationTied: null,
    purpose: "Household purchase",
    note: "",
    createdAt: "2026-09-02T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z",
  }];
  return current;
}

describe("undoHistory persistence", () => {
  it("stores a scoped key and trims to 20 ledger tokens", () => {
    const current = catalogHousehold();
    expect(undoHistoryKey("development", "HH-test", "MEM-001")).toContain("development");
    const many = Array.from({ length: 25 }, (_, index) => token(`ACT-${index}`));
    saveUndoHistory("development", "HH-test", "MEM-001", many);
    const raw = memory.get(undoHistoryKey("development", "HH-test", "MEM-001")) ?? "";
    const loaded = loadUndoHistory("development", "HH-test", "MEM-001", current);
    expect(loaded).toHaveLength(20);
    expect(loaded[0]?.id).toBe("ACT-5");
    expect(loaded.at(-1)?.id).toBe("ACT-24");
    expect(loaded[0]?.snapshot).toBe(current);
    expect(raw).not.toContain("transactions");
  });

  it("clears only the scoped member history", () => {
    const current = catalogHousehold();
    saveUndoHistory("development", "HH-test", "MEM-001", [token("ACT-a")]);
    saveUndoHistory("development", "HH-test", "MEM-002", [token("ACT-b")]);
    clearUndoHistory("development", "HH-test", "MEM-001");
    expect(loadUndoHistory("development", "HH-test", "MEM-001", current)).toEqual([]);
    expect(loadUndoHistory("development", "HH-test", "MEM-002", current)).toHaveLength(1);
  });

  it("keeps funded correction identity across reload and hides legacy funded rows that cannot be corrected", () => {
    const current = currentWithFundEvent("FUND-EVT-funded");
    const funded = {
      ...token("ACT-funded"),
      postedIds: ["TXN-funded", "FUND-EVT-funded"],
      commandKind: "postEntry",
    };
    const directDebit = {
      ...token("ACT-direct-debit"),
      postedIds: ["TXN-direct-debit", "FUND-EVT-direct-debit"],
      commandKind: "postHouseholdFundDirectDebit",
    };

    saveUndoHistory("development", "HH-test", "MEM-001", [funded, directDebit]);
    expect(loadUndoHistory("development", "HH-test", "MEM-001", current)[0]).toMatchObject({
      id: "ACT-funded",
      commandKind: "postEntry",
      postedIds: ["TXN-funded", "FUND-EVT-funded"],
    });
    expect(loadUndoHistory("development", "HH-test", "MEM-001", current)[1]).toMatchObject({
      id: "ACT-direct-debit",
      commandKind: "postHouseholdFundDirectDebit",
      postedIds: ["TXN-direct-debit", "FUND-EVT-direct-debit"],
    });

    localStorage.setItem(undoHistoryKey("development", "HH-test", "MEM-001"), JSON.stringify([{
      id: "ACT-legacy-funded",
      label: "Legacy funded purchase",
      postedIds: ["TXN-funded", "FUND-EVT-funded"],
      actorMemberId: "MEM-001",
    }]));
    expect(loadUndoHistory("development", "HH-test", "MEM-001", current)).toEqual([]);
  });

  it("never turns an accepted write into a failure when the optional undo backup is out of space", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); },
        removeItem: () => undefined,
      },
    });

    expect(() => saveUndoHistory("development", "HH-test", "MEM-001", [token("ACT-large")])).not.toThrow();
  });
});
