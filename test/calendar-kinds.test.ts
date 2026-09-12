// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CalendarPage } from "../src/Calendar.tsx";
import { CALENDAR_KINDS, KIND_LAYERS, KIND_REGISTRY, calendarKindLabel, kindClassNames, kindLayerFor, kindsPresent } from "../src/calendar/semantics.ts";
import { calendarItemVisible, calendarLayers } from "../src/calendar/visibility.ts";
import { endDateFromGoogleEvent, googleRunLength, overlayFromGoogleEvent } from "../src/calendar/google.ts";
import { buildMonthBoard, catalogHousehold, type Household } from "../src/core/index.ts";
import type { BoardItem, BoardKind } from "../src/core/board.ts";
import type { NativeEvent } from "../src/core/nativeEvents.ts";
import { KIND_HUES, kindHueTokens, NEWFOUNDLAND_SCENES, TAYLOR_SCENES, sceneTokens } from "../src/theme/scenes.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ALL_KINDS: BoardKind[] = ["other", "bill", "subscription", "paycheck", "detected", "potential-expense", "shift", "shift-envelope", "google", "claim", "visit", "event", "work-pay", "work-tip", "work-tipout"];
const event = (patch: Partial<NativeEvent> = {}): NativeEvent => ({ version: 1, id: "EVENT-trip", revision: 1, createdBy: "MEM-001", visibility: "household", title: "Cabin weekend", start: "2026-09-11", end: "2026-09-13", allDay: true, timezone: "America/Toronto", fold: "earlier", repeat: "none", until: null, location: "", notes: "", exceptions: {}, deleted: false, createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", ...patch });

describe("Kind registry — one meaning for glyph, word, hue, layer", () => {
  it("covers every board kind and keeps every layer in the filter list", () => {
    for (const kind of ALL_KINDS) {
      const entry = KIND_REGISTRY[kind];
      expect(entry, kind).toBeDefined();
      expect(KIND_LAYERS.some(([layer]) => layer === entry.layer), `${kind} layer ${entry.layer}`).toBe(true);
      expect(CALENDAR_KINDS[kind]).toBe(`${entry.glyph} ${entry.word}`);
      expect(calendarKindLabel(kind)).toBe(CALENDAR_KINDS[kind]);
    }
    expect(calendarLayers).toBe(KIND_LAYERS);
  });
  it("never lets two different words share a glyph", () => {
    const byGlyph = new Map<string, Set<string>>();
    for (const entry of Object.values(KIND_REGISTRY)) byGlyph.set(entry.glyph, new Set([...(byGlyph.get(entry.glyph) ?? []), entry.word]));
    for (const [glyph, words] of byGlyph) expect(words.size, `glyph ${glyph} → ${[...words].join(", ")}`).toBe(1);
  });
  it("uses at most nine hue families and reserves copper and ink", () => {
    expect(Object.keys(KIND_HUES).length).toBeLessThanOrEqual(9);
    const light = kindHueTokens(false), dark = kindHueTokens(true);
    for (const tokens of [sceneTokens(TAYLOR_SCENES.red), sceneTokens(NEWFOUNDLAND_SCENES["george-street"])]) {
      for (const name of Object.keys(KIND_HUES)) {
        const value = tokens[`--kind-${name}`]!;
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
        expect(value).not.toBe(tokens["--copper"]);
        expect(value).not.toBe(tokens["--ink"]);
      }
      expect(tokens["--kind-quiet"]).toBe("var(--muted)");
    }
    expect(sceneTokens(TAYLOR_SCENES.red)["--kind-pay"]).toBe(light["--kind-pay"]);
    expect(sceneTokens(NEWFOUNDLAND_SCENES["george-street"])["--kind-pay"]).toBe(dark["--kind-pay"]);
  });
  it("hides by the registry layer exactly as the source-based filter did", () => {
    const legacy = (item: BoardItem) => item.source === "work-settlement" || item.source === "shift" || item.source === "shift-envelope" ? "work" : item.source === "appointment" || item.source === "claim" ? "visit" : item.kind;
    const sourceFor: Record<BoardKind, BoardItem["source"]> = { other: "recurrence", bill: "recurrence", subscription: "recurrence", paycheck: "recurrence", detected: "rhythm", "potential-expense": "potential-expense", shift: "shift", "shift-envelope": "shift-envelope", google: "google", claim: "claim", visit: "appointment", event: "event", "work-pay": "work-settlement", "work-tip": "work-settlement", "work-tipout": "work-settlement" };
    for (const kind of ALL_KINDS) {
      const item = { kind, source: sourceFor[kind] } as BoardItem;
      expect(kindLayerFor(item), kind).toBe(legacy(item));
      expect(calendarItemVisible(item, { [legacy(item)]: false })).toBe(false);
      expect(calendarItemVisible(item, {})).toBe(true);
    }
    expect(kindClassNames("bill")).toBe("kind-bill hue-bill stroke-solid");
    expect(kindClassNames("google")).toBe("kind-google hue-quiet stroke-dashed");
    expect(kindsPresent([{ kind: "google" }, { kind: "bill" }, { kind: "bill" }])).toEqual(["bill", "google"]);
  });
});

describe("Multi-day runs keep their span", () => {
  it("fans a three-day Hearth event out with index and length, even when the grid clips it", () => {
    const h: Household = { ...catalogHousehold(), nativeEvents: [event()] };
    const board = buildMonthBoard(h, "2026-09", "2026-09-08");
    const run = board.days.flatMap(day => day.items).filter(item => item.kind === "event" && item.title === "Cabin weekend");
    expect(run.map(item => [item.date, item.span?.index, item.span?.length])).toEqual([["2026-09-11", 0, 3], ["2026-09-12", 1, 3], ["2026-09-13", 2, 3]]);
    const clipped = buildMonthBoard({ ...h, nativeEvents: [event({ start: "2026-08-30", end: "2026-09-02" })] }, "2026-09", "2026-09-08");
    const rows = clipped.days.flatMap(day => day.items).filter(item => item.title === "Cabin weekend");
    expect(rows[0]!.span).toEqual({ index: 0, length: 4 });
    expect(rows.at(-1)!.span).toEqual({ index: 3, length: 4 });
    const single = buildMonthBoard({ ...h, nativeEvents: [event({ start: "2026-09-11T18:00", end: "2026-09-11T20:00", allDay: false })] }, "2026-09", "2026-09-08");
    expect(single.days.flatMap(day => day.items).find(item => item.title === "Cabin weekend")!.span).toBeUndefined();
  });
  it("reads a Google event's last day: all-day end is exclusive, a timed end lands on its finishing day", () => {
    expect(endDateFromGoogleEvent({ start: { date: "2026-09-11" }, end: { date: "2026-09-14" } }, "2026-09-11")).toBe("2026-09-13");
    expect(endDateFromGoogleEvent({ start: { date: "2026-09-11" }, end: { date: "2026-09-12" } }, "2026-09-11")).toBe("2026-09-11");
    expect(endDateFromGoogleEvent({ start: { dateTime: "2026-09-11T22:00:00-04:00" }, end: { dateTime: "2026-09-12T01:00:00-04:00" } }, "2026-09-11")).toBe("2026-09-12");
    expect(endDateFromGoogleEvent({ start: { dateTime: "2026-09-11T22:00:00-04:00" }, end: { dateTime: "2026-09-12T00:00:00-04:00" } }, "2026-09-11")).toBe("2026-09-11");
    expect(endDateFromGoogleEvent({ start: { date: "2026-09-11" } }, "2026-09-11")).toBe("2026-09-11");
    expect(googleRunLength("2026-09-11", "2026-09-13")).toBe(3);
    const overlay = overlayFromGoogleEvent({ id: "g1", summary: "Conference", start: { date: "2026-09-11" }, end: { date: "2026-09-14" } }, "MEM-001", "#123456")!;
    expect(overlay.span).toEqual({ index: 0, length: 3 });
    expect(overlayFromGoogleEvent({ id: "g2", summary: "Lunch", start: { date: "2026-09-11" } }, "MEM-001", "#123456")!.span).toBeUndefined();
    const board = buildMonthBoard(catalogHousehold(), "2026-09", "2026-09-08", [
      { id: "g1:2026-09-11", calendarId: "primary", title: "Conference", date: "2026-09-11", memberId: "MEM-001", memberColor: "#123456", hearthOwned: false, span: { index: 0, length: 3 } },
      { id: "g1:2026-09-12", calendarId: "primary", title: "Conference", date: "2026-09-12", memberId: "MEM-001", memberColor: "#123456", hearthOwned: false, span: { index: 1, length: 3 } },
    ]);
    expect(board.days.flatMap(day => day.items).filter(item => item.kind === "google").map(item => item.span)).toEqual([{ index: 0, length: 3 }, { index: 1, length: 3 }]);
  });
});

async function mount(household: Household, width = 390) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true }); localStorage.clear();
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const noop = () => {};
  const props = { household, today: "2026-09-08", environment: "development" as const, memberId: "MEM-001", view: "household" as const, busy: false,
    onCommand: noop, onAskPost: noop, onAskPostDue: noop, onAskSaveRepeating: noop, onAskVisit: noop, onAskSettle: noop, onAskWriteOff: noop, onAskStartJar: noop, onOpenPlan: noop, onOpenShiftEnvelope: noop };
  await act(async () => root.render(createElement(CalendarPage, props)));
  return { host, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}

