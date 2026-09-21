import { describe, expect, it } from "vitest";
import { savePlanDraft, shapePlanDrafts, type Household } from "../src/core/index.ts";
import { FUND_IDS } from "../src/core/fundRules.ts";
import {
  COIN_CENTS, JAR_CAPACITY_CENTS, POT_CHOICES, WIZARD_LINE_KEYS, WIZARD_STEPS, abandonCard, cardReading, currentStep,
  emptyWizardState, jarReading, laidLines, layLine, pinKindFor, pinReason, protectHint, stepBack, suggestPot, wizardBase, wizardCadence,
  wizardCardLine, wizardComplete, wizardDraftInput, wizardMonth, type WizardAnswers, type WizardState,
} from "../src/plan-wizard/wizard.ts";
import { A, RANKS, TH_MAX, TRAVEL, linkageReading, linkageWords, rankAngle, rankPose } from "../src/plan-wizard/linkage.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

/**
 * The Kitchen wizard (K2). Fictional books only; nothing here posts money.
 * The five lines are always the same five, one answer lays exactly one, and
 * the one write it leads to is the app's own `savePlanDraft`.
 */

const TODAY = "2026-09-11";
const ME = "MEM-001";

const full = (): WizardAnswers => ({
  what: { text: "Car insurance" },
  much: { text: "$820.00", cents: 82000 },
  when: { text: "November 2", date: "2026-11-02" },
  pot: { text: "Prepare", fund: "prepare", suggested: true },
  who: { text: "Both of us", choice: "both" },
});

function answerAll(start: WizardState = emptyWizardState()): WizardState {
  const answers = full();
  return WIZARD_LINE_KEYS.reduce<WizardState>((state, key) => layLine(state, key as never, answers[key] as never), start);
}

describe("the card is always the same five lines", () => {
  it("names them in order: What, How much, By when, From which pot, Who", () => {
    expect(WIZARD_STEPS.map((step) => step.key)).toEqual(["what", "much", "when", "pot", "who"]);
    expect(WIZARD_STEPS.map((step) => step.label)).toEqual(["What", "How much", "By when", "From which pot", "Who"]);
  });
});

describe("one answer lays exactly one line", () => {
  it("walks the five questions, laying one line each and never more", () => {
    let state = emptyWizardState();
    expect(laidLines(state)).toEqual([]);
    const answers = full();
    for (const [index, key] of WIZARD_LINE_KEYS.entries()) {
      expect(currentStep(state)?.key).toBe(key);
      state = layLine(state, key as never, answers[key] as never);
      expect(laidLines(state)).toHaveLength(index + 1);
      expect(state.index).toBe(index + 1);
    }
    expect(wizardComplete(state)).toBe(true);
    expect(currentStep(state)).toBeNull();
  });

  it("refuses a slip for a question that is not on the table", () => {
    const state = emptyWizardState();
    const jumped = layLine(state, "who", { text: "Both of us", choice: "both" });
    expect(jumped).toBe(state);
    expect(laidLines(jumped)).toEqual([]);
  });

  it("goes back and forward without losing or duplicating a line", () => {
    let state = answerAll();
    state = stepBack(stepBack(state));
    expect(state.index).toBe(3);
    // The lines behind stay written until they are answered again.
    expect(laidLines(state)).toHaveLength(5);
    state = layLine(state, "pot", { text: "Build", fund: "build", suggested: false });
    expect(state.answers.pot?.fund).toBe("build");
    expect(laidLines(state)).toHaveLength(5);
    expect(state.index).toBe(4);
  });

  it("stops at the first question when there is nothing behind", () => {
    const state = emptyWizardState();
    expect(stepBack(state)).toBe(state);
  });

  it("puts an abandoned card in the drawer, never the bin", () => {
    const state = layLine(emptyWizardState(), "what", { text: "Car insurance" });
    const abandoned = abandonCard(state);
    expect(abandoned.to).toBe("drawer");
    expect(abandoned.words).toContain("drawer, not the bin");
    // "bin" appears once, and only to refuse it.
    expect(abandoned.words.match(/\bbin\b/g)).toHaveLength(1);
    expect(abandoned.words).not.toMatch(/delete|discard|thrown|lost/i);
    expect(abandoned.kept.what?.text).toBe("Car insurance");
  });

  it("reads the card back in the card's own order", () => {
    expect(cardReading(full()).map((row) => [row.label, row.value])).toEqual([
      ["What", "Car insurance"], ["How much", "$820.00"], ["By when", "November 2"], ["From which pot", "Prepare"], ["Who", "Both of us"],
    ]);
  });
});

