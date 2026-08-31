// @vitest-environment jsdom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { DeskPlate } from "../src/DeskPlates.tsx";
import type { DeskPlateModel } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const plate: DeskPlateModel = {
  id: "due",
  kicker: "What is due next",
  verdict: "Rent, tomorrow.",
  footing: "Bills on the 30-day rail.",
  edge: "attention",
  copperVerdict: true,
  figure: { primitive: "track", days: 30, room: 28, marks: [{ day: 2, cents: 185_000, label: "Rent" }] },
  empty: null,
  cabinet: "mail",
  cabinetName: "next bill",
};

describe("desk plate DOM", () => {
  it("swaps on click, opens the cabinet from the handle, and keeps the handle keyboard-reachable", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const seen: string[] = [];
    act(() => {
      root.render(createElement(DeskPlate, {
        plate,
        onSelect: () => seen.push("select"),
        onOpenCabinet: () => seen.push("cabinet"),
      }));
    });
    const article = host.querySelector("[data-plate-id='due']") as HTMLElement;
    const handle = host.querySelector(".desk-plate-handle") as HTMLButtonElement;
    expect(article).toBeTruthy();
    expect(handle.getAttribute("aria-label")).toBe("Open the next bill cabinet");
    act(() => article.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => handle.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => article.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(seen).toEqual(["select", "cabinet", "cabinet"]);
    expect(handle.tabIndex).not.toBe(-1);
    expect(article.getAttribute("aria-current")).toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});
