import { describe, expect, it, vi } from "vitest";
import type { HearthSupabaseSession } from "../src/auth/supabaseSession.ts";
import { copySyncClockCalibration, measureSyncClockCalibration } from "../src/syncClock.ts";

const session: HearthSupabaseSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  userId: "auth-user",
  sessionId: "session-id",
  email: "person@example.com",
  googleSubject: "google-subject",
  displayName: "Person",
  expiresAt: Date.now() + 60_000,
};
const scope = {
  environment: "development" as const,
  householdId: "HH-CLOCK",
  memberId: "MEM-001",
  deviceId: "DEV-RAW-SECRET",
};

function jsonClock(serverReceivedAtMs: number, serverSentAtMs: number): Response {
  return Response.json({ ok: true, source: "authenticated-cloud-clock", serverReceivedAtMs, serverSentAtMs });
}

describe("sync proof clock calibration", () => {
  it("chooses the lowest-uncertainty NTP probe and hashes the device identity", async () => {
    const times = [1_000, 1_100, 2_000, 2_060, 3_000, 3_080];
    const responses = [jsonClock(1_010, 1_050), jsonClock(2_005, 2_035), jsonClock(3_010, 3_030)];
    const fetcher = vi.fn<typeof fetch>(async (_input, _init) => responses.shift()!);
    const calibration = await measureSyncClockCalibration(scope, {
      fetcher,
      sessionProvider: async () => session,
      nowMs: () => times.shift()!,
      probeCount: 3,
    });

    expect(calibration).toEqual({
      deviceId: expect.stringMatching(/^[a-f0-9]{16}$/),
      measuredAt: new Date(2_030).toISOString(),
      offsetMs: 10,
      uncertaintyMs: 16,
      source: "authenticated-cloud-clock",
    });
    expect(calibration.deviceId).not.toContain(scope.deviceId);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const call of fetcher.mock.calls) {
      const init = call[1] as RequestInit;
      expect(init.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${session.accessToken}` }));
      expect(String(init.body)).not.toContain(scope.deviceId);
    }
  });

  it("refuses a measurement whose network uncertainty exceeds 50 ms", async () => {
    const times = [0, 200];
    await expect(measureSyncClockCalibration(scope, {
      fetcher: async () => jsonClock(10, 20),
      sessionProvider: async () => session,
      nowMs: () => times.shift()!,
      probeCount: 1,
    })).rejects.toThrow(/too uncertain/i);
  });

  it("copies only the allowlisted calibration row", async () => {
    const copied: string[] = [];
    const times = [1_000, 1_020];
    const calibration = await copySyncClockCalibration(scope, {
      fetcher: async () => jsonClock(1_005, 1_015),
      sessionProvider: async () => session,
      nowMs: () => times.shift()!,
      probeCount: 1,
      writeText: async (value) => { copied.push(value); },
    });

    expect(JSON.parse(copied[0]!)).toEqual(calibration);
    expect(copied[0]).not.toMatch(/DEV-RAW-SECRET|HH-CLOCK|MEM-001|access-token|example\.com/);
  });

  it("refuses Production before requesting a session or network", async () => {
    const sessionProvider = vi.fn(async () => session);
    const fetcher = vi.fn();
    await expect(measureSyncClockCalibration({ ...scope, environment: "production" }, {
      fetcher,
      sessionProvider,
    })).rejects.toThrow(/Development-only/);
    expect(sessionProvider).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
