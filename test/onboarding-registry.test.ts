import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_REGISTRY,
  ONBOARDING_REGISTRY_VERSION,
  chapterById,
  householdChapters,
  personalModules,
  validateRegistry,
  type HearthTab,
  type OnboardingChapter,
  type RegistryProblemCode,
} from "../src/core/index.ts";

function row(overrides: Partial<OnboardingChapter> = {}): OnboardingChapter {
  return {
    id: "fixture-1",
    registryVersion: 1,
    track: "household",
    order: 1,
    sitting: 1,
    copyKey: "fixture.copy",
    flavorKeys: ["fixture.1", "fixture.2", "fixture.3"],
    target: null,
    conductor: "both",
    approval: "none",
    skip: "household-required",
    timeBudgetSeconds: 300,
    pausePoints: [],
    actions: ["continue"],
    dependsOn: [],
    contributesToFinalGate: true,
    ...overrides,
  };
}

function codes(rows: readonly OnboardingChapter[]): RegistryProblemCode[] {
  return validateRegistry(rows).map((entry) => entry.code);
}

describe("onboarding registry", () => {
  it("ships a valid versioned registry", () => {
    expect(validateRegistry(ONBOARDING_REGISTRY)).toEqual([]);
    expect(ONBOARDING_REGISTRY_VERSION).toBe(1);
    expect(ONBOARDING_REGISTRY.every((chapter) => chapter.registryVersion === ONBOARDING_REGISTRY_VERSION)).toBe(true);
  });

  it("returns exactly twelve household chapters in canonical order", () => {
    const chapters = householdChapters();
    expect(chapters).toHaveLength(12);
    expect(chapters.map((chapter) => chapter.id)).toEqual([
      "ch-01-meet",
      "ch-02-household",
      "ch-03-charter",
      "ch-04-accounts",
      "ch-05-opening",
      "ch-06-fund",
      "ch-07-recurrences",
      "ch-08-cadence",
      "ch-09-categories",
      "ch-10-estimates",
      "ch-11-plan",
      "ch-12-ready",
    ]);
    expect(chapters.map((chapter) => chapter.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(chapters.map(({ id, sitting, conductor, approval, skip, target }) => ({
      id, sitting, conductor, approval, skip, target: target?.tab ?? null,
    }))).toEqual([
      { id: "ch-01-meet", sitting: 1, conductor: "both", approval: "joint", skip: "household-required", target: null },
      { id: "ch-02-household", sitting: 1, conductor: "both", approval: "none", skip: "auto-completable", target: "more" },
      { id: "ch-03-charter", sitting: 1, conductor: "either", approval: "joint", skip: "household-required", target: "more" },
      { id: "ch-04-accounts", sitting: 2, conductor: "partner", approval: "none", skip: "household-required", target: "ledger" },
      { id: "ch-05-opening", sitting: 2, conductor: "partner", approval: "none", skip: "household-required", target: "ledger" },
      { id: "ch-06-fund", sitting: 2, conductor: "partner", approval: "joint", skip: "household-required", target: "ledger" },
      { id: "ch-07-recurrences", sitting: 2, conductor: "partner", approval: "none", skip: "household-required", target: "calendar" },
      { id: "ch-08-cadence", sitting: 2, conductor: "self", approval: "member", skip: "member-required", target: "shift" },
      { id: "ch-09-categories", sitting: 3, conductor: "both", approval: "member", skip: "household-required", target: "plan" },
      { id: "ch-10-estimates", sitting: 3, conductor: "both", approval: "member", skip: "household-required", target: "plan" },
      { id: "ch-11-plan", sitting: 3, conductor: "both", approval: "joint", skip: "household-required", target: "plan" },
      { id: "ch-12-ready", sitting: 3, conductor: "both", approval: "joint", skip: "household-required", target: "ledger" },
    ]);
    expect(personalModules()).toEqual([]);
    expect(chapterById("ch-03-charter")?.target).toEqual({ tab: "more" });
    expect(chapterById("ch-03-charter")?.timeBudgetSeconds).toBe(480);
    expect(chapterById("ch-03-charter")?.pausePoints).toEqual(["after-question-two"]);
    expect(chapterById("ch-04-accounts")?.timeBudgetSeconds).toBe(360);
    expect(chapterById("ch-04-accounts")?.pausePoints).toEqual(["after-shared-accounts"]);
    expect(chapterById("ch-05-opening")?.timeBudgetSeconds).toBe(360);
    expect(chapterById("ch-05-opening")?.pausePoints).toEqual(["between-accounts"]);
    expect(chapterById("ch-11-plan")?.pausePoints).toEqual(["before-approval"]);
    expect(chapterById("missing")).toBeNull();
  });

  it.each<[RegistryProblemCode, OnboardingChapter[]]>([
    ["duplicate-id", [row(), row({ order: 2 })]],
    ["duplicate-order", [row(), row({ id: "fixture-2" })]],
    ["order-gap", [row(), row({ id: "fixture-3", order: 3 })]],
    ["target-without-navigate", [row({ target: { tab: "plan" } })]],
    ["navigate-without-target", [row({ actions: ["navigate"] })]],
    ["unknown-tab", [row({ target: { tab: "unknown" as HearthTab }, actions: ["navigate"] })]],
    ["joint-and-skippable", [row({ approval: "joint", skip: "member-skippable" })]],
    ["personal-contributes-to-gate", [row({ track: "personal", sitting: null, skip: "member-required" })]],
    ["household-policy-on-personal", [row({ track: "personal", sitting: null, contributesToFinalGate: false })]],
    ["budget-without-pause", [row({ timeBudgetSeconds: 301 })]],
    ["flavor-count", [row({ flavorKeys: ["one", "two"] })]],
    ["dependency-cycle", [
      row({ id: "fixture-1", dependsOn: ["fixture-2"] }),
      row({ id: "fixture-2", order: 2, dependsOn: ["fixture-1"] }),
    ]],
    ["forward-dependency", [
      row({ id: "fixture-1", dependsOn: ["fixture-2"] }),
      row({ id: "fixture-2", order: 2 }),
    ]],
  ])("reports %s for its malformed fixture", (expected, fixture) => {
    expect(codes(fixture)).toContain(expected);
  });

  it("stays pure metadata with no command or TSX dependency", () => {
    const source = readFileSync(new URL("../src/core/onboarding/registry.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/import[^;]+from\s+["']\.\.\/commands\.ts["']/);
    expect(source).not.toContain(".tsx");
  });
});
