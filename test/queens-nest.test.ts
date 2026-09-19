import { knownCents } from "./fixtures/knownCents.ts";
import { describe, expect, it } from "vitest";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { addGoal, addRecurrence, catalogHousehold, offerMove, openChapter, respondToMove, reversePostedMoney, postEntry } from "../src/core/index.ts";
import { fundPulse, type FundPulse, type FundPulseDestination, type FundPulseState } from "../src/core/fundPulse.ts";
import { allocateNestTotal, projectKittyNest } from "../src/core/kittyNest.ts";
import { NEST_CATEGORIES } from "../src/core/kittyNestDesigns.ts";
import { openChapterFor, nextMove } from "../src/core/chapters.ts";
import { queensNestEnabled } from "../src/core/planFeature.ts";
import {
  QUEEN_BANK_FOR_PLACE, QUEEN_PULSE_WORDS,
  queenBanks, queenBody, queenBuds, queenCrown, queenFeet, queenFullness, queenHands, queenHem, queenLimits, queenLine, queenNestDoors, queenNestPlaceFor, queenRibbon, queenRibbons, queenSeams, queenShelf, queenStill, queenTrace, queenVine,
} from "../src/core/queenPresentation.ts";

const STATES: FundPulseState[] = ["checking", "reset", "needs-us", "covered", "building"];
const memberId = "MEM-001";
const today = "2026-09-12";

describe("The Queen's Nest — the still", () => {
  it("gives every pulse state a distinct, non-empty still that reads without motion", () => {
    const pulses: Array<Pick<FundPulse, "state" | "destination">> = [
      { state: "checking", destination: "status" },
      { state: "reset", destination: "path" },
      { state: "needs-us", destination: "together" },
      { state: "covered", destination: "fund" },
      { state: "building", destination: "path" },
    ];
    const stills = pulses.map((pulse) => queenStill(pulse, "current"));
    expect(stills.map((still) => still.state)).toEqual(STATES);
    for (const still of stills) {
      expect(still.description.trim().length).toBeGreaterThan(20);
      expect(still.description).toMatch(/^[A-Z]/);
      // Pose is the data: posture, eyes and mouth are plain words, never colours.
      expect(["upright", "leaning-in", "attentive", "tilted", "depleted", "matte"]).toContain(still.posture);
      expect(["closed", "open"]).toContain(still.eyes);
      if (still.eyes === "closed") expect(still.gaze).toBe("rest");
      else expect(still.gaze).not.toBe("rest");
    }
    expect(new Set(stills.map((still) => still.description)).size).toBe(STATES.length);
    expect(new Set(stills.map((still) => `${still.posture}:${still.eyes}:${still.mouth}:${still.brow}`)).size).toBe(STATES.length);
  });

  it("is grave about the month, never about the person, and only when the month earns it", () => {
    const grave = queenStill({ state: "needs-us", destination: "fund" }, "current");
    expect(grave.grave).toBe(true);
    expect(grave.posture).toBe("depleted");
    expect(grave.brow).toBe("weighted");
    const waiting = queenStill({ state: "needs-us", destination: "together" }, "current");
    expect(waiting.grave).toBe(false);
    expect(waiting.posture).toBe("attentive");
    expect(waiting.gaze).toBe("crown");
    expect(queenStill({ state: "reset", destination: "path" }, "current").grave).toBe(true);
    for (const state of STATES) {
      const still = queenStill({ state, destination: "fund" }, "current");
      expect(still.description).not.toMatch(/\byou (failed|forgot|should|overspent|missed)\b/i);
      expect(still.description).not.toMatch(/disappoint|blame|shame|careless/i);
    }
    expect(grave.description).toMatch(/obligation|month/);
  });

  it("keeps the pulse's own destination and uses it for the gaze", () => {
    const destinations: FundPulseDestination[] = ["fund", "together", "path", "status"];
    for (const destination of destinations) {
      const still = queenStill({ state: "needs-us", destination }, "current");
      expect(still.destination).toBe(destination);
      expect(still.gaze).toBe({ fund: "body", together: "crown", path: "vine", status: "face" }[destination]);
    }
  });

  it("goes matte when the evidence is not current and dashed when offline", () => {
    expect(queenStill({ state: "checking", destination: "status" }, "stale").glaze).toBe("matte");
    expect(queenStill({ state: "checking", destination: "status" }, "offline").glaze).toBe("offline");
    expect(queenStill({ state: "checking", destination: "fund" }, "current").glaze).toBe("matte");
    expect(queenStill({ state: "covered", destination: "fund" }, "current").glaze).toBe("glazed");
    const live = fundPulse({ configured: true, freshness: "current", reconciliationTied: true, criticalDrift: 0, attentionDrift: 0, awaitingMe: 0, awaitingPartner: 0, topUpNeededCents: 0, activeChapter: false });
    expect(queenStill(live, "current").state).toBe("covered");
  });
});

