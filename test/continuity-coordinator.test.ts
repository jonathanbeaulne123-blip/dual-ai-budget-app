import { describe, expect, it } from "vitest";
import {
  createContinuityCoordinator,
  pullDedupeKey,
  PULL_DEDUPE_WINDOW_MS,
  shouldIgnoreInboundSnapshot,
} from "../src/continuityCoordinator.ts";

describe("shouldIgnoreInboundSnapshot", () => {
  it("ignores stale signals when remote revision is at or below local tip", () => {
    expect(shouldIgnoreInboundSnapshot({
      remoteRevision: 4,
      localTipRevision: 5,
      hasOpenConflict: false,
    })).toBe(true);
    expect(shouldIgnoreInboundSnapshot({
      remoteRevision: 5,
      localTipRevision: 5,
      hasOpenConflict: false,
    })).toBe(true);
  });

  it("does not ignore when remote is ahead", () => {
    expect(shouldIgnoreInboundSnapshot({
      remoteRevision: 6,
      localTipRevision: 5,
      hasOpenConflict: false,
    })).toBe(false);
  });

  it("does not ignore when an open conflict needs reconcile", () => {
    expect(shouldIgnoreInboundSnapshot({
      remoteRevision: 4,
      localTipRevision: 5,
      hasOpenConflict: true,
    })).toBe(false);
  });
});

describe("createContinuityCoordinator mutex", () => {
  it("serializes concurrent runs instead of dropping them", async () => {
    const order: string[] = [];
    const coordinator = createContinuityCoordinator();

    const first = coordinator.run("realtime", async () => {
      order.push("start-1");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("end-1");
    });
    const second = coordinator.run("poll", async () => {
      order.push("start-2");
      order.push("end-2");
    });

    await Promise.all([first, second]);
    expect(order).toEqual(["start-1", "end-1", "start-2", "end-2"]);
  });

  it("queues a third run while flush and pull overlap", async () => {
    const order: string[] = [];
    const coordinator = createContinuityCoordinator();

    const flush = coordinator.run("manual", async () => {
      order.push("flush-start");
      await new Promise((resolve) => setTimeout(resolve, 15));
      order.push("flush-end");
    });
    const pull = coordinator.run("realtime", async () => {
      order.push("pull-start");
      order.push("pull-end");
    });
    const duplicate = coordinator.run("realtime", async () => {
      order.push("dup-start");
      order.push("dup-end");
    });

    await Promise.all([flush, pull, duplicate]);
    expect(order).toEqual([
      "flush-start",
      "flush-end",
      "pull-start",
      "pull-end",
      "dup-start",
      "dup-end",
    ]);
  });
});

describe("pull dedupe window", () => {
  it("dedupes the same household+revision within 100 ms", () => {
    let now = 1_000;
    const coordinator = createContinuityCoordinator(() => now);
    coordinator.recordPull("HH-DEMO", 7);
    expect(coordinator.shouldDedupePull("HH-DEMO", 7)).toBe(true);
    now += PULL_DEDUPE_WINDOW_MS;
    expect(coordinator.shouldDedupePull("HH-DEMO", 7)).toBe(false);
  });

  it("does not dedupe a different revision", () => {
    const coordinator = createContinuityCoordinator(() => 1_000);
    coordinator.recordPull("HH-DEMO", 7);
    expect(coordinator.shouldDedupePull("HH-DEMO", 8)).toBe(false);
  });

  it("uses stable dedupe keys", () => {
    expect(pullDedupeKey("HH-A", 3)).toBe("HH-A:3");
  });
});

describe("accept dedupe", () => {
  it("skips duplicate PGlite accept for the same revision inside the window", () => {
    let now = 5_000;
    const coordinator = createContinuityCoordinator(() => now);
    coordinator.recordAccept("HH-DEMO", 9);
    expect(coordinator.shouldSkipAccept("HH-DEMO", 9)).toBe(true);
    now += PULL_DEDUPE_WINDOW_MS;
    expect(coordinator.shouldSkipAccept("HH-DEMO", 9)).toBe(false);
  });
});

describe("race scenarios (T1-S4 matrix)", () => {
  it("Realtime during flush — both complete without parallel overlap", async () => {
    let overlapping = 0;
    let maxOverlap = 0;
    const coordinator = createContinuityCoordinator();

    const track = async (label: string) => {
      overlapping += 1;
      maxOverlap = Math.max(maxOverlap, overlapping);
      await new Promise((resolve) => setTimeout(resolve, 10));
      overlapping -= 1;
      return label;
    };

    await Promise.all([
      coordinator.run("manual", () => track("flush")),
      coordinator.run("realtime", () => track("realtime")),
    ]);

    expect(maxOverlap).toBe(1);
  });

  it("serializes command acceptance behind existing recovery work", async () => {
    const coordinator = createContinuityCoordinator();
    let activePgliteAccepts = 0;
    let maxPgliteAccepts = 0;
    const order: string[] = [];
    const accept = async (label: string, waitMs: number) => {
      activePgliteAccepts += 1;
      maxPgliteAccepts = Math.max(maxPgliteAccepts, activePgliteAccepts);
      order.push(`${label}-start`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      order.push(`${label}-end`);
      activePgliteAccepts -= 1;
    };

    await Promise.all([
      coordinator.run("realtime", () => accept("snapshot", 10)),
      coordinator.run("realtime", () => accept("command", 0)),
    ]);

    expect(maxPgliteAccepts).toBe(1);
    expect(order).toEqual([
      "snapshot-start",
      "snapshot-end",
      "command-start",
      "command-end",
    ]);
  });

  it("duplicate Realtime events — stale revision ignored; fresh revision queued once", async () => {
    const merges: number[] = [];
    const coordinator = createContinuityCoordinator();
    const localTip = 5;

    const maybeMerge = (remoteRevision: number) => {
      if (shouldIgnoreInboundSnapshot({
        remoteRevision,
        localTipRevision: localTip,
        hasOpenConflict: false,
      })) return;
      if (coordinator.shouldDedupePull("HH-DEMO", remoteRevision)) return;
      coordinator.recordPull("HH-DEMO", remoteRevision);
      if (coordinator.shouldSkipAccept("HH-DEMO", remoteRevision)) return;
      merges.push(remoteRevision);
      coordinator.recordAccept("HH-DEMO", remoteRevision);
    };

    await Promise.all([
      coordinator.run("realtime", async () => { maybeMerge(5); }),
      coordinator.run("realtime", async () => { maybeMerge(5); }),
      coordinator.run("realtime", async () => { maybeMerge(6); }),
    ]);

    expect(merges).toEqual([6]);
  });

  it("flush during pull — serialized; accept count stays at one per revision", async () => {
    const accepts = new Map<string, number>();
    const coordinator = createContinuityCoordinator();

    const acceptOnce = (householdId: string, revision: number) => {
      const key = pullDedupeKey(householdId, revision);
      accepts.set(key, (accepts.get(key) ?? 0) + 1);
    };

    await Promise.all([
      coordinator.run("poll", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (!coordinator.shouldSkipAccept("HH-DEMO", 4)) {
          coordinator.recordAccept("HH-DEMO", 4);
          acceptOnce("HH-DEMO", 4);
        }
      }),
      coordinator.run("manual", async () => {
        if (!coordinator.shouldSkipAccept("HH-DEMO", 4)) {
          coordinator.recordAccept("HH-DEMO", 4);
          acceptOnce("HH-DEMO", 4);
        }
      }),
    ]);

    expect(accepts.get("HH-DEMO:4")).toBe(1);
  });
});