describe("Calendar month — legend is the filter, runs read as one event", () => {
  it("lists only the kinds on screen, toggles a layer from the swatch, and remembers it", async () => {
    const h: Household = { ...catalogHousehold(), nativeEvents: [event()] };
    const m = await mount(h);
    try {
      const legend = m.host.querySelector<HTMLElement>('section.kind-legend[aria-label="What the calendar shows"]')!;
      expect(legend).not.toBeNull();
      const labels = [...legend.querySelectorAll("button")].map(button => button.textContent?.trim());
      expect(labels).toContain("◆Event");
      expect(labels).not.toContain("↗Google event");
      expect(m.host.querySelector(".calendar-meaning-legend")).toBeNull();
      const before = m.host.querySelectorAll(".cal-title.kind-event").length;
      expect(before).toBeGreaterThan(0);
      const toggle = [...legend.querySelectorAll<HTMLButtonElement>("button")].find(button => button.classList.contains("kind-event"))!;
      expect(toggle.getAttribute("aria-checked")).toBe("true");
      await act(async () => toggle.click());
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      expect(m.host.querySelectorAll(".cal-title.kind-event").length).toBe(0);
      expect(legend.querySelector('[role="status"]')?.textContent).toMatch(/hidden/);
      const key = Object.keys(localStorage).find(name => name.startsWith("hearth:calendar-visibility:v1:development:"))!;
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      expect(stored.event).toBe(false);
    } finally { await m.close(); }
  });
  it("draws a three-day run as start, joined and end chips with the title said once per row", async () => {
    const h: Household = { ...catalogHousehold(), nativeEvents: [event()] };
    const m = await mount(h, 1100);
    try {
      expect([...m.host.querySelectorAll<HTMLButtonElement>('.cal-add:not(.is-revealed)')].every(button=>button.tabIndex === -1)).toBe(true);
      expect(m.host.querySelector('[data-calendar-date="2026-09-11"]')?.getAttribute('aria-label')).toContain('Shared');
      const cash=[...m.host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Cash flow')!;
      await act(async()=>cash.click());
      expect(m.host.querySelector('[role="tab"].active')?.textContent).toBe('Calendar');
      await act(async()=>[...m.host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Dates')!.click());
      const chips = [...m.host.querySelectorAll<HTMLElement>(".cal-title.is-span")];
      expect(chips.length).toBe(3);
      const byDate = (date: string) => m.host.querySelector<HTMLElement>(`[data-calendar-date="${date}"] .cal-title.is-span`)!;
      // 2026-09-11 is a Friday, 12 Saturday, 13 Sunday: the run breaks at the week edge.
      expect(byDate("2026-09-11").className).toContain("span-r");
      expect(byDate("2026-09-11").className).not.toContain("span-l");
      expect(byDate("2026-09-12").className).toContain("span-l");
      expect(byDate("2026-09-12").className).not.toContain("span-r");
      expect(byDate("2026-09-12").className).toContain("span-quiet");
      expect(byDate("2026-09-13").className).not.toContain("span-l");
      expect(byDate("2026-09-13").className).not.toContain("span-quiet");
      expect(byDate("2026-09-12").getAttribute("title")).toBe("Cabin weekend · day 2 of 3");
      for (const chip of chips) {
        expect(chip.querySelector(".cal-kind")).not.toBeNull();
        expect(chip.querySelector(".cal-text")?.textContent).toBe("Cabin weekend");
        expect(chip.className).toContain("hue-event");
      }
    } finally { await m.close(); }
  });
  it("marks a heavy day for assistive tech and shows whose Google event it is", async () => {
    const m = await mount(catalogHousehold(), 1100);
    try {
      const heavy = [...m.host.querySelectorAll<HTMLButtonElement>(".cal-day.hot")];
      for (const day of heavy) expect(day.getAttribute("aria-label")).toContain("heavy day");
      const shift = m.host.querySelector<HTMLElement>(".cal-title.kind-shift");
      if (shift) expect(shift.querySelector(".cal-who")).not.toBeNull();
    } finally { await m.close(); }
  });
});
