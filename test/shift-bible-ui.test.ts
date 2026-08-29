// @vitest-environment jsdom
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkShiftHistoryCard } from "../src/WorkShiftHistory.tsx";
import { seedDemoHousehold } from "../src/core/index.ts";

describe("confirmed Shift Bible history", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("opens the retained Bible and sends financial edits through the correction callback", async () => {
    const household = seedDemoHousehold({ today: "2026-08-29", environment: "development" });
    const onCorrect = vi.fn();
    await act(async () => {
      root.render(createElement(WorkShiftHistoryCard, { household, memberId: "MEM-002", busy: false, onCorrect }));
    });

    const open = [...container.querySelectorAll("button")].find((button) => button.textContent === "Open Bible")!;
    expect(open).toBeTruthy();
    await act(async () => open.click());
    expect(container.textContent).toContain("Bible revision 1");
    expect(container.textContent).toContain("Actual:");
    expect(container.textContent).toContain("Tips / sales:");

    const correct = [...container.querySelectorAll("button")].find((button) => button.textContent === "Correct this Bible")!;
    await act(async () => correct.click());
    expect(onCorrect).toHaveBeenCalledOnce();
    expect(onCorrect.mock.calls[0]?.[0].shiftBible?.outcome).toBe("worked");
  });
});
