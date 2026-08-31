import { afterEach, describe, expect, it, vi } from "vitest";
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
  adoptGoogleSession,
  clearGoogleSessions,
  connectGoogle,
  createMemoryTokenStore,
  googleTokenKey,
  legacyGcalKey,
  loadGoogleSession,
  saveGoogleSession,
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
    expect(household.google.enabledServices).toEqual(["identity", "calendar", "drive"]);
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
      householdId: "HH-A",
      services: ["identity", "calendar"],
    });
    expect(session.identity.email).toBe("jonathan@example.com");
    expect(session.identity.subject).toBe("sub-jon");
    expect(session.calendarId).toBe("jonathan@example.com");
    expect(loadGoogleSession("development", "MEM-002", "HH-A")?.accessToken).toBe("access-1");
    expect(loadGoogleSession("development", "MEM-002", "HH-B")).toBeNull();
  });

  it("keeps direct Google sessions separate across household-local member ids", () => {
    const store = createMemoryTokenStore();
    setGoogleTokenStore(store);
    const base = {
      memberId: "MEM-001",
      accessToken: "token-a",
      expiresAt: Date.now() + 120_000,
      grantedScopes: scopesForServices(["identity"]),
      identity: { email: "a@example.com", subject: "sub-a", displayName: "A" },
    };
    saveGoogleSession("development", { ...base, householdId: "HH-A" });
    saveGoogleSession("development", { ...base, householdId: "HH-B", accessToken: "token-b" });

    expect(loadGoogleSession("development", "MEM-001", "HH-A")?.accessToken).toBe("token-a");
    expect(loadGoogleSession("development", "MEM-001", "HH-B")?.accessToken).toBe("token-b");
    expect(loadGoogleSession("development", "MEM-001")).toBeNull();
  });

  it("purges every member's direct Google bearer when this phone signs out", () => {
    const store = createMemoryTokenStore();
    setGoogleTokenStore(store);
    const base = {
      memberId: "MEM-001",
      accessToken: "token",
      expiresAt: Date.now() + 120_000,
      grantedScopes: scopesForServices(["identity"]),
      identity: { email: "a@example.com", subject: "sub-a", displayName: "A" },
    };
    saveGoogleSession("development", base);
    saveGoogleSession("development", { ...base, householdId: "HH-A", accessToken: "token-a" });
    saveGoogleSession("development", { ...base, memberId: "MEM-002", householdId: "HH-A", accessToken: "partner-token" });
    store.setItem(legacyGcalKey("development", "MEM-001"), JSON.stringify({ ...base, accessToken: "legacy" }));

    clearGoogleSessions("development");
    expect(Object.keys(store.snapshot()).filter((key) => key.includes("MEM-001") || key.includes("MEM-002"))).toEqual([]);
  });

  it("rolls a failed household adoption back from the exact scoped identity", () => {
    const store = createMemoryTokenStore();
    setGoogleTokenStore(store);
    const session = (memberId: string, accessToken: string, email: string, householdId?: string) => ({
      memberId,
      householdId,
      accessToken,
      expiresAt: Date.now() + 120_000,
      grantedScopes: scopesForServices(["identity"]),
      identity: { email, subject: `sub-${email}`, displayName: email },
    });
    saveGoogleSession("development", session("__welcome__", "new-welcome", "new@example.com"));
    expect(adoptGoogleSession("development", "__welcome__", "MEM-001", "HH-NEW")?.accessToken).toBe("new-welcome");

    const restored = adoptGoogleSession("development", "MEM-001", "__welcome__", undefined, "HH-NEW");
    expect(restored?.identity.email).toBe("new@example.com");
    expect(loadGoogleSession("development", "__welcome__")?.accessToken).toBe("new-welcome");
    expect(loadGoogleSession("development", "MEM-001", "HH-NEW")).toBeNull();
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

  it("never opens Google account UI from a background Google call", async () => {
    const requester = vi.fn(async () => ({
      access_token: "must-not-be-used",
      expires_in: 3600,
      scope: scopeString(["drive"]),
    }));
    setGoogleClientIdForTests("test-client.apps.googleusercontent.com");
    setGoogleTokenRequester(requester);

    await expect(withGoogle({
      environment: "development",
      memberId: "MEM-002",
      services: ["drive"],
      fn: async () => "nope",
    })).rejects.toThrow(/will not open sign-in from the background/i);
    expect(requester).not.toHaveBeenCalled();
  });

  it("shares one Google prompt across duplicate requests and refuses a different owner", async () => {
    setGoogleTokenStore(createMemoryTokenStore());
    setGoogleClientIdForTests("test-client.apps.googleusercontent.com");
    let release!: (value: { access_token: string; expires_in: number; scope: string }) => void;
    const response = new Promise<{ access_token: string; expires_in: number; scope: string }>((resolve) => { release = resolve; });
    const requester = vi.fn(() => response);
    setGoogleTokenRequester(requester);
    setGoogleHttpFetch(async () => jsonResponse({ sub: "sub-jon", email: "jonathan@example.com", name: "Jonathan" }));

    const first = connectGoogle({ environment: "development", memberId: "MEM-002", householdId: "HH-A", services: ["identity"] });
    const duplicate = connectGoogle({ environment: "development", memberId: "MEM-002", householdId: "HH-A", services: ["identity"] });
    await expect(connectGoogle({
      environment: "development",
      memberId: "MEM-002",
      householdId: "HH-B",
      services: ["identity"],
      selectAccount: true,
    })).rejects.toThrow(/already open/i);
    expect(requester).toHaveBeenCalledTimes(1);
    release({ access_token: "one-window", expires_in: 3600, scope: scopeString(["identity"]) });
    await expect(Promise.all([first, duplicate])).resolves.toHaveLength(2);
  });

  it("does not resurrect a token cleared during an open prompt or profile refresh", async () => {
    const store = createMemoryTokenStore();
    setGoogleTokenStore(store);
    setGoogleClientIdForTests("test-client.apps.googleusercontent.com");
    let releasePrompt!: (value: { access_token: string; expires_in: number; scope: string }) => void;
    const response = new Promise<{ access_token: string; expires_in: number; scope: string }>((resolve) => { releasePrompt = resolve; });
    setGoogleTokenRequester(() => response);
    setGoogleHttpFetch(async () => jsonResponse({ sub: "sub-jon", email: "jonathan@example.com", name: "Jonathan" }));

    const connecting = connectGoogle({ environment: "development", householdId: "HH-A", memberId: "MEM-001", services: ["identity"] });
    clearGoogleSessions("development");
    releasePrompt({ access_token: "late-token", expires_in: 3600, scope: scopeString(["identity"]) });
    await expect(connecting).rejects.toThrow(/cleared while sign-in was open/i);

    saveGoogleSession("development", {
      memberId: "MEM-001", householdId: "HH-A", accessToken: "cached-token", expiresAt: Date.now() + 120_000,
      grantedScopes: scopesForServices(["identity"]), identity: { email: "", subject: "", displayName: "" },
    });
    let releaseProfile!: (profile: Response) => void;
    setGoogleHttpFetch(() => new Promise<Response>((resolve) => { releaseProfile = resolve; }));
    const refreshing = withGoogle({
      environment: "development", householdId: "HH-A", memberId: "MEM-001", services: ["identity"], fn: async () => "ready",
    });
    clearGoogleSessions("development");
    releaseProfile(jsonResponse({ sub: "sub-jon", email: "jonathan@example.com", name: "Jonathan" }));
    await expect(refreshing).rejects.toThrow(/cleared while its profile was refreshing/i);
    expect(loadGoogleSession("development", "MEM-001", "HH-A")).toBeNull();
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
      householdId: household.householdId,
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
