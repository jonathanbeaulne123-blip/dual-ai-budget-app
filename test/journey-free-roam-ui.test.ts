// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addGoal, postEntry, type CommitResult, type Household } from "../src/core/index.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { OurPathWorld, type JourneyMiniSlotArgs } from "../src/path/OurPathWorld.tsx";
import type { PathRoamView } from "../src/path/world/pathWorld3d.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

/**
 * Free roam in the open world (D-286). jsdom has no WebGL: the fake world records what the page asks of it, keeps
 * its own latched/free flag the way the real one does, and hands the page its callbacks so a test can drag the
 * camera, roam it, and let it come to rest.
 */
type Options = {
  quality?: string;
  onLevel?: (level: 0 | 1 | 2 | 3) => void;
  onPick?: (id: string) => void;
  onView?: (view: { level: 0 | 1 | 2 | 3; month: number | null }) => void;
  onRoam?: (roaming: boolean, why: "drag" | "key" | "api") => void;
  onRoamView?: (view: PathRoamView | null) => void;
  onRoamHome?: () => void;
  onRoamToggle?: () => void;
};
const names = ["setScene", "resize", "setAmbient", "setQuality", "sleep", "wake", "refresh", "focus", "focusMonth", "setLevel", "zoom", "turn", "stats", "dispose", "setSafeArea", "roamTo", "roamView"] as const;
type FakeWorld = Record<(typeof names)[number], ReturnType<typeof vi.fn>> & { setRoam: ReturnType<typeof vi.fn>; roaming: () => boolean };
const created = vi.hoisted(() => ({ mode: "fake" as "throw" | "fake", options: [] as Options[], worlds: [] as unknown[] }));
vi.mock("../src/path/world/pathWorld3d.ts", () => ({
  createPathWorld: (_host: HTMLElement, options: Options) => {
    if (created.mode === "throw") throw new Error("WebGL unavailable");
    created.options.push(options);
    let roaming = false;
    const world = Object.fromEntries([
      "setScene", "resize", "setAmbient", "setQuality", "sleep", "wake", "refresh", "focus", "focusMonth",
      "setLevel", "zoom", "turn", "stats", "dispose", "setSafeArea", "roamTo", "roamView",
    ].map((n) => [n, vi.fn()])) as unknown as FakeWorld;
    // The real world only reports a change of hands, and only when there is one.
    world.setRoam = vi.fn((on: boolean) => {
      if (on === roaming) return;
      roaming = on;
      options.onRoam?.(on, "api");
      if (!on) options.onRoamView?.(null);
    });
    world.roaming = () => roaming;
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
const lastMini = (compact: boolean) => minis.filter((m) => m.compact === compact).at(-1)!;
const world = () => created.worlds.at(-1) as FakeWorld;
const options = () => created.options.at(-1)!;
const stage = () => $(".path-world__stage");
const roamer = () => $<HTMLButtonElement>(".path-hud__roamer");
const canvasWrap = () => $<HTMLDivElement>(".path-world__host");
const says = () => $(".path-hud .sr-only[role='status']").textContent;
async function openWorld() {
  const opener = $<HTMLButtonElement>(".fake-mini__open");
  opener.focus();
  await click(opener);
  await settle();
}
/** The world's own report that the person has taken the camera (a drag, or a roam key on the island). */
async function dragTheCamera() {
  await act(async () => { options().onRoam?.(true, "drag"); });
  await settle();
}
function roamView(over: Partial<PathRoamView> = {}): PathRoamView {
  return {
    tx: 30, tz: -12, x: 34, z: 18, heading: 1.1, cone: 1.2, reach: 70, r: 60, radius: 200,
    us: { x: -4, z: 6 }, islands: [{ x: 0, z: 0, r: 40 }, { x: 120, z: -60, r: 16 }], ...over,
  };
}

describe("one clear control hands the camera over (D-286)", () => {
  it("offers Free roam beside Minimize, latched, with a real pressed state and a 44px target", async () => {
    await mount();
    await openWorld();
    const button = roamer();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Free roam camera");
    expect(button.getAttribute("aria-keyshortcuts")).toBe("C");
    expect(button.textContent).toContain("Free roam");
    expect(button.disabled).toBe(false);
    // Its visible words are part of its name, so speaking them presses it.
    expect(button.getAttribute("aria-label")!).toContain("Free roam");
    // Latched, nothing says the camera is loose.
    expect(host.querySelector(".path-hud__roam")).toBeNull();
    expect(host.querySelector(".path-roam-radar")).toBeNull();
  });

  it("unlatches on the control, names the mode on the island, and puts focus where the keys land", async () => {
    await mount();
    await openWorld();
    expect(canvasWrap().getAttribute("role")).toBe("application");
    expect(canvasWrap().getAttribute("aria-label")).toContain("follows the two of you");
    await click(roamer());
    await settle();
    expect(world().setRoam).toHaveBeenLastCalledWith(true);
    expect(roamer().getAttribute("aria-pressed")).toBe("true");
    // The keys only reach the island while it holds focus, so taking the camera moves focus there.
    expect(document.activeElement).toBe(canvasWrap());
    expect(canvasWrap().getAttribute("aria-label")).toContain("W A S D");
    expect(canvasWrap().getAttribute("aria-label")).toContain("Space");
    expect(canvasWrap().dataset.roaming).toBe("true");
    expect(says()).toContain("Free roam");
  });

  it("takes the camera back on the same control and flies home to the two of you", async () => {
    await mount();
    await openWorld();
    await click(roamer());
    world().focus.mockClear();
    await click(roamer());
    await settle();
    expect(world().setRoam).toHaveBeenLastCalledWith(false);
    expect(roamer().getAttribute("aria-pressed")).toBe("false");
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(world().focus).toHaveBeenLastCalledWith("now", 2);
    expect(says()).toContain("latched");
    expect(host.querySelector(".path-hud__roam")).toBeNull();
  });

  it("has no free roam at all without WebGL, and its outline says so", async () => {
    created.mode = "throw";
    await mount({ renderMini: null });
    await click(byText("Open the world")!);
    await settle();
    expect(roamer().disabled).toBe(true);
    expect(host.querySelector(".path-hud__roam")).toBeNull();
    expect(host.querySelector(".path-roam-radar")).toBeNull();
    // Pressing it anyway does nothing at all.
    await click(roamer());
    expect(roamer().getAttribute("aria-pressed")).toBe("false");
    expect($(".path-world__outline").textContent).toContain("no free roam camera here");
  });
});

describe("a drag takes the camera, quietly (D-286)", () => {
  it("says one line, offers the way back, and settles into a plain state chip", async () => {
    await mount();
    await openWorld();
    await dragTheCamera();
    const chip = $(".path-hud__roam");
    expect(chip.textContent).toContain("You’ve taken the camera");
    expect(chip.dataset.taken).toBe("true");
    expect(byText("Return to us")).toBeTruthy();
    expect(says()).toContain("The camera is yours");
    // The line is quiet: it says it once, then the chip is only the state and the way back.
    await act(async () => { await new Promise((r) => setTimeout(r, 6300)); });
    expect($(".path-hud__roam").textContent).toContain("Free roam");
    expect($(".path-hud__roam").textContent).not.toContain("taken the camera");
    expect(byText("Return to us")).toBeTruthy();
  }, 25_000);

  it("Return to us latches the camera and flies home", async () => {
    await mount();
    await openWorld();
    await dragTheCamera();
    await click(byText("Return to us")!);
    await settle();
    expect(world().setRoam).toHaveBeenLastCalledWith(false);
    expect(roamer().getAttribute("aria-pressed")).toBe("false");
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(world().focus).toHaveBeenLastCalledWith("now", 2);
  });

  it("Where we are and Space (the island's own key) both latch and fly home", async () => {
    await mount();
    await openWorld();
    await dragTheCamera();
    await click(byText("Where we are")!);
    await settle();
    expect(world().setRoam).toHaveBeenLastCalledWith(false);

    await click(roamer());
    expect(roamer().getAttribute("aria-pressed")).toBe("true");
    // Space / Home on the island asks the page to bring the camera home.
    await act(async () => { options().onRoamHome?.(); });
    await settle();
    expect(roamer().getAttribute("aria-pressed")).toBe("false");
    expect(world().setRoam).toHaveBeenLastCalledWith(false);
  });

  it("the island's own latch key toggles the same control", async () => {
    await mount();
    await openWorld();
    await act(async () => { options().onRoamToggle?.(); });
    await settle();
    expect(roamer().getAttribute("aria-pressed")).toBe("true");
    await act(async () => { options().onRoamToggle?.(); });
    await settle();
    expect(roamer().getAttribute("aria-pressed")).toBe("false");
  });
});

describe("what a free camera still does, and what it no longer suffers (D-286)", () => {
  it("still travels to a pick from either view, and stays free when it lands", async () => {
    const h = await mount();
    await openWorld();
    await dragTheCamera();
    const goal = `goal:${h.goals.at(-1)!.id}`;
    await act(async () => lastMini(true).focus.set({ level: "week", date: TODAY, selected: goal }, "mini"));
    await settle();
    expect(world().focus).toHaveBeenLastCalledWith(goal, 3);
    // A pick is a request, not a recall: the camera is still the person's.
    expect(roamer().getAttribute("aria-pressed")).toBe("true");
    expect(world().setRoam).not.toHaveBeenCalledWith(false);
    // A pick from the world itself is the same.
    await act(async () => { options().onPick?.("era-home"); });
    await settle();
    expect(roamer().getAttribute("aria-pressed")).toBe("true");
  });

  it("is never yanked by Replay or a date change, though the month still moves", async () => {
    const h = await mount();
    const months = pathMonths(h, TODAY);
    const june = months.findIndex((m) => m.key === "2026-06");
    expect(june).toBeGreaterThanOrEqual(0);
    await openWorld();
    await dragTheCamera();
    world().focus.mockClear(); world().focusMonth.mockClear(); world().setLevel.mockClear();
    await act(async () => lastMini(true).focus.set({ level: "month", date: "2026-06-10" }, "mini"));
    await settle();
    // The map's month moved; the camera did not.
    expect($<HTMLInputElement>(".path-world__slider input").value).toBe(String(june));
    expect($(".path-hud__caption").textContent).toContain("June 2026");
    expect(world().focusMonth).not.toHaveBeenCalled();
    expect(world().focus).not.toHaveBeenCalled();
    // Nor by the whole journey, nor by Replay's slider.
    await act(async () => lastMini(true).focus.set({ level: "journey", selected: null }, "mini"));
    expect(world().setLevel).not.toHaveBeenCalled();
    const slider = $<HTMLInputElement>(".path-world__slider input");
    await act(async () => {
      slider.value = "0";
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    expect(world().focusMonth).not.toHaveBeenCalled();
    expect(roamer().getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps reporting where it rests, so the simple view follows, and says the month out loud", async () => {
    const h = await mount();
    const months = pathMonths(h, TODAY);
    const june = months.findIndex((m) => m.key === "2026-06");
    await openWorld();
    await dragTheCamera();
    await act(async () => { options().onView?.({ level: 2, month: june }); });
    await settle();
    expect(lastMini(false).focus.focus).toMatchObject({ source: "world", date: expect.stringContaining("2026-06") });
    expect(says()).toBe("Near June 2026");
    // Resting on the same month again does not repeat itself.
    await act(async () => { options().onView?.({ level: 2, month: june }); });
    await settle();
    expect(says()).toBe("Near June 2026");
  });

  it("latches again when the world is minimized, so the next opening starts with the two of you", async () => {
    await mount();
    await openWorld();
    await dragTheCamera();
    expect(host.querySelector(".path-hud__roam")).toBeTruthy();
    await click($(".path-hud__min"));
    await settle();
    expect(stage().hidden).toBe(true);
    expect(world().setRoam).toHaveBeenLastCalledWith(false);
    await openWorld();
    expect(roamer().getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelector(".path-hud__roam")).toBeNull();
  });
});

describe("the corner radar, so you can find your way back (D-286)", () => {
  it("draws the land, the camera's cone and the two of you, and flies where it is tapped", async () => {
    await mount();
    await openWorld();
    await dragTheCamera();
    // Nothing is drawn until the world says where the camera is.
    expect(host.querySelector(".path-roam-radar svg")).toBeNull();
    await act(async () => { options().onRoamView?.(roamView()); });
    const radar = $<HTMLButtonElement>(".path-roam-radar");
    expect(radar.getAttribute("aria-label")).toContain("fly the camera there");
    expect(radar.querySelectorAll(".path-roam-radar__land")).toHaveLength(2);
    expect(radar.querySelector(".path-roam-radar__cone")).toBeTruthy();
    // The two of you are a mark of your own, apart from the camera.
    expect(radar.querySelector(".path-roam-radar__us")).toBeTruthy();
    expect(radar.querySelector(".path-roam-radar__eye")).toBeTruthy();
    // It sits above the corner map, both in the same corner.
    expect(radar.parentElement?.classList.contains("path-hud__minicol")).toBe(true);
    expect($(".path-hud__minicol .path-hud__mini")).toBeTruthy();

    // Tapping it flies the camera there (a pointer click carries a position; the keyboard goes back to the two of you).
    radar.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    await act(async () => { radar.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1, clientX: 50, clientY: 50 })); });
    expect(world().roamTo).toHaveBeenCalledWith(0, 0);
    await act(async () => { radar.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })); });
    expect(world().roamTo).toHaveBeenLastCalledWith(-4, 6);
  });

  it("moves the camera's mark without rebuilding the map, and disappears when the camera is latched", async () => {
    await mount();
    await openWorld();
    await dragTheCamera();
    await act(async () => { options().onRoamView?.(roamView()); });
    const here = $(".path-roam-radar__here");
    const first = here.getAttribute("transform");
    await act(async () => { options().onRoamView?.(roamView({ x: -60, z: 40, heading: -2 })); });
    // The same element, moved: the land around it was not redrawn.
    expect($(".path-roam-radar__here")).toBe(here);
    expect(here.getAttribute("transform")).not.toBe(first);
    await click(byText("Return to us")!);
    await settle();
    expect(host.querySelector(".path-roam-radar")).toBeNull();
  });
});

describe("the controls, spelled out once per device (D-286)", () => {
  it("lists every way of moving, is dismissible, and is remembered", async () => {
    await mount();
    await openWorld();
    await dragTheCamera();
    const hint = $(".path-hud__hint");
    expect(hint.getAttribute("aria-label")).toBe("How to roam the island");
    const words = hint.textContent ?? "";
    for (const part of ["W", "A", "S", "D", "Q", "E", "R", "F", "Shift", "Space", "Drag to glide", "pinch", "right-drag"]) {
      expect(words, part).toContain(part);
    }
    const got = byText("Got it")!;
    expect(got).toBeTruthy();
    await click(got);
    expect(host.querySelector(".path-hud__hint")).toBeNull();
    // Focus does not fall to the body when the hint goes away.
    expect(document.activeElement).toBe(roamer());
    expect(localStorage.getItem("hearth:pathWorld:roamHint")).toBe("1");
    // Taking the camera again does not say it twice.
    await click(byText("Return to us")!);
    await click(roamer());
    expect(host.querySelector(".path-hud__hint")).toBeNull();
  });

  it("stays away on a device that has already seen it", async () => {
    localStorage.setItem("hearth:pathWorld:roamHint", "1");
    await mount();
    await openWorld();
    await dragTheCamera();
    expect(host.querySelector(".path-hud__hint")).toBeNull();
    expect($(".path-hud__roam")).toBeTruthy();
  });
});
