// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { clockInShift, clockOutShift, importCoworkerRoster, NeedsConfirmationError, postWorkShift, seedDemoHousehold, type ShiftAttendanceReviewDraft } from "../src/core/index.ts";
import { SHIFT_REPORT_SCAN_COPY } from "../src/ShiftReportScan.tsx";
import { WorkShiftFlow } from "../src/WorkShiftFlow.tsx";
import { WorkShiftPage } from "../src/WorkShiftPage.tsx";

const today = "2026-08-27";

describe("Shift Today camera draft", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("shows the shared camera on Today after clock-out and never treats scan as a post", () => {
    let household = seedDemoHousehold({ today, environment: "development" });
    expect(household.workJobs.filter((job) => job.memberId === "MEM-001" && job.active)).toHaveLength(1);
    household = clockInShift(household, { memberId: "MEM-001" }).household;
    household = clockOutShift(household, { memberId: "MEM-001" }).household;
    expect(household.kitchen.openShifts.some((row) => row.status === "confirming")).toBe(true);

    act(() => {
      root.render(createElement(WorkShiftPage, {
        household,
        memberId: "MEM-001",
        memberName: "Bianca",
        today,
        environment: "development",
        busy: false,
        onClockIn: () => {},
        onAbandon: () => {},
        onStartBreak: () => {},
        onEndBreak: () => {},
        onChooseTimeline: () => {},
        onClockOut: () => {},
        onConfirmShift: () => {},
        onCorrect: () => {},
        onAskSaveJob: () => {},
        onArchiveJob: () => {},
        onOpenCalendar: () => {},
      }));
    });

    const text = container.textContent ?? "";
    expect(text).toContain(SHIFT_REPORT_SCAN_COPY.take);
    expect(text).toContain(SHIFT_REPORT_SCAN_COPY.choose);
    expect(text).toContain("Workers AI");
    expect(text).toContain("OpenAI");
    expect(text).toContain("Anthropic");
    expect(text).toContain("Auto");
    expect(text).toContain("Confirm");
    expect(text).not.toContain("Review & confirm pay");
    expect(household.shifts.filter((shift) => shift.memberId === "MEM-001" && shift.date === today)).toHaveLength(0);
  });

  it("opens Already off review with camera on the Shift page without leaving Today", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    act(() => {
      root.render(createElement(WorkShiftPage, {
        household,
        memberId: "MEM-001",
        memberName: "Bianca",
        today,
        environment: "development",
        busy: false,
        onClockIn: () => {},
        onAbandon: () => {},
        onStartBreak: () => {},
        onEndBreak: () => {},
        onChooseTimeline: () => {},
        onClockOut: () => {},
        onConfirmShift: () => {},
        onCorrect: () => {},
        onAskSaveJob: () => {},
        onArchiveJob: () => {},
        onOpenCalendar: () => {},
      }));
    });

    const alreadyOff = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Already off"));
    expect(alreadyOff).toBeTruthy();
    act(() => { alreadyOff!.click(); });
    expect(container.textContent).toContain(SHIFT_REPORT_SCAN_COPY.take);
    expect(container.textContent).toContain("Back to clock");
    const html = container.innerHTML;
    expect(html.indexOf("Back to clock")).toBeLessThan(html.indexOf(SHIFT_REPORT_SCAN_COPY.take));
  });

  it("keeps same-day Confirm retry on the Shift page instead of an expense pad", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    let anyway = 0;
    act(() => {
      root.render(createElement(WorkShiftPage, {
        household,
        memberId: "MEM-001",
        memberName: "Bianca",
        today,
        environment: "development",
        busy: false,
        onClockIn: () => {},
        onAbandon: () => {},
        onStartBreak: () => {},
        onEndBreak: () => {},
        onChooseTimeline: () => {},
        onClockOut: () => {},
        onConfirmShift: () => {},
        duplicateConfirm: { message: "Bianca already has a Demo Bistro shift on 2026-08-27. Double shifts are allowed — confirm this is another one." },
        onConfirmAnyway: () => { anyway += 1; },
        onCorrect: () => {},
        onAskSaveJob: () => {},
        onArchiveJob: () => {},
        onOpenCalendar: () => {},
      }));
    });

    const alreadyOff = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Already off"));
    act(() => { alreadyOff!.click(); });
    expect(container.textContent).toMatch(/already has a Demo Bistro shift/i);
    const retry = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Add anyway");
    expect(retry).toBeTruthy();
    act(() => { retry!.click(); });
    expect(anyway).toBe(1);
  });

  it("Confirm shift posts through postWorkShift, and a same-day retry stays a shift", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    let posted = household;
    act(() => {
      root.render(createElement(WorkShiftFlow, {
        household,
        memberId: "MEM-001",
        today,
        punch: null,
        busy: false,
        initialDraft: {
          workedHours: 6.25,
          sales: 250,
          cashTips: 40,
          cardTips: 55,
          customersServed: 28,
          staffingCount: 4,
        },
        onConfirm: (input) => {
          posted = postWorkShift(posted, input).household;
        },
      }));
    });

    const next = () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Next");
    act(() => { next()!.click(); });
    act(() => { next()!.click(); });
    const confirm = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Confirm shift");
    expect(confirm).toBeTruthy();
    act(() => { confirm!.click(); });
    expect(posted.shifts.filter((shift) => shift.memberId === "MEM-001" && shift.date === today)).toHaveLength(1);
    expect(posted.shifts.some((shift) => shift.memberId === "MEM-001")).toBe(true);

    const job = posted.workJobs.find((row) => row.memberId === "MEM-001" && row.active)!;
    const role = job.roles.find((row) => row.active)!;
    const again = {
      date: today,
      memberId: "MEM-001" as const,
      jobId: job.id,
      roleId: role.id,
      workedHours: "6.25",
      paidBreakHours: "0",
      sales: "250",
      salesByField: { [job.salesFields[0]!.id]: "250" },
      cashTips: "40",
      cardTips: "55",
      customersServed: 28,
      staffingCount: 4,
      eventTag: "regular" as const,
      cashTipsAccountId: job.defaults.cashTipsAccountId,
      wagesDepositAccountId: job.defaults.wagesDepositAccountId,
      cardTipsDepositAccountId: job.defaults.cardTipsDepositAccountId,
      createdBy: "MEM-001",
    };
    expect(() => postWorkShift(posted, again)).toThrow(NeedsConfirmationError);
    const retry = postWorkShift(posted, { ...again, confirmDuplicate: true });
    expect(retry.household.shifts.filter((shift) => shift.memberId === "MEM-001" && shift.date === today)).toHaveLength(2);
    expect(retry.postedIds.some((id) => id.startsWith("SHIFT-"))).toBe(true);
  });

  it("preloads scheduled coworkers on final review and records an explicit absence", () => {
    let household = seedDemoHousehold({ today, environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-001" && row.active)!;
    household = importCoworkerRoster(household, {
      ownerMemberId: "MEM-001", jobId: job.id, locationName: job.locationName,
      rows: [{
        displayName: "Scheduled Coworker", roleLabel: "Support", source: "seven-shifts-schedule",
        sourceIdentityKey: "s7subject_aaaaaaaaaaaaaaaaaaaa",
        scheduledWindows: [{
          sourceScheduleKey: "s7shift_aaaaaaaaaaaaaaaaaaaa", date: today,
          scheduledStart: "2026-08-27T18:00:00.000Z", scheduledEnd: "2026-08-28T02:00:00.000Z",
          observedAt: "2026-08-26T12:00:00.000Z",
        }],
      }],
    }).household;
    let review: ShiftAttendanceReviewDraft | null | undefined;
    const renderFlow = (nextHousehold = household) => createElement(WorkShiftFlow, {
      household: nextHousehold, memberId: "MEM-001", today, punch: null, busy: false,
      initialDraft: { workedHours: 6.25, sales: 250, cashTips: 40, cardTips: 55, customersServed: 28, staffingCount: 4 },
      onConfirm: (_input, nextReview) => { review = nextReview; },
    });
    act(() => {
      root.render(renderFlow());
    });
    const next = () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Next");
    act(() => { next()!.click(); });
    act(() => { next()!.click(); });
    expect(container.textContent).toContain("Scheduled Coworker");
    const attendance = container.querySelector('section[aria-label="Coworker attendance review"] input[type="checkbox"]') as HTMLInputElement;
    expect(attendance.checked).toBe(true);
    act(() => { attendance.click(); });
    expect(attendance.checked).toBe(false);
    const refreshed = {
      ...household,
      coworkerSchedules: household.coworkerSchedules?.map((row) => ({
        ...row,
        roleLabel: "Closer",
        scheduledEnd: "2026-08-28T03:00:00.000Z",
        updatedAt: "2026-08-27T13:00:00.000Z",
      })),
    };
    act(() => { root.render(renderFlow(refreshed)); });
    const refreshedAttendance = container.querySelector('section[aria-label="Coworker attendance review"] input[type="checkbox"]') as HTMLInputElement;
    expect(refreshedAttendance.checked).toBe(true);
    expect(container.textContent).toContain("Scheduled Coworker · Closer");
    act(() => { refreshedAttendance.click(); });
    const confirm = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Confirm shift");
    act(() => { confirm!.click(); });
    expect(review?.rows).toMatchObject([{ status: "user-confirmed-absent", roleLabel: "Closer" }]);
  });

  it("adds and removes a surprise helper before the visible Confirm", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    let review: ShiftAttendanceReviewDraft | null | undefined;
    act(() => {
      root.render(createElement(WorkShiftFlow, {
        household, memberId: "MEM-001", today, punch: null, busy: false,
        initialDraft: { workedHours: 6.25, sales: 250, cashTips: 40, cardTips: 55, customersServed: 28, staffingCount: 4 },
        onConfirm: (_input, nextReview) => { review = nextReview; },
      }));
    });
    const next = () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Next");
    act(() => { next()!.click(); });
    act(() => { next()!.click(); });
    expect(container.textContent).toContain("No saved 7shifts schedule");
    const input = container.querySelector('input[placeholder="Name"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, "Surprise Helper");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const add = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Add helper")!;
    expect(add.disabled).toBe(false);
    act(() => { add.click(); });
    const remove = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Surprise Helper · remove")!;
    expect(remove).toBeTruthy();
    act(() => { remove.click(); });
    expect(container.textContent).not.toContain("Surprise Helper · remove");

    act(() => {
      setter.call(input, "Surprise Helper");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => { add.click(); });
    const confirm = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Confirm shift")!;
    act(() => { confirm.click(); });
    expect(review?.surpriseHelpers).toEqual(["Surprise Helper"]);
  });
});
