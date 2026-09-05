// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  compileHousehold,
  copy,
  currentSubmission,
  emptyMemberOnboardingProgress,
  evidenceFor,
  mergeShared,
  onboardingEstimateState,
  splitForSync,
  submitOnboardingCategories,
  submitOnboardingEstimates,
  type Household,
} from "../src/core/index.ts";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import { OnboardingEstimates } from "../src/OnboardingEstimates.tsx";
import { commandMaterializationFacts, financialAuditHashForScope, sha256Hex } from "../src/core/commandIdentity.ts";
import {
  applyCommandEventLocally,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
} from "../src/ledger/materializeSnapshotFromEvents.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-04";
const CATEGORY_ONE_AT = "2026-09-04T18:01:00.000Z";
const CATEGORY_TWO_AT = "2026-09-04T18:02:00.000Z";
const ESTIMATE_ONE_AT = "2026-09-04T18:03:00.000Z";
const ESTIMATE_TWO_AT = "2026-09-04T18:04:00.000Z";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function categoryReadyHousehold(): Household {
  const first = submitOnboardingCategories(catalogHousehold("development"), {
    memberId: BIANCA,
    createdBy: BIANCA,
    categoryIds: ["SUB-FOOD-GROCERIES", "SUB-HOUSING-RENT"],
    at: CATEGORY_ONE_AT,
  });
  return submitOnboardingCategories(first.household, {
    memberId: JONATHAN,
    createdBy: JONATHAN,
    categoryIds: ["SUB-HOUSING-RENT", "SUB-FOOD-GROCERIES"],
    at: CATEGORY_TWO_AT,
  }).household;
}

function submit(
  household: Household,
  memberId: string,
  estimates: Array<{ subcategoryId: string; amountCents: number }>,
  at: string,
) {
  return submitOnboardingEstimates(household, { memberId, createdBy: memberId, estimates, at });
}

