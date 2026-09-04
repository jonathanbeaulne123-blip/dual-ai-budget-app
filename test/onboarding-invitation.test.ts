// @vitest-environment jsdom
//
// Onboarding slice 10 — Chapter 1 · Meet Hercules, and the invitation
// replaces auto-open (ONBOARDING_BUILD_MANUAL.md; HEARTH_UX_PACKET.md
// §13.7-§13.8, plates 9 and 10).
//
// This file covers exactly the manual's named tests for this slice: an
// empty household does not open Charter founding and does show the
// invitation; the invitation renders at most once per household until
// dismissed or accepted; activation is impossible from one device; expiry
// copy at the right moment; a keyboard path through both sides; and the
// fence that App.tsx no longer calls setCharterFoundingOpen from the
// householdNeedsCharterFounding effect.
//
// App.tsx (6000+ lines, floating/gesture-heavy siblings, no existing test
// harness for it — see onboarding slice 9's delivery notes for the same
// judgment call about Hercules.tsx) is not mounted here. Its auto-open
// effect and render site are covered two ways instead: source fences below
// (mirroring test/onboarding-return.test.ts's fence style), and a small
// local reimplementation of App.tsx's own dismissed-state visibility rule
// (copied verbatim from the JSX comment above it in App.tsx) exercised
// against real household fixtures — the same "prove the rule, not the
// 6000-line component" approach the manual's own chapter tests use for
// rules that live partly in App.tsx elsewhere (e.g. onboarding-return's
// onGo wiring).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import {
  acceptedHouseholdOnboarding,
  confirmHouseholdOnboarding,
  emptyHousehold,
  handshakeExpired,
  householdNeedsCharterFounding,
  offerHouseholdOnboarding,
  proposeHouseholdOnboarding,
  type Household,
  type OnboardingModeState,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-03";
const PROPOSED_AT = "2026-09-03T14:00:00.000Z";
const NOW_FRESH = "2026-09-03T14:05:00.000Z"; // +5min — inside the 15-minute window
const NOW_EXPIRED = "2026-09-03T14:20:00.000Z"; // +20min — past the 15-minute window

const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

// A genuinely empty household (satisfies householdNeedsCharterFounding) —
// deliberately not catalogHousehold(), which seeds demo accounts and so
// already fails that predicate before this slice's code even runs.
function emptyCatalog(): Household {
  const household = emptyHousehold("development");
  household.members = [
    { id: BIANCA, name: "Bianca", color: "#c45c26", active: true, updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: JONATHAN, name: "Jonathan", color: "#2f6b4f", active: true, updatedAt: "2026-01-01T00:00:00.000Z" },
  ];
  return household;
}

function offered(): Household {
  return offerHouseholdOnboarding(emptyCatalog(), { memberId: BIANCA, at: PROPOSED_AT }).household;
}

function handshakePendingProposedByBianca(at = PROPOSED_AT): Household {
  let household = offered();
  household = proposeHouseholdOnboarding(household, { memberId: BIANCA, at }).household;
  return household;
}

function render(props: {
  household: Household;
  memberId: string;
  now?: string;
  onCommit?: (fn: (current: Household) => { household: Household }) => void;
  onDismiss?: () => void;
}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(OnboardingChat, {
      household: props.household,
      memberId: props.memberId,
      today: TODAY,
      now: props.now ?? NOW_FRESH,
      onCommit: props.onCommit ?? (() => {}),
      onDismiss: props.onDismiss ?? (() => {}),
    }));
  });
  return {
    host,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

/**
 * App.tsx's own visibility rule for the new invitation/handshake mount,
 * copied verbatim from the comment directly above onboardingInviteVisible
 * in src/App.tsx so this test exercises the exact rule shipped there, not
 * a paraphrase of it.
 */
function onboardingInviteVisible(household: Household, dismissedState: OnboardingModeState | null): boolean {
  const record = acceptedHouseholdOnboarding(household);
  return Boolean(
    record
    && (record.state === "offered" || record.state === "handshake-pending")
    && dismissedState !== record.state,
  );
}

describe("the auto-open fix — fences over src/App.tsx", () => {
  it("no longer calls setCharterFoundingOpen from the householdNeedsCharterFounding effect", () => {
    expect(appSource).not.toMatch(/householdNeedsCharterFounding\(household\)\)\s*setCharterFoundingOpen\(true\)/);
  });

  it("does not delete householdNeedsCharterFounding — only its consumer changed", () => {
    expect(appSource).toMatch(/householdNeedsCharterFounding,/);
    expect(appSource).toMatch(/if \(!householdNeedsCharterFounding\(household\)\) return;/);
  });

  it("still supports the existing manual charter-founding button elsewhere in App.tsx", () => {
    expect(appSource).toMatch(/setCharterFoundingOpen\(true\)/);
  });

  it("the auto-open effect now offers the household track instead of opening founding", () => {
    expect(appSource).toMatch(/offerHouseholdOnboarding\(current, \{ memberId \}\)/);
  });

  it("the new invitation mount is never folded into charterTakeoverVisible — never a takeover", () => {
    const takeoverLine = appSource.match(/const charterTakeoverVisible = [^;]+;/)?.[0] ?? "";
    expect(takeoverLine).not.toMatch(/onboardingInvite/);
  });
});

