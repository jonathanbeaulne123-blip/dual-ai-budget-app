import { describe, expect, it, vi } from "vitest";
import {
  createContinuityRealtimeAccessTokenProvider,
} from "../src/continuityRealtimeAuth.ts";
import type { HearthSupabaseSession } from "../src/auth/supabaseSession.ts";

function session(overrides: Partial<HearthSupabaseSession> = {}): HearthSupabaseSession {
  return {
    accessToken: "token-1",
    refreshToken: "refresh-1",
    userId: "auth-user-1",
    sessionId: "session-1",
    email: "jonathan@example.com",
    googleSubject: "google-1",
    displayName: "Jonathan",
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe("createContinuityRealtimeAccessTokenProvider", () => {
  const identity = { email: "jonathan@example.com", subject: "google-1" };

  it("reuses the current token without repeating membership validation", async () => {
    const initialSession = session();
    const validateMembership = vi.fn(async () => true);
    const provider = createContinuityRealtimeAccessTokenProvider({
      initialSession,
      identity,
      ensureSession: vi.fn(async () => initialSession),
      validateMembership,
    });

    await expect(provider()).resolves.toBe("token-1");
    expect(validateMembership).not.toHaveBeenCalled();
  });

  it("validates a changed token once before returning it", async () => {
    const initialSession = session();
    const refreshedSession = session({ accessToken: "token-2", expiresAt: Date.now() + 120_000 });
    const validateMembership = vi.fn(async () => true);
    const provider = createContinuityRealtimeAccessTokenProvider({
      initialSession,
      identity,
      ensureSession: vi.fn(async () => refreshedSession),
      validateMembership,
    });

    await expect(provider()).resolves.toBe("token-2");
    await expect(provider()).resolves.toBe("token-2");
    expect(validateMembership).toHaveBeenCalledOnce();
    expect(validateMembership).toHaveBeenCalledWith(refreshedSession);
  });

  it("refuses a refreshed session for a different Supabase user", async () => {
    const initialSession = session();
    const validateMembership = vi.fn(async () => true);
    const provider = createContinuityRealtimeAccessTokenProvider({
      initialSession,
      identity,
      ensureSession: vi.fn(async () => session({
        accessToken: "token-2",
        userId: "auth-user-2",
      })),
      validateMembership,
    });

    await expect(provider()).rejects.toThrow("Google account changed");
    expect(validateMembership).not.toHaveBeenCalled();
  });

  it("refuses a refreshed session for a different Google identity", async () => {
    const initialSession = session();
    const validateMembership = vi.fn(async () => true);
    const provider = createContinuityRealtimeAccessTokenProvider({
      initialSession,
      identity,
      ensureSession: vi.fn(async () => session({
        accessToken: "token-2",
        googleSubject: "google-2",
        email: "bianca@example.com",
      })),
      validateMembership,
    });

    await expect(provider()).rejects.toThrow("Google account changed");
    expect(validateMembership).not.toHaveBeenCalled();
  });

  it("refuses a changed token after household membership is lost", async () => {
    const initialSession = session();
    const provider = createContinuityRealtimeAccessTokenProvider({
      initialSession,
      identity,
      ensureSession: vi.fn(async () => session({ accessToken: "token-2" })),
      validateMembership: vi.fn(async () => false),
    });

    await expect(provider()).rejects.toThrow("membership changed");
  });

  it("refuses when Hearth Auth no longer has a session", async () => {
    const initialSession = session();
    const provider = createContinuityRealtimeAccessTokenProvider({
      initialSession,
      identity,
      ensureSession: vi.fn(async () => null),
      validateMembership: vi.fn(async () => true),
    });

    await expect(provider()).rejects.toThrow("Google confirmation again");
  });
});
