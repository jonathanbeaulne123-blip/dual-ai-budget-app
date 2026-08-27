import { describe, expect, it } from "vitest";
import {
  assembleHousehold,
  calculateWorkShift,
  catalogHousehold,
  compileHousehold,
  booksEquation,
  bookBalanceAsOf,
  buildMonthBoard,
  postWorkShift,
  runHealthCheck,
  reversePostedMoney,
  settleWorkReceivable,
  payDeferredWorkTipOut,
  workOwedFacts,
  workReportFacts,
  shapeWorkJob,
  splitForSync,
  takeHomeHourlyRateCents,
  trialBalance,
  upsertWorkJob,
  workJobFingerprint,
  workRateForDate,
  type WorkJob,
} from "../src/core/index.ts";

function job(): WorkJob {
  return shapeWorkJob({
    id: "",
    memberId: "MEM-002",
    name: "Café Nola",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: true,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [
        { id: "RATE-OLD", effectiveDate: "2026-01-01", grossHourlyRateCents: 1800, takeHomeMode: "direct", takeHomeHourlyRateCents: 1500, deductions: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "RATE-NEW", effectiveDate: "2026-09-01", grossHourlyRateCents: 2000, takeHomeMode: "deductions", takeHomeHourlyRateCents: 0, deductions: [{ id: "TAX", label: "Tax", percent: 20 }], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [
      { id: "BAR", label: "Bar", basis: "total-sales", value: 1, roundingCents: 500, roundingMode: "up", timing: "immediate", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "FLOOR", label: "Floor", basis: "card-tips", value: 2, roundingCents: 1, roundingMode: "nearest", timing: "withheld", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    salesFields: [{ id: "FOOD", label: "Food", requirement: "required", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: "ACC-CASH", cardTipsDepositAccountId: "ACC-CASH" },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
}

describe("job-based shift foundation", () => {
  it("keeps dated role rates and calculates direct or deduction-based take-home", () => {
    const role = job().roles[0]!;
    expect(workRateForDate(role, "2026-08-31").id).toBe("RATE-OLD");
    expect(takeHomeHourlyRateCents(workRateForDate(role, "2026-08-31"))).toBe(1500);
    expect(workRateForDate(role, "2026-09-01").id).toBe("RATE-NEW");
    expect(takeHomeHourlyRateCents(workRateForDate(role, "2026-09-01"))).toBe(1600);
    expect(workJobFingerprint(job(), role.id, "2026-08-31")).not.toBe(workJobFingerprint(job(), role.id, "2026-09-01"));
  });

  it("separates paid-break income, overtime, immediate bar cash and withheld envelope tip-outs", () => {
    const result = calculateWorkShift(job(), "ROLE-SERVER", {
      date: "2026-08-31",
      workedHours: 3,
      paidBreakHours: 0.5,
      previousWeekHours: 43,
      salesCents: 100_000,
      cashTipsCents: 5_000,
      cardTipsCents: 10_000,
    });
    expect(result.regularHours).toBe(1);
    expect(result.overtimeHours).toBe(2);
    expect(result.paidBreakIncomeCents).toBe(750);
    expect(result.takeHomeWagesCents).toBe(6_750);
    expect(result.grossWagesCents).toBe(8_100);
    expect(result.immediateTipOutCents).toBe(1_000);
    expect(result.withheldTipOutCents).toBe(200);
    expect(result.cardTipsAfterTipOutCents).toBe(9_800);
    expect(result.netTipsCents).toBe(13_800);
  });

  it("adds employer-specific owed accounts without posting money and survives cloud envelope shaping", () => {
    const household = catalogHousehold();
    const beforeTransactions = household.transactions.length;
    const saved = upsertWorkJob(household, { job: job() });
    expect(saved.household.transactions).toHaveLength(beforeTransactions);
    expect(saved.household.workJobs).toHaveLength(1);
    const savedJob = saved.household.workJobs[0]!;
    expect(savedJob.wagesReceivableAccountId).toBeTruthy();
    expect(savedJob.cardTipsReceivableAccountId).toBeTruthy();
    expect(saved.household.accounts.find((account) => account.id === savedJob.wagesReceivableAccountId)?.kind).toBe("receivable");
    expect(saved.household.accounts.find((account) => account.id === savedJob.cardTipsReceivableAccountId)?.kind).toBe("receivable");

    const envelopes = splitForSync(saved.household, "MEM-002");
    const assembled = assembleHousehold(envelopes.shared, envelopes.personal);
    expect(assembled.workJobs[0]?.name).toBe("Café Nola");
    expect(assembled.workJobs[0]?.roles[0]?.rates).toHaveLength(2);
  });

  it("confirms one job shift into separate owed, cash-tip, card-tip, paid-break, and tip-out entries", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-08-31",
      memberId: "MEM-002",
      jobId: savedJob.id,
      roleId: "ROLE-SERVER",
      workedHours: 3,
      paidBreakHours: 0.5,
      salesByField: { FOOD: 1000 },
      cashTips: 50,
      cardTips: 100,
      cashTipsAccountId: "ACC-CASH",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    const shift = posted.household.shifts.at(-1)!;
    expect(shift.jobId).toBe(savedJob.id);
    expect(shift.grossWagesCents).toBe(6_300);
    expect(shift.wagesCents).toBe(5_250);
    expect(shift.transactionIds).toHaveLength(6);
    expect(posted.household.transactions.find((tx) => tx.id === shift.cashTipsTransactionId)?.accountId).toBe("ACC-CASH");
    expect(posted.household.transactions.find((tx) => tx.id === shift.cardTipsTransactionId)?.accountId).toBe(savedJob.cardTipsReceivableAccountId);
    expect(posted.household.transactions.find((tx) => tx.id === shift.paidBreakTransactionId)?.subcategoryId).toBe("SUB-INCOME-PAID-BREAKS");
    expect(shift.tipOutTransactionIds).toHaveLength(2);
    const books = compileHousehold(posted.household);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(booksEquation(books).holds).toBe(true);
    expect(runHealthCheck(posted.household)).toEqual([]);
  });

  it("stamps optional location and occurredAt onto every work-shift money row", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const occurredAt = "2026-08-31T17:15:00-04:00";
    const posted = postWorkShift(saved, {
      date: "2026-08-31",
      memberId: "MEM-002",
      jobId: savedJob.id,
      roleId: "ROLE-SERVER",
      workedHours: 5,
      salesByField: { FOOD: 800 },
      cashTips: 40,
      cardTips: 90,
      cashTipsAccountId: "ACC-CASH",
      occurredAt,
      location: {
        latitude: 43.6408,
        longitude: -79.3771,
        accuracyMeters: 12,
        capturedAt: "2026-08-31T21:15:00.000Z",
        label: "Harbourfront Centre, Toronto",
      },
      confirmDuplicate: true,
      createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    const shift = posted.household.shifts.at(-1)!;
    const stamped = posted.household.transactions.filter((tx) => shift.transactionIds?.includes(tx.id));
    expect(stamped.length).toBeGreaterThan(0);
    expect(stamped.every((tx) => tx.location?.label === "Harbourfront Centre, Toronto")).toBe(true);
    expect(stamped.every((tx) => tx.occurredAt === new Date(occurredAt).toISOString())).toBe(true);
  });

  it("corrects a job shift by reversing every component instead of deleting the shift", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, salesByField: { FOOD: 500 }, cashTips: 25, cardTips: 75,
      cashTipsAccountId: "ACC-CASH", confirmDuplicate: true, createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    const shift = posted.household.shifts.at(-1)!;
    const reversed = reversePostedMoney(posted.household, shift.transactionIds![0]!, { createdBy: "MEM-002" });
    expect(reversed.household.shifts.some((row) => row.id === shift.id)).toBe(true);
    for (const id of shift.transactionIds!) expect(reversed.household.transactions.some((tx) => tx.reversalOfId === id)).toBe(true);
    const books = compileHousehold(reversed.household);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(booksEquation(books).holds).toBe(true);
    expect(workReportFacts(reversed.household, "MEM-002", "2026-08-01", "2026-08-31").count).toBe(0);
    expect(buildMonthBoard(reversed.household, "2026-08", "2026-08-31").days.flatMap((day) => day.items).some((item) => item.id === `shift:${shift.id}`)).toBe(false);
  });

  it("projects owed pay on Calendar and settles it as a transfer without recognizing income twice", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, salesByField: { FOOD: 500 }, cashTips: 25, cardTips: 75,
      cashTipsAccountId: "ACC-CASH", confirmDuplicate: true, createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    }).household;
    const facts = workOwedFacts(posted, "2026-08-31", "MEM-002");
    const wages = facts.find((fact) => fact.kind === "wages")!;
    const board = buildMonthBoard(posted, wages.date.slice(0, 7), "2026-08-31");
    expect(board.days.flatMap((day) => day.items).some((item) => item.id === wages.id && item.kind === "work-pay")).toBe(true);
    const incomeBefore = booksEquation(compileHousehold(posted)).incomeCents;
    const settled = settleWorkReceivable(posted, {
      jobId: savedJob.id, kind: "wages", date: "2026-08-31", amount: wages.amountCents / 100,
      accountId: "ACC-CHEQUING", createdBy: "MEM-002",
    }).household;
    expect(bookBalanceAsOf(settled, savedJob.wagesReceivableAccountId, "2026-08-31")).toBe(0);
    expect(booksEquation(compileHousehold(settled)).incomeCents).toBe(incomeBefore);
  });

  it("keeps deferred tip-outs open until a worker confirms payment", () => {
    const deferredJob = job();
    deferredJob.tipOutRules = deferredJob.tipOutRules.map((rule) => rule.id === "BAR" ? { ...rule, timing: "deferred" } : rule);
    const saved = upsertWorkJob(catalogHousehold(), { job: deferredJob }).household;
    const savedJob = saved.workJobs[0]!;
    const posted = postWorkShift(saved, {
      date: "2026-08-31", memberId: "MEM-002", jobId: savedJob.id, roleId: "ROLE-SERVER",
      workedHours: 4, salesByField: { FOOD: 500 }, cashTips: 25, cardTips: 75,
      cashTipsAccountId: "ACC-CASH", confirmDuplicate: true, createdBy: "MEM-002",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    }).household;
    const waiting = workOwedFacts(posted, "2026-08-31", "MEM-002").find((fact) => fact.kind === "deferred-tipout")!;
    expect(waiting.amountCents).toBe(500);
    const reversed = reversePostedMoney(posted, posted.shifts.at(-1)!.transactionIds![0]!, { createdBy: "MEM-002" }).household;
    expect(workOwedFacts(reversed, "2026-08-31", "MEM-002").some((fact) => fact.kind === "deferred-tipout")).toBe(false);
    const paid = payDeferredWorkTipOut(posted, {
      jobId: savedJob.id, date: "2026-08-31", amount: 5, accountId: "ACC-CASH", createdBy: "MEM-002",
    }).household;
    expect(workOwedFacts(paid, "2026-08-31", "MEM-002").some((fact) => fact.kind === "deferred-tipout")).toBe(false);
    expect(paid.shifts.at(-1)?.deferredTipOutPaidCents).toBe(500);
    expect(runHealthCheck(paid)).toEqual([]);
  });
});
