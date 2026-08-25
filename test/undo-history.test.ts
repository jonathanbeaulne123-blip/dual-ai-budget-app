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
