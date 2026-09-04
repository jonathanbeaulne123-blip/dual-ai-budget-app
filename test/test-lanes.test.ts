import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const TEST_DIRECTORY = new URL(".", import.meta.url);
const testDirectoryPath = fileURLToPath(TEST_DIRECTORY);
const laneRunner = readFileSync(new URL("../scripts/run-test-lanes.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  scripts?: Record<string, string>;
};

function testFiles(directory: string = testDirectoryPath): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

function directPGliteRuntimeTests() {
  return testFiles()
    .map((path) => relative(testDirectoryPath, path).replaceAll("\\", "/"))
    .filter((fileName) => fileName !== "test-lanes.test.ts")
    .filter((fileName) => readFileSync(join(testDirectoryPath, fileName), "utf8").includes("src/ledger/engine.ts"))
    .sort();
}

const serialFixtureTests = [
  "demo-shift-statistics.test.ts",
  "demo-suite.test.ts",
  "permission-matrix.test.ts",
  "scale.test.ts",
  "stress-seed.test.ts",
];

const serialTimingTests = ["continuity-two-browser-proof.test.ts"];

const rpcIsolatedFixtureTests = [
  "demo-suite.test.ts",
  "demo-shift-statistics.test.ts",
  "stress-seed.test.ts",
];

describe("Vitest lanes", () => {
  it("keeps direct PGlite and host-timing tests in the serial books lane", () => {
    expect(packageJson.scripts?.["test:full:lanes"]).toBeUndefined();
    expect(packageJson.scripts?.test).toBe("node scripts/run-quick-gate.mjs");
    expect(packageJson.scripts?.check).toBe("node scripts/run-quick-gate.mjs");
    expect(laneRunner).toContain('const lanes = ["test:fast", "test:books"]');
    expect(laneRunner).toContain("has no direct command");
    const booksLane = packageJson.scripts?.["test:books"] ?? "";
    const fastLane = packageJson.scripts?.["test:fast"] ?? "";
    const runtimeTests = directPGliteRuntimeTests();
    const serialTests = [...runtimeTests, ...serialFixtureTests, ...serialTimingTests].sort();

    expect(runtimeTests).toEqual([
      "almost-there.test.ts",
      "app-startup-p1.test.ts",
      "ask-books.test.ts",
      "auth-invite-discovery.test.ts",
      "books.test.ts",
      "continuity.test.ts",
      "hosted-transport.test.ts",
      "household-fund-pglite.test.ts",
      "opening-truth-pglite.test.ts",
      "performance-p2-benchmark.test.ts",
      "pglite-development-canary.test.ts",
      "proof-matrix.test.ts",
      "sitdown.test.ts",
      "sql-hosts.test.ts",
      "sync-integrity.test.ts",
      "work-coworkers.test.ts",
    ]);
    for (const fileName of serialTests) {
      expect(booksLane).toContain(`test/${fileName}`);
      expect(fastLane).toContain(`--exclude=test/${fileName}`);
    }
    expect([...fastLane.matchAll(/--exclude=test\/([^\s]+)/g)].map((match) => match[1]).sort()).toEqual(serialTests);
    expect([...booksLane.matchAll(/test\/([^\s]+\.test\.ts)/g)].map((match) => match[1]).sort()).toEqual(serialTests);
    for (const fileName of rpcIsolatedFixtureTests) {
      expect(booksLane).toContain(`&& vitest run test/${fileName} --maxWorkers=1`);
    }
    expect(booksLane).toContain("--maxWorkers=1");
    expect(fastLane).toContain("--maxWorkers=4");
  });
});
