import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  createTimeBudgetMonitor,
  evaluateTimeBudget,
  isExecutableChange,
  isTestFile,
  mappedTestsForChanges,
  normalizeRepoPath,
  parseQuickOptions,
  planQuickTests,
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
      else reject(new Error(`${command} ${args.join(" ")} failed (${code ?? 1}).\n${stderr.trim()}`));
    });
  });
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}.`));
    });
  });
}

async function git(...args) {
  return capture("git", args);
}

async function resolveBase(requestedBase) {
  const candidate = !requestedBase || /^0+$/.test(requestedBase) ? "origin/main" : requestedBase;
  const commit = await git("rev-parse", "--verify", `${candidate}^{commit}`);
  return git("merge-base", "HEAD", commit);
}

async function changedFiles(baseSha) {
  const groups = await Promise.all([
    git("diff", "--name-only", "--diff-filter=ACDMRTUXB", `${baseSha}...HEAD`),
    git("diff", "--name-only", "--diff-filter=ACDMRTUXB"),
    git("diff", "--cached", "--name-only", "--diff-filter=ACDMRTUXB"),
    git("ls-files", "--others", "--exclude-standard"),
  ]);
  return [...new Set(groups.flatMap((group) => group.split(/\r?\n/)).filter(Boolean))].sort();
}

async function changeEvidence(baseSha) {
  const [committed, staged, working, status, untracked] = await Promise.all([
    git("diff", "--binary", `${baseSha}...HEAD`),
    git("diff", "--binary", "--cached"),
    git("diff", "--binary"),
    git("status", "--porcelain=v1", "--untracked-files=all"),
    git("ls-files", "--others", "--exclude-standard"),
  ]);
  const untrackedHashes = [];
  for (const path of untracked.split(/\r?\n/).filter(Boolean).sort()) {
    untrackedHashes.push(`${path}:${await git("hash-object", "--no-filters", "--", path)}`);
  }
  const fingerprint = createHash("sha256")
    .update([committed, staged, working, ...untrackedHashes].join("\n--hearth-change-boundary--\n"))
    .digest("hex");
  return { changeFingerprint: fingerprint, workingTreeClean: status.length === 0 };
}

async function discoverRelatedTests(files, root) {
  const relatedFiles = files
    .filter((path) => isExecutableChange(path) && !isTestFile(path) && existsSync(resolve(root, path)))
    .filter((path) => !["package.json"].includes(path))
    .map((path) => resolve(root, path));
  if (relatedFiles.length === 0) return [];

  const { createVitest } = await import("vitest/node");
  const context = await createVitest("test", {
    passWithNoTests: true,
    related: relatedFiles,
    reporters: [],
    run: true,
    watch: false,
  });
  try {
    const specifications = await context.getRelevantTestSpecifications();
    return specifications.map((specification) => normalizeRepoPath(specification.moduleId, root));
  } finally {
    await context.close();
  }
}

function serialTests(packageJson) {
  const command = packageJson.scripts?.["test:books"] || "";
  return [...command.matchAll(/test\/[\w./-]+\.test\.(?:ts|tsx|js|mjs)/g)].map((match) => match[0]);
}

const rpcIsolatedSerialTests = new Set([
  "test/demo-suite.test.ts",
  "test/demo-shift-statistics.test.ts",
  "test/stress-seed.test.ts",
]);

async function runSerialTests(testPaths) {
  const batched = testPaths.filter((path) => !rpcIsolatedSerialTests.has(path));
  if (batched.length > 0) {
    await runPnpm("exec", "vitest", "run", ...batched, "--maxWorkers=1");
  }
  for (const path of testPaths) {
    if (rpcIsolatedSerialTests.has(path)) {
      await runPnpm("exec", "vitest", "run", path, "--maxWorkers=1");
    }
  }
}

async function runPnpm(...args) {
  if (!pnpmEntrypoint) throw new Error("The quick gate must run through pnpm.");
  return run(process.execPath, [pnpmEntrypoint, ...args]);
}

export async function main(argv = process.argv.slice(2)) {
  const root = process.cwd();
  const options = parseQuickOptions(argv);
  const startedAt = Date.now();
  let currentPhase = "metadata";
  const phases = [];
  const monitor = createTimeBudgetMonitor({
    budgetMs: options.budgetMs,
    getPhase: () => currentPhase,
    onBreach: (breach) =>
      console.warn(
        `[quick-gate] time-budget-breached phase=${breach.phase}; the soft gate will let this phase finish.`,
      ),
  });

  const phase = async (name, operation) => {
    currentPhase = name;
    const phaseStarted = Date.now();
    console.log(`[quick-gate] ${name} started`);
    let status = "failed";
    try {
      await operation();
      status = "passed";
    } finally {
      const elapsedMs = Date.now() - phaseStarted;
      phases.push({ elapsedMs, name, status });
      console.log(`[quick-gate] ${name} ${status} in ${(elapsedMs / 1000).toFixed(1)}s`);
    }
  };

  let baseSha;
  let headSha;
  let changeState;
  const timingEvidence = () => {
    const elapsedMs = Date.now() - startedAt;
    const evaluated = evaluateTimeBudget({ budgetMs: options.budgetMs, elapsedMs, phase: currentPhase });
    const breach = monitor.getBreach() || (evaluated.breached ? evaluated : null);
    const slowest = phases.reduce(
      (candidate, item) => (!candidate || item.elapsedMs > candidate.elapsedMs ? item : candidate),
      null,
    );
    return {
      breachPhase: breach?.phase || null,
      budgetMs: options.budgetMs,
      elapsedMs,
      slowestPhase: slowest?.name || currentPhase,
      timeBudgetBreached: Boolean(breach),
    };
  };
  try {
    baseSha = await resolveBase(options.base);
    headSha = await git("rev-parse", "HEAD");
    const files = await changedFiles(baseSha);
    changeState = await changeEvidence(baseSha);
    console.log(`[quick-gate] risk=${options.risk} base=${baseSha} head=${headSha}`);
    console.log(
      `[quick-gate] changed-files=${files.length} fingerprint=${changeState.changeFingerprint} clean=${changeState.workingTreeClean}`,
    );

    await phase("diff-check", async () => {
      await run("git", ["diff", "--check", `${baseSha}...HEAD`]);
      await run("git", ["diff", "--cached", "--check"]);
      await run("git", ["diff", "--check"]);
    });
    await phase("ai-surface", () => runPnpm("ai:verify"));
    await phase("typescript", () => runPnpm("exec", "tsc", "--noEmit"));

    let related = [];
    await phase("test-discovery", async () => {
      related = await discoverRelatedTests(files, root);
    });

    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const focusMap = JSON.parse(
      readFileSync(resolve(root, "test/verification-focus-map.json"), "utf8"),
    );
    const mapped = mappedTestsForChanges(files, focusMap.mappings);
    const focus = options.focus.map((path) => normalizeRepoPath(path, root));
    for (const path of focus) {
      if (!isTestFile(path) || path.startsWith("../") || !existsSync(resolve(root, path))) {
        throw new Error(`Focused test must be an existing repository test file: ${path}`);
      }
    }
    const plan = planQuickTests({
      changedFiles: files,
      explicitFocus: focus,
      focusReason: options.focusReason,
      mappedTests: mapped.tests,
      relatedTests: related,
      serialTests: serialTests(packageJson),
    });
    if (plan.errors.length > 0) throw new Error(plan.errors.join("\n"));
    for (const path of plan.selectedTests) {
      if (!existsSync(resolve(root, path))) throw new Error(`Selected test does not exist: ${path}`);
    }

    console.log(
      `[quick-gate] selected=${plan.selectedTests.length} fast=${plan.fastTests.length} serial=${plan.serialTests.length} related=${plan.relatedDiscovered} trimmed=${plan.relatedTrimmed}`,
    );
    if (mapped.reasons.length > 0) console.log(`[quick-gate] checked-in-focus=${mapped.reasons.join(" | ")}`);
    if (plan.domains.uiProofRequired) {
      console.log("[quick-gate] UI changed: record the relevant browser, viewport, keyboard, and accessibility proof separately.");
    }
    if (plan.fastTests.length > 0) {
      await phase("vitest-fast", () =>
        runPnpm("exec", "vitest", "run", ...plan.fastTests, "--maxWorkers=4"),
      );
    }
    if (plan.serialTests.length > 0) {
      await phase("vitest-serial", () => runSerialTests(plan.serialTests));
    }

    const timing = timingEvidence();
    const summary = {
      baseSha,
      ...changeState,
      ...timing,
      classification: timing.timeBudgetBreached ? "quick-gate-passed; time-budget-breached" : "quick-gate-passed",
      focusReason: plan.focusReason || null,
      headSha,
      phases,
      risk: options.risk,
      selectedTests: plan.selectedTests,
      uiProofRequired: plan.domains.uiProofRequired,
    };
    console.log(`[quick-gate] evidence ${JSON.stringify(summary)}`);
    return summary;
  } catch (error) {
    const timing = timingEvidence();
    console.error(
      `[quick-gate] evidence ${JSON.stringify({
        baseSha: baseSha || null,
        ...(changeState || {}),
        ...timing,
        classification: timing.timeBudgetBreached
          ? "quick-gate-failed; time-budget-breached"
          : "quick-gate-failed",
        headSha: headSha || null,
        phases,
        risk: options.risk,
      })}`,
    );
    throw error;
  } finally {
    monitor.stop();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`[quick-gate] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
