import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
// @ts-expect-error -- jsdom has no declaration package in this repository.
import { JSDOM } from "jsdom";
import { validCompanionProjection } from "../workers/evidence.js";
import { exactSevenShiftsSender, fixedProjection, gmailListUrl, projectionClassForUrl, torontoShiftInstant } from "../apps/hearth-capture-extension/autonomous-sync.js";

const root = new URL("../apps/hearth-capture-extension/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), "utf8");

function captureSafety() {
  const context: Record<string, unknown> = { URL };
  runInNewContext(read("capture-safety.js"), context);
  return context.HearthCaptureSafety as {
    classify7shiftsPath(value: string): string | null;
    sanitizeVisibleResponsePayload(value: unknown, options?: { allowSelectedTimesheet?: boolean }): Record<string, unknown> | null;
  };
}

function visibleSchedule() {
  const context: Record<string, unknown> = { URL, Date };
  runInNewContext(read("visible-schedule.js"), context);
  return context.HearthVisibleSchedule as {
    extractVisibleSchedule(document: Document, href: string, selfDisplayName?: string): Record<string, any>;
  };
}

function visibleTimesheet() {
  const context: Record<string, unknown> = { URL, Date };
  runInNewContext(read("visible-timesheet.js"), context);
  return context.HearthVisibleTimesheet as {
    extractVisibleTimesheet(document: Document, href: string, accountBinding: Record<string, string>): Record<string, any>;
  };
}

describe("7shifts browser companion", () => {
  it("has exact origin and least permissions", () => {
    const manifest = JSON.parse(read("manifest.json"));
    expect(manifest.host_permissions).toEqual(["https://app.7shifts.com/*", "https://www.googleapis.com/*", "https://gmail.googleapis.com/*", "https://hearth-books.jonathan-beaulne123.workers.dev/work/evidence/*"]);
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "storage", "alarms", "tabs", "identity"]);
    expect(JSON.stringify(manifest)).not.toMatch(/cookies|webRequest|<all_urls>|history|clipboard/);
    expect(manifest.content_scripts[0].all_frames).toBe(false);
    expect(manifest.content_scripts[0].js).toEqual(["capture-safety.js", "content.js"]);
  });

  it("requires explicit enablement, top-frame scope, bounds captures, and strips credentials", () => {
    const content = read("content.js");
    const popup = read("popup.js");
    const bridge = read("page-bridge.js");
    expect(content).toContain("if (!enabled");
    expect(content).toContain("window.top !== window");
    expect(content).toContain("sanitizeVisibleResponsePayload");
    expect(popup).toContain("HEARTH_CAPTURE_ENABLE");
    expect(popup).toContain("app\\.7shifts\\.com");
    expect(bridge).not.toMatch(/request\.headers|document\.cookie|localStorage|sessionStorage/);
    expect(bridge).toContain("2 * 1024 * 1024");
    const service = read("service-worker.js");
    expect(service).toContain('const useCompanion = Boolean(options.requireCompanion || !capability)');
    expect(service).toContain('remove(["evidenceCapability", "pendingEvidence", "lastManualCaptureError"])');
    expect(read("popup.js")).toContain("const useRegistration = !capabilityToken");
    expect(popup).toContain("chrome.scripting.executeScript");
    expect(popup).toContain('"X-Evidence-Capture-Kind": "browser-structured"');
    expect(popup).not.toMatch(/document\.cookie|localStorage|sessionStorage|request\.headers/);
  });

  it("projects only the explicitly selected visible schedule grid", () => {
    const dom = new JSDOM(`
      <div data-password="do-not-copy">unrelated secret text</div>
      <div class="schedule-row schedule-row--header"></div>
      <div class="schedule-row schedule-row--events"></div>
      <div class="schedule-row schedule-row--employee-header" data-employee-id="employee-42">
        <div class="schedule-cell schedule-cell--title"><span class="employee-cell__title-name">Alex Example</span></div>
        <div class="schedule-cell schedule-cell--with-padding">
          <div class="employee-shift"><div class="employee-shift__role-name">Support</div><div class="employee-shift__time">6pm - 10:30pm</div><div class="employee-shift__station">Closer</div></div>
        </div>
        <div class="schedule-cell schedule-cell--with-padding">
          <div class="employee-shift"><div class="employee-shift__role-name">Manager</div><div class="employee-shift__time">10am - CL</div></div>
        </div>
      </div>`);
    const projected = visibleSchedule().extractVisibleSchedule(dom.window.document, "https://app.7shifts.com/location/3/schedule/2026-08-24?view=week", "Alex Example");
    expect(projected.captureClass).toBe("published-schedule");
    const projectedBody = JSON.parse(projected.body);
    expect(projectedBody.shifts).toEqual([
      { employee: { display_name: "Alex Example", provider_employee_id: "employee-42" }, hearth_self: true, date: "2026-08-24", role: "Support", station: "Closer", start_time: "6:00 pm", end_time: "10:30 pm", provider_location_id: "3" },
      { employee: { display_name: "Alex Example", provider_employee_id: "employee-42" }, hearth_self: true, date: "2026-08-25", role: "Manager", station: null, start_time: "10:00 am", end_time: null, provider_location_id: "3" },
    ]);
    expect(projectedBody.complete_range).toEqual({ from_date: "2026-08-24", to_date: "2026-08-30" });
    expect(projected.accountBinding).toEqual({ normalizedSelf: "alex example", subjectKey: "employee:employee-42", locationKey: "location:3" });
    expect(JSON.stringify(projected)).not.toContain("do-not-copy");
    const accepted = captureSafety().sanitizeVisibleResponsePayload(projected);
    expect(accepted?.body).toEqual(projectedBody);
  });

  it("fails closed on a different employee account and the Worker accepts only the exact projection", () => {
    const dom = new JSDOM(`<div class="schedule-row" data-employee-id="other-1"><span class="employee-cell__title-name">Other Employee</span><div class="schedule-cell--with-padding"><div class="employee-shift"><span class="employee-shift__role-name">Server</span><span class="employee-shift__time">4pm - 10pm</span></div></div></div>`);
    expect(() => visibleSchedule().extractVisibleSchedule(dom.window.document, "https://app.7shifts.com/location/3/schedule/2026-08-24", "Alex Example")).toThrow(/does not show the registered/i);
    const exact = {
      version: 1, captureClass: "published-schedule", transport: "fetch", path: "/location/3/schedule/2026-08-24",
      capturedAt: new Date().toISOString(), contentType: "application/json", accountBinding: { normalizedSelf: "alex example", subjectKey: "employee:employee-42", locationKey: "location:3" },
      body: JSON.stringify({ shifts: [{ employee: { display_name: "Alex Example", provider_employee_id: "employee-42" }, hearth_self: true, date: "2026-08-24", role: "Server", station: null, start_time: "4:00 pm", end_time: "10:00 pm", provider_location_id: "3" }], self_row_visible: true, complete_range: { from_date: "2026-08-24", to_date: "2026-08-30" } }),
    };
    expect(validCompanionProjection(new TextEncoder().encode(JSON.stringify(exact)))).toBe(true);
    expect(validCompanionProjection(new TextEncoder().encode(JSON.stringify({ ...exact, body: JSON.stringify({ ...JSON.parse(exact.body), accessToken: "secret" }) })))).toBe(false);
    expect(validCompanionProjection(new TextEncoder().encode(JSON.stringify({ ...exact, path: "/api/employees" })))).toBe(false);
  });

  it("rejects the same display name when the stable 7shifts employee identifier changes", () => {
    const schedule = new JSDOM(`<div class="schedule-row" data-employee-id="employee-99"><span class="employee-cell__title-name">Alex Example</span><div class="schedule-cell--with-padding"><div class="employee-shift"><span class="employee-shift__role-name">Server</span><span class="employee-shift__time">4pm - 10pm</span></div></div></div>`);
    const projected = visibleSchedule().extractVisibleSchedule(schedule.window.document, "https://app.7shifts.com/location/3/schedule/2026-08-24", "Alex Example");
    expect(projected.accountBinding.subjectKey).toBe("employee:employee-99");

    const timesheet = new JSDOM(`<body data-current-employee-id="employee-100"><table><thead><tr><th>Date</th><th>Punch In</th><th>Punch Out</th><th>Hours</th></tr></thead><tbody><tr><td>August 15, 2026</td><td>4:30 PM</td><td>10:31 PM</td><td>6.02</td></tr></tbody></table></body>`);
    expect(() => visibleTimesheet().extractVisibleTimesheet(timesheet.window.document, "https://app.7shifts.com/my_timesheets", projected.accountBinding)).toThrow(/does not match/i);
  });

  it("projects worked-time facts from the selected visible timesheet without the wage column", () => {
    const dom = new JSDOM(`
      <body data-current-employee-id="employee-42">
      <div data-password="do-not-copy">unrelated secret text</div>
      <table><thead><tr><th>Date</th><th>Location</th><th>Role</th><th>Punch In</th><th>Punch Out</th><th>Breaks</th><th>Wage</th><th>Manager Approval</th><th>Employee Approval</th><th>Hours</th><th>Total Hours</th></tr></thead>
      <tbody><tr><td>August 15, 2026</td><td>Dining Room</td><td>PM Server</td><td>4:30 PM</td><td>10:31 PM</td><td></td><td>$99.99</td><td>Approved</td><td></td><td>6.02</td><td>6 hrs 1 mins</td></tr></tbody></table></body>`);
    const binding = { normalizedSelf: "alex example", subjectKey: "employee:employee-42", locationKey: "location:3" };
    const projected = visibleTimesheet().extractVisibleTimesheet(dom.window.document, "https://app.7shifts.com/my_timesheets", binding);
    expect(projected.captureClass).toBe("punch");
    expect(projected.accountBinding).toEqual(binding);
    expect(JSON.parse(projected.body).timesheets).toEqual([{
      provider_employee_id: "employee-42", provider_location_id: "3",
      date: "2026-08-15", location_name: "Dining Room", role_name: "PM Server", start_time: "4:30 pm", end_time: "10:31 pm",
      breaks_label: null, hours: 6.02, approval_status: "Approved", closed: true,
    }]);
    expect(JSON.stringify(projected)).not.toMatch(/99\.99|do-not-copy|wage/i);
    expect(captureSafety().sanitizeVisibleResponsePayload(projected)).toBeNull();
    expect(captureSafety().sanitizeVisibleResponsePayload(projected, { allowSelectedTimesheet: true })).not.toBeNull();
  });

  it("classifies only explicit employee-visible response paths", () => {
    const safety = captureSafety();
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/employees")).toBe("roster");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/roles")).toBe("role-catalog");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/schedules")).toBe("published-schedule");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/time_punches")).toBe("punch");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/employees/77/time_punches")).toBe("punch");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/my_timesheets")).toBeNull();
    expect(safety.classify7shiftsPath("https://app.7shifts.com/api/v2/company/4/employees/77/shifts")).toBe("published-schedule");
    expect(safety.classify7shiftsPath("https://app.7shifts.com/oauth/token")).toBeNull();
    expect(safety.classify7shiftsPath("https://example.test/api/employees")).toBeNull();
  });

  it("never treats My Timesheets as a generic background response", () => {
    const safety = captureSafety();
    const rawPageResponse = {
      captureClass: "punch",
      transport: "fetch",
      path: "/my_timesheets",
      capturedAt: "2026-08-28T12:00:00.000Z",
      contentType: "application/json",
      body: JSON.stringify({ timesheets: [{ hours: 6.02, wage: 99.99, employee: "Jonathan" }] }),
    };
    expect(safety.sanitizeVisibleResponsePayload(rawPageResponse)).toBeNull();
    expect(safety.sanitizeVisibleResponsePayload({
      ...rawPageResponse,
      selectionKind: "visible-timesheet-v1",
    })).toBeNull();
    expect(read("content.js")).not.toContain("allowSelectedTimesheet");
  });

  it("parses and strips credentials inside an intercepted JSON body", () => {
    const safety = captureSafety();
    const result = safety.sanitizeVisibleResponsePayload({
      captureClass: "roster",
      transport: "fetch",
      path: "/api/v2/company/4/employees",
      capturedAt: "2026-08-28T12:00:00.000Z",
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: 7, first_name: "Jonathan", last_name: "Beaulne", access_token: "secret", accessToken: "camel-secret", nested: { refreshToken: "nested-secret", cookie: "session=bad" } }] }),
    });
    expect(result).not.toBeNull();
    expect(result?.body).toEqual({ data: [{ id: 7, first_name: "Jonathan", last_name: "Beaulne", nested: {} }] });
    expect(JSON.stringify(result)).not.toMatch(/access_token|accessToken|refreshToken|session=bad|secret/);
  });

  it("rejects credential-shaped non-JSON and mismatched capture classes", () => {
    const safety = captureSafety();
    expect(safety.sanitizeVisibleResponsePayload({
      captureClass: "roster", path: "/api/employees", contentType: "text/csv", body: "name,authorization\nJonathan,Bearer abcdefghijklmnop",
    })).toBeNull();
    expect(safety.sanitizeVisibleResponsePayload({
      captureClass: "roster", path: "/api/employees", contentType: "text/csv", body: "name,accessToken\nJonathan,opaque-secret-value",
    })).toBeNull();
    expect(safety.sanitizeVisibleResponsePayload({
      captureClass: "punch", path: "/api/employees", contentType: "application/json", body: "{}",
    })).toBeNull();
  });

  it("bounds autonomous pages, Gmail senders, cursors, and Toronto DST alarms", () => {
    expect(projectionClassForUrl("https://app.7shifts.com/location/3/schedule/2026-08-24")).toBe("published-schedule");
    expect(projectionClassForUrl("https://app.7shifts.com/my_timesheets")).toBe("punch");
    expect(projectionClassForUrl("https://app.7shifts.com/login")).toBeNull();
    expect(fixedProjection({ version: 1, captureClass: "published-schedule", transport: "fetch", path: "/login", contentType: "application/json", accountBinding: { normalizedSelf: "alex example", subjectKey: "employee:employee-42", locationKey: "location:3" }, body: "{}" }, "published-schedule")).toBeNull();
    expect(exactSevenShiftsSender(new TextEncoder().encode("From: notices@7shifts.com\r\nSubject: Shift\r\n\r\nBody"))).toBe(true);
    expect(exactSevenShiftsSender(new TextEncoder().encode("From: notices@7shifts.com.evil.test\r\n\r\nBody"))).toBe(false);
    expect(gmailListUrl("123")).toContain("startHistoryId=123");
    expect(new Date(torontoShiftInstant("2026-03-08", "4:30 pm")!).toISOString()).toBe("2026-03-08T20:30:00.000Z");
    expect(new Date(torontoShiftInstant("2026-11-01", "4:30 pm")!).toISOString()).toBe("2026-11-01T21:30:00.000Z");
  });
});
