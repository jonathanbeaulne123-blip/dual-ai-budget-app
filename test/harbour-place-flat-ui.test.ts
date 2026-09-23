// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading, type HarbourReading, type TowerReading } from "../src/harbour/data/reading.ts";
import { HarbourFlat } from "../src/harbour/flat/PlaceFlat.tsx";

/**
 * The reading edition of the tower and the cellar (BUILD_PLAN_SLICE2 §6):
 * `motion: flat` must never gate a money task, so every door is a real
 * `<button>`, the jug and the gun say who holds them, and the rail's day scrub
 * is an ordinary range input that reads — and writes nothing.
 */
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const reading: HarbourReading = buildHarbourReading(household, memberId, today, "current");
const custodianId = household.householdFund?.custodianMemberId ?? memberId;

/**
 * The demo household's Build ledge is empty — its goals are filed under
 * Protect and Everyday — and the tower stands exactly what `QueenLoft` stands,
 * so a tap opens a bank the Loft really has. This is the same reading with a
 * rack hung on it, so the shelves themselves can be read.
 */
const RACK: TowerReading = {
  shelves: [
    { id: "shelf-1", share: 7, cutoff: 20, full: false, banks: [
      { key: "goal:trip", goalId: "G-trip", name: "Newfoundland, October", cents: 120_000, targetCents: 420_000, step: 2, category: "build", sculptSeed: "goal:trip" },
      { key: "goal:table", goalId: "G-table", name: "Porch table", cents: 60_000, targetCents: 60_000, step: 10, category: "build", sculptSeed: "goal:table" },
    ] },
    { id: "shelf-2", share: 3, cutoff: 10, full: true, banks: [] },
  ],
  jug: { safeCents: 48_000, custodian: true, holder: "Jonathan" },
  gun: { available: true },
  largestTargetCents: 420_000,
  smallestTargetCents: 60_000,
};
const custodianReading: HarbourReading = { ...buildHarbourReading(household, custodianId, today, "current"), tower: RACK };

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("the Tower, read", () => {
  it("lists every shelf and stands each bank as its own door", async () => {
    const opened: Array<[string, string | undefined]> = [];
    await act(async () => root.render(createElement(HarbourFlat, { place: "tower", reading: custodianReading, status: "flat", onOpen: (t: string, o?: string) => opened.push([t, o]) })));
    const section = host.querySelector("[data-place-flat='tower']")!;
    expect(section.getAttribute("aria-label")).toBe("The Home Loft, reading edition");
    const shelves = section.querySelectorAll(".place-flat__shelves > li");
    expect(shelves.length).toBe(custodianReading.tower.shelves.length);
    const banks = [...section.querySelectorAll(".place-flat__banks button")] as HTMLButtonElement[];
    expect(banks.length).toBe(custodianReading.tower.shelves.flatMap((shelf) => shelf.banks).length);
    expect(banks.length).toBeGreaterThan(0);
    for (const bank of banks) expect(bank.getAttribute("aria-label")).toMatch(/Open the Loft at this bank\.$/);
    await act(async () => { banks[0]!.click(); });
    expect(opened[0]![0]).toBe("loft-banks");
    expect(opened[0]![1]).toMatch(/^bank\/plan:/);
  });

  it("gives the jug and the gun to the custodian and names the holder to everyone else", async () => {
    await act(async () => root.render(createElement(HarbourFlat, { place: "tower", reading: custodianReading, status: "flat" })));
    const landing = [...host.querySelectorAll(".place-flat__landing button")] as HTMLButtonElement[];
    expect(landing).toHaveLength(2);
    expect(landing.every((button) => !button.disabled)).toBe(custodianReading.tower.jug.custodian);

    const theirs: HarbourReading = { ...reading, tower: { ...RACK, jug: { safeCents: 0, custodian: false, holder: "Jonathan" }, gun: { available: false } } };
    await act(async () => root.render(createElement(HarbourFlat, { place: "tower", reading: theirs, status: "flat" })));
    const after = [...host.querySelectorAll(".place-flat__landing button")] as HTMLButtonElement[];
    expect(after.every((button) => button.disabled)).toBe(true);
    expect(after[0]!.getAttribute("aria-label")).toContain("holds the jug");
    // The jug's stand is what must never read "$0": a jug somebody else is
    // holding is unknown to you, and unknown money says nothing. (The door
    // sign above it may honestly read "$0 saved" — a household with nothing
    // saved yet is a state, and the Court's own stone says the same.)
    expect(host.querySelector(".place-flat__landing")!.textContent).not.toContain("$0");
  });

  it("is cosy, not broken, with a bare rack", async () => {
    const bare: HarbourReading = { ...reading, tower: { ...RACK, shelves: [] } };
    await act(async () => root.render(createElement(HarbourFlat, { place: "tower", reading: bare, status: "flat" })));
    expect(host.textContent).toContain("Nothing on the shelf yet");
    expect(host.querySelectorAll(".place-flat__banks button")).toHaveLength(0);
  });
});

