import { describe, expect, it } from "vitest";
import {
  AUTO_MERGE_MESSAGE,
  renderCommandChrome,
  renderCommandSurface,
} from "../src/commandSurface.tsx";
import { COMMAND_SURFACE_FIXTURES } from "../src/claude/commandContract.ts";
import { outcome } from "../src/core/commandOutcome.ts";
import { catalogHousehold, countDifferingSharedTransactionIds, resolveConflictChoice } from "../src/core/index.ts";

describe("renderCommandChrome", () => {
  it("never shows success toast when nothing posted", () => {
    const rejected = renderCommandChrome(COMMAND_SURFACE_FIXTURES["rejected-no-write"]);
    expect(rejected.toast).toBeNull();
    expect(rejected.liveAnnouncement).toMatch(/not posted/i);

    const invalid = renderCommandChrome(COMMAND_SURFACE_FIXTURES["permanent-validation-failure"]);
    expect(invalid.toast).toBeNull();
  });

  it("shows success toast only when posted exactly once", () => {
    const synced = renderCommandChrome(COMMAND_SURFACE_FIXTURES.synchronized, { amountLabel: "$4.00" });
    expect(synced.toast?.primary).toBe("Posted $4.00");
    expect(synced.toast?.showUndo).toBe(true);
    expect(synced.chip?.primary).toBe("Up to date");
  });

  it("keeps pending chip always and banner only when offline or errored", () => {
    const quiet = renderCommandChrome(COMMAND_SURFACE_FIXTURES["pending-transport"], { amountLabel: "$2.00" });
    expect(quiet.chip?.primary).toBe("Sharing…");
    expect(quiet.chip?.tone).toBe("neutral");
    expect(quiet.banner).toBeNull();
    expect(quiet.toast?.secondary).toBe("Waiting to share.");

    const offline = renderCommandChrome(COMMAND_SURFACE_FIXTURES["pending-transport"], {
      offline: true,
      pendingCount: 2,
    });
    expect(offline.chip?.primary).toBe("Waiting to share");
    expect(offline.chip?.secondary).toBe("· offline");
    expect(offline.banner?.primary).toBe("Saved here. Not shared yet.");
    expect(offline.banner?.actionLabel).toBe("Retry now");

    const failed = renderCommandChrome(COMMAND_SURFACE_FIXTURES["pending-transport"], {
      lastError: "Share paused after three tries.",
    });
    expect(failed.chip?.primary).toBe("Waiting to share");
    expect(failed.banner?.secondary).toBe("Share paused after three tries.");

    const quota = renderCommandChrome(COMMAND_SURFACE_FIXTURES["pending-transport"], {
      lastError: "Failed to execute 'setItem' on 'Storage': Setting the value of 'hearth:continuity-outbox:v1:development' exceeded the quota.",
    });
    expect(quota.banner?.secondary).toMatch(/browser storage is full/i);
    expect(quota.banner?.actionLabel).toBe("Retry now");
  });

  it("maps a same-fact conflict to the blocking review sheet", () => {
    const conflict = renderCommandChrome(COMMAND_SURFACE_FIXTURES["conflict-needs-attention"]);
    expect(conflict.banner?.blocking).toBe(true);
    expect(conflict.banner?.actionLabel).toBe("Review conflict");
    expect(conflict.liveAnnouncement).toMatch(/review/i);
    expect(conflict.chip?.primary).toBe("Needs attention");
  });

  it("shows recovery banner without success toast", () => {
    const recovery = renderCommandChrome(COMMAND_SURFACE_FIXTURES["recovery-available"]);
    expect(recovery.banner?.blocking).toBe(true);
    expect(recovery.toast).toBeNull();
    expect(recovery.liveAnnouncement).toMatch(/do not confirm again/i);
  });

  it("shows Jonathan auto-merge copy when flagged", () => {
    const merged = renderCommandChrome(COMMAND_SURFACE_FIXTURES["accepted-local"], {
      autoMerged: true,
      amountLabel: "$10.00",
    });
    expect(merged.showAutoMergeMessage).toBe(true);
    expect(merged.toast?.secondary).toBe(AUTO_MERGE_MESSAGE);
  });

  it("wraps CommandOutcome through renderCommandSurface", () => {
    const household = catalogHousehold();
    const surface = renderCommandSurface(
      outcome({
        kind: "synchronized",
        household,
        previous: household,
        postedIds: ["TXN-1"],
        confirmationId: "confirm-test",
        identityHash: "abc",
        revision: 2,
        sharingMode: "synchronized",
        errorClass: null,
        userMessage: null,
        retryable: false,
        recoveryAvailable: false,
        ok: true,
        postedExactlyOnce: true,
        postedNothing: false,
      }),
      { ledgerName: "Beaulne Demo" },
    );
    expect(surface.chip?.secondary).toBe("· Beaulne Demo");
  });

  it("counts shared-only transaction diffs for conflict review", () => {
    const base = catalogHousehold();
    const sample = base.transactions[0]!;
    const local = {
      ...base,
      transactions: [
        ...base.transactions,
        { ...sample, id: "TX-SHARED-A", note: "Shared milk", visibility: "household" as const },
        { ...sample, id: "TX-PERSONAL", note: "Private", visibility: "personal" as const, createdBy: "MEM-002" },
      ],
    };
    const remote = {
      ...base,
      transactions: [
        ...base.transactions,
        { ...sample, id: "TX-SHARED-A", note: "Cloud milk", visibility: "household" as const },
        { ...sample, id: "TX-PERSONAL", note: "Different private", visibility: "personal" as const, createdBy: "MEM-002" },
      ],
    };
    expect(countDifferingSharedTransactionIds(local, remote)).toBe(1);
  });

  it("resolves conflict choice without dropping conflict history", () => {
    const local = catalogHousehold();
    const remote = { ...local, revision: 4 };
    const conflictId = "CONF-TEST";
    const household = {
      ...local,
      linked: true,
      revision: 3,
      conflicts: [
        {
          id: conflictId,
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
      sharing: { mode: "conflicted" as const, linked: true, lastTransportAt: null, lastError: "conflict", pending: false },
    };

    const keptLocal = resolveConflictChoice(household, conflictId, "local");
    expect(keptLocal.conflicts.find((row) => row.id === conflictId)?.resolved).toBe(true);
    expect(keptLocal.sharing.mode).toBe("pending-transport");

    const keptRemote = resolveConflictChoice(household, conflictId, "remote");
    expect(keptRemote.conflicts.find((row) => row.id === conflictId)?.resolved).toBe(true);
    expect(keptRemote.sharing.mode).toBe("synchronized");
    expect(keptRemote.revision).toBe(4);
  });
});
