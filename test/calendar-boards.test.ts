// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CalendarPage } from "../src/Calendar.tsx";
import { addRecurrence, catalogHousehold } from "../src/core/index.ts";
import { CALENDAR_INTENT_KEY, requestCalendarPane, takeCalendarPane, type CalendarIntent } from "../src/core/calendarIntent.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const today = "2026-09-08";
async function mount(width = 390, intent?: CalendarIntent, standingFactOnly = false) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  localStorage.clear();
  if (intent) requestCalendarPane(intent, localStorage);
  const household = addRecurrence(catalogHousehold(), { nextDate: today, cadence: "weekly", type: "expense", accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", amount: "20", note: "Fictional groceries" }).household;
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const callbacks = { onCommand: vi.fn(), onAskPost: vi.fn(), onAskPostDue: vi.fn(), onAskSaveRepeating: vi.fn(), onAskVisit: vi.fn(), onAskSettle: vi.fn(), onAskWriteOff: vi.fn(), onAskStartJar: vi.fn(), onOpenPlan: vi.fn(), onOpenShiftEnvelope: vi.fn() };
  const props = { household, today, environment: "development" as const, memberId: "MEM-001", view: "household" as const, busy: false, onboardingStandingFactOnly: standingFactOnly, ...callbacks };
  await act(async () => root.render(createElement(CalendarPage, props)));
  const tab = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === name)!;
  const click = async (node: HTMLElement) => { await act(async () => node.click()); };
  return { host, household, callbacks, props, root, tab, click, close: async () => { await act(async () => root.unmount()); host.remove(); document.documentElement.removeAttribute("data-theme"); } };
}

