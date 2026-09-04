// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { AddAccountForm } from "../src/Accounts.tsx";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import {
  addAccount,
  assembleHousehold,
  catalogHousehold,
  confirmHouseholdOnboarding,
  evidenceFor,
  foundHouseholdCharter,
  memberProgress,
  mergePersonal,
  nextChapterFor,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  resolveSwipeCardAccount,
  selfPersonalAccountsEvidenceFor,
  setFundCardAccount,
  signHouseholdCharter,
  skipChapterFourPersonalAccounts,
  splitForSync,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-03";

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

function atChapterFour(): Household {
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
  return acknowledgeBoth(household, "ch-03-charter");
}

describe("onboarding Slice 13 — Chapter 4 accounts", () => {
  it("requires Shared accounts and a resolvable Shared credit card, never Personal evidence", () => {
    let household = atChapterFour();
    household = {
      ...household,
      accounts: household.accounts.filter((account) => account.scope === "personal"),
    };
    household = addAccount(household, {
      name: "Bianca private card", kind: "credit", scope: "personal", ownerMemberId: BIANCA,
    }).household;
    expect(selfPersonalAccountsEvidenceFor(household, BIANCA).kind).toBe("accepted");
    expect(evidenceFor(household, "ch-04-accounts", BIANCA)).toEqual({ kind: "empty" });

    household = addAccount(household, {
      name: "Jonathan private card", kind: "credit", scope: "personal", ownerMemberId: JONATHAN,
    }).household;
    const blocked = evidenceFor(household, "ch-04-accounts", BIANCA);
    expect(blocked).toEqual({ kind: "ineligible", reason: "privacy" });
    expect(JSON.stringify(blocked)).not.toContain("Jonathan private card");
    expect(JSON.stringify(blocked)).not.toContain(JONATHAN);
  });

  it("cites only Shared accounts once the custodian explicitly chooses the Fund card", () => {
    let household = atChapterFour();
    expect(evidenceFor(household, "ch-04-accounts", BIANCA)).toEqual({ kind: "empty" });
    household = setFundCardAccount(household, {
      memberId: BIANCA, accountId: "ACC-MC", createdBy: BIANCA,
    }).household;
    const result = evidenceFor(household, "ch-04-accounts", BIANCA);
    expect(result).toMatchObject({ kind: "accepted", card: { scope: "household" } });
    expect(result.kind === "accepted" && result.card.lines[0]).toEqual({ label: "Fund card", value: "Mastercard" });
    expect(result.kind === "accepted" && result.card.sourceIds.every((id) => (
      household.accounts.find((account) => account.id === id)?.scope !== "personal"
    ))).toBe(true);
    expect(evidenceFor(household, "ch-04-accounts", JONATHAN)).toEqual(result);
  });

  it("refuses a bare acknowledgement, then accepts the same household probe after the Fund card choice", () => {
    let household = atChapterFour();
    expect(() => recordChapterAcknowledgement(household, {
      memberId: BIANCA, chapterId: "ch-04-accounts", createdBy: BIANCA,
    })).toThrow("Add a Shared account and choose one Shared credit card for the Fund before continuing.");
    household = setFundCardAccount(household, {
      memberId: BIANCA, accountId: "ACC-VISA", createdBy: BIANCA,
    }).household;
    household = recordChapterAcknowledgement(household, {
      memberId: BIANCA, chapterId: "ch-04-accounts", createdBy: BIANCA,
    }).household;
    expect(nextChapterFor(household, BIANCA, TODAY)?.id).toBe("ch-05-opening");
  });

  it("keeps the Fund-card preference self-owned, Personal-only, and convergent", () => {
    let household = atChapterFour();
    expect(() => setFundCardAccount(household, {
      memberId: BIANCA, accountId: "ACC-VISA", createdBy: JONATHAN,
    })).toThrow("Only you can choose your Fund card.");
    const withPrivate = addAccount(household, {
      name: "Bianca private card", kind: "credit", scope: "personal", ownerMemberId: BIANCA,
    }).household;
    const privateCard = withPrivate.accounts.find((account) => account.name === "Bianca private card")!;
    expect(() => setFundCardAccount(withPrivate, {
      memberId: BIANCA, accountId: privateCard.id, createdBy: BIANCA,
    })).toThrow("Choose an active Shared credit card for the Fund.");

    const chosen = setFundCardAccount(household, {
      memberId: BIANCA, accountId: "ACC-VISA", createdBy: BIANCA,
    });
    expect(chosen.persistenceScope).toBe("member-personal");
    const split = splitForSync(chosen.household, BIANCA);
    expect(JSON.stringify(split.shared)).not.toContain("fundCardAccountId");
    expect(split.personal.fundCardAccountId).toBe("ACC-VISA");
    const restored = assembleHousehold(split.shared, split.personal);
    expect(restored.members.find((member) => member.id === BIANCA)?.fundCardAccountId).toBe("ACC-VISA");

    const older = {
      ...split.personal,
      fundCardAccountId: "ACC-VISA",
      fundCardAccountUpdatedAt: "2026-09-03T10:00:00.000Z",
    };
    const newer = {
      ...split.personal,
      fundCardAccountId: "ACC-MC",
      fundCardAccountUpdatedAt: "2026-09-03T11:00:00.000Z",
    };
    expect(mergePersonal(older, newer).fundCardAccountId).toBe("ACC-MC");
    expect(mergePersonal(newer, older).fundCardAccountId).toBe("ACC-MC");
  });

  it("records the optional Personal skip without fabricating an account or satisfying Chapter 4", () => {
    const household = atChapterFour();
    const beforeAccounts = structuredClone(household.accounts);
    const skipped = skipChapterFourPersonalAccounts(household, {
      memberId: BIANCA, createdBy: BIANCA, at: "2026-09-03T15:00:00.000Z",
    });
    const ownRow = memberProgress(skipped.household, BIANCA).rows.find((row) => row.chapterId === "ch-04-accounts");
    const partnerRow = memberProgress(skipped.household, JONATHAN).rows.find((row) => row.chapterId === "ch-04-accounts");
    expect(ownRow?.personalAccountSetupSkippedAt).toBe("2026-09-03T15:00:00.000Z");
    expect(ownRow?.skippedAt).toBeNull();
    expect(partnerRow?.personalAccountSetupSkippedAt).toBeNull();
    expect(skipped.household.accounts).toEqual(beforeAccounts);
    expect(nextChapterFor(skipped.household, BIANCA, TODAY)?.id).toBe("ch-04-accounts");
    expect(skipped.persistenceScope).toBe("member-personal");
  });

  it("offers the owner a soft Personal choice after Shared evidence, then reveals Next after skip", () => {
    let household = setFundCardAccount(atChapterFour(), {
      memberId: BIANCA, accountId: "ACC-VISA", createdBy: BIANCA,
    }).household;
    const openAccounts = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const render = () => act(() => root.render(createElement(OnboardingChat, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onDismiss: () => {},
      onOpenAccounts: openAccounts,
      onCommit: (fn) => { household = fn(household).household; },
    })));
    render();
    expect(host.textContent).toContain("Want to add your own accounts too?");
    expect([...host.querySelectorAll("button")].map((button) => button.textContent))
      .toEqual(["Open accounts", "Skip this for now", "Stop setup for now"]);
    const open = [...host.querySelectorAll("button")].find((button) => button.textContent === "Open accounts")!;
    act(() => open.click());
    expect(openAccounts).toHaveBeenCalledOnce();
    const skip = [...host.querySelectorAll("button")].find((button) => button.textContent === "Skip this for now")!;
    act(() => skip.click());
    render();
    expect(host.textContent).toContain("The accounts");
    expect([...host.querySelectorAll("button")].map((button) => button.textContent))
      .toEqual(["Next", "Stop setup for now"]);
    act(() => root.unmount());
    host.remove();
  });

  it("expands account setup on request and makes the Fund card choice explicit and reversible", () => {
    let household = atChapterFour();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(AddAccountForm, {
      household,
      memberId: BIANCA,
      openRequest: 1,
      onSave: (next: Household) => { household = next; },
    })));
    expect(host.textContent).toContain("Hearth does not open accounts or move money");
    expect(host.textContent).toContain("Shared card for the Fund");
    const choice = [...host.querySelectorAll("button")].find((button) => button.textContent === "Use Mastercard")!;
    act(() => choice.click());
    expect(resolveSwipeCardAccount(household, BIANCA)).toEqual({ kind: "ready", accountId: "ACC-MC" });
    expect(household.members.find((member) => member.id === BIANCA)?.fundCardAccountId).toBe("ACC-MC");
    expect(household.members.find((member) => member.id === BIANCA)?.glanceAccountId).toBeUndefined();
    act(() => root.unmount());
    host.remove();
  });
});
