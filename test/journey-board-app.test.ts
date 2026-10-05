// @vitest-environment jsdom
/**
 * The Journey Map (Horizon Clock) in the real App: house world + harbour on, WebGL unavailable (jsdom), illustrated
 * edition chosen. The behaviour is the Journey Board's (arrival, actions, Enter Horizon / return, list parity); the
 * selectors are the clock shell's.
 *
 * The App loads the fictional Development demo kitchen with a substantial journey (`journeyDemoHousehold`, built on
 * `seedDemoHousehold` through the real commands) from its local replica, and — as the tab's first arrival — lands on
 * the household Journey map (its flat clock: no WebGL). Then:
 * - select a bill (its day slot on the clock, then the bill in that day's sheet; and the list row) → "Mark paid…" →
 *   the App's Bill paid flow opens at THAT recurrence's named Confirm → close → the same selection and focus return;
 * - selecting, the level pull (Year / Month / Week), previewing a crossroads, Back to now, turning past and upcoming
 *   chapters, the "+" dial and opening and closing sheets leave the household's `financialAuditHash` exactly as it
 *   was, and browsing never moves the bus (the household's place);
 * - a brand-new household (`emptyBoardHousehold`) shows the honest empty map, no memory or milestone marks or rows.
 * Nothing leaves the loopback: storage, the books engine and continuity are the same mocks the other full-App tests
 * use; the land files are served from public/ through a stubbed fetch.
 */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../src/core/index.ts";

vi.setConfig({ testTimeout: 120_000 });
afterAll(() => vi.resetConfig());

vi.hoisted(() => {
  vi.stubEnv("VITE_HEARTH_HOUSE_WORLD", "1");
  vi.stubEnv("VITE_HEARTH_HARBOUR", "1");
  vi.stubEnv("VITE_LEDGER_SYNC_V2", "0");
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
});

const state = vi.hoisted(() => ({
  stored: null as Household | null,
  saves: [] as Household[],
  /** Every household the App handed the Journey Board, in render order (the real board renders; this only watches). */
  boardHouseholds: [] as Household[],
  boardToday: [] as string[],
  /** Serve the slim baked Journey land (the production path); false → 404, so the loader falls back to the index. */
  slim: true,
  /** Every URL the App fetched, in order (to prove which land path served the board). */
  fetched: [] as string[],
}));

vi.mock("../src/ledgerSync/presence.ts", () => ({ attachLedgerPresence: () => () => {} }));
vi.mock("../src/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/storage.ts")>();
  return {
    ...actual,
    peekHousehold: vi.fn(() => state.stored),
    loadHousehold: vi.fn(async () => state.stored),
    listHouseholdReplicas: vi.fn(async () => []),
    loadPersonalReplica: vi.fn(async () => null),
    saveHousehold: vi.fn(async (household: Household) => { state.saves.push(household); }),
  };
});
vi.mock("../src/ledger/engine.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledger/engine.ts")>();
  const status = (household: Household) => ({ ok: true, engine: "pglite" as const, entryCount: household.transactions.length, inBalance: true, equationHolds: true });
  return {
    ...actual,
    inspectBrowserBooks: vi.fn(async (household: Household) => ({ ok: true, message: "PGlite agrees.", entryCount: household.transactions.length })),
    ingestHouseholdBooks: vi.fn(async (household: Household) => ({ compiled: {} as never, status: status(household) })),
    validateHouseholdBooksStaged: vi.fn(async (household: Household) => status(household)),
    prewarmStagedHouseholdBooks: vi.fn(async () => undefined),
    clearStagedHouseholdBooks: vi.fn(async () => undefined),
  };
});
vi.mock("../src/continuity.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/continuity.ts")>();
  return { ...actual, discoverContinuityMemberships: vi.fn(async () => []), hostedContinuityAllowed: vi.fn(() => false) };
});
// A pass-through watch on the REAL board: it renders exactly as the App mounts it; the test only reads its props.
vi.mock("../src/journey/ui/JourneyBoard.tsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/journey/ui/JourneyBoard.tsx")>();
  const Real = actual.default;
  return {
    ...actual,
    default: (props: Parameters<typeof Real>[0]) => {
      state.boardHouseholds.push(props.household);
      state.boardToday.push(props.today);
      return createElement(Real, props);
    },
  };
});

