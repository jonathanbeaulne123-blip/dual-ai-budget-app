// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openChapter, type Household } from "../src/core/index.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import type { BoardPhoto } from "../src/core/sharedBoards.ts";
import { PathMiniMap } from "../src/path/PathMiniMap.tsx";
import { memoryPhotoMatches } from "../src/path/memoryPhotos.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const TODAY = "2026-09-15";
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

function household(): Household {
  const h = planLifeFixture("household");
  return openChapter(h, { memberId: "MEM-001", foundationId: "make-rent-boring", at: "2026-07-01T12:00:00.000Z" }).household;
}

describe("PathMiniMap — the island in miniature", () => {
  it("draws one dot per month, the walkers on the newest, and stays decoration", async () => {
    const h = household();
    const months = pathMonths(h, TODAY);
    expect(months.length).toBeGreaterThanOrEqual(3);
    await act(async () => root.render(createElement(PathMiniMap, { household: h, today: TODAY, size: 160, theme: "newfoundland" })));
    const svg = host.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.classList.contains("path-minimap--newfoundland")).toBe(true);
    expect(svg.getAttribute("width")).toBe("160");
    const dots = [...svg.querySelectorAll(".path-world__dot")];
    expect(dots).toHaveLength(months.length);
    const us = svg.querySelector(".path-world__us")!;
    expect(us.querySelectorAll("circle")).toHaveLength(2);
    const last = dots.at(-1)!;
    expect(us.getAttribute("transform")).toBe(`translate(${Number(last.getAttribute("cx")).toFixed(2)} ${Number(last.getAttribute("cy")).toFixed(2)})`);
    expect(svg.querySelector(".path-minimap__shore")).toBeTruthy();
    expect(svg.querySelector("button, a, [tabindex]")).toBeNull();
    // Everything fits the window.
    for (const dot of dots) {
      expect(Math.abs(Number(dot.getAttribute("cx")))).toBeLessThan(60);
      expect(Math.abs(Number(dot.getAttribute("cy")))).toBeLessThan(60);
    }
  });

  it("stands the walkers on the month it is given", async () => {
    await act(async () => root.render(createElement(PathMiniMap, { household: household(), today: TODAY, shown: 0 })));
    const dots = [...host.querySelectorAll(".path-world__dot")];
    expect(dots).toHaveLength(1);
    expect(host.querySelector(".path-world__us")!.getAttribute("transform")).toBe(`translate(${Number(dots[0]!.getAttribute("cx")).toFixed(2)} ${Number(dots[0]!.getAttribute("cy")).toFixed(2)})`);
  });
});

describe("memoryPhotoMatches — which board photo hangs on which Memory flag", () => {
  const photo = (slot: 1 | 2 | 3, mediaId: string | null, caption: string): BoardPhoto => ({ id: `BOARD-PHOTO-${slot}`, version: 1, createdBy: "MEM-001", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", mediaId, caption, crop: { x: 50, y: 50, zoom: 1 } });
  const memory = (id: string, title: string, day: string) => ({ id, title, shownAt: `2026-${day}T12:00:00.000Z` });

  it("matches captions by title first, then hands spare photos in slot order to the three newest Memories", () => {
    const memories = [memory("A", "Shore day", "05-01"), memory("B", "Keys", "06-01"), memory("C", "Garden", "07-01"), memory("D", "Snow", "08-01"), memory("E", "Old one", "01-01")];
    const photos = [photo(3, "m3", "Planting the GARDEN"), photo(1, "m1", "Porch"), photo(2, "m2", "Kitchen")];
    const out = memoryPhotoMatches(memories, photos);
    expect(out.get("C")).toEqual({ mediaId: "m3", caption: "Planting the GARDEN" });
    // Spare photos 1 then 2 go to the newest unmatched of the three newest (D, then B).
    expect(out.get("D")?.mediaId).toBe("m1");
    expect(out.get("B")?.mediaId).toBe("m2");
    expect(out.has("A")).toBe(false);
    expect(out.has("E")).toBe(false);
  });

  it("never matches an empty photo space, and a very short title never matches by caption", () => {
    const out = memoryPhotoMatches([memory("A", "Us", "05-01")], [photo(1, null, "Us at the lake")]);
    expect(out.size).toBe(0);
    const spare = memoryPhotoMatches([memory("A", "Us", "05-01")], [photo(2, "m2", "Us at the lake")]);
    expect(spare.get("A")?.mediaId).toBe("m2");
  });
});
