import { afterEach, describe, expect, it } from "vitest";
import {
  assertServicesAllowed,
  catalogHousehold,
  findActiveGoogleLink,
  linkGoogleIdentity,
  makeHearthPass,
  mergeShared,
  postEntry,
  setGoogleServices,
  splitForSync,
  touchGoogleConfirmation,
  unlinkGoogleIdentity,
} from "../src/core/index.ts";
import { ValidationError } from "../src/core/types.ts";
import { overlayFromGoogleEvent } from "../src/calendar/google.ts";
import {
  connectGoogle,
  createMemoryTokenStore,
  googleTokenKey,
  legacyGcalKey,
  loadGoogleSession,
  resetGoogleEngineForTests,
  scopeString,
  scopesForServices,
  setGoogleClientIdForTests,
  setGoogleHttpFetch,
  setGoogleTokenRequester,
  setGoogleTokenStore,
  syncGoogleSuite,
  withGoogle,
} from "../src/google/index.ts";

const today = "2026-08-21";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Google household commands", () => {
  it("links and unlinks without touching transactions", () => {
    const household = catalogHousehold();
    const posted = postEntry(household, {
      date: today,
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      confirmDuplicate: true,
    });
    const linked = linkGoogleIdentity(posted.household, {
      memberId: "MEM-002",
      email: "Jonathan.Beaulne@example.com",
      subject: "sub-jon",
      displayName: "Jonathan",
      grantedScopes: ["openid"],
    });
    expect(linked.postedIds).toEqual([]);
    expect(linked.household.transactions).toHaveLength(posted.household.transactions.length);
    expect(findActiveGoogleLink(linked.household, "MEM-002")?.email).toBe("jonathan.beaulne@example.com");

    const confirmed = touchGoogleConfirmation(linked.household, "MEM-002");
    expect(confirmed.postedIds).toEqual([]);
    expect(confirmed.household.transactions).toHaveLength(posted.household.transactions.length);

    const unlinked = unlinkGoogleIdentity(confirmed.household, "MEM-002");
    expect(unlinked.postedIds).toEqual([]);
    expect(findActiveGoogleLink(unlinked.household, "MEM-002")).toBeUndefined();
    expect(unlinked.household.tombstones.some((tombstone) => tombstone.id === "GGL-MEM-002")).toBe(true);
    expect(unlinked.household.transactions).toHaveLength(posted.household.transactions.length);
  });

  it("refuses the same Google email on two people", () => {
    const household = catalogHousehold();
    const linked = linkGoogleIdentity(household, {
      memberId: "MEM-001",
      email: "shared@example.com",
      subject: "sub-1",
    }).household;
    expect(() => linkGoogleIdentity(linked, {
      memberId: "MEM-002",
      email: "shared@example.com",
      subject: "sub-2",
    })).toThrow(ValidationError);
    expect(() => linkGoogleIdentity(linked, {
      memberId: "MEM-002",
      email: "shared@example.com",
      subject: "sub-2",
    })).toThrow(/already linked/);
    expect(linked.transactions).toHaveLength(0);
  });

  it("keeps Google links on a Hearth Pass and merges by recency", () => {
    const left = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: "bianca@example.com",
      subject: "sub-b",
      displayName: "Bianca",
    }).household;
    const pass = makeHearthPass(left);
    expect(pass.shared.google.links.map((link) => link.email)).toEqual(["bianca@example.com"]);
    expect(JSON.stringify(pass)).not.toMatch(/accessToken|access_token/);

    const right = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-002",
      email: "jonathan@example.com",
      subject: "sub-j",
    }).household;
    right.inviteCode = left.inviteCode;
    right.householdId = left.householdId;
    const merged = mergeShared(splitForSync(left, "MEM-001").shared, splitForSync(right, "MEM-002").shared);
    expect(merged.google.links.map((link) => link.email).sort()).toEqual(["bianca@example.com", "jonathan@example.com"]);
  });
});

describe("Google service policy", () => {
  it("unions scopes and always includes identity", () => {
    const scopes = scopesForServices(["calendar"]);
    expect(scopes).toContain("openid");
    expect(scopes).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(scopeString(["identity", "calendar"]).split(" ").length).toBe(scopes.length);
  });

  it("throws when Gmail is requested before the household turns it on", () => {
    expect(() => assertServicesAllowed(["identity", "calendar"], ["gmail"])).toThrow(ValidationError);
    expect(() => assertServicesAllowed(["identity", "calendar"], ["gmail"])).toThrow(/Gmail/);
    const household = catalogHousehold();
    expect(household.google.enabledServices).toEqual(["identity", "calendar"]);
    const enabled = setGoogleServices(household, ["identity", "calendar", "gmail"]);
    expect(enabled.postedIds).toEqual([]);
    expect(enabled.household.transactions).toHaveLength(0);
    expect(enabled.household.google.enabledServices).toContain("gmail");
    expect(assertServicesAllowed(enabled.household.google.enabledServices, ["gmail"])).toContain("gmail");
  });
});

