// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  catalogHousehold,
  acceptHouseholdWrite,
  compileHousehold,
  currentSubmission,
  emptyMemberOnboardingProgress,
  evidenceFor,
  mergeOnboardingCategories,
  mergeShared,
  onboardingCategoryState,
  splitForSync,
  submitOnboardingCategories,
  type Household,
} from "../src/core/index.ts";
import { OnboardingCategories } from "../src/OnboardingCategories.tsx";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import { commandMaterializationFacts, financialAuditHashForScope, sha256Hex } from "../src/core/commandIdentity.ts";
import {
  applyCommandEventLocally,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
} from "../src/ledger/materializeSnapshotFromEvents.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-04";
const AT = "2026-09-04T18:00:00.000Z";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function submit(
  household: Household,
  memberId: string,
  categoryIds: string[],
  proposals: Array<{ name: string; parentId: string }> = [],
  at = AT,
) {
  return submitOnboardingCategories(household, { memberId, createdBy: memberId, categoryIds, proposals, at });
}

function chapterNineHousehold(): Household {
  const household = catalogHousehold("development");
  household.householdOnboarding = {
    id: `ONBOARDING-development-${household.householdId}-v1`,
    environment: "development",
    householdId: household.householdId,
    registryVersion: 1,
    state: "active",
    proposedByMemberId: BIANCA,
    proposedAt: AT,
    handshakeExpiresAt: "2026-09-04T18:15:00.000Z",
    confirmedByMemberIds: [BIANCA, JONATHAN],
    stoppedByMemberIds: [],
    stoppedAt: null,
    stoppedSolo: false,
    forcedUnlock: false,
    startedAt: AT,
    completedAt: null,
    completionDigest: null,
    createdAt: AT,
    updatedAt: AT,
  };
  household.members = household.members.map((member) => {
    const progress = emptyMemberOnboardingProgress({
      environment: "development",
      householdId: household.householdId,
      memberId: member.id,
    });
    progress.rows = progress.rows.map((row) => row.chapterId <= "ch-08-cadence"
      ? { ...row, acknowledgedAt: AT, lastSafeResumePoint: row.chapterId }
      : row);
    progress.updatedAt = AT;
    return { ...member, onboardingProgress: progress };
  });
  return household;
}

