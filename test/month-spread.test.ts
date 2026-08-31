import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COURSE_VIEW,
  HOUSEHOLD_FUND_ID,
  addAccount,
  addRecurrence,
  bindHouseholdFundBackingAccount,
  buildSharedLedgerStory,
  catalogHousehold,
  configureHouseholdFund,
  courseBottom,
  courseScale,
  courseTop,
  courseX,
  coursePaths,
  dayOfDateKey,
  fundRolloverByGoal,
  projectHouseholdFund,
  projectLedgerExperience,
  recordHouseholdFundReconciliation,
  seedDemoHousehold,
  sharedActionQueue,
  sharedMonthCourse,
} from "../src/core/index.ts";

const TODAY = "2026-08-27";
const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const RESERVE_DATE = "2026-09-01";

const spread = readFileSync(new URL("../src/MonthSpread.tsx", import.meta.url), "utf8");
const officeWide = readFileSync(new URL("../src/OfficeWide.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/month-spread.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const kitty = readFileSync(new URL("../src/KittyBanks.tsx", import.meta.url), "utf8");

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

  it("draws Course free-to-spend from accepted books, not Shared presentation", () => {
    let household = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: BIANCA,
      openedOn: RESERVE_DATE,
      createdBy: BIANCA,
    }).household;
    household = addAccount(household, {
      name: "Bianca savings backing",
      kind: "savings",
      ownerMemberId: BIANCA,
      scope: "personal",
      institution: "Private bank",
      last4: "1234",
    }).household;
    const backing = household.accounts.find((row) => row.name === "Bianca savings backing")!;
    household = bindHouseholdFundBackingAccount(household, { memberId: BIANCA, accountId: backing.id }).household;
    household = recordHouseholdFundReconciliation(household, {
      memberId: BIANCA,
      date: RESERVE_DATE,
      bankTotal: "2500",
      personalRemainder: "2500",
    }).household;
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: RESERVE_DATE,
      type: "expense",
      amount: 50,
      accountId: backing.id,
      subcategoryId: "SUB-LIFE-FUN",
      note: "Personal Fund-backed",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }).household;
    const shared = projectLedgerExperience(household, JONATHAN, "household", RESERVE_DATE);
    if (!shared.ok) throw new Error("expected ok");
    const story = buildSharedLedgerStory(shared.booksHousehold, RESERVE_DATE);
    const course = sharedMonthCourse(shared.booksHousehold, RESERVE_DATE);
    const scopedCourse = sharedMonthCourse(shared.scopedHousehold, RESERVE_DATE);
    expect(course.freeToSpendCents).toBe(story.opening.freeToSpendCents);
    expect(course.upcomingReserveCents).toBe(story.opening.upcomingReserveCents);
    expect(course.upcomingReserveCents).toBe(5000);
    expect(scopedCourse.upcomingReserveCents).toBe(0);
    expect(scopedCourse.freeToSpendCents).not.toBe(story.opening.freeToSpendCents);
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
    expect(officeWide).toContain("sharedMonthCourse(booksHousehold, today)");
    expect(officeWide).not.toContain("sharedMonthCourse(household, today)");
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
    expect(spread).toContain('role="figure"');
    expect(spread).toContain('role="button"');
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

