// @vitest-environment jsdom
/**
 * The Journey Board in the real App (T6): house world + harbour on, WebGL unavailable (jsdom), illustrated edition chosen.
 *
 * The App loads the fictional Development demo kitchen with a substantial journey (T1's `journeyDemoHousehold`,
 * built on `seedDemoHousehold` through the real commands) from its local replica, and — as the tab's first arrival —
 * lands on the household Journey Board. Then:
 * - select a bill (its cluster mark, then the bill; and the list row) → "Mark paid…" → the App's Bill paid flow opens
 *   at THAT recurrence's named Confirm (the AddSlideshow's own DOM) → close → the same selection and focus return;
 * - selecting, zooming, previewing a crossroads, Back to now, browsing past and upcoming chapters and opening and
 *   closing panels leave the household's `financialAuditHash` exactly as it was, and browsing never moves the piece;
 * - a brand-new household (`emptyBoardHousehold`) shows the honest empty board with setup actions, no memory or
 *   milestone rows.
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
import { financialAuditHash } from "../src/core/index.ts";
import { HORIZON_INDEX_URL } from "../src/house/world/horizonAssets.ts";
import { journeyLandTimings, resetJourneyLandCacheForTests } from "../src/journey/land/index.ts";
import { JOURNEY_LAND_SLIM_URL } from "../src/journey/land/slim.ts";
import { journeyViewStateKey } from "../src/journey/contracts.ts";
import { deriveJourneyBoard } from "../src/journey/model/index.ts";
import { journeyMarkDomId } from "../src/journey/ui/Marks.tsx";
import { journeyRowDomId } from "../src/journey/ui/JourneyList.tsx";
import { journeyPanelActionDomId } from "../src/journey/ui/StopPanel.tsx";
import { BIANCA, FIXTURE_TODAY, emptyBoardHousehold, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";

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

async function openApp(household: Household, memberId: string) {
  state.stored = household;
  localStorage.setItem("hearth:session:v1:development", JSON.stringify({ memberId, view: "household", householdId: household.householdId }));
  await act(async () => { root.render(createElement(App)); });
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
const panelTitle = () => panel()?.querySelector(".journey-panel__title")?.textContent ?? null;
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

describe("the household Journey Board in the App", () => {
  it("is the tab's arrival; a bill mark's Mark paid… opens the App's Bill paid at THAT recurrence; closing returns the same selection and focus", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board (no WebGL in jsdom)");

    // Arrival: the tab's first household landing is the Journey (kitchen-table/above), today's chapter, the piece on today.
    expect(location.pathname).toBe("/house/kitchen-table/above");
    expect(state.boardToday.at(-1)).toBe(FIXTURE_TODAY);
    expect(board.querySelector('.journey-strip__chapter[aria-current="date"]')!.getAttribute("data-chapter-id")).toBe("2026-09");
    expect(q(`#${journeyMarkDomId("piece")}`)!.getAttribute("aria-label")).toContain("We are here");
    expect(board.querySelector(".journey-summary__period")!.textContent).toBe("September 2026");

    // The bill: Tenant insurance, due Fri 18 Sep, not recorded — one of three stops on that day (a cluster).
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    const derived = deriveJourneyBoard(household, BIANCA, FIXTURE_TODAY).stops.find((s) => s.id === stopId);
    expect(derived && derived.kind === "commitment" && derived.status).toBe("overdue");
    expect(board.querySelector(`svg [data-id="${esc(stopId)}"]`), "the bill stands on the flat board").toBeTruthy();
    await press(q(`#${journeyMarkDomId("cluster:2026-09-18")}`), "the 18 Sep cluster mark");
    await press(panel()?.querySelector(`[data-open-stop="${esc(stopId)}"]`), "Tenant insurance in the cluster");
    expect(panelTitle()).toBe("Tenant insurance");
    expect(panel()!.textContent).toContain("Overdue · not recorded");
    expect(panel()!.textContent).toContain("$118.00");
    expect(addSheetOpen()).toBe(false);

    // Mark paid… → the App's own Bill paid flow, at this bill's named Confirm. Nothing is recorded by opening it.
    const markPaid = panel()!.querySelector<HTMLButtonElement>(markPaidId(stopId));
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

    // Close without confirming: the board is where it was — the same stop selected, focus back on its Mark paid….
    await closeAddSheet();
    expect(q("[data-journey-board]")).toBe(board);
    expect(panelTitle()).toBe("Tenant insurance");
    expect(board.querySelector(".journey-board-flat__selection"), "the selection ring still stands").toBeTruthy();
    expect(document.activeElement, "focus returns to the control that opened Bill paid").toBe(panel()!.querySelector(markPaidId(stopId)));
    // The selection is the device's view state too (a remount restores it).
    await settle(20);
    const saved = JSON.parse(localStorage.getItem(journeyViewStateKey({ environment: "development", householdId: household.householdId, memberId: BIANCA }))!) as { selectedStopId: string };
    expect(saved.selectedStopId).toBe(stopId);

    expect(await moneyHashes()).toEqual([before]);
  });

  it("the list row's Mark paid… opens the same Bill paid for the same recurrence, and closing returns focus to the row", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    await press(board.querySelector('[data-list-mode="list"]'), "List");
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    const row = await waitFor(() => q(`#${journeyRowDomId(stopId)}`), "the Tenant insurance row");
    expect(row.querySelector(".journey-row__status")?.textContent).toBe("Overdue · not recorded");
    expect(row.querySelector(".journey-row__amount")?.textContent).toBe("$118.00 · scheduled");
    await press(row.querySelector(markPaidId(stopId)), "the row's Mark paid…");
    await waitFor(() => addSheetOpen() && q("[data-bill-confirm]"), "the Bill paid confirm from the list");
    expect(addSheet()!.getAttribute("data-add-slide")).toBe("bill-confirm");
    expect(q("[data-bill-confirm]")!.getAttribute("data-bill-confirm")).toBe(ids.insuranceRecurrenceId);
    await closeAddSheet();
    expect(board.querySelector('[data-list-mode="list"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(q(`#${journeyRowDomId(stopId)} ${markPaidId(stopId)}`));
    expect(await moneyHashes()).toEqual([before]);
  });

  // D-T6-1 (fixed in the fix pass): after Close pauses the Add sheet, "Mark paid…" again for the SAME recurrence
  // must land on that bill's named Confirm again, not on "Which bill was paid?" — the paused `AddSlideshow` forgets
  // its preselection while closed.
  it("pressing Mark paid… again for the same bill after closing opens that bill's Confirm again", async () => {
    const { household, ids } = journeyDemoHousehold();
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    await press(q(`#${journeyMarkDomId("cluster:2026-09-18")}`), "the 18 Sep cluster mark");
    await press(panel()?.querySelector(`[data-open-stop="${esc(stopId)}"]`), "Tenant insurance");
    await press(panel()!.querySelector(markPaidId(stopId)), "Mark paid…");
    await waitFor(() => addSheetOpen() && q("[data-bill-confirm]"), "the first Bill paid confirm");
    await closeAddSheet();
    await press(panel()!.querySelector(markPaidId(stopId)), "Mark paid… again");
    await settle(5);
    expect(addSheetOpen()).toBe(true);
    expect(addSheet()!.getAttribute("data-add-slide")).toBe("bill-confirm");
    expect(q("[data-bill-confirm]")?.getAttribute("data-bill-confirm")).toBe(ids.insuranceRecurrenceId);
  });

  it("select, zoom, preview a crossroads, Back to now, browse chapters and open/close panels: the books never change, and browsing never moves the piece", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    const path = location.pathname;
    const pieceFlat = () => { const el = board.querySelector('svg [data-id="piece"]')!; return { x: el.getAttribute("data-x"), y: el.getAttribute("data-y"), chapter: board.querySelector('.journey-strip__chapter[aria-current="date"]')?.getAttribute("data-chapter-id") }; };
    const pieceLabel = () => q(`#${journeyMarkDomId("piece")}`)!.getAttribute("aria-label");
    const anchor = pieceFlat(), label = pieceLabel();
    expect(anchor.x && anchor.y).toBeTruthy();
    const focused = () => board.querySelector(".journey-strip__chapter.is-focused")?.getAttribute("data-chapter-id");
    expect(focused()).toBe("2026-09");

    // Select: a stop (mark), a cluster and one of its stops, a month, the piece; Escape and Close put each away.
    const waterPaid = `bill:${ids.waterRecurrenceId}@2026-09-18`;
    await press(q(`#${journeyMarkDomId("cluster:2026-09-18")}`), "cluster mark");
    await press(panel()?.querySelector(`[data-open-stop="${esc(waterPaid)}"]`), "Water (paid) in the cluster");
    expect(panel()!.textContent).toContain("Paid");
    await act(async () => { panel()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await settle(1);
    expect(panel()).toBeNull();
    await press(q(`#${journeyMarkDomId("2026-08")}`), "the August month space");
    expect(panelTitle()).toContain("August 2026");
    await press(panel()!.querySelector(".journey-panel__close"), "Close");
    await press(q(`#${journeyMarkDomId("piece")}`), "the piece");
    expect(panel()!.textContent).toContain("We are here");
    await press(panel()!.querySelector(".journey-panel__close"), "Close");
    // The summary's attention / next items select (they never run their call).
    const next = board.querySelector<HTMLElement>(".journey-summary [data-select]");
    await press(next, "a summary item");
    expect(panel()).toBeTruthy();
    await press(panel()!.querySelector(".journey-panel__close"), "Close");

    // Zoom (flat twin: Sky ↔ Region ↔ Stop) and the stage's keys.
    await press(board.querySelector('[data-zoom="in"]'), "Zoom in");
    expect(board.getAttribute("data-tier")).toBe("stop");
    await press(board.querySelector('[data-zoom="out"]'), "Zoom out");
    await press(board.querySelector('[data-zoom="out"]'), "Zoom out");
    expect(board.getAttribute("data-tier")).toBe("sky");
    const stage = board.querySelector<HTMLElement>(".journey-stage")!;
    for (const key of ["ArrowRight", "PageDown", "PageUp", "ArrowLeft", "+", "-"]) {
      await act(async () => { stage.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });
    }
    await settle(1);

    // A crossroads: preview the other alternative (provisional; nothing changes), then return without changing.
    const era = `crossroads:era:${ids.eraRowId}`;
    await press(q(`#${journeyMarkDomId(era)}`), "the era crossroads");
    const other = panel()!.querySelector<HTMLElement>(".journey-alternative--other .journey-alternative__pick");
    await press(other, "preview the suggestion");
    expect(panel()!.textContent).toContain("Preview — nothing has changed");
    expect(board.querySelector(".journey-board-flat__preview"), "the flat twin draws the preview provisionally").toBeTruthy();
    await press([...panel()!.querySelectorAll("button")].find((b) => b.textContent === "Return without changing"), "Return without changing");
    expect(panel()!.textContent).not.toContain("Preview — nothing has changed");
    await press(panel()!.querySelector(".journey-panel__close"), "Close");

    // Browse a past and an upcoming chapter: the view moves, the household piece does not.
    await press(board.querySelector('.journey-strip__chapter[data-chapter-id="2026-02"]'), "February (past)");
    expect(focused()).toBe("2026-02");
    expect(pieceFlat()).toEqual(anchor);
    expect(pieceLabel()).toBe(label);
    await press(board.querySelector('.journey-strip__chapter[data-chapter-id="2026-11"]'), "November (upcoming)");
    expect(focused()).toBe("2026-11");
    expect(pieceFlat()).toEqual(anchor);
    expect(pieceLabel()).toBe(label);
    await press(q(`#${journeyMarkDomId("piece")}`), "the piece while browsing");
    expect(panel()!.textContent).toContain("We are here");
    expect(panel()!.textContent).toContain("28");
    await press(panel()!.querySelector(".journey-panel__close"), "Close");
    // Back to now.
    await press(board.querySelector("[data-back-to-now]"), "Back to now");
    expect(focused()).toBe("2026-09");
    expect(board.getAttribute("data-tier")).toBe("region");
    expect(pieceFlat()).toEqual(anchor);

    // Map ↔ List and back.
    await press(board.querySelector('[data-list-mode="list"]'), "List");
    expect(board.querySelector(".journey-list")).toBeTruthy();
    await press(board.querySelector('[data-list-mode="map"]'), "Map");
    await settle(20);

    // Nothing above opened a surface, moved the household or wrote the books.
    expect(location.pathname).toBe(path);
    expect(addSheetOpen()).toBe(false);
    expect(q(".journey-era-sheet")).toBeNull();
    expect(q("[data-journey-board]")).toBe(board);
    expect(await moneyHashes()).toEqual([before]);
  });

  it("a brand-new household sees the honest empty board: setup actions, no invented memories or milestones", async () => {
    const household = emptyBoardHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    expect(board.classList.contains("journey-board--empty")).toBe(true);
    const summary = board.querySelector<HTMLElement>("[data-journey-summary]")!;
    expect(summary.textContent).toContain("Nothing is on the journey yet");
    expect(summary.textContent).toContain("Nothing is invented for you.");
    expect([...summary.querySelectorAll<HTMLElement>("[data-action-id]")].map((b) => b.textContent)).toEqual(["Set up our accounts in the Books", "Make our first plan", "Open the Calendar"]);
    // The map: the piece and the months only — no stop, cluster, crossroads, memory or milestone marks.
    const kinds = new Set([...board.querySelectorAll<HTMLElement>(".journey-mark")].map((b) => b.dataset.markKind));
    expect([...kinds].sort()).toEqual(["month", "piece"]);
    expect(board.querySelector(".journey-mark--memory, .journey-mark--milestone")).toBeNull();
    // The list: the honest empty words; no memory or milestone rows (no stop rows at all).
    await press(board.querySelector('[data-list-mode="list"]'), "List");
    const list = board.querySelector<HTMLElement>(".journey-list")!;
    expect(list.querySelector(".journey-empty")!.textContent).toContain("Nothing is on the journey yet");
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

  it("B1: the due reminders lead Needs attention, open above the board, and nothing under the frame is reachable by Tab", async () => {
    const { household } = journeyDemoHousehold();
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    // The App raised its due reminders on arrival; on the board they are the FIRST attention item, not a link under it.
    const entry = await waitFor(() => board.querySelector<HTMLButtonElement>('[data-attention-call="attention:due-review"]'), "the due reminders in Needs attention");
    const first = board.querySelector(".journey-summary__attention li");
    expect(first?.contains(entry), "the due entry is the first attention item").toBe(true);
    expect(first!.textContent).toMatch(/^Repeating reminders · \d+ to review/);
    expect(Number(/· (\d+) to review/.exec(first!.textContent!)![1])).toBeGreaterThan(0);
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

    // Escape puts the sheet down: the reminders stay in Needs attention and focus returns to the entry.
    await act(async () => { (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await waitFor(() => dueHost()?.hidden, "the due review put down");
    await waitFor(() => document.activeElement === board.querySelector('[data-attention-call="attention:due-review"]'), "focus back on the entry");
    expect(reachableUnderTheBoard()).toEqual([]);
  });

  it("M1: Review and record… on expected pay opens the due review on that occurrence; its Confirm turns the SAME stop confirmed, with no income:tx twin", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    const stopId = `income:${ids.biancaPayRecurrenceId}@${FIXTURE_TODAY}`;
    const twinsBefore = new Set(latestBoard().stops.filter((s) => s.id.startsWith("income:tx:")).map((s) => s.id));
    await press(q(`#${journeyMarkDomId(`cluster:${FIXTURE_TODAY}`)}`), "today's cluster mark");
    await press(panel()?.querySelector(`[data-open-stop="${esc(stopId)}"]`), "Bianca pay in the cluster");
    expect(panel()!.textContent).toContain("Expected");
    const review = panel()!.querySelector<HTMLButtonElement>(`[data-action-id="${esc(`${stopId}#review`)}"]`);
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
    // The board shows it: the panel on the same stop now reads received.
    await waitFor(() => panel()?.textContent?.includes("Received · recorded"), "the panel reads confirmed");
    expect(panelTitle()).toBe(after.stops.find((s) => s.id === stopId)!.label);
  });

  it("M3: Bill paid through its named Confirm turns the SAME bill id Paid and keeps the selection", async () => {
    const { household, ids } = journeyDemoHousehold();
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    await press(q(`#${journeyMarkDomId("cluster:2026-09-18")}`), "the 18 Sep cluster mark");
    await press(panel()?.querySelector(`[data-open-stop="${esc(stopId)}"]`), "Tenant insurance");
    await press(panel()!.querySelector(markPaidId(stopId)), "Mark paid…");
    const final = await waitFor(() => q<HTMLButtonElement>("[data-bill-confirm] [data-add-confirm-bill]"), "the Final Confirm");
    await press(final, final.textContent ?? "the named Confirm");
    await waitFor(() => { const stop = latestBoard().stops.find((s) => s.id === stopId); return stop?.kind === "commitment" && stop.status === "paid"; }, "the same bill paid", 30_000);
    await waitFor(() => panel()?.textContent?.includes("Paid · recorded Fri 18 Sep"), "the panel reads Paid");
    expect(q("[data-journey-board]")).toBe(board);
    expect(panelTitle()).toBe("Tenant insurance");
    expect(board.querySelector(".journey-board-flat__selection"), "the selection ring still stands").toBeTruthy();
    // Paid now: its actions read the Books, and "Mark paid…" is gone.
    expect(panel()!.querySelector(markPaidId(stopId))).toBeNull();
  });

  it("M3: a tool opened from a stop, then Put it back, returns to the same selection and the same control", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    const stopId = `bill:${ids.insuranceRecurrenceId}@2026-09-18`;
    await press(q(`#${journeyMarkDomId("cluster:2026-09-18")}`), "the 18 Sep cluster mark");
    await press(panel()?.querySelector(`[data-open-stop="${esc(stopId)}"]`), "Tenant insurance");
    const calendarId = journeyPanelActionDomId(`${stopId}#calendar`);
    await press(document.getElementById(calendarId), "Open the Calendar");
    await waitFor(() => !q("[data-journey-board]") && q(".house-tool-heading button"), "the Calendar, with Put it back");
    await press(buttonNamed(q(".house-tool-heading")!, /^Put it back$/), "Put it back");
    await waitFor(() => q<HTMLElement>("[data-journey-board]"), "the board again");
    await waitFor(() => panelTitle() === "Tenant insurance", "the same stop selected");
    await waitFor(() => document.activeElement?.id === calendarId, "focus on the same control");
    expect(location.pathname).toBe("/house/kitchen-table/above");
    expect(await moneyHashes()).toEqual([before]);
  });

  it("MINOR 6: the Era planner is a modal over the board: focus moves in, the board is inert, Escape closes and focus returns", async () => {
    const { household, ids } = journeyDemoHousehold();
    const before = await financialAuditHash(household);
    const board = await openApp(household, BIANCA);
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board");
    const era = `crossroads:era:${ids.eraRowId}`;
    await press(q(`#${journeyMarkDomId(era)}`), "the era crossroads");
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
    await waitFor(() => board.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board on the slim land");
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
    await waitFor(() => again.querySelector('.journey-stage[data-stage-mode="flat"]'), "the flat board on the index land");
    await waitFor(() => journeyLandTimings()?.path === "index", "the index fallback");
    expect(state.fetched).toContain(HORIZON_INDEX_URL);
  });
});