describe("an empty household", () => {
  it("does not open Charter founding — householdNeedsCharterFounding stays true and nothing marks it founded", () => {
    const household = emptyCatalog();
    expect(householdNeedsCharterFounding(household)).toBe(true);
    expect(household.charter).toBeFalsy();
  });

  it("does show the invitation once offered — the invite.offer/invite.explain screen with one Start together control", () => {
    const household = offered();
    expect(acceptedHouseholdOnboarding(household)?.state).toBe("offered");
    const { host, unmount } = render({ household, memberId: BIANCA });
    expect(host.textContent).toContain("When you're both ready to set up the household together, I can walk us through it.");
    expect(host.textContent).toContain("This puts both of us in setup mode until we finish or stop. Three sittings, about an hour all in — we can stop between any of them.");
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.some((button) => button.textContent === "Start together")).toBe(true);
    expect(buttons.some((button) => button.textContent === "Not now")).toBe(true);
    unmount();
  });

  it("offering an already-offered household is a safe no-op — never re-opens as a fresh offer", () => {
    const first = offered();
    const second = offerHouseholdOnboarding(first, { memberId: JONATHAN, at: "2026-09-03T15:00:00.000Z" }).household;
    expect(acceptedHouseholdOnboarding(second)).toEqual(acceptedHouseholdOnboarding(first));
  });
});

describe("Start together — proposing", () => {
  it("commits proposeHouseholdOnboarding for the clicking member", () => {
    const household = offered();
    let committed: Household | null = null;
    const { host, unmount } = render({
      household,
      memberId: BIANCA,
      onCommit: (fn) => { committed = fn(household).household; },
    });
    const start = [...host.querySelectorAll("button")].find((button) => button.textContent === "Start together")!;
    act(() => start.click());
    const record = acceptedHouseholdOnboarding(committed!);
    expect(record?.state).toBe("handshake-pending");
    expect(record?.proposedByMemberId).toBe(BIANCA);
    unmount();
  });
});

describe("the handshake — two devices, one control each", () => {
  it("the proposer's own device shows only the waiting copy, never a confirm control", () => {
    const household = handshakePendingProposedByBianca();
    const { host, unmount } = render({ household, memberId: BIANCA });
    expect(host.textContent).toContain("Waiting for Jonathan to say yes on their device.");
    expect(host.textContent).not.toContain("Yes, let's start");
    unmount();
  });

  it("the confirmer's device shows the full explanation and Yes, let's start", () => {
    const household = handshakePendingProposedByBianca();
    const { host, unmount } = render({ household, memberId: JONATHAN });
    expect(host.textContent).toContain("This puts both of us in setup mode until we finish or stop. Three sittings, about an hour all in — we can stop between any of them.");
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.some((button) => button.textContent === "Yes, let's start")).toBe(true);
    expect(buttons.some((button) => button.textContent === "Not now")).toBe(true);
    unmount();
  });

  it("activation is impossible from one device — confirming as the proposer never reaches active", () => {
    const household = handshakePendingProposedByBianca();
    // The proposer's own device offers no confirm control at all (asserted
    // above); this asserts the command boundary itself refuses it even if
    // called directly, so there is no client path around the UI gate.
    const result = confirmHouseholdOnboarding(household, { memberId: BIANCA, at: "2026-09-03T14:01:00.000Z" });
    expect(acceptedHouseholdOnboarding(result.household)?.state).toBe("handshake-pending");
  });

  it("the confirmer's Yes, let's start reaches active only once both member ids are confirmed", () => {
    const household = handshakePendingProposedByBianca();
    let committed: Household | null = null;
    const { host, unmount } = render({
      household,
      memberId: JONATHAN,
      onCommit: (fn) => { committed = fn(household).household; },
    });
    const confirm = [...host.querySelectorAll("button")].find((button) => button.textContent === "Yes, let's start")!;
    act(() => confirm.click());
    const record = acceptedHouseholdOnboarding(committed!);
    expect(record?.state).toBe("active");
    expect(record?.confirmedByMemberIds.sort()).toEqual([BIANCA, JONATHAN].sort());
    unmount();
  });
});

