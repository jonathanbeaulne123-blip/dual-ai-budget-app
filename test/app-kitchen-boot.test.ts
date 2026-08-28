// @vitest-environment jsdom
import { act, createElement, Component } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calcShiftAmounts,
  catalogHousehold,
  ensureHouseholdShape,
  previewShiftAmounts,
  type Household,
} from "../src/core/index.ts";
import {
  continuityIdentityFromGoogle,
  createMemoryTokenStore,
  googleTokenKey,
  loadGoogleSession,
  setGoogleTokenStore,
} from "../src/google/index.ts";
import {
  clearKitchenGoogleSessions,
  clearKitchenMemberSession,
  KitchenErrorBoundary,
} from "../src/KitchenErrorBoundary.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("household kitchen boot", () => {
  it("does not read googleSession?.identity.email after optional session (throws when identity is missing)", () => {
    const source = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(source).not.toContain("?.identity.");
    expect(source).toContain("continuityIdentityFromGoogle");
    expect(source).toContain("previewShiftAmounts");
    const guard = source.indexOf("if (!storedAuthSession && !continuityIdentityFromGoogle(googleSession)) return;");
    expect(guard).toBeGreaterThan(0);
  });

  it("skips a stored Google token that has an access token but no identity", () => {
    const store = createMemoryTokenStore();
    setGoogleTokenStore(store);
    store.setItem(googleTokenKey("development", "MEM-002"), JSON.stringify({
      memberId: "MEM-002",
      accessToken: "token-without-identity",
      expiresAt: Date.now() + 120_000,
      grantedScopes: [],
    }));
    const session = loadGoogleSession("development", "MEM-002");
    expect(session).toBeNull();
    expect(continuityIdentityFromGoogle(session)).toBeNull();
    setGoogleTokenStore(null);
  });

  it("does not throw when a GIS-shaped object is missing identity", () => {
    const broken = { accessToken: "x", memberId: "MEM-002" };
    expect(() => {
      const email = (broken as { identity?: { email?: string } }).identity?.email;
      void email;
    }).not.toThrow();
    expect(() => {
      void continuityIdentityFromGoogle(broken);
    }).not.toThrow();
    expect(continuityIdentityFromGoogle(broken)).toBeNull();
    expect(continuityIdentityFromGoogle({
      identity: { email: "jonathan@example.com", subject: "sub-jon" },
    })).toEqual({ email: "jonathan@example.com", subject: "sub-jon" });
  });

  it("defaults missing Tip Tracker settings so kitchen preview can render", () => {
    const raw = catalogHousehold();
    const stripped = { ...raw } as Household;
    delete (stripped as { shiftSettings?: Household["shiftSettings"] }).shiftSettings;
    expect(() => calcShiftAmounts({
      salesCents: 0,
      cashTipsCents: 0,
      ccTipsCents: 0,
      hours: 0,
    }, stripped.shiftSettings)).toThrow(/Tip Tracker settings are unavailable/);
    const shaped = ensureHouseholdShape(stripped);
    expect(shaped.shiftSettings.hourlyRateCents).toBe(1760);
    expect(() => previewShiftAmounts({
      salesCents: 12500,
      cashTipsCents: 2000,
      ccTipsCents: 1500,
      hours: 5,
    }, stripped.shiftSettings)).not.toThrow();
    expect(() => previewShiftAmounts({
      salesCents: 12500,
      cashTipsCents: 2000,
      ccTipsCents: 1500,
      hours: 5,
    }, shaped.shiftSettings)).not.toThrow();
  });
});

describe("KitchenErrorBoundary", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it("shows paper recovery instead of an empty root, without posting money", () => {
    class Boom extends Component {
      override render(): never {
        throw new Error("kitchen render boom");
      }
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      act(() => root.render(createElement(KitchenErrorBoundary, null, createElement(Boom))));
    } catch {
      // React 19 still rethrows render errors in tests after the boundary paints.
    }
    consoleError.mockRestore();
    const recovery = container.querySelector("[data-kitchen-recovery='1']") as HTMLElement;
    expect(recovery).not.toBeNull();
    expect(recovery.textContent).toMatch(/kitchen could not open/i);
    expect(recovery.textContent).toMatch(/Nothing was posted/i);
    expect([...container.querySelectorAll("button")].map((button) => button.textContent?.trim())).toEqual([
      "Reload",
      "Sign out of Google and reload",
      "Open welcome",
    ]);
  });

  it("clears Google keys and the member session without touching household replicas", () => {
    localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({ accessToken: "auth" }));
    localStorage.setItem("hearth:v1:development:google:MEM-002", JSON.stringify({ accessToken: "gis" }));
    localStorage.setItem("hearth:v1:development:gcal:MEM-002", JSON.stringify({ accessToken: "legacy" }));
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({ memberId: "MEM-002" }));
    localStorage.setItem("hearth:household:v2:development:HH-1", JSON.stringify({ householdId: "HH-1" }));
    clearKitchenGoogleSessions();
    expect(localStorage.getItem("hearth:v1:supabase-auth:development")).toBeNull();
    expect(localStorage.getItem("hearth:v1:development:google:MEM-002")).toBeNull();
    expect(localStorage.getItem("hearth:v1:development:gcal:MEM-002")).toBeNull();
    expect(localStorage.getItem("hearth:household:v2:development:HH-1")).not.toBeNull();
    expect(localStorage.getItem("hearth:session:v1:development")).not.toBeNull();
    clearKitchenMemberSession();
    expect(localStorage.getItem("hearth:session:v1:development")).toBeNull();
    expect(localStorage.getItem("hearth:household:v2:development:HH-1")).not.toBeNull();
  });
});
