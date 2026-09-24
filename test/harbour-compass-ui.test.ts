// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import { Compass, useIslandBar, type CompassProps } from "../src/harbour/nav/Compass.tsx";

/**
 * The Compass's district row retired (Simple View Desk S1). What the file keeps
 * is the bar's door edition — [Simple view] [+] [All tools] — which the App
 * mounts for every household harbour route and which steps aside while the
 * island's own bar stands.
 */
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); window.localStorage.clear(); });

function props(overrides: Partial<CompassProps> = {}): CompassProps {
  return {
    fab: { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: () => undefined, onPick: () => undefined, onGo: () => undefined },
    onQuickSheet: () => undefined,
    ...overrides,
  };
}

it("has no district row any more: flip, the household +, All tools — in that order", async () => {
  await act(async () => root.render(createElement(Compass, props())));
  const nav = host.querySelector("nav.compass")!;
  expect(nav.getAttribute("aria-label")).toBe("Harbour bar");
  expect(nav.getAttribute("data-harbour-bar")).toBe("door");
  expect(nav.querySelectorAll("[data-compass-district]").length).toBe(0);
  expect(nav.textContent).not.toMatch(/Study|Kitchen|Making|Together/);
  const order = [...nav.children].map((node) => node.className.split(" ")[0]);
  expect(order).toEqual(["edition-flip", "fab-dial", "harbour-bar__tools"]);
  const fab = nav.querySelector<HTMLButtonElement>("button.fab")!;
  expect(fab.textContent).toBe("+");
  expect(fab.getAttribute("aria-label")).toBe(fabClosedLabel("household"));
  expect(nav.querySelector(".edition-flip")?.getAttribute("aria-label")).toBe("Switch to the simple view");
});

it("keeps 44px targets and opens the quick sheet from All tools and a swipe up", async () => {
  const taps: string[] = [];
  await act(async () => root.render(createElement(Compass, props({ onQuickSheet: () => taps.push("sheet") }))));
  for (const button of host.querySelectorAll<HTMLButtonElement>(".edition-flip, .harbour-bar__tools")) {
    expect(button.style.minHeight).toBe("44px");
    expect(button.style.minWidth).toBe("44px");
  }
  const tools = host.querySelector<HTMLButtonElement>(".harbour-bar__tools")!;
  expect(tools.getAttribute("aria-label")).toBe("All tools");
  await act(async () => tools.click());
  const nav = host.querySelector("nav.compass")!;
  const touch = (type: string, y: number, key: "touches" | "changedTouches") => {
    const event = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
    event[key] = [{ clientX: 100, clientY: y }];
    return event;
  };
  await act(async () => { nav.dispatchEvent(touch("touchstart", 600, "touches")); nav.dispatchEvent(touch("touchend", 540, "changedTouches")); });
  // A sideways drag is not a swipe up.
  await act(async () => { nav.dispatchEvent(touch("touchstart", 600, "touches")); nav.dispatchEvent(touch("touchend", 590, "changedTouches")); });
  expect(taps).toEqual(["sheet", "sheet"]);
});

it("renders the same FabSpeedDial verbs the classic nav does and forwards picks in two presses", async () => {
  const picked: string[] = [];
  const opened: boolean[] = [];
  await act(async () => root.render(createElement(Compass, props({ fab: { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: (open) => opened.push(open), onPick: (mode) => picked.push(mode), onGo: (tab) => picked.push(`go:${tab}`) } }))));
  await act(async () => host.querySelector<HTMLButtonElement>("button.fab")!.click());
  expect(opened).toEqual([true]);
  const labels = [...host.querySelectorAll<HTMLButtonElement>("[data-fab-action]")].map((b) => b.textContent);
  expect(labels).toEqual(fabActionsFor("household", "home").map((action) => action.label));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-fab-action="expense"]')!.click());
  expect(picked).toEqual(["expense"]);
  expect(opened).toEqual([true, false]);
});

function IslandBar({ on }: { on: boolean }) { useIslandBar(on); return null; }

it("steps aside while the island's bar stands, and tells the App an open + has shut", async () => {
  const opened: boolean[] = [];
  const fab = { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: (open: boolean) => opened.push(open), onPick: () => undefined, onGo: () => undefined };
  const render = (island: boolean) => root.render(createElement("div", null, createElement(Compass, props({ fab })), createElement(IslandBar, { on: island })));
  await act(async () => render(false));
  expect(host.querySelector("nav.compass")).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>("button.fab")!.click());
  expect(opened).toEqual([true]);
  await act(async () => render(true));
  expect(host.querySelector("nav.compass")).toBeNull();
  // The + left while open: the App's fabOpen is not stranded.
  expect(opened).toEqual([true, false]);
  await act(async () => render(false));
  expect(host.querySelector("nav.compass")).not.toBeNull();
});
