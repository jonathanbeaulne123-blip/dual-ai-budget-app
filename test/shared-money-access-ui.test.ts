// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: {
    currentMemberId: "MEM-001",
    currentRole: "owner" as const,
    members: [
      { memberId: "MEM-001", displayName: "Jonathan", role: "owner" as const },
      { memberId: "MEM-002", displayName: "Bianca", role: "owner" as const },
      { memberId: "MEM-003", displayName: "Helper", role: "member" as const },
    ],
    devices: [
      {
        memberId: "MEM-001",
        accessId: "11111111-1111-4111-8111-111111111111",
        deviceLabel: "Chrome on Windows",
        registeredAt: "2026-08-30T10:00:00Z",
        lastSeenAt: "2026-08-30T11:00:00Z",
        current: true,
      },
      {
        memberId: "MEM-002",
        accessId: "22222222-2222-4222-8222-222222222222",
        deviceLabel: "Safari on iPhone",
        registeredAt: "2026-08-30T10:00:00Z",
        lastSeenAt: "2026-08-30T10:30:00Z",
        current: false,
      },
    ],
    audit: [{ action: "device-registered", occurredAt: "2026-08-30T10:00:00Z" }],
  },
  revokeDevice: vi.fn(async () => ({ ok: true as const })),
  revokeMember: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("../src/auth/supabaseSession.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth/supabaseSession.ts")>();
  return {
    ...actual,
    supabaseAuthEnabled: () => true,
    ensureSupabaseSession: vi.fn(async () => ({
      accessToken: "jwt",
      refreshToken: "refresh",
      userId: "auth-1",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: "jonathan@example.com",
      googleSubject: "google-1",
      displayName: "Jonathan",
      expiresAt: Date.now() + 60_000,
    })),
    authenticatedSupabaseConfig: () => ({ url: "https://example.test", key: "publishable", accessToken: "jwt" }),
  };
});

vi.mock("../src/ledger/householdInvites.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledger/householdInvites.ts")>();
  return {
    ...actual,
    registerCurrentHouseholdDevice: vi.fn(async () => ({ ok: true, registered: 1 })),
    listHouseholdAccess: vi.fn(async () => ({ ok: true, access: mocks.access })),
    revokeHouseholdDevice: mocks.revokeDevice,
    revokeHouseholdMember: mocks.revokeMember,
  };
});

import { PairingCard } from "../src/Pairing.tsx";
import { catalogHousehold } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

async function settleUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
    if (predicate()) return;
  }
  throw new Error(container.textContent || "Access UI did not settle.");
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  mocks.revokeDevice.mockClear();
  mocks.revokeMember.mockClear();
  vi.unstubAllGlobals();
});

describe("SF-02 household access UI", () => {
  it.each([320, 390, 720, 1100])("keeps the same semantic access controls at %ipx", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const household = catalogHousehold();
    const onLeaveHousehold = vi.fn(async () => {});
    const onCurrentDeviceRevoked = vi.fn();
    act(() => root.render(createElement(PairingCard, {
      household,
      memberId: "MEM-001",
      error: "",
      busy: false,
      syncState: "synced",
      inviteInput: "",
      onInviteInput: vi.fn(),
      onHousehold: vi.fn(async () => {}),
      onError: vi.fn(),
      onBusy: vi.fn(),
      onSyncState: vi.fn(),
      onLeaveHousehold,
      onCurrentDeviceRevoked,
    })));
    await settleUntil(() => container.textContent?.includes("Safari on iPhone") === true);

    const panel = container.querySelector(".household-access") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("aria-labelledby")).toBe("household-access-heading");
    expect(panel.textContent).toMatch(/No balances, transactions, Google subjects, emails, or tokens/i);
    expect(panel.textContent).toMatch(/Recent access activity/i);
    expect(panel.textContent).toMatch(/cannot erase books already cached/i);
    expect([...panel.querySelectorAll("button")].every((button) => button.type === "button")).toBe(true);

    const currentRemove = [...panel.querySelectorAll("button")]
      .find((button) => button.textContent === "Remove device") as HTMLButtonElement;
    currentRemove.focus();
    expect(document.activeElement).toBe(currentRemove);
    act(() => currentRemove.click());
    await settleUntil(() => onCurrentDeviceRevoked.mock.calls.length === 1);
    expect(mocks.revokeDevice).toHaveBeenCalledWith(expect.objectContaining({
      householdId: household.householdId,
      accessId: "11111111-1111-4111-8111-111111111111",
    }));

    const leave = [...panel.querySelectorAll("button")]
      .find((button) => button.textContent === "Leave household") as HTMLButtonElement;
    expect(leave.disabled).toBe(false);
  });
});
