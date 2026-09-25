// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { Marker } from "../src/harbour/glass/Markers.tsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { shiftMonthKey } from "../src/core/calendar.ts";
import { stripLedger, type DayLedger } from "../src/harbour/glass/dayLedger.ts";
import { StripBand, type StripBandProps } from "../src/harbour/glass/StripBand.tsx";
import { sameDayIn, stripKey } from "../src/harbour/glass/stripKeys.ts";

/**
 * The strip is one control (Tool Atlas §4.1, A20, A21, A25): one Tab stop,
 * focus roving across the stones, the keys of §4.1, one tap target at rest,
 * and every stone named in words. Fictional demo data only.
 */
const today = "2026-09-25";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const september = stripLedger({ household, memberId, space: "ours", today });
const august = stripLedger({ household, memberId, space: "ours", today, month: "2026-08" });

describe("stripKey — the keyboard model", () => {
  const key = (k: string, focused: string, ledger: DayLedger = september, shiftKey = false) => stripKey({ key: k, shiftKey }, focused, ledger);

  it("← / → move a day, ⇧ a week, inside the band", () => {
    expect(key("ArrowRight", today)).toEqual({ kind: "focus", date: "2026-09-26" });
    expect(key("ArrowLeft", today)).toEqual({ kind: "focus", date: "2026-09-24" });
    expect(key("ArrowLeft", today, september, true)).toEqual({ kind: "focus", date: "2026-09-18" });
    expect(key("ArrowRight", "2026-09-10", september, true)).toEqual({ kind: "focus", date: "2026-09-17" });
  });

  it("walks off the band's first stone into last month, and never past the band's end into the future", () => {
    expect(key("ArrowLeft", "2026-09-01")).toEqual({ kind: "month", month: "2026-08", date: "2026-08-31" });
    expect(key("ArrowRight", "2026-10-01")).toEqual({ kind: "focus", date: "2026-10-01" });
    expect(key("ArrowRight", "2026-08-31", august)).toEqual({ kind: "month", month: "2026-09", date: "2026-09-01" });
  });

  it("PgUp / PgDn move a month to the same day, never past the current month", () => {
    expect(key("PageUp", today)).toEqual({ kind: "month", month: "2026-08", date: "2026-08-25" });
    expect(key("PageDown", today)).toBeNull();
    expect(key("PageDown", "2026-08-31", august)).toEqual({ kind: "month", month: "2026-09", date: "2026-09-30" });
    expect(sameDayIn("2026-02", "2026-01-31")).toBe("2026-02-28");
  });

  it("Home is today (from another month too), End is the month's last stone", () => {
    expect(key("Home", "2026-09-03")).toEqual({ kind: "focus", date: today });
    expect(key("Home", "2026-08-03", august)).toEqual({ kind: "month", month: "2026-09", date: today });
    expect(key("End", "2026-09-03")).toEqual({ kind: "focus", date: "2026-09-30" });
    expect(key("End", "2026-08-03", august)).toEqual({ kind: "focus", date: "2026-08-31" });
  });

  it("Enter opens the day, and on the Sitdown's flagstone opens the Sitdown", () => {
    expect(key("Enter", today)).toEqual({ kind: "open", date: today });
    expect(key("Enter", "2026-09-27")).toEqual({ kind: "sitdown", date: "2026-09-27" });
    expect(key("x", today)).toBeNull();
  });
});

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function Harness(props: Partial<StripBandProps> & { calls: string[] }) {
  const [month, setMonth] = useState("2026-09");
  const ledger = month === "2026-09" ? september : stripLedger({ household, memberId, space: "ours", today, month });
  return createElement(StripBand, {
    ledger,
    onOpenCalendar: date => props.calls.push(`calendar:${date}`),
    onOpenSitdown: date => props.calls.push(`sitdown:${date}`),
    onMonthBack: () => { props.calls.push("back"); setMonth(m => shiftMonthKey(m, -1)); },
    onMonthForward: () => { props.calls.push("forward"); setMonth(m => shiftMonthKey(m, 1)); },
    ...props,
  });
}

async function mount(props: Partial<StripBandProps> = {}) {
  const calls: string[] = [];
  await act(async () => root.render(createElement(Harness, { ...props, calls })));
  return calls;
}
const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const grid = () => q<HTMLDivElement>('[role="grid"]');
const press = async (key: string, shiftKey = false) => act(async () => { grid().dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true })); });
const active = () => document.getElementById(grid().getAttribute("aria-activedescendant")!)!;

