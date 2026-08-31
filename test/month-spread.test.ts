import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COURSE_VIEW,
  buildSharedLedgerStory,
  catalogHousehold,
  configureHouseholdFund,
  courseBottom,
  courseScale,
  courseTop,
  courseX,
  coursePaths,
  dayOfDateKey,
  projectHouseholdFund,
  seedDemoHousehold,
  sharedMonthCourse,
} from "../src/core/index.ts";

const TODAY = "2026-08-27";
const BIANCA = "MEM-001";

const spread = readFileSync(new URL("../src/MonthSpread.tsx", import.meta.url), "utf8");
const officeWide = readFileSync(new URL("../src/OfficeWide.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/month-spread.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

function demo(today = TODAY) {
  return seedDemoHousehold({ environment: "development", today });
}

describe("sharedMonthCourse ties to the Fund projection", () => {
  it("folds the same arithmetic projectHouseholdFund does, on every seeded month", () => {
    for (const today of ["2026-06-11", "2026-07-04", "2026-08-01", TODAY, "2026-08-31"]) {
      const household = demo(today);
      const course = sharedMonthCourse(household, today);
      const projection = projectHouseholdFund(household, today);
      expect(course.tiesToProjection).toBe(true);
      expect(course.operatingCents).toBe(projection.operatingBalanceCents);
      expect(course.kittyCents).toBe(projection.kittyCents);
      expect(course.conservationCents).toBe(projection.operatingBalanceCents + projection.kittyCents);
    }
  });

  it("carries the month in from before the month start rather than restarting at zero", () => {
    const household = demo();
    const course = sharedMonthCourse(household, TODAY);
    expect(course.openingOperatingCents).toBeGreaterThan(0);
    expect(course.openingKittyCents).toBeGreaterThan(0);
    expect(course.points[0]!.date).toBe(course.monthStart);
    expect(course.points[0]!.event).toBeNull();
  });

  it("never lets a claim move the operating pool", () => {
    const household = demo();
    const course = sharedMonthCourse(household, TODAY);
    expect(course.claims.length).toBeGreaterThan(0);
    const claimDates = new Set(course.claims.map((claim) => claim.date));
    for (const point of course.points.slice(1)) {
      expect(point.event?.kind === "purchase-funded" || point.event?.kind === "refund-funded").toBe(false);
    }
    expect(claimDates.size).toBeGreaterThan(0);
  });
});

describe("the conservation rule is drawn, not asserted in prose", () => {
  it("leaves operating plus Kitty unchanged across a rollover, in cents", () => {
    const household = demo();
    const course = sharedMonthCourse(household, TODAY);
    const index = course.points.findIndex((point) => point.event?.kind === "kitty-allocated");
    expect(index).toBeGreaterThan(0);
    const before = course.points[index - 1]!;
    const after = course.points[index]!;
    expect(after.operatingCents + after.kittyCents).toBe(before.operatingCents + before.kittyCents);
    expect(after.operatingCents).toBeLessThan(before.operatingCents);
    expect(after.kittyCents).toBeGreaterThan(before.kittyCents);
  });

  it("leaves the drawn heights either side of the rollover equal, in pixels", () => {
    const household = demo();
    const course = sharedMonthCourse(household, TODAY);
    const { scale } = coursePaths(course);
    const index = course.points.findIndex((point) => point.event?.kind === "kitty-allocated");
    const before = course.points[index - 1]!;
    const after = course.points[index]!;
    const heightBefore = courseBottom(before.kittyCents, scale) - courseTop(before.operatingCents, scale);
    const heightAfter = courseBottom(after.kittyCents, scale) - courseTop(after.operatingCents, scale);
    expect(Math.abs(heightBefore - heightAfter)).toBeLessThan(0.01);
  });

  it("uses one scale for both sides of the baseline", () => {
    const scale = courseScale(500_000, 100_000);
    const dollarUp = COURSE_VIEW.baseline - courseTop(100_00, scale);
    const dollarDown = courseBottom(100_00, scale) - COURSE_VIEW.baseline;
    expect(dollarUp).toBeCloseTo(dollarDown, 10);
    // Neither side may overflow its room.
    expect(courseTop(500_000, scale)).toBeGreaterThanOrEqual(COURSE_VIEW.baseline - COURSE_VIEW.topRoom - 0.01);
    expect(courseBottom(100_000, scale)).toBeLessThanOrEqual(COURSE_VIEW.baseline + COURSE_VIEW.bottomRoom + 0.01);
  });
});

describe("nothing right of today is drawn as posted", () => {
  it("stops the posted paths at today and starts the hatched future there", () => {
    const household = demo();
    const course = sharedMonthCourse(household, TODAY);
    const paths = coursePaths(course);
    for (const point of course.points.slice(0, course.todayIndex + 1)) {
      expect(point.date <= TODAY).toBe(true);
    }
    const xToday = courseX(dayOfDateKey(TODAY), course.daysInMonth);
    expect(paths.operating.endsWith(`${xToday} ${courseTop(course.points[course.todayIndex]!.operatingCents, paths.scale)}`)).toBe(true);
    expect(paths.future.startsWith(`M ${xToday} `)).toBe(true);
    expect(spread).toContain('data-posted="false"');
    expect(css).toContain("stroke-dasharray: 4 4");
  });

  it("puts the reserve notch after today, never behind it", () => {
    const household = demo();
    const course = sharedMonthCourse(household, TODAY);
    const paths = coursePaths(course);
    expect(course.upcomingReserveCents).toBeGreaterThan(0);
    expect(paths.reserveDay).not.toBeNull();
    expect(paths.reserveDay!).toBeGreaterThan(dayOfDateKey(TODAY));
  });
});

describe("the state the product is actually in", () => {
  it("gives an unopened Fund an empty staff rather than a wrong picture", () => {
    const household = catalogHousehold();
    const course = sharedMonthCourse(household, TODAY);
    expect(course.configured).toBe(false);
    expect(course.tiesToProjection).toBe(true);
    expect(course.points).toHaveLength(1);
    expect(coursePaths(course).scale).toBe(0);
    expect(spread).toContain("The Fund is not open yet. The first Confirm draws the first step.");
  });

  it("draws nothing when a configured Fund has no month yet", () => {
    const household = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: BIANCA,
      openedOn: TODAY,
      createdBy: BIANCA,
    }).household;
    const course = sharedMonthCourse(household, TODAY);
    expect(course.configured).toBe(true);
    expect(course.points).toHaveLength(1);
    expect(coursePaths(course).scale).toBe(0);
  });

  it("refuses to draw a course that does not tie", () => {
    expect(spread).toContain("course.tiesToProjection");
    expect(spread).toContain("This drawing did not tie to the Fund. Open the household table.");
  });
});

