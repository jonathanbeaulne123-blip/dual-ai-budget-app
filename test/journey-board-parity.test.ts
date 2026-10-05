// @vitest-environment jsdom
/**
 * Map ↔ list parity on the REAL derived board (Horizon Clock): the fictional demo household → `deriveJourneyBoard` →
 * the map's stop sheets and the list (`listView`), plus the flat map's marks against a 3D scene's anchors per level.
 *
 * - Every stop and crossroads id appears exactly once in `boardToList`; each row carries the stop's own actions.
 * - The sheet and the list run the SAME calls for every stop in the month, once each, and print the same words.
 * - Flat marks ⊇ 3D anchors at Year, Month and Week: a stub `createJourneyMapScene` (the contract's anchor ids:
 *   chapter ids, dates, stop ids, piece / hercules / pile) projects what L3 draws; every anchor id is reachable through
 *   a flat mark button, and the live shell places a button on each.
 * Fictional Development data only.
 */
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  JOURNEY_LEVELS, JOURNEY_MAP_MARKS, LEVEL_T, runJourneyAction,
  type ActionCall, type ChapterId, type CreateJourneyMapScene, type JourneyBoardActions, type JourneyBoardV2, type JourneyLandHandle, type JourneyLevel,
  type JourneyMapSceneOptions, type ListRow, type MarkAnchor, type Stop,
} from "../src/journey/contracts.ts";
import { boardToList, deriveJourneyBoard, listView } from "../src/journey/model/index.ts";
import { JourneyBoardView, type JourneyBoardViewProps } from "../src/journey/ui/JourneyBoardView.tsx";
import { journeyMarkDomId } from "../src/journey/ui/Marks.tsx";
import { journeyRowDomId } from "../src/journey/ui/ListView.tsx";
import { coveredIds, mapMarks } from "../src/journey/ui/mapLayout.ts";
import { StopPanel } from "../src/journey/ui/StopPanel.tsx";
import { BIANCA, FIXTURE_TODAY, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";
import type { Household } from "../src/core/types.ts";

vi.setConfig({ testTimeout: 120_000 });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let household: Household;
let board: JourneyBoardV2;
let rows: ListRow[];
beforeAll(() => {
  household = journeyDemoHousehold().household;
  board = deriveJourneyBoard(household, BIANCA, FIXTURE_TODAY);
  rows = boardToList(board);
}, 120_000);

// ---------------------------------------------------------------------------------------------------------------
// Harness

const NAMES: (keyof JourneyBoardActions)[] = ["openRecord", "openBillPaid", "openDueReview", "openPlace", "openCampfire", "openWeeklySitdown", "openHomeBook", "openEraPlanner", "openKitty", "openCalendar", "openBooks", "enterHorizon", "back"];
type Spied = JourneyBoardActions & { spies: Record<string, ReturnType<typeof vi.fn>> };
function spyActions(): Spied {
  const spies = Object.fromEntries(NAMES.map((n) => [n, vi.fn()]));
  return { ...(spies as unknown as JourneyBoardActions), spies };
}
const recorded = (a: Spied) => Object.entries(a.spies).flatMap(([name, s]) => s.mock.calls.map((args) => [name, args] as const));
const clear = (a: Spied) => Object.values(a.spies).forEach((s) => s.mockClear());
function invocation(call: ActionCall) {
  const probe = spyActions();
  runJourneyAction(probe, call);
  return recorded(probe);
}

let reactRoot: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  if (reactRoot) await act(async () => { reactRoot!.unmount(); });
  host?.remove();
  reactRoot = null; host = null;
});
async function mountView(over: Partial<JourneyBoardViewProps> = {}): Promise<{ host: HTMLElement; actions: Spied }> {
  const actions = spyActions();
  const props: JourneyBoardViewProps = {
    board, actions, theme: "classic", reducedMotion: true,
    stage: { mode: "flat", status: "ready", land: null, landHandle: null, createScene: null, quality: "lite", awaiting3d: false },
    listOf: (scope) => listView(household, board, scope),
    nameOf: (id) => (id === BIANCA ? "Bianca" : "Jonathan"),
    ...over,
  };
  host = document.createElement("div");
  document.body.appendChild(host);
  reactRoot = createRoot(host);
  await act(async () => { reactRoot!.render(createElement(JourneyBoardView, props)); });
  return { host, actions: props.actions as Spied };
}
const click = async (el: Element | null | undefined, what: string) => {
  expect(el, what).toBeTruthy();
  await act(async () => { (el as HTMLElement).click(); });
};
const esc = (v: string) => v.replace(/["\\]/g, "\\$&");
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const sheetOf = (h: HTMLElement) => h.querySelector<HTMLElement>(".journey-sheet-slot [data-journey-panel]");

/** Open a stop's card the way a person does: its day mark, then (on a crowded day) the stop inside it. */
async function openCard(h: HTMLElement, stop: Stop) {
  await click(h.querySelector(`#${journeyMarkDomId(stop.date)}`), `day mark ${stop.date}`);
  let card = sheetOf(h)?.querySelector<HTMLElement>(`[data-stop-card="${esc(stop.id)}"]`);
  if (!card) {
    await click(sheetOf(h)?.querySelector(`[data-open-stop="${esc(stop.id)}"]`), `day entry ${stop.id}`);
    card = sheetOf(h)?.querySelector<HTMLElement>(`[data-stop-card="${esc(stop.id)}"]`);
  }
  expect(card, `card for ${stop.id}`).toBeTruthy();
  return card!;
}

// ---------------------------------------------------------------------------------------------------------------

describe("the demo board's list is the map's list", () => {
  it("is a substantial board (every kind), so parity is proved on real variety", () => {
    const kinds = new Set(board.stops.map((s) => s.kind));
    expect([...kinds].sort()).toEqual(["commitment", "income", "memory", "milestone", "plan", "review"]);
    expect(board.stops.length).toBeGreaterThan(60);
    expect(board.version).toBe(2);
    expect(board.toCheck.length).toBeGreaterThan(3);
    expect(board.empty).toBe(false);
  });

  it("lists every stop and crossroads id exactly once, with the stop's own actions (deep-equal calls)", () => {
    const count = new Map<string, number>();
    for (const row of rows) count.set(row.id, (count.get(row.id) ?? 0) + 1);
    const everyStop: Stop[] = [...board.stops, ...board.undatedMemories];
    for (const stop of everyStop) {
      expect(count.get(stop.id), stop.id).toBe(1);
      const row = rows.find((r) => r.id === stop.id)!;
      expect(row.actions, stop.id).toEqual(stop.actions);
    }
    for (const x of board.crossroads) {
      expect(count.get(x.id), x.id).toBe(1);
      expect(rows.find((r) => r.id === x.id)!.actions.map((a) => a.call)).toEqual([x.confirm.call]);
    }
    expect([...count.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });

  it("the map's sheet and the list run the SAME calls for every stop this month, and print the same amount and status words", async () => {
    const { host: h, actions } = await mountView();
    type Seen = { actions: { id: string; label: string; ran: ReturnType<typeof recorded> }[]; status: string };
    const sheetSeen = new Map<string, Seen>();
    const month = board.stops.filter((s) => s.chapterId === board.currentChapterId);
    for (const stop of month) {
      const card = await openCard(h, stop);
      const seen: Seen = { actions: [], status: text(card.querySelector(".journey-card__words")) };
      for (const button of card.querySelectorAll<HTMLButtonElement>("[data-action-id]")) {
        clear(actions);
        await click(button, `${stop.id} sheet action`);
        seen.actions.push({ id: button.dataset.actionId!, label: text(button), ran: recorded(actions) });
      }
      sheetSeen.set(stop.id, seen);
      await click(sheetOf(h)?.querySelector(".journey-panel__close"), "close");
    }
    clear(actions);
    await click(h.querySelector('[data-list-mode="list"]'), "List toggle");
    expect(recorded(actions)).toEqual([]);
    let pressed = 0;
    for (const stop of month) {
      const rowEl = h.querySelector<HTMLElement>(`#${journeyRowDomId(stop.id)}`);
      expect(rowEl, `list row ${stop.id}`).toBeTruthy();
      expect(h.querySelectorAll(`[data-row-id="${esc(stop.id)}"]`), `one row for ${stop.id}`).toHaveLength(1);
      const listActions: Seen["actions"] = [];
      for (const button of rowEl!.querySelectorAll<HTMLButtonElement>("[data-action-id]")) {
        clear(actions);
        await click(button, `${stop.id} list action`);
        listActions.push({ id: button.dataset.actionId!, label: text(button), ran: recorded(actions) });
        pressed += 1;
      }
      const map = sheetSeen.get(stop.id)!;
      expect(listActions, `${stop.id}: list actions = sheet actions`).toEqual(map.actions);
      expect(listActions.map((a) => a.ran), stop.id).toEqual(stop.actions.map((a) => invocation(a.call)));
      for (const a of listActions) expect(a.ran, a.id).toHaveLength(1);
      expect(map.status, `${stop.id} sheet status`).not.toBe("");
      expect(text(rowEl!.querySelector(".journey-row__status")), `${stop.id} status words`).toBe(map.status);
    }
    expect(pressed).toBeGreaterThan(30);
  });
});

describe("the sheet's words for a planning step", () => {
  it("names a task's figure its expected cost, never \"Saved\"", () => {
    const task = { kind: "plan", planKind: "task", id: "plan:task:T-1", taskId: "T-1", status: "open", planLineId: null, date: FIXTURE_TODAY, chapterId: "2026-09", label: "Book the ferry",
      amountCents: 42000, amountBasis: "scheduled", sourceRefs: [{ kind: "task", id: "T-1" }], major: false, relation: "today", actions: [] } as Stop;
    const row: ListRow = { id: task.id, level: "stop", chapterId: "2026-09", date: FIXTURE_TODAY, kindLabel: "Plan · step", label: task.label, amountText: "$420.00 · scheduled", statusText: "Open step", actions: [], depth: 2 };
    const html = renderToStaticMarkup(createElement(StopPanel, { stop: task, row, actions: spyActions(), onClose: () => undefined, horizonLocation: null, onEnterHorizon: () => undefined }));
    expect(html).toContain("<dt>Expected cost</dt>");
    expect(html).not.toContain("<dt>Saved</dt>");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Flat marks ⊇ 3D anchors, level by level. The stub projects the contract's mark ids for what L3 draws at a level.

/** The anchors a map scene reports at a level (contracts `JOURNEY_MAP_MARKS` + stop ids + dates + chapter ids). */
function sceneAnchors(b: JourneyBoardV2, level: JourneyLevel, chapterId: ChapterId): MarkAnchor[] {
  const at = (id: string, i: number): MarkAnchor => ({ id, x: 20 + (i % 30) * 11, y: 80 + Math.floor(i / 30) * 30, depth: i, visible: true });
  const ids: string[] = [];
  if (level === "year") ids.push(...b.year.map((y) => y.chapterId));
  else if (level === "month") {
    const stops = b.stops.filter((s) => s.chapterId === chapterId);
    ids.push(...new Set(stops.map((s) => s.date)), ...stops.map((s) => s.id), ...b.crossroads.filter((c) => c.chapterId === chapterId).map((c) => c.id));
    if (chapterId === b.currentChapterId) ids.push(b.today, JOURNEY_MAP_MARKS.piece, JOURNEY_MAP_MARKS.hercules);
  } else {
    ids.push(...b.week.days.map((d) => d.date), ...b.week.days.flatMap((d) => d.stopIds), JOURNEY_MAP_MARKS.piece);
    if (b.week.pileStopIds.length) ids.push(JOURNEY_MAP_MARKS.pile, ...b.week.pileStopIds);
  }
  return [...new Set(ids)].map(at);
}

describe("flat marks ⊇ the 3D anchors at every level", () => {
  it("every anchor the scene draws at Year, Month and Week is reachable through a flat mark (pure)", () => {
    for (const chapter of board.chapters) {
      for (const level of JOURNEY_LEVELS) {
        if (level !== "month" && chapter.id !== board.currentChapterId) continue;
        const marks = mapMarks(board, level, chapter.id);
        const reach = coveredIds(marks);
        const missing = sceneAnchors(board, level, chapter.id).map((a) => a.id).filter((id) => !reach.has(id));
        expect(missing, `${level} ${chapter.id}: 3D anchors with no flat mark`).toEqual([]);
      }
    }
  });

  it("the live shell puts a DOM button on every visible anchor's mark, and the flat shell has the same buttons", async () => {
    let options: JourneyMapSceneOptions | null = null;
    const create: CreateJourneyMapScene = (_host, o) => {
      options = o;
      return { setBoard() {}, setLevel() {}, setChapter() {}, setSelection() {}, setTheme() {}, resize() {}, setSafeArea() {}, groundAt: () => null, sleep() {}, wake() {}, stats: () => ({ triangles: 0, drawCalls: 0 }), dispose() {} };
    };
    const handle = { frame: { centre: [0, 0], radius: 1, scale: 1 }, setTheme() {}, dispose() {} } as unknown as JourneyLandHandle;
    const flat = await mountView();
    const flatButtons = new Map<JourneyLevel, Set<string>>();
    for (const level of JOURNEY_LEVELS) {
      await click(flat.host.querySelector(`[data-level="${level}"]`), level);
      flatButtons.set(level, new Set([...flat.host.querySelectorAll<HTMLElement>(".journey-mark")].map((b) => b.dataset.markId!)));
    }
    await act(async () => { reactRoot!.unmount(); });
    host!.remove(); reactRoot = null; host = null;

    const live = await mountView({ stage: { mode: "live", status: "ready", land: null, landHandle: handle, createScene: create, quality: "full", awaiting3d: true } });
    expect(options, "scene created").toBeTruthy();
    for (const level of JOURNEY_LEVELS) {
      await click(live.host.querySelector(`[data-level="${level}"]`), level);
      expect(live.host.querySelector(`[data-level="${level}"]`)!.getAttribute("aria-current")).toBe("true");
      const anchors = sceneAnchors(board, level, board.currentChapterId);
      await act(async () => { options!.onAnchors(anchors); });
      const marks = mapMarks(board, level, board.currentChapterId);
      const buttons = new Map([...live.host.querySelectorAll<HTMLElement>(".journey-mark")].map((b) => [b.dataset.markId!, b] as const));
      expect(new Set(buttons.keys()), `${level}: live and flat show the same mark buttons`).toEqual(flatButtons.get(level));
      for (const a of anchors) {
        const m = marks.find((x) => x.id === a.id || x.covers.includes(a.id));
        expect(m, `${level}: anchor ${a.id} has a mark`).toBeTruthy();
        const button = buttons.get(m!.id)!;
        expect(button.hidden, `${level}: ${m!.id} is shown`).toBe(false);
      }
      expect(LEVEL_T[level]).toBe(level === "year" ? 0 : level === "month" ? 1 : 2);
    }
  });
});
