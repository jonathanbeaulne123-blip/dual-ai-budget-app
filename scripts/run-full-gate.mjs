import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { runFullTestLanes } from "./run-test-lanes.mjs";
import {
  validateFullAuthorization,
  validateFullWorktree,
  verifyGithubAuthorizationRecord,
} from "./verification-policy.mjs";

const pnpmEntrypoint = process.env.npm_execpath;

function capture(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolvePromise(stdout.trim());
      else reject(new Error(`${command} failed (${code ?? 1}). ${stderr.trim()}`));
    });
  });
}

function runPnpm(script, extraEnvironment = {}) {
  if (!pnpmEntrypoint) throw new Error("The full gate must run through pnpm.");
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [pnpmEntrypoint, script], {
      env: { ...process.env, ...extraEnvironment },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${script} failed with exit code ${code ?? 1}.`));
    });
  });
}

export async function main(mode = process.argv[2]) {
  if (!["test", "check"].includes(mode)) throw new Error("Full gate mode must be test or check.");
  const headSha = await capture("git", ["rev-parse", "HEAD"]);
  const authorization = validateFullAuthorization({
    authorizationRef: process.env.HEARTH_FULL_AUTHORIZATION_REF,
    authorizedBy: process.env.HEARTH_FULL_AUTHORIZED_BY,
    githubActions: process.env.GITHUB_ACTIONS,
    githubActor: process.env.GITHUB_ACTOR,
    githubRepository: process.env.GITHUB_REPOSITORY,
    headSha,
    reason: process.env.HEARTH_FULL_REASON,
    requestedSha: process.env.HEARTH_FULL_SHA,
    risk: process.env.HEARTH_FULL_RISK,
  });
  const githubRecord = await verifyGithubAuthorizationRecord({
    authorizationRef: process.env.HEARTH_FULL_AUTHORIZATION_REF,
    githubActions: process.env.GITHUB_ACTIONS,
    githubRepository: process.env.GITHUB_REPOSITORY,
    requestedSha: process.env.HEARTH_FULL_SHA,
    token: process.env.HEARTH_FULL_GITHUB_TOKEN,
  });
  const worktree = validateFullWorktree(
    await capture("git", ["status", "--porcelain=v1", "--untracked-files=all"]),
  );
  console.log(
    `[full-gate] authorization ${JSON.stringify({ ...authorization, ...githubRecord, ...worktree })}`,
  );

  if (mode === "check") await runPnpm("ai:verify");
  await runFullTestLanes();
  if (mode === "check") await runPnpm("build");
  console.log(`[full-gate] complete mode=${mode} sha=${headSha}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`[full-gate] refused-or-failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
