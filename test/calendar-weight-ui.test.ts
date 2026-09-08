// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CalendarPage } from "../src/Calendar.tsx";
import { addRecurrence, catalogHousehold, postEntry, type Household } from "../src/core/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const today = "2026-09-08";
const noop = () => {};
async function mount(household: Household, width = 390) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true }); localStorage.clear();
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const requests: string[] = [];
  const props = { household, today, environment: "development" as const, memberId: "MEM-001", view: "household" as const, busy: false,
    onCommand: () => requests.push("write"), onAskPost: (id: string) => requests.push(id), onAskPostDue: noop,
    onAskSaveRepeating: noop, onAskVisit: noop, onAskSettle: noop, onAskWriteOff: noop, onAskStartJar: noop, onOpenPlan: noop, onOpenShiftEnvelope: noop };
  await act(async () => root.render(createElement(CalendarPage, props)));
  return { host, root, props, requests, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
async function range(host: HTMLElement, value: number) {
  const input = host.querySelector<HTMLInputElement>(".weight-range")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, String(value)); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
}
function pointer(node: Element, type: string) { const event = new Event(type, { bubbles: true }); Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, button: { value: 0 } }); node.dispatchEvent(event); }
describe("phone Calendar Weight", () => {
  it("opens today's card with zero extra tap, preserves desk grid, and clamps31→February28", async () => {
    const m = await mount(catalogHousehold());
    try {
      expect(m.host.querySelector(".weight-day time")?.getAttribute("dateTime")).toBe(today);
      expect(m.host.querySelector(".cal-grid")).toBeNull();
      const next = () => m.host.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!;
      await act(async () => next().click()); await range(m.host, 31);
      for (let i = 0; i < 4; i++) await act(async () => next().click());
      expect(m.host.querySelector(".weight-day time")?.getAttribute("dateTime")).toBe("2027-02-28");
      expect(m.requests).toEqual([]);
      await act(async () => { Object.defineProperty(window, "innerWidth", { value: 720, configurable: true }); window.dispatchEvent(new Event("resize")); });
      expect(m.host.querySelector(".weight-range")).toBeNull(); expect(m.host.querySelectorAll(".cal-day").length).toBeGreaterThanOrEqual(28);
    } finally { await m.close(); }
  });
  it("offers Paid only for the exact next occurrence and enters the existing confirmation callback", async () => {
    const h = addRecurrence(catalogHousehold(), { nextDate: today, cadence: "weekly", type: "expense", accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", amount: "20", note: "Due example" }).household;
    const m = await mount(h); const before = JSON.stringify(h);
    try {
      const paid = () => [...m.host.querySelectorAll<HTMLButtonElement>(".weight-day button")].filter(button => button.textContent === "Paid");
      expect(paid()).toHaveLength(1); await act(async () => paid()[0]!.click()); expect(m.requests).toEqual([h.recurrences[0]!.id]);
      await range(m.host, 15); expect(paid()).toHaveLength(0); expect(m.host.querySelector(".weight-day")?.textContent).toContain("Due example");
      expect(JSON.stringify(h)).toBe(before);
    } finally { await m.close(); }
  });
  it("keeps posted receipts read-only, offers list selection, cancels a drag and resets date on room scope", async () => {
    const h = postEntry(catalogHousehold(), { date: today, type: "expense", accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", amount: "37.51", note: "Actual fictional grocery", confirmDuplicate: true }).household;
    const m = await mount(h);
    try {
      expect(m.host.querySelector(".weight-figure")?.textContent).toBe("−$37.51");
      expect(m.host.querySelector("[data-receipt-id] button")).toBeNull();
      const input = m.host.querySelector<HTMLInputElement>(".weight-range")!; input.setPointerCapture = noop;
      await act(async () => pointer(input, "pointerdown")); await range(m.host, 20);
      await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
      expect(input.value).toBe("8");
      await range(m.host, 25); expect(input.value).toBe("8");
      const list = m.host.querySelector<HTMLSelectElement>('[aria-label="Choose a day"]')!;
      await act(async () => { list.value = "2026-09-22"; list.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(input.value).toBe("22");
      await act(async () => m.root.render(createElement(CalendarPage, { ...m.props, view: "personal" })));
      expect(m.host.querySelector<HTMLInputElement>(".weight-range")?.value).toBe("8"); expect(m.requests).toEqual([]);
    } finally { await m.close(); }
  });
});
