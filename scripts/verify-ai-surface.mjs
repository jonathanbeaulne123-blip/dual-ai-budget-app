import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function requirePath(path) {
  if (!existsSync(join(root, path))) {
    fail(`missing required AI surface: ${path}`);
  }
}

function read(path) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch (error) {
    fail(`could not read ${path}: ${error.message}`);
    return "";
  }
}

function readJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail(`invalid JSON in ${path}: ${error.message}`);
    return {};
  }
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sourceFilesBelow(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFilesBelow(path));
    else files.push(path);
  }
  return files;
}

const clerkAdvice = /\b(?:should|need to|recommend|suggest)\b/i;
const clerkWorkInstruction = /\b(?:shift|hours|work more)\b/i;
const clerkMoneyWriter = /(?:from\s+["'][^"']*(?:commands|commandRuntime|core\/index|ledger\/engine|storage|supabase)[^"']*["']|\b(?:postEntry|postTransfer|postWorkShift|confirmHouseholdFundContribution|acceptHouseholdWrite|reversePostedMoney|commit|runKitchen)\s*\()/i;
const clerkOwned = sourceFilesBelow(join(root, "src"))
  .filter((path) => /^clerk.*\.(?:ts|tsx)$/i.test(path.split(/[\\/]/).at(-1) ?? ""))
  .map((path) => relative(root, path).replaceAll("\\", "/"))
  .sort();

assert(clerkOwned.length >= 2, "Clerk fence must cover the reader module and citation component");
for (const path of clerkOwned) {
  const source = read(path);
  assert(!clerkAdvice.test(source), `${path} contains Clerk proposal or recommendation language`);
  assert(!clerkWorkInstruction.test(source), `${path} contains a Clerk work instruction`);
  assert(!clerkMoneyWriter.test(source), `${path} reaches a money-writing code path`);
}

const required = [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/AI_OPERATING_MODEL.md",
  "docs/AI_HANDOFF.md",
  "docs/AI_SETUP_FOR_JONATHAN.md",
  "docs/worksessions/TEMPLATE.md",
  ".mcp.json",
  ".codex/config.toml",
  ".codex/hooks.json",
  ".codex/hooks/hearth-policy.mjs",
  ".codex/agents/canon-auditor.toml",
  ".codex/agents/implementation-auditor.toml",
  ".codex/agents/money-risk-reviewer.toml",
  ".agents/skills/hearth-worksession/SKILL.md",
  ".agents/skills/hearth-implementation-packet/SKILL.md",
  ".agents/skills/hearth-implement/SKILL.md",
  ".agents/skills/hearth-verify/SKILL.md",
  ".agents/skills/hearth-release-review/SKILL.md",
  ".cursor/environment.json",
  ".cursor/mcp.json",
  ".cursor/permissions.json",
  ".cursor/sandbox.json",
  ".cursor/hooks.json",
  ".cursor/hooks/hearth-guard.mjs",
  ".cursor/BUGBOT.md",
  ".cursor/rules/00-operating-model.mdc",
  ".cursor/agents/books-auditor.md",
  ".cursor/agents/privacy-auditor.md",
  ".cursor/agents/verifier.md",
  ".cursorignore",
  ".cursorindexingignore",
  ".claude/settings.json",
  ".claude/rules/money-trust-boundary.md",
  ".claude/rules/office-ux.md",
  ".claude/rules/hercules.md",
  ".claude/skills/hearth-design-review/SKILL.md",
  ".claude/skills/hearth-hercules-review/SKILL.md",
  ".claude/skills/hearth-visual-verify/SKILL.md",
  ".claude/agents/hearth-ux-auditor.md",
  ".claude/agents/hearth-trust-auditor.md",
  ".claude/output-styles/hearth-design-lead.md",
];

required.forEach(requirePath);

const jsonFiles = [
  ".mcp.json",
  ".codex/hooks.json",
  ".cursor/environment.json",
  ".cursor/mcp.json",
  ".cursor/permissions.json",
  ".cursor/sandbox.json",
  ".cursor/hooks.json",
  ".claude/settings.json",
  "package.json",
];
const json = Object.fromEntries(jsonFiles.map((path) => [path, readJson(path)]));

function verifyDocsOnlyMcp(path, server) {
  const config = json[path];
  const entry = config?.mcpServers?.[server];
  assert(Boolean(entry), `${path} must define only ${server}`);

  const names = Object.keys(config?.mcpServers ?? {});
  assert(names.length === 1 && names[0] === server, `${path} must expose only ${server}`);

  try {
    const url = new URL(entry?.url ?? "");
    const features = (url.searchParams.get("features") ?? "").split(",");
    assert(url.hostname === "mcp.supabase.com", `${path} must use Supabase's MCP host`);
    assert(url.searchParams.get("read_only") === "true", `${path} must set read_only=true`);
    assert(!url.searchParams.has("project_ref"), `${path} must not point at a household project`);
    assert(features.length === 1 && features[0] === "docs", `${path} must expose only the docs feature group`);
  } catch {
    fail(`${path} contains an invalid MCP URL`);
  }
}

verifyDocsOnlyMcp(".mcp.json", "supabase-docs");
verifyDocsOnlyMcp(".cursor/mcp.json", "supabase-docs");

const codex = read(".codex/config.toml");
assert(codex.includes("read_only=true&features=docs"), ".codex/config.toml must use docs-only read-only Supabase MCP");
assert(!codex.includes("project_ref="), ".codex/config.toml must not point at a household project");
assert(/enabled_tools\s*=\s*\["search_docs"\]/.test(codex), "Codex MCP must allow only search_docs");
assert(/default_tools_approval_mode\s*=\s*"prompt"/.test(codex), "Codex MCP must keep manual approval");
assert(/max_concurrent_threads_per_session\s*=\s*3/.test(codex), "Codex concurrency must stay bounded at three subagent threads");

const environment = json[".cursor/environment.json"];
assert(environment.install === "pnpm install --frozen-lockfile", "Cursor install must use the frozen lockfile");

const cursorHooks = json[".cursor/hooks.json"]?.hooks ?? {};
for (const event of ["beforeShellExecution", "beforeMCPExecution"]) {
  const hook = cursorHooks[event]?.[0];
  assert(Boolean(hook?.failClosed), `Cursor ${event} hook must fail closed`);
  assert(hook?.command === "node .cursor/hooks/hearth-guard.mjs", `Cursor ${event} must run the Hearth guard`);
}

function runHook(path, input) {
  try {
    return execFileSync(process.execPath, [join(root, path)], {
      cwd: root,
      encoding: "utf8",
      input: JSON.stringify(input),
    }).trim();
  } catch (error) {
    fail(`${path} failed its synthetic policy check: ${error.message}`);
    return "";
  }
}

const codexForcePush = JSON.parse(
  runHook(".codex/hooks/hearth-policy.mjs", {
    tool_name: "Bash",
    tool_input: { command: "git push --force origin main" },
  }) || "{}",
);
assert(
  codexForcePush?.hookSpecificOutput?.permissionDecision === "deny",
  "Codex hook must deny force-pushes",
);

const codexSecretEdit = JSON.parse(
  runHook(".codex/hooks/hearth-policy.mjs", {
    tool_name: "apply_patch",
    tool_input: { command: "*** Add File: .env.local" },
  }) || "{}",
);
assert(
  codexSecretEdit?.hookSpecificOutput?.permissionDecision === "deny",
  "Codex hook must deny private environment-file edits",
);
assert(
  runHook(".codex/hooks/hearth-policy.mjs", {
    tool_name: "apply_patch",
    tool_input: { command: "*** Add File: .env.example" },
  }) === "",
  "Codex hook must allow environment templates",
);

const cursorPush = JSON.parse(
  runHook(".cursor/hooks/hearth-guard.mjs", { command: "git push origin branch" }) || "{}",
);
assert(cursorPush.permission === "ask", "Cursor hook must ask before a push");

const cursorHostedWrite = JSON.parse(
  runHook(".cursor/hooks/hearth-guard.mjs", {
    server: "supabase",
    tool_name: "execute_sql",
  }) || "{}",
);
assert(cursorHostedWrite.permission === "ask", "Cursor hook must ask before a hosted mutation");

const claude = read("CLAUDE.md");
assert(claude.trimStart().startsWith("@AGENTS.md"), "CLAUDE.md must import AGENTS.md first");
assert(claude.split("\n").length <= 200, "CLAUDE.md must remain concise (200 lines or fewer)");
assert(json[".claude/settings.json"]?.autoMemoryEnabled === false, "Claude project auto-memory must remain off because GitHub is canon");

const cursorRule = read(".cursor/rules/00-operating-model.mdc");
assert(/alwaysApply:\s*true/.test(cursorRule), "Cursor operating model must always apply");

const packageJson = json["package.json"];
assert(packageJson?.scripts?.["ai:verify"] === "node scripts/verify-ai-surface.mjs", "package.json must expose ai:verify");
assert(packageJson?.scripts?.check === "pnpm ai:verify && pnpm test && pnpm build", "package.json must expose the complete proof gate");

const ci = read(".github/workflows/ci.yml");
for (const command of ["pnpm install --frozen-lockfile", "pnpm check"]) {
  assert(ci.includes(command), `CI is missing ${command}`);
}

const secretName = /(?:^|\/)(?:\.env(?:\.(?!example$|sample$|template$)[^/]*)?|\.dev\.vars|credentials?[^/]*\.json|secrets?[^/]*\.json|[^/]+\.(?:pem|key))$/i;
try {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  for (const path of tracked) {
    if (secretName.test(path)) fail(`secret-bearing filename is tracked: ${path}`);
  }
} catch (error) {
  fail(`could not inspect tracked filenames: ${error.message}`);
}

for (const path of [".mcp.json", ".codex/config.toml", ".cursor/mcp.json"]) {
  assert(!read(path).includes("tykhocwacaxwquhynkok"), `${path} contains the household Supabase project reference`);
}

if (failures.length) {
  console.error("AI surface verification failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`AI surface verified: ${required.length} required files, ${clerkOwned.length} Clerk fences, docs-only MCP, bounded roles, guards, and proof gate.`);
