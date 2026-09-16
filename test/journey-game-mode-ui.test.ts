// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addGoal, postEntry, type CommitResult, type Household } from "../src/core/index.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { OurPathWorld, type JourneyMiniSlotArgs } from "../src/path/OurPathWorld.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";

// Game mode (D-285). jsdom has no WebGL: the fake world records what the page asks of it, and hands the page its
// onLevel / onPick callbacks so the tests can move the camera and pick places as the world would.
type Options = { quality?: string; onLevel?: (level: 0 | 1 | 2 | 3) => void; onPick?: (id: string) => void };
const names = ["setScene", "resize", "setAmbient", "setQuality", "sleep", "wake", "refresh", "focus", "focusMonth", "setLevel", "zoom", "turn", "stats", "dispose", "setSafeArea"] as const;
type FakeWorld = Record<(typeof names)[number], ReturnType<typeof vi.fn>>;
const created = vi.hoisted(() => ({ mode: "fake" as "throw" | "fake", options: [] as Options[], worlds: [] as unknown[] }));
vi.mock("../src/path/world/pathWorld3d.ts", () => ({
  createPathWorld: (_host: HTMLElement, options: Options) => {
    if (created.mode === "throw") throw new Error("WebGL unavailable");
    created.options.push(options);
    const world = Object.fromEntries(["setScene", "resize", "setAmbient", "setQuality", "sleep", "wake", "refresh", "focus", "focusMonth", "setLevel", "zoom", "turn", "stats", "dispose", "setSafeArea"].map((n) => [n, vi.fn()]));
    created.worlds.push(world);
    return world;
  },
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-09-15";
let host: HTMLDivElement, root: Root, chrome: { nav: HTMLElement; header: HTMLElement };
let minis: JourneyMiniSlotArgs[] = [];
beforeEach(() => {
  localStorage.clear();
  Object.assign(created, { mode: "fake", options: [], worlds: [] });
  minis = [];
  // The App's own chrome around the page: a header before it and the bottom nav after it.
  const header = document.createElement("header"); header.className = "topbar"; header.innerHTML = "<button>Development</button>";
  const nav = document.createElement("nav"); nav.className = "nav"; nav.innerHTML = "<button>Home</button>";
  host = document.createElement("div");
  document.body.append(header, host, nav);
  chrome = { nav, header };
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); chrome.nav.remove(); chrome.header.remove();
  document.documentElement.classList.remove("path-world-fullscreen", "path-world-settled");
});

function household(): Household {
  let h = planLifeFixture("household");
  h = addGoal(h, { name: "Fictional trip to the shore", target: "2000", shared: true, ownerMemberId: "MEM-001" }).household;
  for (const date of ["2026-06-12", "2026-07-12", "2026-08-12"]) {
    h = postEntry(h, { type: "expense", date, amount: "40", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional outing", createdBy: "MEM-001", visibility: "household", confirmDuplicate: true }).household;
  }
  return h;
}
async function mount(extra: Record<string, unknown> = {}, h = household()) {
  const onCommand = async (fn: (x: Household) => CommitResult) => ({ ok: true, household: fn(h).household });
  await act(async () => root.render(createElement(OurPathWorld, {
    household: h, memberId: "MEM-001", today: TODAY, busy: false, onCommand, theme: "taylor", classicRoom: createElement("p", { id: "classic" }, "today"),
    renderMini: (args: JourneyMiniSlotArgs) => { minis.push(args); return createElement("div", { className: args.compact ? "fake-mini fake-mini--compact" : "fake-mini" }, createElement("button", { type: "button", className: "fake-mini__open", onClick: args.onOpenWorld }, "Open from the mini")); },
    ...extra,
  } as never)));
  await settle();
  return h;
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const byText = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === text);
const click = async (element: HTMLElement) => act(async () => { element.click(); });
const settle = async () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const key = async (k: string) => act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: k, cancelable: true })); });
const lastMini = (compact: boolean) => minis.filter((m) => m.compact === compact).at(-1)!;
const world = () => created.worlds.at(-1) as FakeWorld;
const options = () => created.options.at(-1)!;
const stage = () => $(".path-world__stage");
async function openWorld() {
  const opener = $<HTMLButtonElement>(".fake-mini__open");
  opener.focus();
  await click(opener);
  await settle();
}

