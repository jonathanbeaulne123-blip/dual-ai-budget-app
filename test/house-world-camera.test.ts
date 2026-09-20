// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountHouseWorld, type HouseRuntime } from "../src/house/world/runtime.ts";

vi.mock("../src/house/world/rendererOwner.ts", () => ({
  acquireWorldRenderer: () => ({
    active: true,
    renderer: {
      render: vi.fn(), setSize: vi.fn(),
      info: { render: { calls: 0 }, memory: { geometries: 0, textures: 0 } },
    },
    requestFrame: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
    cancelFrame: (id: number) => cancelAnimationFrame(id),
    listenCanvas: () => () => undefined,
    release: vi.fn(),
  }),
}));

let world: HouseRuntime | undefined;
let host: HTMLDivElement;
let frames: Map<number, FrameRequestCallback>;
let serial: number;
let clock: number;
let width: number;
let resize: () => void;

beforeEach(() => {
  frames = new Map(); serial = 0; width = 1440; clock = performance.now();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {} disconnect() {}
  });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  host = document.createElement("div");
  host.getBoundingClientRect = () => ({ width, height: 720, left: 0, top: 0, right: width, bottom: 720, x: 0, y: 0, toJSON: () => ({}) });
  world = mountHouseWorld(host, "classic", () => new Map(), vi.fn(), vi.fn());
});
afterEach(() => { world?.dispose(); vi.unstubAllGlobals(); });

function frame() {
  const pending = [...frames.values()]; frames.clear();
  clock += 100;
  pending.forEach(callback => callback(clock));
}

it("keeps the architectural overview when a late book return restores a close room camera", () => {
  world!.go({ zone: "study:middle", overview: true, camera: [2, 4, 5] });
  frame();
  expect(world!.camera()).toEqual([1, 12, 30]);
  // Changing device composition must still frame the whole architecture.
  width = 390; resize(); frame();
  expect(world!.camera()).toEqual([1, 12, 51]);
  width = 1440; resize(); frame();
  expect(world!.camera()).toEqual([1, 12, 30]);
});

it("pulls back from Queen detail while preserving an ordinary room's exact return", () => {
  world!.go({ zone: "home:middle", target: "queen", queenView: "detail", overview: true });
  frame();
  expect(world!.camera()).toEqual([1, 12, 30]);
  world!.go({ zone: "study:middle", camera: [2, 4, 5] });
  frame();
  expect(world!.camera()).toEqual([2, 4, 5]);
});
