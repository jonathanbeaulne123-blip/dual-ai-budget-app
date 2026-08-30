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

  it("accepts a coherent active Development-and-Production status", async () => {
    await expect(readSevenShiftsStatus(async () => status({
      available: true,
      phase: "sandbox-configured",
      environment: "development-and-production",
      providerCallsEnabled: true,
      productionAllowed: true,
      environments: { development: { available: true }, production: { available: true } },
      detail: "Configured for authenticated read-only pulls.",
    }))).resolves.toMatchObject({ available: true, productionAllowed: true });
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

  it("sends an authenticated Production connection to the exact Production scope", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({
      ok: true, connectionId: `s7c_${"a".repeat(24)}`, companyName: "Harbour", jobId: "JOB-1", state: "ready",
    }, { status: 201, headers: { "Content-Type": "application/json" } }));
    await expect(connectSevenShifts(
      { environment: "production", householdId: "HH-TEST", memberId: "MEM-001" },
      { accessToken: "token-value-that-is-long-enough", userDigest: `s7user_${"a".repeat(64)}`, jobId: "JOB-1" },
      undefined,
      fetcher,
      async () => ({ accessToken: "jwt", refreshToken: "r", userId: "u", sessionId: "66666666-6666-4666-8666-666666666666", email: "a@b.c", googleSubject: "g", displayName: "T", expiresAt: Date.now() + 60_000 }),
    )).resolves.toMatchObject({ companyName: "Harbour", jobId: "JOB-1" });
    const sent = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(sent).toMatchObject({ environment: "production", householdId: "HH-TEST", memberId: "MEM-001" });
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer jwt");
  });
});
