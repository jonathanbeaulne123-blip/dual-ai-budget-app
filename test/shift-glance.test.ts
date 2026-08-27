import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/calendar.ts";
import {
  catalogHousehold,
  clockInShift,
  herculesPageSurface,
  planHerculesTurn,
  seedDemoHousehold,
  shiftClimateSeals,
  shiftFloorOracle,
  shiftLivePreview,
  shiftOracleChipTalk,
  shiftReportGlance,
  shiftSaucerBoard,
  workReportFacts,
} from "../src/core/index.ts";

const today = "2026-08-27";
const memberId = "MEM-002";

describe("shift glance projections", () => {
  it("builds seven climate days, empties low-cadence weekdays, and never treats outlook as posted take-home", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const seals = shiftClimateSeals(household, today, { memberId });
    expect(seals).toHaveLength(7);
    expect(seals[0]!.date).toBe(today);
    expect(seals[6]!.date).toBe(addDays(today, 6));
    expect(seals.some((row) => row.tone === "empty" && row.sub === "off")).toBe(true);
    expect(seals.some((row) => row.tone !== "empty" && row.lowCents != null)).toBe(true);
    const rain = shiftClimateSeals(household, today, { memberId, weatherGlass: "rain" });
    const dry = shiftClimateSeals(household, today, { memberId, weatherGlass: "clear" });
    expect(rain[0]!.wet).toBe(rain[0]!.tone !== "empty");
    expect(dry[0]!.wet).toBe(false);
    expect(rain.slice(1).every((row) => !row.wet)).toBe(true);
    const posted = workReportFacts(household, memberId, `${today.slice(0, 7)}-01`, today);
    const live = seals.find((row) => row.highCents != null);
    expect(live?.highCents).not.toBe(posted.takeHomeWagesCents + posted.netTipsCents);
  });

  it("fills 28 saucers from posted dates only, so clock-in does not light a cup", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = shiftSaucerBoard(household, today, memberId);
    expect(before.days).toHaveLength(28);
    expect(before.days[27]!.date).toBe(today);
    expect(before.days.filter((day) => day.filled).length).toBeGreaterThan(0);
    expect(before.days.filter((day) => day.latest)).toHaveLength(1);
    const punched = clockInShift(household, { memberId }).household;
    const after = shiftSaucerBoard(punched, today, memberId);
    expect(after.days.filter((day) => day.filled).map((day) => day.date))
      .toEqual(before.days.filter((day) => day.filled).map((day) => day.date));
    expect(shiftLivePreview(punched, today, { memberId })?.caption).toMatch(/projection, not posted/i);
  });

  it("keeps the floor lamp dark under four tip shifts and educational vs posted on demo nights", () => {
    const empty = catalogHousehold("development");
    expect(shiftFloorOracle(empty, today, memberId)).toBeNull();
    const household = seedDemoHousehold({ today, environment: "development" });
    const oracle = shiftFloorOracle(household, today, memberId);
    expect(oracle).not.toBeNull();
    expect(oracle!.sampleShifts).toBeGreaterThanOrEqual(4);
    const glance = shiftReportGlance(household, today, memberId, "month");
    expect(glance.takeHomeCents).not.toBe(oracle!.p50Cents);
    expect(glance.taxMilk).not.toBeNull();
    expect(glance.taxMilk!.assumptions.join(" ")).toMatch(/educational|not CRA/i);
    expect(shiftOracleChipTalk(household, "Tonight?", today, memberId)?.spoken).toMatch(/projection|off the cadence|nights like this/i);
    expect(shiftOracleChipTalk(household, "Protect or chase?", today, memberId)?.spoken).toMatch(/protect|chase|even/i);
    expect(shiftOracleChipTalk(household, "Tax milk?", today, memberId)?.spoken).toMatch(/educational|tax milk/i);
  });
});

describe("Shift tab wiring", () => {
  it("centers Add in a 3|FAB|3 nav and moves Jobs off More", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    const css = readFileSync("src/styles.css", "utf8");
    const page = readFileSync("src/WorkShiftPage.tsx", "utf8");
    const herculesPage = readFileSync("src/core/herculesPage.ts", "utf8");
    const more = readFileSync("src/WorkShiftFlow.tsx", "utf8");
    expect(css).toMatch(/\.nav \{[\s\S]*grid-template-columns:\s*1fr 1fr 1fr 56px 1fr 1fr 1fr/);
    expect(app).toMatch(/aria-label="Calendar"/);
    expect(app).toMatch(/aria-label="Shifts"/);
    expect(app).toMatch(/tab === "shift"/);
    expect(app).toMatch(/<WorkShiftPage/);
    expect(app).not.toMatch(/<WorkJobsCard/);
    expect(app).not.toMatch(/<WorkShiftHistoryCard/);
    expect(app).not.toMatch(/<WorkReportCard/);
    expect(page).toMatch(/WorkJobsCard/);
    expect(page).toMatch(/WorkShiftHistoryCard/);
    expect(page).toMatch(/WorkReportCard/);
    expect(herculesPage).toMatch(/Tonight\?/);
    expect(more).not.toMatch(/More → Jobs/);
    expect(more).toMatch(/Shift → Jobs/);
  });

  it("keeps page-true Hercules chips on Shift and Home Log shift on Add", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const shift = herculesPageSurface("shift", household, today, new Date(`${today}T16:00:00Z`), { memberId, view: "household" });
    expect(shift.chips).toEqual(["Tonight?", "Protect or chase?", "Tax milk?"]);
    expect(shift.lesson).toMatch(/preview until Confirm/i);
    const home = planHerculesTurn(household, "Log shift", today, "home");
    expect(home.draft).toEqual({ kind: "shift", note: "" });
    const talk = planHerculesTurn(household, "Tonight?", today, "shift", "", { memberId, view: "household" });
    expect(talk.talk.spoken).toMatch(/projection|off the cadence|nights like this/i);
    expect(talk.draft).toBeNull();
  });
});