import { App } from "../src/App.tsx";
import { ThemeProvider } from "../src/theme/ThemeProvider.tsx";
import { financialAuditHash } from "../src/core/index.ts";
import { HORIZON_INDEX_URL } from "../src/house/world/horizonAssets.ts";
import { journeyLandTimings, resetJourneyLandCacheForTests } from "../src/journey/land/index.ts";
import { JOURNEY_LAND_SLIM_URL } from "../src/journey/land/slim.ts";
import { journeyViewStateKeyV2 } from "../src/journey/contracts.ts";
import { deriveJourneyBoard } from "../src/journey/model/index.ts";
import { journeyMarkDomId } from "../src/journey/ui/Marks.tsx";
import { journeyRowDomId } from "../src/journey/ui/ListView.tsx";
import { journeyPanelActionDomId } from "../src/journey/ui/StopPanel.tsx";
import { BIANCA, FIXTURE_TODAY, emptyBoardHousehold, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";
import { MOTION_KEY } from "../src/harbour/nav/motionEdition.ts";
import { arrivalKey, JOURNEY_HOME_ROUTE } from "../src/harbour/nav/arrival.ts";
import { housePath } from "../src/hearthside/houseRoutes.ts";
import { houseIdentity } from "../src/house/navigation.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const INDEX_GZ = toArrayBuffer(readFileSync("public/horizon/world/horizon-geo-1.index.json.gz"));
const TERRAIN = toArrayBuffer(readFileSync("public/horizon/terrain/horizon-geo-1.bin"));
const SLIM_GZ = toArrayBuffer(readFileSync("public/horizon/world/horizon-geo-1.journey.json.gz"));

async function settle(rounds = 3) {
  for (let i = 0; i < rounds; i += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
async function waitFor<T>(read: () => T | null | undefined | false, what: string, timeout = 15_000): Promise<T> {
  // performance.now, not Date.now: only Date is faked (frozen at the fixture's day).
  const deadline = performance.now() + timeout;
  for (;;) {
    const value = read();
    if (value) return value;
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await settle(1);
  }
}

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  // One clock: the App's `today` is the fixture's day in Toronto (only Date is faked; timers stay real).
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-28T16:00:00.000Z") });
  state.saves = []; state.boardHouseholds = []; state.boardToday = []; state.slim = true; state.fetched = [];
  history.replaceState(null, "", "/");
  localStorage.clear(); sessionStorage.clear();
  // The illustrated edition is chosen (no `hearth:motion`): D65 sends the reading edition to the Desk, so the Journey
  // Board is the illustrated edition's arrival. jsdom has no WebGL, so the board still stands its flat twin.
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) });
  class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom has no WebGL: the board stands its flat twin (and the land is the real baked land from public/).
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    state.fetched.push(url);
    if (url === JOURNEY_LAND_SLIM_URL && state.slim) return new Response(SLIM_GZ.slice(0), { headers: { "content-type": "application/gzip" } });
    if (url === HORIZON_INDEX_URL) return new Response(INDEX_GZ.slice(0), { headers: { "content-type": "application/gzip" } });
    if (url.endsWith("/horizon-geo-1.bin")) return new Response(TERRAIN.slice(0), { headers: { "content-type": "application/octet-stream" } });
    return new Response("not found", { status: 404 });
  }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear(); sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openApp(household: Household, memberId: string, options: { themed?: boolean } = {}) {
  state.stored = household;
  localStorage.setItem("hearth:session:v1:development", JSON.stringify({ memberId, view: "household", householdId: household.householdId }));
  // `themed`: inside the app's ThemeProvider, as main.tsx mounts it (the appearance store the theme dot applies through).
  await act(async () => { root.render(options.themed ? createElement(ThemeProvider, null, createElement(App)) : createElement(App)); });
  return waitFor(() => container.querySelector<HTMLElement>("[data-journey-board]"), "the Journey Board", 60_000);
}

