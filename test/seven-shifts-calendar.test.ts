import { describe, expect, it } from "vitest";
import {
  executeHerculesReadToolPlan,
  mergePersonal,
  parseSevenShiftsCalendar,
  refreshSevenShiftsSchedule,
  seedDemoHousehold,
  shapeSevenShiftsSchedules,
  splitForSync,
  type WorkJob,
} from "../src/core/index.ts";

const job: WorkJob = {
  id: "JOB-CAFE", memberId: "MEM-002", name: "Café Nola", color: "#234", active: true,
  timezone: "America/Toronto", locationName: "King Street", gpsEnabled: false,
  roles: [{ id: "ROLE-SERVER", name: "Server", tipped: true, active: true, rates: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
  paidBreakRate: "role", paidBreakHourlyRateCents: 0, overtimeEnabled: false, overtimeWeeklyThresholdHours: 44, overtimeMultiplier: 1.5,
  tipOutRules: [], salesFields: [],
  paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
  tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
  tipWeekStartsOn: 1, defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "", cashTipsAccountId: "", cardTipsDepositAccountId: "" },
  wagesReceivableAccountId: "", cardTipsReceivableAccountId: "", note: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

const ics = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//7shifts//Personal Schedule//EN\r
BEGIN:VEVENT\r
UID:jonathan-20260901@example.7shifts.com\r
DTSTAMP:20260827T120000Z\r
DTSTART:20260901T210000Z\r
DTEND:20260902T030000Z\r
SUMMARY:Jonathan - Server - Café Nola\r
LOCATION:King Street\r
DESCRIPTION:Private party. Station note must not survive.\r
SEQUENCE:2\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:coworker-20260901@example.7shifts.com\r
DTSTART:20260901T220000Z\r
DTEND:20260902T020000Z\r
SUMMARY:Private Coworker - Server\r
LOCATION:King Street\r
DESCRIPTION:Cover Jonathan at close.\r
END:VEVENT\r
END:VCALENDAR\r
`;

describe("employee-accessible 7shifts calendar", () => {
  it("keeps only the current member shift and reduces coworkers to an anonymous overlap count", () => {
    const otherJob = { ...job, id: "JOB-OTHER", name: "Elsewhere", locationName: "" };
    const parsed = parseSevenShiftsCalendar({ source: ics, sourceName: "7shifts.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [job, otherJob], now: new Date("2026-08-27T12:00:00Z") });
    expect(parsed.eventsRead).toBe(2);
    expect(parsed.requiresSelfAssertion).toBe(false);
    expect(parsed.shifts).toHaveLength(1);
    expect(parsed.shifts[0]).toMatchObject({
      memberId: "MEM-002", date: "2026-09-01", scheduledMinutes: 360,
      jobId: "JOB-CAFE", roleId: "ROLE-SERVER", eventTag: "private_party",
      staffingCount: 2, staffingSource: "calendar-overlap", selfMatch: "member-name",
    });
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain("Private Coworker");
    expect(serialized).not.toContain("Cover Jonathan");
    expect(serialized).not.toContain("Station note");
  });

  it("requires a personal-feed assertion when the calendar does not identify the member", () => {
    const personal = ics.replace("Jonathan - ", "My shift - ").replace("Private Coworker - Server", "Other event");
    const parsed = parseSevenShiftsCalendar({ source: personal, sourceName: "7shifts.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [] });
    expect(parsed.requiresSelfAssertion).toBe(true);
    expect(parsed.shifts).toHaveLength(2);
    expect(parsed.shifts.every((row) => row.selfMatch === "personal-feed-assertion")).toBe(true);
    const household = seedDemoHousehold({ today: "2026-08-27", environment: "development" });
    expect(() => refreshSevenShiftsSchedule(household, { memberId: "MEM-002", createdBy: "MEM-002", schedules: parsed.shifts })).toThrow(/Confirm.*private 7shifts Calendar Sync feed/i);
    expect(refreshSevenShiftsSchedule(household, { memberId: "MEM-002", createdBy: "MEM-002", schedules: parsed.shifts, confirmedPersonalFeed: true }).household.sevenShiftsSchedules).toHaveLength(2);
  });

  it("rejects non-7shifts, ambiguous DST, oversized, cancelled, or structurally invalid schedules", () => {
    expect(() => parseSevenShiftsCalendar({ source: ics.replaceAll("7shifts", "other"), sourceName: "calendar.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [job] })).toThrow(/does not identify itself/i);
    expect(() => parseSevenShiftsCalendar({ source: ics.replace("PRODID:-//7shifts//Personal Schedule//EN", "PRODID:-//Other calendar//EN"), sourceName: "renamed-7shifts.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [job] })).toThrow(/does not identify itself/i);
    expect(() => parseSevenShiftsCalendar({ source: ics.replace("20260901T210000Z", "20260231T210000Z"), sourceName: "7shifts.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [job] })).toThrow(/real timestamp/i);
    expect(() => parseSevenShiftsCalendar({ source: ics.replace("20260827T120000Z", "not-a-time"), sourceName: "7shifts.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [job] })).toThrow(/complete calendar timestamp/i);
    expect(() => parseSevenShiftsCalendar({ source: ics.replace("20260901T210000Z", "20261101T013000").replace("20260902T030000Z", "20261101T023000").replace("DTSTART:", "DTSTART;TZID=America/Toronto:").replace("DTEND:", "DTEND;TZID=America/Toronto:"), sourceName: "7shifts.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [job] })).toThrow(/daylight-saving/i);
    expect(() => parseSevenShiftsCalendar({ source: ics.replace("SUMMARY:", `SUMMARY:${"x".repeat(9_000)}`), sourceName: "7shifts.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [job] })).toThrow(/oversized line/i);
  });

  it("saves only member-personal outlook rows and lets Hercules use the published date and duration", () => {
    const household = seedDemoHousehold({ today: "2026-08-27", environment: "development" });
    const parsed = parseSevenShiftsCalendar({ source: ics, sourceName: "7shifts.ics", memberId: "MEM-002", memberName: "Jonathan", jobs: [] });
    const saved = refreshSevenShiftsSchedule(household, { memberId: "MEM-002", createdBy: "MEM-002", schedules: parsed.shifts }).household;
    expect(saved.transactions).toEqual(household.transactions);
    expect(saved.shifts).toEqual(household.shifts);
    expect(saved.sevenShiftsSchedules).toHaveLength(1);
    const parts = splitForSync(saved, "MEM-002");
    expect(parts.personal.sevenShiftsSchedules).toHaveLength(1);
    expect("sevenShiftsSchedules" in parts.shared).toBe(false);

    const invalid = { ...parsed.shifts[0]!, memberId: "MEM-001" };
    expect(() => refreshSevenShiftsSchedule(saved, { memberId: "MEM-002", schedules: [invalid] })).toThrow(/invalid or cross-member/i);
    expect(shapeSevenShiftsSchedules([{ ...parsed.shifts[0], staffingCount: 900 }], "MEM-002")).toEqual([]);

    const cleared = refreshSevenShiftsSchedule(saved, { memberId: "MEM-002", createdBy: "MEM-002", schedules: [] }).household;
    const mergedPersonal = mergePersonal(parts.personal, splitForSync(cleared, "MEM-002").personal);
    expect(mergedPersonal.sevenShiftsSchedules).toEqual([]);
    const legacyClient = { ...parts.personal, lastCommittedAt: "2099-01-01T00:00:00.000Z" };
    delete legacyClient.sevenShiftsSchedules;
    expect(mergePersonal(parts.personal, legacyClient).sevenShiftsSchedules).toHaveLength(1);

    const plan = { calls: [{ id: "outlook-1", name: "shift_outlook", args: { member: "Jonathan", date: null, hours: null, meal: null, weatherGlass: null, eventTag: null, salesCents: null, customersServed: null, staffingCount: null } }] };
    const result = executeHerculesReadToolPlan(saved, plan, "2026-08-27", { memberId: "MEM-002", view: "personal" });
    expect(result.results[0]?.sentence).toMatch(/saved published 7shifts schedule/i);
    expect(result.results[0]?.sentence).toMatch(/6\.00h/);
  });
});