describe("The Queen's Nest — two doors and a belly over four categories", () => {
  it("routes protect and prepare to the Protect door, build to the Build door, everyday to the belly", () => {
    expect(queenNestPlaceFor("protect")).toBe("protect");
    expect(queenNestPlaceFor("prepare")).toBe("protect");
    expect(queenNestPlaceFor("build")).toBe("build");
    expect(queenNestPlaceFor("everyday")).toBe("belly");
  });

  it("passes the four category banks through untouched, so the King still conserves to the cent", () => {
    const nest = projectKittyNest(planLifeFixture("household"), memberId, "household", "2026-09-21");
    const doors = queenNestDoors(nest);
    const shown = [...doors.protect, ...doors.build, ...doors.belly];
    expect(shown.map((bank) => bank.category).sort()).toEqual([...NEST_CATEGORIES].sort());
    expect(shown).toHaveLength(4);
    for (const bank of shown) expect(nest.categories).toContain(bank);
    expect(nest.categories.reduce((sum, bank) => sum + knownCents(bank.amountCents), 0)).toBe(knownCents(nest.king.amountCents));
    expect(shown.reduce((sum, bank) => sum + knownCents(bank.amountCents), 0)).toBe(knownCents(nest.king.amountCents));
    expect(doors.protect.map((bank) => bank.category)).toEqual(["protect", "prepare"]);
    expect(doors.build.map((bank) => bank.category)).toEqual(["build"]);
    expect(doors.belly.map((bank) => bank.category)).toEqual(["everyday"]);
  });

  it("leaves allocateNestTotal's exact everyday remainder alone, including debt", () => {
    for (const total of [0, 1, 99, 12345, -1, -50000]) {
      const allocation = allocateNestTotal(total, { build: 400, protect: 900, prepare: 250 });
      const grouped = { protect: allocation.protect + allocation.prepare, build: allocation.build, belly: allocation.everyday };
      expect(grouped.protect + grouped.build + grouped.belly).toBe(total);
    }
  });
});

