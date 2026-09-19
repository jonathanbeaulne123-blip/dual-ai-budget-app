// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import { PersonalJourney } from "../src/house/PersonalJourney.tsx";
import type { Household, Transaction } from "../src/core/types.ts";

(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;

const fake = vi.hoisted(() => ({ throw: false, scene: vi.fn(), focusMonth: vi.fn(), dispose: vi.fn() }));
vi.mock("../src/path/world/pathWorld3d.ts", () => ({
  createPathWorld: () => {
    if (fake.throw) throw new Error("WebGL unavailable");
    return { setScene: fake.scene, focusMonth: fake.focusMonth, resize: vi.fn(), dispose: fake.dispose };
  },
}));

const privateExpense = (id: string, date: string, memberId = "MEM-001"): Transaction => ({
  id, date: date as Transaction["date"], type: "expense", amountCents: 1_000, currency: "CAD", accountId: "ACC-CHEQUING", categoryId: "CAT-LIFE", subcategoryId: "SUB-LIFE-FUN",
  note: `private ${id}`, place: "", splits: [], source: "manual", duplicateKey: id, potentialDuplicate: false, isDuplicate: false, reviewed: true, createdBy: memberId, visibility: "personal", createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`,
});

let host: HTMLDivElement, root: Root;
beforeEach(() => { fake.throw = false; fake.scene.mockReset(); fake.focusMonth.mockReset(); fake.dispose.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

function render(household: Household, callbacks = { plan: vi.fn(), back: vi.fn() }) {
  return act(async () => { root.render(createElement(PersonalJourney, { household, memberId: "MEM-001", today: "2026-09-15", onOpenPlan: callbacks.plan, onReturn: callbacks.back })); });
}

describe("Personal Journey", () => {
  it("renders only Personal evidence through the shared procedural renderer", async () => {
    const h = { ...catalogHousehold(), transactions: [
      privateExpense("mine-june", "2026-06-12"),
      privateExpense("mine-august", "2026-08-12"),
      { ...privateExpense("partner-private", "2026-08-12", "MEM-002") },
      { ...privateExpense("shared", "2026-08-12"), visibility: "household" as const, note: "shared-only-secret" },
    ] };
    const callbacks = { plan: vi.fn(), back: vi.fn() };
    await render(h, callbacks);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(host.textContent).toContain("Your own island");
    expect(host.textContent).not.toContain("shared-only-secret");
    expect(fake.scene).toHaveBeenCalled();
    const scene = fake.scene.mock.calls.at(-1)![0];
    expect(scene.campfires).toEqual([]);
    expect(scene.weather).toEqual([]);
    expect(scene.goals).toEqual([]);
    const dated = [...host.querySelectorAll<HTMLButtonElement>(".personal-journey__landmarks button")];
    expect(dated.length).toBeGreaterThan(1);
    await act(async () => dated[0]!.click());
    expect(fake.focusMonth).toHaveBeenCalledWith(0, 2);
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Open Personal Plan")!.click());
    expect(callbacks.plan).toHaveBeenCalledOnce();
  });

  it("keeps the dated controls when WebGL is unavailable", async () => {
    fake.throw = true;
    await render({ ...catalogHousehold(), transactions: [privateExpense("mine", "2026-09-12")] });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(host.querySelector(".personal-journey__flat")).toBeTruthy();
    expect(host.querySelector(".personal-journey__landmarks button")).toBeTruthy();
  });
});
