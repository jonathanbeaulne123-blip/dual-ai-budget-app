// @vitest-environment jsdom
import HarbourWorld from "../src/harbour/HarbourWorld.tsx";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import type { HouseRoute } from "../src/hearthside/houseRoutes.ts";

/**
 * The flat routing (SIMPLE_VIEW_DESK S2 §4, S6 "one flat world"): with no
 * WebGL world standing — the `flat` tier (no WebGL, Save-Data, `motion: flat`)
 * or a failed draw — the Desk is the whole 2D world at rest **in every place**,
 * not the old door directory or a room's own reading edition. A tool open in
 * front keeps the light flat frame, and the loading path never mounts the Desk.
 */
const mount = vi.hoisted(() => ({ mode: "throw" as "throw" | "hang" }));
vi.mock("../src/harbour/scene/runtime.ts", () => ({
  mountHarbourWorld: () => {
    if (mount.mode === "throw") throw new Error("the draw fails, or a flat tier never mounts the scene");
    // A world that is still being built: every call answers nothing, and it never says it is ready.
    return new Proxy({}, { get: () => () => undefined });
  },
  scrubControls: () => null,
}));
vi.mock("../src/harbour/court/queenPlace.ts", () => ({
  loadQueenPlace: () => Promise.reject(new Error("no Queen in this test")),
  seatGrowthAtRoots: () => undefined,
}));

const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const square: HouseRoute = { room: "home", level: "middle", householdId: household.householdId };
const tower: HouseRoute = { room: "home", level: "above", householdId: household.householdId };
const cellar: HouseRoute = { room: "home", level: "below", householdId: household.householdId };

let host: HTMLDivElement, root: Root;
let getContext: typeof HTMLCanvasElement.prototype.getContext;
/** No WebGL by default: the tier is flat. */
let webgl = false;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  webgl = false;
  mount.mode = "throw";
  getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (() => (webgl ? {} : null)) as unknown as typeof getContext;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  HTMLCanvasElement.prototype.getContext = getContext;
  vi.unstubAllGlobals();
  try { window.localStorage.removeItem("hearth:motion"); } catch { /* no storage */ }
  document.body.innerHTML = "";
});

async function stand(route: HouseRoute, props: Record<string, unknown> = {}) {
  await act(async () => root.render(createElement(HarbourWorld as never, {
    household, memberId, scope: "household", today, route, ready: true, freshness: "current",
    onNavigate: () => undefined, onOpen: () => undefined, onClose: () => undefined, ...props,
  })));
  await act(async () => { await new Promise((done) => setTimeout(done, 20)); });
  return host.querySelector<HTMLElement>(".harbour-world")!;
}

/** Wait (bounded) for the scene's lazy imports to settle the stage's status. */
async function settle(world: HTMLElement, until: (status: string | undefined) => boolean) {
  const deadline = Date.now() + 8000;
  while (!until(world.dataset.worldStatus) && Date.now() < deadline) await act(async () => { await new Promise((done) => setTimeout(done, 25)); });
  return world;
}

