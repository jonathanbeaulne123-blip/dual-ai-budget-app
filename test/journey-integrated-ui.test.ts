// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitResult, Household } from "../src/core/index.ts";
import { pathEras } from "../src/core/pathEras.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { OurPathWorld } from "../src/path/OurPathWorld.tsx";
import { loadMiniJourney } from "../src/path/mini/miniJourneyLoader.ts";
import { miniCad, miniFund, miniJourney } from "../src/path/mini/miniJourneyModel.ts";
import { journeyHousehold } from "./fixtures/journey-eras.ts";

// The two halves together (D-284 + D-285): OurPathWorld mounts JourneyMini by default, on the page and in the open
// world's corner. Both renderers are stand-ins (jsdom has no WebGL) that record what the page asks of them.
type Fn = ReturnType<typeof vi.fn>;
const fakes = vi.hoisted(() => ({ worlds: [] as Record<string, Fn>[], options: [] as Record<string, unknown>[], minis: [] as Record<string, Fn>[], miniOptions: [] as Record<string, unknown>[], pickId: null as string | null }));
vi.mock("../src/path/world/pathWorld3d.ts", () => ({
  createPathWorld: (_host: HTMLElement, options: Record<string, unknown>) => {
    fakes.options.push(options);
    const world = Object.fromEntries(["setScene", "resize", "setAmbient", "setQuality", "sleep", "wake", "refresh", "focus", "focusMonth", "setLevel", "zoom", "turn", "stats", "dispose", "setSafeArea"].map((n) => [n, vi.fn()]));
    fakes.worlds.push(world);
    return world;
  },
}));
vi.mock("../src/path/mini/miniWorld3d.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/path/mini/miniWorld3d.ts")>();
  return {
    ...real,
    createMiniWorld: (_host: HTMLElement, options: Record<string, unknown>) => {
      fakes.miniOptions.push(options);
      const mini = Object.fromEntries(["setScene", "setView", "nudge", "resize", "setQuality", "refresh", "dispose", "setPaused"].map((n) => [n, vi.fn()]));
      mini.stats = vi.fn(() => ({}));
      mini.view = vi.fn(() => ({ z: 1, day: 15, zTarget: 1, dayTarget: 15, days: 30 }));
      mini.daysPerPixel = vi.fn(() => 0.05);
      mini.pick = vi.fn(() => fakes.pickId);
      fakes.minis.push(mini);
      return mini;
    },
  };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = "2026-09-15";
