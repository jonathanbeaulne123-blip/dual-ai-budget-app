// @vitest-environment jsdom
import HarbourWorld from "../src/harbour/HarbourWorld.tsx";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import type { HouseRoute } from "../src/hearthside/houseRoutes.ts";

/**
 * **The keys have to land.**
 *
 * PR #521 made the walk work in all eleven places, and nobody could walk: a
 * `keydown` on a div only fires while that div holds the keyboard, and no
 * `.focus()` existed anywhere in `HarbourWorld.tsx`. W did nothing at all on
 * a fresh load until the person happened to click the world, and nothing on
 * the stage said so. The product owner had to ask how to walk.
 *
 * This file is the proof of both halves: the stage takes the keyboard when it
 * comes to the front and at no other moment, and until it holds it, it says
 * so in one quiet line.
 */

/** The fake character: everything the shell asks a body for, and a log of what it was told. */
type Input = { forward: number; strafe: number; run?: boolean };
let inputs: Input[] = [];
let ready: (() => void) | null = null;
let panelOwnsWorld=false;
let travelWasBlocked:boolean[]=[];
const cancelWalk=vi.fn();
const jump=vi.fn(),skateKeyDown=vi.fn();
let riding=false;

const body = {
  cancel: cancelWalk,
  jump,
  skate:{active:()=>riding,input:()=>({keyDown:skateKeyDown}),pause:()=>undefined,checkpoint:()=>null,setAudio:()=>undefined,enable:()=>false},
  place: () => undefined,
  input: (next: Input) => { inputs.push(next); },
  at: () => ({ x: 0, y:1.31, z: 0, yaw: 0 }),
  follow: () => undefined,
  following: () => false,
};

/** A world that is only as much world as the shell touches. */
function fakeWorld() {
  return {
    place: () => ({ anchors: () => [], regions: () => ({}), words: () => null }),
    placeId: () => "court" as const,
    setToolOpen: (open:boolean) => {panelOwnsWorld=open;},
    mountainTravel: () => {travelWasBlocked.push(panelOwnsWorld);},
    setMountainRecovery: () => undefined,
    setMountainInteraction: () => undefined,
    setWorldAmbience: () => undefined,
    mountainCalm: () => undefined,
    setReading: () => undefined,
    setBreathing: () => undefined,
    addAnimator: () => undefined,
    invalidate: () => undefined,
    restream: () => undefined,
    restore: () => undefined,
    enter: () => undefined,
    go: () => undefined,
    look: () => undefined,
    gesture: () => undefined,
    toggleClose: () => false,
    closed: () => false,
    camera: () => [0, 0, 0] as [number, number, number],
    pose: () => ({ target: [0, 0, 0] as [number, number, number], theta: 0, phi: 1, r: 8 }),
    body: () => body,
    dispose: () => undefined,
  };
}

vi.mock("../src/harbour/scene/runtime.ts", () => ({
  mountHarbourWorld: (_host: unknown, _theme: unknown, _tier: unknown, callbacks: { onReady: () => void }) => {
    ready = callbacks.onReady;
    return fakeWorld();
  },
  // No rail in the Court; the shell only ever asks for one.
  scrubControls: () => null,
}));
// Her mesh is a download and a GLB; the shell already survives it not arriving.
vi.mock("../src/harbour/court/queenPlace.ts", () => ({
  loadQueenPlace: () => Promise.reject(new Error("no Queen in this test")),
  seatGrowthAtRoots: () => undefined,
}));

const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const route: HouseRoute = { room: "home", level: "middle", householdId: household.householdId };

let coarse = false;
let host: HTMLDivElement, root: Root;
let getContext: typeof HTMLCanvasElement.prototype.getContext;

/** The Court, standing, exactly as the App mounts it. */
async function stand(props: Record<string, unknown> = {}) {
  await act(async () => root.render(createElement(HarbourWorld as never, {
    household, memberId, scope: "household", today, route, ready: true, freshness: "current",
    onNavigate: () => undefined, onOpen: () => undefined, onClose: () => undefined,
    ...props,
  })));
  // The shell fetches the runtime and the place's chunk before it can raise
  // anything, so let those land before the runtime says it is standing.
  const deadline = Date.now() + 8000;
  const flat = () => host.querySelector('[data-world-status="flat"]') !== null;
  while (!ready && !flat() && Date.now() < deadline) await act(async () => { await new Promise((done) => setTimeout(done, 10)); });
  await act(async () => { ready?.(); });
  return { stage: host.querySelector<HTMLDivElement>(".harbour-world__stage")! };
}