describe("The Queen's Nest — hands, vine, buds, hem, crown, body", () => {
  it("shows empty hands when nothing needs doing and never invents a Move", () => {
    const quiet = catalogHousehold();
    expect(queenHands(quiet, memberId, openChapterFor(quiet), nextMove(quiet, memberId))).toEqual({ kind: "empty" });
    let h = openChapter(catalogHousehold(), { memberId, foundationId: "make-rent-boring", at: "2026-09-01T12:00:00.000Z" }).household;
    const chapter = openChapterFor(h)!;
    const opening = nextMove(h, memberId);
    // The foundation's first Move is offered on open; declining it leaves the hands empty.
    if (opening) h = respondToMove(h, { memberId, moveId: opening.id, response: "decline" }).household;
    expect(queenHands(h, memberId, chapter, nextMove(h, memberId))).toEqual({ kind: "empty" });
    // A Move offered by the partner that needs both of us asks for an acknowledgment first, then waits, then is done.
    h = offerMove(h, { memberId: "MEM-002", chapterId: chapter.id, text: "Confirm which payday the pre-rent check belongs to", needsAcknowledgment: true }).household;
    const move = nextMove(h, memberId)!;
    expect(queenHands(h, memberId, chapter, move)).toMatchObject({ kind: "move", act: "acknowledge" });
    h = respondToMove(h, { memberId, moveId: move.id, response: "acknowledge" }).household;
    expect(queenHands(h, memberId, chapter, nextMove(h, memberId))).toMatchObject({ kind: "move", act: "done" });
    const partnerView = queenHands(h, "MEM-002", chapter, nextMove(h, "MEM-002"));
    expect(partnerView).toMatchObject({ kind: "move", act: "done" });
  });

  it("holds the shared-life setup Move out as a setup door", () => {
    const h = openChapter(catalogHousehold(), { memberId, foundationId: "see-our-shared-life" }).household;
    expect(queenHands(h, memberId, openChapterFor(h), nextMove(h, memberId))).toMatchObject({ kind: "move", act: "setup" });
  });

  it("grows the vine by acts, never by amounts", () => {
    const bare = queenVine(catalogHousehold(), null, today);
    expect(bare).toEqual({ chapter: null, growth: 0 });
    const h = openChapter(catalogHousehold(), { memberId, foundationId: "make-rent-boring", at: "2026-09-01T12:00:00.000Z" }).household;
    const vine = queenVine(h, openChapterFor(h), today);
    expect(vine.chapter).not.toBeNull();
    if (vine.chapter) {
      expect(vine.week).toBe(2);
      expect(vine.growth).toBe(0);
      expect(vine.title).toBe("Make Rent Boring");
    }
  });

  it("offers fewer buds and stones on the phone rather than smaller ones", () => {
    const h = planLifeFixture("household");
    const nest = projectKittyNest(h, memberId, "household", today);
    expect(queenLimits(false)).toEqual({ buds: 2, stones: 2, presence: 2 });
    expect(queenLimits(true)).toEqual({ buds: 4, stones: 4, presence: 4 });
    const phone = queenBuds(nest, 1);
    const wide = queenBuds(nest, 4);
    expect(phone).toHaveLength(1);
    expect(wide).toHaveLength(2);
    expect(wide.map((bud) => bud.goalId).sort()).toEqual(h.goals.map((goal) => goal.id).sort());
    for (const bud of wide) expect(bud.id).toBe(`bud:${bud.goalId}`);
    expect(queenHem([{ id: "a", label: "Rent", date: "2026-09-20", amountCents: 90000, source: "recurrence", recurrenceId: null, goalId: null, transactionId: null }, { id: "b", label: "Hydro", date: "2026-09-14", amountCents: 12000, source: "recurrence", recurrenceId: null, goalId: null, transactionId: null }], [], today, 1)).toMatchObject([{ id: "b", size: "near" }]);
    expect(queenHem([{ id: "a", label: "Rent", date: "2026-09-30", amountCents: 90000, source: "recurrence", recurrenceId: null, goalId: null, transactionId: null }], [], today, 4)).toMatchObject([{ id: "a", size: "later" }]);
    expect(queenHem([{ id: "past", label: "Old", date: "2026-09-01", amountCents: 1, source: "posted", recurrenceId: null, goalId: null, transactionId: null }], [], today, 4)).toEqual([]);
  });

  it("lights the crown from presence without counting money", () => {
    expect(queenCrown([]).light).toBe("unlit");
    expect(queenCrown([{ id: "a", text: "You acknowledged the 2026-09 Plan.", waitingOn: null }, { id: "b", text: "Sam acknowledged the 2026-09 Plan.", waitingOn: null }]).light).toBe("both");
    expect(queenCrown([{ id: "a", text: "The Plan is waiting for you.", waitingOn: "me" }, { id: "b", text: "Waiting on Sam.", waitingOn: "partner" }]).light).toBe("waiting-me");
    expect(queenCrown([{ id: "b", text: "Waiting on Sam.", waitingOn: "partner" }], 1).lines).toHaveLength(1);
  });

  it("reads fullness in words, glaze from freshness and gold seams from mended corrections", () => {
    expect(queenFullness({ amountCents: 0, targetCents: 1000 })).toEqual({ level: 0, fullness: "empty" });
    expect(queenFullness({ amountCents: -5, targetCents: 0 })).toEqual({ level: 0, fullness: "empty" });
    expect(queenFullness({ amountCents: 500, targetCents: 0 })).toEqual({ level: 10, fullness: "held" });
    expect(queenFullness({ amountCents: 250, targetCents: 1000 })).toEqual({ level: 2, fullness: "low" });
    expect(queenFullness({ amountCents: 500, targetCents: 1000 })).toEqual({ level: 5, fullness: "half" });
    expect(queenFullness({ amountCents: 1000, targetCents: 1000 })).toEqual({ level: 10, fullness: "full" });
    let h = planLifeFixture("household");
    expect(queenSeams(h, "2026-09-21")).toBe(0);
    const posted = postEntry(h, { type: "expense", date: "2026-09-10", amount: "40", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: memberId, visibility: "household" });
    h = reversePostedMoney(posted.household, posted.postedIds[0]!, { createdBy: memberId, reversalDate: "2026-09-11" }).household;
    expect(queenSeams(h, "2026-09-21")).toBe(1);
    const nest = projectKittyNest(h, memberId, "household", "2026-09-21");
    const body = queenBody(nest, "stale", 7);
    expect(body.glaze).toBe("matte");
    expect(body.seams).toBe(3);
    expect(body.amountCents).toBe(nest.king.amountCents);
  });

  it("traces the partner's most recent touch onto a region, or nothing", () => {
    const h = planLifeFixture("household");
    expect(queenTrace(h, memberId, "2027-01-01")).toBeNull();
    const fresh = postEntry(h, { type: "expense", date: "2026-09-12", amount: "12", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: "MEM-002", visibility: "household" }).household;
    const touchedToday = fresh.transactions.find((tx) => tx.createdBy === "MEM-002" && tx.amountCents === 1200)!.createdAt.slice(0, 10);
    const trace = queenTrace(fresh, memberId, touchedToday);
    expect(trace).toMatchObject({ region: "body", who: "Sam (fictional)" });
  });
});

