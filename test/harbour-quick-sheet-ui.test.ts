// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HARBOUR_PLACE_NAMES } from "../src/harbour/flag.ts";
import { publishEditionAvailability } from "../src/harbour/nav/editionAvailability.ts";
import { HARBOUR_GO_EVENT, MOTION_KEY, QuickSheet, atlasSearchKey, focusAtlasSearch, quickSheetPlaces, useAtlasSearchKeys, type QuickSheetProps } from "../src/harbour/nav/QuickSheet.tsx";
import type { HouseholdWord } from "../src/harbour/nav/atlasSearch.ts";
import { useOfferWorldActions } from "../src/harbour/nav/worldActions.ts";
import { VILLAGE_ADDRESS } from "../src/harbour/village/layout.ts";

/**
 * All tools, with search (Tool Atlas brief §3.4): a dialog named "All tools and
 * search" over the map; focus goes in, stays in and comes back; search first,
 * then Recent, the Record chips, the six jobs in order, Places, Hercules,
 * Settings and the edition switch. The pawprint is not here.
 */
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); publishEditionAvailability({ flat: false, reason: null }); document.body.innerHTML = ""; });

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, getItem: (key) => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, value); } };
}

function props(overrides: Partial<QuickSheetProps> = {}): QuickSheetProps {
  return { open: true, onClose: () => undefined, onOpen: () => undefined, onStatus: () => undefined, onHercules: () => undefined, onPick: () => undefined, storage: memoryStorage(), wide: false, ...overrides };
}

const type = async (text: string) => {
  const input = host.querySelector<HTMLInputElement>("[data-atlas-search]")!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const results = () => [...host.querySelectorAll<HTMLButtonElement>("[data-atlas-result]")];
const WORDS: HouseholdWord[] = [
  { id: "bill:r-hydro", word: "Hydro", kind: "bill", target: "cellar-bills", object: "recurrence:r-hydro", group: "bills-dates", where: "the Cellar" },
  { id: "account:visa", word: "Visa", kind: "account", target: "accounts", object: "account:visa", group: "fund", where: "the Fund bank's accounts" },
  { id: "member:bianca", word: "Bianca", kind: "member", target: "queen", object: "contributions:bianca", group: "fund", where: "her contributions" },
];

describe("the dialog", () => {
  it("is named All tools and search, modal, headed All tools, with the search field first", async () => {
    await act(async () => root.render(createElement(QuickSheet, props())));
    const dialog = host.querySelector<HTMLDivElement>('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-label")).toBe("All tools and search");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelector("h2")!.textContent).toBe("All tools");
    const input = dialog.querySelector<HTMLInputElement>("[data-atlas-search]")!;
    expect(input.type).toBe("search");
    expect(input.labels?.[0]?.textContent).toMatch(/^Search/);
    // Phone: focus is inside the dialog, the field one tap away.
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(input);
    expect(host.querySelector("[data-bar-pawprint]")).toBeNull();
  });

  it("focuses the search on a wide screen", async () => {
    await act(async () => root.render(createElement(QuickSheet, props({ wide: true }))));
    expect(document.activeElement).toBe(host.querySelector("[data-atlas-search]"));
  });

  it("contains focus, and Escape and Put it back each return it to the opener", async () => {
    const opener = document.createElement("button");
    opener.textContent = "All tools";
    document.body.append(opener);
    for (const how of ["Escape", "Put it back"] as const) {
      opener.focus();
      let open = true;
      const render = () => root.render(createElement(QuickSheet, props({ open, onClose: () => { open = false; } })));
      await act(async () => render());
      const dialog = host.querySelector<HTMLDivElement>('[role="dialog"]')!;
      const focusables = [...dialog.querySelectorAll<HTMLElement>("button:not([tabindex='-1']), input")];
      focusables[focusables.length - 1]!.focus();
      await act(async () => { dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })); });
      expect(document.activeElement).toBe(focusables[0]);
      if (how === "Escape") await act(async () => { dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
      else await act(async () => host.querySelector<HTMLButtonElement>("[data-quick-sheet-close]")!.click());
      expect(open).toBe(false);
      await act(async () => render());
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(opener);
    }
    opener.remove();
  });

  it("renders nothing while closed", async () => {
    await act(async () => root.render(createElement(QuickSheet, props({ open: false }))));
    expect(host.innerHTML).toBe("");
  });

  it("roves with the arrow keys and jumps to the ends outside the field", async () => {
    await act(async () => root.render(createElement(QuickSheet, props())));
    const dialog = host.querySelector<HTMLDivElement>('[role="dialog"]')!;
    const items = [...dialog.querySelectorAll<HTMLElement>("button:not([tabindex='-1']), input")];
    const key = async (name: string) => { await act(async () => { (document.activeElement ?? dialog).dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })); }); };
    items[2]!.focus();
    await key("ArrowDown");
    expect(document.activeElement).toBe(items[3]);
    await key("ArrowRight");
    expect(document.activeElement).toBe(items[4]);
    await key("ArrowUp");
    expect(document.activeElement).toBe(items[3]);
    await key("End");
    expect(document.activeElement).toBe(items[items.length - 1]);
    await key("ArrowDown");
    expect(document.activeElement).toBe(items[0]);
    await key("Home");
    expect(document.activeElement).toBe(items[0]);
    // `/` from anywhere in the sheet goes to the field.
    items[5]!.focus();
    await key("/");
    expect(document.activeElement).toBe(host.querySelector("[data-atlas-search]"));
  });
});