const invite = () => host.querySelector(".harbour-world__invite");
/**
 * A key, the way a browser delivers one: to whatever is actually holding the
 * keyboard, and nowhere else. Dispatching straight at the stage would prove
 * nothing — React would run the handler whether or not the stage had focus,
 * which is exactly the thing that was broken.
 */
const press = (key: string) => act(async () => {
  (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
});
/** Past the second, later attempt the shell makes after a tool closes. */
const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 300)); });

beforeEach(() => {
  inputs = []; ready = null; coarse = false;panelOwnsWorld=false;travelWasBlocked=[];cancelWalk.mockClear();jump.mockClear();skateKeyDown.mockClear();riding=false;localStorage.clear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(pointer: coarse)" ? coarse : false,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  // jsdom paints no WebGL, and without one the shell chooses the reading
  // edition, where there is nothing to walk and nothing to focus.
  getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = ((() => ({})) as unknown) as typeof getContext;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  HTMLCanvasElement.prototype.getContext = getContext;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("the stage takes the keyboard when the world is ready", () => {
  it("holds focus as soon as the place is standing, with no click", async () => {
    const { stage } = await stand();
    expect(document.activeElement).toBe(stage);
  });

  it("walks the body from W with no click at all — the whole bug", async () => {
    await stand();
    // Not one pointer event has happened anywhere. This is the fresh load,
    // and W, pressed into whatever the keyboard is pointed at.
    await press("w");
    expect(inputs).toEqual([{ forward: 1, strafe: 0, run: false }]);
    await press("d");
    expect(inputs[inputs.length - 1]).toEqual({ forward: 1, strafe: 1, run: false });
  });

  it("stays Tab-reachable, and keeps a focus ring that is really painted", async () => {
    const { stage } = await stand();
    expect(stage.getAttribute("tabindex")).toBe("0");
    // The focus it gave itself on arrival is marked, so the ring is not a
    // frame drawn round the whole island on every load. A focus from anywhere
    // else — Tab, or a press on the ground — is not marked and is ringed.
    expect(stage.hasAttribute("data-harbour-arrived")).toBe(true);
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    await act(async () => { elsewhere.focus(); });
    await act(async () => { stage.focus(); });
    expect(stage.hasAttribute("data-harbour-arrived")).toBe(false);
    const css = readFileSync("src/harbour/harbour.css", "utf8");
    // The ring is turned inward — the app's world ring is an outline with an
    // outset halo, and a stage that fills the viewport draws both of those
    // past the edge of the screen. It is not the invitation's job to stand in
    // for it: a keyboard focus has to be visible on its own.
    const ring = /\.harbour-world__stage:focus-visible:not\(\[data-harbour-arrived\]\) \{([^}]*)\}/.exec(css);
    expect(ring, "a focus-visible rule for the stage").not.toBeNull();
    expect(ring![1]).toMatch(/outline: 3px solid/);
    // Turned inward: the app's world ring is an outline with an outset halo,
    // and a stage that fills the viewport draws both past the edge of the
    // screen.
    expect(ring![1]).toMatch(/outline-offset: -/);
    expect(ring![1]).not.toMatch(/outline: none/);
    // And drawn over the canvas, which composites above the stage's own
    // outline — without this the ring is in the computed style and on no
    // screen anywhere.
    const over = /\.harbour-world__stage:focus-visible:not\(\[data-harbour-arrived\]\)::after \{([^}]*)\}/.exec(css);
    expect(over, "a ring drawn over the canvas").not.toBeNull();
    expect(over![1]).toMatch(/box-shadow: inset/);
    expect(over![1]).toMatch(/pointer-events: none/);
  });
});

