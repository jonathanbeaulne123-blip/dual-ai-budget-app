// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { OnboardingChat } from "../src/OnboardingChat.tsx";
import {
  SHELL_VIEW,
  SITTING_MARK_COUNT,
  catalogHousehold,
  chapterRoleFor,
  chapterById,
  confirmHouseholdOnboarding,
  evidenceCardLabel,
  evidenceProvenanceLabel,
  foundHouseholdCharter,
  isSittingFinalChapter,
  isSittingFirstChapter,
  proposeHouseholdOnboarding,
  recordChapterAcknowledgement,
  shouldShowOnboardingShell,
  signHouseholdCharter,
  sittingRailIndex,
  taskLengthLabel,
  type EvidenceCard,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-03";

const componentSource = readFileSync(join(process.cwd(), "src/OnboardingChat.tsx"), "utf8");
const cssSource = readFileSync(join(process.cwd(), "src/onboarding.css"), "utf8");
const shellViewSource = readFileSync(join(process.cwd(), "src/core/onboarding/shellView.ts"), "utf8");

function proposedActive(): Household {
  let household = proposeHouseholdOnboarding(catalogHousehold("development"), { memberId: BIANCA, at: "2026-09-03T14:00:00.000Z" }).household;
  household = confirmHouseholdOnboarding(household, { memberId: JONATHAN, at: "2026-09-03T14:01:00.000Z" }).household;
  return household;
}

function acknowledgeBoth(household: Household, chapterId: string): Household {
  let next = recordChapterAcknowledgement(household, { memberId: BIANCA, chapterId, createdBy: BIANCA }).household;
  next = recordChapterAcknowledgement(next, { memberId: JONATHAN, chapterId, createdBy: JONATHAN }).household;
  return next;
}

/** Active, ch-01 and ch-02 acknowledged by both — lands on ch-03-charter, sitting-final, unfounded (empty evidence). */
function throughChapterTwo(): Household {
  let household = proposedActive();
  household = acknowledgeBoth(household, "ch-01-meet");
  household = acknowledgeBoth(household, "ch-02-household");
  return household;
}

/** Charter founded and fully signed, ch-01/02/03 acknowledged by both — lands on ch-04-accounts, first of sitting two, empty evidence. Bianca is custodian and conducts; Jonathan witnesses. */
function throughSittingOne(): Household {
  let household = throughChapterTwo();
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
  onClose?: () => void;
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
      onClose: props.onClose ?? (() => {}),
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

describe("shellView — geometry and pure rules", () => {
  it("carries the manual's SHELL_VIEW constants byte-exact", () => {
    expect(SHELL_VIEW).toEqual({
      padTop: 22, padSide: 20,
      railMarkWidth: 26, railMarkHeight: 3, railGap: 6,
      railToTurn: 22, turnToHerc: 10, hercToCard: 18,
      cardToAction: 20, actionToFoot: 26,
      navButtonHeight: 48, returnBarHeight: 44, minTouch: 44,
      hercMaxEm: 24,
    });
    expect(SITTING_MARK_COUNT).toBe(3);
  });

  it("maps sitting number to a 0-based rail index, and null to no mark", () => {
    expect(sittingRailIndex(1)).toBe(0);
    expect(sittingRailIndex(2)).toBe(1);
    expect(sittingRailIndex(3)).toBe(2);
    expect(sittingRailIndex(null)).toBeNull();
  });

  it("finds the sitting-final chapter from the registry, never a hard-coded list", () => {
    expect(isSittingFinalChapter("ch-03-charter")).toBe(true);
    expect(isSittingFinalChapter("ch-08-cadence")).toBe(true);
    expect(isSittingFinalChapter("ch-12-ready")).toBe(true);
    expect(isSittingFinalChapter("ch-01-meet")).toBe(false);
    expect(isSittingFinalChapter("ch-04-accounts")).toBe(false);
    expect(isSittingFinalChapter("not-a-real-chapter")).toBe(false);
  });

  it("finds the sitting-first chapter from the registry", () => {
    expect(isSittingFirstChapter("ch-01-meet")).toBe(true);
    expect(isSittingFirstChapter("ch-04-accounts")).toBe(true);
    expect(isSittingFirstChapter("ch-09-categories")).toBe(true);
    expect(isSittingFirstChapter("ch-03-charter")).toBe(false);
    expect(isSittingFirstChapter("ch-08-cadence")).toBe(false);
  });

  it("puts self/both/either chapters in the conductor's seat for every viewer", () => {
    const self = chapterById("ch-08-cadence")!;
    const both = chapterById("ch-01-meet")!;
    const either = chapterById("ch-03-charter")!;
    for (const chapter of [self, both, either]) {
      expect(chapterRoleFor(chapter, BIANCA, null)).toBe("conductor");
      expect(chapterRoleFor(chapter, JONATHAN, BIANCA)).toBe("conductor");
    }
  });

  it("puts a partner chapter's conductor role on the custodian only, and fails open with no custodian on record", () => {
    const chapter = chapterById("ch-04-accounts")!;
    expect(chapterRoleFor(chapter, BIANCA, BIANCA)).toBe("conductor");
    expect(chapterRoleFor(chapter, JONATHAN, BIANCA)).toBe("witness");
    expect(chapterRoleFor(chapter, BIANCA, null)).toBe("conductor");
    expect(chapterRoleFor(chapter, JONATHAN, null)).toBe("conductor");
  });

  it("shows the shell only when onboarding has actually locked ordinary Hercules and this member has a chapter waiting", () => {
    const fresh = catalogHousehold("development");
    expect(shouldShowOnboardingShell(fresh, BIANCA, TODAY)).toBe(false); // not locked yet, even though ch-01 is "next"
    expect(shouldShowOnboardingShell(proposedActive(), BIANCA, TODAY)).toBe(true);
    expect(shouldShowOnboardingShell(proposedActive(), JONATHAN, TODAY)).toBe(true);
  });

  it("gives every evidence kind a non-empty, distinct cap label and provenance line", () => {
    const kinds: EvidenceCard["kind"][] = ["transaction", "receipt", "account", "configuration", "recurrence", "submission", "approval"];
    const labels = kinds.map(evidenceCardLabel);
    const provenances = kinds.map(evidenceProvenanceLabel);
    for (const value of [...labels, ...provenances]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(labels).size).toBe(kinds.length);
    expect(new Set(provenances).size).toBe(kinds.length);
    expect(evidenceProvenanceLabel("configuration")).toBe("From the charter record.");
  });

  it("states an honest length, never a step count it doesn't have", () => {
    expect(taskLengthLabel(60)).toBe("About 1 minute.");
    expect(taskLengthLabel(120)).toBe("About 2 minutes.");
    expect(taskLengthLabel(180)).toBe("About 3 minutes.");
    expect(taskLengthLabel(300)).toBe("About 5 minutes.");
    expect(taskLengthLabel(20)).toBe("About 1 minute.");
  });
});

describe("the conductor shell — rendering", () => {
  it("shows the noticed strip and an evidence card, with its provenance, once evidence is already accepted", () => {
    const { host, unmount } = render({ household: proposedActive(), memberId: BIANCA });
    expect(host.textContent).toContain("This one's yours.");
    expect(host.textContent).toContain("Looks like you already handled this.");
    expect(host.textContent).toContain("The approvals");
    expect(host.textContent).toContain("From the approvals record.");
    expect(host.textContent).toContain("Confirmed by");
    expect(host.textContent).toContain("Bianca and Jonathan");
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["Next", "Stop setup for now"]);
    unmount();
  });

  it("shows the plain task card and the sitting-two heads-up for the conductor, with a single Next button", () => {
    const { host, unmount } = render({ household: throughSittingOne(), memberId: BIANCA });
    expect(host.textContent).not.toContain("Looks like you already handled this.");
    expect(host.textContent).toContain("This is the long one — bills, balances, the fund. Worth a coffee.");
    expect(host.textContent).toContain("onboarding.household.ch-04-accounts"); // Part 2 hasn't written this chapter's copy yet — the safe fallback from slice 6
    expect(host.textContent).toContain("About 5 minutes.");
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["Next", "Stop setup for now"]);
    unmount();
  });

  it("witnesses the same chapter with the partner's name, no action row at all, and a plain status word", () => {
    const { host, unmount } = render({ household: throughSittingOne(), memberId: JONATHAN });
    expect(host.textContent).toContain("Bianca is doing this one — you don't need to type anything.");
    expect(host.textContent).toContain("Waiting");
    expect(host.querySelector(".onboarding-actions")).toBeNull();
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["Stop setup for now"]);
    unmount();
  });

  it("gives the sitting boundary its own Hercules line, above the ever-present Pause/stop control", () => {
    const { host, unmount } = render({ household: throughChapterTwo(), memberId: BIANCA });
    expect(host.textContent).toContain("Good place to stop. We'll pick up right here.");
    const buttons = [...host.querySelectorAll("button")];
    // Next still advances; the foot's stop link is the real Pause control here —
    // a second button with the same words would just duplicate it on screen.
    expect(buttons.map((button) => button.textContent)).toEqual(["Next", "Stop setup for now"]);
    expect(buttons.filter((button) => button.textContent === "Stop setup for now").length).toBe(1);
    unmount();
  });

  it("advances to the next chapter, and only for the acting member, when Next is pressed", () => {
    let household = throughSittingOne();
    const { host, unmount } = render({
      household,
      memberId: BIANCA,
      onCommit: (fn) => {
        household = fn(household).household;
      },
    });
    expect(host.textContent).toContain("ch-04-accounts");
    const next = [...host.querySelectorAll("button")].find((button) => button.textContent === "Next")!;
    act(() => next.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    unmount();

    const after = render({ household, memberId: BIANCA });
    expect(after.host.textContent).toContain("ch-05-opening");
    after.unmount();

    // Jonathan's own progress is untouched — he still witnesses ch-04, not ch-05.
    const witnessAfter = render({ household, memberId: JONATHAN });
    expect(witnessAfter.host.textContent).toContain("ch-04-accounts");
    witnessAfter.unmount();
  });

  it("requests a stop, and shows the honest waiting state once only one member has asked to stop", () => {
    let household = throughSittingOne();
    const { host, unmount } = render({
      household,
      memberId: BIANCA,
      onCommit: (fn) => {
        household = fn(household).household;
      },
    });
    const stop = [...host.querySelectorAll("button")].find((button) => button.textContent === "Stop setup for now")!;
    act(() => stop.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    unmount();

    expect(household.householdOnboarding?.state).toBe("waiting-member");

    const biancaAfter = render({ household, memberId: BIANCA });
    expect(biancaAfter.host.textContent).toContain("Waiting on Jonathan. Nothing's lost — it'll pick up when they're in.");
    expect(biancaAfter.host.querySelector(".onboarding-card")).toBeNull();
    expect(biancaAfter.host.querySelectorAll("button").length).toBe(0);
    biancaAfter.unmount();

    // Jonathan hasn't stopped — he still sees his own current chapter, not the waiting message.
    const jonathanAfter = render({ household, memberId: JONATHAN });
    expect(jonathanAfter.host.textContent).not.toContain("Waiting on");
    jonathanAfter.unmount();
  });

  it("keeps Next reachable by keyboard and traps Tab inside the shell", () => {
    // jsdom never lays anything out, so getClientRects() is always empty —
    // the same visibility check Charter.tsx's own trap uses would otherwise
    // see nothing to trap. Stubbing it to report "on screen" for this one
    // test is what makes the trap itself assertable here at all.
    const originalGetClientRects = HTMLElement.prototype.getClientRects;
    HTMLElement.prototype.getClientRects = function stubGetClientRects(this: HTMLElement) {
      return [{}] as unknown as DOMRectList;
    };
    try {
      const { host, unmount } = render({ household: throughChapterTwo(), memberId: BIANCA });
      const buttons = [...host.querySelectorAll("button")] as HTMLButtonElement[];
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      for (const button of buttons) {
        expect(button.tabIndex).not.toBe(-1);
        expect(button.disabled).toBe(false);
      }
      const last = buttons[buttons.length - 1]!;
      const first = buttons[0]!;
      last.focus();
      expect(document.activeElement).toBe(last);
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      });
      expect(document.activeElement).toBe(first);
      unmount();
    } finally {
      HTMLElement.prototype.getClientRects = originalGetClientRects;
    }
  });
});