describe("the order and the rows", () => {
  it("lists Recent, Record, the six jobs, Places, Hercules and Settings, in that order", async () => {
    await act(async () => root.render(createElement(QuickSheet, props({ recent: ["books", "calendar", "not-a-tool", "fund-bank"] }))));
    const order = [...host.querySelectorAll<HTMLElement>("[data-quick-sheet-group]")].map((g) => g.dataset.quickSheetGroup);
    expect(order).toEqual(["recent", "record", "bills-dates", "fund", "kitty-banks", "books", "plans", "boathouse", "places", "hercules", "settings"]);
    const headings = [...host.querySelectorAll("[data-quick-sheet-group] h3")].map((h) => h.textContent);
    expect(headings).toEqual(["Recent", "Record", "Bills and dates", "The Fund", "Kitty Banks", "Books", "Plans", "The Boathouse", "Places", "Hercules", "Settings"]);
    const recent = [...host.querySelectorAll<HTMLElement>('[data-quick-sheet-group="recent"] [data-quick-sheet-tool]')].map((b) => b.dataset.quickSheetTool);
    expect(recent).toEqual(["books", "calendar", "fund-bank"]);
    // The edition switch closes the footer.
    const footer = host.querySelector(".quick-sheet__footer")!;
    expect(footer.lastElementChild?.getAttribute("role")).toBe("switch");
  });

  it("hands each Record verb to onPick and shuts; Shift only for a member with a job", async () => {
    const picked: string[] = [];
    let closed = 0;
    await act(async () => root.render(createElement(QuickSheet, props({ onPick: (mode) => picked.push(mode), onClose: () => { closed += 1; }, recordModes: ["expense", "income", "bill", "transfer"] }))));
    const chips = [...host.querySelectorAll<HTMLButtonElement>("[data-quick-sheet-record]")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["Purchase", "Income", "Bill paid", "Move money"]);
    // Money verbs are never icon-only, and their names start with their words.
    for (const chip of chips) expect(chip.getAttribute("aria-label")!.startsWith(chip.textContent!)).toBe(true);
    await act(async () => chips[2]!.click());
    expect(picked).toEqual(["bill"]);
    expect(closed).toBe(1);
  });

  it("opens house doors, settings, Hercules and the other targets through the one dispatcher", async () => {
    const calls: string[] = [];
    await act(async () => root.render(createElement(QuickSheet, props({
      current: "books",
      onOpen: (id, object) => calls.push(`open:${id}${object ? `:${object}` : ""}`),
      onSettings: (section) => calls.push(`settings:${section}`),
      onHercules: () => calls.push("hercules"),
      onTarget: (target) => calls.push(`target:${target}`),
    }))));
    const click = async (id: string) => act(async () => host.querySelector<HTMLButtonElement>(`[data-quick-sheet-tool="${id}"]`)!.click());
    expect(host.querySelector('[data-quick-sheet-tool="books"]')?.getAttribute("aria-current")).toBe("true");
    // The rows are src/core/toolAtlas.ts's; the sheet turns each structured target into the address it dispatches.
    await click("cellar");
    await click("accounts");
    await click("charter");
    await click("status");
    await click("hercules");
    await click("cottage");
    expect(calls).toEqual(["open:cellar-bills", "target:books:wallet", "settings:household", "settings:null", "hercules", "open:wardrobe"]);
  });

  it("hides the world rows until the integrator can walk them, and keeps the private folio to Mine", async () => {
    const worlds: string[] = [];
    await act(async () => root.render(createElement(QuickSheet, props())));
    expect(host.querySelector('[data-quick-sheet-tool="step-in"]')).toBeNull();
    expect(host.querySelector('[data-quick-sheet-tool="private-folio"]')).toBeNull();
    expect(host.querySelector('[data-quick-sheet-tool="fund-bank"]')).not.toBeNull();
    await act(async () => root.render(createElement(QuickSheet, props({ space: "mine", onWorld: (action) => worlds.push(action) }))));
    expect(host.querySelector('[data-quick-sheet-tool="private-folio"]')).not.toBeNull();
    // The Fund bank is the shared Fund in both spaces (D2); the shared wishes and Arrange room are Ours only.
    expect(host.querySelector('[data-quick-sheet-tool="fund-bank"]')).not.toBeNull();
    expect(host.querySelector('[data-quick-sheet-tool="wishes"]')).toBeNull();
    expect(host.querySelector('[data-quick-sheet-tool="arrange"]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-quick-sheet-tool="step-in"]')!.click());
    expect(worlds).toEqual(["step-in"]);
  });
});

