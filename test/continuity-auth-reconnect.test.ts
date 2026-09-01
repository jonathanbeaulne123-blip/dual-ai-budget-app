// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginContinuityAuthReconnect,
  continuityAuthReconnectRequired,
} from "../src/continuityAuthReconnect.ts";
import { SyncFreshnessStatus } from "../src/SyncFreshnessStatus.tsx";
import type { SyncFreshnessDisplay } from "../src/syncFreshness.ts";
import type { startSupabaseGoogleSignIn } from "../src/auth/supabaseSession.ts";
import {
  clearSupabaseSession,
  saveSupabaseSession,
  SUPABASE_SESSION_CHANGED_EVENT,
  type HearthSupabaseSession,
} from "../src/auth/supabaseSession.ts";

afterEach(() => vi.unstubAllEnvs());

describe("continuity Auth reconnect policy", () => {
  const active = {
    environment: "development" as const,
    authEnabled: true,
    hostedAllowed: true,
    continuityActive: true,
    hasHousehold: true,
    hasMember: true,
    authSessionPresent: false,
  };

  it("requires an explicit reconnect only for an active eligible household without a session", () => {
    expect(continuityAuthReconnectRequired(active)).toBe(true);
    expect(continuityAuthReconnectRequired({ ...active, authSessionPresent: true })).toBe(false);
    expect(continuityAuthReconnectRequired({ ...active, continuityActive: false })).toBe(false);
    expect(continuityAuthReconnectRequired({ ...active, hasHousehold: false })).toBe(false);
    expect(continuityAuthReconnectRequired({ ...active, hasMember: false })).toBe(false);
  });

  it("offers the repair independently of whether Realtime or polling carries continuity", () => {
    expect(continuityAuthReconnectRequired(active)).toBe(true);
  });

  it("never offers the repair where Auth/hosted continuity is disallowed", () => {
    expect(continuityAuthReconnectRequired({ ...active, environment: "production" })).toBe(false);
    expect(continuityAuthReconnectRequired({ ...active, authEnabled: false })).toBe(false);
    expect(continuityAuthReconnectRequired({ ...active, hostedAllowed: false })).toBe(false);
  });

  it("announces same-window session changes with environment-only metadata", () => {
    const events: Array<unknown> = [];
    const listener = (event: Event) => events.push((event as CustomEvent).detail);
    window.addEventListener(SUPABASE_SESSION_CHANGED_EVENT, listener);
    const session: HearthSupabaseSession = {
      accessToken: "private-access-token",
      refreshToken: "private-refresh-token",
      userId: "auth-user",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: "private@example.com",
      googleSubject: "private-google-subject",
      displayName: "Private Person",
      expiresAt: Date.now() + 60_000,
    };

    saveSupabaseSession("development", session);
    clearSupabaseSession("development");
    window.removeEventListener(SUPABASE_SESSION_CHANGED_EVENT, listener);

    expect(events).toEqual([
      { environment: "development" },
      { environment: "development" },
    ]);
    expect(JSON.stringify(events)).not.toMatch(/token|email|subject|auth-user|private/i);
  });

  it("starts one environment-bound account-chooser redirect only when invoked", () => {
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    const start = vi.fn(() => true) as unknown as typeof startSupabaseGoogleSignIn;

    expect(start).not.toHaveBeenCalled();
    expect(beginContinuityAuthReconnect(
      "development",
      "https://kitchen.example/more",
      start,
    )).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(
      "development",
      "https://kitchen.example/more",
      expect.anything(),
      expect.any(Function),
      { selectAccount: true },
    );
  });
});

describe("continuity Auth reconnect status UI", () => {
  it("renders a visible, accessible Google action instead of an icon-only retry", () => {
    const display: SyncFreshnessDisplay = {
      visible: true,
      transportPrimary: "Google sign-in needed",
      transportMode: "auth-required",
      revisionLine: "rev 67",
      updatedLine: "Updated 3 mins ago",
      updatedAtIso: null,
      actorLine: "Last by Bianca",
      sourceLine: null,
      statusSummary: "Google sign-in needed · rev 67 · Updated 3 mins ago · Last by Bianca",
      tone: "warning",
      showPendingHint: false,
      blocksSyncedLabel: true,
      actionLabel: "Continue with Google",
      actionKind: "reconnect-auth",
    };

    const html = renderToStaticMarkup(createElement(SyncFreshnessStatus, {
      display,
      onAction: () => undefined,
    }));

    expect(html).toContain("Google sign-in needed");
    expect(html).toContain("Continue with Google");
    expect(html).toContain('aria-label="Continue with Google"');
    expect(html).toContain("sync-freshness--auth-required");
    expect(html).not.toContain("sync-freshness__icon");
  });
});