describe("a press on the ground hands it the keyboard", () => {
  /**
   * The runtime cancels `pointerdown` so a drag never selects or scrolls, and
   * a cancelled `pointerdown` cancels the focus the browser would have given
   * the stage. Clicking the world never focused it either — the stage has to
   * put that default back, or its own invitation would be a lie.
   */
  const pressOn = (node: Element) => act(async () => { node.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); });

  it("takes it back after Tab has carried it away", async () => {
    const { stage } = await stand();
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    await act(async () => { elsewhere.focus(); });
    expect(invite()).not.toBeNull();
    await pressOn(host.querySelector(".house-world__canvas")!);
    expect(document.activeElement).toBe(stage);
    expect(invite()).toBeNull();
    // A pointer never wanted a focus ring; Tab still gets one.
    expect(stage.hasAttribute("data-harbour-arrived")).toBe(true);
    // And now the keys walk, with that one press and nothing else.
    await press("w");
    expect(inputs).toEqual([{ forward: 1, strafe: 0, run: false }]);
  });

  it("leaves a real control inside the stage its own press", async () => {
    const { stage } = await stand();
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    await act(async () => { elsewhere.focus(); });
    // "Back to the Court", the twins, "Put it back": pressing one of those is
    // pressing it, not pressing the ground.
    const control = document.createElement("button");
    stage.append(control);
    await pressOn(control);
    expect(document.activeElement).not.toBe(stage);
  });
});

describe("it never takes the keyboard from somebody", () => {
  it("leaves it alone while a tool is open, and is not even focusable there", async () => {
    const { stage } = await stand({ route: { ...route, surface: "cellar-bills" } });
    expect(stage.hasAttribute("tabindex")).toBe(false);
    expect(document.activeElement).not.toBe(stage);
  });

  it("leaves a half-typed word alone", async () => {
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();
    expect(document.activeElement).toBe(field);
    const { stage } = await stand();
    expect(document.activeElement).toBe(field);
    expect(document.activeElement).not.toBe(stage);
  });

  it("leaves the reading edition's own buttons alone: nothing is standing to walk", async () => {
    // No WebGL is the reading edition, which is a page of buttons.
    HTMLCanvasElement.prototype.getContext = ((() => null) as unknown) as typeof getContext;
    const { stage } = await stand();
    expect(document.activeElement).not.toBe(stage);
    expect(invite()).toBeNull();
  });

  it("does not take it back on a later render once somebody else has it", async () => {
    const { stage } = await stand();
    expect(document.activeElement).toBe(stage);
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    await act(async () => { elsewhere.focus(); });
    // A re-render with new props — the sort that happens every time the books
    // move — must not be a reason to pull the keyboard back, and neither is
    // the second, later attempt the shell makes for a closed tool's vacuum.
    await stand({ freshness: "stale" });
    expect(document.activeElement).toBe(elsewhere);
    await settle();
    expect(document.activeElement).toBe(elsewhere);
  });
});

describe("a tool, put back", () => {
  const tool: Record<string, unknown> = { route: { ...route, surface: "cellar-bills" } };

  it("fills the vacuum the App leaves when it has nothing to restore", async () => {
    await stand(tool);
    // The harbour stands no `house-world-title`, so `putHouseObjectBack`
    // finds nothing to give the keyboard back to and leaves it on the body.
    const { stage } = await stand();
    expect(document.activeElement).toBe(stage);
    await press("w");
    expect(inputs).toEqual([{ forward: 1, strafe: 0, run: false }]);
  });

  it("leaves the focus the App does restore, two frames later", async () => {
    await stand(tool);
    const { stage } = await stand();
    expect(document.activeElement).toBe(stage);
    // Now the App's own restore lands — later than this, as it always is.
    // Whoever is in front holds the keyboard, and that is the App's choice.
    const restored = document.createElement("h1");
    restored.tabIndex = -1;
    document.body.append(restored);
    await act(async () => { restored.focus(); });
    await settle();
    expect(document.activeElement).toBe(restored);
    expect(invite()).not.toBeNull();
  });
});

