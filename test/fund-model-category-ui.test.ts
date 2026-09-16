// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AddCategoryForm } from "../src/AddCategoryForm.tsx";
import { catalogHousehold, type Household } from "../src/core/index.ts";
import { migrated } from "./fixtures/fund-model.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(household: Household) {
  const saved: Household[] = [];
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(AddCategoryForm, { household, onSave: (next: Household) => saved.push(next) })));
  const setName = async (value: string) => {
    const input = host.querySelector<HTMLInputElement>("input")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const press = async (selector: string) => act(async () => host.querySelector<HTMLButtonElement>(selector)!.click());
  const save = async () => act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent === "Save category")!.click());
  return { host, saved, setName, press, save, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}

describe("add a category under one of the 12 umbrellas (D-269)", () => {
  it("keeps the group select before the household is sorted", async () => {
    const ui = await mount(catalogHousehold());
    try {
      expect(ui.host.querySelector("select")).not.toBeNull();
      expect(ui.host.querySelector(".umbrella-grid")).toBeNull();
    } finally { await ui.close(); }
  });
  it("shows 12 pressable tiles and three funds (never Protect), proposes the fund, and saves under the umbrella", async () => {
    const ui = await mount(migrated(catalogHousehold()));
    try {
      const tiles = [...ui.host.querySelectorAll<HTMLButtonElement>(".umbrella-tile")];
      expect(tiles.map((row) => row.querySelector(".umbrella-tile__name")!.textContent)).toEqual(["Home", "Utilities", "Food", "Transport", "Health", "Personal", "Fun", "Travel", "Pets & family", "Gifts & giving", "Work & learning", "Money"]);
      expect(tiles.every((row) => row.getAttribute("aria-pressed") === "false")).toBe(true);
      const funds = [...ui.host.querySelectorAll<HTMLButtonElement>(".fund-choice__option")];
      expect(funds.map((row) => row.dataset.fund)).toEqual(["everyday", "prepare", "build"]);
      expect(funds.every((row) => row.disabled)).toBe(true);
      await ui.setName("Flights");
      await ui.save();
      expect(ui.host.textContent).toContain("Choose an umbrella");
      expect(ui.saved).toHaveLength(0);
      await ui.press('.umbrella-tile[title^="Trips"]');
      expect(ui.host.querySelector('.umbrella-tile[title^="Trips"]')!.getAttribute("aria-pressed")).toBe("true");
      expect(ui.host.querySelector('[data-fund="build"]')!.getAttribute("aria-pressed")).toBe("true");
      await ui.press('[data-fund="everyday"]');
      await ui.save();
      expect(ui.saved).toHaveLength(1);
      const created = ui.saved[0]!.categories.find((row) => row.name === "Flights")!;
      expect(created).toMatchObject({ parentId: "UMB-TRAVEL", defaultFund: "everyday" });
    } finally { await ui.close(); }
  });
});