describe("StripBand — one control", () => {
  it("is a named region with ONE Tab stop; the month tabs are pointer targets the keys reach with PgUp / PgDn", async () => {
    await mount();
    const region = q("section.glass-strip");
    expect(region.getAttribute("aria-label")).toBe("Your month");
    const tabbable = [...region.querySelectorAll<HTMLElement>("button, [tabindex]")].filter(el => el.tabIndex >= 0);
    expect(tabbable).toEqual([grid()]);
    const back = q<HTMLButtonElement>('[data-strip-tab="back"]');
    expect(back.textContent).toBe("‹ August, one month back");
    expect(back.querySelector('[aria-hidden="true"]')!.textContent).toBe("‹ ");
    expect(q('[data-strip-tab="forward"]')).toBeNull();
    expect(grid().getAttribute("aria-label")).toBe("September, day by day. Enter opens a day in the Calendar.");
    expect(document.getElementById(grid().getAttribute("aria-describedby")!)!.textContent).toMatch(/Arrow keys move a day/);
  });

  it("names every stone by its date and its markers, and marks today by shape and by the word", async () => {
    await mount();
    const cells = [...host.querySelectorAll<HTMLElement>('[role="gridcell"]')];
    expect(cells).toHaveLength(september.days.length);
    expect(cells.every(cell => /^(Today, )?[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+: /.test(cell.getAttribute("aria-label")!))).toBe(true);
    const todayCell = q(`[data-strip-day="${today}"]`);
    expect(todayCell.getAttribute("aria-label")).toMatch(/^Today, Friday 25 September: .*Phone bill, \$110\.00, leaving/);
    expect(todayCell.querySelector('[data-mark="today"]')).not.toBeNull();
    expect(q('[data-strip-day="2026-09-26"] [data-mark="slip"]')).not.toBeNull();
    expect(q('[data-strip-day="2026-09-27"] [data-mark="sitdown"]')).not.toBeNull();
    // Beyond the week, only the station's gate stands; the words still say everything.
    expect(q('[data-strip-day="2026-09-02"] [data-mark="slip"]')).toBeNull();
    // Every silhouette is a distinct shape, never a colour alone (A25).
    const shapes = (["pennant", "slip", "sitdown", "coin", "gate"] as const).map(kind => renderToStaticMarkup(createElement(Marker, { kind })).replace(/class="[^"]*"|data-mark="[^"]*"/g, ""));
    expect(new Set(shapes).size).toBe(5);
    for (const shape of shapes) expect(shape).not.toMatch(/fill="#|stroke="#/);
  });

  it("roves with the keys of §4.1 and opens the focused day on Enter", async () => {
    const calls = await mount();
    expect(active().dataset.stripDay).toBe(today);
    await press("ArrowRight");
    expect(active().dataset.stripDay).toBe("2026-09-26");
    await press("ArrowLeft", true);
    expect(active().dataset.stripDay).toBe("2026-09-19");
    await press("End");
    expect(active().dataset.stripDay).toBe("2026-09-30");
    await press("Home");
    expect(active().dataset.stripDay).toBe(today);
    await press("Enter");
    await press("ArrowRight"); await press("ArrowRight");
    await press("Enter");
    expect(calls).toEqual([`calendar:${today}`, "sitdown:2026-09-27"]);
  });

  it("PgUp steps back a month and lands on the same day; PgDn returns; the tabs say where they go", async () => {
    const calls = await mount();
    await press("PageUp");
    expect(calls).toEqual(["back"]);
    expect(grid().getAttribute("aria-label")).toMatch(/^August,/);
    expect(active().dataset.stripDay).toBe("2026-08-25");
    expect(q<HTMLButtonElement>('[data-strip-tab="forward"]').textContent).toBe("September, one month on ›");
    await press("PageDown");
    expect(calls).toEqual(["back", "forward"]);
    expect(active().dataset.stripDay).toBe(today);
    await act(async () => q<HTMLButtonElement>('[data-strip-tab="back"]').click());
    expect(calls.at(-1)).toBe("back");
  });

  it("is one tap target at rest on the phone (→ the Calendar at this week), and per-day on desktop", async () => {
    const calls = await mount();
    await act(async () => q<HTMLElement>('[data-strip-day="2026-09-03"]').click());
    expect(calls).toEqual([`calendar:${today}`]);
    const desk = await mount({ perDayHits: true });
    await act(async () => q<HTMLElement>('[data-strip-day="2026-09-03"]').click());
    expect(desk).toEqual(["calendar:2026-09-03"]);
  });

  it("never calls preventDefault — keys, clicks and pointers pass through (A8)", async () => {
    await mount();
    const spy = vi.spyOn(Event.prototype, "preventDefault");
    for (const k of ["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", "Enter", " "]) await press(k);
    await act(async () => {
      grid().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      grid().dispatchEvent(new Event("pointerdown", { bubbles: true }));
      grid().dispatchEvent(new Event("touchstart", { bubbles: true }));
      grid().dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
