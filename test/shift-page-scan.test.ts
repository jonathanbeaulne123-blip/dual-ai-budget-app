// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { clockInShift, clockOutShift, NeedsConfirmationError, postWorkShift, seedDemoHousehold } from "../src/core/index.ts";
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
});
