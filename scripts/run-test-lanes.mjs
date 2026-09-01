import { spawn } from "node:child_process";

const pnpmEntrypoint = process.env.npm_execpath;
const lanes = ["test:fast", "test:books"];

if (!pnpmEntrypoint) throw new Error("The test-lane coordinator must run through pnpm.");

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

const results = [];
for (const lane of lanes) results.push([lane, await runLane(lane)]);

const failed = results.filter(([, code]) => code !== 0);
if (failed.length > 0) {
  console.error(`Test lanes failed: ${failed.map(([lane]) => lane).join(", ")}`);
  process.exitCode = 1;
}