describe("The Queen's Nest — the flag", () => {
  it("is opt-in inside the Plan V2 family and cannot outlive Household Home", () => {
    expect(queensNestEnabled(undefined, undefined, undefined)).toBe(false);
    expect(queensNestEnabled("0", undefined, undefined)).toBe(false);
    expect(queensNestEnabled("1", undefined, undefined)).toBe(true);
    expect(queensNestEnabled("true", undefined, undefined)).toBe(true);
    expect(queensNestEnabled("1", "0", undefined)).toBe(false);
    expect(queensNestEnabled("1", undefined, "false")).toBe(false);
  });
});

describe("The Still Queen — three banks, her feet, her line", () => {
  it("routes protect and prepare to the Protect bank, everyday to her belly (What Now) and build to Build, banks passed through", () => {
    expect(QUEEN_BANK_FOR_PLACE[queenNestPlaceFor("protect")]).toBe("protect");
    expect(QUEEN_BANK_FOR_PLACE[queenNestPlaceFor("prepare")]).toBe("protect");
    expect(QUEEN_BANK_FOR_PLACE[queenNestPlaceFor("everyday")]).toBe("whatnow");
    expect(QUEEN_BANK_FOR_PLACE[queenNestPlaceFor("build")]).toBe("build");
    const nest = projectKittyNest(planLifeFixture("household"), memberId, "household", "2026-09-21");
    const banks = queenBanks(nest);
    expect(banks.protect.banks.map((bank) => bank.category)).toEqual(["protect", "prepare"]);
    expect(banks.whatnow.banks.map((bank) => bank.category)).toEqual(["everyday"]);
    expect(banks.build.banks.map((bank) => bank.category)).toEqual(["build"]);
    const shown = [...banks.protect.banks, ...banks.whatnow.banks, ...banks.build.banks];
    for (const bank of shown) expect(nest.categories).toContain(bank);
    // Conservation still holds: the four categories sum to the King to the cent, and grouping adds nothing.
    expect(nest.categories.reduce((sum, bank) => sum + knownCents(bank.amountCents), 0)).toBe(knownCents(nest.king.amountCents));
    expect(shown.reduce((sum, bank) => sum + knownCents(bank.amountCents), 0)).toBe(knownCents(nest.king.amountCents));
    for (const bank of Object.values(banks)) { expect(bank.share).toBeGreaterThanOrEqual(0); expect(bank.share).toBeLessThanOrEqual(10); }
  });

  it("keeps allocateNestTotal's remainder exact under the three-bank grouping, including debt", () => {
    for (const total of [0, 1, 99, 12345, -1, -50000]) {
      const allocation = allocateNestTotal(total, { build: 400, protect: 900, prepare: 250 });
      expect((allocation.protect + allocation.prepare) + allocation.everyday + allocation.build).toBe(total);
    }
  });

  it("puts obligations at her feet as pure form — how many, how near — with no label, date or amount", () => {
    const h = planLifeFixture("household");
    const stones = queenHem([{ id: "a", label: "Fictional rent", date: "2026-09-20", amountCents: 90000, source: "recurrence", recurrenceId: null, goalId: null, transactionId: null }, { id: "b", label: "Later", date: "2026-09-28", amountCents: 100, source: "posted", recurrenceId: null, goalId: null, transactionId: null }], [], "2026-09-12", 4);
    const feet = queenFeet(stones);
    expect(feet.count).toBe(2);
    expect(feet.nearness).toEqual(["soon", "later"]);
    expect(JSON.stringify(feet)).not.toMatch(/rent|2026|900/);
    expect(queenFeet(queenHem([], [], "2026-09-12", 4))).toEqual({ count: 0, nearness: [] });
    void h;
  });

  it("gives the quiet line a distinct word for every pulse state, and a grave word when obligations are not covered", () => {
    const words = STATES.map((state) => queenLine({ title: "Make Rent Boring" }, queenStill({ state, destination: "together" }, "current")).word);
    expect(new Set(words).size).toBe(STATES.length);
    for (const state of STATES) expect(words).toContain(QUEEN_PULSE_WORDS[state]);
    const grave = queenLine({ title: "Make Rent Boring" }, queenStill({ state: "needs-us", destination: "fund" }, "current"));
    expect(grave.word).toBe("not yet covered");
    expect(grave.chapter).toBe("Make Rent Boring");
    expect(queenLine(null, queenStill({ state: "covered", destination: "fund" }, "current")).chapter).toBeNull();
    for (const word of [...words, grave.word]) { expect(word).toMatch(/\S/); expect(word).not.toMatch(/\$\d/); }
  });
});

