import { isAbsolute, relative, resolve } from "node:path";

export const QUICK_GATE_BUDGET_MS = 5 * 60 * 1000;
export const MAX_RELATED_TESTS = 12;
export const QUICK_RISKS = ["medium", "medium-high", "high", "release"];
export const FULL_RISKS = ["high", "release"];
export const GITHUB_OWNER = "jonathanbeaulne123-blip";
export const WORKFLOW_AUTHORIZATION = "Jonathan explicitly requested this full gate";

const TEST_FILE = /^test\/.+\.test\.(?:ts|tsx|js|mjs)$/;
const EXECUTABLE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|ps1)$/;

export function normalizeRepoPath(path, root = process.cwd()) {
  const absolute = isAbsolute(path) ? path : resolve(root, path);
  return relative(root, absolute).replaceAll("\\", "/");
}

export function isTestFile(path) {
  return TEST_FILE.test(path.replaceAll("\\", "/"));
}

export function isExecutableChange(path) {
  const normalized = path.replaceAll("\\", "/");
  return (
    EXECUTABLE_FILE.test(normalized) ||
    normalized === "package.json" ||
    normalized === "vite.config.ts" ||
    normalized.startsWith(".github/workflows/")
  );
}

export function parseQuickOptions(argv, environment = process.env) {
  /** @type {{ base: string, budgetMs: number, focus: string[], focusReason: string, risk: string }} */
  const options = {
    base: environment.HEARTH_TEST_BASE || "origin/main",
    budgetMs: Number(environment.HEARTH_TEST_BUDGET_MS || QUICK_GATE_BUDGET_MS),
    focus: [],
    focusReason: environment.HEARTH_TEST_FOCUS_REASON || "",
    risk: environment.HEARTH_TEST_RISK || "medium",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (
      argument === "--base" ||
      argument === "--focus" ||
      argument === "--focus-reason" ||
      argument === "--risk"
    ) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--base") options.base = value;
      if (argument === "--focus") options.focus.push(value);
      if (argument === "--focus-reason") options.focusReason = value;
      if (argument === "--risk") options.risk = value;
      continue;
    }
    if (argument.startsWith("--base=")) options.base = argument.slice("--base=".length);
    else if (argument.startsWith("--focus=")) options.focus.push(argument.slice("--focus=".length));
    else if (argument.startsWith("--focus-reason=")) {
      options.focusReason = argument.slice("--focus-reason=".length);
    }
    else if (argument.startsWith("--risk=")) options.risk = argument.slice("--risk=".length);
    else if (argument.startsWith("--")) throw new Error(`Unknown quick-gate option: ${argument}`);
    else options.focus.push(argument);
  }

  options.risk = options.risk.toLowerCase();
  if (!QUICK_RISKS.includes(options.risk)) {
    throw new Error(`Risk must be one of: ${QUICK_RISKS.join(", ")}.`);
  }
  if (!Number.isFinite(options.budgetMs) || options.budgetMs <= 0) {
    throw new Error("HEARTH_TEST_BUDGET_MS must be a positive number.");
  }
  return options;
}

export function mappedTestsForChanges(changedFiles, mappings) {
  const changed = new Set(changedFiles.map((path) => path.replaceAll("\\", "/")));
  const tests = [];
  const reasons = [];
  for (const mapping of mappings || []) {
    if (!(mapping.sources || []).some((path) => changed.has(path))) continue;
    tests.push(...(mapping.tests || []));
    if (mapping.reason) reasons.push(mapping.reason);
  }
  return { reasons: [...new Set(reasons)].sort(), tests: [...new Set(tests)].sort() };
}

export function domainCanaries(changedFiles) {
  const normalized = changedFiles.map((path) => path.replaceAll("\\", "/"));
  const money = normalized.some((path) =>
    /^(src\/(?:App|commandSurface|storage|sync)\.(?:ts|tsx)|src\/(?:core|ledger)\/|test\/.*(?:books|command|fund|ledger|money|posting|reversal))/.test(
      path,
    ),
  );
  const scopedData = normalized.some((path) =>
    /^(src\/.*(?:auth|continuity|privacy|storage|supabase|sync)|workers\/|test\/.*(?:auth|continuity|privacy|scope|sync))/.test(
      path,
    ),
  );
  const ui = normalized.some((path) => /^src\/.*\.(?:tsx|css)$/.test(path));
  const tests = [];

  if (money) {
    tests.push(
      "test/command-contract.test.ts",
      "test/command-runtime.test.ts",
      "test/proof-matrix.test.ts",
    );
  }
  if (scopedData) {
    tests.push(
      "test/continuity-policy.test.ts",
      "test/environment-isolation.test.ts",
      "test/hercules-reply-context.test.ts",
    );
  }
  return { money, scopedData, tests: [...new Set(tests)].sort(), uiProofRequired: ui };
}