describe("the invitation", () => {
  it("is not there while the stage holds the keyboard", async () => {
    await stand();
    expect(invite()).toBeNull();
  });

  it("appears the moment the stage loses it, and names the keys", async () => {
    const { stage } = await stand();
    await act(async () => { stage.blur(); });
    const line = invite();
    expect(line).not.toBeNull();
    expect(line!.textContent).toBe("Click the island · then W A S D walks you around it");
    expect(line!.getAttribute("aria-hidden")).toBe("true");
    expect(line!.querySelector(".whisper-line")).not.toBeNull();
    // Focus it again and it is gone, with no click anywhere in between.
    await act(async () => { stage.focus(); });
    expect(invite()).toBeNull();
  });

  it("tells a thumb the truth for a thumb — no keys on a phone", async () => {
    coarse = true;
    const { stage } = await stand();
    await act(async () => { stage.blur(); });
    expect(invite()!.textContent).toBe("Tap the open ground to walk there · drag to look around you");
    expect(invite()!.getAttribute("data-harbour-invite")).toBe("touch");
  });

  it("never goes in a twin's way, and is the app's own Whisper", async () => {
    const css = readFileSync("src/harbour/harbour.css", "utf8");
    expect(css).toMatch(/\.harbour-world__invite \{[^}]*pointer-events: none/);
    const shell = readFileSync("src/harbour/HarbourWorld.tsx", "utf8");
    expect(shell).toMatch(/import \{ Whisper \} from "\.\.\/theme\/Whisper\.tsx"/);
  });

  it("speaks each place's own ground, the way the stage's words do", async () => {
    const { inviteWords } = await import("../src/harbour/HarbourWorld.tsx");
    expect(inviteWords("court", false)).toMatch(/the island/);
    expect(inviteWords("campfire", false)).toMatch(/the fire/);
    expect(inviteWords("cellar", false)).toMatch(/the room/);
    expect(inviteWords("court", true)).toMatch(/the open ground/);
    expect(inviteWords("campfire", true)).toMatch(/the open sand/);
    expect(inviteWords("cellar", true)).toMatch(/the open floor/);
    for (const touch of [false, true]) {
      for (const place of ["court", "campfire", "cellar"] as const) {
        // A Whisper line is one short sentence by the primitive's own law.
        expect(inviteWords(place, touch).length).toBeLessThanOrEqual(90);
      }
    }
  });
});

describe("being hidden is not a dead end", () => {
  it("offers a way back when the coarse opt-out is on, and never when it is off", () => {
    const source = readFileSync("src/harbour/presence/WalkTogether.tsx", "utf8");
    // The sentence that names the state, and the control that undoes it, sit together.
    expect(source).toContain("You are hidden in this house, so nothing is shared.");
    expect(source).toMatch(/softPresenceOptedOut && props\.onUnhide/);
    expect(source).toContain("Stop hiding");
    // The App owns the setting; the switch only asks. It is never called on its own.
    expect(source).not.toMatch(/setSoftPresenceOptOut\(/);
  });

  it("is wired from the App through the world, so the button is not decorative", () => {
    expect(readFileSync("src/App.tsx", "utf8")).toMatch(/onUnhide=\{\(\)=>applySoftPresenceOptOut\(false\)\}/);
    const world = readFileSync("src/harbour/HarbourWorld.tsx", "utf8");
    expect(world).toMatch(/onUnhide\?: \(\) => void/);
    expect(world).toMatch(/onUnhide=\{onUnhide\}/);
  });
});


it("pauses clicked walking for the guide and releases the follow camera before scenic travel",async()=>{
 const {stage}=await stand();
 await act(async()=>host.querySelector<HTMLButtonElement>('#world-guide-trigger')!.click());
 expect(cancelWalk).toHaveBeenCalled();expect(panelOwnsWorld).toBe(true);
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Travel & race')!.click());
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Board and ride')!.click());
 expect(travelWasBlocked).toEqual([false]);expect(panelOwnsWorld).toBe(false);
 expect(document.activeElement).toBe(stage);
 expect(host.querySelector('[role="dialog"][aria-label="Mountain and town guide"]')).toBeNull();
});

it("keeps main's Space jump on the world and leaves focused controls their keyboard",async()=>{
 const quick=vi.fn();const {stage}=await stand({onQuickSheet:quick});
 await press(' ');expect(jump).toHaveBeenCalledTimes(1);expect(quick).not.toHaveBeenCalled();
 riding=true;await press(' ');expect(skateKeyDown).toHaveBeenCalledTimes(1);
 const control=host.querySelector<HTMLButtonElement>('#world-guide-trigger')!;
 control.focus();await press(' ');
 expect(skateKeyDown).toHaveBeenCalledTimes(1);expect(jump).toHaveBeenCalledTimes(1);
 expect(stage.contains(control)).toBe(true);
});

it("keeps Space as direct tool access when the flat Desk has no world body",async()=>{
 localStorage.setItem('hearth:motion','flat');const quick=vi.fn();
 const {stage}=await stand({onQuickSheet:quick});stage.focus();await press(' ');
 expect(quick).toHaveBeenCalledTimes(1);expect(jump).not.toHaveBeenCalled();
});
