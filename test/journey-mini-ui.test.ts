// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openChapter, type Household } from "../src/core/index.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { saveTask, type TaskInput } from "../src/core/tasks.ts";
import { useJourneyFocus, type JourneyFocusApi } from "../src/path/journeyFocus.ts";
import { JourneyMini } from "../src/path/mini/JourneyMini.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";

// jsdom has no WebGL: by default the renderer fails and the flat map must carry everything.
// The "fake" variant hands back a stand-in renderer so the component's calls into it can be checked.
type Fake = Record<"setScene" | "setView" | "nudge" | "resize" | "setQuality" | "refresh" | "dispose" | "stats", ReturnType<typeof vi.fn>> & {
  view: ReturnType<typeof vi.fn>; daysPerPixel: ReturnType<typeof vi.fn>; pick: ReturnType<typeof vi.fn>;
};
const renderer = vi.hoisted(() => ({ mode: "throw" as "throw" | "fake", created: 0, worlds: [] as unknown[], options: [] as Record<string, unknown>[], pickId: null as string | null }));
vi.mock("../src/path/mini/miniWorld3d.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/path/mini/miniWorld3d.ts")>();
  return {
    ...real,
    createMiniWorld: (_host: HTMLElement, options: Record<string, unknown>) => {
      renderer.created += 1;
      if (renderer.mode === "throw") throw new Error("WebGL unavailable");
      renderer.options.push(options);
      const names = ["setScene", "setView", "nudge", "resize", "setQuality", "refresh", "dispose", "stats"];
      const world = Object.fromEntries(names.map((n) => [n, vi.fn()])) as unknown as Fake;
      world.view = vi.fn(() => ({ z: 1, day: 15, zTarget: 1, dayTarget: 15, days: 30 }));
      world.daysPerPixel = vi.fn(() => 0.05);
      world.pick = vi.fn(() => renderer.pickId);
      renderer.worlds.push(world);
      return world;
    },
  };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-09-15";