describe("Calendar boards", () => {
  it.each([320, 390, 720, 1440])("defaults to the traditional calendar at %ipx in every theme", async width => {
    for (const theme of ["classic", "taylor", "newfoundland"]) {
      document.documentElement.dataset.theme = theme;
      const m = await mount(width);
      try {
        expect([...m.host.querySelectorAll('[role="tab"]')].map(node => node.textContent)).toEqual(["Calendar", "Month", "Appointments", "Bills"]);
        expect(m.tab("Calendar").getAttribute("aria-selected")).toBe("true");
        expect(m.host.querySelectorAll(".cal-weekdays > span")).toHaveLength(7);
        expect(m.host.querySelectorAll(".cal-day").length % 7).toBe(0);
        expect(m.host.querySelector(".weight")).toBeNull();
        expect(m.host.querySelector(`[data-calendar-date="${today}"]`)?.getAttribute("aria-current")).toBe("date");
        const grid = m.host.querySelector(".cal-grid")!;
        const upcoming = m.host.querySelector<HTMLDetailsElement>(".calendar-upcoming")!;
        const google = m.host.querySelector(".calendar-integration")!;
        expect(upcoming.open).toBe(false);
        expect(grid.compareDocumentPosition(upcoming) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(upcoming.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(google.textContent).toContain("Google never posts");
        expect(google.textContent).toContain("Download .ics with alarms");
        expect(m.callbacks.onCommand).not.toHaveBeenCalled();
      } finally { await m.close(); }
    }
  });

  it.each([["board", "Month"], ["visits", "Appointments"], ["bills", "Bills"], ["google", "Calendar"], ["calendar", "Calendar"]] as const)("consumes %s deep links into %s", async (intent, label) => {
    const m = await mount(1440, intent);
    try {
      expect(m.tab(label).getAttribute("aria-selected")).toBe("true");
      expect(localStorage.getItem(CALENDAR_INTENT_KEY)).toBeNull();
      if (intent === "google") expect(document.activeElement).toBe(m.host.querySelector(".calendar-integration"));
      if (intent === "board") expect(m.host.querySelector(".weight-range")).not.toBeNull();
      expect(m.callbacks.onCommand).not.toHaveBeenCalled();
    } finally { await m.close(); }
  });

  it("shares the selected date/month across tabs and width changes, resetting on scope change", async () => {
    const m = await mount();
    try {
      await m.click(m.host.querySelector('[data-calendar-date="2026-09-22"]')!);
      expect(m.host.querySelector(".calendar-selected-day")?.textContent).toContain("Sep 22");
      await m.click(m.tab("Month"));
      expect(m.host.querySelector(".weight-day time")?.getAttribute("datetime")).toBe("2026-09-22");
      await m.click(m.host.querySelector('[aria-label="Next month"]')!);
      await m.click(m.tab("Bills")); await m.click(m.tab("Appointments")); await m.click(m.tab("Calendar"));
      expect(m.host.querySelector('[aria-pressed="true"]')?.getAttribute("data-calendar-date")).toBe("2026-10-22");
      await act(async () => { Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true }); window.dispatchEvent(new Event("resize")); });
      expect(m.host.querySelector('[aria-pressed="true"]')?.getAttribute("data-calendar-date")).toBe("2026-10-22");
      await m.click(m.tab("Month"));
      expect(m.host.querySelector(".weight-day time")?.getAttribute("datetime")).toBe("2026-10-22");
      await act(async () => m.root.render(createElement(CalendarPage, { ...m.props, view: "personal" })));
      expect(m.host.querySelector(".calendar-stage")?.getAttribute("data-calendar-view")).toBe("personal");
      expect(m.tab("Calendar").getAttribute("aria-selected")).toBe("true");
      expect(m.host.querySelector('[aria-pressed="true"]')?.getAttribute("data-calendar-date")).toBe(today);
      for (const callback of Object.values(m.callbacks)) expect(callback).not.toHaveBeenCalled();
    } finally { await m.close(); }
  });

  it("supports keyboard tab and day selection, including adjacent-month dates", async () => {
    const m = await mount();
    const key = async (node: Element, key: string) => { await act(async () => node.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))); };
    try {
      await key(m.tab("Calendar"), "ArrowRight");
      expect(document.activeElement).toBe(m.tab("Month")); expect(m.tab("Month").tabIndex).toBe(0);
      expect(m.tab("Calendar").tabIndex).toBe(-1);
      const panel = m.host.querySelector('[role="tabpanel"]')!;
      expect(panel.id).toBe(m.tab("Month").getAttribute("aria-controls"));
      expect(panel.getAttribute("aria-labelledby")).toBe(m.tab("Month").id);
      await key(m.tab("Month"), "End"); expect(document.activeElement).toBe(m.tab("Bills"));
      await key(m.tab("Bills"), "ArrowRight"); expect(document.activeElement).toBe(m.tab("Calendar"));
      await key(m.host.querySelector(`[data-calendar-date="${today}"]`)!, "ArrowDown");
      expect(document.activeElement?.getAttribute("data-calendar-date")).toBe("2026-09-15");
      expect(document.activeElement?.getAttribute("aria-expanded")).toBe("true");
      await key(document.activeElement!, "Home"); expect(document.activeElement?.getAttribute("data-calendar-date")).toBe("2026-09-13");
      await m.click(m.host.querySelector('[data-calendar-date="2026-08-31"]')!);
      await m.click(m.tab("Month"));
      expect(m.host.querySelector(".weight-day time")?.getAttribute("datetime")).toBe("2026-08-31");
    } finally { await m.close(); }
  });

  it("routes paid and due actions through existing confirmation callbacks without writing", async () => {
    const m = await mount(); const before = JSON.stringify(m.household);
    try {
      const paid = [...m.host.querySelectorAll<HTMLButtonElement>(".calendar-selected-day button")].find(button => button.textContent === "Paid")!;
      await m.click(paid);
      expect(m.callbacks.onAskPost).toHaveBeenCalledWith(m.household.recurrences[0]!.id, expect.stringContaining("This posts $20.00"));
      await m.click([...m.host.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Mark due paid")!);
      expect(m.callbacks.onAskPostDue).toHaveBeenCalledWith([m.household.recurrences[0]!.id], expect.stringContaining("This posts 1"));
      await m.click(m.host.querySelector('[data-calendar-date="2026-09-15"]')!);
      expect([...m.host.querySelectorAll(".calendar-selected-day button")].some(button => button.textContent === "Paid")).toBe(false);
      expect(m.callbacks.onCommand).not.toHaveBeenCalled();
      expect(JSON.stringify(m.household)).toBe(before);
    } finally { await m.close(); }
  });

  it("keeps onboarding standing facts free of payment actions in both calendar presentations", async () => {
    const m = await mount(390, undefined, true);
    try {
      for (const name of ["Calendar", "Month", "Bills"]) {
        await m.click(m.tab(name));
        expect([...m.host.querySelectorAll("button")].some(button => ["Paid", "Mark paid", "Mark due paid", "Skip once"].includes(button.textContent ?? ""))).toBe(false);
      }
      expect(m.callbacks.onCommand).not.toHaveBeenCalled();
    } finally { await m.close(); }
  });
});

describe("calendar intent storage", () => {
  it("consumes unknown values and tolerates unavailable or denied storage", () => {
    localStorage.setItem(CALENDAR_INTENT_KEY, "unknown"); expect(takeCalendarPane(localStorage)).toBeNull();
    expect(localStorage.getItem(CALENDAR_INTENT_KEY)).toBeNull();
    expect(takeCalendarPane()).toBeNull();
    expect(takeCalendarPane({ getItem() { throw Error("denied"); } })).toBeNull();
    expect(() => requestCalendarPane("calendar", { setItem() { throw Error("denied"); } })).not.toThrow();
  });
});