describe("F-1 · a Kitty rollover is visible on the shelf", () => {
  it("reports what the Fund rolled into each named shared bank", () => {
    const household = demo();
    const rollover = fundRolloverByGoal(household);
    const shared = household.goals.filter((goal) => goal.shared && goal.status !== "retired");
    expect(rollover.allocatedCents).toBe(projectHouseholdFund(household, TODAY).kittyCents);
    expect(Object.keys(rollover.byGoalId).length).toBeGreaterThan(1);
    for (const goalId of Object.keys(rollover.byGoalId)) {
      expect(shared.some((goal) => goal.id === goalId)).toBe(true);
    }
    expect(Object.values(rollover.byGoalId).reduce((sum, cents) => sum + cents, 0)).toBe(rollover.allocatedCents);
  });

  it("does not pretend the cash moved into the goal", () => {
    const household = demo();
    const rollover = fundRolloverByGoal(household);
    const bank = household.goals.find((goal) => goal.shared && rollover.byGoalId[goal.id]);
    expect(bank).toBeTruthy();
    // D-161: the rollover is a claim recorded against the bank, never a deposit into it.
    expect(bank!.savedCents).not.toBe(rollover.byGoalId[bank!.id]);
    expect(kitty).toContain("fundRolloverByGoal(booksHousehold)");
    expect(kitty).toContain("The cash stays in the shared pool.");
  });

  it("never attributes a release to one bank", () => {
    const household = demo();
    const rollover = fundRolloverByGoal(household);
    expect(rollover.releasedCents).toBe(0);
    expect(kitty).toContain("released back to the pool and is not held against one bank");
  });
});

describe("F-2 · a reconciliation is dated by the day it covers", () => {
  it("reports the event date, not the moment it was typed", () => {
    let household = demo();
    const on = "2026-08-23";
    household = recordHouseholdFundReconciliation(household, {
      memberId: BIANCA,
      date: on,
      bankTotal: "9999",
      personalRemainder: "0",
    }).household;
    const projection = projectHouseholdFund(household, TODAY);
    expect(projection.lastReconciledAt).toBe(on);
    expect(projection.lastReconciledAt).not.toContain("T");
  });

  it("lets the weekly staleness check fire on a check typed today but covering an older week", () => {
    // The distinguishing case: recorded now, dated for the 10th. Keyed off
    // createdAt this looked current; keyed off the day it covers, it is stale.
    let household = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: BIANCA,
      openedOn: "2026-08-01",
      createdBy: BIANCA,
    }).household;
    household = recordHouseholdFundReconciliation(household, {
      memberId: BIANCA,
      date: "2026-08-10",
      bankTotal: "0",
      personalRemainder: "0",
    }).household;
    expect(projectHouseholdFund(household, TODAY).lastReconciledAt).toBe("2026-08-10");
    const queue = sharedActionQueue(household, TODAY);
    expect(queue.some((item) => item.kind === "reconciliation")).toBe(true);
  });

  it("does not nag when the check covers a day inside this week", () => {
    const household = demo();
    // The demo records its weekly check four days back — inside this week.
    expect(projectHouseholdFund(household, TODAY).lastReconciledAt).toBe("2026-08-23");
    expect(sharedActionQueue(household, TODAY).some((item) => item.kind === "reconciliation")).toBe(false);
  });
});

describe("F-3 · a monthly target is measured against this month", () => {
  it("counts only contributions confirmed in the month, not every one ever made", () => {
    const household = demo();
    const projection = projectHouseholdFund(household, TODAY);
    const monthConfirmed = 160000 + 90000 + 76000; // Aug 1, 8 and 22 on the demo kitchen
    expect(projection.confirmedContributionsCents).toBeGreaterThan(monthConfirmed);
    expect(projection.targetProgressCents).toBe(monthConfirmed);
    expect(projection.targetProgressCents).toBeLessThanOrEqual(projection.monthlyTargetCents);
  });
});

describe("F-5 · demo seeding cannot silently break a neighbour", () => {
  it("keeps the seeded Fund-backed bill on a category with no posted history", () => {
    const household = demo();
    const bill = household.recurrences.find((recurrence) => recurrence.fundingDefault?.fundId === HOUSEHOLD_FUND_ID);
    expect(bill).toBeTruthy();
    // A recurrence marks its category's rhythm "tracked". Seeding one on a
    // category that already has posted rows flips a rhythm assertion two
    // subsystems away, which is exactly how this broke the first time.
    const posted = household.transactions.filter((tx) => tx.subcategoryId === bill!.subcategoryId);
    expect(posted).toHaveLength(0);
  });
});
