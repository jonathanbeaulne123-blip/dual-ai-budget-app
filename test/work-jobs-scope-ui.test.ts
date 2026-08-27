// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkJobsCard } from "../src/WorkJobs.tsx";
import { catalogHousehold, type Household } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

function scopedHousehold(householdId: string): Household {
  return { ...catalogHousehold("production"), householdId };
}

function renderJobs(household: Household) {
  const memberId = "MEM-001";
  root.render(createElement(WorkJobsCard, {
    key: `${household.environment}:${household.householdId}:${memberId}`,
    household,
    memberId,
    today: "2026-08-27",
    busy: false,
    onAskSave: vi.fn(),
    onArchive: vi.fn(),
  }));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Shift Jobs scope boundary", () => {
  it("drops an unsaved job editor when the household changes with a colliding member id", () => {
    act(() => renderJobs(scopedHousehold("HH-ONE")));
    const add = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Add job") as HTMLButtonElement;
    act(() => add.click());
    expect(container.textContent).toMatch(/New employer/);

    act(() => renderJobs(scopedHousehold("HH-TWO")));
    expect(container.textContent).not.toMatch(/New employer/);
    expect(container.textContent).toMatch(/No jobs yet/);
  });

  it("keys the canonical Shift Jobs pane to environment, household, and member", () => {
    const page = readFileSync(resolve(process.cwd(), "src/WorkShiftPage.tsx"), "utf8");
    expect(page).toContain('key={`${environment}:${household.householdId}:${memberId}`}');
  });
});
