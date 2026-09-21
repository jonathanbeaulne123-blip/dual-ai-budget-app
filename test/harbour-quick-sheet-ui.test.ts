// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TARGET_NAMES } from "../src/house/navigation.ts";
import { HARBOUR_GO_EVENT, MOTION_KEY, QuickSheet, quickSheetGroups, quickSheetPlaces, quickSheetRoomless, type QuickSheetProps } from "../src/harbour/nav/QuickSheet.tsx";
import { HOUSE_LEVELS, HOUSE_ROOMS } from "../src/hearthside/houseRoutes.ts";
import { HARBOUR_LANDMARKS, HARBOUR_PLACE_NAMES } from "../src/harbour/flag.ts";

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, getItem: (key) => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, value); } };
}

function props(overrides: Partial<QuickSheetProps> = {}): QuickSheetProps {
  return { open: true, onClose: () => undefined, onOpen: () => undefined, onStatus: () => undefined, onHercules: () => undefined, storage: memoryStorage(), ...overrides };
}

it("lists every TARGET_NAMES tool exactly once, grouped by district, and opens one per tap", async () => {
  const opened: string[] = [];
  await act(async () => root.render(createElement(QuickSheet, props({ onOpen: (id) => opened.push(id), current: "books" }))));
  const buttons = [...host.querySelectorAll<HTMLButtonElement>("[data-quick-sheet-tool]")];
  const ids = buttons.map((b) => b.dataset.quickSheetTool);
  expect([...ids].sort()).toEqual(Object.keys(TARGET_NAMES).sort());
  expect(new Set(ids).size).toBe(ids.length);
  for (const button of buttons) {
    expect(button.textContent).toBe(TARGET_NAMES[button.dataset.quickSheetTool!]);
    expect(button.style.minHeight).toBe("44px");
  }
  expect([...host.querySelectorAll("[data-quick-sheet-group]")].map((g) => g.getAttribute("data-quick-sheet-group"))).toEqual(["home", "study", "kitchen", "making", "together"]);
  expect(host.querySelector('[data-quick-sheet-group="making"]')?.textContent).toContain("Enter the Pottery Studio");
  expect(host.querySelector('[data-quick-sheet-group="making"]')?.textContent).toContain("Talk with Hercules");
  expect(host.querySelector('[data-quick-sheet-tool="books"]')?.getAttribute("aria-current")).toBe("true");
  await act(async () => host.querySelector<HTMLButtonElement>('[data-quick-sheet-tool="cellar-bills"]')!.click());
  expect(opened).toEqual(["cellar-bills"]);
  const grouped = quickSheetGroups().flatMap((group) => group.tools.map((tool) => tool.id));
  expect(grouped.length).toBe(Object.keys(TARGET_NAMES).length);
});

it("traps focus, closes on Escape and returns focus to the opener", async () => {
  const opener = document.createElement("button");
  opener.textContent = "All tools";
  document.body.append(opener);
  opener.focus();
  expect(document.activeElement).toBe(opener);
  let open = true;
  const onClose = () => { open = false; };
  const render = () => root.render(createElement(QuickSheet, props({ open, onClose })));
  await act(async () => render());
  const dialog = host.querySelector<HTMLDivElement>('[role="dialog"]')!;
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(dialog.contains(document.activeElement)).toBe(true);
  // Tab from the last control wraps to the first.
  const focusables = [...dialog.querySelectorAll<HTMLElement>("button")];
  focusables[focusables.length - 1]!.focus();
  await act(async () => { dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })); });
  expect(document.activeElement).toBe(focusables[0]);
  await act(async () => { dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
  expect(open).toBe(false);
  await act(async () => render());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(opener);
  opener.remove();
});

it("carries Status, Hercules and the slotted switchers, and toggles the reading edition into localStorage", async () => {
  const storage = memoryStorage();
  const calls: string[] = [];
  await act(async () => root.render(createElement(QuickSheet, props({
    storage, onStatus: () => calls.push("status"), onHercules: () => calls.push("hercules"),
    spaceSwitch: createElement("div", { "data-space-switch": "" }, "Shared / Mine"),
    householdSwitcher: createElement("details", { "data-household-switcher": "" }, "Households"),
    onEditionChange: (edition) => calls.push(`edition:${edition}`),
  }))));
  expect(host.querySelector("[data-space-switch]")?.textContent).toBe("Shared / Mine");
  expect(host.querySelector("[data-household-switcher]")).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>("[data-quick-sheet-status]")!.click());
  await act(async () => host.querySelector<HTMLButtonElement>("[data-quick-sheet-hercules]")!.click());
  const toggle = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  await act(async () => toggle.click());
  expect(storage.rows.get(MOTION_KEY)).toBe("flat");
  expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");
  await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  expect(storage.rows.get(MOTION_KEY)).toBe("");
  expect(calls).toEqual(["status", "hercules", "edition:flat", "edition:illustrated"]);
});

it("renders nothing while closed", async () => {
  await act(async () => root.render(createElement(QuickSheet, props({ open: false }))));
  expect(host.innerHTML).toBe("");
});

