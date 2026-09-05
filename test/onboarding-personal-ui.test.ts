// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import {
  catalogHousehold,
  emptyMemberOnboardingProgress,
  memberProgress,
  personalModuleOfferFor,
  recordPersonalModuleOffer,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const SESSION = "personal-ui-session";
const AT = "2026-09-05T14:00:00.000Z";

function fixture(): Household {
  const household = catalogHousehold("development");
  household.householdOnboarding = {
    id: `ONBOARDING-${household.environment}-${household.householdId}`,
    environment: household.environment,
    householdId: household.householdId,
    registryVersion: 1,
    state: "complete",
    proposedByMemberId: BIANCA,
    proposedAt: "2026-08-01T13:00:00.000Z",
    handshakeExpiresAt: "2026-08-01T13:15:00.000Z",
    confirmedByMemberIds: [BIANCA, "MEM-002"],
    startedAt: "2026-08-01T13:15:00.000Z",
    stoppedAt: null,
    stoppedByMemberIds: [],
    stoppedSolo: false,
    forcedUnlock: false,
    completedAt: "2026-08-01T14:00:00.000Z",
    completionDigest: `ready-v1-${"b".repeat(64)}`,
    createdAt: "2026-08-01T13:00:00.000Z",
    updatedAt: "2026-08-01T14:00:00.000Z",
  };
  household.members = household.members.map((member) => ({
    ...member,
    onboardingProgress: emptyMemberOnboardingProgress({
      environment: household.environment,
      householdId: household.householdId,
      memberId: member.id,
    }),
  }));
  household.transactions = [{
    id: "TXN-PERSONAL-UI",
    date: "2026-09-05",
    type: "expense",
    amountCents: 500,
    currency: "CAD",
    accountId: household.accounts[0]!.id,
    categoryId: null,
    subcategoryId: null,
    note: "Personal trigger fixture",
    place: "Personal",
    splits: [{ party: BIANCA, amountCents: 500 }],
    source: "manual",
    duplicateKey: "personal-ui",
    potentialDuplicate: false,
    isDuplicate: false,
    reviewed: true,
    createdBy: BIANCA,
    visibility: "personal",
    createdAt: AT,
    updatedAt: AT,
  }];
  household.shifts = [];
  return household;
}

function mount(input: {
  household: Household;
  recorded: boolean;
  onCommit?: (fn: (current: Household) => { household: Household }) => void;
  onOpen?: () => void;
}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const offer = personalModuleOfferFor(fixture(), BIANCA, { now: AT, sessionId: SESSION, isDesktop: false })!;
  act(() => root.render(createElement(OnboardingChat, {
    household: input.household,
    memberId: BIANCA,
    today: "2026-09-05",
    onCommit: input.onCommit ?? (() => {}),
    onDismiss: vi.fn(),
    personalOffer: offer,
    personalOfferSessionId: SESSION,
    personalOfferRecorded: input.recorded,
    onOpenPersonalModule: input.onOpen,
  })));
  return {
    host,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe("the optional Personal guide shell", () => {
  it("waits for its member-private offer fact before enabling a calm, skippable guide", () => {
    let household = fixture();
    const saving = mount({ household, recorded: false });
    expect(saving.host.querySelector(".onboarding-personal-shell")?.getAttribute("aria-busy")).toBe("true");
    expect(saving.host.textContent).toContain("Saving this guide…");
    expect([...saving.host.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    saving.unmount();

    expect(personalModuleOfferFor(household, BIANCA, { now: AT, sessionId: SESSION, isDesktop: false })?.module.id)
      .toBe("pm-01-own-books");
    household = recordPersonalModuleOffer(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      moduleId: "pm-01-own-books",
      sessionId: SESSION,
      isDesktop: false,
      at: AT,
    }).household;
    const open = vi.fn();
    const ready = mount({
      household,
      recorded: true,
      onOpen: open,
      onCommit: (fn) => { household = fn(household).household; },
    });
    expect(ready.host.textContent).toContain("Optional · just yours");
    expect(ready.host.textContent).toContain("It never changes the household setup.");
    expect([...ready.host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      "Open Personal Books",
      "Got it",
      "Not now",
      "Skip this for now",
      "Stop offering these",
    ]);
    const primary = [...ready.host.querySelectorAll("button")].find((button) => button.textContent === "Open Personal Books")!;
    act(() => primary.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(open).toHaveBeenCalledOnce();
    expect(memberProgress(household, BIANCA).rows.find((row) => row.chapterId === "pm-01-own-books")?.acknowledgedAt).toBeNull();
    const done = [...ready.host.querySelectorAll("button")].find((button) => button.textContent === "Got it")!;
    act(() => done.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(memberProgress(household, BIANCA).rows.find((row) => row.chapterId === "pm-01-own-books")?.acknowledgedAt).toBeTruthy();
    ready.unmount();
  });
});
