import { describe, expect, it } from "vitest";
import {
  seedDemoHousehold,
  addRecurrence,
  buildDashboard,
  catalogHousehold,
  postEntry,
  categorySpendBars,
  defaultLayout,
  deskFaceOf,
  deskMonthSeals,
  leftoverProjection,
  monthKeyFromDateKey,
  monthSummary,
  monthInOutBars,
  parseOfficeLayout,
  paperBarPercents,
  paperHomeMosaic,
  setDeskFace,
  tipWeekdaySpark,
  wideDrawerIds,
  wideMosaicIds,
  WIDE_HERO_ID,
  WIDE_MOSAIC_LIMIT,
  applyPersonality,
} from "../src/core/index.ts";

describe("wide paper office mosaic", () => {
  it("keeps blotter off the mosaic and fills six stories", () => {
    const mosaic = wideMosaicIds({ hidden: [], lampLit: false });
    expect(mosaic).toHaveLength(WIDE_MOSAIC_LIMIT);
    expect(mosaic).not.toContain(WIDE_HERO_ID);
    expect(mosaic).not.toContain("calculator");
    expect(mosaic).not.toContain("chalkboard");
    expect(mosaic).toEqual(["wallet", "mail", "timesheet", "jars", "lamp", "claims"]);
  });

  it("puts Shared story tiles on the paper mosaic instead of a second stacked room", () => {
    const shared = paperHomeMosaic({ view: "household", hidden: [], lampLit: false });
    expect(shared).toHaveLength(WIDE_MOSAIC_LIMIT);
    expect(shared.filter((item) => item.slot === "story").map((item) => item.id)).toEqual(["now", "attention", "change"]);
    expect(shared.some((item) => item.slot === "instrument" && item.id === "timesheet")).toBe(false);
    const personal = paperHomeMosaic({ view: "personal", hidden: [], lampLit: false });
    expect(personal.filter((item) => item.slot === "story").map((item) => item.id)).toEqual(["mine", "position", "movement"]);
    expect(personal.some((item) => item.slot === "instrument" && item.id === "timesheet")).toBe(true);
  });

  it("guest-appends an expanded fill instrument without dropping the pad off-desk", () => {
    const mosaic = wideMosaicIds({ hidden: ["claims"], lampLit: false, expanded: "calendar" });
    expect(mosaic).toContain("calendar");
    expect(mosaic).not.toContain("claims");
    expect(mosaic.length).toBeLessThanOrEqual(WIDE_MOSAIC_LIMIT);
    expect(wideDrawerIds(mosaic)).toContain("chalkboard");
    expect(wideDrawerIds(mosaic)).not.toContain("calculator");
    expect(wideDrawerIds(mosaic)).not.toContain(WIDE_HERO_ID);
    expect(wideDrawerIds(mosaic, { includeHero: false })).toContain(WIDE_HERO_ID);
  });

  it("reveals Health onto the mosaic when the lamp is lit even if it was hidden", () => {
    const mosaic = wideMosaicIds({ hidden: ["lamp"], lampLit: true });
    expect(mosaic).toContain("lamp");
  });
});

describe("wide paper infographics", () => {
  it("projects month in/out and category spend from catalog cents", () => {
    const household = seedDemoHousehold({ environment: "development", today: "2026-08-21" });
    const dashboard = buildDashboard(household, "2026-08-21", new Date("2026-08-21T16:00:00Z"));
    const bars = monthInOutBars(dashboard.month);
    expect(bars.map((row) => row.label)).toEqual(["In", "Out"]);
    expect(bars.every((row) => Number.isInteger(row.cents))).toBe(true);
    expect(bars.some((row) => row.cents > 0)).toBe(true);
    const percents = paperBarPercents(bars);
    expect(percents.every((row) => row.pct >= 0 && row.pct <= 100)).toBe(true);
    const spend = categorySpendBars(dashboard.month.categories, 4);
    expect(spend.length).toBeLessThanOrEqual(4);
    expect(spend.every((row) => row.cents > 0)).toBe(true);
    const spark = tipWeekdaySpark(dashboard.tipWeather);
    expect(spark.length === 0 || spark.length === 7).toBe(true);
    expect(spark.every((row) => Number.isInteger(row.cents) && row.cents >= 0)).toBe(true);
  });

  it("returns no bars when the month is empty", () => {
    expect(monthInOutBars({ incomeActualCents: 0, expenseActualCents: 0 })).toEqual([]);
    expect(paperBarPercents([])).toEqual([]);
  });

  it("computes leftover spend from posted income minus posted expenses, including a hole", () => {
    expect(deskMonthSeals({ incomeActualCents: 0, expenseActualCents: 0 })).toEqual({
      inCents: 0,
      outCents: 0,
      leftoverCents: 0,
    });
    expect(deskMonthSeals({ incomeActualCents: 50_000, expenseActualCents: 12_000 })).toEqual({
      inCents: 50_000,
      outCents: 12_000,
      leftoverCents: 38_000,
    });
    expect(deskMonthSeals({ incomeActualCents: 10_000, expenseActualCents: 40_000 }).leftoverCents).toBe(-30_000);
  });

  it("keeps unpaid repeating bills out of Money out and leftover spend", () => {
    const today = "2026-09-01";
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: 2000,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-BIANCA",
      note: "Pay",
      confirmDuplicate: true,
    }).household;
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: today,
      type: "expense",
      amount: 1800,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Rent",
    }).household;
    const month = monthSummary(household, monthKeyFromDateKey(today));
    const seals = deskMonthSeals(month);
    expect(seals.outCents).toBe(0);
    expect(seals.leftoverCents).toBe(seals.inCents);
    expect(leftoverProjection(household, today).billsNext30Cents).toBeGreaterThan(0);
    expect(leftoverProjection(household, today).leftoverCents).not.toBe(seals.leftoverCents);
  });
});

describe("classic desk opt-in", () => {
  it("defaults fresh layouts to paper and keeps saved x/y desks classic", () => {
    expect(deskFaceOf(defaultLayout())).toBe("paper");
    expect(deskFaceOf(parseOfficeLayout({ v: 2, items: [{ id: "blotter" }] }))).toBe("paper");
    expect(deskFaceOf(parseOfficeLayout({
      v: 2,
      items: [{ id: "blotter", x: 16, y: 40 }],
    }))).toBe("classic");
    expect(deskFaceOf(setDeskFace(defaultLayout(), "classic"))).toBe("classic");
    expect(applyPersonality(defaultLayout(), "cpa").face).toBe("classic");
  });
});
