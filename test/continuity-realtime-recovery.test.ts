import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createContinuityRealtimeRecoveryGate,
  REALTIME_COMMAND_GRACE_MS,
  recoverRealtimeSnapshot,
} from "../src/continuityRealtimeRecovery.ts";

afterEach(() => {
  vi.useRealTimers();
});

function createHarness(initialRevision = 3) {
  vi.useFakeTimers();
  let revision = initialRevision;
  let hasOpenConflict = false;
  const recover = vi.fn();
  const gate = createContinuityRealtimeRecoveryGate({
    getLocalState: () => ({ revision, hasOpenConflict }),
    scheduleRecovery: recover,
    defer: (fn, waitMs) => {
      const id = setTimeout(fn, waitMs);
      return { clear: () => clearTimeout(id) };
    },
  });
  return {
    gate,
    recover,
    setRevision: (next: number) => { revision = next; },
    setConflict: (next: boolean) => { hasOpenConflict = next; },
  };
}

describe("Realtime snapshot recovery gate", () => {
  it("coalesces snapshot echoes into one delayed recovery pull", () => {
    const harness = createHarness();
    harness.gate.noteSnapshot({ table: "household_snapshots", revision: 4 });
    harness.gate.noteSnapshot({ table: "continuity_personal_snapshots", revision: 4 });

    vi.advanceTimersByTime(REALTIME_COMMAND_GRACE_MS - 1);
    expect(harness.recover).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(harness.recover).toHaveBeenCalledOnce();
  });

  it("lets the matching command cancel its snapshot recovery", () => {
    const harness = createHarness();
    harness.gate.noteSnapshot({ table: "household_snapshots", revision: 4 });
    harness.gate.beginCommand();
    harness.setRevision(4);
    harness.gate.finishCommand("covered");

    vi.advanceTimersByTime(REALTIME_COMMAND_GRACE_MS * 2);
    expect(harness.recover).not.toHaveBeenCalled();
  });

  it("drops a command-first snapshot echo after the accepted revision is current", () => {
    const harness = createHarness(4);
    harness.gate.beginCommand();
    harness.gate.finishCommand("covered");
    harness.gate.noteSnapshot({ table: "household_snapshots", revision: 4 });

    vi.advanceTimersByTime(REALTIME_COMMAND_GRACE_MS);
    expect(harness.recover).not.toHaveBeenCalled();
  });

  it("retains recovery when the command is invalid or has a revision gap", () => {
    const harness = createHarness();
    harness.gate.noteSnapshot({ table: "household_snapshots", revision: 4 });
    harness.gate.beginCommand();
    harness.gate.finishCommand("recover");

    vi.runOnlyPendingTimers();
    expect(harness.recover).toHaveBeenCalledOnce();
  });

  it("does not hide an unknown, ahead, or conflicted snapshot", () => {
    const unknown = createHarness();
    unknown.gate.noteSnapshot({ table: "household_snapshots", revision: null });
    unknown.gate.beginCommand();
    unknown.setRevision(4);
    unknown.gate.finishCommand("covered");
    vi.runOnlyPendingTimers();
    expect(unknown.recover).toHaveBeenCalledOnce();
    unknown.gate.dispose();

    const conflicted = createHarness(4);
    conflicted.setConflict(true);
    conflicted.gate.noteSnapshot({ table: "household_snapshots", revision: 4 });
    vi.runOnlyPendingTimers();
    expect(conflicted.recover).toHaveBeenCalledOnce();
  });

  it("waits for every queued command before deciding whether recovery remains", () => {
    const harness = createHarness();
    harness.gate.noteSnapshot({ table: "household_snapshots", revision: 5 });
    harness.gate.beginCommand();
    harness.gate.beginCommand();
    harness.setRevision(4);
    harness.gate.finishCommand("covered");
    vi.advanceTimersByTime(REALTIME_COMMAND_GRACE_MS * 2);
    expect(harness.recover).not.toHaveBeenCalled();

    harness.setRevision(5);
    harness.gate.finishCommand("covered");
    vi.advanceTimersByTime(REALTIME_COMMAND_GRACE_MS * 2);
    expect(harness.recover).not.toHaveBeenCalled();
  });

  it("cancels deferred recovery when the receiver is disposed", () => {
    const harness = createHarness();
    harness.gate.noteSnapshot({ table: "household_snapshots", revision: 4 });
    harness.gate.dispose();

    vi.advanceTimersByTime(REALTIME_COMMAND_GRACE_MS * 2);
    expect(harness.recover).not.toHaveBeenCalled();
  });
});

describe("Realtime command-log-first recovery", () => {
  it("applies the committed command row before a full snapshot can occupy PGlite", async () => {
    let revision = 3;
    const fullSnapshotRecovery = vi.fn(async () => undefined);
    const result = await recoverRealtimeSnapshot({
      targetRevision: 4,
      getLocalState: () => ({ revision, hasOpenConflict: false }),
      fetchCommandEvents: async (afterRevision) => {
        expect(afterRevision).toBe(3);
        return [{ resultRevision: 4 }];
      },
      applyCommandEvent: async (event) => {
        revision = event.resultRevision;
        return "applied";
      },
      recoverSnapshot: fullSnapshotRecovery,
    });

    expect(result).toBe("command-log");
    expect(fullSnapshotRecovery).not.toHaveBeenCalled();
  });

  it("stops at the signalled revision before a later hidden-revision gap", async () => {
    let revision = 3;
    const applied: number[] = [];
    const fullSnapshotRecovery = vi.fn(async () => undefined);
    const result = await recoverRealtimeSnapshot({
      targetRevision: 4,
      getLocalState: () => ({ revision, hasOpenConflict: false }),
      fetchCommandEvents: async () => [4, 6],
      applyCommandEvent: async (eventRevision) => {
        applied.push(eventRevision);
        if (eventRevision !== revision + 1) return "fallback";
        revision = eventRevision;
        return "applied";
      },
      recoverSnapshot: fullSnapshotRecovery,
    });

    expect(result).toBe("command-log");
    expect(applied).toEqual([4]);
    expect(fullSnapshotRecovery).not.toHaveBeenCalled();
  });

  it("falls through to full recovery when catch-up is absent, invalid, or unknown", async () => {
    const missingRecovery = vi.fn(async () => undefined);
    expect(await recoverRealtimeSnapshot({
      targetRevision: 4,
      getLocalState: () => ({ revision: 3, hasOpenConflict: false }),
      fetchCommandEvents: async () => [],
      applyCommandEvent: async () => "applied",
      recoverSnapshot: missingRecovery,
    })).toBe("snapshot");
    expect(missingRecovery).toHaveBeenCalledOnce();

    const invalidRecovery = vi.fn(async () => undefined);
    expect(await recoverRealtimeSnapshot({
      targetRevision: 4,
      getLocalState: () => ({ revision: 3, hasOpenConflict: false }),
      fetchCommandEvents: async () => [{}],
      applyCommandEvent: async () => "fallback",
      recoverSnapshot: invalidRecovery,
    })).toBe("snapshot");
    expect(invalidRecovery).toHaveBeenCalledOnce();

    const unknownRecovery = vi.fn(async () => undefined);
    expect(await recoverRealtimeSnapshot({
      targetRevision: null,
      getLocalState: () => ({ revision: 3, hasOpenConflict: false }),
      fetchCommandEvents: async () => {
        throw new Error("unknown signals must not rely on command catch-up");
      },
      applyCommandEvent: async () => "applied",
      recoverSnapshot: unknownRecovery,
    })).toBe("snapshot");
    expect(unknownRecovery).toHaveBeenCalledOnce();
  });
});