describe("the Cellar, read", () => {
  it("stands every jar as its own door, with its state in words", async () => {
    const opened: Array<[string, string | undefined]> = [];
    await act(async () => root.render(createElement(HarbourFlat, { place: "cellar", reading, status: "flat", onOpen: (t: string, o?: string) => opened.push([t, o]) })));
    const jars = [...host.querySelectorAll(".place-flat__jars button")] as HTMLButtonElement[];
    expect(jars.length).toBe(reading.cellar.jars.length);
    expect(jars.length).toBeGreaterThan(0);
    for (const jar of jars) expect(jar.getAttribute("aria-label")).toMatch(/Open the Cellar at this jar\.$/);
    expect(jars.map((jar) => jar.dataset.jarState).every((state) => ["planned", "set-aside", "paid", "short"].includes(state ?? ""))).toBe(true);
    await act(async () => { jars[0]!.click(); });
    expect(opened[0]![0]).toBe("cellar-bills");
  });

  it("walks the rail with a range input, and coming back to today is one tap", async () => {
    const days: number[] = [];
    await act(async () => root.render(createElement(HarbourFlat, { place: "cellar", reading, status: "flat", onScrub: (index: number) => days.push(index) })));
    const scrub = host.querySelector<HTMLInputElement>("input.place-flat__scrub")!;
    expect(scrub.type).toBe("range");
    expect(Number(scrub.min)).toBe(0);
    expect(Number(scrub.max)).toBe(reading.cellar.days.length - 1);
    expect(Number(scrub.value)).toBe(reading.cellar.todayIndex);
    const backToToday = host.querySelector<HTMLButtonElement>(".place-flat__today")!;
    expect(backToToday.disabled).toBe(true);

    // React tracks the input's value, so the change has to go through the native setter to be seen.
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setValue.call(scrub, "3"); scrub.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(days).toEqual([3]);
    expect(host.querySelector<HTMLButtonElement>(".place-flat__today")!.disabled).toBe(false);
    await act(async () => { host.querySelector<HTMLButtonElement>(".place-flat__today")!.click(); });
    expect(days[days.length - 1]).toBe(reading.cellar.todayIndex);
  });

  it("says the rail is dry rather than drawing an empty shelf", async () => {
    const dry: HarbourReading = { ...reading, cellar: { ...reading.cellar, jars: [] } };
    await act(async () => root.render(createElement(HarbourFlat, { place: "cellar", reading: dry, status: "flat" })));
    expect(host.textContent).toContain("No bills on the rail yet");
  });

});

/**
 * The Campfire, read. `motion: flat` must never gate the one ritual that needs
 * two people, so the fire, each log and the path of months are all real
 * buttons — and the page states the paired review in words, never a figure.
 */
