import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/seed.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { effectivePathRecipes } from "../src/core/pathWorld.ts";
import { pathWeather } from "../src/core/pathWeather.ts";
import type { Transaction } from "../src/core/types.ts";
import {
  interpretationGate,
  interpretationSourceRevision,
  journeyDerivedSceneForSupport,
  readSupportedInterpretation,
  resolveSupportedInterpretation,
  supportedAtFor,
  supportedInterpretationKey,
  writeSupportedInterpretation,
  type HouseSceneInterpretation,
  type InterpretationIdentity,
  type JourneySceneInterpretation,
  type QueenSceneInterpretation,
} from "../src/house/supportedInterpretation.ts";

class MemoryStore {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, value); }
  removeItem(key: string) { this.rows.delete(key); }
}

const identity = (scope: "household" | "personal" = "household", memberId = "MEM-001"): InterpretationIdentity => ({ environment: "development", householdId: "HH-1", memberId, scope });
const current = { current: true, freshness: "current" as const, detail: "Current shared books" };
const stale = { current: false, freshness: "stale" as const, detail: "Share paused" };

const queen: QueenSceneInterpretation = {
  pulse: { state: "covered", glyph: "✓", headline: "Covered.", detail: "The accepted plan is supported.", amountCents: null, destination: "fund" },
  condition: { state: "settled", days: 0, words: "The house is settled." },
  visual: {
    body: { level: 6, fullness: "half", seams: 1 },
    vine: { chapter: true, title: "September", week: 2, acts: 3, growth: 3 },
    buds: [{ name: "Camping", size: "large" }],
    feet: { count: 1, nearness: ["soon"] },
  },
};