describe("Our Path page leads with the simple view (D-285)", () => {
  it("mounts the simple view first, hands it the shared focus, and builds nothing heavy until the world opens", async () => {
    await mount();
    const slot = $("[data-slot='journey-mini']");
    expect(slot).toBeTruthy();
    // It leads the page: right after the heading, before the page bar, the world and Replay.
    expect(slot.previousElementSibling?.classList.contains("path-world__head")).toBe(true);
    expect(slot.compareDocumentPosition($(".path-world__grow")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slot.querySelector(".fake-mini")).toBeTruthy();
    expect(host.querySelector(".path-world__preview")).toBeNull();
    const args = lastMini(false);
    expect(args).toMatchObject({ memberId: "MEM-001", today: TODAY, compact: false, theme: "taylor", worldOpen: false });
    expect(args.focus.focus).toMatchObject({ level: "week", date: TODAY, selected: null });
    expect(typeof args.onOpenWorld).toBe("function");
    expect(created.worlds).toHaveLength(0);
    expect(stage().hidden).toBe(true);
    // The tent, the planner and every place stay reachable from the page.
    expect(byText("Open the Plan Studio tent")).toBeTruthy();
    expect(byText("Plan our journey")).toBeTruthy();
    expect(host.querySelectorAll(".path-world__outline button").length).toBeGreaterThan(3);
    // The quiet D-283 corner toggle opens the world too.
    const corner = $<HTMLButtonElement>("[data-slot='journey-mini'] > .path-world__full");
    expect(corner.getAttribute("aria-label")).toBe("Open the world full screen");
    expect(corner.getAttribute("aria-pressed")).toBe("false");
  });

  it("without renderMini shows a flat-map placeholder with an Open the world button", async () => {
    await mount({ renderMini: undefined });
    const slot = $("[data-slot='journey-mini']");
    expect(slot.querySelector(".path-world__preview svg")).toBeTruthy();
    const open = byText("Open the world")!;
    expect(slot.contains(open)).toBe(true);
    expect(slot.textContent).toContain("This week");
    await click(open);
    await settle();
    expect(stage().hidden).toBe(false);
    // The corner of the open world shows the flat map until the simple view is mounted.
    expect($(".path-hud__mini .path-hud__flatmini svg")).toBeTruthy();
  });
});

describe("Game mode: the open world, full screen (D-285)", () => {
  it("enters full screen with the app hidden and inert, a history entry, and focus in the HUD", async () => {
    await mount();
    await openWorld();
    expect(created.worlds).toHaveLength(1);
    expect(stage().hidden).toBe(false);
    expect(stage().getAttribute("role")).toBe("dialog");
    expect(stage().getAttribute("aria-modal")).toBe("true");
    expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(true);
    expect($(".path-world").dataset.game).toBe("open");
    // Everything behind is inert: the page around the stage, and the app's header and nav.
    for (const el of [$("[data-slot='journey-mini']"), $(".path-world__head"), $(".path-world__grow"), $(".path-world__panels"), chrome.nav, chrome.header]) {
      expect(el.closest("[inert]"), el.className).toBeTruthy();
    }
    expect(stage().closest("[inert]")).toBeNull();
    // The page bar steps aside; the HUD carries the same actions.
    expect(host.querySelector(".path-world__pagebar")).toBeNull();
    const minimize = $<HTMLButtonElement>(".path-hud__min");
    expect(document.activeElement).toBe(minimize);
    expect(minimize.getAttribute("aria-label")).toBe("Minimize the world");
    expect(minimize.getAttribute("aria-keyshortcuts")).toBe("Escape");
    expect($(".path-hud__gear").getAttribute("aria-label")).toBe("World settings");
    expect(host.querySelector(".path-hud .path-world__rail")).toBeTruthy();
    expect(byText("Where we are")).toBeTruthy();
    expect($(".path-hud .path-world__tent").getAttribute("aria-label")).toBe("Open the Plan Studio tent");
    expect($(".path-hud__caption").textContent).toContain("This week");
    // Settings stay out of the way until asked for.
    expect(host.querySelector(".path-world__lantern")).toBeNull();
    // The corner minimap is the simple view, compact, on the same focus; the page copy knows the world is open.
    expect($(".path-hud__mini[data-slot='journey-mini-compact'] .fake-mini--compact")).toBeTruthy();
    expect(lastMini(true)).toMatchObject({ compact: true, worldOpen: true });
    expect(lastMini(true).focus).toBe(lastMini(false).focus);
    expect(lastMini(false).worldOpen).toBe(true);
    // Browser back minimizes: entering pushed one entry of its own.
    expect((window.history.state as { hearthPathWorld?: string }).hearthPathWorld).toMatch(/^path-world:/);
  });

  it("closes an open card on Escape first, then minimizes, restoring the page and focus", async () => {
    const h = await mount();
    await openWorld();
    options().onPick!("goal:" + h.goals.at(-1)!.id);
    await settle();
    expect(host.querySelector(".path-world__card")).toBeTruthy();
    await key("Escape");
    expect(host.querySelector(".path-world__card")).toBeNull();
    expect(stage().hidden).toBe(false);
    await key("Escape");
    await settle();
    expect(stage().hidden).toBe(true);
    expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(false);
    expect(host.querySelector("[inert]")).toBeNull();
    expect(chrome.nav.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe($(".fake-mini__open"));
    expect(world().sleep).toHaveBeenCalled();
    expect(world().dispose).not.toHaveBeenCalled();
    expect(lastMini(false).worldOpen).toBe(false);
    // Minimizing popped the world's history entry.
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect((window.history.state as { hearthPathWorld?: string } | null)?.hearthPathWorld).toBeUndefined();
    // Opening again reuses the sleeping world.
    await openWorld();
    expect(created.worlds).toHaveLength(1);
    expect(world().wake).toHaveBeenCalledTimes(2);
  });

  it("minimizes on the browser's back gesture and from the minimize button", async () => {
    await mount();
    await openWorld();
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 30));
    });
    await settle();
    expect(stage().hidden).toBe(true);
    await openWorld();
    await click($(".path-hud__min"));
    await settle();
    expect(stage().hidden).toBe(true);
    expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(false);
  });

  it("leaves the open world for the tent and the planner, which open on the page", async () => {
    await mount();
    await openWorld();
    await click($(".path-hud .path-world__tent"));
    expect(stage().hidden).toBe(true);
    expect($(".path-world__room").hidden).toBe(false);
    await click(byText("Back to the island")!);
    await openWorld();
    await click($(".path-hud__gear"));
    await click($(".path-world__drawer-plan"));
    expect(stage().hidden).toBe(true);
    expect($(".path-planner")).toBeTruthy();
  });

  it("shows the flat map inside the open world when WebGL is missing", async () => {
    created.mode = "throw";
    await mount({ renderMini: undefined });
    await click(byText("Open the world")!);
    await settle();
    expect($(".path-world__stage .path-world__flat svg")).toBeTruthy();
    expect($(".path-world__host").dataset.live).toBe("false");
    expect(host.querySelector(".path-world__loading")).toBeNull();
    expect([...host.querySelectorAll<HTMLButtonElement>(".path-world__rail button")].every((b) => b.disabled)).toBe(true);
    expect(host.querySelector(".path-hud__mini")).toBeNull();
  });
});

