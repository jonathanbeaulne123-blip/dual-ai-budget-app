// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "../src/Calendar.tsx";
import { catalogHousehold, linkGoogleIdentity } from "../src/core/index.ts";
import { createMemoryTokenStore, loadGoogleSession, resetGoogleEngineForTests, saveGoogleSession, scopesForServices, setGoogleClientIdForTests, setGoogleHttpFetch, setGoogleTokenRequester, setGoogleTokenStore } from "../src/google/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
function seed(householdId: string, memberId = "MEM-001", expired = false) {
  saveGoogleSession("development", { householdId, memberId, accessToken: `synthetic-${memberId}`, calendarId: "primary", expiresAt: expired ? 1 : Date.now() + 3600000,
    identity: { email: `${memberId}@example.com`, subject: memberId, displayName: memberId }, grantedScopes: scopesForServices(["identity", "calendar"]) });
}
function props(household = catalogHousehold()) {
  const noop = vi.fn();
  return { household, today: "2026-09-11", environment: "development", memberId: "MEM-001", view: "household", busy: false,
    onCommand: noop, onAskPost: vi.fn(), onAskPostDue: noop, onAskSaveRepeating: noop, onAskVisit: noop, onAskSettle: noop, onAskWriteOff: noop, onAskStartJar: noop, onOpenPlan: noop, onOpenShiftEnvelope: noop } as Parameters<typeof CalendarPage>[0];
}
function button(text: string) { return [...host.querySelectorAll('button')].find(b => b.textContent === text)!; }
beforeEach(() => { localStorage.clear(); setGoogleTokenStore(createMemoryTokenStore()); setGoogleClientIdForTests("test-client"); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); resetGoogleEngineForTests(); setGoogleTokenStore(null); });

describe("Calendar Google connection recovery", () => {
  it("offers explicit reconnect on an expired session without writing reminders or opening OAuth automatically", async () => {
    const p = props(); seed(p.household.householdId, p.memberId, true);
    const token = vi.fn(async () => ({ access_token: "fresh-test", expires_in: 3600, scope: scopesForServices(["identity", "calendar"]).join(" ") }));
    setGoogleTokenRequester(token);
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.method ?? "GET").toBe("GET");
      if (url.includes("userinfo")) return json({ email: "MEM-001@example.com", sub: "MEM-001" });
      if (url.includes("calendarList")) return json({ items: [{ id: "primary", primary: true, summary: "My calendar" }, { id: "shared", summary: "Shared household" }] });
      return json({ items: [{ id: url.includes("shared") ? "shared" : "own", summary: "Synthetic Google event", start: { date: "2026-09-11" } }] });
    }); setGoogleHttpFetch(fetch);
    await act(async () => root.render(createElement(CalendarPage, p)));
    expect(host.textContent).toContain("Google needs to reconnect");
    expect(button("Reconnect Calendar").disabled).toBe(false);
    expect(token).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    await act(async () => button("Reconnect Calendar").click());
    expect(token).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("2 events from 2 calendars");
    expect(host.textContent).toContain("Shared household");
    expect(p.onAskPost).not.toHaveBeenCalled();
    const commandsBefore = vi.mocked(p.onCommand).mock.calls.length;
    await act(async () => button("Refresh Google events").click());
    expect(vi.mocked(p.onCommand).mock.calls).toHaveLength(commandsBefore);
    expect(token).toHaveBeenCalledTimes(1);
  });
  it("does not read a partner's cached credential and does not unlink identity on disconnect", async () => {
    const h = linkGoogleIdentity(catalogHousehold(), { memberId: "MEM-001", email: "MEM-001@example.com", subject: "MEM-001" }).household;
    const p = props(h); seed(h.householdId); seed(h.householdId, "MEM-002");
    setGoogleHttpFetch(async (_url, init) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer synthetic-MEM-001");
      return json({ items: [] });
    });
    await act(async () => root.render(createElement(CalendarPage, p)));
    expect(host.querySelectorAll('[aria-label="Google calendar integration"] button.chip')).toHaveLength(2);
    await act(async () => button("Disconnect").click());
    expect(loadGoogleSession("development", "MEM-001", h.householdId)).toBeNull();
    expect(loadGoogleSession("development", "MEM-002", h.householdId)).not.toBeNull();
    expect(p.onCommand).not.toHaveBeenCalled();
    expect(button("Connect Calendar").disabled).toBe(false);
  });
  it("enables Calendar through the actual Connect command when the service was off", async () => {
    const p = props(); p.household.google.enabledServices = ["identity"];
    setGoogleTokenRequester(async () => ({ access_token: "new-test", expires_in: 3600, scope: scopesForServices(["identity", "calendar"]).join(" ") }));
    setGoogleHttpFetch(async url => url.includes("userinfo") ? json({ email: "MEM-001@example.com", sub: "MEM-001" }) : url.includes("calendarList") ? json({ items: [{ id: "primary", primary: true, summary: "My calendar" }] }) : json({ items: [{ id: "one", start: { date: "2026-09-11" } }] }));
    p.onCommand = command => { p.household = command(p.household).household; root.render(createElement(CalendarPage, p)); };
    await act(async () => root.render(createElement(CalendarPage, p)));
    expect(button("Connect Calendar").disabled).toBe(false);
    await act(async () => button("Connect Calendar").click());
    expect(p.household.google.enabledServices).toContain("calendar");
    expect(host.textContent).toContain("1 events from 1 calendars");
    expect(p.household.transactions).toHaveLength(0);
  });
  it("clears busy state when disconnect cancels an in-flight read", async () => {
    const p = props(); seed(p.household.householdId);
    let release!: (value: Response) => void;
    setGoogleHttpFetch(() => new Promise(resolve => { release = resolve; }));
    await act(async () => root.render(createElement(CalendarPage, p)));
    expect(host.textContent).toContain("Reading Google calendars");
    await act(async () => button("Disconnect").click());
    expect(button("Connect Calendar").disabled).toBe(false);
    await act(async () => release(json({ items: [] })));
    expect(host.textContent).not.toContain("Reading Google calendars");
  });
});

 it("remembers per-calendar filters only in their member and view without ledger or Google writes", async () => {
   const p = props(); seed(p.household.householdId);
   const fetch = vi.fn(async (url: string) => json(url.includes("calendarList")
     ? { items: [{ id: "primary", summary: "Own dates" }, { id: "shared", summary: "Shared dates" }] }
     : { items: [{ id: "same", summary: url.includes("/shared/") ? "Shared dinner" : "Private outing", start: { date: p.today } }] }));
   setGoogleHttpFetch(fetch);
   await act(async () => root.render(createElement(CalendarPage, p)));
   const toggle = () => [...host.querySelectorAll("label")].find(label => label.textContent?.includes("Own dates"))!.querySelector("input")!;
   const day = () => host.querySelector(`[data-calendar-date="${p.today}"]`)!;
   expect(day().getAttribute("aria-label")).toContain("Private outing");
   const calls = fetch.mock.calls.length;
   await act(async () => toggle().click());
   expect(day().getAttribute("aria-label")).not.toContain("Private outing");
   expect(day().getAttribute("aria-label")).toContain("Shared dinner");
   expect(fetch).toHaveBeenCalledTimes(calls);
   expect(p.onCommand).not.toHaveBeenCalled();
   await act(async () => root.render(createElement(CalendarPage, { ...p, view: "personal" })));
   expect(toggle().checked).toBe(true);
   await act(async () => root.render(createElement(CalendarPage, p)));
   expect(toggle().checked).toBe(false);
 });
