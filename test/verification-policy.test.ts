import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTimeBudgetMonitor,
  domainCanaries,
  evaluateTimeBudget,
  mappedTestsForChanges,
  parseQuickOptions,
  planQuickTests,
  validateFullAuthorization,
  validateFullWorktree,
  verifyGithubAuthorizationRecord,
} from "../scripts/verification-policy.mjs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  scripts?: Record<string, string>;
};
const automaticWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const fullWorkflow = readFileSync(new URL("../.github/workflows/full-verification.yml", import.meta.url), "utf8");
const quickRunner = readFileSync(new URL("../scripts/run-quick-gate.mjs", import.meta.url), "utf8");
const fullRunner = readFileSync(new URL("../scripts/run-full-gate.mjs", import.meta.url), "utf8");
const fullLaneRunner = readFileSync(new URL("../scripts/run-test-lanes.mjs", import.meta.url), "utf8");
const focusMap = JSON.parse(
  readFileSync(new URL("./verification-focus-map.json", import.meta.url), "utf8"),
) as { mappings: Array<{ reason: string; sources: string[]; tests: string[] }> };

afterEach(() => vi.useRealTimers());

describe("five-minute verification policy", () => {
  it("makes the ordinary test and check commands quick while retaining guarded full commands", () => {
    expect(packageJson.scripts?.test).toBe("node scripts/run-quick-gate.mjs");
    expect(packageJson.scripts?.check).toBe("node scripts/run-quick-gate.mjs");
    expect(packageJson.scripts?.["test:full"]).toBe("node scripts/run-full-gate.mjs test");
    expect(packageJson.scripts?.["check:full"]).toBe("node scripts/run-full-gate.mjs check");
    expect(quickRunner).not.toContain("run-test-lanes.mjs");
    expect(quickRunner).not.toContain("test:full:lanes");
    expect(quickRunner).not.toContain('return git("rev-parse", "HEAD")');
    expect(packageJson.scripts?.["test:full:lanes"]).toBeUndefined();
    expect(fullLaneRunner).toContain("has no direct command");
    expect(fullRunner).toContain("runFullTestLanes");
  });

  it("keeps automatic CI on the quick gate and exposes full verification only by manual dispatch", () => {
    expect(automaticWorkflow).toContain("pnpm check");
    expect(automaticWorkflow).not.toMatch(/(?:test|check):full/);
    expect(fullWorkflow).toContain("workflow_dispatch:");
    expect(fullWorkflow).not.toMatch(/^\s{2}(?:push|pull_request):/m);
    expect(fullWorkflow).toContain("pnpm check:full");
    expect(fullWorkflow).toContain("github.actor == 'jonathanbeaulne123-blip'");
    expect(fullWorkflow).toContain("environment: full-verification");
    expect(fullWorkflow).toContain("HEARTH_FULL_AUTHORIZED_BY: ${{ inputs.authorization }}");
    expect(fullWorkflow).toContain("HEARTH_FULL_AUTHORIZATION_REF: ${{ inputs.authorization_reference }}");
    expect(fullWorkflow).toContain("HEARTH_FULL_GITHUB_TOKEN: ${{ github.token }}");
  });

  it("accepts Medium, Medium-High, High, and Release quick-gate labels", () => {
    expect(parseQuickOptions(["--", "--risk=medium"]).risk).toBe("medium");
    expect(parseQuickOptions(["--risk=medium-high"]).risk).toBe("medium-high");
    expect(parseQuickOptions(["--risk=high"]).risk).toBe("high");
    expect(parseQuickOptions(["--risk=release"]).risk).toBe("release");
    expect(parseQuickOptions(["--focus-reason=command contract"]).focusReason).toBe("command contract");
    expect(() => parseQuickOptions(["--risk=low"])).toThrow(/Risk must be one of/);
  });

  it("splits selected ordinary and PGlite tests into bounded parallel and serial phases", () => {
    const plan = planQuickTests({
      changedFiles: ["src/example.ts", "test/example.test.ts", "test/serial-fixture.test.ts"],
      relatedTests: ["test/example.test.ts", "test/serial-fixture.test.ts"],
      serialTests: ["test/serial-fixture.test.ts"],
    });
    expect(plan.errors).toEqual([]);
    expect(plan.fastTests).toEqual(["test/example.test.ts"]);
    expect(plan.serialTests).toEqual(["test/serial-fixture.test.ts"]);
  });

  it("requires focused proof instead of turning a broad transitive graph into the full suite", () => {
    const relatedTests = Array.from({ length: 13 }, (_, index) => `test/related-${index}.test.ts`);
    const missingFocus = planQuickTests({
      changedFiles: ["scripts/tool.mjs"],
      relatedTests,
    });
    expect(missingFocus.errors.join(" ")).toContain("Add or pass at least one focused test");

    const focused = planQuickTests({
      changedFiles: ["scripts/tool.mjs", "test/tool.test.ts"],
      explicitFocus: ["test/tool.test.ts"],
      focusReason: "Direct coordinator contract",
      relatedTests,
    });
    expect(focused.errors).toEqual([]);
    expect(focused.selectedTests).toEqual(["test/tool.test.ts"]);
    expect(focused.relatedTrimmed).toBe(13);
  });

  it("fails closed when executable source has no related, mapped, canary, or focused test", () => {
    const plan = planQuickTests({ changedFiles: ["scripts/unproved-tool.mjs"] });
    expect(plan.errors.join(" ")).toContain("Executable source changed");
  });

  it("does not let an unrelated changed test prove an executable source change", () => {
    const plan = planQuickTests({
      changedFiles: ["src/not-otherwise-covered.ts", "test/unrelated.test.ts"],
    });
    expect(plan.selectedTests).toEqual(["test/unrelated.test.ts"]);
    expect(plan.errors.join(" ")).toContain("Executable source changed");
  });

  it("uses checked-in source-to-test mappings as focused proof", () => {
    const mapped = mappedTestsForChanges(["scripts/run-quick-gate.mjs"], focusMap.mappings);
    const plan = planQuickTests({
      changedFiles: ["scripts/run-quick-gate.mjs"],
      mappedTests: mapped.tests,
    });
    expect(mapped.reasons).toContain("Verification command, coordinator, and CI policy contracts");
    expect(plan.errors).toEqual([]);
    expect(plan.selectedTests).toEqual(
      expect.arrayContaining(["test/verification-policy.test.ts", "test/test-lanes.test.ts"]),
    );
  });

  it("adds money and scoped-data canaries while leaving UI browser proof explicit", () => {
    const canaries = domainCanaries([
      "src/core/commandRuntime.ts",
      "src/continuity.ts",
      "src/Office.tsx",
    ]);
    expect(canaries.tests).toEqual(
      expect.arrayContaining([
        "test/command-runtime.test.ts",
        "test/proof-matrix.test.ts",
        "test/environment-isolation.test.ts",
        "test/hercules-reply-context.test.ts",
      ]),
    );
    expect(canaries.uiProofRequired).toBe(true);
  });

  it("records a soft five-minute SLA breach without claiming the SLA or killing the phase", () => {
    expect(evaluateTimeBudget({ budgetMs: 300_000, elapsedMs: 300_000, phase: "vitest-fast" })).toEqual({
      breached: true,
      classification: "time-budget-breached",
      continueRunning: true,
      elapsedMs: 300_000,
      phase: "vitest-fast",
    });
  });

  it("captures the active phase when the live soft-budget timer fires", async () => {
    vi.useFakeTimers();
    let phase = "typescript";
    const observed: unknown[] = [];
    const monitor = createTimeBudgetMonitor({
      budgetMs: 300_000,
      getPhase: () => phase,
      onBreach: (breach) => observed.push(breach),
    });
    phase = "vitest-fast";
    await vi.advanceTimersByTimeAsync(300_000);
    expect(monitor.getBreach()).toMatchObject({ breached: true, phase: "vitest-fast" });
    expect(observed).toHaveLength(1);
    monitor.stop();
  });

  it("allows full verification only for Jonathan, High/Release risk, and the exact current SHA", () => {
    const sha = "a".repeat(40);
    expect(
      validateFullAuthorization({
        authorizedBy: "Jonathan",
        authorizationRef: "user-request:2026-09-03-five-minute-gate",
        headSha: sha,
        reason: "Requested after the High-risk task",
        requestedSha: sha,
        risk: "high",
      }),
    ).toMatchObject({ authorizedBy: "Jonathan", risk: "high", sha });
    expect(() =>
      validateFullAuthorization({
        authorizedBy: "Jonathan",
        authorizationRef: "user-request:2026-09-03-five-minute-gate",
        headSha: sha,
        reason: "Not a High task",
        requestedSha: sha,
        risk: "medium-high",
      }),
    ).toThrow(/reserved for High or Release-risk/);
    expect(() =>
      validateFullAuthorization({
        authorizedBy: "Jonathan",
        authorizationRef: "user-request:2026-09-03-five-minute-gate",
        headSha: sha,
        reason: "Wrong SHA",
        requestedSha: "b".repeat(40),
        risk: "release",
      }),
    ).toThrow(/does not match HEAD/);
  });

  it("binds GitHub full verification to the owner actor and same-repository authorization record", () => {
    const sha = "a".repeat(40);
    const input = {
      authorizationRef: "https://github.com/jonathanbeaulne123-blip/hearth/issues/42#issuecomment-99",
      authorizedBy: "Jonathan explicitly requested this full gate",
      githubActions: "true",
      githubRepository: "jonathanbeaulne123-blip/hearth",
      headSha: sha,
      reason: "Requested after a High-risk change",
      requestedSha: sha,
      risk: "high",
    };
    expect(() => validateFullAuthorization({ ...input, githubActor: "someone-else" })).toThrow(
      /only be dispatched/,
    );
    expect(validateFullAuthorization({ ...input, githubActor: "jonathanbeaulne123-blip" })).toMatchObject({
      githubActor: "jonathanbeaulne123-blip",
      sha,
    });
  });

  it("verifies the cited GitHub record author, request, and exact SHA before a full run", async () => {
    const sha = "a".repeat(40);
    const request = vi.fn(async () => ({
      json: async () => ({
        body: `Jonathan requests full verification for ${sha}`,
        updated_at: "2026-09-03T00:00:00Z",
        user: { login: "jonathanbeaulne123-blip" },
      }),
      ok: true,
      status: 200,
    }));
    await expect(
      verifyGithubAuthorizationRecord({
        authorizationRef: "https://github.com/jonathanbeaulne123-blip/hearth/issues/42#issuecomment-99",
        githubActions: "true",
        githubRepository: "jonathanbeaulne123-blip/hearth",
        requestedSha: sha,
        token: "synthetic-test-token",
        request,
      }),
    ).resolves.toMatchObject({
      authorizationRecordAuthor: "jonathanbeaulne123-blip",
      authorizationRecordVerified: true,
    });
    expect(request).toHaveBeenCalledWith(
      "https://api.github.com/repos/jonathanbeaulne123-blip/hearth/issues/comments/99",
      expect.any(Object),
    );

    await expect(
      verifyGithubAuthorizationRecord({
        authorizationRef: "https://github.com/jonathanbeaulne123-blip/hearth/issues/42",
        githubActions: "true",
        githubRepository: "jonathanbeaulne123-blip/hearth",
        requestedSha: sha,
        token: "synthetic-test-token",
        request: async () => ({
          json: async () => ({ body: "Run some tests", user: { login: "jonathanbeaulne123-blip" } }),
          ok: true,
        }),
      }),
    ).rejects.toThrow(/must explicitly request full verification and name the exact target SHA/);
  });

  it("refuses full verification when worktree content does not match HEAD", () => {
    expect(validateFullWorktree("")).toEqual({ clean: true });
    expect(() => validateFullWorktree(" M src/App.tsx")).toThrow(/requires a clean worktree/);
    expect(fullRunner.indexOf("validateFullWorktree")).toBeLessThan(fullRunner.indexOf("runFullTestLanes()"));
  });

  it("refuses the raw exhaustive coordinator even when the former sentinel is forged", () => {
    const result = spawnSync(process.execPath, ["scripts/run-test-lanes.mjs"], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: { ...process.env, HEARTH_FULL_GATE_VALIDATED: "a".repeat(40) },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("has no direct command");
  });

  it("fails closed when the quick-gate comparison base cannot resolve", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/run-quick-gate.mjs", "--base=refs/heads/definitely-not-a-hearth-ref"],
      { cwd: new URL("..", import.meta.url), encoding: "utf8", env: process.env },
    );
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("definitely-not-a-hearth-ref");
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("ai-surface started");
  });

  it("refuses the full runner before any exhaustive command when authorization is absent", () => {
    const result = spawnSync(process.execPath, ["scripts/run-full-gate.mjs", "test"], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_ACTIONS: "",
        GITHUB_ACTOR: "",
        GITHUB_REPOSITORY: "",
        HEARTH_FULL_AUTHORIZED_BY: "",
        HEARTH_FULL_AUTHORIZATION_REF: "",
        HEARTH_FULL_REASON: "",
        HEARTH_FULL_RISK: "",
        HEARTH_FULL_SHA: "",
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Full verification requires HEARTH_FULL_AUTHORIZED_BY=Jonathan");
  });
});