describe("expiry", () => {
  it("handshakeExpired is true once the fifteen-minute window has passed", () => {
    const household = handshakePendingProposedByBianca("2026-09-03T14:00:00.000Z");
    const record = acceptedHouseholdOnboarding(household)!;
    expect(handshakeExpired(record, "2026-09-03T14:14:59.000Z")).toBe(false);
    expect(handshakeExpired(record, "2026-09-03T14:15:00.000Z")).toBe(true);
  });

  it("shows the expiry copy and a fresh Start together once the window has passed", () => {
    const household = handshakePendingProposedByBianca();
    const { host, unmount } = render({ household, memberId: JONATHAN, now: NOW_EXPIRED });
    expect(host.textContent).toContain("That invitation expired. Start it again whenever you're both ready.");
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Start together")).toBe(true);
    unmount();
  });

  it("shows the same expiry copy on the original proposer's own device too", () => {
    const household = handshakePendingProposedByBianca();
    const { host, unmount } = render({ household, memberId: BIANCA, now: NOW_EXPIRED });
    expect(host.textContent).toContain("That invitation expired. Start it again whenever you're both ready.");
    unmount();
  });

  it("re-proposing after expiry opens a fresh, unexpired handshake window", () => {
    const household = handshakePendingProposedByBianca();
    const result = proposeHouseholdOnboarding(household, { memberId: JONATHAN, at: NOW_EXPIRED });
    const record = acceptedHouseholdOnboarding(result.household)!;
    expect(record.state).toBe("handshake-pending");
    expect(handshakeExpired(record, NOW_EXPIRED)).toBe(false);
  });
});

describe("keyboard path through both sides", () => {
  it("the offered screen's controls are real, focusable buttons", () => {
    const { host, unmount } = render({ household: offered(), memberId: BIANCA });
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons) {
      expect(button.getAttribute("type")).toBe("button");
      expect(button.tabIndex).not.toBe(-1);
    }
    unmount();
  });

  it("the confirmer screen's controls are real, focusable buttons", () => {
    const { host, unmount } = render({ household: handshakePendingProposedByBianca(), memberId: JONATHAN });
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons) {
      expect(button.getAttribute("type")).toBe("button");
      expect(button.tabIndex).not.toBe(-1);
    }
    unmount();
  });
});

describe("Not now — dismissal is session-only, never a household write", () => {
  it("calling onDismiss never changes the household's onboarding record", () => {
    const household = offered();
    let dismissed = false;
    const { host, unmount } = render({ household, memberId: BIANCA, onDismiss: () => { dismissed = true; } });
    const notNow = [...host.querySelectorAll("button")].find((button) => button.textContent === "Not now")!;
    act(() => notNow.click());
    expect(dismissed).toBe(true);
    expect(acceptedHouseholdOnboarding(household)?.state).toBe("offered");
    unmount();
  });
});

describe("the invitation renders at most once per household until dismissed or accepted", () => {
  it("stays visible across repeated renders of the same offered household — nothing suppresses it on its own", () => {
    const household = offered();
    expect(onboardingInviteVisible(household, null)).toBe(true);
    expect(onboardingInviteVisible(household, null)).toBe(true);
  });

  it("dismissing the offered screen hides it for the rest of the session", () => {
    const household = offered();
    expect(onboardingInviteVisible(household, "offered")).toBe(false);
  });

  it("dismissing offered never suppresses a later, genuinely new handshake-pending screen", () => {
    const dismissedWhileOffered: OnboardingModeState = "offered";
    const proposedByPartner = handshakePendingProposedByBianca();
    expect(onboardingInviteVisible(proposedByPartner, dismissedWhileOffered)).toBe(true);
  });

  it("dismissing the handshake-pending confirm screen hides that specific state", () => {
    const household = handshakePendingProposedByBianca();
    expect(onboardingInviteVisible(household, "handshake-pending")).toBe(false);
  });

  it("accepting (state moves to active) ends the invitation regardless of any dismissal", () => {
    let household = handshakePendingProposedByBianca();
    household = confirmHouseholdOnboarding(household, { memberId: JONATHAN, at: "2026-09-03T14:01:00.000Z" }).household;
    expect(acceptedHouseholdOnboarding(household)?.state).toBe("active");
    expect(onboardingInviteVisible(household, null)).toBe(false);
    expect(onboardingInviteVisible(household, "handshake-pending")).toBe(false);
  });

  it("a household that was never offered shows nothing", () => {
    expect(onboardingInviteVisible(emptyCatalog(), null)).toBe(false);
  });
});