function chapterTenHousehold(): Household {
  const household = categoryReadyHousehold();
  household.householdOnboarding = {
    id: `ONBOARDING-development-${household.householdId}-v1`,
    environment: "development",
    householdId: household.householdId,
    registryVersion: 1,
    state: "active",
    proposedByMemberId: BIANCA,
    proposedAt: CATEGORY_ONE_AT,
    handshakeExpiresAt: "2026-09-04T18:15:00.000Z",
    confirmedByMemberIds: [BIANCA, JONATHAN],
    stoppedByMemberIds: [],
    stoppedAt: null,
    stoppedSolo: false,
    forcedUnlock: false,
    startedAt: CATEGORY_ONE_AT,
    completedAt: null,
    completionDigest: null,
    createdAt: CATEGORY_ONE_AT,
    updatedAt: CATEGORY_TWO_AT,
  };
  const completedBeforeTen = new Set([
    "ch-01-meet", "ch-02-household", "ch-03-charter", "ch-04-accounts", "ch-05-opening",
    "ch-06-fund", "ch-07-recurrences", "ch-08-cadence", "ch-09-categories",
  ]);
  household.members = household.members.map((member) => {
    const progress = emptyMemberOnboardingProgress({
      environment: "development",
      householdId: household.householdId,
      memberId: member.id,
    });
    progress.rows = progress.rows.map((row) => completedBeforeTen.has(row.chapterId)
      ? { ...row, acknowledgedAt: CATEGORY_TWO_AT, lastSafeResumePoint: row.chapterId }
      : row);
    progress.updatedAt = CATEGORY_TWO_AT;
    return { ...member, onboardingProgress: progress };
  });
  return household;
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

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Chapter 10 estimate contract", () => {
  it("keeps the required reassurance copy byte-exact", () => {
    expect(copy("guess.reassure")).toBe("It's okay to guess. This is the first shape, not a promise; Hearth will learn from what actually happens.");
    expect(copy("onboarding.household.ch-10-estimates")).toBe(copy("guess.reassure"));
  });

  it("stores zero as an answer and an omitted category as missing", () => {
    const saved = submit(categoryReadyHousehold(), BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
    ], ESTIMATE_ONE_AT);
    const state = onboardingEstimateState(saved.household);

    expect(state.kind).toBe("waiting-member");
    expect(state.bySubmitter[BIANCA]).toEqual([
      { categoryId: "SUB-FOOD-GROCERIES", label: "Groceries", kind: "zero", amountCents: 0 },
      { categoryId: "SUB-HOUSING-RENT", label: "Rent", kind: "missing", amountCents: null },
    ]);
    expect(currentSubmission(saved.household, BIANCA, "estimates")?.estimates).toEqual([
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
    ]);
  });

  it("waits after one submission and reveals nothing through evidence", () => {
    const saved = submit(categoryReadyHousehold(), BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
    ], ESTIMATE_ONE_AT);
    expect(onboardingEstimateState(saved.household)).toMatchObject({
      kind: "waiting-member",
      submittedMemberIds: [BIANCA],
      needsSubmissionMemberIds: [JONATHAN],
    });
    expect(evidenceFor(saved.household, "ch-10-estimates", BIANCA)).toEqual({ kind: "empty" });
  });

  it("shows author-labelled answers only after both current submissions", () => {
    const first = submit(categoryReadyHousehold(), BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
    ], ESTIMATE_ONE_AT);
    const second = submit(first.household, JONATHAN, [
      { subcategoryId: "SUB-HOUSING-RENT", amountCents: 125_000 },
    ], ESTIMATE_TWO_AT);
    const state = onboardingEstimateState(second.household);
    const evidence = evidenceFor(second.household, "ch-10-estimates", BIANCA);

    expect(state.kind).toBe("complete");
    expect(evidence.kind).toBe("accepted");
    if (evidence.kind === "accepted") {
      expect(evidence.card.lines).toEqual([
        { label: "Bianca · Groceries", value: "$0.00" },
        { label: "Bianca · Rent", value: "Not estimated" },
        { label: "Jonathan · Groceries", value: "Not estimated" },
        { label: "Jonathan · Rent", value: "$1250.00" },
      ]);
      expect(evidence.card.sourceIds).toEqual(expect.arrayContaining([
        ...state.categorySubmissionIds,
        ...state.submissionIds,
        ...state.categoryIds,
      ]));
    }
  });

  it("demotes estimates that predate a changed accepted category set", () => {
    const first = submit(categoryReadyHousehold(), BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 40_000 },
    ], ESTIMATE_ONE_AT);
    const second = submit(first.household, JONATHAN, [], ESTIMATE_TWO_AT);
    const changed = submitOnboardingCategories(second.household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      categoryIds: ["SUB-FOOD-GROCERIES", "SUB-LIFE-PHONE"],
      at: "2026-09-04T18:05:00.000Z",
    });

    expect(onboardingEstimateState(changed.household)).toMatchObject({
      kind: "collecting",
      staleMemberIds: [BIANCA, JONATHAN],
      needsSubmissionMemberIds: [BIANCA, JONATHAN],
    });
    expect(evidenceFor(changed.household, "ch-10-estimates", BIANCA)).toEqual({ kind: "empty" });
  });

  it("binds estimates to the exact category set even when device clocks disagree", () => {
    const first = submit(categoryReadyHousehold(), BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 40_000 },
    ], "2030-01-01T00:00:00.000Z");
    const second = submit(first.household, JONATHAN, [], "2030-01-01T00:01:00.000Z");
    const changed = submitOnboardingCategories(second.household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      categoryIds: ["SUB-FOOD-GROCERIES", "SUB-LIFE-PHONE"],
      at: "2026-09-04T18:05:00.000Z",
    });

    expect(onboardingEstimateState(changed.household)).toMatchObject({
      kind: "collecting",
      staleMemberIds: [BIANCA, JONATHAN],
      needsSubmissionMemberIds: [BIANCA, JONATHAN],
    });
  });

  it("fails closed if category work is in progress", () => {
    const pending = submitOnboardingCategories(catalogHousehold("development"), {
      memberId: BIANCA,
      createdBy: BIANCA,
      categoryIds: ["SUB-FOOD-GROCERIES"],
      at: CATEGORY_ONE_AT,
    });

    expect(() => submit(pending.household, BIANCA, [], ESTIMATE_ONE_AT))
      .toThrow("Finish the household category set before adding guesses.");
  });

  it("refuses an estimate outside an already accepted category set", () => {
    expect(() => submit(categoryReadyHousehold(), BIANCA, [
      { subcategoryId: "SUB-LIFE-PHONE", amountCents: 8_000 },
    ], ESTIMATE_ONE_AT)).toThrow("Use only the accepted household categories for these guesses.");
  });

  it("converges simultaneous offline submissions without losing zero or missing", () => {
    const base = categoryReadyHousehold();
    const bianca = submit(base, BIANCA, [{ subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 }], ESTIMATE_ONE_AT);
    const jonathan = submit(base, JONATHAN, [{ subcategoryId: "SUB-HOUSING-RENT", amountCents: 125_000 }], ESTIMATE_TWO_AT);
    const forward = mergeShared(splitForSync(bianca.household, BIANCA).shared, splitForSync(jonathan.household, JONATHAN).shared);
    const reverse = mergeShared(splitForSync(jonathan.household, JONATHAN).shared, splitForSync(bianca.household, BIANCA).shared);
    const forwardState = onboardingEstimateState({ ...base, ...forward });
    const reverseState = onboardingEstimateState({ ...base, ...reverse });

    expect(forward.onboardingSubmissions).toEqual(reverse.onboardingSubmissions);
    expect(forwardState).toEqual(reverseState);
    expect(forwardState.kind).toBe("complete");
    expect(forwardState.bySubmitter[BIANCA]?.map((row) => row.kind)).toEqual(["zero", "missing"]);
    expect(forwardState.bySubmitter[JONATHAN]?.map((row) => row.kind)).toEqual(["missing", "amount"]);
  });

  it("replays the exact self-owned estimate submission through the command event", async () => {
    const base = categoryReadyHousehold();
    const saved = submit(base, BIANCA, [{ subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 }], ESTIMATE_ONE_AT);
    const facts = extractMaterializationFacts(saved.household, saved.postedIds, {
      ledgerScope: "shared",
      memberId: BIANCA,
      commandKind: "submitOnboardingEstimates",
      acceptedAt: ESTIMATE_ONE_AT,
    });
    const event: ContinuityCommandEvent = {
      id: "EVENT-ESTIMATE-SUBMIT",
      environment: "development",
      household_id: base.householdId,
      member_id: BIANCA,
      idempotency_key: "CONF-ESTIMATE-SUBMIT",
      confirmation_id: "CONF-ESTIMATE-SUBMIT",
      identity_hash: "identity",
      base_revision: base.revision,
      result_revision: base.revision + 1,
      ledger_scope: "shared",
      command_type: "submitOnboardingEstimates",
      payload_json: {
        confirmationId: "CONF-ESTIMATE-SUBMIT",
        identityHash: "identity",
        commandKind: "submitOnboardingEstimates",
        postedIds: saved.postedIds,
        auditHash: await financialAuditHashForScope(base, "shared", BIANCA),
        revision: base.revision + 1,
        acceptedAt: ESTIMATE_ONE_AT,
        materializationHash: await sha256Hex(commandMaterializationFacts({
          onboardingSubmissions: facts.onboardingSubmissions,
        })),
        materializationFacts: facts,
      },
      created_at: ESTIMATE_ONE_AT,
    };

    const applied = await applyCommandEventLocally({ local: base, event, memberId: BIANCA });
    expect(applied).toEqual(expect.objectContaining({ ok: true, duplicate: false }));
    if (applied.ok) {
      expect(currentSubmission(applied.household, BIANCA, "estimates")?.estimates).toEqual([
        { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
      ]);
      expect(onboardingEstimateState(applied.household).kind).toBe("waiting-member");
    }

    const forgedSubmissions = facts.onboardingSubmissions!.map((row) => row.kind === "estimates" ? {
      ...row,
      estimates: [{ subcategoryId: "PRIVATE-OTHER-MEMBER", amountCents: 99_900 }],
    } : row);
    const forgedFacts = { ...facts, onboardingSubmissions: forgedSubmissions };
    const forged = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        payload_json: {
          ...event.payload_json,
          materializationFacts: forgedFacts,
          materializationHash: await sha256Hex(commandMaterializationFacts({
            onboardingSubmissions: forgedSubmissions,
          })),
        },
      },
      memberId: BIANCA,
    });
    expect(forged).toEqual({
      ok: false,
      reason: "onboarding-submission-authority-mismatch",
      fallback: true,
    });
  });

  it("rejects an out-of-scope estimate at the accepted-write boundary", async () => {
    const base = categoryReadyHousehold();
    const saved = submit(base, BIANCA, [
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 40_000 },
    ], ESTIMATE_ONE_AT);
    const forged: Household = {
      ...saved.household,
      onboardingSubmissions: saved.household.onboardingSubmissions!.map((row) => row.kind === "estimates" ? {
        ...row,
        estimates: [{ subcategoryId: "PRIVATE-OTHER-MEMBER", amountCents: 99_900 }],
      } : row),
    };
    let persisted = false;
    const outcome = await acceptHouseholdWrite({
      previous: base,
      candidate: forged,
      confirmationId: "CONF-FORGED-ESTIMATE-SCOPE",
      commandKind: "submitOnboardingEstimates",
      postedIds: saved.postedIds,
      actingMemberId: BIANCA,
      adapters: {
        persist: async () => { persisted = true; },
        ingest: async () => ({ ok: true }),
        validateCandidate: async () => ({ ok: true }),
        restoreIngest: async () => undefined,
      },
    });

    expect(outcome).toMatchObject({
      ok: false,
      postedNothing: true,
      userMessage: "Use only the accepted household categories for these guesses.",
    });
    expect(persisted).toBe(false);
  });

  it("changes no journal, budget, Fund, contribution, or approval state", () => {
    const base = categoryReadyHousehold();
    const beforeJournal = compileHousehold(base).entries;
    const first = submit(base, BIANCA, [{ subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 }], ESTIMATE_ONE_AT);
    const second = submit(first.household, JONATHAN, [], ESTIMATE_TWO_AT);

    expect(compileHousehold(second.household).entries).toEqual(beforeJournal);
    expect(second.household.budgetPlans).toEqual(base.budgetPlans);
    expect(second.household.fundEvents).toEqual(base.fundEvents);
    expect(second.household.goalContributions).toEqual(base.goalContributions);
    expect(second.household.householdFund).toEqual(base.householdFund);
  });
});

