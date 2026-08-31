import { describe, expect, it } from "vitest";
import { postEntry } from "../src/core/index.ts";
import { compileHousehold } from "../src/core/journal.ts";
import { seedStressHousehold } from "../src/core/stressSeed.ts";
import type { Household } from "../src/core/types.ts";
import { hashBooksSnapshot, ingestBooks, openMemoryBooks } from "../src/ledger/engine.ts";

function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

const perfDescribe = process.env.HEARTH_PERF === "1" ? describe : describe.skip;

perfDescribe("Performance P2 benchmark", () => {
  it("compares 20 warm one-row incremental writes with full rebuilds", async () => {
    let current: Household = seedStressHousehold({
      today: "2026-08-30",
      environment: "development",
      seed: 20260830,
    });
    current = {
      ...current,
      revision: 1,
      lastCommittedAt: "2026-08-30T12:00:00.000Z",
      booksAcceptedHash: await hashBooksSnapshot(current),
    };
    const incrementalDb = await openMemoryBooks();
    const fullDb = await openMemoryBooks();
    const incrementalMs: number[] = [];
    const fullMs: number[] = [];
    try {
      await ingestBooks(incrementalDb, current);
      await ingestBooks(fullDb, current);
      for (let index = 0; index < 20; index += 1) {
        const previous = current;
        const posted = postEntry(previous, {
          date: "2026-08-30",
          type: "expense",
          amount: `${2 + index}.50`,
          accountId: "ACC-VISA",
          subcategoryId: "SUB-FOOD-GROCERIES",
          note: `P2 synthetic row ${index + 1}`,
          confirmDuplicate: true,
        }).household;
        current = {
          ...posted,
          revision: previous.revision + 1,
          lastCommittedAt: new Date(Date.parse("2026-08-30T12:00:00.000Z") + index * 1_000).toISOString(),
          booksAcceptedHash: await hashBooksSnapshot(posted),
        };
        const compiled = compileHousehold(current);
        const incrementalStart = performance.now();
        const status = await ingestBooks(incrementalDb, current, compiled, {
          previous,
          previousCompiled: compileHousehold(previous),
          incremental: true,
        });
        incrementalMs.push(performance.now() - incrementalStart);
        expect(status.writeMode).toBe("incremental");

        const fullStart = performance.now();
        await ingestBooks(fullDb, current, compiled);
        fullMs.push(performance.now() - fullStart);
      }

      const evidence = {
        fixture: { transactions: current.transactions.length, shifts: current.shifts.length },
        incremental: { p50: percentile(incrementalMs, 0.5), p95: percentile(incrementalMs, 0.95) },
        full: { p50: percentile(fullMs, 0.5), p95: percentile(fullMs, 0.95) },
      };
      console.info("PERFORMANCE_P2", JSON.stringify(evidence));
      expect(evidence.incremental.p50).toBeLessThan(evidence.full.p50);
    } finally {
      await incrementalDb.close();
      await fullDb.close();
    }
  }, 180_000);
});
