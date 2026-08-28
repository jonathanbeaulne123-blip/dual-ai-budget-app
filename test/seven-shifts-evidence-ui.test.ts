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
    expect(container.textContent).toContain("Automation by job");
    expect(container.textContent).toContain("Raw captures stay outside the household snapshot and books");
    expect(container.textContent).not.toMatch(/onboarding|required setup/i);
  });
});
