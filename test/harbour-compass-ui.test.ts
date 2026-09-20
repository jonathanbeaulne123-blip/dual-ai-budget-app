// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import { Compass, compassDistrict, type CompassProps } from "../src/harbour/nav/Compass.tsx";

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

function props(overrides: Partial<CompassProps> = {}): CompassProps {
  return {
    route: { room: "home", level: "middle" },
    onHome: () => undefined, onStudy: () => undefined, onKitchen: () => undefined, onMaking: () => undefined, onTogether: () => undefined,
    fab: { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: () => undefined, onPick: () => undefined, onGo: () => undefined },
    onStatus: () => undefined, onHercules: () => undefined, onQuickSheet: () => undefined,
    ...overrides,
  };
}

it("shows the five districts and the household + in the classic order", async () => {
  await act(async () => root.render(createElement(Compass, props())));
  const nav = host.querySelector("nav.compass")!;
  expect(nav.getAttribute("aria-label")).toBe("Compass");
  expect([...nav.querySelectorAll(".compass__district")].map((b) => b.textContent)).toEqual(["Home", "Study", "Kitchen", "Making", "Together"]);
  const fab = nav.querySelector<HTMLButtonElement>("button.fab")!;
  expect(fab.textContent).toBe("+");
  expect(fab.getAttribute("aria-label")).toBe(fabClosedLabel("household"));
  // The + sits between Kitchen and Making so the grid centres it (3 | + | 2).
  const order = [...nav.children].map((node) => node.className.split(" ")[0]);
  expect(order.indexOf("fab-dial")).toBe(order.indexOf("compass__district") + 3);
});

it("marks the district that owns the route with aria-current=page", async () => {
  await act(async () => root.render(createElement(Compass, props({ route: { room: "kitchen-table", level: "below" } }))));
  const current = host.querySelectorAll('[aria-current="page"]');
  expect(current.length).toBe(1);
  expect(current[0]!.textContent).toBe("Kitchen");
  await act(async () => root.render(createElement(Compass, props({ route: { room: "together", level: "middle", surface: "pottery" } }))));
  expect(host.querySelector('[aria-current="page"]')?.textContent).toBe("Making");
  expect(compassDistrict({ room: "together", level: "middle" })).toBe("together");
  expect(compassDistrict({ room: "home", level: "above", surface: "loft-banks" })).toBe("home");
  expect(compassDistrict({ room: "together", level: "middle", surface: "hercules" })).toBe("making");
});

it("keeps every target at least 44px and routes taps to the district callbacks", async () => {
  const taps: string[] = [];
  await act(async () => root.render(createElement(Compass, props({
    onHome: () => taps.push("home"), onStudy: () => taps.push("study"), onKitchen: () => taps.push("kitchen"), onMaking: () => taps.push("making"), onTogether: () => taps.push("together"),
    onQuickSheet: () => taps.push("sheet"),
  }))));
  for (const button of host.querySelectorAll<HTMLButtonElement>(".compass__district, .compass__handle")) {
    expect(button.style.minHeight).toBe("44px");
    expect(button.style.minWidth).toBe("44px");
  }
  for (const button of host.querySelectorAll<HTMLButtonElement>(".compass__district")) await act(async () => button.click());
  const handle = host.querySelector<HTMLButtonElement>(".compass__handle")!;
  expect(handle.getAttribute("aria-label")).toBe("All tools");
  await act(async () => handle.click());
  expect(taps).toEqual(["home", "study", "kitchen", "making", "together", "sheet"]);
});

it("renders the same FabSpeedDial verbs the classic nav does and forwards picks", async () => {
  const picked: string[] = [];
  const opened: boolean[] = [];
  await act(async () => root.render(createElement(Compass, props({ fab: { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: (open) => opened.push(open), onPick: (mode) => picked.push(mode), onGo: (tab) => picked.push(`go:${tab}`) } }))));
  const fab = host.querySelector<HTMLButtonElement>("button.fab")!;
  await act(async () => fab.click());
  expect(opened).toEqual([true]);
  const labels = [...host.querySelectorAll<HTMLButtonElement>("[data-fab-action]")].map((b) => b.textContent);
  expect(labels).toEqual(fabActionsFor("household", "home").map((action) => action.label));
  const expense = host.querySelector<HTMLButtonElement>('[data-fab-action="expense"]')!;
  await act(async () => expense.click());
  expect(picked).toEqual(["expense"]);
});

it("opens the quick sheet on a swipe up from the compass", async () => {
  const taps: string[] = [];
  await act(async () => root.render(createElement(Compass, props({ onQuickSheet: () => taps.push("sheet") }))));
  const nav = host.querySelector("nav.compass")!;
  const touch = (type: string, y: number, key: "touches" | "changedTouches") => {
    const event = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
    event[key] = [{ clientX: 100, clientY: y }];
    return event;
  };
  await act(async () => { nav.dispatchEvent(touch("touchstart", 600, "touches")); nav.dispatchEvent(touch("touchend", 540, "changedTouches")); });
  expect(taps).toEqual(["sheet"]);
  // A sideways drag is not a swipe up.
  await act(async () => { nav.dispatchEvent(touch("touchstart", 600, "touches")); nav.dispatchEvent(touch("touchend", 590, "changedTouches")); });
  expect(taps).toEqual(["sheet"]);
});