describe("the flat world is the Desk, in every place", () => {
  it("stands the Desk, not the village door directory, when the square is at rest", async () => {
    const onQuickSheet = vi.fn();
    const world = await stand(square, { onQuickSheet });
    expect(world.dataset.worldStatus).toBe("flat");
    expect(world.querySelector("[data-desk]")).toBeTruthy();
    expect(world.querySelectorAll("[data-harbour-bar]")).toHaveLength(1);
    // One flip: the glass carries it, so the Desk's header does not (Tool Atlas brief K14).
    expect(world.querySelectorAll("[data-glass-flip]")).toHaveLength(1);
    expect(world.querySelector("[data-desk-flip]")).toBeNull();
    expect(world.querySelector("[data-place-flat]")).toBeNull();
    // Both editions share one bar; the 3D address and directory stay out of the Desk.
    expect(world.querySelector(".village-address")).toBeNull();
    await act(async () => world.querySelector<HTMLButtonElement>("[data-desk-drawer]")!.click());
    expect(onQuickSheet).toHaveBeenCalledTimes(1);
  });

  for (const [name, route, place] of [["the Tower", tower, "tower"], ["the Cellar", cellar, "cellar"]] as const) {
    it(`stands the Desk at rest in ${name} too — the room's own reading edition is retired`, async () => {
      const world = await stand(route);
      expect(world.dataset.harbourPlace).toBe(place);
      expect(world.dataset.worldStatus).toBe("flat");
      expect(world.querySelector("[data-desk]")).toBeTruthy();
      expect(world.querySelector("[data-place-flat]")).toBeNull();
      expect(world.querySelector(".village-address")).toBeNull();
      // The Leaving page carries what the Cellar's rail used to; the Desk opens on Today.
      expect(world.querySelector("[data-desk-chip='leaving']")).toBeTruthy();
      expect(world.querySelector("[data-glass-flip]")!.getAttribute("aria-disabled")).toBe("true");
    });
  }

  it("lands a Save-Data device on the Desk even where WebGL would draw", async () => {
    webgl = true;
    vi.stubGlobal("navigator", { ...navigator, connection: { saveData: true } });
    const world = await stand(tower);
    expect(world.dataset.harbourTier).toBe("flat");
    expect(world.dataset.worldStatus).toBe("flat");
    expect(world.querySelector("[data-desk]")).toBeTruthy();
  });

  it("lands the chosen simple view (motion: flat) on the Desk in any place", async () => {
    webgl = true;
    window.localStorage.setItem("hearth:motion", "flat");
    const world = await stand(cellar);
    expect(world.dataset.worldStatus).toBe("flat");
    expect(world.querySelector("[data-desk]")).toBeTruthy();
  });

  it("keeps the light flat frame while a tool is open in front", async () => {
    const world = await stand({ ...square, surface: "books" });
    expect(world.querySelector("[data-desk]:not([hidden])")).toBeNull();
    const frame = world.querySelector<HTMLElement>("[data-place-flat='court']");
    expect(frame).toBeTruthy();
    expect(frame!.dataset.courtFlat).toBe("flat");
    // The frame is a frame: every door is the tool's, or the Desk's once the tool is put back.
    expect(frame!.querySelector("button, input, form")).toBeNull();
    expect(world.querySelector(".harbour-world__put-back")).toBeTruthy();
    expect(world.querySelector(".village-address")).toBeNull();
  });

  it("keeps the same light frame behind a tool opened in the Tower", async () => {
    const world = await stand({ ...tower, surface: "loft-banks" });
    expect(world.querySelector("[data-desk]:not([hidden])")).toBeNull();
    expect(world.querySelector("[data-place-flat='tower']")).toBeTruthy();
  });

  it("opens Hercules through the house's own door from the Desk's corner", async () => {
    const opened: string[] = [];
    const world = await stand(square, { onOpen: (target: string) => opened.push(target) });
    await act(async () => world.querySelector<HTMLButtonElement>(".desk-door--talk")!.click());
    expect(opened).toEqual(["hercules"]);
  });
});

describe("the loading path stays light", () => {
  it("shows the light loading frame, not the Desk, while the scene is still being built", async () => {
    webgl = true;
    mount.mode = "hang";
    const world = await stand(tower);
    expect(world.dataset.harbourTier).not.toBe("flat");
    expect(world.dataset.worldStatus).toBe("loading");
    expect(world.querySelector("[data-desk]:not([hidden])")).toBeNull();
    const frame = world.querySelector<HTMLElement>("[data-place-flat='tower']");
    expect(frame).toBeTruthy();
    expect(frame!.dataset.courtFlat).toBe("loading");
    expect(frame!.classList.contains("court-flat--overlay")).toBe(true);
    expect(frame!.getAttribute("aria-busy")).toBe("true");
    // Hold it a little longer: a world that never says it is ready never becomes the Desk.
    await act(async () => { await new Promise((done) => setTimeout(done, 200)); });
    expect(world.dataset.worldStatus).toBe("loading");
    expect(world.querySelector("[data-desk]:not([hidden])")).toBeNull();
  });
});

describe("a draw that failed is said honestly, in every place", () => {
  for (const [name, route] of [["the square", square], ["the Tower", tower], ["the Cellar", cellar]] as const) {
    it(`falls back to the Desk in ${name}, with the Harbour flip disabled`, async () => {
      webgl = true;
      mount.mode = "throw";
      const world = await settle(await stand(route), (status) => status === "fallback");
      expect(world.dataset.harbourTier).not.toBe("flat");
      expect(world.dataset.worldStatus).toBe("fallback");
      const desk = world.querySelector<HTMLElement>("[data-desk]");
      expect(desk).toBeTruthy();
      expect(desk!.dataset.deskStatus).toBe("fallback");
      expect(world.querySelector("[data-glass-flip]")!.getAttribute("aria-disabled")).toBe("true");
      expect(world.querySelector(".desk__undrawn")!.textContent).toMatch(/could not be drawn/);
      expect(world.querySelector("[data-place-flat]")).toBeNull();
      expect(world.querySelector(".village-address")).toBeNull();
    });
  }
});
