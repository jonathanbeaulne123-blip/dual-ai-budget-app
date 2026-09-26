// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

it("steps aside while the island's glass stands, and tells the App an open Record has shut", async () => {
  // Restored with its guard (review finding 11): the dial leaving while open must not strand the App's fabOpen.
  const opened: boolean[] = [];
  const fab = { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: (open: boolean) => opened.push(open), onPick: () => undefined, onGo: () => undefined };
  const render = (island: boolean) => root.render(createElement("div", null, createElement(Compass, props({ fab })), createElement(IslandBar, { on: island })));
  await act(async () => render(false));
  expect(host.querySelector("nav.compass")).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>("button.fab")!.click());
  expect(opened).toEqual([true]);
  await act(async () => render(true));
  expect(host.querySelector("nav.compass")).toBeNull();
  // Record left while open: the App hears it shut.
  expect(opened).toEqual([true, false]);
  await act(async () => render(false));
  expect(host.querySelector("nav.compass")).not.toBeNull();
  // A closed dial that leaves says nothing more.
  await act(async () => render(true));
  expect(opened).toEqual([true, false]);
});

it("keeps 44px targets: every bubble and the Record circle are at least 44 px at every width, the verbs 48 px", async () => {
  await act(async () => root.render(createElement(Compass, props())));
  const nav = host.querySelector<HTMLElement>("nav.compass")!;
  // The door edition's three targets are the glass classes the stylesheet sizes…
  expect(nav.querySelectorAll("[data-glass-bubble='flip'] button.glass-bubble, [data-glass-bubble='tools'] button.glass-bubble").length).toBe(2);
  expect(nav.querySelector("[data-glass-bubble='record'] .glass-bubble--host button.fab")).not.toBeNull();
  // …and the stylesheet never sizes them under 44 px (jsdom does not lay out, so the CSS is the evidence).
  const css = readFileSync(join(process.cwd(), "src/harbour/bubbles/bubbles.css"), "utf8");
  const sizes = [...css.matchAll(/--glass-size:\s*(\d+)px/g)].map((match) => Number(match[1]));
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(44);
  const rule = (selector: string) => { const at = css.indexOf(selector); expect(at, selector).toBeGreaterThanOrEqual(0); return css.slice(at, css.indexOf("}", at)); };
  for (const selector of [".glass-bubble {", ".glass-bubble-anchor.glass-bubble-anchor--record .glass-bubble--host .fab,"]) {
    expect(rule(selector)).toContain("min-width: var(--glass-size);");
    expect(rule(selector)).toContain("min-height: var(--glass-size);");
  }
  const verbs = rule(".glass-bubble-anchor.glass-bubble-anchor--record .fab-dial .fab-dial-action {");
  expect(verbs).toContain("min-height: 48px;");
  expect(verbs).toContain("min-width: 48px;");
});