describe("world rows offered by the island", () => {
  it("lists Step in and Arrange room while the HUD offers them, and runs them there", async () => {
    const ran: string[] = [];
    function Island({ offer }: { offer: boolean }) {
      useOfferWorldActions(offer ? { "step-in": () => ran.push("guide"), arrange: () => ran.push("arrange") } : {});
      return createElement(QuickSheet, props());
    }
    await act(async () => root.render(createElement(Island, { offer: false })));
    expect(host.querySelector('[data-quick-sheet-tool="step-in"]')).toBeNull();
    await act(async () => root.render(createElement(Island, { offer: true })));
    expect(host.querySelector('[data-quick-sheet-tool="skate"]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-quick-sheet-tool="step-in"]')!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-quick-sheet-tool="arrange"]')!.click());
    expect(ran).toEqual(["guide", "arrange"]);
  });
});

describe("Places", () => {
  it("lists all twelve places once, and hands each to onPlace with how it was pressed", async () => {
    const opened: unknown[] = [];
    let closed = 0;
    await act(async () => root.render(createElement(QuickSheet, props({ onPlace: (place, how) => opened.push([place, how.keyboard]), onClose: () => { closed += 1; }, currentPlace: { room: "study", level: "above" } }))));
    const rows = [...host.querySelectorAll<HTMLButtonElement>("[data-quick-sheet-place]")];
    expect(rows.map((row) => row.dataset.quickSheetPlace).sort()).toEqual(Object.keys(HARBOUR_PLACE_NAMES).sort());
    expect(host.querySelector('[data-quick-sheet-place="glasshouse"]')?.getAttribute("aria-current")).toBe("true");
    // A pointer press (detail 1) flies the camera; a keyboard press (detail 0) gets the panel.
    await act(async () => { rows[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })); });
    await act(async () => { rows[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })); });
    expect(opened).toEqual([[rows[0]!.dataset.quickSheetPlace, false], [rows[1]!.dataset.quickSheetPlace, true]]);
    expect(closed).toBe(2);
  });

  it("walks through onGo, else the shell event, when no panel is wired", async () => {
    const walked: unknown[] = [];
    await act(async () => root.render(createElement(QuickSheet, props({ onGo: (room, level, place) => walked.push({ room, level, place }) }))));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-quick-sheet-place="tower"]')!.click());
    expect(walked).toEqual([{ ...pick(VILLAGE_ADDRESS.tower), place: "tower" }]);
    const heard: unknown[] = [];
    const listen = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener(HARBOUR_GO_EVENT, listen);
    await act(async () => root.render(createElement(QuickSheet, props())));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-quick-sheet-place="bank"]')!.click());
    window.removeEventListener(HARBOUR_GO_EVENT, listen);
    expect(heard).toEqual([{ room: "home", level: "middle", place: "bank" }]);
  });

  it("names every place in the brief's words", () => {
    const rows = quickSheetPlaces();
    expect(rows).toHaveLength(12);
    for (const row of rows) { expect(row.aria).toContain(row.name); expect(row.words).toContain("·"); }
    expect(rows.find((row) => row.place === "court")!.name).toBe("The square");
    expect(rows.find((row) => row.place === "tower")!.words).toBe("Our home · the Loft, upstairs");
  });
});
const pick = (address: { room: string; level: string }) => ({ room: address.room, level: address.level });