describe("Google token engine", () => {
  afterEach(() => {
    resetGoogleEngineForTests();
    setGoogleTokenStore(null);
  });

  it("migrates the old calendar token key onto the household Google key", () => {
    const store = createMemoryTokenStore();
    setGoogleTokenStore(store);
    store.setItem(legacyGcalKey("development", "MEM-002"), JSON.stringify({
      memberId: "MEM-002",
      email: "jonathan@example.com",
      calendarId: "jonathan@example.com",
      accessToken: "legacy-token",
      expiresAt: Date.now() + 120_000,
    }));
    const session = loadGoogleSession("development", "MEM-002");
    expect(session?.accessToken).toBe("legacy-token");
    expect(session?.calendarId).toBe("jonathan@example.com");
    expect(store.getItem(legacyGcalKey("development", "MEM-002"))).toBeNull();
    expect(store.getItem(googleTokenKey("development", "MEM-002"))).toContain("legacy-token");
  });

  it("connects identity and calendar through the injectable token requester", async () => {
    const store = createMemoryTokenStore();
    setGoogleTokenStore(store);
    setGoogleClientIdForTests("test-client.apps.googleusercontent.com");
    setGoogleTokenRequester(async () => ({
      access_token: "access-1",
      expires_in: 3600,
      scope: scopeString(["identity", "calendar"]),
    }));
    setGoogleHttpFetch(async (url) => {
      if (url.includes("userinfo")) {
        return jsonResponse({ sub: "sub-jon", email: "jonathan@example.com", name: "Jonathan" });
      }
      if (url.includes("calendarList")) {
        return jsonResponse({ items: [{ id: "jonathan@example.com", primary: true }] });
      }
      return jsonResponse({});
    });
    const session = await connectGoogle({
      environment: "development",
      memberId: "MEM-002",
      services: ["identity", "calendar"],
    });
    expect(session.identity.email).toBe("jonathan@example.com");
    expect(session.identity.subject).toBe("sub-jon");
    expect(session.calendarId).toBe("jonathan@example.com");
    expect(loadGoogleSession("development", "MEM-002")?.accessToken).toBe("access-1");
  });

  it("refuses Gmail through withGoogle until the household enables it", async () => {
    setGoogleClientIdForTests("test-client.apps.googleusercontent.com");
    await expect(withGoogle({
      environment: "development",
      memberId: "MEM-002",
      services: ["gmail"],
      enabledServices: ["identity", "calendar"],
      fn: async () => "nope",
    })).rejects.toThrow(/Gmail/);
  });

  it("pings enabled Google services and never invents a money post", async () => {
    const store = createMemoryTokenStore();
    setGoogleTokenStore(store);
    setGoogleClientIdForTests("test-client.apps.googleusercontent.com");
    setGoogleTokenRequester(async () => ({
      access_token: "access-2",
      expires_in: 3600,
      scope: scopeString(["identity", "calendar", "gmail"]),
    }));
    setGoogleHttpFetch(async (url) => {
      if (url.includes("userinfo")) return jsonResponse({ sub: "sub-jon", email: "jonathan@example.com", name: "Jonathan" });
      if (url.includes("calendarList")) return jsonResponse({ items: [{ id: "jonathan@example.com", primary: true }] });
      if (url.includes("gmail")) return jsonResponse({ emailAddress: "jonathan@example.com", messagesTotal: 4 });
      return jsonResponse({});
    });
    const household = setGoogleServices(catalogHousehold(), ["identity", "calendar", "gmail"]).household;
    const pings = await syncGoogleSuite({
      environment: "development",
      memberId: "MEM-002",
      enabledServices: household.google.enabledServices,
    });
    expect(pings.find((ping) => ping.service === "identity")?.ok).toBe(true);
    expect(pings.find((ping) => ping.service === "calendar")?.ok).toBe(true);
    expect(pings.find((ping) => ping.service === "gmail")?.ok).toBe(true);
    expect(household.transactions).toHaveLength(0);
  });
});

describe("Google calendar overlay helpers", () => {
  it("still maps a Google event onto a Toronto date key", () => {
    const overlay = overlayFromGoogleEvent({
      id: "evt-1",
      summary: "Sit-down",
      start: { date: "2026-08-23" },
      extendedProperties: { private: { hearth: "1" } },
    }, "MEM-001", "#c45c26");
    expect(overlay).toEqual({
      id: "evt-1",
      date: "2026-08-23",
      title: "Sit-down",
      memberId: "MEM-001",
      memberColor: "#c45c26",
      hearthOwned: true,
    });
  });
});