describe("line 4 speaks the live money model", () => {
  it("offers exactly the four funds the house has", () => {
    expect(POT_CHOICES.map((pot) => pot.fund).sort()).toEqual([...FUND_IDS].sort());
    for (const pot of POT_CHOICES) expect(pot.meaning.length).toBeGreaterThan(0);
  });

  it("suggests through the app's own rules", () => {
    const table: [string, string | null][] = [
      ["Car insurance", "prepare"],   // transport umbrella; "insurance" is a Prepare word
      ["Christmas", "prepare"],       // gifts are checked before holidays
      ["A trip away", "build"],       // travel
      ["Hydro", "prepare"],           // utilities
      ["Rent", "prepare"],
      ["Groceries", "everyday"],
      ["The dentist", "everyday"],
      ["RRSP", "build"],
      ["Car loan", "prepare"],
      ["Emergency fund", "everyday"], // documented: it falls to Everyday, and the UI points at Protect
      ["Pay off the Visa", null],     // moving money has no pot
      ["Snow tires", null],           // no umbrella reads from those words, so nothing is suggested
      ["", null],
    ];
    for (const [words, expected] of table) {
      const suggestion = suggestPot(words);
      expect(suggestion?.fund ?? null, `suggestPot(${JSON.stringify(words)})`).toBe(expected);
    }
  });

  it("never suggests Protect, for any words at all", () => {
    const words = [
      "Emergency fund", "Emergency", "Our buffer", "Buffer", "Protect", "Rainy day", "Safety net", "Rent", "Mortgage",
      "Hydro", "Phone", "Internet", "Electric", "Utility", "Snow tires", "Christmas", "The dentist", "Vet", "Daycare",
      "Netflix", "Groceries", "RRSP", "A slower week away", "Car payment", "Bank fee", "Tax owing",
    ];
    for (const word of words) expect(suggestPot(word)?.fund, word).not.toBe("protect");
    // …and Protect is still offered, so it can be chosen deliberately.
    const protect = POT_CHOICES.find((pot) => pot.fund === "protect");
    expect(protect).toBeTruthy();
    expect(protect!.note).toMatch(/chosen/i);
  });

  it("points at Protect for buffer words without ever picking it", () => {
    for (const word of ["Emergency fund", "Our buffer", "A rainy day pot", "Safety net"]) {
      expect(protectHint(word), word).toMatch(/Protect is its pot/);
      expect(suggestPot(word)?.fund, word).not.toBe("protect");
    }
    expect(protectHint("Car insurance")).toBeNull();
  });
});

describe("the jar: its fill is the amount, and the capacity is drawn", () => {
  it("counts coins, and puts what will not fit on the lid", () => {
    expect(jarReading(0)).toMatchObject({ coins: 0, spilledCents: 0, over: false });
    expect(jarReading(82000)).toMatchObject({ coins: Math.round(82000 / COIN_CENTS), spilledCents: 0, over: false });
    expect(jarReading(JAR_CAPACITY_CENTS)).toMatchObject({ coins: JAR_CAPACITY_CENTS / COIN_CENTS, over: false });
    const over = jarReading(JAR_CAPACITY_CENTS + 40000);
    expect(over.coins).toBe(JAR_CAPACITY_CENTS / COIN_CENTS);
    expect(over.spilledCents).toBe(40000);
    expect(over.over).toBe(true);
    expect(over.lidCoins).toBe(8);
  });
});

