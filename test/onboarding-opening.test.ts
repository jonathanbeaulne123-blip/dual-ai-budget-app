// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import { OpeningTruthCard } from "../src/OpeningTruthCard.tsx";
import {
  booksEquation,
  catalogHousehold,
  compileHousehold,
  confirmHouseholdOnboarding,
  evidenceFor,
  foundHouseholdCharter,
  nextChapterFor,
  postEntry,
  postOpeningBalances,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  setFundCardAccount,
  signHouseholdCharter,
  trialBalance,
  type CommandReceipt,
  type Household,
  type UndoToken,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-03";
const ACCEPTED_AT = "2026-09-03T16:00:00.000Z";

function receipt(confirmationId: string, postedIds: string[]): CommandReceipt {
  return {
    confirmationId,
    identityHash: `identity-${confirmationId}`,
    auditHash: `audit-${confirmationId}`,
    commandKind: "postOpeningBalances",
    postedIds,
    revision: 1,
    acceptedAt: ACCEPTED_AT,
  };
}

function sharedOpeningLines(household: Household) {
  return household.accounts
    .filter((account) => account.active && account.scope !== "personal")
    .map((account, index) => ({ accountId: account.id, amountCents: (index + 1) * 100_00 }));
}

function observed(household: Household, memberId: string) {
  return {
    kind: "resolved" as const,
    scope: { environment: household.environment, householdId: household.householdId, memberId },
    currentMemberId: memberId,
    seatMemberIds: [BIANCA, JONATHAN],
    observedAt: "2026-09-03T14:02:00.000Z",
  };
}

function acknowledgeBoth(household: Household, chapterId: string): Household {
  if (chapterId === "ch-02-household") {
    let next = recordObservedChapterCompletion(household, {
      memberId: BIANCA, chapterId, createdBy: BIANCA, observation: observed(household, BIANCA),
    }).household;
    next = recordObservedChapterCompletion(next, {
      memberId: JONATHAN, chapterId, createdBy: JONATHAN, observation: observed(next, JONATHAN),
    }).household;
    return next;
  }
  let next = recordChapterAcknowledgement(household, { memberId: BIANCA, chapterId, createdBy: BIANCA }).household;
  next = recordChapterAcknowledgement(next, { memberId: JONATHAN, chapterId, createdBy: JONATHAN }).household;
  return next;
}

function atChapterFive(): Household {
  let household = proposeHouseholdOnboarding(catalogHousehold("development"), {
    memberId: BIANCA, at: "2026-09-03T14:00:00.000Z",
  }).household;
  household = confirmHouseholdOnboarding(household, {
    memberId: JONATHAN, at: "2026-09-03T14:01:00.000Z",
  }).household;
  household = acknowledgeBoth(household, "ch-01-meet");
  household = acknowledgeBoth(household, "ch-02-household");
  household = foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Roof and groceries.",
    splitRule: "remainder",
    splitNote: "We cover the house together.",
    ceilingKind: "none",
    cadence: "weekly",
    cadenceWeekday: 0,
    date: TODAY,
  }).household;
  household = signHouseholdCharter(household, { memberId: BIANCA }).household;
  household = signHouseholdCharter(household, { memberId: JONATHAN }).household;
  household = acknowledgeBoth(household, "ch-03-charter");
  household = setFundCardAccount(household, {
    memberId: BIANCA, accountId: "ACC-VISA", createdBy: BIANCA,
  }).household;
  household = acknowledgeBoth(household, "ch-04-accounts");
  return household;
}

function acceptedOpening(household: Household, confirmationId = "OPEN-ALL"): Household {
  const posted = postOpeningBalances(household, {
    asOfDate: TODAY,
    createdBy: BIANCA,
    confirmationId,
    lines: sharedOpeningLines(household),
  });
  posted.household.commandReceipts = [
    ...(posted.household.commandReceipts ?? []),
    receipt(confirmationId, posted.postedIds),
  ];
  return posted.household;
}