function click(node: Element) {
  act(() => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Chapter 9 category contract", () => {
  it("treats one current submission as waiting-member without completing evidence", () => {
    const one = submit(catalogHousehold("development"), BIANCA, ["SUB-FOOD-GROCERIES"]);
    expect(onboardingCategoryState(one.household).kind).toBe("waiting-member");
    expect(evidenceFor(one.household, "ch-09-categories", BIANCA)).toEqual({ kind: "empty" });
  });

  it("keeps the union deterministic under offline submission order", () => {
    const base = catalogHousehold("development");
    const bianca = submit(base, BIANCA, ["SUB-TRANSPORT-TRANSIT", "SUB-FOOD-GROCERIES"]);
    const jonathan = submit(base, JONATHAN, ["SUB-LIFE-PHONE", "SUB-FOOD-GROCERIES"]);
    const forward = mergeShared(splitForSync(bianca.household, BIANCA).shared, splitForSync(jonathan.household, JONATHAN).shared);
    const reverse = mergeShared(splitForSync(jonathan.household, JONATHAN).shared, splitForSync(bianca.household, BIANCA).shared);
    expect(forward.onboardingSubmissions).toEqual(reverse.onboardingSubmissions);
    expect(onboardingCategoryState({ ...bianca.household, ...forward }).unionIds).toEqual([
      "SUB-FOOD-GROCERIES",
      "SUB-LIFE-PHONE",
      "SUB-TRANSPORT-TRANSIT",
    ]);
  });

  it("keeps a submitted idea non-canonical until the reviewed merge command", () => {
    const base = catalogHousehold("development");
    const journalBefore = compileHousehold(base).entries;
    const first = submit(base, BIANCA, ["SUB-FOOD-GROCERIES"], [{ name: "Cat snacks", parentId: "CAT-LIFE" }]);
    const second = submit(first.household, JONATHAN, ["SUB-HOUSING-RENT"], [], "2026-09-04T18:01:00.000Z");
    const proposal = second.household.onboardingCategoryProposals?.[0];

    expect(proposal).toBeTruthy();
    expect(second.household.categories.some((row) => row.name === "Cat snacks")).toBe(false);
    expect(onboardingCategoryState(second.household).kind).toBe("review");
    expect(compileHousehold(second.household).entries).toEqual(journalBefore);

    const merged = mergeOnboardingCategories(second.household, { memberId: BIANCA, createdBy: BIANCA, at: "2026-09-04T18:02:00.000Z" });
    expect(merged.household.categories.filter((row) => row.name === "Cat snacks")).toHaveLength(1);
    expect(onboardingCategoryState(merged.household).kind).toBe("complete");
    expect(compileHousehold(merged.household).entries).toEqual(journalBefore);
  });

  it("accepts the staged Submit and reviewed merge through the command boundary", async () => {
    const adapters = {
      persist: vi.fn(async () => undefined),
      ingest: vi.fn(async () => ({ ok: true })),
      validateCandidate: vi.fn(async () => ({ ok: true })),
      restoreIngest: vi.fn(async () => undefined),
    };
    const base = catalogHousehold("development");
    const first = submit(base, BIANCA, ["SUB-FOOD-GROCERIES"], [{ name: "Cat snacks", parentId: "CAT-LIFE" }]);
    const acceptedFirst = await acceptHouseholdWrite({
      previous: base,
      candidate: first.household,
      commandKind: first.undo?.commandKind,
      postedIds: first.postedIds,
      actingMemberId: BIANCA,
      adapters,
    });
    expect(acceptedFirst.kind).toBe("accepted-local");
    const second = submit(acceptedFirst.household, JONATHAN, ["SUB-HOUSING-RENT"], [], "2026-09-04T18:01:00.000Z");
    const acceptedSecond = await acceptHouseholdWrite({
      previous: acceptedFirst.household,
      candidate: second.household,
      commandKind: second.undo?.commandKind,
      postedIds: second.postedIds,
      actingMemberId: JONATHAN,
      adapters,
    });
    expect(acceptedSecond.kind).toBe("accepted-local");
    const merge = mergeOnboardingCategories(acceptedSecond.household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      at: "2026-09-04T18:02:00.000Z",
    });
    const acceptedMerge = await acceptHouseholdWrite({
      previous: acceptedSecond.household,
      candidate: merge.household,
      commandKind: merge.undo?.commandKind,
      postedIds: merge.postedIds,
      actingMemberId: BIANCA,
      adapters,
    });
    expect(acceptedMerge.kind).toBe("accepted-local");
    expect(acceptedMerge.household.categories.some((row) => row.name === "Cat snacks")).toBe(true);

    const forged = await acceptHouseholdWrite({
      previous: acceptedSecond.household,
      candidate: { ...merge.household, name: "Changed in the merge" },
      commandKind: merge.undo?.commandKind,
      postedIds: merge.postedIds,
      actingMemberId: BIANCA,
      adapters,
    });
    expect(forged.kind).toBe("permanent-validation-failure");
    expect(forged.household).toEqual(acceptedSecond.household);
  });

  it("replays the submitted idea with its self-owned command event", async () => {
    const base = catalogHousehold("development");
    const saved = submit(base, BIANCA, ["SUB-FOOD-GROCERIES"], [{ name: "Cat snacks", parentId: "CAT-LIFE" }]);
    const facts = extractMaterializationFacts(saved.household, saved.postedIds, {
      ledgerScope: "shared",
      memberId: BIANCA,
      commandKind: "submitOnboardingCategories",
      acceptedAt: AT,
    });
    expect(facts.onboardingCategoryProposals).toHaveLength(1);
    const materializationHash = await sha256Hex(commandMaterializationFacts({
      onboardingSubmissions: facts.onboardingSubmissions,
      onboardingCategoryProposals: facts.onboardingCategoryProposals,
    }));
    const event: ContinuityCommandEvent = {
      id: "EVENT-CATEGORY-SUBMIT",
      environment: "development",
      household_id: base.householdId,
      member_id: BIANCA,
      idempotency_key: "CONF-CATEGORY-SUBMIT",
      confirmation_id: "CONF-CATEGORY-SUBMIT",
      identity_hash: "identity",
      base_revision: base.revision,
      result_revision: base.revision + 1,
      ledger_scope: "shared",
      command_type: "submitOnboardingCategories",
      payload_json: {
        confirmationId: "CONF-CATEGORY-SUBMIT",
        identityHash: "identity",
        commandKind: "submitOnboardingCategories",
        postedIds: saved.postedIds,
        auditHash: await financialAuditHashForScope(base, "shared", BIANCA),
        revision: base.revision + 1,
        acceptedAt: AT,
        materializationHash,
        materializationFacts: facts,
      },
      created_at: AT,
    };
    const applied = await applyCommandEventLocally({ local: base, event, memberId: BIANCA });
    expect(applied).toEqual(expect.objectContaining({ ok: true, duplicate: false }));
    if (applied.ok) {
      expect(applied.household.onboardingCategoryProposals?.[0]?.name).toBe("Cat snacks");
      expect(currentSubmission(applied.household, BIANCA, "categories")?.categoryIds)
        .toContain(applied.household.onboardingCategoryProposals?.[0]?.id);
    }
  });

  it("replays the reviewed merge with the newly canonical category", async () => {
    const first = submit(catalogHousehold("development"), BIANCA, [], [{ name: "Cat snacks", parentId: "CAT-LIFE" }]);
    const local = submit(first.household, JONATHAN, ["SUB-HOUSING-RENT"], [], "2026-09-04T18:01:00.000Z").household;
    const saved = mergeOnboardingCategories(local, {
      memberId: BIANCA,
      createdBy: BIANCA,
      at: "2026-09-04T18:02:00.000Z",
    });
    const facts = extractMaterializationFacts(saved.household, saved.postedIds, {
      ledgerScope: "shared",
      memberId: BIANCA,
      commandKind: "mergeOnboardingCategories",
      acceptedAt: "2026-09-04T18:02:00.000Z",
    });
    expect(facts.categories?.map((row) => row.name)).toEqual(["Cat snacks"]);
    expect(facts.onboardingCategoryMerges).toHaveLength(1);
    const materializationHash = await sha256Hex(commandMaterializationFacts({
      onboardingCategoryMerges: facts.onboardingCategoryMerges,
      categories: facts.categories,
    }));
    const event: ContinuityCommandEvent = {
      id: "EVENT-CATEGORY-MERGE",
      environment: "development",
      household_id: local.householdId,
      member_id: BIANCA,
      idempotency_key: "CONF-CATEGORY-MERGE",
      confirmation_id: "CONF-CATEGORY-MERGE",
      identity_hash: "identity",
      base_revision: local.revision,
      result_revision: local.revision + 1,
      ledger_scope: "shared",
      command_type: "mergeOnboardingCategories",
      payload_json: {
        confirmationId: "CONF-CATEGORY-MERGE",
        identityHash: "identity",
        commandKind: "mergeOnboardingCategories",
        postedIds: saved.postedIds,
        auditHash: await financialAuditHashForScope(local, "shared", BIANCA),
        revision: local.revision + 1,
        acceptedAt: "2026-09-04T18:02:00.000Z",
        materializationHash,
        materializationFacts: facts,
      },
      created_at: "2026-09-04T18:02:00.000Z",
    };
    const applied = await applyCommandEventLocally({ local, event, memberId: BIANCA });
    expect(applied).toEqual(expect.objectContaining({ ok: true, duplicate: false }));
    if (applied.ok) {
      expect(applied.household.categories.some((row) => row.name === "Cat snacks")).toBe(true);
      expect(onboardingCategoryState(applied.household).kind).toBe("complete");
    }
  });

  it("surfaces same-name different-id ideas and requires one explicit resolution", () => {
    const first = submit(catalogHousehold("development"), BIANCA, [], [{ name: "Pet care", parentId: "CAT-LIFE" }]);
    const second = submit(first.household, JONATHAN, [], [{ name: "Pet care", parentId: "CAT-HEALTH" }], "2026-09-04T18:01:00.000Z");
    const state = onboardingCategoryState(second.household);
    expect(state.kind).toBe("review");
    expect(state.conflicts).toHaveLength(1);
    expect(state.conflicts[0]?.options).toHaveLength(2);
    expect(() => mergeOnboardingCategories(second.household, { memberId: BIANCA, createdBy: BIANCA }))
      .toThrow("Choose one version of each matching category together.");

    const chosen = state.conflicts[0]!.options.find((option) => option.parentId === "CAT-HEALTH")!;
    const merged = mergeOnboardingCategories(second.household, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      conflictSelections: [chosen.id],
      at: "2026-09-04T18:02:00.000Z",
    });
    const accepted = merged.household.categories.find((row) => row.name === "Pet care");
    expect(accepted?.parentId).toBe("CAT-HEALTH");
    expect(merged.household.categories.filter((row) => row.name === "Pet care")).toHaveLength(1);
  });

  it("does not silently duplicate a suggestion that matches an existing category", () => {
    const first = submit(catalogHousehold("development"), BIANCA, [], [{ name: "Groceries", parentId: "CAT-LIFE" }]);
    const second = submit(first.household, JONATHAN, ["SUB-HOUSING-RENT"], [], "2026-09-04T18:01:00.000Z");
    const state = onboardingCategoryState(second.household);
    const conflict = state.conflicts.find((row) => row.name === "Groceries")!;
    expect(conflict.options.some((row) => row.id === "SUB-FOOD-GROCERIES" && !row.proposed)).toBe(true);
    const merged = mergeOnboardingCategories(second.household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      conflictSelections: ["SUB-FOOD-GROCERIES"],
      at: "2026-09-04T18:02:00.000Z",
    });
    expect(merged.household.categories.filter((row) => row.name === "Groceries")).toHaveLength(1);
    expect(onboardingCategoryState(merged.household).unionIds).toContain("SUB-FOOD-GROCERIES");
  });

  it("projects a cited household set and member-authored lists without comparison copy", () => {
    const first = submit(catalogHousehold("development"), BIANCA, ["SUB-FOOD-GROCERIES"]);
    const second = submit(first.household, JONATHAN, ["SUB-HOUSING-RENT"], [], "2026-09-04T18:01:00.000Z");
    const evidence = evidenceFor(second.household, "ch-09-categories", BIANCA);
    expect(evidence.kind).toBe("accepted");
    if (evidence.kind !== "accepted") return;
    expect(evidence.card.sourceIds).toEqual(expect.arrayContaining([
      currentSubmission(second.household, BIANCA, "categories")!.id,
      currentSubmission(second.household, JONATHAN, "categories")!.id,
    ]));
    const rendered = evidence.card.lines.map((line) => `${line.label} ${line.value}`).join(" ");
    expect(rendered).not.toMatch(/\b(percent|ratio|ranking|versus|more|fewer|count)\b/i);
  });
});

