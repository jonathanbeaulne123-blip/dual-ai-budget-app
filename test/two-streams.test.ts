import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StreamsStage } from "../src/StreamsStage.tsx";
import {
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  proposeHouseholdFundContribution,
  streamWindowStart,
  twoStreams,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";

const coreSource = readFileSync(new URL("../src/core/twoStreams.ts", import.meta.url), "utf8");
const stageSource = readFileSync(new URL("../src/StreamsStage.tsx", import.meta.url), "utf8");
const plateFile = readFileSync(new URL("../src/core/fundPlates.ts", import.meta.url), "utf8");
const plateSource = plateFile.slice(plateFile.indexOf("function streamsPlate"), plateFile.indexOf("/** The ten Fund plates"));

// Thirteen even, twelve-day-apart marks — a genuinely regular stream.
const REGULAR_DATES = [
  "2026-04-01", "2026-04-13", "2026-04-25", "2026-05-07", "2026-05-19",
  "2026-05-31", "2026-06-12", "2026-06-24", "2026-07-06", "2026-07-18",
  "2026-07-30", "2026-08-11", "2026-08-23",
];

// Fourteen scattered marks — gaps range from two days to a month.
const IRREGULAR_DATES = [
  "2026-04-03", "2026-04-06", "2026-04-08", "2026-05-03", "2026-05-23",
  "2026-06-12", "2026-06-21", "2026-06-24", "2026-07-24", "2026-07-27",
  "2026-08-02", "2026-08-17", "2026-08-19", "2026-08-21",
];

function fund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA, openedOn: "2026-01-01", createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, memberId: string, amount: string, date: string): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId, contributorMemberId: memberId, amount, date,
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA, proposalEventId: proposed.postedIds[0]!,
  }).household;
}

