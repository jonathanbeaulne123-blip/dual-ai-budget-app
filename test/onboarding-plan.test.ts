// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ONBOARDING_REGISTRY_VERSION,
  addRecurrence,
  adoptFirstBudget,
  approveOnboardingProposal,
  buildProposal,
  catalogHousehold,
  currentPlanAdoptionReceipt,
  emptyMemberOnboardingProgress,
  evidenceFor,
  firstPlanPresentation,
  onboardingAdoptionIdentity,
  recordChapterAcknowledgement,
  setBudget,
  submitOnboardingCategories,
  submitOnboardingEstimates,
  type CommandOutcome,
  type CommitResult,
  type Household,
} from "../src/core/index.ts";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import { OnboardingPlan } from "../src/OnboardingPlan.tsx";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-05";
const MONTH = "2026-09";
const AT = "2026-09-05T15:00:00.000Z";
const CATEGORIES = ["SUB-FOOD-GROCERIES", "SUB-HOUSING-RENT"];

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function chapterElevenHousehold(): Household {
  let household = catalogHousehold("development");
  household.householdOnboarding = {
    id: `ONBOARDING-${household.environment}-${household.householdId}`,
    environment: household.environment,
    householdId: household.householdId,
    registryVersion: ONBOARDING_REGISTRY_VERSION,
    state: "active",
    proposedByMemberId: BIANCA,
    proposedAt: AT,
    handshakeExpiresAt: "2026-09-05T15:15:00.000Z",
    confirmedByMemberIds: [BIANCA, JONATHAN],
    startedAt: AT,
    stoppedAt: null,
    stoppedByMemberIds: [],
    stoppedSolo: false,
    forcedUnlock: false,
    completedAt: null,
    completionDigest: null,
    createdAt: AT,
    updatedAt: AT,
  };
  household = submitOnboardingCategories(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    categoryIds: CATEGORIES,
    at: "2026-09-05T15:01:00.000Z",
  }).household;
  household = submitOnboardingCategories(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    categoryIds: [...CATEGORIES].reverse(),
    at: "2026-09-05T15:02:00.000Z",
  }).household;
  household = submitOnboardingEstimates(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    estimates: [
      { subcategoryId: CATEGORIES[0]!, amountCents: 50_000 },
      { subcategoryId: CATEGORIES[1]!, amountCents: 180_000 },
    ],
    at: "2026-09-05T15:03:00.000Z",
  }).household;
  household = submitOnboardingEstimates(household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    estimates: [
      { subcategoryId: CATEGORIES[0]!, amountCents: 60_000 },
      { subcategoryId: CATEGORIES[1]!, amountCents: 190_000 },
    ],
    at: "2026-09-05T15:04:00.000Z",
  }).household;
  household = addRecurrence(household, {
    cadence: "monthly",
    nextDate: "2026-09-15",
    type: "expense",
    amount: 1850,
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-HOUSING-RENT",
    note: "Rent anchor",
  }).household;
  const completed = new Set([
    "ch-01-meet", "ch-02-household", "ch-03-charter", "ch-04-accounts", "ch-05-opening",
    "ch-06-fund", "ch-07-recurrences", "ch-08-cadence", "ch-09-categories", "ch-10-estimates",
  ]);
  household.members = household.members.map((member) => {
    const progress = emptyMemberOnboardingProgress({
      environment: household.environment,
      householdId: household.householdId,
      memberId: member.id,
    });
    progress.rows = progress.rows.map((row) => completed.has(row.chapterId)
      ? { ...row, acknowledgedAt: AT, lastSafeResumePoint: row.chapterId }
      : row);
    progress.updatedAt = AT;
    return { ...member, onboardingProgress: progress };
  });
  return household;
}

function receiptAccepted(household: Household): Household {
  const proposal = buildProposal(household, MONTH, TODAY);
  let approved = approveOnboardingProposal(household, {
    memberId: BIANCA,
    createdBy: BIANCA,
    digest: proposal.sourceDigest,
  }).household;
  approved = approveOnboardingProposal(approved, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    digest: proposal.sourceDigest,
  }).household;
  const adopted = adoptFirstBudget(approved, {
    memberId: BIANCA,
    createdBy: BIANCA,
    monthKey: MONTH,
    proposalDigest: proposal.sourceDigest,
  });
  return {
    ...adopted.household,
    commandReceipts: [...adopted.household.commandReceipts, {
      confirmationId: onboardingAdoptionIdentity(MONTH, proposal.sourceDigest),
      identityHash: "fixture-identity",
      auditHash: "fixture-audit",
      commandKind: "adoptFirstBudget",
      postedIds: [...adopted.postedIds],
      revision: adopted.household.revision,
      acceptedAt: AT,
    }],
  };
}