describe("One focus for the simple view and the open world (D-285)", () => {
  it("moves the world when the simple view moves, month by month, and keeps Replay on the same month", async () => {
    const h = await mount();
    const months = pathMonths(h, TODAY);
    expect(months.length).toBeGreaterThan(2);
    const june = months.findIndex((m) => m.key === "2026-06");
    expect(june).toBeGreaterThanOrEqual(0);
    await openWorld();
    // On opening, the world travels to the focus: this week, up close, at "now".
    expect(world().focus).toHaveBeenLastCalledWith("now", 3);
    // The simple view scrolls to June: the world flies to June's stop, and Replay follows.
    await act(async () => lastMini(true).focus.set({ level: "month", date: "2026-06-10" }, "mini"));
    expect(world().focusMonth).toHaveBeenLastCalledWith(june, 2);
    expect($<HTMLInputElement>(".path-world__slider input").value).toBe(String(june));
    expect($(".path-hud__caption").textContent).toContain("June 2026");
    // A bill only the simple view knows travels to its month.
    await act(async () => lastMini(true).focus.set({ level: "day", date: "2026-06-22", selected: "bill:RENT@2026-06-22" }, "mini"));
    expect(world().focusMonth).toHaveBeenLastCalledWith(june, 3);
    // The whole journey: the world's Sky.
    await act(async () => lastMini(true).focus.set({ level: "journey", selected: null }, "mini"));
    expect(world().setLevel).toHaveBeenLastCalledWith(0);
    expect($(".path-hud__caption").textContent).toContain("Journey");
    // A place the world knows: it travels there and opens its card.
    const goal = `goal:${h.goals.at(-1)!.id}`;
    await act(async () => lastMini(true).focus.set({ level: "week", date: TODAY, selected: goal }, "mini"));
    expect(world().focus).toHaveBeenLastCalledWith(goal, 3);
    expect($(".path-world__card h3").textContent).toBe("Fictional trip to the shore");
  });

  it("tells the simple view where the world went: levels once a trip lands, and picks", async () => {
    const h = await mount();
    await openWorld();
    const api = () => lastMini(false).focus;
    // The trip the page asked for (week → Up close) passes Region and Stop: those are not reported.
    options().onLevel!(1);
    options().onLevel!(2);
    await settle();
    expect(api().focus).toMatchObject({ level: "week", seq: 0 });
    options().onLevel!(3);
    await settle();
    expect(api().focus.seq).toBe(0);
    // Once landed, the person's own zoom is reported as the world's.
    options().onLevel!(2);
    await settle();
    expect(api().focus).toMatchObject({ level: "month", source: "world" });
    expect($(".path-world").dataset.level).toBe("2");
    options().onLevel!(0);
    await settle();
    expect(api().focus).toMatchObject({ level: "journey", source: "world" });
    // The rail's own trip reports only where it lands.
    const seq = api().focus.seq;
    await click(byText("Stop")!);
    expect(world().setLevel).toHaveBeenLastCalledWith(2);
    options().onLevel!(1);
    await settle();
    expect(api().focus.seq).toBe(seq);
    options().onLevel!(2);
    await settle();
    expect(api().focus).toMatchObject({ level: "month", source: "world" });
    // A pick in the world is shared in the world's vocabulary; the world is not asked to travel twice.
    const months = pathMonths(h, TODAY);
    const focusCalls = world().focus.mock.calls.length;
    options().onPick!("month:1");
    await settle();
    expect(api().focus).toMatchObject({ level: "month", selected: "month:1", date: `${months[1]!.key}-01`, source: "world" });
    expect(world().focus.mock.calls.length).toBe(focusCalls + 1);
    expect(world().focus).toHaveBeenLastCalledWith("month:1", 2);
    // World picks never regrow the island: Replay stays on now.
    expect($<HTMLInputElement>(".path-world__slider input").value).toBe(String(months.length - 1));
  });

  it("shares the page's own time moves (Replay's slider, Where we are) and applies page picks when the world opens", async () => {
    const h = await mount();
    const months = pathMonths(h, TODAY);
    const slider = $<HTMLInputElement>(".path-world__slider input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "1");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(lastMini(false).focus.focus).toMatchObject({ date: `${months[1]!.key}-01`, source: "page" });
    await click(byText("Where we are")!);
    expect(lastMini(false).focus.focus).toMatchObject({ date: TODAY, source: "page", selected: null });
    expect(slider.value).toBe(String(months.length - 1));
    // A place opened from the page's outline: its card opens on the page, and the world goes there when it opens.
    const goal = `goal:${h.goals.at(-1)!.id}`;
    await click($(`.path-world__outline button[data-place="${goal}"]`));
    expect($(".path-world__card--page")).toBeTruthy();
    expect(lastMini(false).focus.focus).toMatchObject({ selected: goal, source: "page" });
    await openWorld();
    expect(world().focus).toHaveBeenLastCalledWith(goal, 3);
    expect(host.querySelector(".path-world__card--page")).toBeNull();
    expect($(".path-world__stage .path-world__card h3").textContent).toBe("Fictional trip to the shore");
  });
});

describe("focusMonth (pathWorld3d, D-285)", () => {
  it("clamps a month index to the grown months", async () => {
    const { monthFocusIndex } = await vi.importActual<typeof import("../src/path/world/pathWorld3d.ts")>("../src/path/world/pathWorld3d.ts");
    expect(monthFocusIndex(3, 10)).toBe(3);
    expect(monthFocusIndex(14, 10)).toBe(10);
    expect(monthFocusIndex(-2, 10)).toBe(0);
    expect(monthFocusIndex(2.6, 10)).toBe(3);
    expect(monthFocusIndex(Number.NaN, 4)).toBe(4);
    expect(monthFocusIndex(5, -1)).toBe(0);
  });
});