/**
 * @param {{
 *   changedFiles: string[],
 *   explicitFocus?: string[],
 *   focusReason?: string,
 *   mappedTests?: string[],
 *   relatedTests?: string[],
 *   serialTests?: string[],
 *   maxRelatedTests?: number,
 * }} input
 */
export function planQuickTests({
  changedFiles,
  explicitFocus = [],
  focusReason = "",
  mappedTests = [],
  relatedTests = [],
  serialTests = [],
  maxRelatedTests = MAX_RELATED_TESTS,
}) {
  const normalizedChanged = changedFiles.map((path) => path.replaceAll("\\", "/"));
  const changedTests = normalizedChanged.filter(isTestFile);
  const explicit = [...new Set(explicitFocus.map((path) => path.replaceAll("\\", "/")))];
  const mapped = [...new Set(mappedTests.map((path) => path.replaceAll("\\", "/")))];
  const focus = [...new Set([...explicit, ...mapped, ...changedTests])];
  const related = [...new Set(relatedTests.map((path) => path.replaceAll("\\", "/")))].sort();
  const domains = domainCanaries(normalizedChanged);
  const executableProductChange = normalizedChanged.some(
    (path) => isExecutableChange(path) && !isTestFile(path),
  );
  const broadRelatedSet = related.length > maxRelatedTests;
  const errors = [];

  const applicableProof = [...new Set([...explicit, ...mapped, ...domains.tests, ...related])];
  if (broadRelatedSet && explicit.length === 0 && mapped.length === 0 && domains.tests.length === 0 && executableProductChange) {
    errors.push(
      `Vitest found ${related.length} transitive tests. Add or pass at least one focused test instead of expanding the quick gate into the full suite.`,
    );
  }

  if (explicit.length > 0 && !String(focusReason).trim() && mapped.length === 0 && related.length === 0 && domains.tests.length === 0) {
    errors.push("Explicit focused proof requires --focus-reason when no checked-in mapping, related test, or domain canary applies.");
  }

  const boundedRelated = broadRelatedSet ? related.filter((path) => focus.includes(path)) : related;
  const selected = [...new Set([...focus, ...domains.tests, ...boundedRelated])].sort();
  if (executableProductChange && applicableProof.length === 0) {
    errors.push("Executable source changed, but no related, mapped, canary, or explicitly focused test was selected.");
  }

  const serial = new Set(serialTests.map((path) => path.replaceAll("\\", "/")));
  return {
    broadRelatedSet,
    domains,
    errors,
    fastTests: selected.filter((path) => !serial.has(path)),
    focusReason: String(focusReason).trim(),
    relatedDiscovered: related.length,
    relatedTrimmed: broadRelatedSet ? related.length - boundedRelated.length : 0,
    serialTests: selected.filter((path) => serial.has(path)),
    selectedTests: selected,
  };
}

export function evaluateTimeBudget({ budgetMs = QUICK_GATE_BUDGET_MS, elapsedMs, phase }) {
  const breached = elapsedMs >= budgetMs;
  return {
    breached,
    classification: breached ? "time-budget-breached" : "within-five-minute-sla",
    continueRunning: true,
    elapsedMs,
    phase,
  };
}

/**
 * @param {{
 *   budgetMs: number,
 *   getPhase: () => string,
 *   onBreach?: (breach: ReturnType<typeof evaluateTimeBudget>) => void,
 * }} input
 */
export function createTimeBudgetMonitor({ budgetMs, getPhase, onBreach = () => {} }) {
  let breach = null;
  const timer = setTimeout(() => {
    breach = evaluateTimeBudget({ budgetMs, elapsedMs: budgetMs, phase: getPhase() });
    onBreach(breach);
  }, budgetMs);
  timer.unref?.();
  return {
    getBreach: () => breach,
    stop: () => clearTimeout(timer),
  };
}

/**
 * @param {{
 *   authorizationRef?: string,
 *   authorizedBy?: string,
 *   githubActions?: string,
 *   githubActor?: string,
 *   githubRepository?: string,
 *   headSha?: string,
 *   reason?: string,
 *   requestedSha?: string,
 *   risk?: string,
 * }} input
 */