describe("The Still Queen — the cellar's ribbon and the loft's shelf", () => {
  function withHistory() {
    let h = planLifeFixture("household");
    const rent = h.recurrences.find((row) => row.note === "Fictional rent")!;
    for (const [month, amount] of [["03", "900"], ["04", "900"], ["05", "900"], ["06", "1380"], ["07", "900"], ["08", "900"]] as const) {
      h = postEntry(h, { type: "expense", date: `2026-${month}-20`, amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional rent", createdBy: memberId, visibility: "household", source: "recurring", sourceId: rent.id, confirmDuplicate: true }).household;
    }
    h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-26", type: "expense", amount: "60", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional date night" }).household;
    h = addGoal(h, { name: "Fictional trip to the shore", target: "2000", shared: true, ownerMemberId: memberId }).household;
    return { h, rent };
  }

  it("draws one jar per month, marks the month that swelled as the outlier, and carries no amounts", () => {
    const { h, rent } = withHistory();
    const ribbon = queenRibbon(h, rent, today, 12);
    expect(ribbon.jars).toHaveLength(12);
    expect(ribbon.jars.map((jar) => jar.monthKey)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(ribbon.outlierMonth).toBe("2026-06");
    expect(ribbon.jars.filter((jar) => jar.outlier).map((jar) => jar.monthKey)).toEqual(["2026-06"]);
    expect(ribbon.jars.filter((jar) => jar.beat === "posted")).toHaveLength(6);
    expect(ribbon.jars.find((jar) => jar.monthKey === "2026-09")).toMatchObject({ beat: "expected", now: true });
    expect(ribbon.posted).toBe(6);
    expect(JSON.stringify(ribbon)).not.toMatch(/1380|90000|138000|\$/);
    // A steady beat has no outlier; fewer than three beats never earns one.
    const steady = queenRibbon({ transactions: h.transactions.filter((tx) => tx.date !== "2026-06-20") }, rent, today);
    expect(steady.outlierMonth).toBeNull();
    expect(queenRibbon(planLifeFixture("household"), rent, today).outlierMonth).toBeNull();
    const ribbons = queenRibbons(h, today);
    expect(ribbons.map((row) => row.label)).toEqual(["Fictional rent", "Fictional date night"]);
  });

  it("shelves Build's goals open-mouthed and its bills lidded, with contributions as marks", () => {
    const { h } = withHistory();
    const nest = projectKittyNest(h, memberId, "household", today);
    const shelf = queenShelf(nest, h);
    expect(shelf.map((item) => [item.name, item.mouth])).toEqual([["Fictional trip to the shore", "open"], ["Fictional date night", "lidded"]]);
    expect(shelf[0]!.goalId).toBe(h.goals.find((goal) => goal.name === "Fictional trip to the shore")!.id);
    expect(shelf[1]!.goalId).toBeNull();
    for (const item of shelf) expect(item.marks).toBeGreaterThanOrEqual(0);
    expect(queenShelf({ categories: [] }, h)).toEqual([]);
  });
});
