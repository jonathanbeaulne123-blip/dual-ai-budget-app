import { describe, expect, it } from "vitest";
import {
  COMPUTER_BREAKPOINT,
  FOUR_COLS,
  PERSONALITY_DESK,
  PINNED_INSTRUMENTS,
  WIDE_BREAKPOINT,
  applyPersonality,
  autoSizeForCount,
  defaultComputerLayout,
  defaultLayout,
  fireFleet,
  layoutStorageBreakpoint,
  loadOfficeLayout,
  officeLayoutKey,
  packComputerDesk,
  placeFleet,
  playFour,
  playPanes,
  resetFour,
  resolveOfficeBreakpoint,
  setInstrumentHidden,
  shapeGames,
} from "../src/core/index.ts";
import { catalogHousehold } from "../src/core/index.ts";
import { readFileSync } from "node:fs";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

describe("D-151 three-view breakpoint", () => {
  it("splits phone, tablet, and computer at 720 and 1280", () => {
    expect(WIDE_BREAKPOINT).toBe(720);
    expect(COMPUTER_BREAKPOINT).toBe(1280);
    expect(resolveOfficeBreakpoint(719)).toBe("phone");
    expect(resolveOfficeBreakpoint(720)).toBe("tablet");
    expect(resolveOfficeBreakpoint(1279)).toBe("tablet");
    expect(resolveOfficeBreakpoint(1280)).toBe("computer");
    expect(layoutStorageBreakpoint("tablet")).toBe("phone");
    expect(layoutStorageBreakpoint("computer")).toBe("computer");
    expect(officeLayoutKey("development", "tablet")).toBe(officeLayoutKey("development", "phone"));
    expect(officeLayoutKey("development", "computer")).not.toBe(officeLayoutKey("development", "phone"));
  });

  it("soft-migrates wide JSON onto the computer key", () => {
    const storage = memoryStore();
    storage.setItem("hearth.office.development.wide", JSON.stringify({
      v: 2,
      items: [{ id: "blotter", size: "l" }],
      expanded: null,
      minimized: [],
      windowMinimized: false,
    }));
    const loaded = loadOfficeLayout("development", "computer", storage);
    expect(loaded.items.find((item) => item.id === "blotter")?.size).toBe("l");
    expect(storage.getItem(officeLayoutKey("development", "computer"))).toBeTruthy();
  });

  it("auto-sizes by visible count and parks calculator on Play", () => {
    expect(autoSizeForCount(4)).toBe("l");
    expect(autoSizeForCount(5)).toBe("m");
    expect(autoSizeForCount(9)).toBe("s");
    const household = applyPersonality(defaultLayout(), "household");
    expect(household.personality).toBe("household");
    expect(household.items.find((item) => item.id === "calculator")?.hidden).toBeFalsy();
    expect(household.items.filter((item) => !item.hidden)).toHaveLength(PERSONALITY_DESK.household.length);
    const play = applyPersonality(defaultLayout(), "play");
    expect(play.items.find((item) => item.id === "calculator")?.hidden).toBe(true);
    expect(PINNED_INSTRUMENTS).toContain("calculator");
    const parked = setInstrumentHidden(defaultComputerLayout(), "mail", true);
    expect(parked.personality).toBe("custom");
    expect(autoSizeForCount(parked.items.filter((item) => !item.hidden).length)).toBe("m");
  });

  it("packs computer objects without overlap at 1440", () => {
    const items = PERSONALITY_DESK.household.map(([id, size]) => ({ id, size }));
    const packed = packComputerDesk(items, 1440);
    expect(packed.blotter).toEqual({ x: 16, y: 16 });
  });

  it("keeps Fraunces names and does not require a boxed 1280 lobby", () => {
    const office = readFileSync("src/office.css", "utf8");
    const room = readFileSync("src/office-room.css", "utf8");
    expect(office).toMatch(/\.instrument-name \{[\s\S]*font-family: var\(--display\)/);
    expect(office).not.toMatch(/\.office \.instrument-name \{[\s\S]*font-size: 10px/);
    expect(room).toMatch(/office-room-desk/);
    expect(room).not.toMatch(/font-size: 10px/);
  });
});

describe("D-151 kitchen games", () => {
  it("shapes missing four/fleet/panes on old snapshots", () => {
    const shaped = shapeGames({ tictactoe: undefined, hangman: undefined });
    expect(shaped.four.columns).toHaveLength(FOUR_COLS);
    expect(shaped.fleet.boards).toHaveLength(2);
    expect(shaped.panes.h.length).toBeGreaterThan(0);
  });

  it("plays Sill Four, refuses the same member twice, and never posts money", () => {
    let household = catalogHousehold();
    household = resetFour(household, "MEM-001").household;
    const first = playFour(household, { memberId: "MEM-001", column: 0 });
    expect(first.postedIds).toEqual([]);
    expect(() => playFour(first.household, { memberId: "MEM-001", column: 1 })).toThrow(/Wait for the other person/);
    const second = playFour(first.household, { memberId: "MEM-002", column: 1 });
    expect(second.household.kitchen.games.four.columns[1]).toEqual(["copper"]);
  });

  it("places and fires Kitchen Fleet without reading the journal", () => {
    let household = catalogHousehold();
    household = placeFleet(household, { memberId: "MEM-001" }).household;
    household = placeFleet(household, { memberId: "MEM-002" }).household;
    const shot = fireFleet(household, { memberId: "MEM-001", cell: 0 });
    expect(shot.postedIds).toEqual([]);
    expect(shot.household.kitchen.games.fleet.boards[1]?.shots["0"]).toMatch(/hit|miss/);
  });

  it("claims a Pane Boxes edge", () => {
    const household = catalogHousehold();
    const result = playPanes(household, { memberId: "MEM-001", kind: "h", index: 0 });
    expect(result.postedIds).toEqual([]);
    expect(result.household.kitchen.games.panes.h[0]).toBe("MEM-001");
  });
});

describe("D-151 computer room a11y", () => {
  it("marks desk, shelves, and sofa inert while adding, and keeps a pine focus ring", () => {
    const office = readFileSync("src/Office.tsx", "utf8");
    expect(office).toMatch(/aria-label="Room destinations"/);
    expect(office).toMatch(/office-room-desk" \{\.\.\.\(inert \? \{ inert: true \}/);
    const css = readFileSync("src/office-room.css", "utf8");
    expect(css).toMatch(/office-room-shelves button:focus-visible/);
    expect(css).toMatch(/office-room-sofa:focus-visible/);
    const instrument = readFileSync("src/widgets/Instrument.tsx", "utf8");
    expect(instrument).toMatch(/inert \? \{ inert: true \}/);
  });
});
