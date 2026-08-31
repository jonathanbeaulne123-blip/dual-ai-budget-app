// @vitest-environment jsdom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { FAB_ADD_ACTIONS, FabSpeedDial } from "../src/FabSpeedDial.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("FAB add speed dial", () => {
  it("keeps Shift, Income, Expense, and Transfer in that order from the +", () => {
    expect(FAB_ADD_ACTIONS.map((row) => row.mode)).toEqual(["shift", "income", "expense", "transfer"]);
  });

  it("opens a vertical menu from + and picks open Add for that mode without posting", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const picks: string[] = [];
    act(() => {
      root.render(createElement(FabSpeedDial, { onPick: (mode) => { picks.push(mode); } }));
    });
    const fab = host.querySelector("button.fab") as HTMLButtonElement;
    expect(fab).toBeTruthy();
    expect(fab.getAttribute("aria-label")).toBe("Add money");
    expect(fab.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector("[data-fab-dial]")?.getAttribute("data-fab-dial")).toBe("closed");
    act(() => { fab.click(); });
    expect(host.querySelector("[data-fab-dial]")?.getAttribute("data-fab-dial")).toBe("open");
    expect(fab.getAttribute("aria-expanded")).toBe("true");
    expect(fab.getAttribute("aria-label")).toBe("Close add menu");
    const actions = [...host.querySelectorAll<HTMLButtonElement>("[data-fab-action]")];
    expect(actions.map((button) => button.getAttribute("data-fab-action"))).toEqual([
      "shift",
      "income",
      "expense",
      "transfer",
    ]);
    expect(actions.every((button) => (button.getBoundingClientRect().height >= 0))).toBe(true);
    expect(picks).toEqual([]);
    act(() => { actions.find((button) => button.getAttribute("data-fab-action") === "expense")?.click(); });
    expect(picks).toEqual(["expense"]);
    expect(host.querySelector("[data-fab-dial]")?.getAttribute("data-fab-dial")).toBe("closed");
    act(() => root.unmount());
    host.remove();
  });

  it("closes on Escape and when Add is already open", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    function Harness({ closed }: { closed?: boolean }) {
      return createElement(FabSpeedDial, { closed, onPick: () => undefined });
    }
    act(() => {
      root.render(createElement(Harness, { closed: false }));
    });
    const fab = host.querySelector("button.fab") as HTMLButtonElement;
    act(() => { fab.click(); });
    expect(host.querySelector("[data-fab-dial]")?.getAttribute("data-fab-dial")).toBe("open");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(host.querySelector("[data-fab-dial]")?.getAttribute("data-fab-dial")).toBe("closed");
    act(() => { fab.click(); });
    expect(host.querySelector("[data-fab-dial]")?.getAttribute("data-fab-dial")).toBe("open");
    act(() => {
      root.render(createElement(Harness, { closed: true }));
    });
    expect(host.querySelector("[data-fab-dial]")?.getAttribute("data-fab-dial")).toBe("closed");
    act(() => root.unmount());
    host.remove();
  });
});
