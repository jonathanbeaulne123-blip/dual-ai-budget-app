// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approveOnboardingReady,
  catalogHousehold,
  emptyMemberOnboardingProgress,
  onboardingCompletionDigest,
  type Household,
} from "../src/core/index.ts";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import { OnboardingReady } from "../src/OnboardingReady.tsx";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-05" as const;
const AT = "2026-09-05T14:00:00.000Z";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function readyHousehold(readyAcknowledged = false): Household {
  const household = catalogHousehold("development");
  household.transactions = [];
  household.commandReceipts = [];
  household.householdOnboarding = {
    id: `ONBOARDING-${household.environment}-${household.householdId}`,
    environment: household.environment,
    householdId: household.householdId,
    registryVersion: 1,
    state: "active",
    proposedByMemberId: BIANCA,
    proposedAt: "2026-09-05T13:45:00.000Z",
    handshakeExpiresAt: AT,
    confirmedByMemberIds: [BIANCA, JONATHAN],
    startedAt: AT,
    stoppedAt: null,
    stoppedByMemberIds: [],
    stoppedSolo: false,
    forcedUnlock: false,
    completedAt: null,
    completionDigest: null,
    createdAt: "2026-09-05T13:45:00.000Z",
    updatedAt: AT,
  };
  const progress = emptyMemberOnboardingProgress({
    environment: household.environment,
    householdId: household.householdId,
    memberId: BIANCA,
  });
  progress.rows = progress.rows.map((row) => ({
    ...row,
    acknowledgedAt: row.chapterId === "ch-12-ready" && !readyAcknowledged ? null : AT,
    lastSafeResumePoint: row.chapterId === "ch-12-ready" && !readyAcknowledged ? "ch-11-plan" : row.chapterId,
  }));
  progress.updatedAt = AT;
  household.members = household.members.map((member) => member.id === BIANCA
    ? { ...member, onboardingProgress: progress }
    : { ...member, onboardingProgress: undefined });
  return household;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("OnboardingReady", () => {
  it("renders the soft two-step Practice fallback, Books and Health truth, and the live gate checklist", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingReady, {
      household: readyHousehold(),
      memberId: BIANCA,
      today: TODAY,
      onCommit: async () => null,
      onDismiss: vi.fn(),
    })));
    expect(host.textContent).toContain("Try it safely in Practice");
    expect(host.textContent).toContain("never touches your books, reports, streak, or Health");
    expect(host.textContent).toContain("Trial and equation agree");
    expect(host.textContent).toContain("No integrity findings");
    expect(host.textContent).toContain("Tomorrow's proof");
    const add = [...host.querySelectorAll("button")].find((button) => button.textContent === "Add pretend $45 grocery")!;
    act(() => add.click());
    expect(host.textContent).toContain("Correct the pretend entry");
    act(() => root.unmount());
  });

  it("routes the Chapter 12 shell to the dedicated Books finale", () => {
    const onOpenReady = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingChat, {
      household: readyHousehold(),
      memberId: BIANCA,
      today: TODAY,
      onCommit: vi.fn(),
      onDismiss: vi.fn(),
      onOpenReady,
    })));
    expect(host.textContent).toContain("Let's prove one ordinary entry will be easy tomorrow");
    const open = [...host.querySelectorAll("button")].find((button) => button.textContent === "Open Books")!;
    act(() => open.click());
    expect(onOpenReady).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it("states the ongoing-input truth and personal-track offer after unlock", () => {
    let household = readyHousehold(true);
    const digest = onboardingCompletionDigest(household);
    household = approveOnboardingReady(household, { memberId: BIANCA, createdBy: BIANCA, digest }).household;
    household.onboardingApprovals!.push({
      id: "ONB-APP-OTHER",
      householdId: household.householdId,
      memberId: JONATHAN,
      scope: "ready",
      digest,
      approvedAt: AT,
    });
    household.householdOnboarding = {
      ...household.householdOnboarding!,
      state: "complete",
      completedAt: AT,
      completionDigest: digest,
      updatedAt: AT,
    };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingReady, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onCommit: async () => null,
      onDismiss: vi.fn(),
    })));
    expect(host.textContent).toContain("Hercules is back to normal");
    expect(host.textContent).toContain("the odd receipt, the odd shift");
    expect(host.textContent).toContain("Whenever you want, I can show you the rest");
    expect(host.textContent).toContain("Open ordinary Books");
    act(() => root.unmount());
  });

  it("keeps Practice available offline but waits to record Ready", () => {
    const household = readyHousehold();
    household.sharing = { ...household.sharing, mode: "disconnected" };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingReady, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onCommit: async () => null,
      onDismiss: vi.fn(),
    })));
    expect(host.textContent).toContain("Practice still works here");
    expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Add pretend $45 grocery")?.disabled).toBe(false);
    act(() => root.unmount());
  });
});
