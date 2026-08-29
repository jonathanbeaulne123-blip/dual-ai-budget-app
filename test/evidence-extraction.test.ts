import { describe, expect, it } from "vitest";
import { deriveEvidenceBytes, evidenceExtractionLimits } from "../workers/evidenceExtract.js";

const bytes = (value: string) => new TextEncoder().encode(value);
const field = (record: any, name: string) => record.observations.find((row: any) => row.field === name);
const browserBytes = (captureClass: string, path: string, body: unknown) => bytes(JSON.stringify({
  version: 1,
  captureClass,
  transport: "fetch",
  path,
  capturedAt: "2026-08-28T12:00:00.000Z",
  contentType: "application/json",
  body,
}));

describe("D-158 deterministic Evidence extraction", () => {
  it("extracts official-shape punches, detailed money, breaks, approval, and schema drift", () => {
    const result = deriveEvidenceBytes({
      captureKind: "browser-structured",
      contentType: "application/json",
      bytes: browserBytes("punch", "/api/v2/company/44/time_punches", { data: [{
        id: 991, company_id: 44, user_id: 77, location_id: 3, role_id: 5,
        clocked_in: "2026-08-28T13:00:00Z", clocked_out: "2026-08-28T21:00:00Z",
        breaks: [
          { start: "2026-08-28T15:00:00Z", end: "2026-08-28T15:15:00Z", paid: true },
          { start: "2026-08-28T18:00:00Z", end: "2026-08-28T18:45:00Z", paid: false },
        ],
        approved: true, closed: true, cash_tips: "12.25", card_tips: "$84.50",
        declared_tips: "96.75", tip_out: "14.00", gross_pay: "160.00",
        regular_hours: 7, overtime_hours: 0, future_money_bucket: { amount: 9, code: "new" },
      }] }),
    });
    expect(result.parserVersion).toBe(evidenceExtractionLimits.parserVersion);
    expect(result.records).toHaveLength(1);
    const record = result.records[0]!;
    expect(record.kind).toBe("worked-shift");
    expect(record.finality).toBe("final");
    expect(record.workedMinutes).toBe(420);
    expect(record.paidBreakMinutes).toBe(15);
    expect(field(record, "cashTipsCents")?.value).toBe(1225);
    expect(field(record, "cardTipsCents")?.value).toBe(8450);
    expect(field(record, "finalWagesCents")?.value).toBe(16000);
    expect(field(record, "approved")?.value).toBe(true);
    expect(record.drift).toContainEqual(expect.objectContaining({ path: "source.punch.rows[0].future_money_bucket" }));
  });

  it("extracts a bounded coworker roster without treating people as Hearth members", () => {
    const result = deriveEvidenceBytes({
      captureKind: "browser-structured",
      contentType: "application/json",
      bytes: browserBytes("roster", "/api/v2/company/44/employees", {
        data: [{
          company_id: 44,
          location_id: 3,
          employee: { id: 77, first_name: "Joséphine", last_name: "Di Nicola", future_badge: "trainer" },
          role: { id: 5, name: "Support" },
          future_roster_field: { value: "preserved" },
        }],
      }),
    });
    expect(result.records).toHaveLength(1);
    const record = result.records[0]!;
    expect(record.kind).toBe("coworker-roster");
    expect(field(record, "coworkerName")?.value).toBe("Joséphine Di Nicola");
    expect(field(record, "coworkerNormalizedName")?.value).toBe("josephine di nicola");
    expect(field(record, "coworkerLastName")?.value).toBe("nicola");
    expect(field(record, "observedRole")?.value).toBe("Support");
    expect(record.workedMinutes).toBeNull();
    expect(record.finality).toBe("outlook");
    expect(record.drift).toContainEqual(expect.objectContaining({ path: "source.roster[0].future_roster_field" }));
    expect(record.drift).toContainEqual(expect.objectContaining({ path: "source.roster[0].employee.future_badge", value: "trainer" }));
    expect(JSON.stringify(record)).not.toContain("memberId");
  });

  it("extracts coworker schedule rows as outlook and never worked time", () => {
    const result = deriveEvidenceBytes({
      captureKind: "browser-structured",
      contentType: "application/json",
      bytes: browserBytes("published-schedule", "/api/v2/company/44/schedules", {
        shifts: [{
          id: 991,
          company_id: 44,
          location_id: 3,
          employee: { id: 77, first_name: "Josephine", last_name: "Di Nicola" },
          role: { id: 5, name: "Support" },
          start: "2026-08-28T18:00:00-04:00",
          end: "2026-08-28T22:30:00-04:00",
        }],
      }),
    });
    const record = result.records[0]!;
    expect(record.kind).toBe("coworker-schedule");
    expect(record.finality).toBe("outlook");
    expect(record.workedMinutes).toBeNull();
    expect(field(record, "scheduledMinutes")?.value).toBe(270);
    expect(field(record, "coworkerName")?.value).toBe("Josephine Di Nicola");
    expect(field(record, "observedRole")?.value).toBe("Support");
  });

  it("extracts the fixed visible-grid projection while keeping closing time unknown", () => {
    const result = deriveEvidenceBytes({
      captureKind: "browser-structured",
      contentType: "application/json",
      bytes: browserBytes("published-schedule", "/location/3/schedule/2026-08-24", {
        shifts: [
          { employee: { display_name: "Alex Example" }, date: "2026-08-24", role: "Support", station: "Closer", start_time: "6:00 pm", end_time: "10:30 pm" },
          { employee: { display_name: "Alex Example" }, date: "2026-08-25", role: "Manager", station: null, start_time: "10:00 am", end_time: null },
        ],
      }),
    });
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({ kind: "coworker-schedule", finality: "outlook", workedMinutes: null });
    expect(field(result.records[0], "coworkerName")?.value).toBe("Alex Example");
    expect(field(result.records[0], "scheduledMinutes")?.value).toBe(270);
    expect(result.records[1]).toMatchObject({ kind: "coworker-schedule", finality: "outlook", workedMinutes: null, endedAt: null });
    expect(field(result.records[1], "date")?.value).toBe("2026-08-25");
    expect(field(result.records[1], "startedAt")?.value).toBe("2026-08-25T14:00:00.000Z");
  });

  it("extracts the fixed visible My Timesheets projection as approved worked time without wage authority", () => {
    const result = deriveEvidenceBytes({
      captureKind: "browser-structured",
      contentType: "application/json",
      bytes: browserBytes("punch", "/my_timesheets", { timesheets: [{
        date: "2026-08-15", location_name: "Dining Room", role_name: "PM Server", start_time: "4:30 pm", end_time: "10:31 pm",
        breaks_label: null, hours: 6.02, approval_status: "Approved", closed: true,
      }] }),
    });
    const record = result.records[0]!;
    expect(record).toMatchObject({ kind: "worked-shift", finality: "final", workedMinutes: 361 });
    expect(field(record, "date")?.value).toBe("2026-08-15");
    expect(field(record, "startedAt")?.value).toBe("2026-08-15T20:30:00.000Z");
    expect(field(record, "endedAt")?.value).toBe("2026-08-16T02:31:00.000Z");
    expect(field(record, "approved")?.value).toBe(true);
    expect(record.paidBreakMinutes).toBeNull();
    expect(field(record, "paidBreakMinutes")).toBeUndefined();
    expect(field(record, "reportedWagesCents")).toBeUndefined();
    expect(field(record, "finalWagesCents")).toBeUndefined();
  });

  it("parses explicit break labels while preserving an unlabeled duration as unknown", () => {
    const derive = (breaksLabel: string | null) => deriveEvidenceBytes({
      captureKind: "browser-structured",
      contentType: "application/json",
      bytes: browserBytes("punch", "/my_timesheets", { timesheets: [{
        date: "2026-08-15", start_time: "4:30 pm", end_time: "10:30 pm",
        breaks_label: breaksLabel, hours: 5.5, approval_status: "Approved", closed: true,
      }] }),
    }).records[0]!;
    const none = derive("No breaks");
    expect(none.paidBreakMinutes).toBe(0);
    expect(field(none, "paidBreakMinutes")?.value).toBe(0);
    expect(field(none, "unpaidBreakMinutes")?.value).toBe(0);

    const labelled = derive("15 min paid / 30 min unpaid");
    expect(labelled.paidBreakMinutes).toBe(15);
    expect(field(labelled, "unpaidBreakMinutes")?.value).toBe(30);

    const ambiguous = derive("30 min");
    expect(ambiguous.paidBreakMinutes).toBeNull();
    expect(field(ambiguous, "paidBreakMinutes")).toBeUndefined();
    expect(field(ambiguous, "unpaidBreakMinutes")).toBeUndefined();
    expect(field(ambiguous, "breakLabel")?.value).toBe("30 min");
  });

  it("extracts employee Timesheet/Tip Report CSV without inferring identity from a name", () => {
    const csv = [
      "Employee,Date,Clock In,Clock Out,Total Hours,Paid Break Minutes,Cash Tips,Card Tips,Declared Tips,Tip Out,Gross Pay,Approval Status,Location ID,Role ID,New Report Field",
      '"Jane Employee",08/27/2026,9:00 am,5:30 pm,8.0,30,$10.00,$72.50,$82.50,$12.00,$168.00,Approved,3,5,"future value"',
    ].join("\r\n");
    const result = deriveEvidenceBytes({ captureKind: "selected-csv", contentType: "text/csv", bytes: bytes(csv) });
    const record = result.records[0]!;
    expect(record.rawSubject).toBeNull();
    expect(record.startedAt).toMatch(/^2026-08-27T13:00:00\.000Z$/);
    expect(record.endedAt).toMatch(/^2026-08-27T21:30:00\.000Z$/);
    expect(record.workedMinutes).toBe(480);
    expect(record.paidBreakMinutes).toBe(30);
    expect(record.finality).toBe("approved");
    expect(field(record, "totalTipsCents")).toBeUndefined();
    expect(field(record, "declaredTipsCents")?.value).toBe(8250);
    expect(record.drift.some((item: any) => item.path.endsWith("New Report Field"))).toBe(true);
  });

  it("extracts ICS only as outlook schedule facts", () => {
    const ics = [
      "BEGIN:VCALENDAR", "PRODID:-//7shifts//Calendar//EN", "BEGIN:VEVENT", "UID:schedule-123@7shifts.com",
      "DTSTART:20260829T170000Z", "DTEND:20260830T010000Z", "SEQUENCE:4", "SUMMARY:Server shift", "LOCATION:Toronto",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const result = deriveEvidenceBytes({ captureKind: "selected-ics", contentType: "text/calendar", bytes: bytes(ics) });
    const record = result.records[0]!;
    expect(record.kind).toBe("schedule");
    expect(record.finality).toBe("outlook");
    expect(record.workedMinutes).toBeNull();
    expect(field(record, "scheduledMinutes")?.value).toBe(480);
  });

  it("parses bounded MIME text and structured attachments without fetching remote content", () => {
    const attachment = btoa([
      "Employee ID,Date,Clock In,Clock Out,Total Hours,Card Tips,Status",
      "77,2026-08-26,10:00 am,6:00 pm,8,$55.00,Approved",
    ].join("\r\n"));
    const email = [
      "From: reports@example.test", "To: private@example.test", "Subject: Timesheet",
      'Content-Type: multipart/mixed; boundary="hearth-boundary"', "", "--hearth-boundary",
      "Content-Type: text/html", "", '<p>See report. <img src="https://tracker.example/pixel.png"></p>',
      "--hearth-boundary", "Content-Type: text/csv", "Content-Transfer-Encoding: base64", "", attachment,
      "--hearth-boundary--", "",
    ].join("\r\n");
    const result = deriveEvidenceBytes({ captureKind: "email", contentType: "message/rfc822", bytes: bytes(email) });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.finality).toBe("provisional");
    expect(result.records[0]?.observations.every((row: any) => row.extraction === "email")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("tracker.example");
  });

  it("extracts a 7shifts schedule email as outlook only", () => {
    const email = [
      "From: 7shifts <notifications@7shifts.com>", "To: member@example.test", "Subject: The schedule has been posted!", "Date: Sat, 22 Aug 2026 10:00:00 -0400",
      "Content-Type: text/html", "", "<p>The schedule has been posted!</p><p>Thu, August 27 4:30 pm – 10:30 pm</p><p>Fri August 28, 2026 4:30 pm – 10:30 pm</p>",
    ].join("\r\n");
    const result = deriveEvidenceBytes({ captureKind: "gmail-7shifts-email", contentType: "message/rfc822", bytes: bytes(email) });
    expect(result.records).toHaveLength(2);
    expect(result.records.every((row: any) => row.kind === "schedule" && row.finality === "outlook" && row.workedMinutes === null)).toBe(true);
    expect(field(result.records[0], "scheduledMinutes")?.value).toBe(360);
    expect(result.records[0]?.observations.every((row: any) => row.extraction === "email" && row.finality === "outlook")).toBe(true);
  });

  it("produces the same canonical seed for independent local/cloud screenshot extraction and exposes mismatches", () => {
    const shape = { shiftDraft: {
      artifact_digest: "artifact_1234567890", date: "2026-08-25",
      started_at: "2026-08-25T21:00:00-04:00", ended_at: "2026-08-26T05:00:00-04:00",
      worked_hours: 8, paid_break_minutes: 0, cash_tips: 20, card_tips: 80,
    } };
    const local = deriveEvidenceBytes({ captureKind: "local-ocr", contentType: "application/json", bytes: bytes(JSON.stringify(shape)) });
    const cloud = deriveEvidenceBytes({ captureKind: "cloud-vision", contentType: "application/json", bytes: bytes(JSON.stringify(shape)) });
    expect(local.records[0]?.canonicalSeed).toBe(cloud.records[0]?.canonicalSeed);
    expect(local.records[0]?.observations.every((row: any) => row.extraction === "local-ocr")).toBe(true);
    expect(cloud.records[0]?.observations.every((row: any) => row.extraction === "cloud-vision")).toBe(true);
  });

  it("retains unsupported binary evidence and bounds row explosions", () => {
    const binary = deriveEvidenceBytes({ captureKind: "screenshot", contentType: "image/png", bytes: new Uint8Array([1, 2, 3]) });
    expect(binary.records).toEqual([]);
    expect(binary.drift).toContainEqual(expect.objectContaining({ path: "source.binary", value: "image/png" }));
    const rows = Array.from({ length: evidenceExtractionLimits.maxRows + 1 }, (_, index) => `${index},2026-08-01,9:00 am,5:00 pm`);
    expect(() => deriveEvidenceBytes({
      captureKind: "selected-csv", contentType: "text/csv",
      bytes: bytes(["Employee ID,Date,Clock In,Clock Out", ...rows].join("\n")),
    })).toThrow(/too many rows/i);
  });
});
