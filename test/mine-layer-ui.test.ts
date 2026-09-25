// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import { addGoal } from "../src/core/commands.ts";
import { saveTask, type TaskInput } from "../src/core/tasks.ts";
import type { Household } from "../src/core/types.ts";
import type { ProjectedRect } from "../src/harbour/scene/runtime.ts";
import { MineLayer, MINE_COURT_ANCHORS, MINE_STAKES_SHOWN } from "../src/harbour/mine/MineLayer.tsx";
import { MineRibbon } from "../src/harbour/mine/MineRibbon.tsx";
import { mineLayer } from "../src/harbour/mine/mineLayer.ts";
import { harbourOwnsRoute, harbourPlaceFor } from "../src/harbour/flag.ts";
import { houseTabForRoute, houseTargetRoute } from "../src/house/navigation.ts";
import type { HouseRoute } from "../src/hearthside/houseRoutes.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Fictional two-member household (Bianca MEM-001, Jonathan MEM-002). */
const B = "MEM-001", J = "MEM-002", TODAY = "2026-09-15";
const draft = (patch: Partial<TaskInput["task"]> = {}): TaskInput["task"] => ({
  visibility: "personal", title: "Fictional step", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none",
  assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
});
function fixture(steps = 3): Household {
  let h = catalogHousehold();
  for (let i = 0; i < steps; i += 1) h = saveTask(h, { memberId: B, id: `TASK-b${i}`, expectedRevision: 0, task: draft({ title: `Fictional: my step ${i}`, doDate: `2026-09-${String(16 + i).padStart(2, "0")}` }) }).household;
  h = saveTask(h, { memberId: B, id: "TASK-money", expectedRevision: 0, task: draft({ title: "Fictional: new boots", expectedAmountCents: 15_500, dueDate: "2026-09-10" }) }).household;
  h = saveTask(h, { memberId: J, id: "TASK-j", expectedRevision: 0, task: draft({ title: "PARTNER SECRET" }) }).household;
  h = addGoal(h, { name: "Fictional canoe", target: 1200, shared: false, ownerMemberId: B }).household;
  h = addGoal(h, { name: "PARTNER BANK", target: 300, shared: false, ownerMemberId: J }).household;
  return h;
}
const rect = (id: string, x: number, y: number): ProjectedRect => ({ id, kind: "anchor", group: "court", label: id, x, y, w: 60, h: 60, visible: true });
const courtRects = [rect(MINE_COURT_ANCHORS.steps, 300, 200), rect(MINE_COURT_ANCHORS.banks, 100, 260)];

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
const render = (node: ReturnType<typeof createElement>) => act(async () => { root.render(node); });
const buttons = () => [...host.querySelectorAll<HTMLButtonElement>("button")];
const nameOf = (button: HTMLElement) => (button.textContent ?? "").replace(/\s+/g, " ").trim();

describe("the Mine ribbon", () => {
  it("appears only in Mine, top-left, and says Showing Mine after it appears (empty at load)", async () => {
    vi.useFakeTimers();
    await render(createElement(MineRibbon, { space: "ours" }));
    expect(host.querySelector("[data-mine-ribbon]")).toBeNull();
    expect(host.querySelector('[role="status"]')!.textContent).toBe("");
    await render(createElement(MineRibbon, { space: "mine" }));
    expect(host.querySelector("[data-mine-ribbon]")!.textContent).toContain("Mine");
    expect(host.querySelector('[role="status"]')!.textContent).toBe("");
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Showing Mine");
    await render(createElement(MineRibbon, { space: "ours" }));
    expect(host.querySelector("[data-mine-ribbon]")).toBeNull();
    expect(host.querySelector('[role="status"]')!.textContent).toBe("");
  });
});