describe("Chapter 10 estimate experience", () => {
  it("keeps draft amounts local and submits blank separately from zero", () => {
    const original = categoryReadyHousehold();
    const onCommit = vi.fn<(fn: (current: Household) => unknown) => void>();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingEstimates, { household: original, memberId: BIANCA, onCommit })));

    const inputs = [...host.querySelectorAll<HTMLInputElement>("input")];
    type(inputs[0]!, "0");
    expect(original.onboardingSubmissions?.filter((row) => row.kind === "estimates")).toEqual([]);
    expect(onCommit).not.toHaveBeenCalled();
    click([...host.querySelectorAll("button")].find((button) => button.textContent === "Submit my numbers")!);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const commit = onCommit.mock.calls[0]![0]!(original) as ReturnType<typeof submitOnboardingEstimates>;
    expect(currentSubmission(commit.household, BIANCA, "estimates")?.estimates).toEqual([
      { subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 },
    ]);
    act(() => root.unmount());
  });

  it("drops an unsent draft when the active member changes", () => {
    const household = categoryReadyHousehold();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingEstimates, {
      household,
      memberId: BIANCA,
      onCommit: vi.fn(),
    })));
    type(host.querySelector<HTMLInputElement>("input")!, "777.00");
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("777.00");

    act(() => root.render(createElement(OnboardingEstimates, {
      household,
      memberId: JONATHAN,
      onCommit: vi.fn(),
    })));
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("");
    act(() => root.unmount());
  });

  it("focuses and describes the specific field with invalid money copy", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const onCommit = vi.fn();
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingEstimates, {
      household: categoryReadyHousehold(),
      memberId: BIANCA,
      onCommit,
    })));
    const first = host.querySelector<HTMLInputElement>("input")!;
    type(first, "not money");
    click([...host.querySelectorAll("button")].find((button) => button.textContent === "Submit my numbers")!);

    expect(onCommit).not.toHaveBeenCalled();
    expect(first.getAttribute("aria-invalid")).toBe("true");
    expect(first.getAttribute("aria-describedby")).toContain("error");
    expect(document.activeElement).toBe(first);
    expect(host.textContent).toContain("Use dollars and cents");
    act(() => root.unmount());
  });

  it("renders a non-revealing wait and an authored reveal with no comparison", () => {
    const waiting = submit(categoryReadyHousehold(), BIANCA, [{ subcategoryId: "SUB-FOOD-GROCERIES", amountCents: 0 }], ESTIMATE_ONE_AT);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingEstimates, { household: waiting.household, memberId: BIANCA, onCommit: vi.fn() })));
    expect(host.textContent).toContain("Jonathan's stay private");
    expect(host.textContent).not.toContain("$1250.00");
    act(() => root.unmount());

    const complete = submit(waiting.household, JONATHAN, [{ subcategoryId: "SUB-HOUSING-RENT", amountCents: 125_000 }], ESTIMATE_TWO_AT);
    const revealHost = document.createElement("div");
    document.body.append(revealHost);
    const revealRoot = createRoot(revealHost);
    act(() => revealRoot.render(createElement(OnboardingEstimates, { household: complete.household, memberId: BIANCA, onCommit: vi.fn() })));
    expect(revealHost.textContent).toContain("Bianca's guesses");
    expect(revealHost.textContent).toContain("Jonathan's guesses");
    expect(revealHost.textContent).toContain("Not estimated");
    expect(revealHost.textContent).toContain("$0.00");
    expect(revealHost.textContent).toContain("$1250.00");
    expect(revealHost.textContent).not.toMatch(/\b(total|ratio|ranking|who guessed more|your share)\b/i);
    act(() => revealRoot.unmount());
  });

  it("routes Chapter 10 to the focused Plan flow instead of offering Next", () => {
    const household = chapterTenHousehold();
    const onOpenEstimates = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingChat, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onCommit: vi.fn(),
      onDismiss: vi.fn(),
      onOpenEstimates,
    })));
    expect(host.textContent).toContain("Add my first guesses");
    expect(host.textContent).not.toContain("Next");
    click([...host.querySelectorAll("button")].find((button) => button.textContent === "Add my first guesses")!);
    expect(onOpenEstimates).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("keeps the implementation free of comparison, promise, approval, and money-write claims", () => {
    const component = readFileSync(resolve(process.cwd(), "src/OnboardingEstimates.tsx"), "utf8");
    const core = readFileSync(resolve(process.cwd(), "src/core/onboarding/estimates.ts"), "utf8");
    const copySource = readFileSync(resolve(process.cwd(), "src/core/onboarding/copy.ts"), "utf8");
    const copyBlock = copySource.slice(copySource.indexOf('key: "onboarding.household.ch-10-estimates"'), copySource.indexOf('key: "runrate.absent"'));
    expect(`${component}\n${core}`).not.toMatch(/postEntry|postTransfer|budgetPlans|fundEvents|goalContributions/);
    expect(`${component}\n${core}\n${copyBlock}`).not.toMatch(/\b(his versus hers|who guessed more|total versus total|ratio|ranking|contribution commitment|final plan approval|you promised)\b/i);
  });

  it("ships responsive, token-only, keyboard-visible estimate styles", () => {
    const source = readFileSync(resolve(process.cwd(), "src/onboarding.css"), "utf8");
    const block = source.slice(source.indexOf(".onboarding-estimate-card"));
    expect(block).toContain("@media (max-width: 560px)");
    expect(block).toContain("@media (prefers-reduced-motion: reduce)");
    expect(block).toContain(":focus-visible");
    expect(block).toContain("min-height: 48px");
    expect(block).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("wires the dedicated surface through App and both Hercules shells", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const hercules = readFileSync(resolve(process.cwd(), "src/Hercules.tsx"), "utf8");
    expect(app).toContain("onboardingEstimatesOnly");
    expect(app).toContain("<OnboardingEstimates");
    expect(app).toContain("onOpenEstimates={() =>");
    expect(hercules.match(/onOpenEstimates=\{openOnboardingEstimates\}/g)).toHaveLength(2);
  });
});
