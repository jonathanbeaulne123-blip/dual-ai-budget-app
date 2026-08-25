import { describe, expect, it } from "vitest";
import { classifyCommitWrite, isLedgerWrite } from "../src/core/writeKind.ts";
import { renderCommandChrome } from "../src/commandSurface.tsx";
import { COMMAND_SURFACE_FIXTURES } from "../src/claude/commandContract.ts";

describe("classifyCommitWrite", () => {
  it("treats TXN/SHF posted ids as ledger writes", () => {
    expect(classifyCommitWrite({ postedIds: ["TXN-1"] })).toBe("ledger-write");
    expect(classifyCommitWrite({ postedIds: ["SHF-9", "TXN-a"] })).toBe("ledger-write");
    expect(isLedgerWrite({ postedIds: ["TXN-1"] })).toBe(true);
  });

  it("treats empty and non-money ids as kitchen-local", () => {
    expect(classifyCommitWrite({ postedIds: [] })).toBe("kitchen-local");
    expect(classifyCommitWrite({ postedIds: ["GOAL-1"] })).toBe("kitchen-local");
    expect(classifyCommitWrite(null)).toBe("kitchen-local");
    expect(isLedgerWrite({ postedIds: [] })).toBe(false);
  });
});

describe("quiet kitchen undo chrome", () => {
  it("hides Posted/Undo toast when ledgerWrite is false", () => {
    const quiet = renderCommandChrome(COMMAND_SURFACE_FIXTURES.synchronized, {
      amountLabel: "$4.00",
      ledgerWrite: false,
    });
    expect(quiet.toast).toBeNull();
    expect(quiet.liveAnnouncement).toBeNull();
  });

  it("keeps Posted/Undo toast for ledger writes", () => {
    const money = renderCommandChrome(COMMAND_SURFACE_FIXTURES.synchronized, {
      amountLabel: "$4.00",
      ledgerWrite: true,
    });
    expect(money.toast?.primary).toBe("Posted $4.00");
    expect(money.toast?.showUndo).toBe(true);
  });
});
