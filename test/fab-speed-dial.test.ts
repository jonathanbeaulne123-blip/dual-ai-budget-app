// @vitest-environment jsdom
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FAB_ADD_ACTIONS, FabSpeedDial, fabDescription } from "../src/FabSpeedDial.tsx";
import { fabActionsFor } from "../src/core/fabActions.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const dial = () => host.querySelector<HTMLElement>("[data-fab-dial]")!;
const bubble = () => host.querySelector<HTMLButtonElement>("button.fab")!;
const rows = () => [...host.querySelectorAll<HTMLButtonElement>("[data-fab-action]")];
const key = (target: Element, name: string) => act(() => { target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true })); });

describe("the Record speed dial (Tool Atlas §3.3)", () => {
  it("lists Purchase · Shift · Income · Bill paid · Move money, nearest the thumb first", () => {
    expect(FAB_ADD_ACTIONS.map((row) => row.label)).toEqual(["Purchase", "Shift", "Income", "Bill paid", "Move money"]);
    expect(FAB_ADD_ACTIONS.map((row) => row.aria)).toEqual([
      "Purchase: record one",
      "Shift: clock in, clock out, or record one",
      "Income: record it",
      "Bill paid: record a bill as paid",
      "Move money between accounts",
    ]);
    expect(fabDescription(FAB_ADD_ACTIONS)).toBe("Purchase, shift, income, bill paid, or move money");
  });

  it("opens from Record with focus on Purchase, and a pick opens Add for that mode without posting", () => {
    const picks: string[] = [];
    const bills: number[] = [];
    const focusAtLaunch: (Element | null)[] = [];
    act(() => root.render(createElement(FabSpeedDial, { onPick: (mode) => { picks.push(mode); focusAtLaunch.push(document.activeElement); }, onBillPaid: () => bills.push(1) })));
    const fab = bubble();
    expect(fab.textContent).toBe("Record");
    expect(fab.getAttribute("aria-label")).toBe("Record");
    expect(fab.getAttribute("aria-haspopup")).toBe("true");
    expect(fab.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(fab.getAttribute("aria-describedby")!)?.textContent).toBe("Purchase, shift, income, bill paid, or move money");
    expect(dial().getAttribute("data-fab-dial")).toBe("closed");
    expect(dial().hasAttribute("data-camera-deadzone")).toBe(false);

    act(() => fab.click());
    expect(dial().getAttribute("data-fab-dial")).toBe("open");
    expect(dial().hasAttribute("data-camera-deadzone")).toBe(true);
    expect(fab.getAttribute("aria-expanded")).toBe("true");
    // The visible word stays when open; the × is decoration.
    expect(fab.getAttribute("aria-label")).toBe("Record");
    expect(fab.querySelector(".record-bubble__close")?.getAttribute("aria-hidden")).toBe("true");
    const group = host.querySelector("[role=group]")!;
    expect(group.getAttribute("aria-label")).toBe("Record");
    expect(host.querySelector("[role=menu], [role=menuitem]")).toBeNull();
    expect(rows().map((button) => button.getAttribute("data-fab-action"))).toEqual(["expense", "shift", "income", "bill", "transfer"]);
    expect(document.activeElement).toBe(rows()[0]);
    for (const row of rows()) {
      expect(row.getAttribute("aria-label")!.startsWith(row.querySelector(".record-dial__label")!.textContent!)).toBe(true);
      expect(row.querySelector("svg title")?.textContent).toBeTruthy();
      expect(row.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
    expect(picks).toEqual([]);
    act(() => rows().find((button) => button.dataset.fabAction === "expense")!.click());
    expect(picks).toEqual(["expense"]);
    expect(focusAtLaunch).toEqual([fab]);
    expect(dial().getAttribute("data-fab-dial")).toBe("closed");

    act(() => fab.click());
    act(() => rows().find((button) => button.dataset.fabAction === "bill")!.click());
    expect(bills).toEqual([1]);
    expect(picks).toEqual(["expense"]);
  });

  it("shows a stable four when Bill paid is not wired, and hides Shift for a member with no job", () => {
    act(() => root.render(createElement(FabSpeedDial, { actions: fabActionsFor("household", { memberHasJob: false }), onPick: () => undefined })));
    act(() => bubble().click());
    expect(rows().map((button) => button.querySelector(".record-dial__label")!.textContent)).toEqual(["Purchase", "Income", "Move money"]);
    act(() => root.render(createElement(FabSpeedDial, { actions: fabActionsFor("household", { memberHasJob: false }), onPick: () => undefined, onBillPaid: () => undefined })));
    expect(rows().map((button) => button.querySelector(".record-dial__label")!.textContent)).toEqual(["Purchase", "Income", "Bill paid", "Move money"]);
    expect(document.getElementById(bubble().getAttribute("aria-describedby")!)?.textContent).toBe("Purchase, income, bill paid, or move money");
  });

  it("moves with ↑/↓, closes on Tab and Escape, and returns focus to the bubble", () => {
    act(() => root.render(createElement(FabSpeedDial, { onPick: () => undefined, onBillPaid: () => undefined })));
    act(() => bubble().click());
    const group = host.querySelector("[role=group]")!;
    key(group, "ArrowUp");
    expect(document.activeElement).toBe(rows()[1]);
    key(group, "ArrowUp");
    expect(document.activeElement).toBe(rows()[2]);
    key(group, "ArrowDown");
    expect(document.activeElement).toBe(rows()[1]);
    key(group, "End");
    expect(document.activeElement).toBe(rows()[4]);
    key(group, "Home");
    expect(document.activeElement).toBe(rows()[0]);
    key(group, "Tab");
    expect(dial().getAttribute("data-fab-dial")).toBe("closed");
    expect(document.activeElement).toBe(bubble());

    act(() => bubble().click());
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(dial().getAttribute("data-fab-dial")).toBe("closed");
    expect(document.activeElement).toBe(bubble());
  });

  it("closes on an outside tap", () => {
    act(() => root.render(createElement(FabSpeedDial, { onPick: () => undefined })));
    act(() => bubble().click());
    act(() => host.querySelector<HTMLButtonElement>(".fab-dial-scrim")!.click());
    expect(dial().getAttribute("data-fab-dial")).toBe("closed");
  });

  it("is shut and inert while an Add sheet is open", () => {
    const opened: boolean[] = [];
    function Harness({ closed }: { closed?: boolean }) {
      return createElement(FabSpeedDial, { closed, onPick: () => undefined, onOpenChange: (open) => opened.push(open) });
    }
    act(() => root.render(createElement(Harness, { closed: false })));
    act(() => bubble().click());
    expect(dial().getAttribute("data-fab-dial")).toBe("open");
    act(() => root.render(createElement(Harness, { closed: true })));
    expect(dial().getAttribute("data-fab-dial")).toBe("closed");
    expect(dial().hasAttribute("inert")).toBe(true);
    expect(opened.at(-1)).toBe(false);
    act(() => root.render(createElement(Harness, { closed: false })));
    expect(dial().hasAttribute("inert")).toBe(false);
  });

  it("mirrors for Record on the left", () => {
    act(() => root.render(createElement(FabSpeedDial, { onPick: () => undefined, mirror: true })));
    expect(dial().classList.contains("is-mirrored")).toBe(true);
    expect(dial().getAttribute("data-fab-mirror")).toBe("left");
  });

  it("keeps the deprecated onGo harmless and never posts", () => {
    const source = readFileSync("src/FabSpeedDial.tsx", "utf8");
    expect(source).not.toMatch(/postEntry|postTransfer|postShift|postOneRecurrence|captureCommand/);
    expect(source).not.toMatch(/kind === "go"|role="menu"/);
    const css = readFileSync("src/fab-speed-dial.css", "utf8");
    expect(css).toMatch(/min-height: 48px/);
    for (const theme of ["classic", "taylor", "newfoundland"]) expect(css).toContain(`:root[data-theme="${theme}"] .fab-dial`);
    expect(css).toMatch(/forced-colors: active/);
  });
});
