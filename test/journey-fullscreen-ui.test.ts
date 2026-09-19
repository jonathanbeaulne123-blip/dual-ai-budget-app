// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitResult, Household } from "../src/core/index.ts";
import { OurPathWorld } from "../src/path/OurPathWorld.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";

vi.mock("../src/path/world/pathWorld3d.ts", () => ({ createPathWorld: () => { throw new Error("WebGL unavailable"); } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.documentElement.classList.remove("path-world-fullscreen"); });

async function mount() {
  const household: Household = planLifeFixture("household");
  const onCommand = async (fn: (h: Household) => CommitResult) => ({ ok: true, household: fn(household).household });
  await act(async () => root.render(createElement(OurPathWorld, {
    household, memberId: "MEM-001", today: "2026-09-11", busy: false, onCommand, theme: "classic",
    classicRoom: createElement("div", { id: "classic" }),
  } as never)));
}
const toggle = () => host.querySelector<HTMLButtonElement>(".path-world__full")!;
const stage = () => host.querySelector<HTMLElement>(".path-world__stage")!;

describe("Journey map full screen toggle", () => {
  it("sits in the stage and takes the map full screen, then back", async () => {
    await mount();
    const button = toggle();
    expect(button).toBeTruthy();
    expect(button.parentElement).toBe(stage());
    expect(stage().firstElementChild?.nextElementSibling).toBe(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Show the map full screen");
    await act(async () => { button.click(); });
    expect(stage().classList.contains("path-world__stage--full")).toBe(true);
    expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(true);
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    expect(toggle().getAttribute("aria-label")).toBe("Leave full screen");
    await act(async () => { toggle().click(); });
    expect(stage().classList.contains("path-world__stage--full")).toBe(false);
    expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(false);
  });

  it("leaves full screen on Escape and when the tent opens, and asks for native full screen where it exists", async () => {
    const request = vi.fn(() => Promise.resolve());
    (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen = request;
    try {
      await mount();
      await act(async () => { toggle().click(); });
      expect(request).toHaveBeenCalledTimes(1);
      await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
      expect(stage().classList.contains("path-world__stage--full")).toBe(false);
      await act(async () => { toggle().click(); });
      const tent = [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes("Open the Plan Studio tent"))!;
      await act(async () => { tent.click(); });
      expect(stage().classList.contains("path-world__stage--full")).toBe(false);
      expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(false);
    } finally {
      delete (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
    }
  });
});