describe("the linkage: one bar, five rods, one parameter", () => {
  it("fits five ranks at fixed receding steps, each rod longer than the one in front", () => {
    expect(RANKS).toHaveLength(5);
    expect(RANKS.map((rank) => rank.key)).toEqual([...WIZARD_LINE_KEYS]);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i]!.hinge).toBeLessThan(RANKS[i - 1]!.hinge);
      expect(RANKS[i]!.L).toBeGreaterThan(RANKS[i - 1]!.L);
    }
  });

  it("obeys the slider-rocker: L² = d² + 2ad·cos θ + a², wherever the rod is taut", () => {
    let taut = 0;
    for (const rank of RANKS) {
      for (const travel of [0, 12, 31, 44, TRAVEL]) {
        const { theta, d } = rankAngle(rank, travel);
        // theta 0 is the lost motion in the slot; TH_MAX is the paper stop. Neither is the equation.
        if (theta <= 0 || theta >= TH_MAX) continue;
        taut++;
        const radians = (theta * Math.PI) / 180;
        expect(d * d + 2 * A * d * Math.cos(radians) + A * A).toBeCloseTo(rank.L * rank.L, 6);
      }
    }
    expect(taut).toBeGreaterThan(8);
  });

  it("gives each rank more slack than the one in front, so the front rank engages first", () => {
    const early = RANKS.map((rank) => rankAngle(rank, 6).theta);
    expect(early[0]).toBeGreaterThan(0);
    for (let i = 1; i < early.length; i++) expect(early[i]).toBeLessThanOrEqual(early[i - 1]!);
  });

  it("collapses flat and rises front rank first", () => {
    const flat = linkageReading(0, WIZARD_LINE_KEYS);
    expect(flat.poses.every((pose) => pose.theta === 0)).toBe(true);
    expect(flat.standing).toBe(0);
    const mid = linkageReading(0.55, WIZARD_LINE_KEYS);
    for (let i = 1; i < mid.poses.length; i++) expect(mid.poses[i]!.theta).toBeLessThan(mid.poses[i - 1]!.theta);
    const raised = linkageReading(1, WIZARD_LINE_KEYS);
    expect(raised.topped).toBe(5);
    expect(raised.poses.every((pose) => pose.theta <= TH_MAX)).toBe(true);
    expect(linkageWords(raised)).toContain("Fully raised");
  });

  it("shadows follow sin θ, and only the fitted ranks are in the linkage", () => {
    const pose = rankPose(RANKS[0]!, 0.5);
    expect(pose.shadowScaleY).toBeCloseTo(0.1 + 0.85 * Math.sin((pose.theta * Math.PI) / 180), 10);
    const partial = linkageReading(1, ["what", "much"]);
    expect(partial.fitted).toBe(2);
    expect(partial.poses.map((row) => row.rank.key)).toEqual(["what", "much"]);
  });

  it("is reversible: the same pull gives the same pose, both ways", () => {
    const down = linkageReading(0.4, WIZARD_LINE_KEYS);
    const up = linkageReading(0.4, WIZARD_LINE_KEYS);
    expect(down.poses.map((row) => row.theta)).toEqual(up.poses.map((row) => row.theta));
    expect(linkageReading(0, WIZARD_LINE_KEYS).poses.map((row) => row.rankTransform))
      .toEqual(linkageReading(-3, WIZARD_LINE_KEYS).poses.map((row) => row.rankTransform));
  });
});

describe("the card becomes one of the app's own Plan lines", () => {
  const identity = { memberId: ME, view: "household" as const, today: TODAY };

  it("carries every answer, and nothing else", () => {
    const line = wizardCardLine(full(), identity, "LINE-1");
    expect(line).toMatchObject({
      id: "LINE-1", lens: "prepare", kind: "true-expense", labelSnapshot: "Car insurance", amountCents: 82000,
      cadence: "one-time", dueDate: "2026-11-02", responsibility: { kind: "joint" }, createdBy: ME,
    });
    expect(line.decision).toEqual({ targetCents: 82000, deadline: "2026-11-02" });
  });

  it("keeps an uncut leaf honest: no date, no dueDate, and it repeats monthly", () => {
    const answers = { ...full(), when: { text: "Not fixed yet", date: null } };
    const line = wizardCardLine(answers, identity, "LINE-2");
    expect(line.dueDate).toBeUndefined();
    expect(line.decision?.deadline).toBeUndefined();
    expect(line.cadence).toBe("monthly");
    expect(wizardCadence(answers)).toBe("monthly");
  });

  it("puts one person's card on that person", () => {
    const line = wizardCardLine({ ...full(), who: { text: "Just me", choice: "mine" } }, identity, "LINE-3");
    expect(line.responsibility).toEqual({ kind: "member", memberId: ME });
  });
});

