// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import { OnboardingWitness, noticedEvidenceKey } from "../src/OnboardingWitness.tsx";
import {
  SHELL_VIEW,
  addAccount,
  catalogHousehold,
  chapterById,
  confirmHouseholdOnboarding,
  evidenceFor,
  foundHouseholdCharter,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  recordObservedChapterCompletion,
  signHouseholdCharter,
  witnessStatusRows,
  witnessEvidenceFor,
  type EvidenceCard,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-03";

const componentSource = readFileSync(join(process.cwd(), "src/OnboardingWitness.tsx"), "utf8");
const shellComponentSource = readFileSync(join(process.cwd(), "src/OnboardingChat.tsx"), "utf8");
const cssSource = readFileSync(join(process.cwd(), "src/onboarding.css"), "utf8");

function proposedActive(): Household {
  let household = proposeHouseholdOnboarding(catalogHousehold("development"), { memberId: BIANCA, at: "2026-09-03T14:00:00.000Z" }).household;
  household = confirmHouseholdOnboarding(household, { memberId: JONATHAN, at: "2026-09-03T14:01:00.000Z" }).household;
  return household;
}

function acknowledgeBoth(household: Household, chapterId: string): Household {
  if (chapterId === "ch-02-household") {
    const observation = (memberId: string) => ({
      kind: "resolved" as const,
      scope: { environment: household.environment, householdId: household.householdId, memberId },
      currentMemberId: memberId,
      seatMemberIds: [BIANCA, JONATHAN],
      observedAt: "2026-09-03T14:02:00.000Z",
    });
    let next = recordObservedChapterCompletion(household, {
      memberId: BIANCA, chapterId, createdBy: BIANCA, observation: observation(BIANCA),
    }).household;
    next = recordObservedChapterCompletion(next, {
      memberId: JONATHAN, chapterId, createdBy: JONATHAN, observation: observation(JONATHAN),
    }).household;
    return next;
  }
  let next = recordChapterAcknowledgement(household, { memberId: BIANCA, chapterId, createdBy: BIANCA }).household;
  next = recordChapterAcknowledgement(next, { memberId: JONATHAN, chapterId, createdBy: JONATHAN }).household;
  return next;
}

/** Charter founded and signed, ch-01/02/03 acknowledged — lands on ch-04-accounts, a "partner" chapter: Bianca (the fund/charter custodian) conducts, Jonathan witnesses. */
function throughSittingOne(): Household {
  let household = proposedActive();
  household = acknowledgeBoth(household, "ch-01-meet");
  household = acknowledgeBoth(household, "ch-02-household");
  household = foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Roof and groceries.",
    splitRule: "remainder",
    splitNote: "Bianca covers what she can, Jonathan closes the rest.",
    ceilingKind: "none",
    cadence: "weekly",
    cadenceWeekday: 0,
    date: TODAY,
  }).household;
  household = signHouseholdCharter(household, { memberId: BIANCA }).household;
  household = signHouseholdCharter(household, { memberId: JONATHAN }).household;
  household = acknowledgeBoth(household, "ch-03-charter");
  return household;
}

