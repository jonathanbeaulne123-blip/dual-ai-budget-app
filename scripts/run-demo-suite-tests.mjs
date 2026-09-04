import { spawn } from "node:child_process";

const pnpmEntrypoint = process.env.npm_execpath;
const testPath = "test/demo-suite.test.ts";
const cases = [
  "replays the exact same dated household and manifest from one seed",
  "covers every domain engine and every Hercules Pro calculation surface",
  "marks any changed generated fact not-ready even when provenance is retained",
  "keeps synthetic schedules proposal-only and partner-personal facts out of Shared",
  "refuses Production and ordinary Development replacement",
  "rejects synthetic provenance outside Development and preserves it through shared merges",
  "uses profile as part of generation while keeping each profile replayable",
  "uses Toronto standard and daylight offsets and derives coherent shift duration",
];

function runCase(title) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [pnpmEntrypoint, "exec", "vitest", "run", testPath, "--maxWorkers=1", "-t", title],
      { stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Demo Suite case failed (${code ?? 1}): ${title}`));
    });
  });
}

if (!pnpmEntrypoint) throw new Error("The Demo Suite test runner must run through pnpm.");
if (process.argv[2] && process.argv[2] !== testPath) {
  throw new Error(`The Demo Suite runner accepts only ${testPath}.`);
}

for (const title of cases) await runCase(title);
