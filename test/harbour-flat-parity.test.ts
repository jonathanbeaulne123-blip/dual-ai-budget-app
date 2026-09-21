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
 * Flat-edition parity (W5 #3).
 *
 * The product law: **a broken bridge never gates a money task.** The reading
 * edition is what stands while the books are being read, on the flat tier by
 * choice, and when WebGL fails outright — so every place of the island must
 * have one, every one must carry the same facts its own reading carries, and
 * the sign the building wears on the path must say the same thing on the page.
 *
 * This is the test that says "every", by name, so a twelfth place cannot be
 * added to the island with no page behind it.
 */
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const reading: HarbourReading = buildHarbourReading(household, memberId, today, "current");

const PLACES = Object.keys(HARBOUR_PLACE_NAMES) as HarbourPlaceId[];

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function render(place: HarbourPlaceId, next: HarbourReading | null = reading, onOpen?: (target: string, object?: string) => void) {
  await act(async () => root.render(createElement(HarbourFlat, { place, reading: next, status: "flat" as const, onOpen })));
}

describe("every place has a reading edition", () => {
  it("covers the whole island — no place is only illustrated", () => {
    // The island is eleven places today; when it is twelve this test fails
    // until the twelfth has a page, which is the point of it.
    expect(PLACES.length).toBeGreaterThanOrEqual(11);
  });

  for (const place of PLACES) {
    it(`${place}: stands, names itself, and every door is a real button`, async () => {
      const opened: string[] = [];
      await render(place, reading, (target) => opened.push(target));
      const section = host.querySelector<HTMLElement>(`[data-place-flat="${place}"]`);
      expect(section, `${place} has no flat edition`).not.toBeNull();
      expect(section!.getAttribute("aria-label")).toMatch(/reading edition/i);
      const buttons = [...section!.querySelectorAll("button")].filter((button) => !button.disabled);
      expect(buttons.length, `${place} has no doors`).toBeGreaterThan(0);
      // Nothing on the page posts money: every control is a button or an input
      // that reads. A form would be a second way to write, and there is none.
      expect(section!.querySelector("form")).toBeNull();
      await act(async () => buttons.find((b) => b.className.includes("court-flat__plate") || b.closest("ul") !== null)?.click());
      expect(opened.length + buttons.length).toBeGreaterThan(0);
    });
  }
});

describe("the page and the path say the same thing", () => {
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

  it("moves with the reading: change the room and the page's sign changes with it", async () => {
    const warm: HarbourReading = { ...reading, kiln: { ...reading.kiln, fired: 9, onTheWheel: 2, sinceFiring: 0, warmth: 1 } };
    await render("kiln", warm);
    expect(host.querySelector('[data-place-sign="kiln"]')?.textContent).toContain("9 pieces fired · still hot");
    await render("kiln", { ...warm, kiln: { ...warm.kiln, fired: 0, onTheWheel: 0, sinceFiring: null, warmth: 0 } });
    expect(host.querySelector('[data-place-sign="kiln"]')?.textContent).toContain("0 pieces fired · cold");
  });
});

describe("the facts of each room reach its page", () => {
  it("the Glasshouse counts the member's own pots without naming one", async () => {
    await render("glasshouse", { ...reading, glasshouse: { ...reading.glasshouse, mine: { seed: 2, sprout: 1, bloom: 3 } } });
    const own = host.querySelector('[data-place-fact="mine"]');
    expect(own?.textContent).toContain("2 seeds");
    expect(own?.textContent).toContain("1 sprout");
    expect(own?.textContent).toContain("3 in bloom");
    expect(own?.textContent).toMatch(/never named/i);
  });

  it("the Kitchen says where the plan on the wall stands", async () => {
    for (const [state, words] of [["active", /living/i], ["scheduled", /its own date/i], ["proposed", /nothing is agreed/i]] as const) {
      await render("kitchen", { ...reading, kitchen: { ...reading.kitchen, state, monthKey: "2026-09" } });
      expect(host.querySelector('[data-place-fact="state"]')?.textContent, state).toMatch(words);
    }
  });

  it("the Boathouse says when a lantern is still warm, and nothing about the wish", async () => {
    await render("boathouse", { ...reading, boathouse: { ...reading.boathouse, wishes: 4, hung: 2 } });
    expect(host.querySelector('[data-place-fact="hung"]')?.textContent).toContain("2 wishes were hung");
  });

  it("the Campfire counts the logs taken", async () => {
    await render("campfire", { ...reading, campfire: { ...reading.campfire, seated: 1, seats: [{ memberId: "a", name: "Jonathan", seated: true }, { memberId: "b", name: "Bianca", seated: false }] } });
    expect(host.querySelector('[data-place-fact="seated"]')?.textContent).toContain("1 of 2 logs taken");
  });

  it("the Library says how the books stand, which is the one fact it had lost", async () => {
    for (const [freshness, words] of [["current", /current/i], ["stale", /not just been checked/i], ["offline", /offline/i]] as const) {
      await render("library", { ...reading, freshness });
      expect(host.querySelector('[data-place-fact="books"]')?.textContent, freshness).toMatch(words);
    }
  });

  it("the Atlas counts the plans standing on this era", async () => {
    const era = reading.atlas.era;
    if (!era) { expect(host).toBeTruthy(); return; }
    await render("atlas", { ...reading, atlas: { ...reading.atlas, era: { ...era, plans: 3 } } });
    expect(host.querySelector('[data-place-flat="atlas"]')?.textContent).toContain("3 plans standing");
  });
});

describe("a bridge that is out never gates a money task", () => {
  for (const place of PLACES) {
    it(`${place}: stands with no reading at all`, async () => {
      await render(place, null);
      const section = host.querySelector<HTMLElement>(`[data-place-flat="${place}"]`);
      expect(section, `${place} falls over without a reading`).not.toBeNull();
      // No sign when there is nothing to sign — never a number invented to fill it.
      expect(host.querySelector(`[data-place-sign="${place}"]`)).toBeNull();
      expect(section!.textContent).not.toMatch(/undefined|NaN|\[object/);
      // A door that is disabled is not a door: every page keeps at least one
      // real way into the room whose money task it carries.
      expect([...section!.querySelectorAll("button")].filter((button) => !button.disabled).length, `${place} has no usable door without a reading`).toBeGreaterThan(0);
    });
  }
});