describe("the Mine layer on the island", () => {
  it("stands steps at the Glasshouse door, banks at Our home's door, and a footpath trail between", async () => {
    const opened: [string, string | null][] = [];
    await render(createElement(MineLayer, { layer: mineLayer(fixture(), B, TODAY), place: "court", rects: courtRects, onOpen: (kind, id) => opened.push([kind, id]) }));
    expect(host.querySelector('[data-mine-group="steps"]')!.getAttribute("data-mine-placed")).toBe("glasshouse-door");
    expect(host.querySelector('[data-mine-group="banks"]')!.getAttribute("data-mine-placed")).toBe("home-door");
    expect(host.querySelector('[data-mine-group="footpaths"]')!.getAttribute("data-mine-placed")).toBe("trail");
    expect(host.querySelectorAll(".mine-trail__footpath")).toHaveLength(4);
    expect(host.querySelector(".mine-trail")!.getAttribute("aria-hidden")).toBe("true");
    expect(host.querySelector("[data-mine-dock]")).toBeNull();

    // The late money step comes first; its words say how it completes, never how much.
    const stakes = [...host.querySelectorAll<HTMLButtonElement>(".mine-stake")];
    expect(nameOf(stakes[0]!)).toMatch(/^Fictional: new boots, was for .*, a money step: done when your books confirm it, only you see this$/);
    await act(async () => stakes[0]!.click());
    await act(async () => host.querySelector<HTMLButtonElement>(".mine-bank")!.click());
    expect(opened[0]).toEqual(["step", "TASK-money"]);
    expect(opened[1]![0]).toBe("bank");
    expect(opened[1]![1]).toMatch(/^goal:GOAL-/);

    const text = host.textContent ?? "";
    expect(text).not.toMatch(/PARTNER|\$|155|1200|1,200/);
    expect(text).toContain("Fictional canoe");
  });

  it("gives every mark a ≥ 44 px class, a button role, and a name that starts with its visible label", async () => {
    await render(createElement(MineLayer, { layer: mineLayer(fixture(), B, TODAY), place: "court", rects: courtRects, onOpen: () => {} }));
    for (const button of buttons()) {
      expect(button.type).toBe("button");
      expect(button.className).toMatch(/mine-(stake|bank|more|trailhead|footpath)/);
      const visible = [...button.childNodes].filter((node) => !(node instanceof HTMLElement && node.classList.contains("mine-sr"))).map((node) => node.textContent ?? "").join("").trim();
      expect(nameOf(button).startsWith(visible.replace(/\s+/g, " "))).toBe(true);
      expect(button.hasAttribute("disabled")).toBe(false);
    }
    const css = readFileSync(resolve(__dirname, "../src/harbour/mine/mine.css"), "utf8");
    expect(css).toMatch(/min-height: 44px; min-width: 44px/);
    expect(css).toMatch(/touch-action: manipulation/);
    expect(css).not.toMatch(/touch-action: none/);
  });

  it("opens and closes the footpaths with the keyboard, returning focus", async () => {
    await render(createElement(MineLayer, { layer: mineLayer(fixture(), B, TODAY), place: "court", rects: courtRects, onOpen: () => {} }));
    const trailhead = host.querySelector<HTMLButtonElement>(".mine-trailhead")!;
    expect(nameOf(trailhead)).toBe("Your footpaths, only you see these");
    expect(trailhead.getAttribute("aria-expanded")).toBe("false");
    await act(async () => trailhead.click());
    expect(trailhead.getAttribute("aria-expanded")).toBe("true");
    const list = document.getElementById(trailhead.getAttribute("aria-controls")!)!;
    expect(list.hidden).toBe(false);
    expect([...list.querySelectorAll(".mine-footpath__sub")].map((n) => n.textContent)).toContain("lights when your books confirm it");
    list.querySelector<HTMLButtonElement>("button")!.focus();
    await act(async () => { list.querySelector("button")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(trailhead.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trailhead);
  });

  it("docks a group under the ribbon when its host is off screen, and says so when nothing is private", async () => {
    await render(createElement(MineLayer, { layer: mineLayer(fixture(), B, TODAY), place: "court", rects: [], onOpen: () => {} }));
    const dock = host.querySelector("[data-mine-dock]")!;
    expect([...dock.querySelectorAll("[data-mine-group]")].map((g) => g.getAttribute("data-mine-group"))).toEqual(["steps", "banks", "footpaths"]);
    expect(host.querySelector(".mine-trail")).toBeNull();
    await render(createElement(MineLayer, { layer: mineLayer(catalogHousehold(), B, TODAY), place: "court", rects: courtRects, onOpen: () => {} }));
    expect(host.textContent).toContain("Nothing of yours is on the island yet.");
    expect(buttons()).toHaveLength(0);
  });

  it("stands steps in the Glasshouse, banks on the Loft's shelf, and nothing in other places", async () => {
    const layer = mineLayer(fixture(), B, TODAY);
    await render(createElement(MineLayer, { layer, place: "glasshouse", rects: [], onOpen: () => {} }));
    expect([...host.querySelectorAll("[data-mine-group]")].map((g) => `${g.getAttribute("data-mine-group")}:${g.getAttribute("data-mine-placed")}`)).toEqual(["steps:beds"]);
    await render(createElement(MineLayer, { layer, place: "tower", rects: [], onOpen: () => {} }));
    expect([...host.querySelectorAll("[data-mine-group]")].map((g) => `${g.getAttribute("data-mine-group")}:${g.getAttribute("data-mine-placed")}`)).toEqual(["banks:shelf"]);
    expect(host.querySelector('[data-mine-group="banks"]')!.getAttribute("aria-label")).toMatch(/^Your private shelf in the Loft: your own Kitty Banks/);
    await render(createElement(MineLayer, { layer, place: "bank", rects: [], onOpen: () => {} }));
    expect(host.querySelector("[data-mine-group]")).toBeNull();
    await render(createElement(MineLayer, { layer, place: "court", rects: courtRects, onOpen: () => {}, hidden: true }));
    expect(host.innerHTML).toBe("");
  });

  it("shows five stakes and one door to all your steps", async () => {
    const opened: [string, string | null][] = [];
    await render(createElement(MineLayer, { layer: mineLayer(fixture(8), B, TODAY), place: "glasshouse", rects: [], onOpen: (kind, id) => opened.push([kind, id]) }));
    expect(host.querySelectorAll(".mine-stake")).toHaveLength(MINE_STAKES_SHOWN);
    await act(async () => buttons().find((b) => b.textContent === "All your steps")!.click());
    expect(opened).toEqual([["step", null]]);
  });
});

describe("HarbourWorld wiring (static)", () => {
  const world = readFileSync(resolve(__dirname, "../src/harbour/HarbourWorld.tsx"), "utf8");
  it("accepts space, draws the ribbon and the layer only from it, and reads the harbour as the household's", () => {
    expect(world).toMatch(/space\?: MineSpace;/);
    expect(world).toMatch(/const space: MineSpace = props\.space === "mine" \? "mine" : "ours";/);
    expect(world).toMatch(/\{space === "mine" && status === "ready" && !toolOpen && <MineLayer /);
    expect(world).toMatch(/<MineRibbon space=\{space\} \/>/);
    expect(world).toMatch(/space === "mine" \? mineLayer\(mineSource, memberId, today\) : emptyMineLayer\(memberId\)/);
    const reading = readFileSync(resolve(__dirname, "../src/harbour/data/useHarbourReading.ts"), "utf8");
    expect(reading).toMatch(/scope: "household"/);
  });
});

describe("routes in Mine (flag.ts)", () => {
  const home: HouseRoute = { room: "home", level: "middle", householdId: "HH-fictional", scope: "personal" };
  it("the harbour owns every personal room and the personal targets still resolve", () => {
    for (const [target, place, tab] of [["loft-banks", "tower", "home"], ["planner", "glasshouse", "planner"], ["books", "library", "ledger"], ["calendar", "glasshouse", "calendar"], ["plan-studio", "kitchen", "plan"], ["pottery", "kiln", "play"], ["wishes", "boathouse", "play"]] as const) {
      const route = houseTargetRoute(home, target);
      expect(harbourOwnsRoute(route, "personal", true), target).toBe(true);
      expect(harbourPlaceFor(route, "personal", true), target).toBe(place);
      expect(houseTabForRoute(route), target).toBe(tab);
    }
    // Targets with no house place keep the room they were opened from, and their own tab.
    expect(houseTabForRoute(houseTargetRoute(home, "shift"))).toBe("shift");
    expect(houseTabForRoute(houseTargetRoute(home, "hercules"))).toBe("hercules");
    for (const target of ["shift", "hercules", "plan", "play"]) expect(harbourOwnsRoute(houseTargetRoute(home, target), "personal", true), target).toBe(true);
    // Journey stays a Path surface in both spaces.
    expect(harbourOwnsRoute(houseTargetRoute(home, "journey"), "personal", true)).toBe(false);
  });
});

describe("retired screens (K4, D2)", () => {
  const src = resolve(__dirname, "../src");
  function importers(module: string): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) { walk(path); continue; }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        if (new RegExp(`from\\s+["'][^"']*house/${module}(\\.tsx)?["']|from\\s+["']\\./${module}(\\.tsx)?["']`).test(readFileSync(path, "utf8"))) out.push(path.slice(src.length + 1));
      }
    };
    walk(src);
    return out.sort();
  }
  it("PersonalJourney and HouseWorld are deprecated; App no longer mounts Personal Journey, and HouseWorld only for Ours (or without the harbour)", () => {
    for (const module of ["PersonalJourney", "HouseWorld"]) {
      const source = readFileSync(join(src, "house", `${module}.tsx`), "utf8");
      expect(source.slice(0, 200)).toMatch(/@deprecated/);
    }
    // The integrator's wiring (Wave 2): the personal Journey island is retired from the App; the module waits for Wave 2b's deletion.
    expect(importers("PersonalJourney")).toEqual([]);
    expect(importers("HouseWorld")).toEqual(["App.tsx"]);
    expect(readFileSync(join(src, "App.tsx"), "utf8")).toMatch(/\(!HARBOUR_ENABLED\|\|view==="household"\)\?<HouseWorld /);
  });
});
