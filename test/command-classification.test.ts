import { describe, expect, it } from "vitest";
import {
  COMMAND_CLASSIFICATION,
  classifyCommandKind,
  undoToastSecondaryCopy,
} from "../src/core/commandClassification.ts";

describe("command classification (T2-S6)", () => {
  it("lists confirmation-scoped undo for ledger posts", () => {
    const post = classifyCommandKind("postEntry");
    expect(post.correctionRoute).toBe("confirmation-undo");
    expect(post.partnerSafe).toBe(true);
    expect(classifyCommandKind("reversePostedMoney").correctionRoute).toBe("confirmation-undo");
    expect(classifyCommandKind("undoLedgerConfirm").correctionRoute).toBe("non-undoable");
    expect(classifyCommandKind("restorePoint").correctionRoute).toBe("owner-restore-point");
  });

  it("marks transport commands as non-undoable", () => {
    expect(classifyCommandKind("boot-reconcile").correctionRoute).toBe("non-undoable");
    expect(classifyCommandKind("continuity-pull").correctionRoute).toBe("non-undoable");
  });

  it("defaults unknown kinds to kitchen-local", () => {
    const unknown = classifyCommandKind("scribbleChalk");
    expect(unknown.writeKind).toBe("kitchen-local");
    expect(unknown.correctionRoute).toBe("kitchen-local-only");
  });

  it("keeps a stable table for handoff", () => {
    expect(COMMAND_CLASSIFICATION.length).toBeGreaterThanOrEqual(8);
    expect(undoToastSecondaryCopy()).toMatch(/partner posts stay/i);
  });
});
