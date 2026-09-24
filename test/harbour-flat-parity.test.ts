// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading, type HarbourReading } from "../src/harbour/data/reading.ts";
import { HARBOUR_PLACE_NAMES, type HarbourPlaceId } from "../src/harbour/flag.ts";
import { placeSigns } from "../src/harbour/nav/doorSigns.ts";
import { HarbourFlat } from "../src/harbour/flat/PlaceFlat.tsx";

/**
 * The light flat frame (W5 #3, narrowed by SIMPLE_VIEW_DESK S6).
 *
 * The per-place reading editions retired: at rest with no WebGL world the Desk
 * stands in every place and carries every money task (`desk-routing.test.ts`).
 * What is left is the light frame the App's Suspense fallback, the loading
 * overlay and the band behind an open tool stand — and it must still stand in
 * every place, name itself, and say the same words the sign on the path says.
 */
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const reading: HarbourReading = buildHarbourReading(household, memberId, today, "current");

const PLACES = Object.keys(HARBOUR_PLACE_NAMES) as HarbourPlaceId[];

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function render(place: HarbourPlaceId, next: HarbourReading | null = reading, status: "loading" | "flat" | "fallback" = "flat") {
  await act(async () => root.render(createElement(HarbourFlat, { place, reading: next, status })));
}

describe("every place has a light frame", () => {
  it("covers the whole island", () => {
    expect(PLACES.length).toBeGreaterThanOrEqual(11);
  });

  for (const place of PLACES) {
    it(`${place}: stands and names itself, with nothing on it that could write`, async () => {
      await render(place);
      const section = host.querySelector<HTMLElement>(`[data-place-flat="${place}"]`);
      expect(section, `${place} has no frame`).not.toBeNull();
      expect(section!.getAttribute("aria-label")).toMatch(/reading edition/i);
      expect(section!.querySelector("form, input, button")).toBeNull();
    });
  }

  it("says it is being built while loading, and says so honestly when the draw failed", async () => {
    await render("tower", null, "loading");
    const loading = host.querySelector<HTMLElement>("[data-place-flat='tower']")!;
    expect(loading.dataset.courtFlat).toBe("loading");
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.textContent).toContain("The Loft is being built");
    await render("cellar", reading, "fallback");
    const fallback = host.querySelector<HTMLElement>("[data-place-flat='cellar']")!;
    expect(fallback.getAttribute("aria-busy")).toBeNull();
    expect(fallback.textContent).toContain("Reading edition · The Cellar could not be drawn");
  });
});

describe("the frame and the path say the same thing", () => {
  for (const place of PLACES) {
    it(`${place}: carries its door sign, word for word`, async () => {
      await render(place);
      const sign = host.querySelector<HTMLElement>(`[data-place-sign="${place}"]`);
      expect(sign, `${place} carries no door sign`).not.toBeNull();
      const expected = placeSigns(reading)[place];
      expect(sign!.textContent).toContain(expected.line);
      expect(sign!.getAttribute("aria-label")).toBe(expected.aria);
    });
  }

  it("moves with the reading: change the room and the frame's sign changes with it", async () => {
    const warm: HarbourReading = { ...reading, kiln: { ...reading.kiln, fired: 9, onTheWheel: 2, sinceFiring: 0, warmth: 1 } };
    await render("kiln", warm);
    expect(host.querySelector('[data-place-sign="kiln"]')?.textContent).toContain("9 pieces fired · still hot");
    await render("kiln", { ...warm, kiln: { ...warm.kiln, fired: 0, onTheWheel: 0, sinceFiring: null, warmth: 0 } });
    expect(host.querySelector('[data-place-sign="kiln"]')?.textContent).toContain("0 pieces fired · cold");
  });
});

describe("a frame with no reading yet (the Suspense fallback)", () => {
  for (const place of PLACES) {
    it(`${place}: stands with no reading at all, and invents no sign`, async () => {
      await render(place, null, "loading");
      const section = host.querySelector<HTMLElement>(`[data-place-flat="${place}"]`);
      expect(section, `${place} falls over without a reading`).not.toBeNull();
      expect(host.querySelector(`[data-place-sign="${place}"]`)).toBeNull();
      expect(section!.textContent).not.toMatch(/undefined|NaN|\[object|\$0/);
    });
  }
});