function click(node: Element) {
  act(() => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function type(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function acceptedOutcome(household: Household): CommandOutcome {
  return { ok: true, household, userMessage: null } as CommandOutcome;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Chapter 11 first-plan contract", () => {
  it("projects both authored inputs, exact anchors, the honest empty run rate, and no capacity fiction", () => {
    const household = chapterElevenHousehold();
    const view = firstPlanPresentation(household, BIANCA, MONTH, TODAY);
    expect(view.rows).toHaveLength(2);
    expect(view.rows.find((row) => row.subcategoryId === "SUB-HOUSING-RENT")?.anchors)
      .toEqual([expect.objectContaining({ label: "Rent anchor", amountCents: 185_000, nextDate: "2026-09-15" })]);
    expect(view.rows.every((row) => !row.runRate.eligible)).toBe(true);
    expect(view.proposal.capacityCents).toBeNull();
    expect(view.rows[0]?.estimatesCents.map((row) => row.memberId)).toEqual([BIANCA, JONATHAN]);
  });

  it("shows only recurrence occurrences eligible for the proposal month and ties their arithmetic to the floor", () => {
    let household = chapterElevenHousehold();
    household = addRecurrence(household, {
      cadence: "weekly",
      nextDate: "2026-09-03",
      type: "expense",
      amount: 10,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Weekly market",
    }).household;
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-10-02",
      type: "expense",
      amount: 40,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Starts next month",
    }).household;
    const row = firstPlanPresentation(household, BIANCA, MONTH, TODAY).rows
      .find((candidate) => candidate.subcategoryId === "SUB-FOOD-GROCERIES")!;
    expect(row.anchors).toEqual([expect.objectContaining({
      label: "Weekly market",
      amountCents: 1_000,
      occurrenceDates: ["2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24"],
      monthTotalCents: 4_000,
    })]);
    expect(row.recurrenceFloorCents).toBe(4_000);
  });

  it("renders every derivation before a self-owned approval action", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingPlan, {
      household: chapterElevenHousehold(),
      memberId: BIANCA,
      today: TODAY,
      onCommit: vi.fn(),
    })));
    expect(host.textContent).toContain("I've got nothing to go on yet");
    expect(host.textContent).toContain("Bianca");
    expect(host.textContent).toContain("Jonathan");
    expect(host.textContent).toContain("Rent anchor");
    expect(host.textContent).toContain("$1850.00");
    expect(host.textContent).toContain("You didn't enter a household capacity");
    expect(host.textContent).toContain("I approve this");
    expect(host.textContent).not.toMatch(/\b(ratio|ranking|work more|hours)\b/i);
    act(() => root.unmount());
  });

  it("warns before editing and a new submission digest visibly retires old approvals", async () => {
    const base = chapterElevenHousehold();
    const digest = buildProposal(base, MONTH, TODAY).sourceDigest;
    const approved = approveOnboardingProposal(base, { memberId: BIANCA, createdBy: BIANCA, digest }).household;
    let latest = approved;
    function Harness() {
      const [household, setHousehold] = useState(approved);
      return createElement(OnboardingPlan, {
        household,
        memberId: BIANCA,
        today: TODAY,
        onCommit: async (fn: (current: Household) => CommitResult) => {
          const result = fn(household);
          latest = result.household;
          setHousehold(result.household);
          return acceptedOutcome(result.household);
        },
      });
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(Harness)));
    click([...host.querySelectorAll("button")].find((button) => button.textContent === "Change my guesses")!);
    expect(host.textContent).toContain("Changing this clears both approvals");
    const groceries = [...host.querySelectorAll<HTMLInputElement>("input")][0]!;
    type(groceries, "525.00");
    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Save a new version")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    const changed = buildProposal(latest, MONTH, TODAY);
    expect(changed.sourceDigest).not.toBe(digest);
    expect(host.textContent).toContain("Earlier approvals don't apply");
    expect(host.textContent).toContain("I approve this");
    act(() => root.unmount());
  });

  it("labels edited guesses as monthly CAD and associates invalid input with its error", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingPlan, {
      household: chapterElevenHousehold(),
      memberId: BIANCA,
      today: TODAY,
      onCommit: vi.fn(),
    })));
    click([...host.querySelectorAll("button")].find((button) => button.textContent === "Change my guesses")!);
    const groceries = host.querySelector<HTMLInputElement>("input")!;
    expect(groceries.closest("label")?.textContent).toContain("Monthly guess (CAD)");
    type(groceries, "not money");
    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Save a new version")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    const error = host.querySelector<HTMLElement>("[role=alert]")!;
    expect(error.textContent).toContain("Use dollars and cents");
    expect(groceries.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
    act(() => root.unmount());
  });

  it("exposes adoption only after both exact-version approvals", async () => {
    let household = chapterElevenHousehold();
    const digest = buildProposal(household, MONTH, TODAY).sourceDigest;
    household = approveOnboardingProposal(household, { memberId: JONATHAN, createdBy: JONATHAN, digest }).household;
    let latest = household;
    function Harness() {
      const [state, setState] = useState(household);
      return createElement(OnboardingPlan, {
        household: state,
        memberId: BIANCA,
        today: TODAY,
        onCommit: async (fn: (current: Household) => CommitResult) => {
          const result = fn(state);
          latest = result.household;
          setState(result.household);
          return acceptedOutcome(result.household);
        },
      });
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(Harness)));
    expect(host.textContent).not.toContain("Adopt our first plan");
    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent === "I approve this")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Adopt our first plan");
    expect(firstPlanPresentation(latest, BIANCA, MONTH, TODAY).bothApproved).toBe(true);
    act(() => root.unmount());
  });

  it("invalidates visible approvals when the bound current plan snapshot changes", () => {
    let household = chapterElevenHousehold();
    household = setBudget(household, {
      monthKey: MONTH,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: 500,
    }).household;
    const digest = buildProposal(household, MONTH, TODAY).sourceDigest;
    household = approveOnboardingProposal(household, { memberId: BIANCA, createdBy: BIANCA, digest }).household;
    household = approveOnboardingProposal(household, { memberId: JONATHAN, createdBy: JONATHAN, digest }).household;
    expect(firstPlanPresentation(household, BIANCA, MONTH, TODAY).bothApproved).toBe(true);

    const changed = setBudget(household, {
      monthKey: MONTH,
      subcategoryId: "SUB-FOOD-GROCERIES",
      amount: 501,
    }).household;
    const view = firstPlanPresentation(changed, BIANCA, MONTH, TODAY);
    expect(view.proposal.sourceDigest).toBe(digest);
    expect(view.approvals).toEqual([]);
    expect(view.bothApproved).toBe(false);
    expect(view.editedAfterApproval).toBe(true);
  });

  it("shows an honest nothing-changed retry when adoption is rejected", async () => {
    let household = chapterElevenHousehold();
    const digest = buildProposal(household, MONTH, TODAY).sourceDigest;
    household = approveOnboardingProposal(household, { memberId: BIANCA, createdBy: BIANCA, digest }).household;
    household = approveOnboardingProposal(household, { memberId: JONATHAN, createdBy: JONATHAN, digest }).household;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingPlan, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onCommit: async () => ({
        ok: false,
        postedNothing: true,
        recoveryAvailable: false,
        userMessage: "The local books stayed unchanged.",
        household,
      } as CommandOutcome),
    })));
    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Adopt our first plan")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Nothing changed");
    expect(host.textContent).toContain("Try adoption again");
    expect(household.budgetPlans.filter((plan) => plan.monthKey === MONTH)).toHaveLength(0);
    act(() => root.unmount());
  });

  it("does not claim nothing changed or offer ordinary retry when recovery is required", async () => {
    let household = chapterElevenHousehold();
    const digest = buildProposal(household, MONTH, TODAY).sourceDigest;
    household = approveOnboardingProposal(household, { memberId: BIANCA, createdBy: BIANCA, digest }).household;
    household = approveOnboardingProposal(household, { memberId: JONATHAN, createdBy: JONATHAN, digest }).household;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingPlan, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onCommit: async () => ({
        ok: false,
        kind: "recovery-available",
        postedNothing: false,
        recoveryAvailable: true,
        userMessage: "Recovery is available. Do not adopt again.",
        household,
      } as CommandOutcome),
    })));
    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Adopt our first plan")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(host.textContent).toContain("may have accepted this plan");
    expect(host.textContent).toContain("Use recovery before trying again");
    expect(host.textContent).not.toContain("Nothing changed");
    expect(host.textContent).not.toContain("Try adoption again");
    act(() => root.unmount());
  });

  it("keeps a known pre-acceptance null outcome on the ordinary retry path", async () => {
    let household = chapterElevenHousehold();
    const digest = buildProposal(household, MONTH, TODAY).sourceDigest;
    household = approveOnboardingProposal(household, { memberId: BIANCA, createdBy: BIANCA, digest }).household;
    household = approveOnboardingProposal(household, { memberId: JONATHAN, createdBy: JONATHAN, digest }).household;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingPlan, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onCommit: async () => null,
    })));
    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Adopt our first plan")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Nothing changed");
    expect(host.textContent).toContain("Try adoption again");
    expect(host.textContent).not.toContain("may have accepted this plan");
    act(() => root.unmount());
  });

  it("renders the accepted state from the exact current receipt", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingPlan, {
      household: receiptAccepted(chapterElevenHousehold()),
      memberId: JONATHAN,
      today: TODAY,
      onCommit: vi.fn(),
    })));
    expect(host.textContent).toContain("That's our first month");
    expect(host.querySelector("[role=status]")).toBeTruthy();
    expect(host.textContent).not.toContain("Adopt our first plan");
    act(() => root.unmount());
  });

  it("accepts only the current exact receipt and matching active month rows", () => {
    const adopted = receiptAccepted(chapterElevenHousehold());
    const proposal = buildProposal(adopted, MONTH, TODAY);
    expect(currentPlanAdoptionReceipt(adopted, MONTH, proposal)).toBeTruthy();
    const evidence = evidenceFor(adopted, "ch-11-plan", BIANCA, { today: TODAY });
    expect(evidence.kind).toBe("accepted");
    if (evidence.kind === "accepted") expect(evidence.card.kind).toBe("receipt");
    expect(evidenceFor(adopted, "ch-11-plan", BIANCA, { today: "2026-10-05" }).kind).not.toBe("accepted");
    const inactive = {
      ...adopted,
      budgetPlans: adopted.budgetPlans.map((plan, index) => index === 0 ? { ...plan, active: false } : plan),
    };
    expect(evidenceFor(inactive, "ch-11-plan", BIANCA, { today: TODAY }).kind).not.toBe("accepted");
    const changedAmount = {
      ...adopted,
      budgetPlans: adopted.budgetPlans.map((plan, index) => index === 0
        ? { ...plan, amountCents: plan.amountCents + 1 }
        : plan),
    };
    expect(evidenceFor(changedAmount, "ch-11-plan", BIANCA, { today: TODAY }).kind).not.toBe("accepted");
  });

  it("routes Chapter 11 to Plan and gates both UI Next and direct acknowledgement until adoption", () => {
    const household = chapterElevenHousehold();
    expect(() => recordChapterAcknowledgement(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      chapterId: "ch-11-plan",
    })).toThrow(/Adopt the current month's exact first plan/);
    const onOpenPlan = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingChat, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onCommit: vi.fn(),
      onDismiss: vi.fn(),
      onOpenPlan,
    })));
    expect(host.textContent).toContain("Review our first plan");
    expect(host.textContent).not.toContain("Next");
    click([...host.querySelectorAll("button")].find((button) => button.textContent === "Review our first plan")!);
    expect(onOpenPlan).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("derives acknowledgement month from the current Toronto clock rather than a caller date", () => {
    const adopted = receiptAccepted(chapterElevenHousehold());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T15:00:00.000Z"));
    expect(() => recordChapterAcknowledgement(adopted, {
      memberId: BIANCA,
      createdBy: BIANCA,
      chapterId: "ch-11-plan",
      at: AT,
    })).toThrow(/Adopt the current month's exact first plan/);
  });

  it("keeps the Plan surface fenced from unrelated guidance and ships responsive accessibility rules", () => {
    const component = readFileSync(resolve(process.cwd(), "src/OnboardingPlan.tsx"), "utf8");
    const projector = readFileSync(resolve(process.cwd(), "src/core/onboarding/planView.ts"), "utf8");
    const styles = readFileSync(resolve(process.cwd(), "src/onboarding.css"), "utf8");
    for (const source of [component, projector]) {
      expect(source).not.toMatch(/ask(?:Routes|View)?\.ts/);
      expect(source).not.toMatch(/\bhours\b/i);
      expect(source).not.toMatch(/\b(ratio|ranking|work more)\b/i);
    }
    const block = styles.slice(styles.indexOf(".onboarding-first-plan"));
    expect(block).toContain("@media (max-width: 559px)");
    expect(block).toContain("@media (forced-colors: active)");
    expect(block).toContain("@media (prefers-reduced-motion: reduce)");
    expect(block).toContain("min-height: 48px");
    expect(block).toContain(":focus-visible");
    expect(block).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("wires the focused surface through App and both Hercules shells", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const hercules = readFileSync(resolve(process.cwd(), "src/Hercules.tsx"), "utf8");
    expect(app).toContain("onboardingPlanOnly");
    expect(app).toContain("<OnboardingPlan");
    expect(app).toContain("onOpenPlan={() =>");
    expect(hercules.match(/onOpenPlan=\{openOnboardingPlan\}/g)).toHaveLength(2);
  });
});
