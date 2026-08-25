import { describe, expect, it } from "vitest";
import {
  recentChangesEmptyCopy,
  recentChangesHeaderPill,
  recentChangesOlderLabel,
  restorePointsEmptyCopy,
} from "../src/recentChangesCopy.ts";

describe("Recent changes copy (combined undo engine)", () => {
  it("describes confirmation-scoped Undo for every environment", () => {
    expect(recentChangesEmptyCopy("development")).toMatch(/latest money Confirm/);
    expect(recentChangesEmptyCopy("production")).toMatch(/partner posts stay/i);
  });

  it("labels the pill with this-phone count", () => {
    expect(recentChangesHeaderPill({
      environment: "development",
      historyCount: 0,
      hasSyncAnchor: true,
    })).toBe("None");
    expect(recentChangesHeaderPill({
      environment: "development",
      historyCount: 3,
      myLedgerCount: 2,
      hasSyncAnchor: true,
    })).toBe("2 on this phone");
  });

  it("marks older rows as undo-newer-first", () => {
    expect(recentChangesOlderLabel("development")).toBe("undo newer first");
    expect(recentChangesOlderLabel("production")).toBe("undo newer first");
  });

  it("explains Restore empty state for owners and members", () => {
    expect(restorePointsEmptyCopy(true)).toMatch(/dated restore points/i);
    expect(restorePointsEmptyCopy(false)).toMatch(/Only an owner/i);
  });
});
