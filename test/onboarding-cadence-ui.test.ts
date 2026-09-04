// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptedHouseholdOnboarding,
  catalogHousehold,
  emptyMemberOnboardingProgress,
  type Household,
  type WorkPaySchedule,
} from "../src/core/index.ts";
import { EarningCadenceCard } from "../src/WorkJobs.tsx";
import { OnboardingChat } from "../src/OnboardingChat.tsx";

const BIANCA = "MEM-001";
const TODAY = "2026-09-04";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function click(node: Element) {
  act(() => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function activeThroughChapterSeven(): Household {
  const household = catalogHousehold("development");
  const at = "2026-09-04T14:00:00.000Z";
  household.householdOnboarding = {
    id: `ONBOARDING-development-${household.householdId}-v1`,
    environment: "development",
    householdId: household.householdId,
    registryVersion: 1,
    state: "active",
    proposedByMemberId: BIANCA,
    proposedAt: at,
    handshakeExpiresAt: "2026-09-04T14:15:00.000Z",
    confirmedByMemberIds: [BIANCA, "MEM-002"],
    stoppedByMemberIds: [],
    stoppedAt: null,
    stoppedSolo: false,
    forcedUnlock: false,
    startedAt: at,
    completedAt: null,
    completionDigest: null,
    createdAt: at,
    updatedAt: at,
  };
  const progress = emptyMemberOnboardingProgress({
    environment: "development",
    householdId: household.householdId,
    memberId: BIANCA,
  });
  progress.rows = progress.rows.map((row) => row.chapterId <= "ch-07-recurrences"
    ? { ...row, acknowledgedAt: at, lastSafeResumePoint: row.chapterId }
    : row);
  progress.updatedAt = at;
  household.members = household.members.map((member) => member.id === BIANCA
    ? { ...member, onboardingProgress: progress }
    : member);
  expect(acceptedHouseholdOnboarding(household)?.state).toBe("active");
  return household;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Chapter 8 earning cadence UI", () => {
  it("offers a soft five-choice timing question and saves irregular without asking for money or job detail", () => {
    const household = catalogHousehold("development");
    const onSave = vi.fn<(schedule: WorkPaySchedule) => void>();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(EarningCadenceCard, {
      household,
      memberId: BIANCA,
      today: TODAY,
      busy: false,
      onSave,
    })));

    const choices = [...host.querySelectorAll<HTMLButtonElement>(".work-cadence-choice")];
    expect(choices).toHaveLength(5);
    const irregular = choices.find((button) => button.textContent?.includes("No fixed rhythm"));
    expect(irregular).toBeTruthy();
    click(irregular!);
    expect(irregular!.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('input[type="date"]')).toBeNull();
    expect(host.textContent).toContain("Bianca doesn't have a fixed payday.");
    expect(host.textContent).not.toMatch(/hourly|salary|contribution amount|how much do you earn/i);

    const save = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("Save my earning rhythm"));
    click(save!);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].cadence).toBe("irregular");
    act(() => root.unmount());
  });

  it("routes the self-owned chapter to the existing Shift surface and withholds Next until evidence exists", () => {
    const household = activeThroughChapterSeven();
    const onOpenEarningCadence = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(createElement(OnboardingChat, {
      household,
      memberId: BIANCA,
      today: TODAY,
      onCommit: vi.fn(),
      onDismiss: vi.fn(),
      onOpenEarningCadence,
    })));

    expect(host.textContent).toContain("Set my earning rhythm");
    expect(host.textContent).not.toContain("Next");
    const open = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("Set my earning rhythm"));
    click(open!);
    expect(onOpenEarningCadence).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("keeps the new responsive styles token-only with visible selected and reduced-motion states", () => {
    const source = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const start = source.indexOf(".work-cadence-card");
    const end = source.indexOf(".row {", start);
    const block = source.slice(start, end);
    expect(block).toContain("@media (max-width: 390px)");
    expect(block).toContain("@media (prefers-reduced-motion: reduce)");
    expect(block).toContain(".work-cadence-choice.is-selected");
    expect(block).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(block).toContain("min-height: 48px");
  });
});
