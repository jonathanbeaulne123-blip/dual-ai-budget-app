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
  glance: "Rent · tomorrow",
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
  it("grows in place on click, keeps the cabinet on the handle, and hides the handle when closed", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const seen: string[] = [];
    act(() => {
      root.render(createElement(DeskPlate, {
        plate,
        open: false,
        onSelect: () => seen.push("select"),
        onOpenCabinet: () => seen.push("cabinet"),
      }));
    });
    const article = host.querySelector("[data-plate-id='due']") as HTMLElement;
    expect(article).toBeTruthy();
    expect(article.getAttribute("aria-expanded")).toBe("false");
    expect(article.getAttribute("aria-label")).toContain("Rent, tomorrow.");
    expect(article.textContent).toContain("Rent · tomorrow");
    expect(article.textContent).not.toContain("Rent, tomorrow.");
    expect(host.querySelector(".desk-plate-handle")).toBeNull();
    act(() => article.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => {
      root.render(createElement(DeskPlate, {
        plate,
        open: true,
        onSelect: () => seen.push("select"),
        onOpenCabinet: () => seen.push("cabinet"),
      }));
    });
    const handle = host.querySelector(".desk-plate-handle") as HTMLButtonElement;
    expect(article.getAttribute("aria-expanded")).toBe("true");
    expect(article.textContent).toContain("Rent, tomorrow.");
    expect(handle).toBeTruthy();
    expect(handle.getAttribute("aria-label")).toBe("Open the next bill cabinet");
    expect(handle.tabIndex).not.toBe(-1);
    act(() => handle.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => article.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(seen).toEqual(["select", "cabinet", "cabinet"]);
    expect(article.getAttribute("aria-current")).toBeNull();
    act(() => root.unmount());
    host.remove();
  });

  it("draws future spark marks as projected instead of posted", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const sparkPlate: DeskPlateModel = {
      ...plate,
      id: "fund-level",
      figure: { primitive: "spark", points: [1000, 500, -500], actualCount: 1, room: 28 },
    };
    act(() => {
      root.render(createElement(DeskPlate, {
        plate: sparkPlate,
        open: true,
        onSelect: () => undefined,
        onOpenCabinet: () => undefined,
      }));
    });
    const marks = [...host.querySelectorAll(".desk-plate-spark")];
    expect(marks).toHaveLength(3);
    expect(marks[0]!.classList.contains("is-projected")).toBe(false);
    expect(marks[1]!.classList.contains("is-projected")).toBe(true);
    expect(marks[2]!.classList.contains("is-projected")).toBe(true);
    act(() => root.unmount());
    host.remove();
  });
});
