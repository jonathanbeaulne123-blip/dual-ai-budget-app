// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import type { HouseRoute } from "../src/hearthside/houseRoutes.ts";

/**
 * The flat routing (SIMPLE_VIEW_DESK S2 §4): with no WebGL world standing, the
 * village square at rest is the Desk — not the old door directory — while a
 * room keeps its own reading edition until S6, and a tool open in front keeps
 * the lightweight flat frame. The loading path never mounts the Desk.
 */
vi.mock("../src/harbour/scene/runtime.ts", () => ({
  mountHarbourWorld: () => { throw new Error("a flat tier never mounts the scene"); },
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

let host: HTMLDivElement, root: Root;
let getContext: typeof HTMLCanvasElement.prototype.getContext;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  // No WebGL: the tier is flat, the reading edition.
  getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof getContext;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  HTMLCanvasElement.prototype.getContext = getContext;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function stand(route: HouseRoute, props: Record<string, unknown> = {}) {
  const { default: HarbourWorld } = await import("../src/harbour/HarbourWorld.tsx");
  await act(async () => root.render(createElement(HarbourWorld as never, {
    household, memberId, scope: "household", today, route, ready: true, freshness: "current",
    onNavigate: () => undefined, onOpen: () => undefined, onClose: () => undefined, ...props,
  })));
  await act(async () => { await new Promise((done) => setTimeout(done, 20)); });
  return host.querySelector<HTMLElement>(".harbour-world")!;
}

describe("the flat square is the Desk", () => {
  it("stands the Desk, not the village door directory, when the square is at rest", async () => {
    const onQuickSheet = vi.fn();
    const world = await stand(square, { onQuickSheet });
    expect(world.dataset.worldStatus).toBe("flat");
    expect(world.querySelector("[data-desk]")).toBeTruthy();
    expect(world.querySelector("[data-place-flat='court']")).toBeNull();
    // The Desk's header carries the flip and All tools; the 3D bar does not sit over it.
    expect(world.querySelector(".village-hud")).toBeNull();
    await act(async () => world.querySelector<HTMLButtonElement>("[data-desk-drawer]")!.click());
    expect(onQuickSheet).toHaveBeenCalledTimes(1);
  });

  it("keeps a room's own reading edition until S6", async () => {
    const world = await stand({ room: "home", level: "above", householdId: household.householdId });
    expect(world.dataset.harbourPlace).toBe("tower");
    expect(world.querySelector("[data-place-flat='tower']")).toBeTruthy();
    expect(world.querySelector("[data-desk]")).toBeNull();
  });

  it("keeps the lightweight flat frame while a tool is open in front", async () => {
    const world = await stand({ ...square, surface: "books" });
    expect(world.querySelector("[data-desk]")).toBeNull();
    expect(world.querySelector("[data-place-flat='court']")).toBeTruthy();
  });

  it("opens Hercules through the house's own door from the Desk's corner", async () => {
    const opened: string[] = [];
    const world = await stand(square, { onOpen: (target: string) => opened.push(target) });
    await act(async () => world.querySelector<HTMLButtonElement>(".desk-door--talk")!.click());
    expect(opened).toEqual(["hercules"]);
  });
});
