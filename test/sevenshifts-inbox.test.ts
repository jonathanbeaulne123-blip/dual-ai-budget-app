import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  compileHousehold,
  composeHerculesChatRequest,
  herculesBriefing,
  hoursFromSevenShiftsPunch,
  parseSevenShiftsInbox,
  postedSevenShiftsPunchDigests,
  postWorkShift,
  reversePostedMoney,
  runHealthCheck,
  sevenShiftsDisplayName,
  trialBalance,
  upsertWorkJob,
  type SevenShiftsInboxPayload,
  type WorkJob,
} from "../src/core/index.ts";

const PULL = `s7pull_${"a".repeat(64)}`;
const PUNCH = `s7punch_${"b".repeat(64)}`;
const OPEN = `s7punch_${"c".repeat(64)}`;

function job(): WorkJob {
  return {
    id: "JOB-HARBOUR",
    memberId: "MEM-002",
    name: "Harbour",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: false,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [{
        id: "RATE-1",
        effectiveDate: "2026-01-01",
        grossHourlyRateCents: 1800,
        takeHomeMode: "direct",
        takeHomeHourlyRateCents: 1500,
        deductions: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: false,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [],
    salesFields: [],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "personal",
      cashTipsVisibility: "personal",
      cardTipsVisibility: "personal",
      tipOutVisibility: "personal",
      wagesDepositAccountId: "ACC-CHEQUING",
      cashTipsAccountId: "ACC-CASH",
      cardTipsDepositAccountId: "ACC-CASH",
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  };
}

function payload(overrides: Partial<SevenShiftsInboxPayload> = {}): SevenShiftsInboxPayload {
  return {
    provider: "7shifts",
    sourceName: "Harbour",
    sourceHash: PULL,
    jobId: "JOB-HARBOUR",
    punches: [{
      stablePunchId: PUNCH,
      date: "2026-08-26",
      startedAt: "2026-08-26T15:12:00.000Z",
      endedAt: "2026-08-26T20:47:00.000Z",
      workedHours: 5.08,
      paidBreakHours: 0.5,
      roleName: "Server",
      locationName: "Harbour",
      open: false,
      tipsOmitted: true,
    }],
    coworkers: [{
      displayName: "Alex P.",
      roleName: "Host",
      date: "2026-08-26",
      status: "scheduled",
    }],
    ...overrides,
  };
}

describe("7shifts Timesheet inbox", () => {
  it("computes worked hours minus paid and unpaid breaks and treats a missing clock-out as open", () => {
    const closed = hoursFromSevenShiftsPunch({
      clocked_in: "2026-08-26T15:00:00.000Z",
      clocked_out: "2026-08-26T20:00:00.000Z",
      breaks: [
        { in: "2026-08-26T17:00:00.000Z", out: "2026-08-26T17:30:00.000Z", paid: true },
        { start: "2026-08-26T18:00:00.000Z", end: "2026-08-26T18:15:00.000Z", paid: false },
      ],
    });
    expect(closed.open).toBe(false);
    expect(closed.elapsedHours).toBe(5);
    expect(closed.paidBreakHours).toBe(0.5);
    expect(closed.unpaidBreakHours).toBe(0.25);
    expect(closed.workedHours).toBe(4.25);

    const open = hoursFromSevenShiftsPunch({
      clocked_in: "2026-08-26T15:00:00.000Z",
      clocked_out: null,
    }, Date.parse("2026-08-26T16:00:00.000Z"));
    expect(open.open).toBe(true);
    expect(open.elapsedHours).toBe(1);
  });

  it("redacts coworker names to first name plus last initial and never uses an email", () => {
    expect(sevenShiftsDisplayName({
      first_name: "Bianca",
      last_name: "Example",
      preferred_first_name: "Bianca",
      preferred_last_name: "Example",
    })).toBe("Bianca E.");
    expect(sevenShiftsDisplayName({ first_name: "Alex" })).toBe("Alex");
    expect(sevenShiftsDisplayName({ first_name: "alex@example.com", last_name: "Park" })).toBe("Coworker");
    expect(sevenShiftsDisplayName({ first_name: "5555551234" })).toBe("Coworker");
    expect(sevenShiftsDisplayName({ first_name: "416-555-1212" })).toBe("Coworker");
    expect(sevenShiftsDisplayName({ first_name: "(416) 555 1212" })).toBe("Coworker");
    expect(sevenShiftsDisplayName({ first_name: "Dock 416", last_name: "Five" })).toBe("Dock 416 F.");
  });

  it("fills hours and role, leaves cash and card tips empty, and does not mint household members", () => {
    const parsed = parseSevenShiftsInbox(payload(), [job()]);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0]).toEqual(expect.objectContaining({
      date: "2026-08-26",
      jobId: "JOB-HARBOUR",
      roleId: "ROLE-SERVER",
      workedHours: 5.08,
      paidBreakHours: 0.5,
      cashTips: "",
      cardTips: "",
      punchDigest: PUNCH,
    }));
    expect(parsed.coworkers).toEqual([{ displayName: "Alex P.", roleName: "Host", date: "2026-08-26", status: "scheduled" }]);
    expect(JSON.stringify(parsed)).not.toMatch(/cashTips":"[1-9]|cardTips":"[1-9]|@|hourly_wage|tips":/);
  });

  it("refuses tip amounts, emails, and tokens in the inbox payload", () => {
    expect(() => parseSevenShiftsInbox({
      ...payload(),
      punches: [{ ...payload().punches[0]!, tipsOmitted: true, cashTips: "12.00" } as never],
    }, [job()])).toThrow(/tip/i);
    expect(() => parseSevenShiftsInbox({
      ...payload(),
      coworkers: [{ displayName: "alex@example.com", roleName: "Host", date: "2026-08-26", status: "scheduled" }],
    }, [job()])).toThrow(/unsafe label/);
    expect(() => parseSevenShiftsInbox({
      ...payload(),
      sourceName: "Harbour",
      access_token: "secret-token",
    } as never, [job()])).toThrow(/forbidden field/);
  });

  it("rejects every unknown wage or tip field at both payload boundaries", () => {
    for (const field of ["hourlyWage", "wage_cents", "tip_amount", "tip_cents"]) {
      expect(() => parseSevenShiftsInbox({ ...payload(), [field]: 123 } as never, [job()])).toThrow(/tip|wage/i);
      expect(() => parseSevenShiftsInbox({
        ...payload(),
        punches: [{ ...payload().punches[0]!, [field]: 123 } as never],
      }, [job()])).toThrow(/tip|wage/i);
    }
  });

  it("rejects unsafe company, role, location, and coworker labels at the browser boundary", () => {
    expect(() => parseSevenShiftsInbox(payload({ sourceName: "harbour@example.com" }), [job()])).toThrow(/unsafe label/);
    expect(() => parseSevenShiftsInbox(payload({
      punches: [{ ...payload().punches[0]!, roleName: "Call 416-555-1212" }],
    }), [job()])).toThrow(/unsafe label/);
    expect(() => parseSevenShiftsInbox(payload({
      punches: [{ ...payload().punches[0]!, locationName: "dock@example.com" }],
    }), [job()])).toThrow(/unsafe label/);
    expect(() => parseSevenShiftsInbox(payload({
      coworkers: [{ ...payload().coworkers[0]!, roleName: "Host (416) 555-1212" }],
    }), [job()])).toThrow(/unsafe label/);
  });

  it("turns bounded degradation codes into fixed browser copy while preserving the punch", () => {
    const parsed = parseSevenShiftsInbox(payload({ warningCodes: ["coworker-roster-incomplete"] }), [job()]);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.warnings).toEqual([
      "7shifts could not fully load the Co-workers roster. Your punch is still ready to review.",
    ]);
  });

  it("skips open punches and already-posted digests instead of double-filling Timesheet", () => {
    const parsed = parseSevenShiftsInbox(payload({
      punches: [
        payload().punches[0]!,
        {
          ...payload().punches[0]!,
          stablePunchId: OPEN,
          open: true,
          endedAt: null,
          date: "2026-08-27",
        },
      ],
    }), [job()], [PUNCH]);
    expect(parsed.drafts).toHaveLength(0);
    expect(parsed.warnings.join(" ")).toMatch(/already on the books/i);
    expect(parsed.warnings.join(" ")).toMatch(/still clocked/i);
  });

  it("posts wages from a 7shifts draft with empty tips and refuses the same punch twice", () => {
    const saved = upsertWorkJob(catalogHousehold(), { job: job() }).household;
    const savedJob = saved.workJobs[0]!;
    const draft = parseSevenShiftsInbox(payload({ jobId: savedJob.id }), saved.workJobs).drafts[0]!;
    expect(draft.cashTips).toBe("");
    expect(draft.cardTips).toBe("");
    const posted = postWorkShift(saved, {
      date: draft.date,
      memberId: "MEM-002",
      jobId: draft.jobId,
      roleId: draft.roleId,
      workedHours: draft.workedHours,
      paidBreakHours: draft.paidBreakHours,
      cashTips: draft.cashTips,
      cardTips: draft.cardTips,
      customersServed: 0,
      staffingCount: 1,
      eventTag: "regular",
      cashTipsAccountId: "ACC-CASH",
      sevenShiftsPunchDigest: draft.punchDigest,
      createdBy: "MEM-002",
    });
    const shift = posted.household.shifts.at(-1)!;
    expect(shift.sevenShiftsPunchDigest).toBe(PUNCH);
    expect(shift.cashTipsCents).toBe(0);
    expect(shift.ccTipsCents).toBe(0);
    expect(shift.hours).toBeGreaterThan(0);
    expect(postedSevenShiftsPunchDigests(posted.household)).toContain(PUNCH);
    expect(shift.wagesCents).toBe(8_370);
    expect(shift.cashTipsCents).toBe(0);
    expect(shift.ccTipsCents).toBe(0);
    const books = compileHousehold(posted.household);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(runHealthCheck(posted.household)).toEqual([]);
    expect(() => postWorkShift(posted.household, {
      date: draft.date,
      memberId: "MEM-002",
      jobId: draft.jobId,
      roleId: draft.roleId,
      workedHours: 1,
      paidBreakHours: 0,
      cashTips: "",
      cardTips: "",
      customersServed: 0,
      staffingCount: 1,
      eventTag: "regular",
      cashTipsAccountId: "ACC-CASH",
      sevenShiftsPunchDigest: `s7punch_${"d".repeat(64)}`,
      createdBy: "MEM-002",
    })).toThrow(/already has a .* shift on/);
    expect(() => postWorkShift(posted.household, {
      date: draft.date,
      memberId: "MEM-002",
      jobId: draft.jobId,
      roleId: draft.roleId,
      workedHours: draft.workedHours,
      paidBreakHours: draft.paidBreakHours,
      cashTips: "",
      cardTips: "",
      customersServed: 0,
      staffingCount: 1,
      eventTag: "regular",
      cashTipsAccountId: "ACC-CASH",
      sevenShiftsPunchDigest: draft.punchDigest,
      confirmDuplicate: true,
      createdBy: "MEM-002",
    })).toThrow(/already on the books/);

    const reversed = reversePostedMoney(posted.household, shift.transactionIds![0]!, { createdBy: "MEM-002" }).household;
    expect(postedSevenShiftsPunchDigests(reversed)).not.toContain(PUNCH);
    expect(parseSevenShiftsInbox(payload({ jobId: savedJob.id }), reversed.workJobs, postedSevenShiftsPunchDigests(reversed)).drafts).toHaveLength(1);

    const briefing = herculesBriefing(posted.household, "home", "2026-08-26");
    const request = composeHerculesChatRequest(posted.household, "what did I make", briefing, "2026-08-26", "MEM-002");
    expect(JSON.stringify(request)).not.toMatch(/Alex P\.|7shifts access|s7c_|s7user_|example\.com/);
  });
});