describe("search", () => {
  it("ranks and shows the group beside each result; Enter opens the first", async () => {
    const opened: string[] = [];
    await act(async () => root.render(createElement(QuickSheet, props({ onOpen: (id, object) => opened.push(`${id}${object ? `:${object}` : ""}`), householdWords: WORDS }))));
    await type("books");
    const first = results()[0]!;
    expect(first.querySelector(".quick-sheet__tool-name")!.textContent).toBe("Books");
    expect(first.querySelector("small")!.textContent).toBe("Books");
    expect(host.querySelector('[role="status"]')!.textContent).toMatch(/result/);
    // The groups step aside while searching.
    expect(host.querySelector('[data-quick-sheet-group="bills-dates"]')).toBeNull();
    await type("hydro");
    expect(results()[0]!.textContent).toContain("Hydro");
    expect(results()[0]!.textContent).toContain("Bills and dates — the Cellar");
    const input = host.querySelector<HTMLInputElement>("[data-atlas-search]")!;
    await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); });
    expect(opened).toEqual(["cellar-bills:recurrence:r-hydro"]);
  });

  it("finds retired words through synonyms without ever showing them", async () => {
    await act(async () => root.render(createElement(QuickSheet, props())));
    await type("master planner");
    expect(results()[0]!.dataset.atlasResult).toBe("tool:steps");
    expect(host.textContent).not.toContain("Master Planner");
    await type("quick travel");
    expect(results()[0]!.dataset.atlasResult).toBe("tool:place-square");
    await type("purchase");
    expect(results()[0]!.dataset.atlasResult).toBe("record:expense");
  });

  it("says so when nothing fits", async () => {
    await act(async () => root.render(createElement(QuickSheet, props())));
    await type("zzzz");
    expect(results()).toHaveLength(0);
    expect(host.querySelector('[role="status"]')!.textContent).toContain("Nothing found");
  });

  it("⌘K / Ctrl+K and `/` open the sheet and focus the field", async () => {
    const base = { key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, isComposing: false, defaultPrevented: false, target: document.body };
    expect(atlasSearchKey(base)).toBe(true);
    expect(atlasSearchKey({ ...base, ctrlKey: false, metaKey: true })).toBe(true);
    expect(atlasSearchKey({ ...base, ctrlKey: false })).toBe(false);
    expect(atlasSearchKey({ ...base, ctrlKey: false, key: "/" })).toBe(true);
    const field = document.createElement("input");
    expect(atlasSearchKey({ ...base, ctrlKey: false, key: "/", target: field })).toBe(false);

    let open = false;
    function Host() {
      useAtlasSearchKeys(true, () => { open = true; });
      return createElement(QuickSheet, props({ open }));
    }
    await act(async () => root.render(createElement(Host)));
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true })); });
    expect(open).toBe(true);
    await act(async () => root.render(createElement(Host)));
    expect(document.activeElement).toBe(host.querySelector("[data-atlas-search]"));
    // Called while open, it focuses at once.
    (document.activeElement as HTMLElement).blur();
    expect(focusAtlasSearch()).toBe(true);
    expect(document.activeElement).toBe(host.querySelector("[data-atlas-search]"));
  });
});

describe("the edition switch", () => {
  it("toggles Simple view into storage, and says why when the island cannot be drawn", async () => {
    const storage = memoryStorage();
    const calls: string[] = [];
    await act(async () => root.render(createElement(QuickSheet, props({
      storage, onEditionChange: (edition) => calls.push(`edition:${edition}`),
      spaceSwitch: createElement("div", { "data-space-switch": "" }, "Ours | Mine"),
      householdSwitcher: createElement("details", { "data-household-switcher": "" }, "Households"),
    }))));
    expect(host.querySelector("[data-space-switch]")?.textContent).toBe("Ours | Mine");
    expect(host.querySelector("[data-household-switcher]")).not.toBeNull();
    const toggle = () => host.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(toggle().textContent).toMatch(/^Simple view/);
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    await act(async () => toggle().click());
    expect(storage.rows.get(MOTION_KEY)).toBe("flat");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    await act(async () => toggle().click());
    expect(storage.rows.get(MOTION_KEY)).toBe("");
    expect(calls).toEqual(["edition:flat", "edition:illustrated"]);
    await act(async () => { publishEditionAvailability({ flat: true, reason: "no-webgl" }); });
    expect(toggle().getAttribute("aria-disabled")).toBe("true");
    expect(toggle().hasAttribute("disabled")).toBe(false);
    const reason = document.getElementById(toggle().getAttribute("aria-describedby")!)!;
    expect(reason.textContent).toMatch(/cannot draw/);
  });
});