describe("the Campfire, read", () => {
  const fire: HarbourReading["campfire"] = {
    month: "2026-09", title: "Make rent boring", close: "awaiting-partner",
    seats: [{ memberId: "MEM-001", name: "Jonathan", seated: true }, { memberId: "MEM-002", name: "Bianca", seated: false }],
    seated: 1, stones: 3, lit: true, lastClosedOn: "2026-08-30", sinceClose: 21, seal: 0, overdue: false,
  };

  it("names who has sat and who the fire is waiting for, and opens the Sitdown by a real button", async () => {
    const opened: Array<[string, string | undefined]> = [];
    await act(async () => root.render(createElement(HarbourFlat, { place: "campfire", reading: { ...reading, campfire: fire }, status: "flat", onOpen: (t: string, o?: string) => opened.push([t, o]) })));
    const section = host.querySelector("[data-place-flat='campfire']")!;
    expect(section.getAttribute("aria-label")).toBe("The Campfire, reading edition");
    expect(section.textContent).toContain("You have sat down. The fire is waiting for Bianca.");
    expect(section.textContent).toContain("Make rent boring");
    expect(section.textContent).toContain("3 stones");
    const logs = [...section.querySelectorAll(".place-flat__pots button")] as HTMLButtonElement[];
    expect(logs.length).toBe(2);
    expect(logs[0]!.textContent).toContain("has sat down");
    expect(logs[1]!.textContent).toContain("still empty");
    await act(async () => { logs[1]!.click(); });
    expect(opened[0]).toEqual(["plan-studio", undefined]);
    // The path of months is Journey's, and nothing on this page closes a Chapter.
    const path = section.querySelector<HTMLButtonElement>(".place-flat__bench button")!;
    await act(async () => { path.click(); });
    expect(opened[1]).toEqual(["journey", undefined]);
    expect(section.textContent).toContain("It closes when both of you sit down.");
  });

  it("says unlit kindling before the first Sitdown, and never a figure", async () => {
    const never: HarbourReading["campfire"] = { ...fire, close: "none", seats: fire.seats.map((seat) => ({ ...seat, seated: false })), seated: 0, stones: 0, lit: false, lastClosedOn: null, sinceClose: null };
    await act(async () => root.render(createElement(HarbourFlat, { place: "campfire", reading: { ...reading, campfire: never }, status: "flat" })));
    expect(host.textContent).toContain("Unlit kindling");
    expect(host.textContent).toContain("None yet");
    expect(host.textContent).toContain("No Sitdown has closed a Chapter yet");
    expect(host.textContent).not.toMatch(/\$\d/);
  });

  it("walks back up the footpath to the Court", async () => {
    let walked = 0;
    await act(async () => root.render(createElement(HarbourFlat, { place: "campfire", reading: { ...reading, campfire: fire }, status: "flat", onStair: () => { walked += 1; } })));
    const stair = host.querySelector<HTMLButtonElement>(".place-flat__stair")!;
    expect(stair.textContent).toContain("Up the footpath to the Court");
    await act(async () => { stair.click(); });
    expect(walked).toBe(1);
  });
});

describe("the Cellar's stair", () => {
  it("offers the stair back to the Court, and the Court's own edition does not", async () => {
    let walked = 0;
    await act(async () => root.render(createElement(HarbourFlat, { place: "cellar", reading, status: "flat", onStair: () => { walked += 1; } })));
    const stair = host.querySelector<HTMLButtonElement>(".place-flat__stair")!;
    expect(stair.textContent).toContain("Up the stair to the Court");
    await act(async () => { stair.click(); });
    expect(walked).toBe(1);
    await act(async () => root.render(createElement(HarbourFlat, { place: "court", reading, status: "flat", onStair: () => { walked += 1; } })));
    expect(host.querySelector(".place-flat__stair")).toBeNull();
    expect(host.querySelector("[data-court-flat]")!.getAttribute("aria-label")).toBe("Little Harbour village, reading edition");
  });
});
