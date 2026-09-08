import { afterEach, describe, expect, it, vi } from "vitest";
import { herculesProTest } from "../workers/herculesPro.js";

const claims = { authUserId: "synthetic-user", environment: "development", supabaseAccessToken: "synthetic-token" };
afterEach(() => vi.unstubAllGlobals());
describe("Hercules Pro cosmetic account bridge", () => {
  it("reads only this account's environment and returns only allowlisted cosmetic fields", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({
      id: claims.authUserId,
      user_metadata: {
        name: "Private name", hearth_appearance_v1_production: { theme: "newfoundland" },
        hearth_appearance_v1_development: { theme: "taylor", atmosphere: false, hideThemeHat: true, arbitrary: "never return" },
      },
    })));
    vi.stubGlobal("fetch", fetch);
    expect(await herculesProTest.companionAppearance({}, claims)).toEqual({ theme: "taylor", atmosphere: false });
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]?.[0])).toMatch(/\/auth\/v1\/user$/);
  });
  it("does not show another account's appearance", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      id: "different-user", user_metadata: { hearth_appearance_v1_development: { theme: "taylor" } },
    }))));
    expect(await herculesProTest.companionAppearance({}, claims)).toEqual({ theme: "classic", atmosphere: true });
  });
  it("uses Classic if an optional cosmetic read fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await herculesProTest.companionAppearance({}, claims)).toEqual({ theme: "classic", atmosphere: true });
  });
});
