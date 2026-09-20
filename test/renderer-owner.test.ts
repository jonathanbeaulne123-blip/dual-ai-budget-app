// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type * as THREE from "three";
import { acquireWorldRenderer } from "../src/house/world/rendererOwner.ts";

function fakeRenderer() {
  const canvas = document.createElement("canvas");
  const render = vi.fn();
  const dispose = vi.fn();
  const forceContextLoss = vi.fn();
  const setPixelRatio = vi.fn();
  const setClearColor = vi.fn();
  const setRenderTarget = vi.fn();
  const setScissorTest = vi.fn();
  const renderer = {
    domElement: canvas,
    render,
    dispose,
    forceContextLoss,
    setPixelRatio,
    setClearColor,
    setRenderTarget,
    setScissorTest,
    autoClear: false,
    shadowMap: { enabled: false, type: 0 },
  } as unknown as THREE.WebGLRenderer;
  return { renderer, canvas, render, dispose, forceContextLoss, setPixelRatio, setClearColor, setRenderTarget, setScissorTest };
}

describe("whole-house renderer ownership", () => {
  it("reparents one canvas, gates suspended draws and restores the previous lease", () => {
    const made = fakeRenderer();
    const factory = vi.fn(() => made.renderer);
    const aHost = document.createElement("div"), bHost = document.createElement("div");
    const aResume = vi.fn(), aSuspend = vi.fn(), aClick = vi.fn(), bClick = vi.fn();
    const a = acquireWorldRenderer(aHost, {
      shared: true,
      rendererFactory: factory,
      configure: (renderer) => { renderer.domElement.dataset.owner = "a"; renderer.setClearColor(0x000000, 0); },
      onSuspend: aSuspend,
      onResume: aResume,
    });
    const stopA = a.listenCanvas("click", aClick);
    a.renderer.render({} as THREE.Scene, {} as THREE.Camera);
    made.canvas.click();

    const b = acquireWorldRenderer(bHost, {
      shared: true,
      rendererFactory: factory,
      configure: (renderer) => { renderer.domElement.dataset.owner = "b"; renderer.setClearColor(0x000000, 1); },
    });
    const stopB = b.listenCanvas("click", bClick);
    a.renderer.render({} as THREE.Scene, {} as THREE.Camera);
    b.renderer.render({} as THREE.Scene, {} as THREE.Camera);
    made.canvas.click();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(aSuspend).toHaveBeenCalledTimes(1);
    expect(a.active).toBe(false);
    expect(b.active).toBe(true);
    expect(bHost.firstElementChild).toBe(made.canvas);
    expect(made.canvas.dataset.owner).toBe("b");
    expect(made.setClearColor).toHaveBeenLastCalledWith(0x000000, 1);
    expect(made.setRenderTarget).toHaveBeenLastCalledWith(null);
    expect(made.setScissorTest).toHaveBeenLastCalledWith(false);
    expect((made.renderer as unknown as { autoClear: boolean }).autoClear).toBe(true);
    expect(made.render).toHaveBeenCalledTimes(2);
    expect(aClick).toHaveBeenCalledTimes(1);
    expect(bClick).toHaveBeenCalledTimes(1);

    stopB();
    b.release();
    expect(a.active).toBe(true);
    expect(aHost.firstElementChild).toBe(made.canvas);
    expect(made.canvas.dataset.owner).toBe("a");
    expect(made.setClearColor).toHaveBeenLastCalledWith(0x000000, 0);
    expect(aResume).toHaveBeenCalledTimes(1);
    made.canvas.click();
    expect(aClick).toHaveBeenCalledTimes(2);

    stopA();
    a.release();
    expect(made.dispose).toHaveBeenCalledTimes(1);
    expect(made.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(made.canvas.isConnected).toBe(false);
  });

  it("keeps the original one-renderer-per-tool lifecycle while sharing is off", () => {
    const first = fakeRenderer(), second = fakeRenderer();
    const factory = vi.fn()
      .mockReturnValueOnce(first.renderer)
      .mockReturnValueOnce(second.renderer);
    const a = acquireWorldRenderer(document.createElement("div"), { shared: false, rendererFactory: factory });
    const b = acquireWorldRenderer(document.createElement("div"), { shared: false, rendererFactory: factory });
    a.renderer.render({} as THREE.Scene, {} as THREE.Camera);
    b.renderer.render({} as THREE.Scene, {} as THREE.Camera);
    a.release();

    expect(factory).toHaveBeenCalledTimes(2);
    expect(first.render).toHaveBeenCalledTimes(1);
    expect(second.render).toHaveBeenCalledTimes(1);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).not.toHaveBeenCalled();
    b.release();
    expect(second.dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps a focused tool above a remounted house and restores the latest house lease", () => {
    const made = fakeRenderer(), factory = vi.fn(() => made.renderer);
    const oldHouseHost = document.createElement("div"), toolHost = document.createElement("div"), newHouseHost = document.createElement("div");
    const oldHouseConfigure = vi.fn(), toolConfigure = vi.fn(), newHouseConfigure = vi.fn();
    const toolSuspend = vi.fn(), newHouseResume = vi.fn(), newHouseLost = vi.fn();
    const oldHouse = acquireWorldRenderer(oldHouseHost, { shared: true, priority: 0, rendererFactory: factory, configure: oldHouseConfigure });
    const tool = acquireWorldRenderer(toolHost, { shared: true, rendererFactory: factory, configure: toolConfigure, onSuspend: toolSuspend });
    const rendersBeforeRemount = made.render.mock.calls.length;
    const newHouse = acquireWorldRenderer(newHouseHost, { shared: true, priority: 0, rendererFactory: factory, configure: newHouseConfigure, onResume: newHouseResume });
    const stopLost = newHouse.listenCanvas("webglcontextlost", newHouseLost);

    newHouse.renderer.render({} as THREE.Scene, {} as THREE.Camera);
    newHouse.renderer.setPixelRatio(2);
    made.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(factory).toHaveBeenCalledTimes(1);
    expect(tool.active).toBe(true);
    expect(newHouse.active).toBe(false);
    expect(toolHost.firstElementChild).toBe(made.canvas);
    expect(toolSuspend).not.toHaveBeenCalled();
    expect(newHouseConfigure).not.toHaveBeenCalled();
    expect(made.render).toHaveBeenCalledTimes(rendersBeforeRemount);
    expect(made.setPixelRatio).not.toHaveBeenCalled();
    expect(newHouseLost).not.toHaveBeenCalled();

    tool.release();
    expect(newHouse.active).toBe(true);
    expect(oldHouse.active).toBe(false);
    expect(newHouseHost.firstElementChild).toBe(made.canvas);
    expect(newHouseConfigure).toHaveBeenCalledOnce();
    expect(newHouseResume).toHaveBeenCalledOnce();
    made.canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(newHouseLost).toHaveBeenCalledOnce();

    oldHouse.release();
    expect(newHouse.active).toBe(true);
    stopLost();
    newHouse.release();
    expect(made.dispose).toHaveBeenCalledOnce();
    expect(made.forceContextLoss).toHaveBeenCalledOnce();
  });
});

function fakeFrames() {
  let id = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => {
    const next = ++id;
    callbacks.set(next, callback);
    return next;
  });
  const cancel = vi.fn((token: number) => { callbacks.delete(token); });
  return {
    request,
    cancel,
    fire(time = 16) {
      const next = [...callbacks];
      callbacks.clear();
      for (const [, callback] of next) callback(time);
    },
  };
}

