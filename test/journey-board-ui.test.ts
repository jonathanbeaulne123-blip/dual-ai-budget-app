// @vitest-environment jsdom
/**
 * The Journey Map UI (Horizon Clock, L4) in jsdom: the flat map (no WebGL, no land needed) and a STUB scene for the
 * live path (`createJourneyMapScene` per contracts is injected; L3's real scene is proved in its own lane).
 * Board: the real derived v2 board for the fictional demo household (Bianca, 2026-09-28); list: the model's `listView`.
 *
 * Proves: header month + ‹ › + About this map + theme dot; purse words (Everyday and expected pay apart, never
 * summed); Hercules's bubble → checklist sections with state dots; every stop sheet action runs its call exactly once;
 * "Which one?" for a crowded pick; the "+" verbs and Open chips (absent callbacks hide chips); list order + sticky
 * Today; ≥ 44 px targets; reduced motion; three authored themes with AA white-on-deep-accent; empty / loading / failed
 * land; keyboard; view-state v2 with the v1 migration; the entry renders flat with no scene factory.
 * Fictional Development data only.
 */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_JOURNEY_VIEW_STATE_V2, JOURNEY_THEMES, journeyViewStateKeyV1, journeyViewStateKeyV2, LEVEL_T, runJourneyAction,
  type CreateJourneyMapScene, type JourneyBoardActions, type JourneyBoard, type JourneyLandData, type JourneyLandHandle,
  type JourneyMapSceneHandle, type JourneyMapSceneOptions, type ActionCall, type ListScope, type ThemeId,
} from "../src/journey/contracts.ts";
import { deriveJourneyBoard, listView, MAP_WORDS, signedMoney } from "../src/journey/model/index.ts";
import { JourneyBoardView, compassClearance, type JourneyBoardViewProps, type JourneyStageSource } from "../src/journey/ui/JourneyBoardView.tsx";
import JourneyBoardEntry from "../src/journey/ui/JourneyBoard.tsx";
import { journeyMarkDomId } from "../src/journey/ui/Marks.tsx";
import { journeyRowDomId } from "../src/journey/ui/ListView.tsx";
import { dialItems } from "../src/journey/ui/AddDial.tsx";
import { mapMarks } from "../src/journey/ui/mapLayout.ts";
import { readJourneyViewState, writeJourneyViewState, parseJourneyViewStateV2 } from "../src/journey/ui/viewState.ts";
import { callWords as callWordsFor, COPY } from "../src/journey/ui/copy.ts";
import { callouts, markSizes, placeMarks, tagMoney } from "../src/journey/ui/Marks.tsx";
import { levelForKey } from "../src/journey/ui/LevelPull.tsx";
import { needChips } from "../src/journey/ui/HerculesBubble.tsx";
import { BIANCA, FIXTURE_TODAY, emptyBoardHousehold, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";
import type { Household } from "../src/core/types.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let household: Household;
let board: JourneyBoard;
beforeAll(() => {
  household = journeyDemoHousehold().household;
  board = deriveJourneyBoard(household, BIANCA, FIXTURE_TODAY);
}, 60_000);

// ---------------------------------------------------------------------------------------------------------------
// Harness

const NAMES: (keyof JourneyBoardActions)[] = ["openRecord", "openBillPaid", "openDueReview", "openPlace", "openCampfire", "openWeeklySitdown", "openHomeBook", "openEraPlanner", "openKitty", "openCalendar", "openBooks", "enterHorizon", "back"];
type Spied = JourneyBoardActions & { spies: Record<string, ReturnType<typeof vi.fn>> };
function spyActions(optional = false): Spied {
  const names: string[] = [...NAMES, ...(optional ? ["openAllTools", "chooseSimpleView"] : [])];
  const spies = Object.fromEntries(names.map((n) => [n, vi.fn()]));
  return { ...(spies as unknown as JourneyBoardActions), spies };
}
const recorded = (a: Spied) => Object.entries(a.spies).flatMap(([name, s]) => s.mock.calls.map((args) => [name, args] as const));
const total = (a: Spied) => recorded(a).length;
const clear = (a: Spied) => Object.values(a.spies).forEach((s) => s.mockClear());
function invocation(call: ActionCall) {
  const probe = spyActions(true);
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

const flatStage = (over: Partial<JourneyStageSource> = {}): JourneyStageSource => ({ mode: "flat", status: "ready", land: null, landHandle: null, createScene: null, quality: "lite", awaiting3d: false, ...over });
function viewProps(over: Partial<JourneyBoardViewProps> & { optional?: boolean } = {}) {
  const { optional, ...rest } = over;
  const actions = spyActions(optional);
  const props: JourneyBoardViewProps = {
    board, actions, theme: "taylor", reducedMotion: true, stage: flatStage(),
    listOf: (scope: ListScope) => listView(household, board, scope),
    nameOf: (id) => (id === BIANCA ? "Bianca" : "Jonathan"),
    ...rest,
  };
  return { props, actions: props.actions as Spied };
}
async function mountView(over: Partial<JourneyBoardViewProps> & { optional?: boolean } = {}) {
  const { props, actions } = viewProps(over);
  const m = await mount(createElement(JourneyBoardView, props));
  return { ...m, props, actions };
}

const click = async (el: Element | null | undefined, what = "element") => {
  expect(el, what).toBeTruthy();
  await act(async () => { (el as HTMLElement).click(); });
};
const key = async (el: Element, k: string) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
};
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const esc = (v: string) => v.replace(/["\\]/g, "\\$&");
const mark = (host: HTMLElement, id: string) => host.querySelector<HTMLButtonElement>(`#${journeyMarkDomId(id)}`);
const sheet = (host: HTMLElement) => host.querySelector<HTMLElement>(".journey-sheet-slot [data-journey-panel]");
const title = (host: HTMLElement) => text(host.querySelector("[data-chapter-month]"));

/** A stub map scene (contracts `CreateJourneyMapScene`): records every setter; the test drives its callbacks. */
function stubScene() {
  const calls: { name: string; args: unknown[] }[] = [];
  let options: JourneyMapSceneOptions | null = null;
  const record = (name: string) => (...args: unknown[]) => { calls.push({ name, args }); };
  const handle: JourneyMapSceneHandle = {
    setBoard: record("setBoard"), setLevel: record("setLevel"), setChapter: record("setChapter"), setSelection: record("setSelection"), setTheme: record("setTheme"),
    resize: record("resize"), setSafeArea: record("setSafeArea"), groundAt: (x, y) => { calls.push({ name: "groundAt", args: [x, y] }); return { x: 1234.4, y: 567.6 }; },
    sleep: record("sleep"), wake: record("wake"), stats: () => ({ triangles: 0, drawCalls: 0 }), dispose: record("dispose"),
  };
  const create: CreateJourneyMapScene = (_host, o) => { options = o; calls.push({ name: "create", args: [o.t, o.chapterId, o.theme, o.reducedMotion] }); return handle; };
  return { create, calls, get options() { return options!; } };
}
const fakeLand = { revision: "horizon-geo-test", coastline: [], reserves: [{ id: "plot.terraces.1", outline: [], door: [812, 455] }], stations: [{ id: "sep", month: 9, anchor: [900, 300], height: 3, footprint: null }], homestead: [], kittyPlaza: { xy: [1000, 900], height: 2 } } as unknown as JourneyLandData;
const fakeHandle = { data: fakeLand, frame: { centre: [1000, 900], radius: 1000, scale: 0.004 }, setTheme: () => undefined, dispose: () => undefined } as unknown as JourneyLandHandle;
const liveStage = (create: CreateJourneyMapScene): JourneyStageSource => ({ mode: "live", status: "ready", land: fakeLand, landHandle: fakeHandle, createScene: create, quality: "full", awaiting3d: true });

const CSS = readFileSync("src/journey/ui/journey-board.css", "utf8");

// ---------------------------------------------------------------------------------------------------------------

describe("the header", () => {
  it("names the month, turns the chapter with ‹ ›, and stops at the window's edges — calling nothing", async () => {
    const { host, actions } = await mountView();
    expect(title(host)).toBe("September");
    expect(text(host.querySelector("[data-chapter-title] span"))).toBe("2026 · now");
    await click(host.querySelector('[data-step="-1"]'), "‹");
    expect(title(host)).toBe("August");
    expect(text(host.querySelector("[data-chapter-title] span"))).toBe("2026 · earlier");
    await click(host.querySelector('[data-step="1"]'));
    await click(host.querySelector('[data-step="1"]'));
    expect(title(host)).toBe("October");
    expect(text(host.querySelector("[data-chapter-title] span"))).toBe("2026 · ahead");
    for (let i = 0; i < 12; i += 1) { const b = host.querySelector<HTMLButtonElement>('[data-step="-1"]')!; if (b.disabled) break; await click(b); }
    expect(title(host)).toBe("January");
    expect(host.querySelector<HTMLButtonElement>('[data-step="-1"]')!.disabled).toBe(true);
    expect(total(actions)).toBe(0);
  });

  it("“i” opens About this map with the bake revision and the board's limitations, and × closes it", async () => {
    const { host, actions } = await mountView({ stage: flatStage({ land: fakeLand }) });
    const i = host.querySelector<HTMLButtonElement>("[data-about]")!;
    expect(i.getAttribute("aria-label")).toBe(COPY.about);
    await click(i);
    const pane = host.querySelector("[data-about-pane]")!;
    expect(text(pane.querySelector("[data-bake-revision]"))).toBe("horizon-geo-test");
    for (const l of board.limitations) expect(text(pane)).toContain(l.replace(/\s+/g, " "));
    await click(pane.querySelector(".journey-pop__x"), "×");
    expect(host.querySelector("[data-about-pane]")).toBeNull();
    expect(total(actions)).toBe(0);
  });

  it("the theme dot is hidden without onChooseTheme; with it, choosing a theme calls it once (app-wide, ruling 12)", async () => {
    const a = await mountView();
    expect(a.host.querySelector("[data-theme-dot]")).toBeNull();
    const onChooseTheme = vi.fn();
    const b = await mountView({ onChooseTheme });
    await click(b.host.querySelector("[data-theme-dot]"));
    const options = [...b.host.querySelectorAll<HTMLElement>("[data-theme-option]")];
    expect(options.map((o) => o.dataset.themeOption)).toEqual(["classic", "taylor", "newfoundland"]);
    expect(options.find((o) => o.dataset.themeOption === "taylor")!.getAttribute("aria-checked")).toBe("true");
    await click(b.host.querySelector('[data-theme-option="newfoundland"]'));
    expect(onChooseTheme.mock.calls).toEqual([["newfoundland"]]);
    expect(b.host.querySelector("[data-theme-option]")).toBeNull();
  });
});

describe("a pay already recorded today (trust M3)", () => {
  it("prints the model's note in the purse, on the stop's card and on its list row — both stops stay, nothing merged", async () => {
    const expected = board.purse.expectedToday[0]!;
    const note = MAP_WORDS.purse.alreadyRecorded;
    // The model's own note (its tests prove when it is set, on the demo twin); here the view only has to print it.
    const withNote = { ...board, purse: { ...board.purse, expectedToday: board.purse.expectedToday.map((e) => (e.stopId === expected.stopId ? { ...e, note } : e)) } } as JourneyBoard;
    const listOf = (scope: ListScope) => {
      const view = listView(household, withNote, scope);
      return { ...view, groups: view.groups.map((g) => ({ ...g, rows: g.rows.map((r) => (r.id === expected.stopId ? { ...r, note } : r)) })) };
    };
    const { host } = await mountView({ board: withNote, listOf });
    expect(text(host.querySelector(`[data-purse-expected="${esc(expected.stopId)}"] [data-purse-note]`))).toBe(note);
    expect(host.querySelector("[data-journey-purse]")!.getAttribute("aria-label")).toContain(note);
    expect(text(host.querySelector("[data-purse-everyday]"))).toBe("Everyday $0.00");
    await click(host.querySelector('[data-list-mode="list"]'));
    expect(text(host.querySelector(`[data-row-id="${esc(expected.stopId)}"] [data-row-note]`))).toBe(note);
  });
});

describe("the purse chip", () => {
  it("prints Everyday and today's expected pay apart — never summed — and expected pay only for today's chapter", async () => {
    const { host } = await mountView();
    const purse = host.querySelector("[data-journey-purse]")!;
    expect(text(purse.querySelector("[data-purse-everyday]"))).toBe("Everyday $0.00");
    const expected = board.purse.expectedToday[0]!;
    expect(text(purse.querySelector(`[data-purse-expected="${esc(expected.stopId)}"] b`))).toBe(signedMoney(expected.amountCents!));
    expect(text(purse.querySelector(`[data-purse-expected="${esc(expected.stopId)}"] .journey-purse__long`))).toBe(MAP_WORDS.purse.expectedToday(expected.label));
    expect(purse.getAttribute("aria-label")).toContain(MAP_WORDS.purseGloss);
    expect(purse.getAttribute("role")).not.toBe("status");
    expect(text(purse.querySelector("[data-purse-everyday]"))).not.toContain("2100");
    expect(purse.getAttribute("aria-label")).toContain(MAP_WORDS.purse.notCounted);
    await click(host.querySelector('[data-step="-1"]'));
    expect(host.querySelector("[data-purse-expected]")).toBeNull();
    expect(text(host.querySelector("[data-purse-everyday]"))).toBe("Everyday $0.00");
  });
});

describe("Hercules's bubble and the checklist", () => {
  it("the bubble says this week and the to-check count; it opens the checklist's sections with state dots — and posts nothing", async () => {
    const { host, actions } = await mountView({ dueReview: { count: 4 } });
    const bubble = host.querySelector<HTMLElement>("[data-journey-bubble]")!;
    expect(bubble.dataset.journeyBubble).toBe("today");
    expect(text(bubble.querySelector(".journey-bubble__b1"))).toBe(COPY.thingsThisWeek(board.digest.weekStopIds.length));
    expect(text(bubble.querySelector(".journey-bubble__chip"))).toBe(MAP_WORDS.toCheckCount(board.toCheck.length));
    // Winter reserve is money set aside in a jar, not money leaving (UX #5): the bubble says so in words.
    expect(bubble.getAttribute("aria-label")).toContain(`${MAP_WORDS.settingAsideNext} · Standing · jar · Winter reserve`);
    expect(bubble.getAttribute("aria-label")).not.toContain(MAP_WORDS.leavingNext);
    expect(text(bubble.querySelector(".journey-bubble__word"))).toBe(MAP_WORDS.settingAsideNext);
    expect(text(bubble.querySelector(".journey-bubble__b2 b"))).toBe("Winter reserve $300.00");
    // Trust M2: what waits besides "to check" shows on the bubble when non-zero.
    expect([...bubble.querySelectorAll<HTMLElement>("[data-chip]")].map((c) => c.dataset.chip)).toEqual(["to-check", "waiting", "reminders"]);
    expect(text(bubble.querySelector('[data-chip="reminders"]'))).toBe(COPY.remindersChip(4));
    await click(bubble);
    const s = sheet(host)!;
    const sections = [...s.querySelectorAll<HTMLElement>("[data-checklist-section]")].map((x) => x.dataset.checklistSection);
    // The title says "This week, then N to check": the sections follow it (trust minor 6).
    expect(sections).toEqual(["this-week", "to-check", "waiting-on-you", "reminders"]);
    expect([...s.querySelectorAll<HTMLElement>('[data-checklist-section="to-check"] [data-open-stop]')].map((b) => b.dataset.openStop)).toEqual(board.toCheck);
    expect(s.querySelectorAll('[data-checklist-section="to-check"] .journey-dot--need')).toHaveLength(board.toCheck.length);
    expect(s.querySelector('input[type="checkbox"], [role="checkbox"]')).toBeNull();
    expect(text(s.querySelector("[data-checklist-note]"))).toBe(MAP_WORDS.checklist.looking);
    expect(text(s.querySelector('[data-checklist-section="waiting-on-you"]'))).toContain(board.digest.waitingOnYou[0]!.words);
    expect(text(s.querySelector('[data-checklist-section="reminders"]'))).toContain(MAP_WORDS.reminders.count(4));
    expect(total(actions)).toBe(0);
    await click(s.querySelector(`[data-open-stop="${esc(board.toCheck[0]!)}"]`));
    expect(sheet(host)!.querySelector(`[data-stop-card="${esc(board.toCheck[0]!)}"]`)).toBeTruthy();
    expect(total(actions)).toBe(0);
  });

  it("collapses to a pill in Week, and says Back to now on another chapter", async () => {
    const { host } = await mountView();
    await click(host.querySelector('[data-level="week"]'));
    expect(host.querySelector<HTMLElement>("[data-journey-bubble]")!.dataset.journeyBubble).toBe("week");
    expect(host.querySelector(".journey-bubble--mini")).toBeTruthy();
    expect(text(host.querySelector(".journey-bubble__b1"))).toBe(COPY.thisWeekShort(board.digest.weekStopIds.length));
    await click(host.querySelector('[data-level="month"]'));
    await click(host.querySelector('[data-step="-1"]'));
    const b = host.querySelector<HTMLElement>("[data-journey-bubble]")!;
    expect(b.dataset.journeyBubble).toBe("other");
    expect(text(b.querySelector(".journey-bubble__chip"))).toBe(COPY.backToNow);
    await click(b);
    expect(title(host)).toBe("September");
  });

  it("the reminders row and a waiting-on-you item each run their one call once", async () => {
    const { host, actions } = await mountView({ dueReview: { count: 2 } });
    await click(host.querySelector("[data-journey-bubble]"));
    await click(sheet(host)!.querySelector('[data-action-id="due-review"]'));
    expect(recorded(actions)).toEqual(invocation({ name: "openDueReview" }));
    clear(actions);
    const item = board.digest.waitingOnYou[0]!;
    await click(sheet(host)!.querySelector(`[data-action-id="${esc(item.id)}"]`));
    expect(recorded(actions)).toEqual(invocation(item.call));
  });
});

describe("stop sheets", () => {
  it("every stop's sheet runs each of its labelled actions exactly once, with the model's call", async () => {
    const { host, actions } = await mountView();
    let pressed = 0;
    for (const chapter of board.chapters) {
      const dates = [...new Set(board.stops.filter((s) => s.chapterId === chapter.id).map((s) => s.date))];
      if (!dates.length) continue;
      // Turn the clock to the chapter with ‹ ›.
      for (let guard = 0; guard < 13 && title(host) !== chapter.label.split(" ")[0]; guard += 1) {
        const shown = board.chapters.find((c) => c.label.split(" ")[0] === title(host))!.id;
        await click(host.querySelector(`[data-step="${chapter.id < shown ? "-1" : "1"}"]`));
      }
      expect(title(host)).toBe(chapter.label.split(" ")[0]);
      for (const date of dates) {
        for (const stop of board.stops.filter((s) => s.date === date)) {
          await click(mark(host, date), `day mark ${date}`);
          let card = sheet(host)!.querySelector(`[data-stop-card="${esc(stop.id)}"]`);
          if (!card) { await click(sheet(host)!.querySelector(`[data-open-stop="${esc(stop.id)}"]`), `day entry ${stop.id}`); card = sheet(host)!.querySelector(`[data-stop-card="${esc(stop.id)}"]`); }
          expect(card, `card ${stop.id}`).toBeTruthy();
          expect(total(actions), "opening runs nothing").toBe(0);
          const buttons = [...card!.querySelectorAll<HTMLButtonElement>("[data-action-id]")];
          expect(buttons.map((b) => text(b)), stop.id).toEqual(stop.actions.map((a) => a.label));
          for (const [i, b] of buttons.entries()) {
            clear(actions);
            await click(b);
            expect(recorded(actions), `${stop.id} · ${b.dataset.actionId}`).toEqual(invocation(stop.actions[i]!.call));
            pressed += 1;
          }
          clear(actions);
          expect(text(card!.querySelector(".journey-card__words")), `${stop.id} status words`).not.toBe("");
          expect(card!.querySelector("[data-enter-horizon]"), "no Enter Horizon on the flat map").toBeNull();
          await click(sheet(host)!.querySelector(".journey-panel__close"), "close");
        }
      }
    }
    expect(pressed).toBeGreaterThan(100);
  }, 60_000);

  it("Escape closes a sheet and returns focus to the mark that opened it", async () => {
    const { host } = await mountView();
    const m = mark(host, "2026-09-18")!;
    m.focus();
    await click(m);
    expect(sheet(host)).toBeTruthy();
    await key(sheet(host)!, "Escape");
    await act(async () => { await Promise.resolve(); });
    expect(sheet(host)).toBeNull();
    expect(document.activeElement).toBe(mark(host, "2026-09-18"));
  });

  it("live: a stop with a place offers “Enter Horizon here”, which saves lastEnter and calls enterHorizon once", async () => {
    const scene = stubScene();
    const onBefore = vi.fn();
    const { host, actions } = await mountView({ stage: liveStage(scene.create), onBeforeEnterHorizon: onBefore });
    const withPlace = board.stops.find((s) => s.placeRef?.kind === "reserve" && s.chapterId === board.currentChapterId)!;
    await act(async () => { scene.options.onPick([withPlace.id]); });
    const enter = sheet(host)!.querySelector<HTMLButtonElement>("[data-enter-horizon]")!;
    expect(text(enter)).toBe(COPY.enterHorizon);
    await click(enter);
    expect(actions.spies.enterHorizon!.mock.calls).toEqual([[{ x: 812, y: 455 }]]);
    expect(total(actions)).toBe(1);
    expect(onBefore.mock.calls[0]![0].lastEnter).toEqual({ location: { x: 812, y: 455 }, level: "month", focusDate: withPlace.date === board.today ? null : withPlace.date });
  });
});

describe("“Which one?”", () => {
  it("a crowded pick fans out one button per candidate in date order; choosing one opens it; nothing runs", async () => {
    const scene = stubScene();
    const { host, actions } = await mountView({ stage: liveStage(scene.create) });
    const a = board.stops.find((s) => s.date === "2026-09-22")!, b = board.stops.find((s) => s.date === "2026-09-18")!;
    await act(async () => { scene.options.onPick([a.id, b.id]); });
    const fan = host.querySelector("[data-journey-fan]")!;
    expect(fan.getAttribute("aria-label")).toBe(COPY.whichOne);
    expect([...fan.querySelectorAll<HTMLElement>("[data-fan-option]")].map((o) => o.dataset.fanOption)).toEqual([b.id, a.id]);
    expect(document.activeElement).toBe(fan.querySelector("[data-fan-option]"));
    await click(fan.querySelector(`[data-fan-option="${esc(a.id)}"]`));
    expect(host.querySelector("[data-journey-fan]")).toBeNull();
    expect(sheet(host)!.querySelector(`[data-stop-card="${esc(a.id)}"]`)).toBeTruthy();
    expect(total(actions)).toBe(0);
    await act(async () => { scene.options.onPick([a.id, b.id]); });
    await key(host.querySelector("[data-journey-fan] button")!, "Escape");
    expect(host.querySelector("[data-journey-fan]")).toBeNull();
  });
});

describe("the “+” dial", () => {
  it("maps its three verbs to the Add flows: purchase → expense, Mark paid… → bill, income → income", async () => {
    const { host, actions } = await mountView();
    const plus = host.querySelector<HTMLButtonElement>("[data-journey-plus]")!;
    expect(plus.getAttribute("aria-label")).toBe(COPY.add);
    const expectations: [string, ActionCall][] = [["purchase", { name: "openRecord", mode: "expense" }], ["paid", { name: "openRecord", mode: "bill" }], ["income", { name: "openRecord", mode: "income" }]];
    for (const [verb, call] of expectations) {
      await click(plus);
      expect(plus.getAttribute("aria-expanded")).toBe("true");
      expect(host.querySelector("[data-journey-scrim]")).toBeTruthy();
      clear(actions);
      await click(host.querySelector(`[data-dial-verb="${verb}"]`));
      expect(recorded(actions)).toEqual(invocation(call));
      expect(host.querySelector("[data-journey-radial]")).toBeNull();
    }
    await click(plus);
    expect([...host.querySelectorAll(".journey-petal__label")].map(text)).toEqual([COPY.recordPurchase, COPY.markPaid, COPY.recordIncome]);
    await key(host.querySelector("[data-dial-verb]")!, "Escape");
    expect(host.querySelector("[data-journey-radial]")).toBeNull();
    expect(document.activeElement).toBe(plus);
  });

  it("Open chips: Calendar, Books, Kitchen table always; Simple view / All tools only when supplied; Enter Horizon only live", async () => {
    const bare = await mountView();
    await click(bare.host.querySelector("[data-journey-plus]"));
    expect([...bare.host.querySelectorAll<HTMLElement>("[data-dial-chip]")].map((c) => c.dataset.dialChip)).toEqual(["calendar", "books", "kitchen"]);
    const always: [string, ActionCall][] = [["calendar", { name: "openCalendar", date: FIXTURE_TODAY }], ["books", { name: "openBooks", ref: { kind: "register" } }], ["kitchen", { name: "openPlace", target: "plan-studio" }]];
    for (const [chip, call] of always) {
      if (!bare.host.querySelector("[data-journey-radial]")) await click(bare.host.querySelector("[data-journey-plus]"));
      clear(bare.actions);
      await click(bare.host.querySelector(`[data-dial-chip="${chip}"]`));
      expect(recorded(bare.actions), chip).toEqual(invocation(call));
    }
    const scene = stubScene();
    const full = await mountView({ optional: true, stage: liveStage(scene.create) });
    await click(full.host.querySelector("[data-journey-plus]"));
    expect([...full.host.querySelectorAll<HTMLElement>("[data-dial-chip]")].map((c) => c.dataset.dialChip)).toEqual(["calendar", "books", "kitchen", "simple", "all-tools", "enter-horizon"]);
    expect([...full.host.querySelectorAll("[data-dial-chip]")].map(text)).toEqual([COPY.chipCalendar, COPY.chipBooks, COPY.chipKitchen, COPY.chipSimple, COPY.chipAllTools, COPY.enterHorizonChip]);
    for (const [chip, name] of [["simple", "chooseSimpleView"], ["all-tools", "openAllTools"]] as const) {
      if (!full.host.querySelector("[data-journey-radial]")) await click(full.host.querySelector("[data-journey-plus]"));
      clear(full.actions);
      await click(full.host.querySelector(`[data-dial-chip="${chip}"]`));
      expect(recorded(full.actions)).toEqual([[name, []]]);
    }
    await click(full.host.querySelector("[data-journey-plus]"));
    clear(full.actions);
    await click(full.host.querySelector('[data-dial-chip="enter-horizon"]'));
    expect(full.actions.spies.enterHorizon!.mock.calls).toEqual([[{ x: 1234, y: 568 }]]);
    expect(total(full.actions)).toBe(1);
    expect(dialItems(spyActions(), FIXTURE_TODAY, false).chips.map((c) => c.id)).toEqual(["calendar", "books", "kitchen"]);
  });
});

describe("the list", () => {
  it("Month: strip apart, Needs you first, then days with a sticky Today divider; income prints with +; same actions", async () => {
    const { host, actions } = await mountView();
    await click(host.querySelector('[data-list-mode="list"]'));
    expect(total(actions)).toBe(0);
    const list = host.querySelector<HTMLElement>("[data-journey-list]")!;
    expect(list.dataset.journeyList).toBe("month");
    const strip = list.querySelector("[data-list-strip]")!;
    expect(text(strip.querySelector('[data-strip="in"] dt'))).toBe(MAP_WORDS.strip.inBooks);
    expect(text(strip.querySelector('[data-strip="fund"] dt'))).toBe(MAP_WORDS.strip.toFund);
    expect(text(strip.querySelector('[data-strip="needs-you"] dd'))).toBe(String(board.stops.filter((s) => s.chapterId === "2026-09" && board.toCheck.includes(s.id)).length));
    const groups = [...list.querySelectorAll<HTMLElement>("[data-group-id]")];
    expect(groups[0]!.dataset.groupId).toBe("needs-you");
    const days = groups.slice(1).map((g) => g.dataset.groupId!);
    expect(days).toEqual([...days].sort());
    const today = list.querySelector<HTMLElement>('[data-day-divider="today"]')!;
    expect(text(today)).toBe("Today · Mon 28 Sep");
    expect(CSS).toMatch(/\.journey-day--today \{[^}]*position: sticky;/);
    const pay = board.stops.find((s) => s.kind === "income" && s.chapterId === "2026-09" && typeof s.amountCents === "number")!;
    expect(text(host.querySelector(`#${journeyRowDomId(pay.id)} .journey-row__amount`))).toMatch(/^\+\$/);
    const bill = board.toCheck.find((id) => id.includes("2026-09"))!;
    expect(text(host.querySelector(`#${journeyRowDomId(bill)} .journey-row__amount`))).toMatch(/^\$/);
    const stop = board.stops.find((s) => s.id === bill)!;
    const buttons = [...host.querySelectorAll<HTMLButtonElement>(`#${journeyRowDomId(bill)} [data-action-id]`)];
    expect(buttons.map(text)).toEqual(stop.actions.map((a) => a.label));
    for (const [i, b] of buttons.entries()) { clear(actions); await click(b); expect(recorded(actions)).toEqual(invocation(stop.actions[i]!.call)); }
    clear(actions);
    await click(host.querySelector(`#${journeyRowDomId(bill)} [data-open-stop]`));
    expect(host.querySelector("[data-journey-list]")).toBeNull();
    expect(sheet(host)!.querySelector(`[data-stop-card="${esc(bill)}"]`)).toBeTruthy();
    expect(total(actions)).toBe(0);
  });

  it("Week: the pinned Needs-you group first, then all seven days (an empty day says so)", async () => {
    const { host } = await mountView();
    await click(host.querySelector('[data-level="week"]'));
    await click(host.querySelector('[data-list-mode="list"]'));
    const groups = [...host.querySelectorAll<HTMLElement>("[data-group-id]")].map((g) => g.dataset.groupId);
    expect(groups).toEqual(["needs-you", ...board.week.days.map((d) => `day:${d.date}`)]);
    expect(text(host.querySelector('[data-group-id="day:2026-09-29"]'))).toContain(MAP_WORDS.nothingOnThisDay);
  });
});

describe("level pull, Key, marks and keyboard", () => {
  it("Year · Month · Week: the words drive the level; Year shows twelve minis; a mini dives to its month", async () => {
    const scene = stubScene();
    const { host, actions } = await mountView({ stage: liveStage(scene.create), reducedMotion: false });
    await click(host.querySelector('[data-level="week"]'));
    expect(title(host)).toBe(COPY.thisWeek);
    expect(scene.calls.filter((c) => c.name === "setLevel").at(-1)!.args).toEqual([LEVEL_T.week, true]);
    await click(host.querySelector('[data-level="year"]'));
    expect(host.querySelectorAll('.journey-mark[data-mark-kind="chapter"]')).toHaveLength(12);
    expect(host.querySelector('[data-level="year"]')!.getAttribute("aria-current")).toBe("true");
    await click(mark(host, "2026-03"), "March mini");
    expect(title(host)).toBe("March");
    expect(host.querySelector('[data-level="month"]')!.getAttribute("aria-current")).toBe("true");
    expect(scene.calls.some((c) => c.name === "setChapter" && c.args[0] === "2026-03")).toBe(true);
    // From the canvas (pinch / wheel): a continuous t moves the pull without settling.
    await act(async () => { scene.options.onLevel(1.8, "week"); });
    expect(host.querySelector('[data-level="week"]')!.getAttribute("aria-current")).toBe("true");
    expect(total(actions)).toBe(0);
  });

  it("the Key explains the ruler of the level shown, mint/gold, solid/see-through and the honey ring — in words", async () => {
    const { host } = await mountView({ stage: liveStage(stubScene().create) });
    await click(host.querySelector("[data-key-button]"));
    const k = host.querySelector<HTMLElement>("[data-journey-key]")!;
    expect(k.dataset.journeyKey).toBe("month");
    expect(k.hasAttribute("data-key-flat")).toBe(false);
    expect(text(k)).toContain("a ring every $100.00");
    expect(text(k)).toContain("Mint = coming in · Gold = going out.");
    expect(text(k)).toContain(MAP_WORDS.stack.solid);
    expect(text(k)).toContain(MAP_WORDS.stack.seeThrough);
    expect(text(k)).toContain(MAP_WORDS.yearLegend);
    expect(k.querySelector('[data-key-row="ruler-month"]')!.classList.contains("is-current")).toBe(true);
    await click(k.querySelector(".journey-pop__x"));
    expect(host.querySelector("[data-journey-key]")).toBeNull();
  });

  it("the flat map's Key says there are no stacks in this view (UX #10), and a press on the map closes it (UX #11)", async () => {
    const { host } = await mountView();
    await click(host.querySelector("[data-key-button]"));
    const k = host.querySelector<HTMLElement>("[data-journey-key]")!;
    expect(k.hasAttribute("data-key-flat")).toBe(true);
    expect(text(k)).toContain(MAP_WORDS.flatKey);
    expect(text(k)).not.toContain("a ring every");
    // The words are true of the mounted flat map: one disc per day, no stack bars drawn anywhere in it.
    expect(host.querySelector(".journey-stage [data-stack]")).toBeNull();
    expect(host.querySelectorAll(".journey-marks--flat .journey-mark--day").length).toBeGreaterThan(0);
    await act(async () => { host.querySelector(".journey-stage")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); });
    expect(host.querySelector("[data-journey-key]")).toBeNull();
    // Selecting a mark and changing level close the header's popovers too.
    await click(host.querySelector("[data-about]"));
    expect(host.querySelector("[data-about-pane]")).toBeTruthy();
    await click(mark(host, "2026-09-18"));
    expect(host.querySelector("[data-about-pane]")).toBeNull();
    await click(host.querySelector("[data-about]"));
    await click(host.querySelector('[data-level="week"]'));
    expect(host.querySelector("[data-about-pane]")).toBeNull();
  });

  it("marks: one DOM button per day with stops (plus today, which carries the bus), Hercules; Month callouts", async () => {
    const { host } = await mountView();
    const ids = [...host.querySelectorAll<HTMLElement>(".journey-mark")].map((m) => m.dataset.markId!);
    expect(ids).toEqual(mapMarks(board, "month", "2026-09").map((m) => m.id));
    expect(ids).toContain("hercules");
    // B7: the bus stands on today's slot, so today's mark covers it — never two stacked buttons (axe target-size).
    expect(ids).not.toContain("piece");
    expect(mapMarks(board, "month", "2026-09").find((m) => m.id === FIXTURE_TODAY)!.covers).toContain("piece");
    expect([...host.querySelectorAll<HTMLElement>(".journey-callout")].map((c) => c.dataset.callout)).toEqual(["today", "next"]);
    // The next stop is set aside, not leaving; the subject is never cut mid-word.
    expect(text(host.querySelector('[data-callout="next"]'))).toContain(`${MAP_WORDS.settingAsideNext} · Winter reserve`);
    expect(CSS).not.toMatch(/\.journey-callout[^{]*\{[^}]*text-overflow: ellipsis/);
    await click(mark(host, "2026-09-18"));
    expect([...host.querySelectorAll<HTMLElement>(".journey-callout")].map((c) => c.dataset.callout)).toEqual(["today", "next", "selected"]);
    const m = mark(host, "2026-09-22")!;
    expect(m.querySelector(".journey-mark__ring")).toBeTruthy();
    expect(m.getAttribute("aria-label")).toContain(MAP_WORDS.checklist.toCheck);
  });

  it("keyboard: ←/→ move a day, PgUp/PgDn a chapter, Home back to now, Enter opens, Escape closes", async () => {
    const { host, actions } = await mountView();
    const stageEl = host.querySelector<HTMLElement>(".journey-stage")!;
    stageEl.focus();
    await key(stageEl, "ArrowRight");
    expect(text(host.querySelector("[data-journey-live]"))).toContain("Tue 29 Sep");
    await key(stageEl, "ArrowRight");
    await key(stageEl, "ArrowRight");
    expect(title(host)).toBe("October");
    await key(stageEl, "PageUp");
    expect(title(host)).toBe("September");
    await key(stageEl, "PageUp");
    expect(title(host)).toBe("August");
    await key(stageEl, "Home");
    expect(title(host)).toBe("September");
    await key(stageEl, "Enter");
    expect(sheet(host)).toBeTruthy();
    await key(sheet(host)!, "Escape");
    expect(sheet(host)).toBeNull();
    expect(total(actions)).toBe(0);
  });
});

describe("touch targets, motion and themes", () => {
  it("every control is ≥ 44 px by its class (declared in the CSS)", async () => {
    const { host } = await mountView({ dueReview: { count: 1 } });
    await click(host.querySelector("[data-journey-bubble]"));
    await click(host.querySelector("[data-key-button]"));
    await click(host.querySelector("[data-about]"));
    const sized = [".journey-toy", ".journey-pull__lv", ".journey-toggle__option", ".journey-action", ".journey-plus", ".journey-row__main", ".journey-panel__close", ".journey-bubble", ".journey-petal", ".journey-panel__stop", ".journey-panel__back", ".journey-alternative__pick"];
    for (const sel of sized) {
      const rule = new RegExp(`${sel.replace(/[.]/g, "\\.")} \\{[^}]*(min-height: (4[4-9]|[5-9]\\d)px|height: (4[4-9]|[5-9]\\d)px)`);
      expect(CSS, sel).toMatch(rule);
    }
    // Day marks: 44 px, shrunk only to the spacing between neighbouring marks, never below 24 px (WCAG 2.5.8, UX #12).
    expect(CSS).toMatch(/\.journey-mark \{[^}]*--mark: 44px;[^}]*width: var\(--mark\); height: var\(--mark\)/);
    const buttons = [...host.querySelectorAll<HTMLElement>("button")];
    expect(buttons.length).toBeGreaterThan(20);
    expect(buttons.filter((b) => !sized.some((sel) => b.matches(sel)) && !b.matches(".journey-mark")).map((b) => b.className)).toEqual([]);
    expect(CSS).toMatch(/\.journey-pull__slider \{[^}]*height: 44px/);
  });

  it("reduced motion: the still class, the slider cuts to a rest, and the CSS drops every transition", async () => {
    const still = await mountView({ reducedMotion: true });
    expect(still.host.querySelector(".journey-board")!.classList.contains("journey-board--still")).toBe(true);
    expect(still.host.querySelector(".journey-board--animated")).toBeNull();
    const slider = still.host.querySelector<HTMLInputElement>("[data-level-slider]")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "1.7");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(still.host.querySelector('[data-level="week"]')!.getAttribute("aria-current")).toBe("true");
    expect(slider.value).toBe("2.00");
    const moving = await mountView({ reducedMotion: false });
    expect(moving.host.querySelector(".journey-board--animated")).toBeTruthy();
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none !important/);
    expect(CSS).toMatch(/\.journey-board--still \*[^{]*\{[^}]*animation: none !important/);
  });

  it("three authored themes: each class renders, and white on each deep accent, ink and soft ink on paper are AA", async () => {
    const lum = (hex: string) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    for (const theme of JOURNEY_THEMES as readonly ThemeId[]) {
      const { host } = await mountView({ theme });
      expect(host.querySelector(".journey-board")!.classList.contains(`journey-board--${theme}`)).toBe(true);
      const block = CSS.match(new RegExp(`\\.journey-board--${theme} \\{([^}]*)\\}`))![1]!;
      const v = (name: string) => block.match(new RegExp(`--${name}: (#[0-9a-f]{6})`))![1]!;
      expect(ratio("#ffffff", v("accent-deep")), `${theme} white on accent-deep`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(v("ink"), v("paper")), `${theme} ink on paper`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(v("ink-soft"), v("paper")), `${theme} soft ink on paper`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(v("ink-soft"), v("paper-2")), `${theme} soft ink on paper-2`).toBeGreaterThanOrEqual(4.5);
    }
    expect(CSS).toMatch(/\.journey-board--newfoundland \{[^}]*--edge-pattern: repeating-linear-gradient/);
  });

  it("phone and wide compositions: the sheet docks right and the list centres at ≥ 720 px", () => {
    const at = CSS.indexOf("@media (min-width: 720px)");
    expect(CSS.slice(at)).toMatch(/\.journey-panel \{[^}]*width: 370px/);
    expect(CSS.slice(at)).toMatch(/\.journey-list \{[^}]*width: 560px/);
    expect(CSS.slice(0, at)).toMatch(/\.journey-panel \{[^}]*max-height: 62dvh/);
  });
});

describe("land states", () => {
  it("loading keeps the clock and every mark, says so, and waits for the 3D map before onReady", async () => {
    const onReady = vi.fn();
    const { host } = await mountView({ stage: flatStage({ status: "loading", awaiting3d: true }), onReady });
    expect(text(host.querySelector('[data-land-note="loading"]'))).toBe(COPY.loadingMap);
    expect(host.querySelectorAll(".journey-mark").length).toBeGreaterThan(5);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("failed: the map says it could not be drawn; the clock, the marks and the list still work; onReady once", async () => {
    const onReady = vi.fn();
    const { host, rerender, props } = await mountView({ stage: flatStage({ status: "failed" }), onReady });
    expect(text(host.querySelector('[data-land-note="failed"]'))).toBe(COPY.mapUnavailable);
    await click(mark(host, "2026-09-18"));
    expect(sheet(host)).toBeTruthy();
    await rerender(createElement(JourneyBoardView, { ...props }));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("an empty household: an honest empty map and list, no invented stops", async () => {
    const empty = emptyBoardHousehold();
    const eb = deriveJourneyBoard(empty, BIANCA, FIXTURE_TODAY);
    const { host } = await mountView({ board: eb, listOf: (scope) => listView(empty, eb, scope) });
    expect(text(host.querySelector("[data-journey-empty]"))).toContain(COPY.emptyTitle);
    expect(host.querySelector("[data-journey-bubble]")).toBeNull();
    expect(host.querySelectorAll('.journey-mark[data-mark-kind="day"]')).toHaveLength(1);
    await click(host.querySelector('[data-list-mode="list"]'));
    expect(text(host.querySelector("[data-list-empty]"))).toBe(MAP_WORDS.emptyMonth);
    expect(host.querySelectorAll(".journey-row")).toHaveLength(0);
  });

  it("live: one scene per land, every setter pushed, onReady from the first frame only", async () => {
    const scene = stubScene();
    const onReady = vi.fn();
    const { host } = await mountView({ stage: liveStage(scene.create), onReady, theme: "classic" });
    expect(scene.calls.filter((c) => c.name === "create")).toHaveLength(1);
    expect(scene.calls[0]!.args).toEqual([LEVEL_T.month, "2026-09", "classic", true]);
    expect(host.querySelector(".journey-stage__canvas")!.getAttribute("aria-hidden")).toBe("true");
    expect(onReady).not.toHaveBeenCalled();
    await act(async () => { scene.options.onReady(); scene.options.onReady(); });
    expect(onReady).toHaveBeenCalledTimes(1);
    await act(async () => { scene.options.onAnchors([{ id: "2026-09-18", x: 120, y: 200, depth: 1, visible: true }]); });
    expect(mark(host, "2026-09-18")!.hidden).toBe(false);
    expect(mark(host, "2026-09-18")!.style.transform).toBe("translate(120.0px, 200.0px)");
    expect(mark(host, "2026-09-22")!.hidden).toBe(true);
    await click(host.querySelector('[data-step="1"]'));
    expect(scene.calls.filter((c) => c.name === "setChapter").at(-1)!.args).toEqual(["2026-10", 1, false]);
  });
});

describe("view state v2", () => {
  const identity = { environment: "development" as const, householdId: "HH-test", memberId: BIANCA };
  const memory = () => { const m = new Map<string, string>(); return { m, storage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear(), key: () => null, length: 0 } as Storage }; };

  it("migrates a v1 record once (sky → year, region → month, stop → week) and writes only v2", () => {
    const { m, storage } = memory();
    m.set(journeyViewStateKeyV1(identity), JSON.stringify({ version: 1, tier: "stop", focusDate: "2026-09-18", target: { x: 1, y: 2 }, selectedStopId: "bill:x", expandedClusterId: "cluster:y", listMode: "list", pieceLook: "cat", lastEnter: { location: { host: "kitty" }, tier: "sky", focusDate: null } }));
    const state = readJourneyViewState(identity, storage);
    expect(state).toEqual({ version: 2, level: "week", focusDate: "2026-09-18", selectedStopId: "bill:x", listMode: "list", lastEnter: { location: { host: "kitty" }, level: "year", focusDate: null } });
    expect(writeJourneyViewState(identity, { ...state, level: "month" }, storage)).toBe(true);
    expect(JSON.parse(m.get(journeyViewStateKeyV2(identity))!)).toMatchObject({ version: 2, level: "month" });
    expect(readJourneyViewState(identity, storage).level).toBe("month");
    for (const tier of ["sky", "region"] as const) {
      const fresh = memory();
      fresh.m.set(journeyViewStateKeyV1(identity), JSON.stringify({ version: 1, tier }));
      expect(readJourneyViewState(identity, fresh.storage).level).toBe(tier === "sky" ? "year" : "month");
    }
  });

  it("an invalid or throwing storage is the default; a bad v2 field is defaulted", () => {
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    expect(readJourneyViewState(identity, throwing)).toEqual(DEFAULT_JOURNEY_VIEW_STATE_V2);
    expect(writeJourneyViewState(identity, DEFAULT_JOURNEY_VIEW_STATE_V2, throwing)).toBe(false);
    expect(readJourneyViewState(identity, null)).toEqual(DEFAULT_JOURNEY_VIEW_STATE_V2);
    expect(parseJourneyViewStateV2({ version: 2, level: "decade", focusDate: "soon", listMode: "grid" })).toEqual(DEFAULT_JOURNEY_VIEW_STATE_V2);
  });

  it("the entry restores a migrated v1 Week and renders the flat map with no scene factory and a failed land", async () => {
    const { m, storage } = memory();
    const id = { environment: "development" as const, householdId: household.householdId, memberId: BIANCA };
    m.set(journeyViewStateKeyV1(id), JSON.stringify({ version: 1, tier: "stop", focusDate: null, listMode: "map" }));
    const onReady = vi.fn();
    const actions = spyActions();
    const { host } = await mount(createElement(JourneyBoardEntry, {
      household, memberId: BIANCA, environment: "development", today: FIXTURE_TODAY, theme: "newfoundland", actions, onReady,
      quality: "full", createScene: null, loadLand: () => Promise.reject(new Error("offline")), storage,
    }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(host.querySelector(".journey-stage")!.getAttribute("data-stage-mode")).toBe("flat");
    expect(title(host)).toBe(COPY.thisWeek);
    expect(host.querySelector(".journey-board--newfoundland")).toBeTruthy();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(total(actions)).toBe(0);
  });
});

describe("Horizon Clock fix pass (FIX-B): Week, Year, list, dial, keys", () => {
  it("Week: ONE callout at rest (Today); the next stop's callout only when its day is selected (UX #4)", async () => {
    const { host } = await mountView();
    await click(host.querySelector('[data-level="week"]'));
    expect([...host.querySelectorAll<HTMLElement>(".journey-callout")].map((c) => c.dataset.callout)).toEqual(["today"]);
    const marks = mapMarks(board, "week", board.currentChapterId);
    const next = board.stops.find((s) => s.id === board.digest.nextLeavingStopId)!;
    expect(callouts(board, marks, new Map(), next.date, "week").map((c) => c.kind)).toEqual(["today", "next"]);
    expect(callouts(board, marks, new Map(), null, "week").map((c) => c.kind)).toEqual(["today"]);
    // Each day's tag is printed on its tile: "WED 30 · $300", today "MON 28 · TODAY", an empty day its day only.
    const plate = (date: string) => text(host.querySelector(`#${journeyMarkDomId(date)} .journey-mark__plate`));
    expect(plate(next.date)).toBe("WED 30 · $300");
    expect(plate(FIXTURE_TODAY)).toBe("MON 28 · TODAY");
    expect(plate("2026-09-29")).toBe("TUE 29");
    expect(host.querySelector(`#${journeyMarkDomId("2026-09-29")}`)!.classList.contains("journey-mark--stone")).toBe(true);
  });

  it("Year: the header names the year; two-line plates on every mini; the open month is outlined; a persistent caption", async () => {
    const { host } = await mountView();
    await click(host.querySelector('[data-level="year"]'));
    expect(title(host)).toBe("2026");
    expect(text(host.querySelector("[data-chapter-title] span"))).toContain("September");
    expect(text(host.querySelector("[data-journey-year-caption]"))).toContain(MAP_WORDS.yearCaption);
    const sep = host.querySelector(`#${journeyMarkDomId("2026-09")}`)!;
    const y9 = board.year.find((y) => y.chapterId === "2026-09")!;
    expect(sep.classList.contains("is-focused")).toBe(true);
    expect(text(sep.querySelector(".journey-mark__plate"))).toContain(`Sep · ${MAP_WORDS.toCheckCount(y9.toCheck)}`);
    // The open month spells its figures out: recorded and not recorded printed apart, never summed.
    expect(text(sep.querySelector(".journey-mark__plate small"))).toBe([y9.outRecordedCents ? `${tagMoney(y9.outRecordedCents)} ${MAP_WORDS.stack.solid}` : null, y9.outOpenCents ? `${tagMoney(y9.outOpenCents)} ${MAP_WORDS.stack.seeThrough}` : null].filter(Boolean).join(" · "));
    const empty = board.year.find((y) => !board.stops.some((s) => s.chapterId === y.chapterId))!;
    expect(text(host.querySelector(`#${journeyMarkDomId(empty.chapterId)} .journey-mark__plate small`))).toBe(COPY.plateNothing);
    // Every other mini with a stack prints its figure with the caption's glyphs (● recorded, ○ not recorded).
    for (const y of board.year.filter((x) => x.chapterId !== "2026-09" && (x.outRecordedCents || x.outOpenCents))) {
      const small = text(host.querySelector(`#${journeyMarkDomId(y.chapterId)} .journey-mark__plate small`));
      if (y.outRecordedCents) expect(small, y.chapterId).toContain(`● ${tagMoney(y.outRecordedCents)}`);
      if (y.outOpenCents) expect(small, y.chapterId).toContain(`○ ${tagMoney(y.outOpenCents)}`);
    }
    // ‹ › at Year move the outline (the month that will open), and nothing runs.
    await click(host.querySelector('[data-step="1"]'));
    expect(host.querySelector(`#${journeyMarkDomId("2026-10")}`)!.classList.contains("is-focused")).toBe(true);
    // Year has no bubble: the header carries the count chip that opens the checklist (trust M2 / minor 7).
    expect(host.querySelector("[data-journey-bubble]")).toBeNull();
    await click(host.querySelector("[data-journey-count-chip]"));
    expect(sheet(host)!.classList.contains("journey-panel--checklist")).toBe(true);
  });

  it("the slider steps one level per arrow key, Home / End to Year / Week (UX #3)", async () => {
    expect(levelForKey("ArrowRight", "month")).toBe("week");
    expect(levelForKey("ArrowLeft", "month")).toBe("year");
    expect(levelForKey("ArrowLeft", "year")).toBe("year");
    expect(levelForKey("End", "year")).toBe("week");
    expect(levelForKey("a", "year")).toBeNull();
    const { host } = await mountView();
    const slider = host.querySelector<HTMLInputElement>("[data-level-slider]")!;
    await key(slider, "ArrowRight");
    expect(host.querySelector('[data-level="week"]')!.getAttribute("aria-current")).toBe("true");
    await key(slider, "ArrowLeft");
    await key(slider, "ArrowLeft");
    expect(host.querySelector('[data-level="year"]')!.getAttribute("aria-current")).toBe("true");
  });

  it("the list shows Waiting on you and Repeating reminders with their own buttons; the count chip stands in the header (trust M2)", async () => {
    const { host, actions } = await mountView({ dueReview: { count: 3 } });
    await click(host.querySelector('[data-list-mode="list"]'));
    const list = host.querySelector<HTMLElement>("[data-journey-list]")!;
    expect(text(list.querySelector('[data-waiting-group="waiting-on-you"]'))).toContain(MAP_WORDS.checklist.waitingOnYou);
    expect(text(list.querySelector('[data-waiting-group="reminders"]'))).toContain(MAP_WORDS.checklist.reminders);
    expect(text(host.querySelector("[data-journey-count-chip]"))).toContain(COPY.remindersChip(3));
    clear(actions);
    await click(list.querySelector('[data-action-id="due-review"]'));
    expect(recorded(actions)).toEqual(invocation({ name: "openDueReview" }));
    clear(actions);
    const item = board.digest.waitingOnYou[0]!;
    await click(list.querySelector(`[data-action-id="${esc(item.id)}"]`));
    expect(recorded(actions)).toEqual(invocation(item.call));
    // Group wrappers are not landmarks; the sticky Today divider spans the list (UX #7).
    expect(list.querySelectorAll("section[data-group-id]")).toHaveLength(0);
    expect(CSS).toMatch(/\.journey-group \{ display: contents; \}/);
    // The legend shows recorded AND expected income samples (trust minor 5).
    expect(text(list.querySelector(".journey-legend"))).toContain(MAP_WORDS.legend.inExpected);
  });

  it("the bubble never says '0 to check' alone while something waits (trust M2)", () => {
    const quiet = { ...board, toCheck: [], digest: { ...board.digest, waitingOnYou: [] } } as JourneyBoard;
    expect(needChips(quiet, { count: 2 }).map((c) => c.words)).toEqual([COPY.remindersChip(2)]);
    expect(needChips(quiet, null).map((c) => c.words)).toEqual([MAP_WORDS.toCheckCount(0)]);
  });

  it("signs come from the value: never '+-$X' (trust minor 2)", () => {
    // The model's `signedMoney` (Hearth's `formatCad`, as every figure on the map prints): the sign from the value.
    expect(signedMoney(210000)).toBe("+$2,100.00");
    expect(signedMoney(-1200)).toBe("−$12.00");
    expect(signedMoney(0)).toBe("$0.00");
  });

  it("the dial renders the App's record modes (shift, transfer) and Enter Horizon is a sentinel call only the dial runs (trust M4, minor 1)", async () => {
    const items = dialItems(spyActions(), FIXTURE_TODAY, true, ["expense", "shift", "income", "bill", "transfer"]);
    expect(items.verbs.map((v) => v.id)).toEqual(["purchase", "shift", "paid", "income", "transfer"]);
    expect(items.verbs.find((v) => v.id === "shift")!.call).toEqual({ name: "openRecord", mode: "shift" });
    expect(items.chips.find((c) => c.id === "enter-horizon")!.call).toEqual({ name: "enterHorizonCentre" });
    const { host, actions } = await mountView({ recordModes: ["expense", "shift", "income", "bill", "transfer"] });
    await click(host.querySelector("[data-journey-plus]"));
    expect(host.querySelector("[data-journey-behind]")!.hasAttribute("inert")).toBe(true);
    clear(actions);
    await click(host.querySelector('[data-dial-verb="shift"]'));
    expect(recorded(actions)).toEqual(invocation({ name: "openRecord", mode: "shift" }));
    expect(host.querySelector("[data-journey-behind]")!.hasAttribute("inert")).toBe(false);
  });

  it("Enter Horizon with no centre yet (no ground under the stage, no land frame) enters nothing — never a made-up place (trust minor 1)", async () => {
    const scene = stubScene();
    const create: CreateJourneyMapScene = (h, o) => ({ ...scene.create(h, o), groundAt: () => null });
    const noFrame = { ...fakeHandle, frame: undefined } as unknown as JourneyLandHandle;
    const { host, actions } = await mountView({ optional: true, stage: { ...liveStage(create), landHandle: noFrame } });
    await click(host.querySelector("[data-journey-plus]"));
    clear(actions);
    await click(host.querySelector('[data-dial-chip="enter-horizon"]'));
    expect(actions.spies.enterHorizon!.mock.calls).toEqual([]);
    expect(total(actions)).toBe(0);
  });

  it("theme options rove with the arrow keys (one tab stop, UX #17); 'Open the {place}' never 'Open it' (UX #20)", async () => {
    const { host } = await mountView({ onChooseTheme: vi.fn() });
    await click(host.querySelector("[data-theme-dot]"));
    const options = [...host.querySelectorAll<HTMLButtonElement>("[data-theme-option]")];
    expect(options.map((o) => o.tabIndex)).toEqual([-1, 0, -1]);
    expect(document.activeElement).toBe(options[1]);
    await key(options[1]!, "ArrowDown");
    expect(document.activeElement).toBe(options[2]);
    expect(callWordsFor({ name: "openPlace", target: "plan-studio" })).toBe("Open the kitchen table");
  });

  it("one live region (UX #18): the title, the purse and the land note are not live; Enter Horizon's busy notice speaks there", async () => {
    const { host } = await mountView({ stage: flatStage({ status: "failed" }), notice: COPY.enterHorizonBusy });
    expect(host.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(1);
    expect(text(host.querySelector("[data-journey-live]"))).toBe(COPY.mapUnavailable);
  });

  it("day mark hit sizes follow the spacing between marks, 24–44 px (UX #12)", () => {
    const marks = mapMarks(board, "month", "2026-09");
    const tight = placeMarks(marks, null, (m) => ({ x: m.date ? Number(m.date.slice(8)) * 30 : 0, y: 0 }));
    const sizes = markSizes(tight);
    expect(Math.max(...sizes.values())).toBeLessThanOrEqual(44);
    expect(Math.min(...sizes.values())).toBeGreaterThanOrEqual(24);
  });

  it("view state: a migrated v1 record is written as v2 at once, so v1 is read only once (trust minor 10)", () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear(), key: () => null, length: 0 } as Storage;
    const id = { environment: "development" as const, householdId: "HH-mig", memberId: BIANCA };
    m.set(journeyViewStateKeyV1(id), JSON.stringify({ version: 1, tier: "region", focusDate: null, listMode: "map" }));
    readJourneyViewState(id, storage);
    expect(JSON.parse(m.get(journeyViewStateKeyV2(id))!)).toMatchObject({ version: 2, level: "month" });
  });
});

describe("pure helpers", () => {
  it("compassClearance: a full-width bar is phone clearance, a floating pill is float clearance", () => {
    expect(compassClearance({ left: 0, right: 390, top: 743, bottom: 844 }, { width: 390, height: 844 })).toEqual({ phone: 101, float: null });
    expect(compassClearance({ left: 400, right: 700, top: 700, bottom: 760 }, { width: 1100, height: 800 })).toEqual({ phone: null, float: 100 });
    expect(compassClearance(null, { width: 390, height: 844 })).toEqual({ phone: null, float: null });
  });
  it("runJourneyAction is the one dispatcher (sanity)", () => {
    const a = spyActions();
    runJourneyAction(a, { name: "openBillPaid", recurrenceId: "R" });
    expect(recorded(a)).toEqual([["openBillPaid", ["R"]]]);
  });
});
