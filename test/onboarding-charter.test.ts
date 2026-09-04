// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CharterFounding } from "../src/CharterFounding.tsx";
import { OnboardingChat, onboardingCharterPresentation } from "../src/OnboardingChat.tsx";
import {
  catalogHousehold,
  confirmHouseholdOnboarding,
  evidenceCardLabel,
  evidenceFor,
  evidenceProvenanceLabel,
  foundHouseholdCharter,
  mergeShared,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  signHouseholdCharter,
  splitForSync,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-04";
const TERMS_AT = "2026-09-04T14:00:00.000Z";

function active(): Household {
  let household = proposeHouseholdOnboarding(catalogHousehold("development"), {
    memberId: BIANCA,
    at: "2026-09-04T13:00:00.000Z",
  }).household;
  household = confirmHouseholdOnboarding(household, {
    memberId: JONATHAN,
    at: "2026-09-04T13:01:00.000Z",
  }).household;
  return household;
}

function observe(household: Household, memberId: string) {
  return recordObservedChapterCompletion(household, {
    memberId,
    chapterId: "ch-02-household",
    createdBy: memberId,
    observation: {
      kind: "resolved" as const,
      scope: { environment: household.environment, householdId: household.householdId, memberId },
      currentMemberId: memberId,
      seatMemberIds: [BIANCA, JONATHAN],
      observedAt: "2026-09-04T13:03:00.000Z",
    },
  }).household;
}

function throughChapterTwo(): Household {
  let household = active();
  household = recordChapterAcknowledgement(household, {
    memberId: BIANCA, chapterId: "ch-01-meet", createdBy: BIANCA, at: "2026-09-04T13:02:00.000Z",
  }).household;
  household = recordChapterAcknowledgement(household, {
    memberId: JONATHAN, chapterId: "ch-01-meet", createdBy: JONATHAN, at: "2026-09-04T13:02:30.000Z",
  }).household;
  household = observe(household, BIANCA);
  household = observe(household, JONATHAN);
  return household;
}

function withCharter(signatures: Array<{ memberId: string; signedAt: string | null }> = [
  { memberId: BIANCA, signedAt: null },
  { memberId: JONATHAN, signedAt: null },
]): Household {
  let household = foundHouseholdCharter(throughChapterTwo(), {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep a shared home and protect both people's time.",
    splitRule: "remainder",
    splitNote: "Bianca covers what she can; Jonathan closes the rest.",
    ceilingKind: "hours-per-week",
    ceilingValue: "24",
    cadence: "weekly",
    cadenceWeekday: 0,
    date: TODAY,
  }).household;
  household = {
    ...household,
    charter: {
      ...household.charter!,
      createdAt: TERMS_AT,
      termsUpdatedAt: TERMS_AT,
      updatedAt: TERMS_AT,
      signatures,
    },
  };
  return household;
}

function renderChat(household: Household, memberId: string, onOpenCharter = () => {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(OnboardingChat, {
      household,
      memberId,
      today: TODAY,
      onCommit: () => {},
      onDismiss: () => {},
      onOpenCharter,
    }));
  });
  return {
    host,
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe("Chapter 3 Charter evidence and consent", () => {
  it("stays pending for no record, unsigned, and one signature, then cites both current lines", () => {
    const missing = throughChapterTwo();
    expect(evidenceFor(missing, "ch-03-charter", BIANCA)).toEqual({ kind: "empty" });
    expect(onboardingCharterPresentation(missing, BIANCA, { kind: "empty" })).toMatchObject({
      kind: "write", copyKey: "charter.write",
    });

    const unsigned = withCharter();
    expect(evidenceFor(unsigned, "ch-03-charter", BIANCA)).toEqual({ kind: "empty" });
    expect(onboardingCharterPresentation(unsigned, BIANCA, { kind: "empty" })).toMatchObject({
      kind: "open", copyKey: "charter.open",
    });

    const oneSigned = withCharter([
      { memberId: BIANCA, signedAt: "2026-09-04T14:05:00.000Z" },
      { memberId: JONATHAN, signedAt: null },
    ]);
    expect(evidenceFor(oneSigned, "ch-03-charter", BIANCA)).toEqual({ kind: "empty" });
    expect(onboardingCharterPresentation(oneSigned, BIANCA, { kind: "empty" })).toMatchObject({ kind: "waiting" });
    expect(onboardingCharterPresentation(oneSigned, JONATHAN, { kind: "empty" })).toMatchObject({
      kind: "open", copyKey: "charter.open",
    });

    const signed = withCharter([
      { memberId: BIANCA, signedAt: "2026-09-04T14:05:00.000Z" },
      { memberId: JONATHAN, signedAt: "2026-09-04T14:06:00.000Z" },
    ]);
    const evidence = evidenceFor(signed, "ch-03-charter", BIANCA);
    expect(evidence.kind).toBe("accepted");
    if (evidence.kind !== "accepted") throw new Error("expected accepted Charter evidence");
    expect(evidenceCardLabel(evidence.card.kind)).toBe("The charter");
    expect(evidenceProvenanceLabel(evidence.card.kind)).toBe("From the charter record.");
    expect(evidence.card.lines).toEqual([
      { label: "Purpose", value: "Keep a shared home and protect both people's time." },
      { label: "Custodian", value: "Bianca" },
      { label: "Split", value: "One of us covers what's left" },
      { label: "In your words", value: "Bianca covers what she can; Jonathan closes the rest." },
      { label: "Ceiling", value: "24 hours a week" },
      { label: "Cadence", value: "Every Sunday." },
      { label: "Bianca signed", value: "4 Sept 2026" },
      { label: "Jonathan signed", value: "4 Sept 2026" },
    ]);

    const withInactiveHistory = structuredClone(signed);
    withInactiveHistory.members.push({
      ...withInactiveHistory.members[0]!,
      id: "MEM-OLD",
      name: "Former member",
      active: false,
    });
    withInactiveHistory.charter!.signatures.push({ memberId: "MEM-OLD", signedAt: null });
    expect(evidenceFor(withInactiveHistory, "ch-03-charter", BIANCA).kind).toBe("accepted");
  });

  it("cannot acknowledge from navigation or chat state before both current signatures", () => {
    const unsigned = withCharter();
    expect(() => recordChapterAcknowledgement(unsigned, {
      memberId: BIANCA, chapterId: "ch-03-charter", createdBy: BIANCA,
    })).toThrow("Both people need to sign the current Charter");

    const signed = withCharter([
      { memberId: BIANCA, signedAt: "2026-09-04T14:05:00.000Z" },
      { memberId: JONATHAN, signedAt: "2026-09-04T14:06:00.000Z" },
    ]);
    expect(() => recordChapterAcknowledgement(signed, {
      memberId: BIANCA, chapterId: "ch-03-charter", createdBy: BIANCA,
    })).not.toThrow();
  });

  it("treats amended terms as stale, permits only an own-line re-sign, and converges with an old replica", () => {
    const amended = withCharter([
      { memberId: BIANCA, signedAt: "2026-09-04T14:05:00.000Z" },
      { memberId: JONATHAN, signedAt: "2026-09-04T14:06:00.000Z" },
    ]);
    amended.charter = {
      ...amended.charter!,
      purpose: "Keep a shared home and leave room to change course.",
      termsUpdatedAt: "2026-09-04T15:00:00.000Z",
      updatedAt: "2026-09-04T15:00:00.000Z",
    };
    const staleEvidence = evidenceFor(amended, "ch-03-charter", BIANCA);
    expect(staleEvidence).toEqual({ kind: "ineligible", reason: "stale" });
    expect(onboardingCharterPresentation(amended, BIANCA, staleEvidence)).toMatchObject({
      kind: "review", copyKey: "charter.review-sign",
    });

    const resigned = signHouseholdCharter(amended, {
      memberId: BIANCA,
      at: "2026-09-04T15:05:00.000Z",
    }).household;
    expect(resigned.charter?.signatures.find((row) => row.memberId === BIANCA)?.signedAt)
      .toBe("2026-09-04T15:05:00.000Z");
    expect(() => signHouseholdCharter(resigned, {
      memberId: BIANCA,
      at: "2026-09-04T15:06:00.000Z",
    })).toThrow("already signed for the current terms");

    const staleReplica = structuredClone(amended);
    const left = splitForSync(resigned, BIANCA).shared;
    const right = splitForSync(staleReplica, JONATHAN).shared;
    const forward = mergeShared(left, right);
    const reverse = mergeShared(right, left);
    expect(forward.charter?.signatures.find((row) => row.memberId === BIANCA)?.signedAt)
      .toBe("2026-09-04T15:05:00.000Z");
    expect(reverse.charter).toEqual(forward.charter);
  });

  it("never mistakes a later offline signature on old wording for consent to the winning amendment", () => {
    const oldTerms = withCharter([
      { memberId: BIANCA, signedAt: "2026-09-04T15:05:00.000Z" },
      { memberId: JONATHAN, signedAt: null },
    ]);
    const amended = structuredClone(oldTerms);
    amended.charter = {
      ...amended.charter!,
      purpose: "Keep a shared home and leave room to change course.",
      termsUpdatedAt: "2026-09-04T15:00:00.000Z",
      updatedAt: "2026-09-04T15:00:00.000Z",
      signatures: [
        { memberId: BIANCA, signedAt: "2026-09-04T14:05:00.000Z" },
        { memberId: JONATHAN, signedAt: null },
      ],
    };

    const merged = mergeShared(
      splitForSync(oldTerms, BIANCA).shared,
      splitForSync(amended, JONATHAN).shared,
    );
    expect(merged.charter?.purpose).toBe("Keep a shared home and leave room to change course.");
    expect(merged.charter?.signatures.find((row) => row.memberId === BIANCA)?.signedAt)
      .toBe("2026-09-04T14:05:00.000Z");
  });
});

describe("Chapter 3 route and focused UX", () => {
  it("visiting the existing founding route without signing leaves the chapter pending", async () => {
    localStorage.clear();
    const starting = throughChapterTwo();
    let current = starting;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    function Harness() {
      const [household, setHousehold] = useState(starting);
      current = household;
      return createElement(CharterFounding, {
        household,
        memberId: BIANCA,
        today: TODAY,
        onCommit: (fn) => setHousehold((value) => fn(value).household),
        onDismiss: () => {},
      });
    }

    await act(async () => root.render(createElement(Harness)));
    for (let step = 0; step < 5; step += 1) {
      const skip = host.querySelector<HTMLButtonElement>(".footrow .link");
      expect(skip).not.toBeNull();
      await act(async () => skip!.click());
    }
    expect(current.charter).not.toBeNull();
    expect(host.textContent).toContain("Sign it");
    expect(evidenceFor(current, "ch-03-charter", BIANCA)).toEqual({ kind: "empty" });
    expect(() => recordChapterAcknowledgement(current, {
      memberId: BIANCA, chapterId: "ch-03-charter", createdBy: BIANCA,
    })).toThrow("Both people need to sign the current Charter");

    act(() => root.unmount());
    host.remove();
  });

  it("uses specific Charter actions, hides generic Next, and waits without nudging the partner", () => {
    let opened = 0;
    const missing = renderChat(throughChapterTwo(), BIANCA, () => { opened += 1; });
    expect(missing.host.textContent).toContain("Write the Charter");
    expect(missing.host.textContent).not.toContain("Next");
    act(() => missing.host.querySelector<HTMLButtonElement>(".onboarding-actions button")!.click());
    expect(opened).toBe(1);
    missing.unmount();

    const oneSigned = withCharter([
      { memberId: BIANCA, signedAt: "2026-09-04T14:05:00.000Z" },
      { memberId: JONATHAN, signedAt: null },
    ]);
    const waiting = renderChat(oneSigned, BIANCA);
    expect(waiting.host.textContent).toContain("Waiting on Jonathan. Nothing's lost");
    expect(waiting.host.textContent).not.toMatch(/open the charter|next|remind|nudge/i);
    waiting.unmount();

    const other = renderChat(oneSigned, JONATHAN);
    expect(other.host.textContent).toContain("Open the Charter");
    expect(other.host.textContent).not.toContain("Next");
    other.unmount();
  });
});
