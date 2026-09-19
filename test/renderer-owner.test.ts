// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type * as THREE from "three";
import { acquireWorldRenderer } from "../src/house/world/rendererOwner.ts";

function fakeRenderer() {
  const canvas = document.createElement("canvas");
  const render = vi.fn();
  const dispose = vi.fn();
  const forceContextLoss = vi.fn();
  const renderer = {
    domElement: canvas,
    render,
    dispose,
    forceContextLoss,
    setPixelRatio: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
  } as unknown as THREE.WebGLRenderer;
  return { renderer, canvas, render, dispose, forceContextLoss };
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
      configure: (renderer) => { renderer.domElement.dataset.owner = "a"; },
      onSuspend: aSuspend,
      onResume: aResume,
    });
    const stopA = a.listenCanvas("click", aClick);
    a.renderer.render({} as THREE.Scene, {} as THREE.Camera);
    made.canvas.click();

    const b = acquireWorldRenderer(bHost, {
      shared: true,
      rendererFactory: factory,
      configure: (renderer) => { renderer.domElement.dataset.owner = "b"; },
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
    expect(made.render).toHaveBeenCalledTimes(2);
    expect(aClick).toHaveBeenCalledTimes(1);
    expect(bClick).toHaveBeenCalledTimes(1);

    stopB();
    b.release();
    expect(a.active).toBe(true);
    expect(aHost.firstElementChild).toBe(made.canvas);
    expect(made.canvas.dataset.owner).toBe("a");
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
});

