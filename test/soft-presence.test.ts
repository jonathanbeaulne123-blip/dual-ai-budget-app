import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, linkGoogleIdentity, touchDevicePresence } from "../src/core/index.ts";
import type { Member } from "../src/core/types.ts";
import {
  buildSoftPresenceDisplay,
  canAdvertiseSoftPresence,
  deactivateLocalDevice,
  isSoftPresenceOptedOut,
  mergePresencePeers,
  peersFromDevices,
  setSoftPresenceOptOut,
  softPresenceLine,
  SOFT_PRESENCE_FRESH_MS,
} from "../src/softPresence.ts";
import { softPresenceRealtimeEnabled } from "../src/softPresenceRealtime.ts";
import { mergeDevices } from "../src/core/devices.ts";

function memoryStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

function twoMemberHousehold() {
  let household = linkGoogleIdentity(catalogHousehold(), {
    memberId: "MEM-001",
    email: "jonathan@example.com",
    subject: "google-sub-jonathan",
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
  household = linkGoogleIdentity(household, {
    memberId: "MEM-002",
    email: "bianca@example.com",
    subject: "google-sub-bianca",
    displayName: "Bianca",
    grantedScopes: ["openid", "email"],
  }).household;
  return household;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("softPresence (T3-S2)", () => {
  it("builds calm kitchen copy for one or two peers without ranking", () => {
    expect(softPresenceLine([{ memberId: "MEM-002", name: "Bianca", source: "live", seenAt: "2026-08-27T12:00:00.000Z" }]))
      .toBe("Bianca is in the kitchen");
    expect(softPresenceLine([
      { memberId: "MEM-001", name: "Jonathan", source: "live", seenAt: "2026-08-27T12:00:00.000Z" },
      { memberId: "MEM-002", name: "Bianca", source: "device", seenAt: "2026-08-27T12:01:00.000Z" },
    ])).toBe("Jonathan and Bianca are in the kitchen");
  });

  it("hides stale and self device rows; keeps shared-member names only", () => {
    const members: Member[] = [
      { id: "MEM-001", name: "Jonathan", color: "#333", active: true, updatedAt: "2026-08-27T00:00:00.000Z" },
      { id: "MEM-002", name: "Bianca", color: "#666", active: true, updatedAt: "2026-08-27T00:00:00.000Z" },
    ];
    const now = Date.parse("2026-08-27T12:00:00.000Z");
    const devices = [
      {
        id: "DEV-BIANCA",
        label: "iPhone / iPad",
        memberId: "MEM-002",
        environment: "development" as const,
        seenAt: new Date(now - 60_000).toISOString(),
        updatedAt: new Date(now - 60_000).toISOString(),
        active: true,
      },
      {
        id: "DEV-JON",
        label: "Mac",
        memberId: "MEM-001",
        environment: "development" as const,
        seenAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        active: true,
      },
      {
        id: "DEV-OLD",
        label: "Android",
        memberId: "MEM-002",
        environment: "development" as const,
        seenAt: new Date(now - SOFT_PRESENCE_FRESH_MS - 1).toISOString(),
        updatedAt: new Date(now - SOFT_PRESENCE_FRESH_MS - 1).toISOString(),
        active: true,
      },
    ];

    const peers = peersFromDevices({
      devices,
      members,
      viewerMemberId: "MEM-001",
      environment: "development",
      nowMs: now,
    });
    expect(peers).toHaveLength(1);
    expect(peers[0]?.name).toBe("Bianca");
    expect(peers[0]?.memberId).toBe("MEM-002");
  });

  it("prefers live Realtime peers over device rows", () => {
    const merged = mergePresencePeers(
      [{ memberId: "MEM-002", name: "Bianca", source: "live", seenAt: "2026-08-27T12:05:00.000Z" }],
      [{ memberId: "MEM-002", name: "Bianca", source: "device", seenAt: "2026-08-27T11:00:00.000Z" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe("live");
  });

  it("requires signed-in member and respects opt-out", () => {
    const store = memoryStore();
    expect(canAdvertiseSoftPresence({ signedIn: false, memberId: "MEM-001", environment: "development" })).toBe(false);
    expect(canAdvertiseSoftPresence({ signedIn: true, memberId: "MEM-001", environment: "development", optedOut: false })).toBe(true);
    setSoftPresenceOptOut("development", true, store);
    expect(isSoftPresenceOptedOut("development", store)).toBe(true);
    expect(canAdvertiseSoftPresence({
      signedIn: true,
      memberId: "MEM-001",
      environment: "development",
      optedOut: isSoftPresenceOptedOut("development", store),
    })).toBe(false);
  });

  it("deactivates local device on opt-out without inventing personal ledger fields", () => {
    const devices = touchDevicePresence({
      devices: [],
      deviceId: "DEV-1",
      label: "Mac",
      memberId: "MEM-001",
      environment: "development",
    });
    const next = deactivateLocalDevice(devices, "DEV-1");
    expect(next[0]?.active).toBe(false);
    expect(JSON.stringify(next)).not.toMatch(/transactions|shifts|personal/i);
  });

  it("keeps inactive device rows so opt-out can LWW to partners", () => {
    const active = touchDevicePresence({
      devices: [],
      deviceId: "DEV-1",
      label: "Mac",
      memberId: "MEM-001",
      environment: "development",
      at: "2026-08-27T12:00:00.000Z",
    });
    const inactive = deactivateLocalDevice(active, "DEV-1", "2026-08-27T12:01:00.000Z");
    const merged = mergeDevices(active, inactive);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.active).toBe(false);
  });

  it("buildSoftPresenceDisplay stays hidden without peers", () => {
    const household = twoMemberHousehold();
    const display = buildSoftPresenceDisplay({
      household,
      viewerMemberId: "MEM-001",
      environment: "development",
      live: [],
      nowMs: Date.parse("2026-08-27T12:00:00.000Z"),
    });
    expect(display.visible).toBe(false);
  });
});

describe("softPresenceRealtimeEnabled", () => {
  it("matches Development Realtime gate", () => {
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    expect(softPresenceRealtimeEnabled("development")).toBe(true);
    expect(softPresenceRealtimeEnabled("production")).toBe(false);
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "");
    expect(softPresenceRealtimeEnabled("development")).toBe(false);
  });
});
