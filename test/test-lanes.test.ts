import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const TEST_DIRECTORY = new URL(".", import.meta.url);
const testDirectoryPath = fileURLToPath(TEST_DIRECTORY);
const laneRunner = readFileSync(new URL("../scripts/run-test-lanes.mjs", import.meta.url), "utf8");
const demoSuiteRunner = readFileSync(new URL("../scripts/run-demo-suite-tests.mjs", import.meta.url), "utf8");
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
  "ledger-sync-cutover.test.ts",
  "demo-shift-statistics.test.ts",
  "demo-suite.test.ts",
  "permission-matrix.test.ts",
  "scale.test.ts",
  "stress-seed.test.ts",
];

const serialTimingTests = ["continuity-two-browser-proof.test.ts"];

const rpcIsolatedFixtureTests = [
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

    // Discovery is the authority: every newly added runtime test must be routed
    // to the serial lane without maintaining a second frozen filename list.
    expect(runtimeTests).toContain("pglite-development-canary.test.ts");
    for (const fileName of serialTests) {
      expect(booksLane).toContain(`test/${fileName}`);
      expect(fastLane).toContain(`--exclude=test/${fileName}`);
    }
    expect([...fastLane.matchAll(/--exclude=test\/([^\s]+)/g)].map((match) => match[1]).sort()).toEqual(serialTests);
    expect([...booksLane.matchAll(/test\/([^\s]+\.test\.ts)/g)].map((match) => match[1]).sort()).toEqual(serialTests);
    for (const fileName of rpcIsolatedFixtureTests) {
      expect(booksLane).toContain(`&& vitest run test/${fileName} --maxWorkers=1`);
    }
    expect(booksLane).toContain("&& node scripts/run-demo-suite-tests.mjs test/demo-suite.test.ts");
    expect(demoSuiteRunner.match(/^[ ]{2}".+",$/gm)).toHaveLength(9);
    expect(demoSuiteRunner).toContain('[pnpmEntrypoint, "exec", "vitest", "run", testPath, "--maxWorkers=1", "-t", title]');
    expect(booksLane).toContain("--maxWorkers=1");
    expect(booksLane).toContain("--testTimeout=30000");
    expect(readFileSync(new URL("../scripts/run-quick-gate.mjs", import.meta.url), "utf8"))
      .toContain('...batched, "--maxWorkers=1", "--testTimeout=30000"');
    expect(fastLane).toContain("--maxWorkers=4");
  });
});