let host: HTMLDivElement, root: Root;
beforeEach(() => { localStorage.clear(); localStorage.setItem("hearth:pathWorld:quality", "full"); Object.assign(fakes, { worlds: [], options: [], minis: [], miniOptions: [], pickId: null }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.documentElement.classList.remove("path-world-fullscreen", "path-world-settled"); });

const settle = async (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** The staged loader lands in a few tasks. */
const loaded = async () => { for (let i = 0; i < 12; i++) await settle(10); };
async function mount(h: Household, extra: Record<string, unknown> = {}) {
  const onCommand = async (fn: (x: Household) => CommitResult) => ({ ok: true, household: fn(h).household });
  await act(async () => root.render(createElement(OurPathWorld, { household: h, memberId: "MEM-001", today: TODAY, busy: false, onCommand, theme: "classic", classicRoom: null, ...extra } as never)));
  await loaded();
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const click = async (el: HTMLElement) => act(async () => { el.click(); });
const pageMini = () => $(".path-world__simple .journey-mini:not(.journey-mini--compact)");
const cornerMini = () => host.querySelector<HTMLElement>(".path-hud__mini .journey-mini--compact");
const world = () => fakes.worlds.at(-1)!;
const worldOptions = () => fakes.options.at(-1)! as { onPick: (id: string) => void; onLevel: (l: 0 | 1 | 2 | 3) => void; onView: (v: { level: 0 | 1 | 2 | 3; month: number | null }) => void };
async function openWorld() {
  const open = [...pageMini().querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes("Open the world"))!;
  open.focus();
  await click(open);
  await loaded();
}
const pageLevel = () => pageMini().dataset.level;
const levelButton = (scope: HTMLElement, name: string) => [...scope.querySelectorAll<HTMLButtonElement>(".journey-mini__levels button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent) === name)!;

describe("One journey, two views (D-284 + D-285)", () => {
  it("mounts the simple view on the page by default, and a compact copy in the open world's corner; the page copy pauses", async () => {
    const h = journeyHousehold();
    await mount(h);
    expect(pageMini()).toBeTruthy();
    expect(host.querySelector(".path-world__preview")).toBeNull();
    expect(fakes.worlds).toHaveLength(0);
    await openWorld();
    expect(fakes.worlds).toHaveLength(1);
    expect(cornerMini()).toBeTruthy();
    // The page copy stops drawing behind the world; the corner copy draws small.
    const [pageRenderer, cornerRenderer] = fakes.minis;
    expect(pageRenderer!.setPaused).toHaveBeenLastCalledWith(true);
    expect(fakes.miniOptions.at(-1)).toMatchObject({ compact: true, quality: "low" });
    expect(cornerRenderer!.setPaused).not.toHaveBeenCalledWith(true);
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true })); });
    await settle();
    expect(pageRenderer!.setPaused).toHaveBeenLastCalledWith(false);
    expect(cornerMini()).toBeNull();
  });

  it("moves the world when the simple view zooms or picks, and the simple view when the world moves", async () => {
    const h = journeyHousehold();
    const months = pathMonths(h, TODAY, { from: "2026-07", through: "2026-09" });
    await mount(h);
    await openWorld();
    const corner = cornerMini()!;
    // The corner minimap's zoom: Month → the world's Stop on this month.
    await click(levelButton(corner, "Month"));
    await settle();
    expect(world().focus).toHaveBeenLastCalledWith("now", 2);
    // A pick in the corner minimap (a lap of the era island) → the world flies to that month.
    await click(levelButton(corner, "Era"));
    await settle();
    fakes.pickId = "lap:2026-08";
    const stage = corner.querySelector<HTMLElement>(".journey-mini__stage")!;
    const pointer = (type: string) => { const e = new MouseEvent(type, { bubbles: true, clientX: 10, clientY: 10, button: 0 }); Object.defineProperty(e, "pointerId", { value: 1 }); return e; };
    await act(async () => { stage.dispatchEvent(pointer("pointerdown")); stage.dispatchEvent(pointer("pointerup")); });
    await settle();
    const august = months.findIndex((m) => m.key === "2026-08");
    expect(world().focus).toHaveBeenLastCalledWith(`month:${august}`, 2);
    // A pick in the world → the simple view goes to that month (and the page copy too).
    worldOptions().onLevel(3);
    await settle();
    worldOptions().onPick(`month:${months.findIndex((m) => m.key === "2026-07")}`);
    await loaded();
    expect(cornerMini()!.dataset.level).toBe("2");
    expect(pageLevel()).toBe("2");
    expect(pageMini().textContent).toContain("July 2026");
    // The person zooms the world out to Sky: both copies read Journey.
    worldOptions().onLevel(2);
    worldOptions().onLevel(1);
    worldOptions().onLevel(0);
    await settle();
    expect(cornerMini()!.dataset.level).toBe("4");
    // The person drags the world's camera to September's stop: the simple view follows (the month it aims at).
    worldOptions().onView({ level: 0, month: months.length - 1 });
    await loaded();
    expect(pageMini().querySelector(".journey-mini__sub")?.textContent ?? "").not.toContain("July");
    // Escape: back on the page with the same focus.
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true })); });
    await settle();
    expect(pageLevel()).toBe("4");
    expect(pageMini().querySelector("h2")?.textContent).toBe("Our journey");
  });

  it("reads a minimap pick of another era the way the world does: that era, from its first month, in both copies", async () => {
    const h = journeyHousehold();
    const past = pathEras(h, TODAY).find((e) => e.state === "past")!;
    await mount(h);
    await openWorld();
    const corner = cornerMini()!;
    await click(levelButton(corner, "Journey"));
    await loaded();
    const label = [...corner.querySelectorAll<HTMLButtonElement>(".journey-mini__label")].find((b) => b.dataset.place === `era:${past.id}`)!;
    await click(label);
    await loaded();
    expect(world().focus).toHaveBeenLastCalledWith(`era:${past.id}`, 2);
    expect($(".path-world__card h3").textContent).toBe(past.spec.name);
    expect($(".path-hud__caption").textContent).toContain(past.spec.name);
    expect(cornerMini()!.dataset.level).toBe("3");
    expect(pageMini().dataset.level).toBe("3");
    expect(pageMini().querySelector("h2")?.textContent).toContain(past.spec.name);
  });

  it("keeps Replay on the simple view's month, and the simple view on Replay's", async () => {
    const h = journeyHousehold();
    const months = pathMonths(h, TODAY, { from: "2026-07", through: "2026-09" });
    await mount(h);
    const slider = $<HTMLInputElement>(".path-world__slider input");
    expect(slider.value).toBe(String(months.length - 1));
    await click(levelButton(pageMini(), "Month"));
    // The simple view's own time slider, one month back → Replay follows.
    const scrub = pageMini().querySelector<HTMLInputElement>(".journey-mini__scrub input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(scrub, String(Number(scrub.value) - 1));
      scrub.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await loaded();
    expect(slider.value).toBe(String(months.length - 2));
    // Replay's slider → the simple view.
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "0");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await loaded();
    expect(pageMini().textContent).toContain("July 2026");
  });

  it("hides my private to-dos from the simple view at the Dim lantern, as the world does", async () => {
    const h = journeyHousehold();
    await mount(h);
    await click(levelButton(pageMini(), "Day"));
    await loaded();
    const list = [...pageMini().querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "List")!;
    await click(list);
    await click(levelButton(pageMini(), "Month"));
    await loaded();
    expect(pageMini().textContent).toContain("my quiet surprise");
    await click([...host.querySelectorAll<HTMLButtonElement>(".path-world__pagebar button")].find((b) => b.textContent === "Dim")!);
    await loaded();
    expect(pageMini().textContent).not.toContain("my quiet surprise");
    expect(pageMini().textContent).toContain("book the vet");
  });
});

