import { describe, expect, it, vi } from "vitest";
import { connectSevenShifts, readSevenShiftsStatus } from "../src/imports/sevenShiftsClient.ts";

function status(overrides: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({
    ok: true,
    available: false,
    phase: "scaffold",
    environment: "development-only",
    providerCallsEnabled: false,
    productionAllowed: false,
    detail: "No 7shifts account was contacted.",
    ...overrides,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("7shifts client", () => {
  it("accepts only the exact inert Development status", async () => {
    await expect(readSevenShiftsStatus(async () => status())).resolves.toEqual(expect.objectContaining({
      available: false,
      environment: "development-only",
      productionAllowed: false,
    }));
  });

  it.each([
    ["unsuccessful", { ok: false }],
    ["wrong environment", { environment: "production" }],
    ["Production allowed", { productionAllowed: true }],
  ])("rejects an unsafe %s response", async (_label, override) => {
    await expect(readSevenShiftsStatus(async () => status(override))).rejects.toThrow(/unsafe or invalid status/);
  });

  it("requires a Development Google session before sending a token", async () => {
    const fetcher = vi.fn();
    await expect(connectSevenShifts(
      { environment: "development", householdId: "HH-TEST", memberId: "MEM-001" },
      { accessToken: "token-value-that-is-long-enough", userDigest: `s7user_${"a".repeat(64)}`, jobId: "JOB-1" },
      undefined,
      fetcher,
      async () => null,
    )).rejects.toThrow(/Continue with Google/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses Production scope in the client before any network call", async () => {
    const fetcher = vi.fn();
    await expect(connectSevenShifts(
      { environment: "production", householdId: "HH-TEST", memberId: "MEM-001" },
      { accessToken: "token-value-that-is-long-enough", userDigest: `s7user_${"a".repeat(64)}`, jobId: "JOB-1" },
      undefined,
      fetcher,
      async () => ({ accessToken: "jwt", refreshToken: "r", userId: "u", email: "a@b.c", googleSubject: "g", displayName: "T", expiresAt: Date.now() + 60_000 }),
    )).rejects.toThrow(/Development-only/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
