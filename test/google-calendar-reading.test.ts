import { afterEach, describe, expect, it, vi } from "vitest";
import { readGoogleCalendars, type GoogleAccount } from "../src/calendar/google.ts";
import { createMemoryTokenStore, resetGoogleEngineForTests, saveGoogleSession, scopesForServices, setGoogleHttpFetch, setGoogleTokenRequester, setGoogleTokenStore } from "../src/google/index.ts";

const input = { environment: "development" as const, householdId: "HH-read", from: "2026-01-01", to: "2026-01-31", memberColor: () => "#123456", enabledServices: ["identity", "calendar"] };
function account(memberId = "MEM-001", expiresAt = Date.now() + 3600000): GoogleAccount {
  const value = { memberId, email: `${memberId}@example.com`, calendarId: "primary-id", accessToken: `synthetic-${memberId}`, expiresAt };
  saveGoogleSession(input.environment, { ...value, householdId: input.householdId, identity: { email: value.email, subject: memberId, displayName: memberId }, grantedScopes: scopesForServices(["identity", "calendar"]) });
  return value;
}
function setup() { setGoogleTokenStore(createMemoryTokenStore()); }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { resetGoogleEngineForTests(); setGoogleTokenStore(null); });

describe("Google calendar reads", () => {
  it("reads own and shared reader calendars with both pagination layers, unique ids and no writes", async () => {
    setup(); const own = account(); const requests: string[] = [];
    setGoogleHttpFetch(async (url, init) => {
      expect(init?.method ?? "GET").toBe("GET"); requests.push(url);
      const parsed = new URL(url);
      if (url.includes("calendarList")) return json(parsed.searchParams.has("pageToken")
        ? { items: [{ id: "shared/calendar", summary: "Shared with Bianca", accessRole: "reader" }, { id: "busy-only", accessRole: "freeBusyReader" }] }
        : { items: [{ id: "primary-id", primary: true, summary: "My calendar", accessRole: "owner" }], nextPageToken: "calendar-page-2" });
      if (url.includes("shared%2Fcalendar")) return json({ items: [{ id: "same-id", summary: "Shared dinner", start: { date: "2026-01-12" } }] });
      return json(parsed.searchParams.has("pageToken")
        ? { items: [{ id: "page-2", summary: "Later page", start: { date: "2026-01-14" } }] }
        : { items: [{ id: "same-id", summary: "Own event", start: { date: "2026-01-12" } }], nextPageToken: "event-page-2" });
    });
    const result = await readGoogleCalendars({ ...input, accounts: [own] });
    expect(result.errors).toEqual([]);
    expect(result.calendars).toEqual(["My calendar", "Shared with Bianca"]);
    expect(result.overlays.map(e => e.title).sort()).toEqual(["Later page", "Own event", "Shared dinner"]);
    expect(new Set(result.overlays.map(e => e.id)).size).toBe(3);
    expect(requests.some(url => url.includes("busy-only/events"))).toBe(false);
    expect(requests.some(url => url.includes("pageToken=event-page-2"))).toBe(true);
  });
  it("keeps successful calendars when another denies access and a second account expires", async () => {
    setup(); const own = account(), expired = account("MEM-002", Date.now() - 1000);
    const requestToken = vi.fn(); setGoogleTokenRequester(requestToken);
    setGoogleHttpFetch(async url => url.includes("calendarList") ? json({ items: [{ id: "good" }, { id: "revoked" }] })
      : url.includes("revoked") ? json({ error: { message: "Access revoked" } }, 403)
      : json({ items: [{ id: "read", summary: "Kept event", start: { date: "2026-01-02" } }] }));
    const result = await readGoogleCalendars({ ...input, accounts: [own, expired] });
    expect(result.overlays).toHaveLength(1);
    expect(result.overlays[0]!.title).toBe("Kept event");
    expect(result.errors).toHaveLength(2);
    expect(result.errors.join(" ")).toContain("reconnect");
    expect(requestToken).not.toHaveBeenCalled();
  });
  it("uses household civil dates across winter offsets, clips multi-day events and removes canceled events", async () => {
    setup(); const own = account();
    setGoogleHttpFetch(async url => url.includes("calendarList") ? json({ items: [{ id: "primary-id" }] }) : json({ items: [
      { id: "winter", summary: "Late evening", start: { dateTime: "2026-01-02T04:30:00Z" }, end: { dateTime: "2026-01-02T05:00:00Z" } },
      { id: "trip", summary: "Trip", start: { date: "2025-12-30" }, end: { date: "2026-01-03" } },
      { id: "cancelled", status: "cancelled", start: { date: "2026-01-02" } },
      { id: "outside", start: { date: "2026-02-01" } },
    ] }));
    const result = await readGoogleCalendars({ ...input, accounts: [own], timeZone: "America/Toronto" });
    expect(result.overlays.filter(e => e.title === "Late evening").map(e => e.date)).toEqual(["2026-01-01"]);
    expect(result.overlays.filter(e => e.title === "Trip").map(e => e.date)).toEqual(["2026-01-01", "2026-01-02"]);
    expect(result.overlays).toHaveLength(3);
  });
  it("refuses to borrow another household's token", async () => {
    setup(); const own = account(); const fetch = vi.fn(); setGoogleHttpFetch(fetch);
    const result = await readGoogleCalendars({ ...input, householdId: "HH-other", accounts: [own] });
    expect(result.overlays).toEqual([]); expect(result.errors.join(" ")).toContain("reconnect");
    expect(fetch).not.toHaveBeenCalled();
  });
});
