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
const isFull = () => stage().classList.contains("path-world__stage--full") && !stage().hidden;

// D-283's quiet toggle, reshaped by D-285: on the page it sits in the simple view's upper-left corner and opens the
// world; in the open world the same control is the HUD's minimize button (upper-left).
describe("Journey map full screen toggle", () => {
  it("sits in the simple view's corner and takes the map full screen, then back", async () => {
    await mount();
    const button = toggle();
    expect(button).toBeTruthy();
    const slot = host.querySelector<HTMLElement>("[data-slot='journey-mini']")!;
    expect(button.parentElement).toBe(slot);
    expect(slot.lastElementChild).toBe(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Open the world full screen");
    expect(isFull()).toBe(false);
    button.focus();
    await act(async () => { button.click(); });
    expect(isFull()).toBe(true);
    expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(true);
    // One toggle at a time: the page's corner toggle steps back behind the (inert) page, the HUD's is in front.
    const inWorld = stage().querySelector<HTMLButtonElement>(".path-world__full")!;
    expect(inWorld.closest(".path-hud__corner--start")).toBeTruthy();
    expect(inWorld.getAttribute("aria-pressed")).toBe("true");
    expect(inWorld.getAttribute("aria-label")).toBe("Minimize the world");
    expect(button.closest("[inert]")).toBeTruthy();
    await act(async () => { inWorld.click(); });
    expect(isFull()).toBe(false);
    expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("leaves full screen on Escape and when the tent opens, and asks for native full screen where it exists", async () => {
    const request = vi.fn(() => Promise.resolve());
    const exit = vi.fn(() => Promise.resolve());
    const lock = vi.fn(() => Promise.resolve());
    (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen = request;
    const doc = document as unknown as { exitFullscreen?: unknown };
    const hadExit = "exitFullscreen" in document;
    const savedExit = doc.exitFullscreen;
    doc.exitFullscreen = exit;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => (request.mock.calls.length > exit.mock.calls.length ? document.documentElement : null) });
    (navigator as unknown as { keyboard?: unknown }).keyboard = { lock, unlock: vi.fn() };
    try {
      await mount();
      await act(async () => { toggle().click(); });
      expect(request).toHaveBeenCalledTimes(1);
      // Like a game, Escape stays with the island (so a card can close first).
      expect(lock).toHaveBeenCalledWith(["Escape"]);
      await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
      expect(isFull()).toBe(false);
      expect(exit).toHaveBeenCalledTimes(1);
      await act(async () => { toggle().click(); });
      expect(isFull()).toBe(true);
      const tent = host.querySelector<HTMLButtonElement>(".path-hud .path-world__tent")!;
      expect(tent.getAttribute("aria-label")).toBe("Open the Plan Studio tent");
      await act(async () => { tent.click(); });
      expect(isFull()).toBe(false);
      expect(document.documentElement.classList.contains("path-world-fullscreen")).toBe(false);
      // Leaving the browser's own full screen (its Escape) minimizes too.
      await act(async () => { host.querySelector<HTMLButtonElement>(".path-world__back")!.click(); });
      await act(async () => { toggle().click(); });
      expect(isFull()).toBe(true);
      exit.mockImplementationOnce(() => Promise.resolve());
      await act(async () => { void (document as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen(); document.dispatchEvent(new Event("fullscreenchange")); });
      expect(isFull()).toBe(false);
    } finally {
      delete (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
      delete (document as unknown as { fullscreenElement?: unknown }).fullscreenElement;
      if (hadExit) doc.exitFullscreen = savedExit; else delete doc.exitFullscreen;
      delete (navigator as unknown as { keyboard?: unknown }).keyboard;
    }
  });
});
