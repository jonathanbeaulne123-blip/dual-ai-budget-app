// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import { Compass, useIslandBar, type CompassProps } from "../src/harbour/nav/Compass.tsx";

/**
 * The bar's door edition (Tool Atlas brief §6): [Simple view] [Record] [All
 * tools], Record centred — the island's three glass bubbles laid out as a bar.
 * The App mounts it for every household harbour route; it steps aside while
 * the island's own glass stands.
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

it("has no district row: Simple view, Record, All tools — Record in the centre", async () => {
  await act(async () => root.render(createElement(Compass, props())));
  const nav = host.querySelector<HTMLElement>("nav.compass")!;
  expect(nav.getAttribute("aria-label")).toBe("Harbour bar");
  expect(nav.getAttribute("data-harbour-bar")).toBe("door");
  expect(nav.querySelectorAll("[data-compass-district]").length).toBe(0);
  expect(nav.textContent).not.toMatch(/Study|Kitchen|Making|Together/);
  expect([...nav.querySelectorAll<HTMLElement>("[data-glass-bubble]")].map((node) => node.dataset.glassBubble)).toEqual(["flip", "record", "tools"]);
  const record = nav.querySelector<HTMLButtonElement>("button.fab")!;
  expect(record.getAttribute("aria-label")).toBe("Record");
  expect(nav.querySelector("[data-glass-flip]")?.textContent).toContain("Simple view");
  // No pawprint on All tools, ever (brief §3.4).
  expect(nav.querySelector("[data-bar-pawprint]")).toBeNull();
});

it("opens All tools from its bubble and from a swipe up", async () => {
  const taps: string[] = [];
  await act(async () => root.render(createElement(Compass, props({ onQuickSheet: () => taps.push("sheet") }))));
  const tools = host.querySelector<HTMLButtonElement>("[data-glass-tools]")!;
  expect(tools.getAttribute("aria-label")).toBe("All tools and search");
  expect(tools.getAttribute("aria-haspopup")).toBe("dialog");
  await act(async () => tools.click());
  const nav = host.querySelector("nav.compass")!;
  const touch = (type: string, y: number, key: "touches" | "changedTouches") => {
    const event = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
    event[key] = [{ clientX: 100, clientY: y }];
    return event;
  };
  await act(async () => { nav.dispatchEvent(touch("touchstart", 600, "touches")); nav.dispatchEvent(touch("touchend", 540, "changedTouches")); });
  // A small drag is not a swipe up.
  await act(async () => { nav.dispatchEvent(touch("touchstart", 600, "touches")); nav.dispatchEvent(touch("touchend", 590, "changedTouches")); });
  expect(taps).toEqual(["sheet", "sheet"]);
});

it("renders the App's FabSpeedDial verbs inside Record and forwards a pick in two presses", async () => {
  const picked: string[] = [];
  await act(async () => root.render(createElement(Compass, props({ fab: { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: () => undefined, onPick: (mode) => picked.push(mode), onGo: (tab) => picked.push(`go:${tab}`) } }))));
  await act(async () => host.querySelector<HTMLButtonElement>("button.fab")!.click());
  const labels = [...host.querySelectorAll<HTMLButtonElement>("[data-fab-action] .record-dial__label")].map((b) => b.textContent);
  // Bill paid appears only when the App passes `onBillPaid` (GlassFab.onBillPaid).
  expect(labels).toEqual(fabActionsFor("household", "home").filter((action) => action.mode !== "bill").map((action) => action.label));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-fab-action="expense"]')!.click());
  expect(picked).toEqual(["expense"]);
});

function IslandBar({ on }: { on: boolean }) { useIslandBar(on); return null; }

it("steps aside while the island's glass stands", async () => {
  const render = (island: boolean) => root.render(createElement("div", null, createElement(Compass, props()), createElement(IslandBar, { on: island })));
  await act(async () => render(false));
  expect(host.querySelector("nav.compass")).not.toBeNull();
  await act(async () => render(true));
  expect(host.querySelector("nav.compass")).toBeNull();
  await act(async () => render(false));
  expect(host.querySelector("nav.compass")).not.toBeNull();
});