describe("the two streams", () => {
  it("draws thirteen regular marks and fourteen irregular marks, with no aggregate field on either stream", () => {
    let household = fund();
    for (const date of REGULAR_DATES) household = contribute(household, BIANCA, "300", date);
    for (const date of IRREGULAR_DATES) household = contribute(household, JONATHAN, "150", date);

    const streams = twoStreams(household, TODAY);
    expect(streams).toHaveLength(2);
    const [first, second] = streams;
    expect(first!.memberId).toBe(BIANCA);
    expect(second!.memberId).toBe(JONATHAN);
    expect(first!.marks).toHaveLength(13);
    expect(second!.marks).toHaveLength(14);
    for (const stream of streams) {
      expect(Object.keys(stream).sort()).toEqual(["cadenceLabel", "marks", "memberId", "regular"]);
    }
  });

  it("calls the evenly spaced stream regular and the scattered one not", () => {
    let household = fund();
    for (const date of REGULAR_DATES) household = contribute(household, BIANCA, "300", date);
    for (const date of IRREGULAR_DATES) household = contribute(household, JONATHAN, "150", date);

    const [bianca, jonathan] = twoStreams(household, TODAY);
    expect(bianca!.regular).toBe(true);
    expect(bianca!.cadenceLabel).not.toBe("no fixed rhythm");
    expect(jonathan!.regular).toBe(false);
    expect(jonathan!.cadenceLabel).toBe("no fixed rhythm");
  });

  it("sorts streams by member id, and marks within a stream by date", () => {
    let household = fund();
    household = contribute(household, JONATHAN, "150", "2026-08-01");
    household = contribute(household, BIANCA, "300", "2026-06-01");
    household = contribute(household, BIANCA, "300", "2026-04-01");

    const [first, second] = twoStreams(household, TODAY);
    expect(first!.memberId).toBe(BIANCA);
    expect(second!.memberId).toBe(JONATHAN);
    expect(first!.marks.map((mark) => mark.date)).toEqual(["2026-04-01", "2026-06-01"]);
  });

  it("returns nothing before a Fund exists, and nothing before a contribution has landed", () => {
    const noFund = catalogHousehold();
    expect(twoStreams(noFund, TODAY)).toEqual([]);
    expect(twoStreams(fund(), TODAY)).toEqual([]);
  });

  it("leaves out a contribution whose contributor was never recorded", () => {
    let household = fund();
    household = contribute(household, BIANCA, "300", "2026-08-01");
    // A legacy/migrated row with no contributor — the type has no room for
    // a third, unattributed stream, so this money is left out rather than
    // invented a home.
    const existingEvents = household.fundEvents ?? [];
    const legacy = structuredClone(existingEvents.at(-1)!);
    household = {
      ...household,
      fundEvents: [
        ...existingEvents,
        { ...legacy, id: `${legacy.id}-legacy`, contributorMemberId: null, date: "2026-08-05" },
      ],
    };

    const streams = twoStreams(household, TODAY);
    expect(streams).toHaveLength(1);
    expect(streams[0]!.marks).toHaveLength(1);
  });

  it("uses the exact six-calendar-month window and rejects invalid window sizes", () => {
    let household = fund();
    household = contribute(household, BIANCA, "300", "2026-03-31");
    household = contribute(household, BIANCA, "300", "2026-04-01");
    household = contribute(household, BIANCA, "300", TODAY);
    household = contribute(household, BIANCA, "300", "2026-09-13");

    const [bianca] = twoStreams(household, TODAY);
    expect(streamWindowStart(TODAY)).toBe("2026-04-01");
    expect(bianca!.marks.map((mark) => mark.date)).toEqual(["2026-04-01", TODAY]);
    expect(() => twoStreams(household, TODAY, 0)).toThrow(/positive integer/);
    expect(() => twoStreams(household, TODAY, 1.5)).toThrow(/positive integer/);
  });

  it("keeps same-day confirmations visible without inventing a zero-day rhythm", () => {
    let household = fund();
    household = contribute(household, BIANCA, "100", "2026-08-15");
    household = contribute(household, BIANCA, "125", "2026-08-15");
    household = contribute(household, BIANCA, "150", "2026-08-15");

    const [bianca] = twoStreams(household, TODAY);
    expect(bianca!.marks).toHaveLength(3);
    expect(bianca!.regular).toBe(false);
    expect(bianca!.cadenceLabel).toBe("not enough history yet");
    expect(stageSource).toContain("dateClusters");
    expect(stageSource).toContain('aria-hidden="true"');
    expect(stageSource).toContain('className="sr-only"');
  });

  it("qualifies a mostly matching weekday instead of promising an exact day", () => {
    let household = fund();
    for (const date of ["2026-06-01", "2026-06-15", "2026-06-30", "2026-07-13"]) {
      household = contribute(household, BIANCA, "100", date);
    }

    const [bianca] = twoStreams(household, TODAY);
    expect(bianca!.regular).toBe(true);
    expect(bianca!.cadenceLabel).toBe("about every two weeks, usually Monday");
  });

  it("does not call a tied weekday the usual day", () => {
    let household = fund();
    for (const date of ["2026-06-01", "2026-06-16", "2026-06-29", "2026-07-14"]) {
      household = contribute(household, BIANCA, "100", date);
    }

    const [bianca] = twoStreams(household, TODAY);
    expect(bianca!.regular).toBe(true);
    expect(bianca!.cadenceLabel).toBe("about every two weeks");
  });

  it("keeps every contributing member represented if legacy data contains more than two", () => {
    let household = fund();
    const template = household.members.find((member) => member.id === JONATHAN)!;
    household = { ...household, members: [...household.members, { ...structuredClone(template), id: "MEM-003", name: "Third" }] };
    household = contribute(household, BIANCA, "100", "2026-08-01");
    household = contribute(household, JONATHAN, "100", "2026-08-02");
    household = contribute(household, "MEM-003", "100", "2026-08-03");

    expect(twoStreams(household, TODAY).map((stream) => stream.memberId)).toEqual([BIANCA, JONATHAN, "MEM-003"]);
    expect(stageSource).toContain("streams.map");
  });

  it("renders every member's dates accessibly, same-day multiplicity included, without amounts", () => {
    const streams = [
      { memberId: BIANCA, marks: [{ date: "2026-08-01", amountCents: 10000, memberId: BIANCA }, { date: "2026-08-01", amountCents: 12500, memberId: BIANCA }], cadenceLabel: "not enough history yet", regular: false },
      { memberId: JONATHAN, marks: [{ date: "2026-08-02", amountCents: 20000, memberId: JONATHAN }], cadenceLabel: "not enough history yet", regular: false },
      { memberId: "MEM-003", marks: [{ date: "2026-08-03", amountCents: 30000, memberId: "MEM-003" }], cadenceLabel: "not enough history yet", regular: false },
    ];
    const html = renderToStaticMarkup(createElement(StreamsStage, {
      streams, today: TODAY, nameOf: (memberId: string) => ({ [BIANCA]: "Bianca", [JONATHAN]: "Jonathan", "MEM-003": "Third" })[memberId] ?? memberId,
    }));

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="sr-only"');
    expect(html).toContain("Aug 1, 2026 (2 confirmed contributions)");
    expect(html).toContain("Aug 2, 2026");
    expect(html).toContain("Aug 3, 2026");
    expect(html).toContain("×2");
    expect(html).toContain('class="streams-lane-label"');
    expect(html).not.toMatch(/\$|100\.00|125\.00|200\.00|300\.00/);
  });

  it("expands the drawing so many contributor lanes remain inside the viewBox", () => {
    const streams = Array.from({ length: 12 }, (_, index) => ({
      memberId: `MEM-${index}`,
      marks: [{ date: "2026-08-01" as const, amountCents: 10000, memberId: `MEM-${index}` }],
      cadenceLabel: "not enough history yet",
      regular: false,
    }));
    const html = renderToStaticMarkup(createElement(StreamsStage, {
      streams, today: TODAY, nameOf: (memberId: string) => memberId,
    }));

    expect(html).toContain('viewBox="0 0 520 336"');
    expect((html.match(/class="streams-mark"/g) ?? [])).toHaveLength(12);
    expect((html.match(/class="streams-lane-label"/g) ?? [])).toHaveLength(12);
  });

  it("never computes a total, a percent, a ratio, a rank, or a comparison between the two streams", () => {
    for (const source of [coreSource, stageSource, plateSource]) {
      expect(source).not.toMatch(/total|percent|ratio|rank|share|more than|less than/i);
    }
  });

  it("cannot post, settle, or move a cent", () => {
    for (const source of [coreSource, stageSource, plateSource]) {
      expect(source).not.toMatch(/\b(postEntry|postTransfer|confirmHouseholdFundSettlement|commit)\s*\(/);
    }
  });
});