describe("last-supported scene interpretation", () => {
  it("treats every blocked, connecting, stale and offline transport as unsupported", () => {
    const display = (overrides: Partial<Parameters<typeof interpretationGate>[0]> = {}) => ({ transportMode: "live" as const, transportPrimary: "Live", tone: "neutral" as const, blocksSyncedLabel: false, ...overrides });
    expect(interpretationGate(display(), true).current).toBe(true);
    expect(interpretationGate(display({ blocksSyncedLabel: true }), true)).toMatchObject({ current: false, freshness: "stale" });
    expect(interpretationGate(display({ transportMode: "connecting", transportPrimary: "Connecting" }), true)).toMatchObject({ current: false, freshness: "connecting" });
    expect(interpretationGate(display({ transportMode: "live", transportPrimary: "Catching up", blocksSyncedLabel: true }), true)).toMatchObject({ current: false, freshness: "connecting" });
    expect(interpretationGate(display({ transportMode: "offline" }), true)).toMatchObject({ current: false, freshness: "offline" });
    expect(interpretationGate(display(), false).current).toBe(false);
    expect(interpretationGate(display({ transportMode: "hidden", blocksSyncedLabel: true }), true).current).toBe(true);
  });

  it("freezes the prior category with an explicit support date", () => {
    const first = resolveSupportedInterpretation({ gate: current, current: queen, fallback: queen, sourceRevision: 7, supportedAt: "2026-09-18T12:00:00.000Z" });
    expect(first.capture).not.toBeNull();
    const changed: QueenSceneInterpretation = { ...queen, pulse: { ...queen.pulse, state: "reset", headline: "Time to reset." } };
    const frozen = resolveSupportedInterpretation({ gate: stale, current: changed, fallback: changed, cached: first.capture!, sourceRevision: 8, supportedAt: "2026-09-19T12:00:00.000Z" }).result;
    expect(frozen.value.pulse.state).toBe("covered");
    expect(frozen.statusLine).toBe("Supported as of 2026-09-18 · Share paused");
  });

  it("partitions household, Personal and member caches", () => {
    const store = new MemoryStore();
    writeSupportedInterpretation(store, identity(), "queen", { sourceRevision: 1, supportedAt: "2026-09-18T12:00:00.000Z", value: queen });
    const privateHouse: HouseSceneInterpretation = { bloom: [{ id: "private", title: "Private wish", kind: "intention", date: null, revision: 1 }] };
    writeSupportedInterpretation(store, identity("personal"), "house", { sourceRevision: 2, supportedAt: "2026-09-19T12:00:00.000Z", value: privateHouse });
    expect(readSupportedInterpretation(store, identity())?.queen?.pulse.state).toBe("covered");
    expect(readSupportedInterpretation(store, identity())?.house).toBeUndefined();
    expect(readSupportedInterpretation(store, identity("personal"))?.house?.bloom[0]?.id).toBe("private");
    expect(readSupportedInterpretation(store, identity("personal", "MEM-002"))).toBeNull();
  });

  it("reloads only exact v1 records and rejects corrupt scene payloads", () => {
    const store = new MemoryStore();
    writeSupportedInterpretation(store, identity(), "queen", { sourceRevision: 3, supportedAt: "2026-09-18T12:00:00.000Z", value: queen });
    expect(readSupportedInterpretation(store, identity())?.support.sourceRevision).toBe(3);
    const key = supportedInterpretationKey(identity());
    const valid = JSON.parse(store.getItem(key)!);
    store.setItem(key, JSON.stringify({ ...valid, version: 2 }));
    expect(readSupportedInterpretation(store, identity())).toBeNull();
    store.setItem(key, JSON.stringify({ ...valid, queen: { ...valid.queen, pulse: { ...valid.queen.pulse, state: "excellent" } } }));
    expect(readSupportedInterpretation(store, identity())).toBeNull();
  });

  it("uses one support stamp and drops all old sections when the accepted revision changes", () => {
    const store = new MemoryStore();
    writeSupportedInterpretation(store, identity(), "queen", { sourceRevision: 8, supportedAt: "2026-09-18T12:00:00.000Z", value: queen });
    writeSupportedInterpretation(store, identity(), "house", { sourceRevision: 8, supportedAt: "2026-09-18T12:00:00.000Z", value: { bloom: [] } });
    expect(readSupportedInterpretation(store, identity())).toMatchObject({ support: { sourceRevision: 8 }, queen, house: { bloom: [] } });
    writeSupportedInterpretation(store, identity(), "journey", { sourceRevision: 9, supportedAt: "2026-09-19T12:00:00.000Z", value: { months: [], recipes: [], weather: null } });
    expect(readSupportedInterpretation(store, identity())).toEqual({
      version: 1,
      identity: "development:HH-1:MEM-001:household",
      support: { sourceRevision: 9, supportedAt: "2026-09-19T12:00:00.000Z" },
      journey: { months: [], recipes: [], weather: null },
    });
  });

  it("uses the shared scene date rather than private or room visit recency", () => {
    expect(supportedAtFor({ lastCommittedAt: "2026-09-19T23:59:59.000Z" }, "2026-09-18")).toBe("2026-09-18T12:00:00.000Z");
    expect(interpretationSourceRevision({ revision: 7, lastCommittedAt: "2026-09-19T23:59:59.000Z" }, "household")).toBe(7);
    expect(interpretationSourceRevision({ revision: 7, lastCommittedAt: "2026-09-19T23:59:59.000Z" }, "personal")).toBe(Date.parse("2026-09-19T23:59:59.000Z"));
  });

  it("keeps a stale island frozen, then an accepted correction replaces its cached derived visuals", () => {
    const store = new MemoryStore();
    const base = catalogHousehold();
    const expense = transaction("T-EXP", "expense");
    const beforeHousehold = { ...base, revision: 11, lastCommittedAt: "2026-09-18T12:00:00.000Z", transactions: [expense] };
    const before: JourneySceneInterpretation = { months: pathMonths(beforeHousehold, "2026-09-19"), recipes: effectivePathRecipes(beforeHousehold), weather: pathWeather(beforeHousehold, "2026-09-19") };
    const juneBefore = before.months.find((month) => month.key === "2026-06")!;
    expect(juneBefore.scores.joy).toBeGreaterThan(0);
    const captured = resolveSupportedInterpretation({ gate: current, current: before, fallback: before, sourceRevision: 11, supportedAt: beforeHousehold.lastCommittedAt! }).capture!;
    writeSupportedInterpretation(store, identity(), "journey", captured);

    const refund = { ...transaction("T-REFUND", "refund"), refundOfId: expense.id };
    const correctedHousehold = { ...beforeHousehold, revision: 12, lastCommittedAt: "2026-09-19T12:00:00.000Z", transactions: [expense, refund] };
    const corrected: JourneySceneInterpretation = { months: pathMonths(correctedHousehold, "2026-09-19"), recipes: effectivePathRecipes(correctedHousehold), weather: pathWeather(correctedHousehold, "2026-09-19") };
    expect(corrected.months.find((month) => month.key === "2026-06")!.scores.joy).toBe(0);

    const cachedRecord = readSupportedInterpretation(store, identity())!;
    const cached = { ...cachedRecord.support, value: cachedRecord.journey! };
    const whileStale = resolveSupportedInterpretation({ gate: stale, current: corrected, fallback: corrected, cached, sourceRevision: 12, supportedAt: correctedHousehold.lastCommittedAt! });
    expect(whileStale.result.value.months.find((month) => month.key === "2026-06")!.scores.joy).toBeGreaterThan(0);

    const accepted = resolveSupportedInterpretation({ gate: current, current: corrected, fallback: corrected, cached, sourceRevision: 12, supportedAt: correctedHousehold.lastCommittedAt! });
    writeSupportedInterpretation(store, identity(), "journey", accepted.capture!);
    const reloaded = readSupportedInterpretation(store, identity())!;
    expect(reloaded.support.sourceRevision).toBe(12);
    expect(reloaded.journey!.months.find((month) => month.key === "2026-06")!.scores.joy).toBe(0);
  });

  it("suppresses a newer era, Charter and closed land beside a stale cached island", () => {
    const oldIsland: JourneySceneInterpretation = { months: [], recipes: [], weather: null };
    const captured = resolveSupportedInterpretation({ gate: current, current: oldIsland, fallback: oldIsland, sourceRevision: 20, supportedAt: "2026-09-18T12:00:00.000Z" }).capture!;
    const frozen = resolveSupportedInterpretation({ gate: stale, current: oldIsland, fallback: oldIsland, cached: captured, sourceRevision: 21, supportedAt: "2026-09-19T12:00:00.000Z" }).result;
    const visible = journeyDerivedSceneForSupport(frozen.source, {
      eras: [{ id: "ERA-NEW" }],
      land: { "2026-09": { closed: true } },
      sitdownClosed: new Set(["2026-09"]),
      chapterSitdown: new Map([["CHAPTER-NEW", "closed"]]),
      charter: { id: "CHARTER-NEW" },
    });
    expect(visible).toEqual({ eras: [], land: {}, sitdownClosed: new Set(), chapterSitdown: new Map(), charter: null });
  });
});

function transaction(id: string, type: "expense" | "refund"): Transaction {
  return {
    id, date: type === "expense" ? "2026-06-10" : "2026-09-19", type, amountCents: 10_000, currency: "CAD", accountId: "ACC-CHEQUING",
    categoryId: null, subcategoryId: "SUB-LIFE-FUN", note: "", place: "", splits: [], source: "manual", duplicateKey: id,
    potentialDuplicate: false, isDuplicate: false, reviewed: true, createdBy: "MEM-001", visibility: "household", createdAt: "2026-09-19T12:00:00.000Z", updatedAt: "2026-09-19T12:00:00.000Z",
  } as Transaction;
}