let host: HTMLDivElement, root: Root;
let api: JourneyFocusApi;
let opened = 0;
let harbour: unknown[] = [];
beforeEach(() => { Object.assign(renderer, { mode: "throw", created: 0, worlds: [], options: [], pickId: null }); opened = 0; harbour = []; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

function task(patch: Partial<TaskInput["task"]>): TaskInput["task"] {
  return { visibility: "household", title: "", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none", assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch } as TaskInput["task"];
}
function household(): Household {
  let h = planLifeFixture("household");
  h = openChapter(h, { memberId: "MEM-001", foundationId: "make-rent-boring", at: "2026-07-01T12:00:00.000Z" }).household;
  h = saveTask(h, { memberId: "MEM-001", id: "TASK-UI-VET", expectedRevision: 0, task: task({ title: "Fictional: book the vet", assigneeId: "MEM-002", dueDate: "2026-09-16" }) }).household;
  h = saveTask(h, { memberId: "MEM-002", id: "TASK-UI-SECRET", expectedRevision: 0, task: task({ visibility: "personal", title: "Fictional: Sam's surprise", dueDate: "2026-09-15" }) }).household;
  return h;
}
function Harness({ h, props }: { h: Household; props?: Record<string, unknown> }) {
  api = useJourneyFocus(TODAY, "day");
  return createElement(JourneyMini, { household: h, memberId: "MEM-001", today: TODAY, focus: api, theme: "taylor", onOpenWorld: () => { opened += 1; }, ...props });
}
const settle = async (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function mount(props?: Record<string, unknown>, h = household()) {
  await act(async () => root.render(createElement(Harness, { h, props })));
  await settle(20);
  await settle(150);
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const button = (name: string | RegExp) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => {
  const text = (b.getAttribute("aria-label") ?? b.textContent ?? "").trim();
  return typeof name === "string" ? text === name || b.textContent?.trim() === name : name.test(text) || name.test(b.textContent ?? "");
})!;
const click = async (el: HTMLElement) => { await act(async () => { el.click(); }); await settle(150); };
const key = async (el: HTMLElement, k: string) => { await act(async () => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }); await settle(150); };
const pressed = () => [...host.querySelectorAll(".journey-mini__levels button")].find((b) => b.getAttribute("aria-pressed") === "true")?.textContent;
const visibleLabels = () => [...host.querySelectorAll<HTMLButtonElement>(".journey-mini__label")].filter((b) => !b.hidden);

describe("JourneyMini — the journey's simple view", () => {
  it("draws the flat map without WebGL, with the lane trackers, and opens the world with the shared focus", async () => {
    await mount();
    expect(renderer.created).toBe(1);
    const section = $(".journey-mini");
    expect(section.dataset.flat).toBe("true");
    expect(section.dataset.miniTheme).toBe("taylor");
    expect($("h2").textContent).toBe("Money through the month");
    expect($(".journey-mini__sub").textContent).toContain("Tue Sep 15 · today");
    expect(pressed()).toBe("Day");
    expect($(".journey-mini__flat svg").getAttribute("aria-hidden")).toBe("true");
    // The trackers ride on their lanes: "Prepare · $…", "Protect · $… of $…", "Build · $…".
    const lanes = visibleLabels().filter((b) => b.dataset.place?.startsWith("lane:")).map((b) => b.textContent);
    expect(lanes).toEqual(expect.arrayContaining([expect.stringMatching(/^Prepare · \$/), expect.stringMatching(/^Protect · \$[\d,.]+( of \$[\d,.]+)?$/), expect.stringMatching(/^Build · \$/), expect.stringMatching(/^Everyday · \$/)]));
    expect(visibleLabels().some((b) => b.dataset.place === "today")).toBe(true);
    // Honest copy: a way of thinking, nothing moves money.
    expect(host.textContent).toContain("Nothing on this map moves money at a bank.");
    // Opening the world hands over where we are (an unchanged focus is not re-sent).
    await click(button("Week"));
    await click(button("Open the world"));
    expect(opened).toBe(1);
    expect(api.focus).toMatchObject({ level: "week", date: TODAY, source: "mini" });
  });

  it("never shows a partner's private to-do", async () => {
    await mount();
    await click(button("List"));
    expect(host.textContent).toContain("book the vet");
    expect(host.textContent).not.toContain("surprise");
  });

  it("zooms through the five levels with the scale, the keyboard and the +/− buttons, telling the world each time", async () => {
    await mount();
    await click(button("Week"));
    expect(pressed()).toBe("Week");
    expect(api.focus).toMatchObject({ level: "week", source: "mini" });
    expect($(".journey-mini__sub").textContent).toContain("Week of Sep 13–19");
    await click(button("Month"));
    expect($("h2").textContent).toBe("September"); // The still-open Chapter belongs to July.
    expect(visibleLabels().find((b) => b.dataset.place === "chapter")?.textContent).toContain("September 2026");
    await click(button("Zoom out"));
    expect(pressed()).toBe("Era");
    await click(button("Zoom out"));
    expect(pressed()).toBe("Journey");
    expect(button("Zoom out").disabled).toBe(true);
    expect($("h2").textContent).toBe("Our journey");
    const stage = $(".journey-mini__stage");
    await key(stage, "+");
    expect(pressed()).toBe("Era");
    await key(stage, "ArrowUp");
    expect(pressed()).toBe("Month");
    await key(stage, "-");
    expect(pressed()).toBe("Era");
    await key(stage, "h");
    expect(pressed()).toBe("Day");
    expect(api.focus).toMatchObject({ level: "day", date: TODAY, selected: null });
  });

  it("marks the current Chapter and only enters Harbour after an intentional extra closest zoom", async () => {
    await mount({ onEnterHarbour: (anchor: unknown) => harbour.push(anchor) });
    await act(async () => api.set({ level: "month", date: "2026-07-15" }, "world"));
    await settle(150);
    expect($("h2").textContent).toBe("July · Make Rent Boring");
    expect(visibleLabels().find((b) => b.textContent?.includes("Little Harbour"))?.textContent).toContain("current household chapter");
    await click(button("Day"));
    await click(button("Enter Harbour by zooming in"));
    expect(harbour).toEqual([expect.objectContaining({ month: "2026-07", source: "open-chapter" })]);
    await act(async () => api.set({ date: "2026-10-01" }, "world"));
    await settle(150);
    expect(button("Zoom in").disabled).toBe(true);
    expect(harbour).toHaveLength(1);
  });

  it("slides through time with the arrows and the scrubber, and says where it is", async () => {
    await mount();
    const stage = $(".journey-mini__stage");
    await key(stage, "ArrowRight");
    expect(api.focus).toMatchObject({ date: "2026-09-16", source: "mini" });
    expect($(".journey-mini__sub").textContent).toContain("Wed Sep 16");
    await click(button("Week"));
    await key(stage, "ArrowRight");
    expect(api.focus.date).toBe("2026-09-23");
    await click(button("Month"));
    await key(stage, "ArrowLeft");
    expect(api.focus.date).toBe("2026-08-23");
    expect($("h2").textContent).toMatch(/^August/);
    const slider = $<HTMLInputElement>(".journey-mini__scrub input");
    expect(slider.getAttribute("aria-valuetext")).toBe("August 2026");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, String(Number(slider.value) + 2));
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle(150);
    expect(api.focus.date.slice(0, 7)).toBe("2026-10");
    expect($(".journey-mini__sub").textContent).toContain("October 2026 · ahead");
    await click(button("Where we are"));
    expect(api.focus).toMatchObject({ level: "day", date: TODAY });
  });

  it("follows the world: a level, a date and a pick arriving from the other view", async () => {
    await mount();
    await act(async () => api.set({ level: "month", date: "2026-08-10" }, "world"));
    await settle(150);
    expect(pressed()).toBe("Month");
    expect($("h2").textContent).toMatch(/^August/);
    // The world picks this month's stone: the card here opens on it.
    const index = pathMonths(household(), TODAY).findIndex((m) => m.key === "2026-09");
    await act(async () => api.set({ selected: `month:${index}`, date: "2026-09-02" }, "world"));
    await settle(200);
    const card = $(".journey-mini__card");
    expect(card.querySelector("h3")!.textContent).toBe("September 2026");
    // Our own echo is ignored (no loop): the focus source stays the world's.
    expect(api.focus.source).toBe("world");
  });

  it("opens a small card from any label, with a door into the world and Escape back to where you were", async () => {
    await mount();
    const today = visibleLabels().find((b) => b.dataset.place === "today")!;
    today.focus();
    await click(today);
    const card = $(".journey-mini__card");
    expect(card.getAttribute("role")).toBe("dialog");
    expect(card.querySelector("h3")!.textContent).toBe("Tue Sep 15 · today");
    expect(card.textContent).toContain("Hercules is sitting here");
    expect(card.textContent).toContain("Next:");
    await click(button("Open this month in the world"));
    expect(opened).toBe(1);
    expect(api.focus).toMatchObject({ level: "month", selected: expect.stringMatching(/^month:\d+$/) });
    await act(async () => { card.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    await settle();
    expect(host.querySelector(".journey-mini__card")).toBeNull();
    expect(document.activeElement).toBe(today);
    // A lane card says what the lane is and is not.
    await click(visibleLabels().find((b) => b.dataset.place === "lane:protect")!);
    expect($(".journey-mini__card").textContent).toContain("A way of thinking about one Fund, not a bank account.");
  });

  it("has an outline at every level, and its rows open the same cards", async () => {
    await mount();
    await click(button("List"));
    const list = () => $(".journey-mini__list");
    expect(list().getAttribute("aria-label")).toBe("Day as a list");
    expect(list().textContent).toMatch(/Prepare · \$/);
    await click(button("Week"));
    expect(list().textContent).toContain("Week of Sep 13–19");
    expect(list().textContent).toContain("Tue Sep 15 · today");
    await click(button("Month"));
    expect(list().textContent).toContain("Fictional rent");
    expect(list().textContent).toContain("planned from Prepare");
    await click(button("Era"));
    expect(list().textContent).toContain("The journey so far");
    await click(button("Journey"));
    expect(list().getAttribute("aria-label")).toBe("Journey as a list");
    await click(button("Month"));
    await click([...list().querySelectorAll("button")].find((b) => /Sun Sep 20/.test(b.textContent ?? ""))!);
    expect($(".journey-mini__card h3").textContent).toBe("Sun Sep 20");
    expect(api.focus.selected).toMatch(/^bill:.+@2026-09-20$/);
  });

  it("drives the 3D renderer when WebGL is there: scene, view, wheel zoom and picking", async () => {
    renderer.mode = "fake";
    await mount();
    const world = renderer.worlds[0] as Fake;
    expect($(".journey-mini").dataset.flat).toBe("false");
    const scene = world.setScene.mock.calls.at(-1)![0];
    expect(scene).toMatchObject({ theme: "taylor", monthKey: "2026-09", anchorDay: 15, gate: "open" });
    expect(scene.days).toHaveLength(30);
    expect(scene.days.find((d: { date: string }) => d.date === "2026-09-20").bills).toEqual(["prepare"]);
    expect(scene.days.find((d: { date: string }) => d.date === "2026-09-16").tasks).toEqual([{ who: "b", done: false }]);
    expect(world.setView).toHaveBeenCalledWith(expect.objectContaining({ z: 0, day: 15 }), true);
    await click(button("Era"));
    expect(world.setView).toHaveBeenLastCalledWith(expect.objectContaining({ z: 3 }), false);
    // A trackpad's small deltas glide the zoom, then settle on a level (a nudge short of a quarter falls back).
    const stage = $(".journey-mini__stage");
    const wheel = async (deltaY: number, extra: WheelEventInit = {}) => act(async () => { stage.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true, ...extra })); });
    await wheel(12);
    expect(world.nudge).toHaveBeenCalledWith({ z: expect.closeTo(3.072, 3) });
    await settle(400);
    expect(pressed()).toBe("Era");
    for (let i = 0; i < 4; i++) await wheel(12);
    await settle(400);
    expect(pressed()).toBe("Journey");
    expect(api.focus.level).toBe("journey");
    // A mouse wheel notch is one level.
    await wheel(-100);
    await settle(50);
    expect(pressed()).toBe("Era");
    // A tap picks through the renderer.
    await click(button("Day"));
    renderer.pickId = "day:2026-09-20";
    const tap = (type: string) => { const e = new MouseEvent(type, { bubbles: true, clientX: 50, clientY: 50 }); Object.defineProperty(e, "pointerId", { value: 1 }); stage.dispatchEvent(e); };
    await act(async () => { tap("pointerdown"); tap("pointerup"); });
    await settle(50);
    expect(world.pick).toHaveBeenCalledWith(50, 50);
    expect($(".journey-mini__card h3").textContent).toBe("Sun Sep 20");
    expect(api.focus.selected).toMatch(/^bill:/);
  });

  it("keeps to the flat map at the Lite quality", async () => {
    renderer.mode = "fake";
    await mount({ quality: "lite" });
    expect(renderer.created).toBe(0);
    expect($(".journey-mini").dataset.flat).toBe("true");
  });

  it("as a corner minimap: tiny scale, no card, a pick only moves the shared focus", async () => {
    renderer.mode = "fake";
    await mount({ compact: true });
    const section = $(".journey-mini");
    expect(section.classList.contains("journey-mini--compact")).toBe(true);
    expect(section.getAttribute("aria-label")).toBe("Journey minimap");
    expect(renderer.options[0]).toMatchObject({ compact: true, quality: "low" });
    expect(host.querySelector(".journey-mini__open")).toBeNull();
    expect(host.querySelector(".journey-mini__head")).toBeNull();
    expect([...host.querySelectorAll(".journey-mini__levels button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Day", "Week", "Month", "Era", "Journey"]);
    renderer.pickId = "day:2026-09-20";
    const stage = $(".journey-mini__stage");
    const tap = (type: string) => { const e = new MouseEvent(type, { bubbles: true, clientX: 10, clientY: 10 }); Object.defineProperty(e, "pointerId", { value: 2 }); stage.dispatchEvent(e); };
    await act(async () => { tap("pointerdown"); tap("pointerup"); });
    await settle(50);
    expect(host.querySelector(".journey-mini__card")).toBeNull();
    expect(api.focus).toMatchObject({ selected: expect.stringMatching(/^bill:/), date: "2026-09-20", source: "mini" });
  });

  it("rebuilds after a lost WebGL context", async () => {
    renderer.mode = "fake";
    await mount();
    expect(renderer.created).toBe(1);
    await act(async () => { (renderer.options[0]!.onLost as () => void)(); });
    await settle(50);
    expect((renderer.worlds[0] as Fake).dispose).toHaveBeenCalled();
    expect(renderer.created).toBe(2);
  });
});
