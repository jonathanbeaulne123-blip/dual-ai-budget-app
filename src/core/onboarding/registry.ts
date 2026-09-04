import type {
  ChapterId,
  OnboardingChapter,
  OnboardingTrack,
  RegistryProblem,
} from "./types.ts";

export const ONBOARDING_REGISTRY_VERSION = 1;

const householdChapter = (
  row: Omit<OnboardingChapter, "registryVersion" | "track" | "copyKey" | "flavorKeys" | "contributesToFinalGate">,
): OnboardingChapter => ({
  ...row,
  registryVersion: ONBOARDING_REGISTRY_VERSION,
  track: "household",
  copyKey: `onboarding.household.${row.id}`,
  flavorKeys: [1, 2, 3].map((index) => `onboarding.household.${row.id}.flavor-${index}`),
  contributesToFinalGate: true,
});

export const ONBOARDING_REGISTRY: readonly OnboardingChapter[] = [
  householdChapter({
    id: "ch-01-meet", order: 1, sitting: 1, target: null, conductor: "both", approval: "joint",
    skip: "household-required", timeBudgetSeconds: 180, pausePoints: [], actions: ["continue", "approve"], dependsOn: [],
  }),
  householdChapter({
    id: "ch-02-household", order: 2, sitting: 1, target: { tab: "more" }, conductor: "both", approval: "none",
    skip: "auto-completable", timeBudgetSeconds: 120, pausePoints: [], actions: ["navigate", "continue"], dependsOn: ["ch-01-meet"],
  }),
  householdChapter({
    id: "ch-03-charter", order: 3, sitting: 1, target: { tab: "more" }, conductor: "either", approval: "joint",
    skip: "household-required", timeBudgetSeconds: 480, pausePoints: ["after-question-two"], actions: ["navigate", "edit", "approve", "continue"], dependsOn: ["ch-02-household"],
  }),
  householdChapter({
    id: "ch-04-accounts", order: 4, sitting: 2, target: { tab: "more" }, conductor: "partner", approval: "none",
    skip: "household-required", timeBudgetSeconds: 300, pausePoints: [], actions: ["navigate", "continue"], dependsOn: ["ch-03-charter"],
  }),
  householdChapter({
    id: "ch-05-opening", order: 5, sitting: 2, target: { tab: "ledger" }, conductor: "partner", approval: "none",
    skip: "household-required", timeBudgetSeconds: 300, pausePoints: [], actions: ["navigate", "submit", "continue"], dependsOn: ["ch-04-accounts"],
  }),
  householdChapter({
    id: "ch-06-fund", order: 6, sitting: 2, target: { tab: "plan" }, conductor: "partner", approval: "joint",
    skip: "household-required", timeBudgetSeconds: 300, pausePoints: [], actions: ["navigate", "submit", "approve", "continue"], dependsOn: ["ch-05-opening"],
  }),
  householdChapter({
    id: "ch-07-recurrences", order: 7, sitting: 2, target: { tab: "calendar" }, conductor: "partner", approval: "none",
    skip: "household-required", timeBudgetSeconds: 300, pausePoints: [], actions: ["navigate", "submit", "continue"], dependsOn: ["ch-06-fund"],
  }),
  householdChapter({
    id: "ch-08-cadence", order: 8, sitting: 2, target: { tab: "shift" }, conductor: "self", approval: "member",
    skip: "member-required", timeBudgetSeconds: 240, pausePoints: [], actions: ["navigate", "submit", "approve", "continue"], dependsOn: ["ch-07-recurrences"],
  }),
  householdChapter({
    id: "ch-09-categories", order: 9, sitting: 3, target: { tab: "plan" }, conductor: "both", approval: "member",
    skip: "household-required", timeBudgetSeconds: 300, pausePoints: [], actions: ["navigate", "edit", "submit", "approve", "continue"], dependsOn: ["ch-08-cadence"],
  }),
  householdChapter({
    id: "ch-10-estimates", order: 10, sitting: 3, target: { tab: "plan" }, conductor: "both", approval: "member",
    skip: "household-required", timeBudgetSeconds: 300, pausePoints: [], actions: ["navigate", "edit", "submit", "approve", "continue"], dependsOn: ["ch-09-categories"],
  }),
  householdChapter({
    id: "ch-11-plan", order: 11, sitting: 3, target: { tab: "plan" }, conductor: "both", approval: "joint",
    skip: "household-required", timeBudgetSeconds: 300, pausePoints: [], actions: ["navigate", "edit", "submit", "approve", "continue"], dependsOn: ["ch-10-estimates"],
  }),
  householdChapter({
    id: "ch-12-ready", order: 12, sitting: 3, target: { tab: "ledger" }, conductor: "both", approval: "joint",
    skip: "household-required", timeBudgetSeconds: 180, pausePoints: [], actions: ["navigate", "approve", "continue"], dependsOn: ["ch-11-plan"],
  }),
];