function render(props: {
  household: Household;
  memberId: string;
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
      onCommit: props.onCommit ?? (() => {}),
      onDismiss: props.onDismiss ?? (() => {}),
    }));
  });
  return {
    host,
    root,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function card(overrides: Partial<EvidenceCard> = {}): EvidenceCard {
  return {
    chapterId: "ch-04-accounts",
    scope: "household",
    kind: "account",
    sourceIds: ["ACC-CHEQUING"],
    lines: [{ label: "Fund card", value: "Everyday chequing" }],
    observedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderWitness(props: Partial<Parameters<typeof OnboardingWitness>[0]> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const base = {
    turnLine: "Bianca is doing this one — you don't need to type anything.",
    hercLine: "Some Hercules line.",
    chapter: chapterById("ch-04-accounts")!,
    evidence: { kind: "empty" as const },
    blockedCopyKey: null,
    noticeKey: null,
  };
  act(() => {
    root.render(createElement(StrictMode, null, createElement(OnboardingWitness, { ...base, ...props })));
  });
  return {
    host,
    rerender: (next: Partial<Parameters<typeof OnboardingWitness>[0]>) => {
      act(() => {
        root.render(createElement(StrictMode, null, createElement(OnboardingWitness, { ...base, ...props, ...next })));
      });
    },
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe("noticedEvidenceKey", () => {
  it("is stable for the same evidence content, regardless of object identity", () => {
    const left = card();
    const right = card(); // a distinct object, identical content
    expect(noticedEvidenceKey(left)).toBe(noticedEvidenceKey(right));
  });

  it("is order-independent over sourceIds — arrival order isn't identity", () => {
    const left = card({ sourceIds: ["ACC-A", "ACC-B"] });
    const right = card({ sourceIds: ["ACC-B", "ACC-A"] });
    expect(noticedEvidenceKey(left)).toBe(noticedEvidenceKey(right));
  });

  it("changes when the chapter, the sources, or the observed time genuinely differ", () => {
    const base = card();
    expect(noticedEvidenceKey(card({ chapterId: "ch-06-fund" }))).not.toBe(noticedEvidenceKey(base));
    expect(noticedEvidenceKey(card({ sourceIds: ["ACC-OTHER"] }))).not.toBe(noticedEvidenceKey(base));
    expect(noticedEvidenceKey(card({ observedAt: "2026-09-02T00:00:00.000Z" }))).not.toBe(noticedEvidenceKey(base));
  });
});

describe("witnessStatusRows", () => {
  it("keeps duplicate account names on distinct stable source identities", () => {
    const rows = witnessStatusRows("ch-04-accounts", card({
      sourceIds: ["ACC-A", "ACC-B"],
      lines: [
        { label: "Fund card", value: "Savings" },
        { label: "Savings", value: "chequing" },
        { label: "Savings", value: "savings" },
      ],
    }));
    expect(rows.map((row) => row.label)).toEqual(["Household card", "Savings", "Savings"]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(rows.map((row) => row.id)).toEqual([
      "household-card:ACC-A:ACC-B",
      "account:ACC-A",
      "account:ACC-B",
    ]);
  });
});

describe("OnboardingWitness — rendering", () => {
  it("names the conductor in the turn line and shows a plain status word, never an action row", () => {
    const { host, unmount } = renderWitness({ turnLine: "Bianca is doing this one — you don't need to type anything." });
    expect(host.textContent).toContain("Bianca is doing this one — you don't need to type anything.");
    expect(host.textContent).toContain("Waiting");
    expect(host.textContent).toContain("Accountswaiting");
    expect(host.textContent).toContain("Shared accounts only.");
    expect(host.textContent).not.toContain("onboarding.household.ch-04-accounts");
    expect(host.querySelector("button")).toBeNull();
    unmount();
  });

  it("shows the noticed strip as a polite live region once evidence is accepted, with its provenance", () => {
    const { host, unmount } = renderWitness({
      evidence: { kind: "accepted", card: card() },
      noticeKey: "test:accepted-card",
    });
    const status = host.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.getAttribute("aria-live")).toBe("polite");
    expect(status!.textContent).toBe("Looks like you already handled this.");
    expect(host.textContent).toContain("Household cardopened");
    expect(host.textContent).toContain("Shared accounts only.");
    expect(host.textContent).not.toContain("Everyday chequing");
    unmount();
  });

  it("projects logical status rows and stable scope for every partner-conducted chapter", () => {
    const scenarios = [
      {
        chapterId: "ch-05-opening",
        evidence: card({
          chapterId: "ch-05-opening",
          kind: "receipt",
          lines: [
            { label: "Civil date", value: "2026-09-01" },
            { label: "Opening equity", value: "$1,000.00" },
          ],
        }),
        row: "Opening balancessubmitted",
        scope: "Shared · opening entries",
        omitted: "Civil date",
      },
      {
        chapterId: "ch-06-fund",
        evidence: card({
          chapterId: "ch-06-fund",
          kind: "configuration",
          lines: [
            { label: "Opened", value: "2026-09-01" },
            { label: "Custodian", value: "Bianca" },
          ],
        }),
        row: "Household Fundopened",
        scope: "Shared · Fund setup",
        omitted: "Custodian",
      },
      {
        chapterId: "ch-07-recurrences",
        evidence: card({
          chapterId: "ch-07-recurrences",
          kind: "recurrence",
          lines: [{ label: "Rent", value: "monthly · $1,200.00" }],
        }),
        row: "Regular moneysubmitted",
        scope: "Shared · recurring bills",
        omitted: "Rent",
      },
    ] as const;

    for (const scenario of scenarios) {
      const { host, unmount } = renderWitness({
        chapter: chapterById(scenario.chapterId)!,
        evidence: { kind: "accepted", card: scenario.evidence },
        noticeKey: `test:chapter-status:${scenario.chapterId}`,
      });
      expect(host.textContent).toContain(scenario.row);
      expect(host.textContent).toContain(scenario.scope);
      expect(host.textContent).not.toContain(scenario.omitted);
      unmount();
    }
  });

  it("shows the blocked card, not the noticed strip or the plain task, when evidence is ineligible", () => {
    const { host, unmount } = renderWitness({ evidence: { kind: "ineligible", reason: "stale" }, blockedCopyKey: "blocked.stale" });
    expect(host.textContent).toContain("Held up");
    expect(host.querySelector('[role="status"]')).toBeNull();
    unmount();
  });

  it("focuses the Hercules line once on mount, and never steals focus back on a later update", () => {
    const { host, rerender, unmount } = renderWitness({});
    const heading = host.querySelector(".onboarding-herc") as HTMLElement;
    expect(document.activeElement).toBe(heading);
    // A witness can still tab elsewhere on the page (the shared shell's stop
    // link, in the real app) — an update to this screen must never pull
    // focus back to the heading once the witness has moved on.
    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);
    rerender({ evidence: { kind: "accepted", card: card() }, noticeKey: "test:focus-update" });
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
    unmount();
  });

  it("does not re-announce the same accepted event across an unrelated re-render", () => {
    const { host, rerender, unmount } = renderWitness({
      evidence: { kind: "accepted", card: card() },
      noticeKey: "test:same-event",
    });
    const first = host.querySelector('[role="status"]');
    expect(first).not.toBeNull();
    // Same event, a freshly-built (but content-identical) card object — the
    // kind of re-render an unrelated household re-fetch produces.
    rerender({
      hercLine: "A different flavor line, same chapter.",
      evidence: { kind: "accepted", card: card() },
      noticeKey: "test:same-event",
    });
    const second = host.querySelector('[role="status"]');
    expect(second).toBe(first); // same DOM node — nothing was re-mounted, so nothing re-announces
    unmount();
  });

  it("does remount, and so does re-announce, when the accepted event genuinely changes", () => {
    const { host, rerender, unmount } = renderWitness({
      evidence: { kind: "accepted", card: card() },
      noticeKey: "test:first-event",
    });
    const first = host.querySelector('[role="status"]');
    rerender({
      evidence: { kind: "accepted", card: card({ observedAt: "2026-09-05T00:00:00.000Z" }) },
      noticeKey: "test:second-event",
    });
    const second = host.querySelector('[role="status"]');
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    unmount();
  });

  it("does not re-announce the same probe after the witness surface is closed and reopened", () => {
    const first = renderWitness({
      evidence: { kind: "accepted", card: card() },
      noticeKey: "test:reopen-event",
    });
    expect(first.host.querySelector('[role="status"]')).not.toBeNull();
    first.unmount();

    const reopened = renderWitness({
      evidence: { kind: "accepted", card: card() },
      noticeKey: "test:reopen-event",
    });
    expect(reopened.host.querySelector('[role="status"]')).toBeNull();
    expect(reopened.host.textContent).toContain("Shared accounts only.");
    reopened.unmount();
  });
});

describe("the witness surface, inside the shell", () => {
  it("witnesses a partner chapter with the custodian's name, no action row, and household-scoped evidence only — never the viewer's own self-personal fact", () => {
    let household = throughSittingOne();
    // Jonathan opens a personal account of his own. accountsEvidence()
    // resolves ch-04's projection for *whoever is asking* — here, Jonathan
    // himself — so this is the one fixture that can make evidenceFor() and
    // witnessEvidenceFor() actually diverge for the same viewer: the
    // conductor-style resolver falls back to a viewer's own self-personal
    // evidence when no household card is ready yet, and witnessOnly must
    // refuse that fallback.
    household = addAccount(household, {
      name: "Jonathan's side cash",
      kind: "chequing",
      ownerMemberId: JONATHAN,
      scope: "personal",
    }).household;

    // Confirm the fixture is meaningful: the conductor-style resolver really
    // would surface it, so witnessEvidenceFor refusing it below is a real
    // guard, not a vacuous pass.
    const conductorStyle = evidenceFor(household, "ch-04-accounts", JONATHAN);
    expect(conductorStyle.kind).toBe("accepted");
    expect(conductorStyle.kind === "accepted" && conductorStyle.card.lines.some((line) => line.label.includes("Jonathan's side cash"))).toBe(true);

    const witnessStyle = witnessEvidenceFor(household, "ch-04-accounts", JONATHAN);
    expect(witnessStyle.kind).toBe("empty");

    const { host, unmount } = render({ household, memberId: JONATHAN });
    expect(host.textContent).toContain("Bianca is doing this one — you don't need to type anything.");
    expect(host.textContent).toContain("Waiting");
    expect(host.textContent).not.toContain("Jonathan's side cash");
    expect(host.querySelector(".onboarding-actions")).toBeNull();
    expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Stop setup for now"]);
    unmount();
  });

  it("shows the noticed strip for a witness too, once household-scoped evidence is accepted for their chapter", () => {
    let household = throughSittingOne();
    // Trim to one eligible card so resolveSwipeCardAccount() is unambiguous
    // and accountsEvidence() resolves a real household card — see
    // src/core/swipe.ts:isEligibleSwipeCard / resolveSwipeCardAccount.
    household = {
      ...household,
      accounts: household.accounts.filter((account) => account.id !== "ACC-MC"),
    };
    const { host, unmount } = render({ household, memberId: JONATHAN });
    expect(host.textContent).toContain("Looks like you already handled this.");
    expect(host.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    expect(host.textContent).toContain("The accounts");
    expect(host.textContent).toContain("opened");
    expect(host.textContent).toContain("Shared accounts only.");
    expect(host.textContent).not.toContain("credit ending 4412");
    unmount();
  });
});

describe("the witness surface — fences", () => {
  it("composes no sentence at a call site — every visible string comes from copy()", () => {
    expect(componentSource).not.toMatch(/`[^`\n]*\.\s[^`\n]*`/);
    expect(componentSource).not.toMatch(/>[^<{\n]*[.?!]\s*</);
  });

  it("carries no percentage, progress count, bubble, avatar, timestamp, or typing indicator", () => {
    expect(componentSource).not.toContain("%");
    for (const source of [componentSource, cssSource]) {
      expect(source.toLowerCase()).not.toMatch(/\bbubble\b/);
      expect(source.toLowerCase()).not.toMatch(/\bavatar\b/);
      expect(source.toLowerCase()).not.toMatch(/\btimestamp\b/);
      expect(source.toLowerCase()).not.toMatch(/\btyping\b/);
    }
  });

  it("never renders a control that writes the conductor's state — no button anywhere in this file", () => {
    expect(componentSource).not.toMatch(/<button/);
    expect(componentSource).not.toMatch(/onCommit/);
  });

  it("is the polite live region the manual asks for, and persists a claimed notice across remounts", () => {
    expect(componentSource).toContain('role="status"');
    expect(componentSource).toContain('aria-live="polite"');
    expect(componentSource).toContain("window.sessionStorage");
    expect(componentSource).toContain("claimedNoticeKeys");
  });

  it("draws its spacing from SHELL_VIEW, never a hard-coded number", () => {
    const fields: Array<keyof typeof SHELL_VIEW> = ["turnToHerc", "hercToCard", "hercMaxEm"];
    for (const field of fields) {
      expect(componentSource, `OnboardingWitness.tsx should reference SHELL_VIEW.${field}`).toContain(`SHELL_VIEW.${field}`);
    }
  });

  it("never shows the honest-length line — that's the conductor's own task estimate, not the witness's", () => {
    expect(componentSource).not.toMatch(/taskLengthLabel\(/);
  });

  it("the shell prefers probeEvidenceKey and shares the same notice claim for both roles", () => {
    expect(shellComponentSource).toContain("probeEvidenceKey");
    expect(shellComponentSource).toContain("noticedEvidenceKey(evidence.card)");
    expect(shellComponentSource).toContain("<OnboardingNotice");
  });
});
