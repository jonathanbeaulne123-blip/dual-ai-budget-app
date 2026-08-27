// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { clockInShift, clockOutShift, seedDemoHousehold } from "../src/core/index.ts";
import { SHIFT_REPORT_SCAN_COPY } from "../src/ShiftReportScan.tsx";
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
  });
});