const HEARTH_TABS = new Set(["home", "plan", "calendar", "shift", "ledger", "more", "add"]);

function problem(code: RegistryProblem["code"], chapterId: ChapterId, detail: string): RegistryProblem {
  return { code, chapterId, detail };
}

function dependencyCycle(rows: readonly OnboardingChapter[]): ChapterId | null {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const state = new Map<ChapterId, "visiting" | "visited">();

  const visit = (id: ChapterId): ChapterId | null => {
    if (state.get(id) === "visiting") return id;
    if (state.get(id) === "visited") return null;
    state.set(id, "visiting");
    for (const dependencyId of byId.get(id)?.dependsOn ?? []) {
      if (!byId.has(dependencyId)) continue;
      const cycle = visit(dependencyId);
      if (cycle) return cycle;
    }
    state.set(id, "visited");
    return null;
  };

  for (const row of rows) {
    const cycle = visit(row.id);
    if (cycle) return cycle;
  }
  return null;
}

export function validateRegistry(rows: readonly OnboardingChapter[]): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  const byId = new Map<ChapterId, OnboardingChapter>();
  const ordersByTrack = new Map<OnboardingTrack, Map<number, ChapterId>>();

  for (const row of rows) {
    if (byId.has(row.id)) {
      problems.push(problem("duplicate-id", row.id, `Chapter id ${row.id} appears more than once.`));
    } else {
      byId.set(row.id, row);
    }

    const orders = ordersByTrack.get(row.track) ?? new Map<number, ChapterId>();
    const earlier = orders.get(row.order);
    if (earlier) {
      problems.push(problem("duplicate-order", row.id, `${row.track} order ${row.order} is also used by ${earlier}.`));
    } else {
      orders.set(row.order, row.id);
    }
    ordersByTrack.set(row.track, orders);
  }

  const householdRows = rows.filter((row) => row.track === "household").sort((a, b) => a.order - b.order);
  for (let index = 0; index < householdRows.length; index += 1) {
    const expected = index + 1;
    if (householdRows[index]?.order !== expected) {
      problems.push(problem("order-gap", householdRows[index]?.id ?? "household", `Household order ${expected} is missing.`));
      break;
    }
  }

  for (const row of rows) {
    const navigates = row.actions.includes("navigate");
    if (row.target && !navigates) {
      problems.push(problem("target-without-navigate", row.id, "A navigation target requires the navigate action."));
    }
    if (!row.target && navigates) {
      problems.push(problem("navigate-without-target", row.id, "The navigate action requires a navigation target."));
    }
    if (row.target && !HEARTH_TABS.has(row.target.tab)) {
      problems.push(problem("unknown-tab", row.id, `Unknown Hearth tab: ${String(row.target.tab)}.`));
    }
    if (row.approval === "joint" && row.skip === "member-skippable") {
      problems.push(problem("joint-and-skippable", row.id, "A joint approval cannot be member-skippable."));
    }
    if (row.track === "personal" && row.contributesToFinalGate) {
      problems.push(problem("personal-contributes-to-gate", row.id, "A personal module cannot contribute to the household final gate."));
    }
    if (row.track === "personal" && row.skip === "household-required") {
      problems.push(problem("household-policy-on-personal", row.id, "A personal module cannot use the household-required skip policy."));
    }
    if (row.timeBudgetSeconds > 300 && row.pausePoints.length === 0) {
      problems.push(problem("budget-without-pause", row.id, "A chapter over five minutes needs a declared pause point."));
    }
    if (row.flavorKeys.length < 3 || row.flavorKeys.length > 5) {
      problems.push(problem("flavor-count", row.id, "A chapter needs between three and five flavor keys."));
    }
    for (const dependencyId of row.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (dependency && dependency.order > row.order) {
        problems.push(problem("forward-dependency", row.id, `Dependency ${dependencyId} has a later order.`));
      }
    }
  }

  const cycle = dependencyCycle(rows);
  if (cycle) problems.push(problem("dependency-cycle", cycle, "Chapter dependencies contain a cycle."));

  return problems;
}

export function chapterById(id: ChapterId): OnboardingChapter | null {
  return ONBOARDING_REGISTRY.find((chapter) => chapter.id === id) ?? null;
}

export function householdChapters(): OnboardingChapter[] {
  return ONBOARDING_REGISTRY
    .filter((chapter) => chapter.track === "household")
    .sort((a, b) => a.order - b.order);
}

export function personalModules(): OnboardingChapter[] {
  return ONBOARDING_REGISTRY
    .filter((chapter) => chapter.track === "personal")
    .sort((a, b) => a.order - b.order);
}