describe("the Development kitchen can take the picture", () => {
  it("seeds a configured Fund with a month worth drawing", () => {
    const household = demo();
    const course = sharedMonthCourse(household, TODAY);
    const story = buildSharedLedgerStory(household, TODAY);
    expect(course.configured).toBe(true);
    expect(course.points.length).toBeGreaterThan(4);
    expect(course.claims.length).toBeGreaterThan(3);
    expect(coursePaths(course).scale).toBeGreaterThan(0);
    expect(story.queue.length).toBeGreaterThan(0);
    expect(story.trust.pendingProposalCount).toBe(1);
    expect(household.environment).toBe("development");
  });

  it("keeps the shared banks and the Kitty telling the same figure", () => {
    const household = demo();
    const projection = projectHouseholdFund(household, TODAY);
    const sharedGoalTotal = household.goals
      .filter((goal) => goal.shared && goal.status !== "retired")
      .reduce((sum, goal) => sum + goal.savedCents, 0);
    expect(projection.kittyCents).toBeGreaterThan(0);
    expect(sharedGoalTotal).toBeGreaterThanOrEqual(projection.kittyCents);
  });
});

describe("Month Spread fences", () => {
  it("is the Shared Home centre and does not evict the story panels", () => {
    expect(officeWide).toContain("<MonthSpread");
    expect(officeWide).toContain("<SharedLedgerStory");
    expect(officeWide).toContain("sharedMonthCourse(household, today)");
    expect(main).toContain('import "./month-spread.css";');
  });

  it("cannot post, settle, or move a cent", () => {
    expect(spread).not.toMatch(/\bpostEntry\b|\bpostTransfer\b|\bconfirmHouseholdFund|\ballocateHouseholdFundSurplus\b|\bonCommand\b/);
    expect(spread).toContain("money never moves without one");
  });

  it("never lets Fund free-to-spend be mistaken for the leftover on the seals", () => {
    expect(spread).toContain("Fund free-to-spend");
    expect(spread).toContain("the leftover on the seals above");
    expect(spread).not.toContain("safe to spend");
  });

  it("prints the custody disclosure in full and keeps a way through to the table", () => {
    expect(spread).toContain("story.trust.custodyDisclosure");
    expect(spread).toContain("story.trust.auditLabel");
  });

  it("keeps every figure on tabular numerals and every sign on more than colour", () => {
    expect(css).toContain("font-variant-numeric: tabular-nums lining-nums");
    expect(spread).toContain("−{formatCad(opening.transferDueCents)}");
    expect(spread).toContain("−{formatCad(opening.upcomingReserveCents)}");
  });

  it("gives the drawing a prose alternative and a keyboard path", () => {
    expect(spread).toContain("courseAria(course, monthLabel)");
    expect(spread).toContain("tabIndex={0}");
    expect(spread).toContain('aria-live="polite"');
    expect(css).toContain(".ms-event:focus-visible .ms-dot");
  });

  it("keeps motion behind a reduced-motion guard and scrolls wide content in its own box", () => {
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(css).toContain(".ms-course-scroll { overflow-x: auto; }");
    expect(css).toContain("@media (forced-colors: active)");
  });

  it("derives its four drawing colours from house tokens instead of inventing a palette", () => {
    expect(css).toContain("--ms-river: var(--pine)");
    expect(css).toContain("var(--felt)");
    expect(css).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
