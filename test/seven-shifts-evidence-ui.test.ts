// @vitest-environment jsdom
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/index.ts";
import { WorkShiftPage } from "../src/WorkShiftPage.tsx";

describe("7shifts Evidence Center surface", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("innerWidth", 1024);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, available: false, environment: "development-only", productionAllowed: false, detail: "Evidence Mesh is not enabled for Development." })));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("lives under Shift, stays disabled honestly, and leaves manual Confirm available", async () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    await act(async () => {
      root.render(createElement(WorkShiftPage, {
        household, memberId: "MEM-001", memberName: "Bianca", today: "2026-08-28", environment: "development", busy: false,
        onClockIn: () => {}, onAbandon: () => {}, onStartBreak: () => {}, onEndBreak: () => {}, onChooseTimeline: () => {}, onClockOut: () => {},
        onConfirmShift: () => {}, onCorrect: () => {}, onAskSaveJob: () => {}, onArchiveJob: () => {}, onOpenCalendar: () => {}, onSaveSevenShiftsSchedule: () => {},
      }));
    });
    expect(container.textContent).toContain("Already off");
    const evidence = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Evidence");
    expect(evidence).toBeTruthy();
    await act(async () => { evidence!.click(); });
    expect(container.textContent).toContain("7shifts Evidence Center");
    expect(container.textContent).toContain("Disabled");
    expect(container.textContent).toContain("Autonomous collection, human Confirm");
    expect(container.textContent).not.toContain("Automation by job");
    expect(container.textContent).toContain("Direct Gmail · read-only");
    expect(container.textContent).toContain("Connect Gmail and scrub");
    expect(container.textContent).not.toContain("Private evidence mailbox");
    expect(container.textContent).toContain("Raw captures stay outside the household snapshot and books");
    expect(container.textContent).not.toMatch(/onboarding|required setup/i);
  });
  it("keeps phone evidence under Jobs, wraps keyboard order, and collapses a resized desktop console", async () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const props = { household, memberId: "MEM-001", memberName: "Bianca", today: "2026-08-28", environment: "development" as const, busy: false,
      onClockIn() {}, onAbandon() {}, onStartBreak() {}, onEndBreak() {}, onChooseTimeline() {}, onClockOut() {}, onConfirmShift() {}, onCorrect() {}, onAskSaveJob() {}, onArchiveJob() {}, onOpenCalendar() {} };
    vi.stubGlobal("innerWidth", 390);
    await act(async () => root.render(createElement(WorkShiftPage, props)));
    expect([...container.querySelectorAll('[role="tab"]')].map(e => e.textContent)).toEqual(["Today", "Report", "Jobs"]);
    await act(async () => (container.querySelector('#shift-tab-jobs') as HTMLElement).click());
    const disclosure = container.querySelector('.work-evidence-disclosure') as HTMLDetailsElement;
    expect(disclosure.open).toBe(false);
    expect(container.textContent).not.toContain("7shifts Evidence Center");
    await act(async () => { disclosure.open = true; disclosure.dispatchEvent(new Event('toggle')); });
    expect(container.textContent).toContain("7shifts Evidence Center");
    await act(async () => root.render(createElement(WorkShiftPage, {...props, memberId: "MEM-002"})));
    expect((container.querySelector('.work-evidence-disclosure') as HTMLDetailsElement).open).toBe(false);
    expect(container.textContent).not.toContain("7shifts Evidence Center");
    await act(async () => { container.querySelector('#shift-tab-jobs')!.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight',bubbles:true})); });
    expect(container.querySelector('#shift-tab-today')!.getAttribute('aria-selected')).toBe('true');
    await act(async () => (container.querySelector('#shift-tab-jobs') as HTMLElement).click());
    (container.querySelector('.work-evidence-disclosure summary') as HTMLElement).focus();
    await act(async () => { vi.stubGlobal('innerWidth', 1100); window.dispatchEvent(new Event('resize')); await new Promise(resolve => requestAnimationFrame(resolve)); });
    expect(document.activeElement?.id).toBe('shift-tab-jobs');
    await act(async () => (container.querySelector('#shift-tab-evidence') as HTMLElement).click());
    expect(container.textContent).toContain("7shifts Evidence Center");
    await act(async () => { vi.stubGlobal('innerWidth', 320); window.dispatchEvent(new Event('resize')); await new Promise(resolve => requestAnimationFrame(resolve)); });
    expect(container.querySelector('#shift-tab-evidence')).toBeNull();
    expect(document.activeElement?.id).toBe('shift-tab-jobs');
    expect((container.querySelector('.work-evidence-disclosure') as HTMLDetailsElement).open).toBe(false);
  });

});
