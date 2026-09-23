// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import { HarbourFlat } from "../src/harbour/flat/PlaceFlat.tsx";

const household = seedDemoHousehold({ today: "2026-09-20" });
const reading = buildHarbourReading(household, household.members[0]!.id, "2026-09-20", "current");
let host: HTMLDivElement, root: Root;

beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("the village reading edition", () => {
  it("offers every other Harbour place as a real, keyboard-ready village door", async () => {
    const entered: string[] = [];
    await act(async () => root.render(createElement(HarbourFlat, { place: "court", reading, status: "flat", onEnter: (place: string) => entered.push(place), partnerName: "Bianca" })));
    const square = host.querySelector<HTMLElement>("[data-place-flat='court']")!;
    expect(square.getAttribute("aria-label")).toBe("Little Harbour village, reading edition");
    const doors = [...square.querySelectorAll<HTMLButtonElement>("[data-village-destination]")];
    expect([...new Set(doors.map((door) => door.dataset.villageDestination))].sort()).toEqual(["atlas", "bank", "boathouse", "campfire", "cellar", "cottage", "glasshouse", "kiln", "kitchen", "library", "tower"]);
    expect(doors.every((door) => door.type === "button" && !door.disabled)).toBe(true);
    expect(square.textContent).toContain("Home Loft");
    expect(square.textContent).not.toContain("Bianca is here");
    await act(async () => doors.find((door) => door.dataset.villageDestination === "bank")!.click());
    expect(entered).toEqual(["bank"]);
  });

  it("keeps Bank values unknown until read and leaves both existing Fund tasks open", async () => {
    const opened: string[] = [];
    await act(async () => root.render(createElement(HarbourFlat, { place: "bank", reading: null, status: "fallback", onOpen: (target: string) => opened.push(target) })));
    const bank = host.querySelector<HTMLElement>("[data-place-flat='bank']")!;
    expect(bank.textContent).toContain("Everyday");
    expect(bank.textContent).toContain("—");
    const buttons = [...bank.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.map((button) => button.textContent)).toEqual(expect.arrayContaining(["Meet the Queen", "Open the books"]));
    await act(async () => buttons.find((button) => button.textContent === "Meet the Queen")!.click());
    await act(async () => buttons.find((button) => button.textContent === "Open the books")!.click());
    expect(opened).toEqual(["queen", "books"]);
  });
});