describe("Both views say the same thing (D-284 + D-285)", () => {
  it("shares era names, months, the Chapter, where we are and the Fund's lanes between the model and the world", async () => {
    const h = journeyHousehold();
    const model = miniJourney(h, { memberId: "MEM-001", today: TODAY });
    // The staged loader lands on exactly the one-call model.
    const staged = await loadMiniJourney(h, { memberId: "MEM-001", view: "household", today: TODAY });
    expect(staged.base!.months).toEqual(model.months);
    expect(staged.base!.eras).toEqual(model.eras);
    expect(staged.month).toEqual(model.month);
    expect(staged.fund).toEqual(model.fund);

    await mount(h);
    await openWorld();
    const input = world().setScene!.mock.calls.at(-1)![0] as { characters: unknown[]; eras: { id: string; state: string }[] };
    const marks = new Map([...host.querySelectorAll<HTMLButtonElement>(".path-mark")].map((b) => [b.dataset.place!, b.getAttribute("aria-label") ?? ""]));

    // Eras: the same agreed eras, the same names, the same one we are in.
    const views = pathEras(h, TODAY).filter((e) => e.state !== "sketched");
    expect(model.eras.map((e) => e.name)).toEqual(views.map((e) => e.spec.name));
    for (const era of model.eras) {
      if (era.state === "current") {
        expect(era.worldId).toBe("era-home");
        expect(marks.get("era-home")).toContain(era.name);
      } else {
        expect(marks.get(era.worldId)).toMatch(new RegExp(`^${era.name},`));
      }
    }
    expect(input.eras.map((e) => e.id).sort()).toEqual(model.eras.filter((e) => e.state !== "current").map((e) => e.id).sort());

    // Months: every month the world grows has the same index and the same short name in the model.
    const grown = model.months.filter((m) => m.worldIndex !== null);
    expect(grown).toHaveLength(input.characters.length);
    for (const m of grown) {
      expect(m.worldId).toBe(`month:${m.worldIndex}`);
      const label = marks.get(m.worldId!)!;
      if (m.current) expect(label).toMatch(/^We are here/);
      // The world's short name is the month; the simple view adds the year.
      else expect(m.shortLabel).toBe(`${label.split(",")[0]} ${m.key.slice(0, 4)}`);
    }
    // Where we are: the same month on both sides.
    expect(model.months.find((m) => m.current)!.key).toBe(TODAY.slice(0, 7));
    expect(grown.at(-1)!.current).toBe(true);
    expect(marks.get(`month:${grown.length - 1}`)).toMatch(/^We are here/);

    // The Chapter: the same title, open on both sides.
    const chapter = model.month.chapter!;
    const fire = [...marks].find(([id]) => id.startsWith("fire:"))!;
    expect(fire[1]).toMatch(new RegExp(`^${chapter.title}, this Chapter`));
    expect(model.month.status).toBe("open");
    expect(chapter.state).toBe("open");

    // The Fund's lanes: the world's caption shows the simple view's numbers, read by the same selector.
    const fund = miniFund(h, "MEM-001", TODAY);
    const hud = [...host.querySelectorAll(".path-hud__tracker")].map((n) => n.textContent);
    expect(hud).toEqual((["prepare", "protect", "build"] as const).map((lane) => `${fund.lanes[lane].label} ${miniCad(fund.lanes[lane].amountCents)}${fund.lanes[lane].targetCents ? ` of ${miniCad(fund.lanes[lane].targetCents!)}` : ""}`));
    const pageLanes = [...pageMini().querySelectorAll<HTMLButtonElement>("[data-place^='lane:']")].map((b) => b.getAttribute("aria-label"));
    for (const lane of ["prepare", "protect", "build"] as const) {
      const t = fund.lanes[lane];
      expect(pageLanes).toContain(`${t.label} · ${miniCad(t.amountCents)}${t.targetCents ? ` of ${miniCad(t.targetCents)}` : ""}`);
    }
  });

  it("holds the Fund's numbers back from the world at the Dim lantern", async () => {
    await mount(journeyHousehold());
    await openWorld();
    expect(host.querySelectorAll(".path-hud__tracker").length).toBe(3);
    await click($(".path-hud__gear"));
    await click([...host.querySelectorAll<HTMLButtonElement>(".path-world__drawer button")].find((b) => b.textContent === "Dim")!);
    expect(host.querySelectorAll(".path-hud__tracker").length).toBe(0);
  });
});

describe("The world's camera report (pathWorld3d, D-285)", () => {
  it("finds the grown month nearest the aim, or none off the island", async () => {
    const { nearestMonthIndex } = await vi.importActual<typeof import("../src/path/world/pathWorld3d.ts")>("../src/path/world/pathWorld3d.ts");
    const spot = (m: number) => ({ x: m * 10, z: 0 });
    expect(nearestMonthIndex(spot, 5, 21, 1)).toBe(2);
    expect(nearestMonthIndex(spot, 1, 21, 1)).toBe(1);
    expect(nearestMonthIndex(spot, 5, 200, 0)).toBeNull();
  });
});