export function validateFullAuthorization({
  authorizationRef,
  authorizedBy,
  githubActions,
  githubActor,
  githubRepository,
  headSha,
  reason,
  requestedSha,
  risk,
}) {
  const normalizedRisk = String(risk || "").toLowerCase();
  const normalizedActor = String(authorizedBy || "").trim().toLowerCase();
  const normalizedReason = String(reason || "").replaceAll(/[\r\n]+/g, " ").trim();
  const normalizedRequestedSha = String(requestedSha || "").trim().toLowerCase();
  const normalizedHeadSha = String(headSha || "").trim().toLowerCase();
  const normalizedRef = String(authorizationRef || "").trim();
  const isActions = String(githubActions || "").toLowerCase() === "true";

  if (isActions) {
    if (String(githubActor || "").toLowerCase() !== GITHUB_OWNER) {
      throw new Error(`GitHub full verification may only be dispatched by ${GITHUB_OWNER}.`);
    }
    if (normalizedActor !== WORKFLOW_AUTHORIZATION.toLowerCase()) {
      throw new Error("GitHub full verification requires the exact owner-authorization input.");
    }
    const repository = String(githubRepository || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const referencePattern = new RegExp(
      `^https://github\\.com/${repository}/(?:issues|pull)/\\d+(?:#issuecomment-\\d+)?$`,
      "i",
    );
    if (!repository || !referencePattern.test(normalizedRef)) {
      throw new Error("GitHub full verification requires an authorization issue or PR reference in this repository.");
    }
  } else if (normalizedActor !== "jonathan") {
    throw new Error("Full verification requires HEARTH_FULL_AUTHORIZED_BY=Jonathan from an explicit request.");
  }
  if (!normalizedRef) throw new Error("Full verification requires HEARTH_FULL_AUTHORIZATION_REF.");
  if (!FULL_RISKS.includes(normalizedRisk)) {
    throw new Error("Full verification is reserved for High or Release-risk work.");
  }
  if (!normalizedReason) throw new Error("Full verification requires HEARTH_FULL_REASON.");
  if (!/^[a-f0-9]{40}$/.test(normalizedRequestedSha)) {
    throw new Error("Full verification requires an exact 40-character HEARTH_FULL_SHA.");
  }
  if (normalizedRequestedSha !== normalizedHeadSha) {
    throw new Error(`Requested full-verification SHA ${normalizedRequestedSha} does not match HEAD ${normalizedHeadSha}.`);
  }
  return {
    authorizedBy: "Jonathan",
    authorizationRef: normalizedRef.slice(0, 512),
    githubActor: isActions ? String(githubActor) : undefined,
    reason: normalizedReason.slice(0, 240),
    risk: normalizedRisk,
    sha: normalizedHeadSha,
  };
}

export function validateFullWorktree(status) {
  if (String(status || "").trim()) {
    throw new Error("Full verification requires a clean worktree so evidence matches the exact HEAD SHA.");
  }
  return { clean: true };
}

/**
 * @param {{
 *   authorizationRef?: string,
 *   githubActions?: string,
 *   githubRepository?: string,
 *   requestedSha?: string,
 *   token?: string,
 *   request?: Function,
 * }} input
 */
export async function verifyGithubAuthorizationRecord({
  authorizationRef,
  githubActions,
  githubRepository,
  requestedSha,
  token,
  request = fetch,
}) {
  if (String(githubActions || "").toLowerCase() !== "true") {
    return { authorizationRecordSource: "local-recorded-reference", authorizationRecordVerified: false };
  }
  if (!token) throw new Error("GitHub full verification requires the workflow token to verify its authorization record.");

  const repository = String(githubRepository || "");
  const reference = new URL(String(authorizationRef || ""));
  const parts = reference.pathname.split("/").filter(Boolean);
  const recordKind = parts[2];
  const recordNumber = parts[3];
  const comment = reference.hash.match(/^#issuecomment-(\d+)$/);
  const apiPath = comment
    ? `issues/comments/${comment[1]}`
    : recordKind === "pull"
      ? `pulls/${recordNumber}`
      : `issues/${recordNumber}`;
  const response = await request(`https://api.github.com/repos/${repository}/${apiPath}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response?.ok) {
    throw new Error(`Could not verify the GitHub authorization record (HTTP ${response?.status || "unknown"}).`);
  }
  const record = await response.json();
  const author = String(record?.user?.login || "").toLowerCase();
  const body = String(record?.body || "");
  const sha = String(requestedSha || "").toLowerCase();
  if (author !== GITHUB_OWNER) {
    throw new Error(`The full-verification authorization record must be authored by ${GITHUB_OWNER}.`);
  }
  if (!body.toLowerCase().includes("full verification") || !body.toLowerCase().includes(sha)) {
    throw new Error("The authorization record must explicitly request full verification and name the exact target SHA.");
  }
  return {
    authorizationRecordAuthor: author,
    authorizationRecordSource: String(authorizationRef),
    authorizationRecordUpdatedAt: String(record?.updated_at || "unknown"),
    authorizationRecordVerified: true,
  };
}