function renderChat(household: Household, onOpenOpeningBalances = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(createElement(OnboardingChat, {
    household,
    memberId: BIANCA,
    today: TODAY,
    onCommit: () => {},
    onDismiss: () => {},
    onOpenOpeningBalances,
  })));
  return {
    host,
    onOpenOpeningBalances,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe("onboarding Slice 14 — Chapter 5 opening truth", () => {
  it("keeps a receipt-tied partial opening pending and routes it to whole-batch correction", () => {
    const base = atChapterFive();
    const posted = postOpeningBalances(base, {
      asOfDate: TODAY,
      createdBy: BIANCA,
      confirmationId: "OPEN-PARTIAL",
      lines: [sharedOpeningLines(base)[0]!],
    });
    posted.household.commandReceipts = [receipt("OPEN-PARTIAL", posted.postedIds)];

    expect(evidenceFor(posted.household, "ch-05-opening", BIANCA)).toEqual({ kind: "empty" });
    expect(() => recordChapterAcknowledgement(posted.household, {
      memberId: BIANCA, chapterId: "ch-05-opening", createdBy: BIANCA,
    })).toThrow("Confirm one complete opening batch for every Shared account before continuing.");

    const rendered = renderChat(posted.household);
    expect(rendered.host.textContent).toContain("Some Shared accounts are missing from the opening batch.");
    const button = [...rendered.host.querySelectorAll("button")]
      .find((candidate) => candidate.textContent === "Review opening entries")!;
    act(() => button.click());
    expect(rendered.onOpenOpeningBalances).toHaveBeenCalledWith("correction");
    rendered.unmount();
  });

  it("fails closed when ordinary money already exists and names the conflict honestly", () => {
    const stale = postEntry(atChapterFive(), {
      date: TODAY,
      type: "expense",
      amount: 12,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    expect(evidenceFor(stale, "ch-05-opening", BIANCA)).toEqual({ kind: "ineligible", reason: "stale" });

    const rendered = renderChat(stale);
    expect(rendered.host.textContent).toContain("There are already posted entries in the books, but no accepted opening balance.");
    expect(rendered.host.textContent).not.toContain("Next");
    const button = [...rendered.host.querySelectorAll("button")]
      .find((candidate) => candidate.textContent === "Review opening entries")!;
    act(() => button.click());
    expect(rendered.onOpenOpeningBalances).toHaveBeenCalledWith("correction");
    rendered.unmount();
  });

  it("accepts one complete Shared batch and cites receipt, accounts, Toronto date, and balanced equity", () => {
    const household = acceptedOpening(atChapterFive());
    const result = evidenceFor(household, "ch-05-opening", BIANCA);
    expect(result).toMatchObject({
      kind: "accepted",
      card: {
        scope: "household",
        kind: "receipt",
        lines: [
          { label: "Accounts covered" },
          { label: "Civil date", value: TODAY },
          { label: "Opening equity" },
        ],
      },
    });
    expect(result.kind === "accepted" && result.card.sourceIds).toContain("OPEN-ALL");
    expect(trialBalance(compileHousehold(household)).inBalance).toBe(true);
    expect(booksEquation(compileHousehold(household)).holds).toBe(true);

    const acknowledged = recordChapterAcknowledgement(household, {
      memberId: BIANCA, chapterId: "ch-05-opening", createdBy: BIANCA,
    }).household;
    expect(nextChapterFor(acknowledged, BIANCA, TODAY)?.id).toBe("ch-06-fund");
  });

  it("opens the existing Shared-only card and carries the exact batch id into persistence", async () => {
    const household = atChapterFive();
    const personalName = household.accounts.find((account) => account.scope === "personal")?.name;
    const sharedAccounts = household.accounts.filter((account) => account.active && account.scope !== "personal");
    let applied: { next: Household; undo?: UndoToken; confirmationId?: string } | null = null;
    const apply = vi.fn(async (next: Household, undo?: UndoToken, confirmationId?: string) => {
      applied = { next, undo, confirmationId };
      return { ok: true };
    });
    const done = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OpeningTruthCard, {
      household,
      memberId: BIANCA,
      date: TODAY,
      accountScope: "shared",
      onApply: apply,
      onDone: done,
    })));

    expect(host.textContent).toContain(`0 of ${sharedAccounts.length} Shared accounts ready`);
    if (personalName) expect(host.textContent).not.toContain(personalName);
    const inputs = [...host.querySelectorAll<HTMLInputElement>("input")];
    expect(inputs).toHaveLength(sharedAccounts.length);
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    for (const [index, input] of inputs.entries()) {
      await act(async () => {
        valueSetter.call(input, String(index + 1));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    expect(host.textContent).toContain(`${sharedAccounts.length} of ${sharedAccounts.length} Shared accounts ready`);
    const review = [...host.querySelectorAll("button")].find((button) => button.textContent === "Review balances")!;
    expect(review.disabled).toBe(false);
    act(() => review.click());
    expect(host.textContent).toContain("One Confirm will post");
    expect(document.activeElement?.textContent).toContain("Balance-sheet review");

    const change = [...host.querySelectorAll("button")].find((button) => button.textContent === "Change")!;
    act(() => change.click());
    expect(document.activeElement).toBe(inputs[0]);
    const reviewAgain = [...host.querySelectorAll("button")].find((button) => button.textContent === "Review balances")!;
    act(() => reviewAgain.click());

    const confirm = [...host.querySelectorAll("button")].find((button) => button.textContent === "Confirm opening balances")!;
    await act(async () => confirm.click());
    expect(apply).toHaveBeenCalledOnce();
    const { next, confirmationId } = applied!;
    expect(typeof confirmationId).toBe("string");
    expect(next.transactions.filter((row: { source: string }) => row.source === "opening"))
      .toHaveLength(sharedAccounts.length);
    expect(next.transactions.filter((row: { source: string }) => row.source === "opening")
      .every((row: { sourceId?: string }) => row.sourceId === confirmationId)).toBe(true);
    expect(done).toHaveBeenCalledOnce();

    act(() => root.unmount());
    host.remove();
  });

  it("keeps the existing opening-truth command contract byte-identical", () => {
    const source = readFileSync(join(process.cwd(), "src/core/openingTruth.ts"));
    expect(createHash("sha256").update(source).digest("hex"))
      .toBe("f00d090c6b4bf3f9e83edb60abe4a8b6e29d389d2eeea7384786f4a1845db63d");
  });
});