describe("the one write is the app's own savePlanDraft", () => {
  it("adds the card to the month's existing private draft and keeps every line", () => {
    const household = planLifeFixture("household");
    const identity = { memberId: ME, view: "household" as const, today: TODAY };
    const base = wizardBase(household, identity);
    expect(base.from).toBe("draft");
    expect(base.draft?.id).toBe("LIFE-DRAFT");
    const input = wizardDraftInput(household, identity, full(), "LINE-NEW");
    expect(input.id).toBe("LIFE-DRAFT");
    expect(input.expectedUpdatedAt).toBe(base.draft!.updatedAt);
    expect(input.targetMonth).toBe(wizardMonth(TODAY));
    expect(input.lines).toHaveLength(base.lines.length + 1);
    expect(input.lines.slice(0, -1).map((line) => line.id)).toEqual(base.lines.map((line) => line.id));
    expect(input.lines.at(-1)!.id).toBe("LINE-NEW");

    const after = savePlanDraft(household, input).household;
    const saved = shapePlanDrafts(after.planDrafts, ME).find((row) => row.id === "LIFE-DRAFT")!;
    expect(saved.lines.map((line) => line.labelSnapshot)).toContain("Car insurance");
    // Private only: no version moved and no money was posted.
    expect(after.planVersions!.length).toBe(household.planVersions!.length);
    expect(after.transactions.length).toBe(household.transactions.length);
  });

  it("takes a month with no draft over from its standing version, re-stamped as the actor's own", () => {
    const household = planLifeFixture("household");
    const stripped: Household = { ...household, planDrafts: [] };
    const base = wizardBase(stripped, { memberId: ME, view: "household", today: TODAY });
    expect(base.from).toBe("version");
    expect(base.draft).toBeNull();
    expect(base.baseVersionId).toBe(stripped.planVersions!.find((row) => row.state !== "superseded")!.id);
    expect(base.lines.every((line) => line.createdBy === ME)).toBe(true);
    const input = wizardDraftInput(stripped, { memberId: ME, view: "household", today: TODAY }, full(), "LINE-NEW");
    expect(input.id).toBeUndefined();
    expect(savePlanDraft(stripped, input).household.planDrafts!.length).toBe(1);
  });

  it("starts a bare month from nothing, with the card as its first decision", () => {
    const household = planLifeFixture("household");
    const bare: Household = { ...household, planDrafts: [], planVersions: [] };
    const base = wizardBase(bare, { memberId: ME, view: "household", today: TODAY });
    expect(base).toMatchObject({ from: "nothing", lines: [], baseVersionId: null, draft: null });
    expect(wizardDraftInput(bare, { memberId: ME, view: "household", today: TODAY }, full(), "L").lines).toHaveLength(1);
  });
});

describe("pinning the card is a second, separate act", () => {
  it("proposes in Shared and locks in Personal", () => {
    expect(pinKindFor("household")).toBe("propose");
    expect(pinKindFor("personal")).toBe("lock");
  });

  it("gives a reason that names the card and claims nothing about money", () => {
    for (const view of ["household", "personal"] as const) {
      const reason = pinReason(full(), view);
      expect(reason).toContain("Car insurance");
      expect(reason).not.toMatch(/saved|paid|transferred|moved/i);
    }
  });
});

describe("the wizard's own words never claim a save", () => {
  it("has no step copy that says anything was saved, moved or agreed", () => {
    for (const step of WIZARD_STEPS) {
      expect(`${step.ask} ${step.why}`).not.toMatch(/\b(saved|committed|transferred|agreed|we moved)\b/i);
    }
  });
});

describe("the Kitchen's doors land here", () => {
  it("keeps the empty card, the drawer and Hercules' chair pointed at the Plan Studio door", async () => {
    const { readFileSync } = await import("node:fs");
    const scene = readFileSync(new URL("../src/harbour/kitchen/KitchenScene.ts", import.meta.url), "utf8");
    for (const anchor of ["empty-card", "drawer", "hercules-chair"]) {
      const at = scene.indexOf(`id: "${anchor}"`);
      expect(at, anchor).toBeGreaterThan(0);
      const block = scene.slice(at, at + 900);
      const next = block.slice(1).search(/\bid: "/);
      expect(next < 0 ? block : block.slice(0, next + 1), anchor).toContain('door: { target: "plan-studio" }');
    }
    // The room still only doors; it writes nothing.
    expect(scene).not.toMatch(/savePlanDraft|proposeHouseholdPlan|lockPersonalPlan/);
  });
});