describe("world renderer frame scheduler", () => {
  it("coalesces runnable scene callbacks under one native frame and schedules a later tick", async () => {
    const { createWorldFrameScheduler } = await import("../src/house/world/rendererOwner.ts");
    const native = fakeFrames();
    const scheduler = createWorldFrameScheduler(native);
    const first = { active: true, released: false }, second = { active: true, released: false };
    const drew = vi.fn();

    scheduler.request(first, time => { drew("first", time); scheduler.request(first, next => drew("next", next)); });
    scheduler.request(second, time => drew("second", time));
    expect(native.request).toHaveBeenCalledTimes(1);

    native.fire(20);
    expect(drew).toHaveBeenCalledWith("first", 20);
    expect(drew).toHaveBeenCalledWith("second", 20);
    expect(native.request).toHaveBeenCalledTimes(2);

    native.fire(36);
    expect(drew).toHaveBeenCalledWith("next", 36);
  });

  it("drops canceled, suspended, and released lease work without leaving a native frame", async () => {
    const { createWorldFrameScheduler } = await import("../src/house/world/rendererOwner.ts");
    const native = fakeFrames();
    const scheduler = createWorldFrameScheduler(native);
    const canceled = { active: true, released: false }, suspended = { active: true, released: false }, released = { active: true, released: false };
    const drew = vi.fn();

    const canceledId = scheduler.request(canceled, drew);
    scheduler.cancel(canceledId);
    expect(native.cancel).toHaveBeenCalledTimes(1);

    scheduler.request(suspended, drew);
    scheduler.request(released, drew);
    suspended.active = false;
    released.released = true;
    native.fire();
    expect(drew).not.toHaveBeenCalled();
  });

  it("cancels a background lease frame and leaves the foreground lease runnable", () => {
    const native = fakeFrames();
    vi.stubGlobal("requestAnimationFrame", native.request);
    vi.stubGlobal("cancelAnimationFrame", native.cancel);
    try {
      const made = fakeRenderer(), factory = vi.fn(() => made.renderer);
      const back = acquireWorldRenderer(document.createElement("div"), { shared: true, priority: 0, rendererFactory: factory });
      const drawn = vi.fn();
      back.requestFrame(drawn);
      const front = acquireWorldRenderer(document.createElement("div"), { shared: true, priority: 1, rendererFactory: factory });
      expect(native.cancel).toHaveBeenCalledTimes(1);

      front.requestFrame(drawn);
      native.fire();
      expect(drawn).toHaveBeenCalledTimes(1);
      front.release();
      back.requestFrame(drawn);
      native.fire();
      expect(drawn).toHaveBeenCalledTimes(2);
      back.release();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
