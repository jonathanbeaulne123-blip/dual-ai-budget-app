import { afterEach, describe, expect, it } from "vitest";
import {
  clearUndoHistory,
  loadUndoHistory,
  saveUndoHistory,
  undoHistoryKey,
} from "../src/undoHistory.ts";
import type { UndoToken } from "../src/core/types.ts";
import { catalogHousehold } from "../src/core/index.ts";

afterEach(() => {
  clearUndoHistory("development", "HH-test", "MEM-001");
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
    expect(undoHistoryKey("development", "HH-test", "MEM-001")).toContain("development");
    const many = Array.from({ length: 25 }, (_, index) => token(`ACT-${index}`));
    saveUndoHistory("development", "HH-test", "MEM-001", many);
    const loaded = loadUndoHistory("development", "HH-test", "MEM-001");
    expect(loaded).toHaveLength(20);
    expect(loaded[0]?.id).toBe("ACT-5");
    expect(loaded.at(-1)?.id).toBe("ACT-24");
  });

  it("clears only the scoped member history", () => {
    saveUndoHistory("development", "HH-test", "MEM-001", [token("ACT-a")]);
    saveUndoHistory("development", "HH-test", "MEM-002", [token("ACT-b")]);
    clearUndoHistory("development", "HH-test", "MEM-001");
    expect(loadUndoHistory("development", "HH-test", "MEM-001")).toEqual([]);
    expect(loadUndoHistory("development", "HH-test", "MEM-002")).toHaveLength(1);
    clearUndoHistory("development", "HH-test", "MEM-002");
  });
});