describe("the conductor shell — fences", () => {
  it("composes no sentence at a call site — every visible string comes from copy() or flavorFor()", () => {
    // Scoped to a single line so an unrelated comment's own full stop, sitting
    // between two genuinely separate template literals elsewhere in the file,
    // can never bridge two backticks into a false match.
    expect(componentSource).not.toMatch(/`[^`\n]*\.\s[^`\n]*`/);
    expect(componentSource).not.toMatch(/>[^<{\n]*[.?!]\s*</);
  });

  it("never advances on a timer and never queries the whole document", () => {
    expect(componentSource).not.toMatch(/setTimeout/);
    expect(componentSource).not.toMatch(/setInterval/);
    expect(componentSource).not.toMatch(/document\.querySelector\(/);
  });

  it("carries no percentage, progress count, bubble, avatar, timestamp, or typing indicator in what a member sees", () => {
    // The "%" ban is about data-bearing text on screen (HEARTH_UX_PACKET.md
    // §13.9: no progress percentage). CSS legitimately uses "%" for
    // color-mix() and layout — that's not this rule's target, so only the
    // component's own source (never a percent sign anywhere in it) is fenced
    // for "%"; both files are fenced for the forbidden chat-app vocabulary.
    expect(componentSource).not.toContain("%");
    for (const source of [componentSource, cssSource]) {
      expect(source.toLowerCase()).not.toMatch(/\bbubble\b/);
      expect(source.toLowerCase()).not.toMatch(/\bavatar\b/);
      expect(source.toLowerCase()).not.toMatch(/\btimestamp\b/);
      expect(source.toLowerCase()).not.toMatch(/\btyping\b/);
    }
  });

  it("draws every spacing rule from SHELL_VIEW, never a hard-coded number in the component", () => {
    const fields: Array<keyof typeof SHELL_VIEW> = [
      "padTop", "padSide", "railMarkWidth", "railMarkHeight", "railGap",
      "railToTurn", "turnToHerc", "hercToCard", "cardToAction", "actionToFoot",
      "navButtonHeight", "minTouch", "hercMaxEm",
    ];
    for (const field of fields) {
      expect(componentSource, `OnboardingChat.tsx should reference SHELL_VIEW.${field}`).toContain(`SHELL_VIEW.${field}`);
    }
    // returnBarHeight belongs to the return bar (HEARTH_UX_PACKET.md §13.5), which lives in the
    // app's shared nav chrome — out of this slice's file list. Not consumed here on purpose.
  });

  it("never renders a second copy of the sitting rail — always exactly three marks, never one per chapter", () => {
    expect(componentSource).toContain("SITTING_MARK_COUNT");
    expect(componentSource).not.toMatch(/ONBOARDING_REGISTRY\.length/);
  });

  it("the shellView module never posts, settles, or moves a cent, and touches no network", () => {
    expect(shellViewSource).not.toMatch(/\b(postEntry|postTransfer|commit|commitHousehold)\s*\(/);
    expect(shellViewSource).not.toMatch(/fetch\s*\(/);
  });

  it("evidenceProvenanceLabel and evidenceCardLabel are exhaustive — a new evidence kind fails to compile silently uncited", () => {
    expect(shellViewSource).toMatch(/const exhaustive: never = kind/);
  });
});