it("lists every room × level of the island, and every landmark is one of them", async () => {
  const walked: string[] = [];
  let open = true;
  await act(async () => root.render(createElement(QuickSheet, props({
    onGo: (room, level) => walked.push(`${room}:${level}`),
    onClose: () => { open = false; },
    currentPlace: { room: "study", level: "above" },
  }))));
  const rows = [...host.querySelectorAll<HTMLButtonElement>("[data-quick-sheet-place]")];
  const keys = rows.map((row) => row.dataset.quickSheetPlace);
  // Fifteen slots: five rooms, three levels, none missing and none twice.
  const every = HOUSE_ROOMS.flatMap((room) => HOUSE_LEVELS.map((level) => `${room}:${level}`));
  expect([...keys].sort()).toEqual([...every].sort());
  expect(new Set(keys).size).toBe(keys.length);
  for (const row of rows) expect(row.style.minHeight).toBe("44px");

  // Every place of the island is named on a row, by its own name.
  const named = rows.map((row) => row.dataset.quickSheetPlaceId).filter(Boolean);
  expect(new Set(named)).toEqual(new Set(Object.keys(HARBOUR_PLACE_NAMES)));
  expect(host.querySelector('[data-quick-sheet-place="home:above"]')?.textContent).toContain("The Tower");
  expect(host.querySelector('[data-quick-sheet-place="making:below"]')?.textContent).toContain("The Campfire");
  expect(host.querySelector('[data-quick-sheet-place="kitchen-table:above"]')?.textContent).toContain("The Atlas");

  // Every landmark standing on the lawn is one of those slots: nothing on the island is more than one tap away.
  for (const [id, landmark] of Object.entries(HARBOUR_LANDMARKS)) {
    expect(keys, id).toContain(`${landmark.room}:${landmark.level}`);
  }

  // The place you are standing in reads as current, and a tap walks and closes.
  expect(host.querySelector('[data-quick-sheet-place="study:above"]')?.getAttribute("aria-current")).toBe("true");
  await act(async () => host.querySelector<HTMLButtonElement>('[data-quick-sheet-place="together:below"]')!.click());
  expect(walked).toEqual(["together:below"]);
  expect(open).toBe(false);
});

it("walks through the shell's own event when the App hands it no navigator", async () => {
  const heard: unknown[] = [];
  const listen = (event: Event) => heard.push((event as CustomEvent).detail);
  window.addEventListener(HARBOUR_GO_EVENT, listen);
  await act(async () => root.render(createElement(QuickSheet, props())));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-quick-sheet-place="home:below"]')!.click());
  window.removeEventListener(HARBOUR_GO_EVENT, listen);
  expect(heard).toEqual([{ room: "home", level: "below" }]);
});

it("marks the tools that have no room of their own, and names no others", () => {
  // Hercules and the dressing room open wherever you are standing; every other
  // tool has a room, and walking to it is what opens it.
  expect(quickSheetRoomless().sort()).toEqual(["hercules", "wardrobe"]);
  const rooms = quickSheetPlaces();
  expect(rooms).toHaveLength(15);
  for (const row of rooms) {
    expect(row.name.length).toBeGreaterThan(0);
    expect(row.words).toContain("·");
    // Read aloud, a row says the room and the level, always.
    expect(row.aria, row.key).toContain(row.name);
    expect(row.aria, row.key).toContain(row.level);
  }
  // Where the island renamed a slot, the row says so rather than leaving two
  // names to be guessed between: the Campfire stands where the house said
  // "the cabinet of wonders".
  const fire = rooms.find((row) => row.place === "campfire")!;
  expect(fire.aria).toContain("the house calls this place The cabinet of wonders");
  const tower = rooms.find((row) => row.place === "tower")!;
  expect(tower.words).toBe("Home · Loft");
});

it("marks the roomless tools in the sheet itself", async () => {
  await act(async () => root.render(createElement(QuickSheet, props())));
  const marked = [...host.querySelectorAll<HTMLButtonElement>("[data-quick-sheet-roomless]")].map((b) => b.dataset.quickSheetTool);
  expect(marked.sort()).toEqual(["hercules", "wardrobe"]);
});

it("roves with the arrow keys and jumps to the ends, so a thumb is not the only way in", async () => {
  await act(async () => root.render(createElement(QuickSheet, props())));
  const dialog = host.querySelector<HTMLDivElement>('[role="dialog"]')!;
  const items = [...dialog.querySelectorAll<HTMLElement>("button")];
  const key = async (name: string) => { await act(async () => { dialog.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })); }); };
  items[0]!.focus();
  await key("ArrowDown");
  expect(document.activeElement).toBe(items[1]);
  await key("ArrowRight");
  expect(document.activeElement).toBe(items[2]);
  await key("ArrowUp");
  expect(document.activeElement).toBe(items[1]);
  await key("End");
  expect(document.activeElement).toBe(items[items.length - 1]);
  // Both ends wrap: the sheet is one ring, however it is laid out.
  await key("ArrowDown");
  expect(document.activeElement).toBe(items[0]);
  await key("ArrowUp");
  expect(document.activeElement).toBe(items[items.length - 1]);
  await key("Home");
  expect(document.activeElement).toBe(items[0]);
});