/** Activate as a keyboard or switch does: focus moves to the control, then it is pressed (jsdom's click() alone moves no focus). */
async function press(el: Element | null | undefined, what: string) {
  expect(el, what).toBeTruthy();
  await act(async () => { (el as HTMLElement).focus(); (el as HTMLElement).click(); });
  await settle(1);
}
const q = <E extends Element = HTMLElement>(selector: string) => document.querySelector<E>(selector);
const esc = (v: string) => v.replace(/["\\]/g, "\\$&");
const panel = () => q("[data-journey-panel]");
const addSheet = () => q("[data-add-slideshow]");
/** The App's Add sheet is up (it stays mounted, paused, after Close; `open` shows as its fieldset enabled). */
const addSheetOpen = () => { const sheet = addSheet(); return Boolean(sheet && !sheet.querySelector<HTMLFieldSetElement>(".entry-sheet-fields")?.disabled); };

/** Every distinct household the App handed the board, hashed; plus every save the App made. */
async function moneyHashes(): Promise<string[]> {
  const distinct = [...new Set([...state.boardHouseholds, ...state.saves])];
  return [...new Set(await Promise.all(distinct.map((h) => financialAuditHash(h))))];
}

const closeAddSheet = async () => {
  await press([...addSheet()!.querySelectorAll("button")].find((b) => b.textContent === "Close"), "Close the Add sheet");
  await waitFor(() => !addSheetOpen(), "the Add sheet closed");
  await settle(3);
};
const markPaidId = (stopId: string) => `[data-action-id="${esc(`${stopId}#mark-paid`)}"]`;

/** The flat clock's day slot for a date, and the day sheet's button for a stop on it. */
const dayMark = (date: string) => q(`#${journeyMarkDomId(date)}`);
const openFromDay = (stopId: string) => panel()?.querySelector<HTMLElement>(`[data-open-stop="${esc(stopId)}"]`) ?? null;
/** The Map's month title in the header. */
const monthTitle = (board: HTMLElement) => board.querySelector("[data-chapter-month]")?.textContent ?? null;
/** The bus (the household's place) on the flat clock: its mark and its words. */
const busMark = () => q(`#${journeyMarkDomId("piece")}`);

/**
 * Open a stop from its day on the clock: a day with one stop opens that stop's sheet; a day with two or three shows each
 * stop's card in the day sheet; a busier day lists them (then the stop opens its own sheet).
 */
async function selectFromDay(date: string, stopId: string) {
  await press(dayMark(date), `the ${date} slot`);
  const listed = openFromDay(stopId);
  if (listed) await press(listed, `${stopId} in the day`);
  return panel()!;
}
/** The stop's own controls wherever they stand (its sheet, or its card in the day sheet). */
const stopScope = (stopId: string) => panel()?.querySelector<HTMLElement>(`[data-stop-card="${esc(stopId)}"]`) ?? panel();

describe("the household Journey map in the App", () => {
  it("is the tab's arrival; a bill's Mark paid… opens the App's Bill paid at THAT recurrence; closing returns the same selection and focus", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock (no WebGL in jsdom)");

    // Arrival: the tab's first household landing is the Journey (kitchen-table/above): today's chapter at Month, the bus on today.
    expect(location.pathname).toBe("/house/kitchen-table/above");
    expect(state.boardToday.at(-1)).toBe(FIXTURE_TODAY);
    expect(board.getAttribute("data-journey-level")).toBe("month");
    expect(monthTitle(board)).toBe("September");
    expect(busMark()!.getAttribute("aria-label")).toContain("Today");
    // The Compass is not drawn over the map (it has its own "+").
    expect(q("[data-harbour-bar]")).toBeNull();

    // The bill: Tenant insurance, due Fri 18 Sep, not recorded — one of three stops on that day.
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    const derived = deriveJourneyBoard(household, BIANCA, FIXTURE_TODAY).stops.find((s) => s.id === stopId);
    expect(derived && derived.kind === "commitment" && derived.status).toBe("overdue");
    expect(dayMark("2026-09-18")!.classList.contains("journey-mark--check"), "the honey ring: a date passed, not recorded").toBe(true);
    await selectFromDay("2026-09-18", stopId);
    const card = () => stopScope(stopId)!;
    expect(card().textContent).toContain("Tenant insurance");
    expect(card().textContent).toContain("Overdue · not recorded");
    expect(card().textContent).toContain("$118.00");
    expect(addSheetOpen()).toBe(false);

    // Mark paid… → the App's own Bill paid flow, at this bill's named Confirm. Nothing is recorded by opening it.
    const markPaid = card().querySelector<HTMLButtonElement>(markPaidId(stopId));
    expect(markPaid?.textContent).toBe("Mark paid…");
    await press(markPaid, "Mark paid…");
    await waitFor(() => addSheetOpen() && q("[data-bill-confirm]"), "the Bill paid confirm");
    expect(addSheet()!.getAttribute("data-add-slideshow")).toBe("bill");
    expect(addSheet()!.getAttribute("data-add-slide")).toBe("bill-confirm");
    const confirm = q("[data-bill-confirm]")!;
    expect(confirm.getAttribute("data-bill-confirm")).toBe(ids.insuranceRecurrenceId);
    expect(confirm.textContent).toContain("Tenant insurance");
    expect(confirm.textContent).toContain("$118.00");
    expect(confirm.querySelector("[data-add-confirm-bill]"), "its named Confirm waits for a press").toBeTruthy();

    // Close without confirming: the map is where it was — the same stop selected, focus back on its Mark paid….
    await closeAddSheet();
    expect(q("[data-journey-board]")).toBe(board);
    expect(card().textContent).toContain("Tenant insurance");
    expect(document.activeElement, "focus returns to the control that opened Bill paid").toBe(card().querySelector(markPaidId(stopId)));
    // The selection is the device's view state too (a remount restores it).
    await settle(20);
    const saved = JSON.parse(localStorage.getItem(journeyViewStateKeyV2({ environment: "development", householdId: household.householdId, memberId: BIANCA }))!) as { selectedStopId: string };
    expect([stopId, "2026-09-18"]).toContain(saved.selectedStopId);

    expect(await moneyHashes()).toEqual([before]);
  });

  it("the list row's Mark paid… opens the same Bill paid for the same recurrence, and closing returns focus to the row", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    await press(board.querySelector('[data-list-mode="list"]'), "List");
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    const row = await waitFor(() => q(`#${journeyRowDomId(stopId)}`), "the Tenant insurance row");
    expect(row.querySelector(".journey-row__status")?.textContent).toBe("Overdue · not recorded");
    expect(row.querySelector(".journey-row__amount")?.textContent).toBe("$118.00 · scheduled");
    // To check rows lead the month (ruling 1): the row stands in "Needs you".
    expect(row.closest('[data-group-id]')?.getAttribute("data-group-id")).toBe("needs-you");
    await press(row.querySelector(markPaidId(stopId)), "the row's Mark paid…");
    await waitFor(() => addSheetOpen() && q("[data-bill-confirm]"), "the Bill paid confirm from the list");
    expect(addSheet()!.getAttribute("data-add-slide")).toBe("bill-confirm");
    expect(q("[data-bill-confirm]")!.getAttribute("data-bill-confirm")).toBe(ids.insuranceRecurrenceId);
    await closeAddSheet();
    expect(board.querySelector('[data-list-mode="list"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(q(`#${journeyRowDomId(stopId)} ${markPaidId(stopId)}`));
    expect(await moneyHashes()).toEqual([before]);
  });

  // D-T6-1: after Close pauses the Add sheet, "Mark paid…" again for the SAME recurrence must land on that bill's named
  // Confirm again, not on "Which bill was paid?" — the paused `AddSlideshow` forgets its preselection while closed.
  it("pressing Mark paid… again for the same bill after closing opens that bill's Confirm again", async () => {
    const { household, ids } = journeyDemoHousehold();
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    await selectFromDay("2026-09-18", stopId);
    await press(stopScope(stopId)!.querySelector(markPaidId(stopId)), "Mark paid…");
    await waitFor(() => addSheetOpen() && q("[data-bill-confirm]"), "the first Bill paid confirm");
    await closeAddSheet();
    await press(stopScope(stopId)!.querySelector(markPaidId(stopId)), "Mark paid… again");
    await settle(5);
    expect(addSheetOpen()).toBe(true);
    expect(addSheet()!.getAttribute("data-add-slide")).toBe("bill-confirm");
    expect(q("[data-bill-confirm]")?.getAttribute("data-bill-confirm")).toBe(ids.insuranceRecurrenceId);
  });

  it("select, pull the level, preview a crossroads, Back to now, turn chapters, the dial and sheets: the books never change, and browsing never moves the bus", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    const path = location.pathname;
    const busWords = busMark()!.getAttribute("aria-label");
    const sheetUp = () => Boolean(panel());

    // Select: a paid bill on its day, the bus (today), Hercules's list; Escape and Close put each away.
    const waterPaid = `bill:${ids.waterRecurrenceId}@2026-09-18`;
    await selectFromDay("2026-09-18", waterPaid);
    expect(stopScope(waterPaid)!.textContent).toContain("Paid");
    await act(async () => { panel()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await settle(1);
    expect(sheetUp()).toBe(false);
    await press(busMark(), "the bus");
    expect(panel()!.textContent).toContain("28");
    await press(panel()!.querySelector(".journey-panel__close"), "Close");
    // Hercules's bubble opens his list (the checklist): To check is THE board.toCheck; opening it runs nothing.
    await press(board.querySelector("[data-journey-bubble]"), "Hercules's bubble");
    const toCheck = panel()!.querySelector('[data-checklist-section="to-check"]');
    expect(toCheck?.getAttribute("aria-label")).toBe(`To check · ${deriveJourneyBoard(household, BIANCA, FIXTURE_TODAY).toCheck.length}`);
    await press(panel()!.querySelector(".journey-panel__close"), "Close");

    // The level pull: Year (twelve minis), Week (the trail), back to Month; the stage's keys.
    await press(board.querySelector('[data-level="year"]'), "Year");
    expect(board.getAttribute("data-journey-level")).toBe("year");
    expect(board.querySelectorAll(".journey-mark--chapter").length).toBe(deriveJourneyBoard(household, BIANCA, FIXTURE_TODAY).chapters.length);
    await press(board.querySelector('[data-level="week"]'), "Week");
    expect(board.getAttribute("data-journey-level")).toBe("week");
    expect(q(`#${journeyMarkDomId("pile")}`), "the overdue pile pinned to Monday").toBeTruthy();
    await press(board.querySelector('[data-level="month"]'), "Month");
    expect(board.getAttribute("data-journey-level")).toBe("month");
    const stage = board.querySelector<HTMLElement>(".journey-stage")!;
    for (const key of ["ArrowRight", "PageDown", "PageUp", "ArrowLeft", "Home"]) {
      await act(async () => { stage.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });
    }
    await settle(1);

    // A crossroads (today, with others): preview the other alternative (text only; nothing changes), then return.
    const era = `crossroads:era:${ids.eraRowId}`;
    await press(dayMark(FIXTURE_TODAY), "today's slot");
    await press(openFromDay(era), "the era crossroads");
    const other = panel()!.querySelector<HTMLElement>(".journey-alternative--other .journey-alternative__pick");
    await press(other, "preview the suggestion");
    expect(panel()!.textContent).toContain("Preview — nothing has changed");
    await press([...panel()!.querySelectorAll("button")].find((b) => b.textContent === "Return without changing"), "Return without changing");
    expect(panel()!.textContent).not.toContain("Preview — nothing has changed");
    await press(panel()!.querySelector(".journey-panel__close"), "Close");

    // Turn to an earlier and a later chapter: the view moves, the household's bus does not.
    await press(board.querySelector('[data-step="-1"]'), "the month before");
    expect(monthTitle(board)).toBe("August");
    expect(busMark(), "the bus stands only in today's chapter").toBeNull();
    await press(board.querySelector('[data-step="1"]'), "back");
    await press(board.querySelector('[data-step="1"]'), "the month after");
    expect(monthTitle(board)).toBe("October");
    // Back to now (Hercules's chip in another chapter).
    await press(board.querySelector('[data-journey-bubble="other"]'), "Back to now");
    expect(monthTitle(board)).toBe("September");
    expect(busMark()!.getAttribute("aria-label")).toBe(busWords);

    // The "+" dial opens and closes; its chips are open-only (All tools / Simple view are here: the App supplies them).
    await press(board.querySelector("[data-journey-plus]"), "+");
    const chips = [...board.querySelectorAll<HTMLElement>("[data-dial-chip]")].map((c) => c.dataset.dialChip);
    expect(chips).toEqual(expect.arrayContaining(["calendar", "books", "kitchen", "simple", "all-tools"]));
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await settle(1);
    expect(board.querySelector("[data-journey-radial]")).toBeNull();

    // Map ↔ List and back.
    await press(board.querySelector('[data-list-mode="list"]'), "List");
    expect(board.querySelector("[data-journey-list]")).toBeTruthy();
    await press(board.querySelector('[data-list-mode="map"]'), "Map");
    await settle(20);

    // Nothing above opened a surface, moved the household or wrote the books.
    expect(location.pathname).toBe(path);
    expect(addSheetOpen()).toBe(false);
    expect(q(".journey-era-sheet")).toBeNull();
    expect(q("[data-journey-board]")).toBe(board);
    expect(await moneyHashes()).toEqual([before]);
  });

  it("the dial's All tools opens the App's quick sheet; the theme dot applies the app-wide theme; neither posts", async () => {
    const { household } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA, { themed: true });
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    const themeBefore = board.getAttribute("data-theme");
    await press(board.querySelector("[data-theme-dot]"), "the theme dot");
    const next = [...board.querySelectorAll<HTMLElement>("[data-theme-option]")].find((b) => b.dataset.themeOption !== themeBefore)!;
    await press(next, `theme ${next.dataset.themeOption}`);
    await waitFor(() => q("[data-journey-board]")?.getAttribute("data-theme") === next.dataset.themeOption, "the map in the chosen theme");
    const map = q<HTMLElement>("[data-journey-board]")!;
    // App-wide (ruling 12): the document's theme follows, not a board-only preview.
    expect(document.documentElement.dataset.theme).toBe(next.dataset.themeOption);
    await press(map.querySelector("[data-journey-plus]"), "+");
    await press(map.querySelector('[data-dial-chip="all-tools"]'), "All tools");
    await waitFor(() => q('[data-quick-sheet="open"]'), "the App's quick sheet");
    expect(await moneyHashes()).toEqual([before]);
  });

  it("a brand-new household sees the honest empty map: no invented memories or milestones, the list says so", async () => {
    const household = emptyBoardHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    expect(board.classList.contains("journey-board--empty")).toBe(true);
    const empty = board.querySelector<HTMLElement>("[data-journey-empty]")!;
    expect(empty.textContent).toContain("Nothing is on the map yet");
    expect(empty.textContent).toContain("Nothing is invented for you.");
    // The map: today and the bus only — no money, memory or milestone marks; no to-check ring.
    const kinds = new Set([...board.querySelectorAll<HTMLElement>(".journey-mark:not([hidden])")].map((b) => b.dataset.markKind));
    expect([...kinds].every((k) => k === "day" || k === "piece" || k === "hercules")).toBe(true);
    expect(board.querySelector(".journey-mark--check")).toBeNull();
    // Direct access never depends on the map: the dial still records.
    await press(board.querySelector("[data-journey-plus]"), "+");
    expect([...board.querySelectorAll<HTMLElement>("[data-dial-verb]")].map((b) => b.dataset.dialVerb)).toEqual(["purchase", "paid", "income"]);
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    // The list: the honest empty words; no memory or milestone rows (no stop rows at all).
    await press(board.querySelector('[data-list-mode="list"]'), "List");
    const list = board.querySelector<HTMLElement>("[data-journey-list]")!;
    expect(list.querySelector("[data-list-empty]")!.textContent).toContain("Nothing on the map this month");
    const rowKinds = [...list.querySelectorAll(".journey-row__kind")].map((k) => k.textContent);
    expect(rowKinds.filter((k) => /Memory|Milestone/.test(k ?? ""))).toEqual([]);
    expect(list.querySelectorAll(".journey-row--stop")).toHaveLength(0);
    expect(await moneyHashes()).toEqual([before]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Review fixes (F1): the due reminders over the board (B1), expected pay through the reviewed recurrence path (M1),
// the brief's closing loop at App level (M3), and the Era planner as a real modal (MINOR 6).

/** Every control Tab can reach under the board: in the page, outside the board's frame and any raised sheet, not hidden, not inert. */
function reachableUnderTheBoard(): string[] {
  const all = [...document.querySelectorAll<HTMLElement>('[data-app-page] :is(a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]))')];
  return all
    .filter((el) => !el.closest("[data-journey-board-host]") && !el.closest('[data-world-sheet="true"]:not([hidden])') && !el.closest("[data-add-slideshow]"))
    .filter((el) => !el.closest("[hidden]") && !el.closest("[inert]") && !(el as HTMLButtonElement).disabled)
    .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent ?? "").trim().slice(0, 40) || el.getAttribute("aria-label") || el.className}`);
}
const dueHost = () => q<HTMLElement>(".due-preview-host");
const dueSheetUp = () => { const host = dueHost(); return Boolean(host && !host.hidden && host.querySelector("#due-reminders")); };
const buttonNamed = (root: ParentNode, pattern: RegExp) => [...root.querySelectorAll<HTMLButtonElement>("button")].find((b) => pattern.test(b.textContent ?? ""));
const latestBoard = () => deriveJourneyBoard(state.boardHouseholds.at(-1)!, BIANCA, FIXTURE_TODAY);

describe("review fixes in the App", () => {
  beforeEach(() => {
    // RowReveal's gesture seam (jsdom has no pointer capture).
    Object.assign(HTMLElement.prototype, { setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture() { return false; } });
  });

  it("B1: the due reminders are their own section of Hercules's list, open above the map, and nothing under the frame is reachable by Tab", async () => {
    const { household } = journeyDemoHousehold();
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    // The App raised its due reminders on arrival; on the map they are Hercules's list's own section (ruling 1), with
    // their own count — not a link painted under the map, and never folded into "To check".
    await press(board.querySelector("[data-journey-bubble]"), "Hercules's bubble");
    const section = await waitFor(() => panel()?.querySelector<HTMLElement>('[data-checklist-section="reminders"]'), "the reminders section");
    expect(section.textContent).toMatch(/Repeating reminders/);
    expect(Number(/· (\d+)$/.exec(section.getAttribute("aria-label") ?? "")?.[1])).toBeGreaterThan(0);
    const entry = section.querySelector<HTMLButtonElement>('[data-action-id="due-review"]')!;
    expect(entry).toBeTruthy();
    expect(q(".due-arrival"), "no due link painted under the board").toBeNull();
    expect(dueHost()?.hidden, "the review waits, hidden, until its entry is taken").toBe(true);
    await settle(3);
    expect(reachableUnderTheBoard()).toEqual([]);
    // The page content the frame paints over (here the plan's purpose banner) is inert, not merely covered.
    const banner = q(".ledger-purpose-banner");
    expect(banner, "the plan's purpose banner stands under the board").toBeTruthy();
    expect(banner!.closest("[inert]"), "covered page content is inert").toBeTruthy();

    // Taking the entry raises the App's own due review above the board (the world-sheet pattern, z 20) with focus in it.
    await press(entry, "Repeating reminders · Review…");
    await waitFor(() => dueSheetUp(), "the due review over the board");
    const host = dueHost()!;
    expect(host.getAttribute("data-world-sheet")).toBe("true");
    expect(host.style.position).toBe("fixed");
    expect(Number(host.style.zIndex)).toBeGreaterThanOrEqual(20);
    expect(host.closest("[data-journey-board-host]"), "the sheet is not inside the board's frame").toBeNull();
    await waitFor(() => host.contains(document.activeElement), "focus inside the due review");
    expect(reachableUnderTheBoard()).toEqual([]);

    // Escape puts the sheet down: the reminders stay in Hercules's list and focus returns to the entry.
    await act(async () => { (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await waitFor(() => dueHost()?.hidden, "the due review put down");
    await waitFor(() => document.activeElement === board.querySelector('[data-checklist-section="reminders"] [data-action-id="due-review"]'), "focus back on the entry");
    expect(reachableUnderTheBoard()).toEqual([]);
  });

  it("M1: Review and record… on expected pay opens the due review on that occurrence; its Confirm turns the SAME stop confirmed, with no income:tx twin", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    const stopId = `income:${ids.biancaPayRecurrenceId}@${FIXTURE_TODAY}`;
    const twinsBefore = new Set(latestBoard().stops.filter((s) => s.id.startsWith("income:tx:")).map((s) => s.id));
    await selectFromDay(FIXTURE_TODAY, stopId);
    expect(stopScope(stopId)!.textContent).toContain("Expected");
    const review = stopScope(stopId)!.querySelector<HTMLButtonElement>(`[data-action-id="${esc(`${stopId}#review`)}"]`);
    expect(review?.textContent).toBe("Review and record…");
    await press(review, "Review and record…");
    await waitFor(() => dueSheetUp(), "the due review");
    // Focus lands on THAT occurrence's row; nothing is recorded by opening it.
    const handle = await waitFor(() => { const el = document.activeElement; return el instanceof HTMLButtonElement && el.classList.contains("row-reveal-handle") && dueHost()!.contains(el) ? el : null; }, "focus on the pay row");
    expect(handle.getAttribute("aria-label")).toMatch(/Bianca pay/);
    expect(await moneyHashes(), "opening the review recorded nothing").toEqual([before]);
    await press(handle, "the pay row's Actions");
    const confirm = await waitFor(() => buttonNamed(dueHost()!, /^Confirm income · .*Bianca pay/), "the named Confirm");
    await press(confirm, confirm.textContent ?? "Confirm income");
    await waitFor(() => { const stop = latestBoard().stops.find((s) => s.id === stopId); return stop?.kind === "income" && stop.status === "confirmed"; }, "the same stop confirmed", 30_000);
    const after = latestBoard();
    expect(after.stops.filter((s) => s.id === stopId)).toHaveLength(1);
    expect(after.stops.filter((s) => s.id.startsWith("income:tx:") && !twinsBefore.has(s.id)), "no income:tx twin").toEqual([]);
    // The map shows it: the same stop's card now reads received.
    await waitFor(() => stopScope(stopId)?.textContent?.includes("Received · recorded"), "the card reads confirmed");
    expect(panel()!.textContent).toContain(after.stops.find((s) => s.id === stopId)!.label);
  });

  it("M3: Bill paid through its named Confirm turns the SAME bill id Paid and keeps the selection", async () => {
    const { household, ids } = journeyDemoHousehold();
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    await selectFromDay("2026-09-18", stopId);
    await press(stopScope(stopId)!.querySelector(markPaidId(stopId)), "Mark paid…");
    const final = await waitFor(() => q<HTMLButtonElement>("[data-bill-confirm] [data-add-confirm-bill]"), "the Final Confirm");
    await press(final, final.textContent ?? "the named Confirm");
    await waitFor(() => { const stop = latestBoard().stops.find((s) => s.id === stopId); return stop?.kind === "commitment" && stop.status === "paid"; }, "the same bill paid", 30_000);
    await waitFor(() => stopScope(stopId)?.textContent?.includes("Paid · recorded Fri 18 Sep"), "the card reads Paid");
    expect(q("[data-journey-board]")).toBe(board);
    expect(stopScope(stopId)!.textContent).toContain("Tenant insurance");
    expect(q(`#${journeyMarkDomId("2026-09-18")}`)!.getAttribute("aria-expanded"), "the day stays selected").toBe("true");
    // Paid now: its actions read the Books, and "Mark paid…" is gone; the date is no longer "to check".
    expect(stopScope(stopId)!.querySelector(markPaidId(stopId))).toBeNull();
    expect(latestBoard().toCheck).not.toContain(stopId);
  });

  it("M3: a tool opened from a stop, then Put it back, returns to the same selection and the same control", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    await selectFromDay("2026-09-18", stopId);
    const calendarId = journeyPanelActionDomId(`${stopId}#calendar`);
    await press(document.getElementById(calendarId), "Open the Calendar");
    await waitFor(() => !q("[data-journey-board]") && q(".house-tool-heading button"), "the Calendar, with Put it back");
    await press(buttonNamed(q(".house-tool-heading")!, /^Put it back$/), "Put it back");
    await waitFor(() => q<HTMLElement>("[data-journey-board]"), "the board again");
    await waitFor(() => stopScope(stopId)?.textContent?.includes("Tenant insurance"), "the same stop selected");
    await waitFor(() => document.activeElement?.id === calendarId, "focus on the same control");
    expect(location.pathname).toBe("/house/kitchen-table/above");
    expect(await moneyHashes()).toEqual([before]);
  });

  it("MINOR 6: the Era planner is a modal over the board: focus moves in, the board is inert, Escape closes and focus returns", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    const era = `crossroads:era:${ids.eraRowId}`;
    await press(dayMark(FIXTURE_TODAY), "today's slot");
    await press(openFromDay(era), "the era crossroads");
    const opener = panel()!.querySelector<HTMLButtonElement>(`[data-action-id="${esc(`${era}#confirm`)}"]`);
    await press(opener, "Continue in the Era planner…");
    const sheet = await waitFor(() => q<HTMLElement>(".journey-era-sheet"), "the Era planner sheet");
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    await waitFor(() => sheet.contains(document.activeElement), "focus inside the planner");
    expect(board.closest("[inert]"), "the board behind it is inert").toBeTruthy();
    await act(async () => { (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await waitFor(() => !q(".journey-era-sheet"), "the planner closed");
    expect(board.closest("[inert]")).toBeNull();
    await waitFor(() => document.activeElement === opener, "focus back on the opener");
    expect(await moneyHashes()).toEqual([before]);
  });
  it("M2: the arrival board stands on the slim baked land in one request; without it, the index path still stands the board", async () => {
    // Production path: one request for the slim artefact, never the 5.7 MB index or the terrain.
    resetJourneyLandCacheForTests();
    const { household } = journeyDemoHousehold();
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock on the slim land");
    await waitFor(() => journeyLandTimings(), "the land loaded");
    expect(journeyLandTimings()!.path).toBe("slim");
    expect(state.fetched).toContain(JOURNEY_LAND_SLIM_URL);
    expect(state.fetched).not.toContain(HORIZON_INDEX_URL);
    act(() => root.unmount());
    root = createRoot(container);

    // Fallback: the slim artefact is missing (an older deploy) → index + terrain, same board.
    resetJourneyLandCacheForTests();
    state.slim = false; state.fetched = [];
    localStorage.clear();
    const again = await openApp(household, BIANCA);
    await waitFor(() => again.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock on the index land");
    await waitFor(() => journeyLandTimings()?.path === "index", "the index fallback");
    expect(state.fetched).toContain(HORIZON_INDEX_URL);
  });
});

describe("Simple view while the Journey map is up (PR #567 Codex P1)", () => {
  it("choosing Simple view from the map's dial opens the Court (where the Desk opens) in place of the board, and nothing is posted", async () => {
    const { household } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat clock");
    expect(location.pathname).toBe("/house/kitchen-table/above");
    // The map's own "+" dial: Simple view writes through the one shared `chooseMotionEdition` (as the backtick does).
    await press(board.querySelector("[data-journey-plus]"), "+");
    await press(board.querySelector('[data-dial-chip="simple"]'), "Simple view");
    await waitFor(() => location.pathname === "/house/home/middle" && !q("[data-journey-board]"), "the Court in place of the board");
    expect(new URLSearchParams(location.search).get("surface")).toBeNull();
    expect(localStorage.getItem(MOTION_KEY)).toBe("flat");
    expect(await moneyHashes()).toEqual([before]);
  });

  it("a reload on a saved Journey URL with the reading edition chosen lands on the Court, not the flat board", async () => {
    const { household } = journeyDemoHousehold();
    const identity = houseIdentity({ environment: "development", householdId: household.householdId, memberId: BIANCA, scope: "household" });
    // Not the tab's first arrival (a reload): the saved URL is what the App reads back.
    sessionStorage.setItem(arrivalKey(identity), "1");
    localStorage.setItem(MOTION_KEY, "flat");
    history.replaceState(null, "", housePath(JOURNEY_HOME_ROUTE(household.householdId)));
    state.stored = household;
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({ memberId: BIANCA, view: "household", householdId: household.householdId }));
    await act(async () => { root.render(createElement(App)); });
    await waitFor(() => location.pathname === "/house/home/middle", "the Court", 60_000);
    await settle(5);
    expect(q("[data-journey-board]")).toBeNull();
    expect(state.boardHouseholds).toHaveLength(0);
  });

  it("the same reload in the illustrated edition keeps the Journey Board", async () => {
    const { household } = journeyDemoHousehold();
    const identity = houseIdentity({ environment: "development", householdId: household.householdId, memberId: BIANCA, scope: "household" });
    sessionStorage.setItem(arrivalKey(identity), "1");
    history.replaceState(null, "", housePath(JOURNEY_HOME_ROUTE(household.householdId)));
    const board = await openApp(household, BIANCA);
    expect(board).toBeTruthy();
    expect(location.pathname).toBe("/house/kitchen-table/above");
  });
});
