import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const pnpmEntrypoint = process.env.npm_execpath;
const lanes = ["test:fast", "test:books"];

function runLane(lane) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [pnpmEntrypoint, lane], { stdio: "inherit" });
    child.once("error", (error) => {
      console.error(`Could not start ${lane}: ${error.message}`);
      resolve(1);
    });
    child.once("close", (code) => resolve(code ?? 1));
  });
}

export async function runFullTestLanes() {
  if (!pnpmEntrypoint) throw new Error("The test-lane coordinator must run through pnpm.");
  const results = [];
  for (const lane of lanes) results.push([lane, await runLane(lane)]);

  const failed = results.filter(([, code]) => code !== 0);
  if (failed.length > 0) {
    throw new Error(`Test lanes failed: ${failed.map(([lane]) => lane).join(", ")}.`);
  }
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.error("The exhaustive lane coordinator has no direct command. Use the authorized pnpm test:full or pnpm check:full gate.");
  process.exitCode = 1;
}