describe("Chapter 9 category experience", () => {
  it("keeps choices private before Submit and renders a non-revealing waiting state", () => {
    const original = chapterNineHousehold();
    const onCommit = vi.fn<(fn: (current: Household) => unknown) => void>();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingCategories, { household: original, memberId: BIANCA, onCommit })));
    const groceries = [...host.querySelectorAll("label")].find((row) => row.textContent?.includes("Groceries"))!;
    click(groceries);
    expect(original.onboardingSubmissions).toBeUndefined();
    expect(onCommit).not.toHaveBeenCalled();
    click([...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Submit my choices"))!);
    expect(onCommit).toHaveBeenCalledTimes(1);
    act(() => root.unmount());

    const waiting = submit(original, BIANCA, ["SUB-FOOD-GROCERIES"]);
    const waitingHost = document.createElement("div");
    document.body.append(waitingHost);
    const waitingRoot = createRoot(waitingHost);
    act(() => waitingRoot.render(createElement(OnboardingCategories, { household: waiting.household, memberId: BIANCA, onCommit: vi.fn() })));
    expect(waitingHost.textContent).toContain("Jonathan's choices stay private");
    expect(waitingHost.textContent).not.toContain("Rent");
    act(() => waitingRoot.unmount());
  });

  it("routes Chapter 9 to Plan and withholds Next until the household set is ready", () => {
    const onOpenCategories = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingChat, {
      household: chapterNineHousehold(),
      memberId: BIANCA,
      today: TODAY,
      onCommit: vi.fn(),
      onDismiss: vi.fn(),
      onOpenCategories,
    })));
    expect(host.textContent).toContain("Choose what the plan covers");
    expect(host.textContent).not.toContain("Next");
    click([...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Choose what the plan covers"))!);
    expect(onOpenCategories).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("keeps responsive styles token-only with clear selection, focus, and reduced-motion states", () => {
    const source = readFileSync(resolve(process.cwd(), "src/onboarding.css"), "utf8");
    const start = source.indexOf(".onboarding-category-card");
    const block = source.slice(start);
    expect(block).toContain("@media (max-width: 560px)");
    expect(block).toContain("@media (prefers-reduced-motion: reduce)");
    expect(block).toContain(".onboarding-category-option.is-selected");
    expect(block).toContain(":focus-visible");
    expect(block).toContain("min-height: 48px");
    expect(block).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("renders no member comparison language", () => {
    const source = readFileSync(resolve(process.cwd(), "src/OnboardingCategories.tsx"), "utf8");
    const copySource = readFileSync(resolve(process.cwd(), "src/core/onboarding/copy.ts"), "utf8");
    const renderedCopy = Object.values({ source, copySource }).join(" ");
    expect(renderedCopy).not.toMatch(/\b(his versus hers|who chose more|selection count|selection ratio|ranking)\b/i);
  });
});
