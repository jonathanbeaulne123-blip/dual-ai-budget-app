// @vitest-environment jsdom
/**
 * The Journey Board UI (T4), in jsdom on the flat twin with the hand-written sample board (REAL land from public/,
 * fetch mocked), plus one live-wiring test (demo household → derive → load → build → layout → scene through the
 * renderer lease's `rendererFactory` seam).
 *
 * Proves: the summary answers where / attention / next / do; every stop and crossroads has a map mark (or its
 * cluster's) AND a list row; selecting, hovering, zooming, moving the day, Back to now and previewing call NO action;
 * each panel action calls exactly its callback once with the call's args, and the list's same action calls the same;
 * Escape returns focus to the mark; reduced motion drops the animated class; three themes; the empty board is
 * honest; view state round-trips and a throwing storage falls back to defaults; Enter Horizon is never offered flat.
 */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as THREE from "three";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_JOURNEY_VIEW_STATE, JOURNEY_THEMES, journeyViewStateKey, runJourneyAction,
  type ActionCall, type JourneyBoard, type JourneyBoardActions, type JourneyLandData, type JourneyViewState, type RouteSpace, type ThemeId,
} from "../src/journey/contracts.ts";
import { HORIZON_INDEX_URL } from "../src/house/world/horizonAssets.ts";
import { loadJourneyLand, resetJourneyLandCacheForTests } from "../src/journey/land/index.ts";
import { layoutRoute } from "../src/journey/board/index.ts";
import { boardToList } from "../src/journey/model/index.ts";
import { JourneyBoardView, type JourneyBoardViewProps } from "../src/journey/ui/JourneyBoardView.tsx";
import JourneyBoardEntry from "../src/journey/ui/JourneyBoard.tsx";
import { journeyMarkDomId, markEntries, Marks } from "../src/journey/ui/Marks.tsx";
import { compassClearance, safeAreaFor } from "../src/journey/ui/JourneyBoardView.tsx";
import type { BoardSceneHandle } from "../src/journey/board/index.ts";
import { journeyRowDomId } from "../src/journey/ui/JourneyList.tsx";
import { parseJourneyViewState, readJourneyViewState, useJourneyViewStateStore, writeJourneyViewState, VIEW_STATE_WRITE_DELAY_MS } from "../src/journey/ui/viewState.ts";
import { COPY } from "../src/journey/ui/copy.ts";
import { SAMPLE_IDS, SAMPLE_TODAY, sampleEmptyJourneyBoard, sampleJourneyBoard } from "./fixtures/journey-board-sample.ts";
import { BIANCA, FIXTURE_TODAY, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const INDEX_GZ = toArrayBuffer(readFileSync("public/horizon/world/horizon-geo-1.index.json.gz"));
const TERRAIN = toArrayBuffer(readFileSync("public/horizon/terrain/horizon-geo-1.bin"));
function stubLandFetch() {
  const fetch = vi.fn(async (url: string) => {
    if (url === HORIZON_INDEX_URL) return new Response(INDEX_GZ.slice(0), { headers: { "content-type": "application/gzip" } });
    if (url.endsWith("/horizon-geo-1.bin")) return new Response(TERRAIN.slice(0), { headers: { "content-type": "application/octet-stream" } });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

let land: JourneyLandData;
let sample: JourneyBoard;
let route: RouteSpace;
beforeAll(async () => {
  resetJourneyLandCacheForTests();
  stubLandFetch();
  try { land = await loadJourneyLand(); } finally { vi.unstubAllGlobals(); }
  sample = sampleJourneyBoard();
  route = layoutRoute(sample, land);
}, 60_000);

// ---------------------------------------------------------------------------------------------------------------
// Harness

type Spies = { [K in keyof JourneyBoardActions]: ReturnType<typeof vi.fn> };
function spyActions(): JourneyBoardActions & { spies: Spies } {
  const names: (keyof JourneyBoardActions)[] = ["openRecord", "openBillPaid", "openDueReview", "openPlace", "openCampfire", "openWeeklySitdown", "openHomeBook", "openEraPlanner", "openKitty", "openCalendar", "openBooks", "enterHorizon", "back"];
  const spies = Object.fromEntries(names.map((n) => [n, vi.fn()])) as Spies;
  return { ...(spies as unknown as JourneyBoardActions), spies };
}
const totalCalls = (a: { spies: Spies }) => Object.values(a.spies).reduce((n, s) => n + s.mock.calls.length, 0);
const recorded = (a: { spies: Spies }) => Object.entries(a.spies).flatMap(([name, s]) => s.mock.calls.map((args) => [name, args] as const));
/** What `runJourneyAction` does with a call, as [callback, args]. */
function expected(call: ActionCall) {
  const probe = spyActions();
  runJourneyAction(probe, call);
  return recorded(probe);
}

const mounted: { root: Root; host: HTMLElement }[] = [];
async function mount(el: ReturnType<typeof createElement>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  mounted.push({ root, host });
  return { host, root, rerender: async (next: ReturnType<typeof createElement>) => { await act(async () => { root.render(next); }); } };
}
afterEach(async () => {
  for (const m of mounted.splice(0)) { await act(async () => { m.root.unmount(); }); m.host.remove(); }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function viewProps(over: Partial<JourneyBoardViewProps> = {}): JourneyBoardViewProps & { actions: ReturnType<typeof spyActions> } {
  const actions = spyActions();
  return {
    board: sample, actions, theme: "classic", reducedMotion: false,
    stage: { mode: "flat", status: "loading", land, landHandle: null, route, quality: "lite" },
    nameOf: (id) => (id === "MEM-002" ? "Jonathan" : "Bianca"),
    ...over,
  } as JourneyBoardViewProps & { actions: ReturnType<typeof spyActions> };
}
async function mountView(over: Partial<JourneyBoardViewProps> = {}) {
  const props = viewProps(over);
  const m = await mount(createElement(JourneyBoardView, props));
  return { ...m, props, actions: props.actions as ReturnType<typeof spyActions> };
}

const click = async (el: Element | null | undefined) => {
  expect(el, "element to click").toBeTruthy();
  await act(async () => { (el as HTMLElement).click(); });
};
const key = async (el: Element, k: string) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
};
/** For quoted attribute selectors (jsdom has no CSS.escape). */
const esc = (v: string) => v.replace(/["\\]/g, "\\$&");
const mark = (host: HTMLElement, id: string) => host.querySelector<HTMLButtonElement>(`#${journeyMarkDomId(id)}`);
const panel = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-journey-panel]");
const live = (host: HTMLElement) => host.querySelector("[data-journey-live]")!.textContent ?? "";
const clusterOf = (board: JourneyBoard, id: string) => board.clusters.find((c) => c.stopIds.includes(id))?.id ?? null;

/** Open a stop's panel the way a person would: its mark, or its cluster's mark then the stop inside. */
async function openStop(host: HTMLElement, board: JourneyBoard, id: string) {
  const cluster = clusterOf(board, id);
  if (cluster) {
    await click(mark(host, cluster));
    await click(panel(host)!.querySelector(`[data-open-stop="${esc(id)}"]`));
  } else {
    await click(mark(host, id));
  }
  expect(panel(host), `panel for ${id}`).toBeTruthy();
}

// ---------------------------------------------------------------------------------------------------------------

describe("the calm header", () => {
  it("shows the period, the Everyday figure, the attention count, what is next and the quick actions", async () => {
    const { host, actions } = await mountView();
    const summary = host.querySelector("[data-journey-summary]")!;
    expect(summary.textContent).toContain("September 2026");
    expect(summary.querySelector("[data-everyday]")!.textContent).toContain("$1234.56");
    expect(summary.querySelector("[data-attention-count]")!.getAttribute("data-attention-count")).toBe(String(sample.summary.attention.length));
    expect(summary.textContent).toContain("4 need attention");
    for (const id of sample.summary.next) expect(summary.querySelector(`[data-select="${esc(id)}"]`), id).toBeTruthy();
    for (const q of sample.summary.quickActions) expect(summary.querySelector(`[data-action-id="${esc(q.id)}"]`)!.textContent).toBe(q.label);
    // The one-line phone summary expands without running anything.
    await click(summary.querySelector(".journey-summary__toggle"));
    expect(summary.classList.contains("is-expanded")).toBe(true);
    expect(totalCalls(actions)).toBe(0);
  });

  it("an attention item tied to a stop only selects it; one without a stop runs its own call once", async () => {
    const { host, actions } = await mountView();
    await click(host.querySelector(`[data-select="${esc(SAMPLE_IDS.overdue)}"]`));
    expect(panel(host)!.textContent).toContain("Groceries · planned");
    expect(totalCalls(actions)).toBe(0);
    // Three show at once; the rest wait behind "Show all 4" (a view change, not an action).
    expect(host.querySelector('[data-attention-call="need:fund"]')).toBeNull();
    await click(host.querySelector(".journey-summary__more"));
    expect(totalCalls(actions)).toBe(0);
    await click(host.querySelector('[data-attention-call="need:fund"]'));
    expect(recorded(actions)).toEqual(expected({ name: "openBooks", ref: { kind: "fund" } }));
  });

  it("shows the App's freshness note as a quiet line", async () => {
    const { host } = await mountView({ freshnessNote: "Supported as of 25 Sep" });
    expect(host.querySelector(".journey-summary__freshness")!.textContent).toBe("Supported as of 25 Sep");
  });
});

describe("map ↔ list parity", () => {
  it("every stop has a mark (or its cluster's) and every crossroads a mark; the list has a row for each", async () => {
    const { host } = await mountView();
    expect(host.querySelector(".journey-stage")!.getAttribute("data-stage-mode")).toBe("flat");
    expect(host.querySelector("svg.journey-land-flat")).toBeTruthy();
    expect(mark(host, "piece")).toBeTruthy();
    for (const c of sample.chapters) expect(mark(host, c.id), c.id).toBeTruthy();
    for (const s of sample.stops) {
      const id = clusterOf(sample, s.id) ?? s.id;
      expect(mark(host, id), s.id).toBeTruthy();
      expect(mark(host, id)!.tagName).toBe("BUTTON");
    }
    for (const x of sample.crossroads) expect(mark(host, x.id), x.id).toBeTruthy();
    // DOM order of marks = chronological.
    const order = [...host.querySelectorAll<HTMLElement>(".journey-mark")].map((b) => b.dataset.markId!);
    const dateOf = (id: string) => (id === "piece" ? SAMPLE_TODAY : sample.stops.find((s) => s.id === id)?.date ?? sample.clusters.find((c) => c.id === id)?.date ?? sample.crossroads.find((c) => c.id === id)?.date ?? `${id}-${new Date(Date.UTC(Number(id.slice(0, 4)), Number(id.slice(5, 7)), 0)).getUTCDate()}`);
    const dates = order.map(dateOf);
    expect([...dates].sort()).toEqual(dates.map((d) => d));

    await click(host.querySelector('[data-list-mode="list"]'));
    expect(host.querySelector(".journey-stage")).toBeNull();
    for (const s of [...sample.stops, ...sample.undatedMemories]) expect(host.querySelector(`#${journeyRowDomId(s.id)}`), s.id).toBeTruthy();
    for (const x of sample.crossroads) expect(host.querySelector(`#${journeyRowDomId(x.id)}`), x.id).toBeTruthy();
    for (const c of sample.clusters) expect(host.querySelector(`#${journeyRowDomId(c.id)}`), c.id).toBeTruthy();
    // Past / this month / upcoming are told apart in words and classes.
    expect(host.querySelector('[data-chapter-id="2026-08"]')!.className).toContain("--past");
    expect(host.querySelector('.journey-list__chapter[data-chapter-id="2026-09"]')!.className).toContain("--open");
    expect(host.querySelector('.journey-list__chapter[data-chapter-id="2026-10"]')!.className).toContain("--upcoming");
    expect(host.querySelector('.journey-list__chapter[data-chapter-id="2026-10"] .journey-list__state')!.textContent).toMatch(/^Upcoming/);
    expect(host.querySelector(".journey-list__limits")!.textContent).toContain("private to their own device");
  });

  it("each panel action calls exactly its callback once with the call's args, and the list's same action calls the same", async () => {
    const { host, actions } = await mountView();
    const rows = boardToList(sample);
    let checked = 0;
    for (const stop of sample.stops) {
      await openStop(host, sample, stop.id);
      for (const action of stop.actions) {
        actions.spies && Object.values(actions.spies).forEach((s) => s.mockClear());
        await click(panel(host)!.querySelector(`[data-action-id="${esc(action.id)}"]`));
        const fromPanel = recorded(actions);
        expect(fromPanel, `${action.id} (panel)`).toEqual(expected(action.call));
        expect(fromPanel).toHaveLength(1);
        checked += 1;
      }
      await key(panel(host)!, "Escape");
      expect(panel(host)).toBeNull();
    }
    expect(checked).toBeGreaterThan(30);

    await click(host.querySelector('[data-list-mode="list"]'));
    for (const row of rows) {
      for (const action of row.actions) {
        Object.values(actions.spies).forEach((s) => s.mockClear());
        await click(host.querySelector(`#${journeyRowDomId(row.id)} [data-action-id="${esc(action.id)}"]`));
        expect(recorded(actions), `${action.id} (list)`).toEqual(expected(action.call));
      }
      const stop = sample.stops.find((s) => s.id === row.id);
      if (stop) expect(row.actions).toEqual(stop.actions);
    }
  });

  it("panels print the exact amount, the date and explicit status words (the same words as the list)", async () => {
    const { host } = await mountView();
    const cases: [string, string, string | null][] = [
      [SAMPLE_IDS.overdue, "Overdue · not recorded", "$520.00 · scheduled"],
      [SAMPLE_IDS.setAsidePrepare, "Set aside in Prepare · not paid", "$34.00 · scheduled"],
      [SAMPLE_IDS.setAsideBuild, "Set aside in Build · not paid", "$300.00 · scheduled"],
      [SAMPLE_IDS.incomeExpectedPast, "Expected · not recorded", "$300.00 · scheduled"],
      [SAMPLE_IDS.incomeEstimate, "Estimate · not recorded", "$980.00 · estimate"],
      [SAMPLE_IDS.goalFull, "Fully backed · not bought", "$3000.00 of $3000.00 · target"],
      [SAMPLE_IDS.paid, "Paid · recorded", "$65.00 · recorded"],
      [SAMPLE_IDS.needsReview, "Payment status needs review · not counted as paid", "$17.99 · scheduled"],
      [SAMPLE_IDS.milestoneReady, "Ready · recorded the next time you save your home", null],
      [SAMPLE_IDS.taskDone, "Done · a planning step, not a memory", null],
    ];
    for (const [id, status, amount] of cases) {
      await openStop(host, sample, id);
      const text = panel(host)!.textContent!;
      expect(text, id).toContain(status);
      if (amount) expect(text, id).toContain(amount);
      const stop = sample.stops.find((s) => s.id === id)!;
      expect(text).toContain(new Date(`${stop.date}T12:00:00Z`).toLocaleDateString("en-CA", { day: "numeric", timeZone: "UTC" }));
      await key(panel(host)!, "Escape");
    }
    // No judgement words anywhere on the board or in the list.
    await click(host.querySelector('[data-list-mode="list"]'));
    expect(host.textContent).not.toMatch(/\b(late|failed|failure|behind|missed|winning|losing|bad month)\b/i);
  });
});

describe("the board is inert until an action is pressed", () => {
  it("selecting, hovering, zooming, moving the day, chapters, Back to now and previewing call nothing", async () => {
    const { host, actions } = await mountView();
    const stage = host.querySelector<HTMLElement>(".journey-stage")!;
    for (const b of host.querySelectorAll<HTMLButtonElement>(".journey-mark")) {
      await act(async () => { b.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
      await click(b);
    }
    for (const id of sample.clusters.map((c) => c.id)) {
      await click(mark(host, id));
      for (const b of panel(host)!.querySelectorAll("[data-open-stop]")) await click(b);
    }
    await click(host.querySelector('[data-zoom="in"]'));
    await click(host.querySelector('[data-zoom="in"]'));
    await click(host.querySelector('[data-zoom="out"]'));
    for (const b of host.querySelectorAll(".journey-strip__chapter")) await click(b);
    await click(host.querySelector("[data-back-to-now]"));
    for (const k of ["ArrowRight", "ArrowLeft", "PageDown", "PageUp", "+", "-", "Home"]) await key(stage, k);
    for (const x of sample.crossroads) {
      await click(mark(host, x.id));
      for (const alt of panel(host)!.querySelectorAll("[data-alternative-id]")) await click(alt);
      const back = [...panel(host)!.querySelectorAll("button")].find((b) => b.textContent === COPY.returnWithoutChanging);
      if (back) await click(back);
    }
    await click(mark(host, "piece"));
    for (const input of panel(host)!.querySelectorAll<HTMLInputElement>('input[type="radio"]')) await click(input);
    await click(host.querySelector('[data-list-mode="list"]'));
    await click(host.querySelector('[data-list-mode="map"]'));
    expect(totalCalls(actions)).toBe(0);
  });
});

describe("crossroads", () => {
  it("preview → banner + provisional drawing; return without changing; continue opens the owning surface once", async () => {
    const { host, actions } = await mountView();
    const confirmFor: Record<string, ActionCall> = Object.fromEntries(sample.crossroads.map((x) => [x.id, x.confirm.call]));
    for (const x of sample.crossroads) {
      await click(mark(host, x.id));
      expect(panel(host)!.textContent).toContain(x.question);
      expect(panel(host)!.textContent).not.toContain(COPY.previewBanner);
      const other = x.alternatives.find((a) => !a.isCurrent)!;
      await click(panel(host)!.querySelector(`[data-alternative-id="${esc(other.id)}"]`));
      expect(panel(host)!.querySelector(".journey-preview-banner")!.textContent).toBe(COPY.previewBanner);
      expect(host.querySelector(`[data-preview="${esc(other.id)}"]`), "flat twin draws the preview").toBeTruthy();
      if (other.preview.kind === "plan") expect(panel(host)!.textContent).toContain("Adds Ferry to Newfoundland · $420.00");
      if (other.preview.kind === "era") expect(panel(host)!.textContent).toContain("By: none → June 2027");
      if (other.preview.kind === "home") expect(panel(host)!.textContent).toContain("Adds Study");
      if (x.waitingOn.length) expect(panel(host)!.textContent).toContain("Waiting on Jonathan to agree.");
      const back = [...panel(host)!.querySelectorAll("button")].find((b) => b.textContent === COPY.returnWithoutChanging)!;
      await click(back);
      expect(panel(host)!.querySelector(".journey-preview-banner")).toBeNull();
      expect(host.querySelector("[data-preview]")).toBeNull();
      expect(totalCalls(actions)).toBe(0);
      await click(panel(host)!.querySelector(`[data-action-id="${esc(`${x.id}#confirm`)}"]`));
      expect(recorded(actions)).toEqual(expected(confirmFor[x.id]!));
      Object.values(actions.spies).forEach((s) => s.mockClear());
      await key(panel(host)!, "Escape");
    }
  });
});

describe("keyboard and focus", () => {
  it("Escape closes the panel and returns focus to the mark that opened it", async () => {
    const { host } = await mountView();
    const piece = mark(host, "piece")!;
    piece.focus();
    await click(piece);
    expect(document.activeElement).toBe(panel(host)!.querySelector("h2"));
    await key(document.activeElement!, "Escape");
    expect(panel(host)).toBeNull();
    expect(document.activeElement).toBe(piece);

    // A stop opened from its day's cluster returns to the cluster's mark.
    const cluster = mark(host, SAMPLE_IDS.clusterToday)!;
    expect(cluster.hidden).toBe(false);
    cluster.focus();
    await click(cluster);
    await click(panel(host)!.querySelector(`[data-open-stop="${esc(SAMPLE_IDS.dueToday)}"]`));
    expect(panel(host)!.textContent).toContain("Back to this day");
    await key(panel(host)!, "Escape");
    expect(document.activeElement).toBe(cluster);
  });

  it("Back to now closes an open stop or cluster panel in the same action (PR #567 review)", async () => {
    const { host } = await mountView();
    const cluster = mark(host, SAMPLE_IDS.clusterToday)!;
    await click(cluster);
    await click(panel(host)!.querySelector(`[data-open-stop="${esc(SAMPLE_IDS.dueToday)}"]`));
    expect(panel(host)).not.toBeNull();
    await click(host.querySelector("[data-back-to-now]"));
    expect(panel(host)).toBeNull();
    expect(host.querySelector('.journey-strip__chapter[data-chapter-id="2026-09"]')!.className).toContain("is-focused");
    // The cluster list alone (no stop opened) closes too, and so does the piece's panel through the Home key.
    await click(mark(host, SAMPLE_IDS.clusterToday)!);
    expect(panel(host)).not.toBeNull();
    await click(host.querySelector("[data-back-to-now]"));
    expect(panel(host)).toBeNull();
    await click(mark(host, "piece")!);
    expect(panel(host)).not.toBeNull();
    const stage = host.querySelector<HTMLElement>(".journey-stage")!;
    stage.focus();
    await key(stage, "Home");
    expect(panel(host)).toBeNull();
    expect(live(host)).toContain(COPY.backToNow);
  });

  it("arrows move a day, Page keys a month, Home goes back to now, Enter opens what is on the day; a live region announces", async () => {
    const { host } = await mountView();
    const stage = host.querySelector<HTMLElement>(".journey-stage")!;
    stage.focus();
    await key(stage, "ArrowRight");
    expect(live(host)).toContain("Tue 29 Sep");
    expect(live(host)).toContain("Emergency buffer");
    await key(stage, "Enter");
    expect(panel(host)!.textContent).toContain("Emergency buffer");
    expect(live(host)).toContain("Selected");
    await key(panel(host)!, "Escape");
    await key(stage, "PageDown");
    expect(live(host)).toContain("Thu 29 Oct");
    expect(host.querySelector('.journey-strip__chapter[data-chapter-id="2026-10"]')!.className).toContain("is-focused");
    await key(stage, "Home");
    expect(live(host)).toContain(COPY.backToNow);
    expect(host.querySelector('.journey-strip__chapter[data-chapter-id="2026-09"]')!.className).toContain("is-focused");
    await key(stage, "ArrowLeft");
    expect(live(host)).toContain("Sun 27 Sep");
    expect(live(host)).toContain("Weekly Sitdown");
  });

  it("keeps the keyboard order summary → strip → Map/List → Back to now → marks → panel", async () => {
    const { host } = await mountView();
    await click(mark(host, SAMPLE_IDS.crossEra));
    const order = [".journey-summary", ".journey-strip__chapters", ".journey-toggle", "[data-back-to-now]", ".journey-marks", "[data-journey-panel]"]
      .map((sel) => host.querySelector(sel)!);
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING, `${i}`).toBeTruthy();
    }
    // Every mark is a real button with a ≥ 44 px hit area declared by its class; the canvas side is aria-hidden.
    expect(host.querySelector(".journey-stage__flat")!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("motion, themes, empty", () => {
  it("reduced motion renders no animated class", async () => {
    const still = await mountView({ reducedMotion: true });
    const root = still.host.querySelector("[data-journey-board]")!;
    expect(root.className).not.toContain("journey-board--animated");
    expect(root.className).toContain("journey-board--still");
    const moving = await mountView({ reducedMotion: false });
    expect(moving.host.querySelector("[data-journey-board]")!.className).toContain("journey-board--animated");
  });

  it("renders the three authored theme classes", async () => {
    for (const theme of JOURNEY_THEMES as readonly ThemeId[]) {
      const { host } = await mountView({ theme });
      const root = host.querySelector("[data-journey-board]")!;
      expect(root.classList.contains(`journey-board--${theme}`)).toBe(true);
      expect(host.querySelector(`svg.journey-land-flat--${theme}`), theme).toBeTruthy();
    }
  });

  it("an empty household gets honest copy and setup actions, with no memory or milestone rows", async () => {
    const empty = sampleEmptyJourneyBoard();
    const { host, actions } = await mountView({ board: empty, stage: { mode: "flat", status: "loading", land, landHandle: null, route: layoutRoute(empty, land), quality: "lite" } });
    expect(host.querySelector("[data-journey-summary]")!.textContent).toContain(COPY.emptyTitle);
    expect(host.querySelector("[data-journey-summary]")!.textContent).toContain(COPY.emptyBody);
    const labels = [...host.querySelectorAll(".journey-summary__actions [data-action-id]")].map((b) => b.textContent);
    expect(labels).toEqual(empty.summary.quickActions.map((a) => a.label));
    expect(host.querySelectorAll(".journey-mark--stop, .journey-mark--cluster, .journey-mark--crossroads")).toHaveLength(0);
    await click(host.querySelector('[data-list-mode="list"]'));
    expect(host.querySelector(".journey-list")!.textContent).toContain(COPY.emptyTitle);
    expect(host.querySelectorAll(".journey-row")).toHaveLength(0);
    expect(host.textContent).not.toMatch(/Milestone|Memory · |Kept by everyone/);
    await click(host.querySelector('.journey-summary__actions [data-action-id="quick#books"]'));
    expect(recorded(actions)).toEqual(expected({ name: "openBooks", ref: { kind: "register" } }));
  });

  it("never offers Enter Horizon on the flat board", async () => {
    const { host } = await mountView();
    await click(host.querySelector('[data-zoom="in"]'));
    expect(host.querySelector("[data-enter-horizon]")).toBeNull();
    await openStop(host, sample, SAMPLE_IDS.milestoneGranted);
    expect(panel(host)!.textContent).not.toContain(COPY.enterHorizon);
  });
});

describe("layout fix pass (F3): Compass clearance, glance, summary card, resize framing, mark semantics", () => {
  it("reads the App's Compass: a full-width bar is the phone's bottom clearance; a floating pill is the panel's", () => {
    // Phone 390 × 844: the door bar (101 px) — taller than the App's 76 px --mobile-bottom-clearance.
    expect(compassClearance({ left: 0, right: 390, top: 743, bottom: 844 }, { width: 390, height: 844 })).toEqual({ phone: 101, float: null });
    // Wide 1100 × 800: the pill at right 20 / bottom 16.
    expect(compassClearance({ left: 846, right: 1080, top: 691, bottom: 784 }, { width: 1100, height: 800 })).toEqual({ phone: null, float: 109 });
    // No bar (tests, a host without it) or one off-screen: the CSS falls back to the App's variable.
    expect(compassClearance(null, { width: 390, height: 844 })).toEqual({ phone: null, float: null });
    expect(compassClearance({ left: 0, right: 390, top: 900, bottom: 1000 }, { width: 390, height: 844 })).toEqual({ phone: null, float: null });
  });

  it("measures a Compass in the document into the board's own variables (never styling the App's bar)", async () => {
    const bar = document.createElement("nav");
    bar.setAttribute("data-harbour-bar", "door");
    bar.getBoundingClientRect = () => ({ left: 0, right: window.innerWidth, top: window.innerHeight - 101, bottom: window.innerHeight, width: window.innerWidth, height: 101, x: 0, y: window.innerHeight - 101, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(bar);
    try {
      const { host } = await mountView();
      const board = host.querySelector<HTMLElement>("[data-journey-board]")!;
      expect(board.style.getPropertyValue("--jb-compass")).toBe("101px");
      expect(bar.getAttribute("style")).toBeNull();
    } finally { bar.remove(); }
  });

  it("puts the Everyday figure on its own glance line and the attention count in a badge (words kept for screen readers)", async () => {
    const { host } = await mountView();
    const line = host.querySelector(".journey-summary__line")!;
    const figure = line.querySelector(".journey-summary__glance-figure")!;
    expect(figure.textContent).toBe(sample.summary.everyday!.figure);
    expect(figure.closest(".journey-summary__glance")!.textContent).toBe(`${COPY.everydayNow} ${sample.summary.everyday!.figure}`);
    const badge = line.querySelector("[data-glance-attention]")!;
    expect(badge.textContent).toBe(`${sample.summary.attention.length} need attention`);
    expect(badge.closest(".journey-summary__heading")).toBeTruthy();
  });

  it("pins the quick actions above attention and coming next; next is at most three compact rows", async () => {
    const { host } = await mountView();
    const summary = host.querySelector("[data-journey-summary]")!;
    const actions = summary.querySelector(".journey-summary__actions")!;
    const body = summary.querySelector(".journey-summary__body")!;
    expect(actions.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body.contains(summary.querySelector(".journey-summary__attention"))).toBe(true);
    expect(body.contains(summary.querySelector(".journey-summary__next"))).toBe(true);
    expect(actions.closest(".journey-summary__body")).toBeNull();
    expect(summary.querySelectorAll(".journey-summary__next li").length).toBeLessThanOrEqual(3);
    expect(summary.querySelectorAll(".journey-summary__attention li").length).toBeLessThanOrEqual(3);
  });

  it("marks open a panel: aria-expanded + aria-controls (the panel slot), never aria-pressed", async () => {
    const { host } = await mountView();
    const m = mark(host, SAMPLE_IDS.overdue) ?? mark(host, clusterOf(sample, SAMPLE_IDS.overdue)!)!;
    const slotId = m.getAttribute("aria-controls")!;
    expect(slotId).toBeTruthy();
    const slot = host.ownerDocument.getElementById(slotId)!;
    expect(slot.hidden).toBe(true);
    expect(m.hasAttribute("aria-pressed")).toBe(false);
    expect(m.getAttribute("aria-expanded")).toBe("false");
    await click(m);
    expect(m.getAttribute("aria-expanded")).toBe("true");
    expect(slot.hidden).toBe(false);
    expect(slot.contains(panel(host))).toBe(true);
    for (const other of host.querySelectorAll(".journey-mark")) if (other !== m) expect(other.getAttribute("aria-expanded")).toBe("false");
    expect(live(host)).toContain("Selected");
  });

  it("frames the last framing again after a resize while the camera is untouched, and not after a hand move", async () => {
    const observers: { cb: ResizeObserverCallback; targets: Element[] }[] = [];
    class FakeRO { targets: Element[] = []; constructor(public cb: ResizeObserverCallback) { observers.push(this); } observe(t: Element) { this.targets.push(t); } unobserve() {} disconnect() { this.targets = []; } }
    vi.stubGlobal("ResizeObserver", FakeRO);
    const focus = vi.fn();
    const scene = {
      setBoard() {}, setSelection() {}, setPreview() {}, setTheme() {}, resize() {}, sleep() {}, wake() {}, dispose() {}, renderNow() {},
      setSafeArea: vi.fn(), focus, zoomBy() {}, panBy() {}, groundAt: () => null, screenToWorld: () => null, anchors: () => [],
      view: () => ({ x: 0, y: 0, radius: 400, tier: "region" as const, worldPerPixel: 1 }), stats: () => ({ triangles: 0, drawCalls: 0 }),
    } as unknown as BoardSceneHandle;
    const { host } = await mountView({ stage: { mode: "live", status: "loading", land, landHandle: { isLand: () => true } as never, route, quality: "full" }, createScene: () => scene });
    const stageEl = host.querySelector<HTMLElement>(".journey-stage")!;
    const resizeTo = async (w: number, h: number) => {
      Object.defineProperty(stageEl, "clientWidth", { configurable: true, value: w });
      Object.defineProperty(stageEl, "clientHeight", { configurable: true, value: h });
      await act(async () => { for (const o of observers) if (o.targets.includes(stageEl)) o.cb([], o as unknown as ResizeObserver); });
    };
    const cuts = () => focus.mock.calls.filter((c) => c[2] === false);
    await resizeTo(1100, 740);
    expect(cuts()).toHaveLength(0); // the first measured size is the mount's: the scene frames it itself
    await resizeTo(390, 600);
    expect(cuts()).toEqual([["piece", "region", false]]);
    // A hand move (a wheel on the stage) makes the view the person's: a later resize holds it.
    await act(async () => { stageEl.dispatchEvent(new WheelEvent("wheel", { deltaY: -60, bubbles: true })); });
    await resizeTo(320, 560);
    expect(cuts()).toHaveLength(1);
    // Back to now is an explicit framing again: the next resize re-frames it.
    await click(host.querySelector("[data-back-to-now]"));
    await resizeTo(1100, 740);
    expect(cuts()).toEqual([["piece", "region", false], ["piece", "region", false]]);
  });
});

describe("safe area and district names (fix pass)", () => {
  it("turns the covering chrome into edge bands: the wide card is a left band, a side panel a right band, the phone sheet a bottom band", () => {
    // Wide 1100 × 740: the summary card (16 px margin, 340 wide, most of the height) and a 360 px panel on the right.
    expect(safeAreaFor([{ x0: 16, x1: 356, y0: 16, y1: 600 }, { x0: 724, x1: 1084, y0: 16, y1: 500 }], 1100, 740)).toEqual({ top: 0, right: 376, bottom: 0, left: 356 });
    // Phone 390 × 600: the bottom sheet over the stage's lower 40 %.
    expect(safeAreaFor([{ x0: 0, x1: 390, y0: 360, y1: 700 }], 390, 600)).toEqual({ top: 0, right: 0, bottom: 240, left: 0 });
    // Chrome outside the stage (the strip in its own grid row) covers nothing.
    expect(safeAreaFor([{ x0: 0, x1: 1100, y0: -48, y1: 0 }], 1100, 740)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("shows readable bridge identities without adding an action or a focus target", async () => {
    const entries=markEntries(sample,()=>undefined);
    const landmark={name:"Suspension Bridge",glyph:"suspension" as const,at:[0,12,0] as const};
    const anchors=[{id:"bridge:bightBridge",x:200,y:180,depth:10,visible:true,bridge:landmark},
      {id:"bridge:hidden",x:200,y:280,depth:10,visible:false,bridge:landmark}];
    const {host}=await mount(createElement(Marks,{board:sample,entries,anchors,size:{width:390,height:740},selectedId:null,onSelect:()=>undefined}));
    const tags=[...host.querySelectorAll<HTMLElement>(".journey-bridge-label")];
    expect(tags).toHaveLength(1);expect(tags[0]!.textContent).toContain("Suspension Bridge");
    expect(tags[0]!.querySelector("svg path")).not.toBeNull();expect(tags[0]!.tabIndex).toBe(-1);
    expect(tags[0]!.closest("button")).toBeNull();
  });

  it("shows the baked Suspension Bridge name and glyph through the real flat Stage without an action", async () => {
    const bridge=land.bridges!.find(b=>b.id==="bightBridge")!;
    const {host,actions}=await mountView({reducedMotion:true,initialFocusOverride:{target:{x:bridge.landmark!.at[0],y:bridge.landmark!.at[2]},tier:"region"}});
    expect(host.querySelector('[data-stage-mode="flat"]')).not.toBeNull();
    const label=host.querySelector('[data-bridge-id="bightBridge"]');
    expect(label?.textContent).toBe(bridge.landmark!.name);
    expect(label?.querySelector('svg path')).not.toBeNull();
    expect(label?.closest('button')).toBeNull();
    await click(label);expect(totalCalls(actions)).toBe(0);
  });

  it("draws district names as aria-hidden tags at the lowest priority, outside the tab order", async () => {
    const entries = markEntries(sample, () => undefined);
    const piece = { id: "piece", x: 200, y: 200, depth: 10, visible: true };
    const anchors = [
      piece,
      { id: "district:green", x: 600, y: 300, depth: 20, visible: true },
      // Overlaps the piece's label: it yields.
      { id: "district:hollow", x: 200, y: 190, depth: 20, visible: true },
      // Not drawn at this tier (Stop): no tag.
      { id: "district:reach", x: 800, y: 500, depth: 20, visible: false },
    ];
    const { host } = await mount(createElement(Marks, { board: sample, entries, anchors, size: { width: 1100, height: 740 }, selectedId: null, onSelect: () => undefined }));
    const tags = [...host.querySelectorAll<HTMLElement>(".journey-district")];
    expect(tags.map((t) => t.dataset.districtId)).toEqual(["green"]);
    expect(tags[0]!.textContent).toBe("The Green");
    expect(tags[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(tags[0]!.tabIndex).toBe(-1);
    expect(tags[0]!.closest("button")).toBeNull();
    // The marks' buttons (the tab order) are unchanged by the tags.
    expect(host.querySelectorAll("button.journey-mark").length).toBe(entries.length);
  });
});

describe("view state", () => {
  const identity = { environment: "development" as const, householdId: "HH-sample", memberId: "MEM-001" };
  function memoryStorage() {
    const map = new Map<string, string>();
    return { map, storage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); }, clear: () => map.clear(), key: () => null, length: 0 } as Storage };
  }

  it("round-trips through the contract key and restores the selection on mount", async () => {
    const { storage, map } = memoryStorage();
    const state: JourneyViewState = {
      ...DEFAULT_JOURNEY_VIEW_STATE, tier: "stop", focusDate: "2026-09-15" as never, target: { x: 1200, y: 900 }, selectedStopId: SAMPLE_IDS.overdue,
      expandedClusterId: SAMPLE_IDS.clusterOverdue, listMode: "list", pieceLook: "boat", lastEnter: { location: { host: "home" }, tier: "stop", focusDate: null },
    };
    expect(writeJourneyViewState(identity, state, storage)).toBe(true);
    expect([...map.keys()]).toEqual([journeyViewStateKey(identity)]);
    expect(readJourneyViewState(identity, storage)).toEqual(state);
    expect(parseJourneyViewState({ version: 1, tier: "moon", pieceLook: "dragon", listMode: 3, selectedStopId: 7 })).toEqual(DEFAULT_JOURNEY_VIEW_STATE);

    const changes: JourneyViewState[] = [];
    const { host } = await mountView({ initialViewState: state, onViewStateChange: (s) => changes.push(s) });
    expect(panel(host)!.textContent).toContain("Groceries · planned");
    expect(host.querySelector(".journey-list")).toBeTruthy();
    await key(panel(host)!, "Escape");
    expect(changes.at(-1)!.selectedStopId).toBeNull();
    await click(host.querySelector('[data-list-mode="map"]'));
    expect(changes.at(-1)!.listMode).toBe("map");
  });

  it("a throwing or missing storage reads as the defaults and never throws", () => {
    const throwing = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("QuotaExceeded"); } } as unknown as Storage;
    expect(readJourneyViewState(identity, throwing)).toEqual(DEFAULT_JOURNEY_VIEW_STATE);
    expect(writeJourneyViewState(identity, DEFAULT_JOURNEY_VIEW_STATE, throwing)).toBe(false);
    expect(readJourneyViewState(identity, null)).toEqual(DEFAULT_JOURNEY_VIEW_STATE);
    const garbage = { getItem: () => "{not json", setItem: () => undefined } as unknown as Storage;
    expect(readJourneyViewState(identity, garbage)).toEqual(DEFAULT_JOURNEY_VIEW_STATE);
  });

  it("writes debounced (300 ms) and flushes on unmount", async () => {
    vi.useFakeTimers();
    const { storage, map } = memoryStorage();
    let store!: ReturnType<typeof useJourneyViewStateStore>;
    function Probe() { store = useJourneyViewStateStore(identity, storage); return null; }
    const m = await mount(createElement(Probe));
    store.save({ ...DEFAULT_JOURNEY_VIEW_STATE, pieceLook: "cat" });
    store.save({ ...DEFAULT_JOURNEY_VIEW_STATE, pieceLook: "kettle" });
    expect(map.size).toBe(0);
    await act(async () => { vi.advanceTimersByTime(VIEW_STATE_WRITE_DELAY_MS + 5); });
    expect(readJourneyViewState(identity, storage).pieceLook).toBe("kettle");
    store.save({ ...DEFAULT_JOURNEY_VIEW_STATE, pieceLook: "boat" });
    await act(async () => { m.root.unmount(); });
    mounted.splice(mounted.findIndex((x) => x.root === m.root), 1);
    expect(readJourneyViewState(identity, storage).pieceLook).toBe("boat");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Live wiring: the demo household through derive → load → build → layout → scene (renderer lease test seam).

function fakeRenderer() {
  const canvas = document.createElement("canvas");
  const renderer = {
    domElement: canvas, render: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn(),
    setPixelRatio: vi.fn(), setSize: vi.fn(), setClearColor: vi.fn(), setRenderTarget: vi.fn(), setScissorTest: vi.fn(),
    autoClear: true, shadowMap: { enabled: true, type: 0 }, outputColorSpace: "", toneMapping: 0,
  } as unknown as THREE.WebGLRenderer;
  return renderer;
}
const pendingFrames: FrameRequestCallback[] = [];
async function flushFrames() {
  for (let guard = 0; guard < 6 && pendingFrames.length; guard += 1) {
    await act(async () => { for (const cb of pendingFrames.splice(0)) cb(performance.now() + 10_000); });
  }
}
async function waitFor(check: () => boolean, label: string) {
  for (let i = 0; i < 200 && !check(); i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    await flushFrames();
  }
  expect(check(), label).toBe(true);
}

describe("live wiring (JourneyBoard)", () => {
  let household: ReturnType<typeof journeyDemoHousehold>["household"];
  beforeAll(() => { household = journeyDemoHousehold().household; });
  afterAll(() => { pendingFrames.length = 0; });

  it("derives the demo board, loads the land, draws the scene, places DOM marks and calls onReady once", async () => {
    stubLandFetch();
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { pendingFrames.push(cb); return pendingFrames.length; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const actions = spyActions();
    const onReady = vi.fn();
    const renderer = fakeRenderer();
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } } as unknown as Storage;
    const { host } = await mount(createElement(JourneyBoardEntry, {
      household, memberId: BIANCA, environment: "development", today: FIXTURE_TODAY, theme: "newfoundland", actions, onReady,
      quality: "full", storage, sceneExtras: { rendererFactory: () => renderer, shared: false, size: { width: 1100, height: 800 }, devicePixelRatio: 1 },
    }));
    // Summary + list are there before any land.
    expect(host.querySelector("[data-journey-summary]")!.textContent).toContain("September 2026");
    await waitFor(() => host.querySelector('[data-stage-mode="live"]') !== null, "live stage");
    await waitFor(() => onReady.mock.calls.length > 0, "onReady");
    expect(onReady).toHaveBeenCalledTimes(1);
    expect((renderer.render as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    const piece = mark(host, "piece")!;
    expect(piece.hidden).toBe(false);
    expect(piece.style.transform).toMatch(/translate\(/);
    const shown = [...host.querySelectorAll<HTMLButtonElement>(".journey-mark")].filter((b) => !b.hidden);
    expect(shown.length).toBeGreaterThan(5);
    expect(host.querySelector(".journey-mark--labelled")).toBeTruthy();

    // Zoom to Stop: the explicit Enter Horizon affordance appears; pressing it saves lastEnter and calls enterHorizon once.
    await click(host.querySelector('[data-zoom="in"]'));
    await flushFrames();
    await click(host.querySelector('[data-zoom="in"]'));
    await flushFrames();
    await waitFor(() => host.querySelector("[data-enter-horizon]") !== null, "enter horizon at stop");
    await waitFor(() => !(host.querySelector("[data-enter-horizon]") as HTMLButtonElement).disabled, "centre on land");
    expect(totalCalls(actions)).toBe(0);
    await click(host.querySelector("[data-enter-horizon]"));
    expect(actions.spies.enterHorizon).toHaveBeenCalledTimes(1);
    const location = actions.spies.enterHorizon.mock.calls[0]![0] as { x: number; y: number };
    expect(typeof location.x).toBe("number");
    const saved = readJourneyViewState({ environment: "development", householdId: household.householdId, memberId: BIANCA }, storage);
    expect(saved.lastEnter?.location).toEqual(location);
    expect(saved.lastEnter?.tier).toBe("stop");
    expect(totalCalls(actions)).toBe(1);
  }, 60_000);

  it("falls back to the flat twin (no WebGL) and still calls onReady once", async () => {
    stubLandFetch();
    const onReady = vi.fn();
    const { host } = await mount(createElement(JourneyBoardEntry, {
      household, memberId: BIANCA, environment: "development", today: FIXTURE_TODAY, theme: "taylor", actions: spyActions(), onReady, quality: "flat", storage: null,
    }));
    await waitFor(() => host.querySelector('[data-stage-mode="flat"]') !== null, "flat stage");
    await waitFor(() => onReady.mock.calls.length === 1, "onReady (flat)");
    expect(host.querySelector("svg.journey-land-flat--taylor")).toBeTruthy();
    expect(mark(host, "piece")).toBeTruthy();
  }, 60_000);

  it("a failed land load leaves the summary and the list, and still calls onReady", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    resetJourneyLandCacheForTests();
    const onReady = vi.fn();
    const { host } = await mount(createElement(JourneyBoardEntry, {
      household, memberId: BIANCA, environment: "development", today: FIXTURE_TODAY, theme: "classic", actions: spyActions(), onReady, quality: "full", storage: null,
    }));
    await waitFor(() => onReady.mock.calls.length === 1, "onReady (failed)");
    expect(host.querySelector(".journey-stage__note")!.textContent).toBe(COPY.mapUnavailable);
    await click(host.querySelector('[data-list-mode="list"]'));
    expect(host.querySelectorAll(".journey-row").length).toBeGreaterThan(50);
    resetJourneyLandCacheForTests();
  }, 60_000);
});
