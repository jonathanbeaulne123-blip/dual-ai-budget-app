import { describe, expect, it } from "vitest";
import { catalogHousehold, shapeWorkJob, takeHomeBasis, upsertWorkJob, postWorkShift, type WorkJob, type WorkRatePeriod } from "../src/core/index.ts";
import { actionById, executeReviewedAction, findHerculesAction, prepareAction, type ActionContext } from "../src/core/herculesActions.ts";

const context = (view: "household" | "personal" = "household"): ActionContext =>
  ({ household: catalogHousehold(), memberId: "MEM-001", view, today: "2026-09-12" });

const rate = (over: Partial<WorkRatePeriod>): WorkRatePeriod => ({
  id: "RATE-1", effectiveDate: "2026-01-01", grossHourlyRateCents: 1800,
  takeHomeMode: "direct", takeHomeHourlyRateCents: 0, deductions: [],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...over,
});

function unknownTakeHomeJob(): WorkJob {
  return shapeWorkJob({
    id: "", memberId: "MEM-001", name: "Cafe Moonbeam", color: "#a85a3d", active: true,
    timezone: "America/Toronto", locationName: "Toronto", gpsEnabled: false,
    roles: [{
      id: "ROLE-SERVER", name: "Server", tipped: false, active: true,
      rates: [rate({})],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    }],
    paidBreakRate: "role", paidBreakHourlyRateCents: 0,
    overtimeEnabled: false, overtimeWeeklyThresholdHours: 44, overtimeMultiplier: 1.5,
    tipOutRules: [], salesFields: [],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: "ACC-CASH", cardTipsDepositAccountId: "ACC-CASH" },
    wagesReceivableAccountId: "", cardTipsReceivableAccountId: "", note: "",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("Hercules reaches a Kitty Bank by the product's own name", () => {
  it.each([
    "Create a Kitty Bank called Date Night",
    "Add a kitty bank for a trip",
    "Start a savings goal called Date Night",
    "Make a money jar for the car",
  ])("routes %j to the goal adapter", message => {
    expect(findHerculesAction(message, context())?.id).toBe("goal");
  });

  it("names the capability Kitty Bank wherever it is shown", () => {
    expect(actionById("goal", context()).title).toBe("Create a Kitty Bank");
  });

  it("still treats questions and denials as questions", () => {
    const c = context();
    for (const message of ["What is a Kitty Bank?", "I did not create a goal", "How do I add a kitty bank?"])
      expect(findHerculesAction(message, c)).toBeUndefined();
  });

  it("does not steal an account request", () => {
    expect(findHerculesAction("add a chequing account", context())?.id).toBe("add-account");
  });
});

describe("A Kitty Bank target date stays optional through review and confirm", () => {
  it("reviews and confirms an unfunded bank with no target date, reserving nothing", () => {
    const c = context();
    const before = structuredClone(c.household);
    const review = prepareAction(c, "goal", { name: "Date Night", target: "100" });

    expect(c.household).toEqual(before);
    expect(review.rows.some(row => row.label === "Target date")).toBe(false);
    expect(review.consequence).toMatch(/does not allocate or transfer money/i);

    const result = executeReviewedAction(c, review, crypto.randomUUID());
    const goal = result.household.goals.at(-1)!;

    expect(goal).toMatchObject({ name: "Date Night", targetCents: 10000, deadline: null, arrivalDate: null, savedCents: 0, status: "unfunded", funded: false });
    expect(result.household.transactions).toEqual(c.household.transactions);
    expect(result.household.goalContributions ?? []).toEqual(c.household.goalContributions ?? []);
  });

  it("still accepts a supplied target date", () => {
    const c = context();
    const review = prepareAction(c, "goal", { name: "Date Night", target: "100", deadline: "2026-12-24" });
    expect(review.rows.find(row => row.label === "Target date")?.value).toBe("2026-12-24");
    expect(executeReviewedAction(c, review, crypto.randomUUID()).household.goals.at(-1)!.deadline).toBe("2026-12-24");
  });

  it("requires the details that are genuinely required", () => {
    expect(() => prepareAction(context(), "goal", { name: "Date Night" })).toThrow(/amount is required|missing details/i);
  });
});

describe("Unknown take-home is never rendered or posted as zero take-home", () => {
  it("separates unknown, supplied and calculated take-home", () => {
    expect(takeHomeBasis(rate({}))).toBe("unknown");
    expect(takeHomeBasis(rate({ takeHomeHourlyRateCents: 1400 }))).toBe("supplied");
    expect(takeHomeBasis(rate({ takeHomeMode: "deductions", deductions: [{ id: "TAX", label: "Tax", percent: 22 }] }))).toBe("calculated");
  });

  it("refuses a shift whose take-home is unset and says why", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: unknownTakeHomeJob() }).household;
    const savedJob = saved.workJobs[0]!;
    expect(() => postWorkShift(saved, {
      date: "2026-09-12", memberId: "MEM-001", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 6, paidBreakHours: 0, salesByField: {}, customersServed: 0, staffingCount: 1,
      eventTag: "regular", createdBy: "MEM-001",
    })).toThrow(/take-home is not set/i);
  });

  it("posts the same shift once take-home is calculated from deductions", () => {
    const job = unknownTakeHomeJob();
    job.roles[0]!.rates = [rate({ takeHomeMode: "deductions", deductions: [{ id: "TAX", label: "Tax", percent: 22 }] })];
    const saved = upsertWorkJob(catalogHousehold(), { job }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-09-12", memberId: "MEM-001", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 6, paidBreakHours: 0, salesByField: {}, customersServed: 0, staffingCount: 1,
      eventTag: "regular", createdBy: "MEM-001",
    });
    expect(posted.household.shifts.at(-1)).toBeTruthy();
    expect(posted.postedIds.length).toBeGreaterThan(0);
  });
});
