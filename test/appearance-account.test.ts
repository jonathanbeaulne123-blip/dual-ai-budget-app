import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { appearanceAccount } from "../src/theme/appearanceAccount.ts";

const auth = vi.hoisted(() => ({ session: { userId: "jonathan", sessionId: "session-1", accessToken: "synthetic-token" } as { userId: string; sessionId: string; accessToken: string } | null }));
vi.mock("../src/auth/supabaseSession.ts", () => ({
  readHearthAuthConfig: () => ({ supabaseUrl: "https://synthetic.invalid", publishableKey: "synthetic-public" }),
  loadSupabaseSession: () => auth.session,
  ensureSupabaseSession: async () => auth.session,
  bearerHeaders: () => ({ "Content-Type": "application/json", Authorization: "Bearer synthetic-token" }),
}));
const scope = { environment: "development", userId: "jonathan" } as const;
const response = (theme = "taylor", atmosphere = true, id = "jonathan") => new Response(JSON.stringify({ id, user_metadata: { name: "Preserve me", hearth_appearance_v1_development: { theme, atmosphere } } }));
beforeEach(() => { auth.session = { userId: "jonathan", sessionId: "session-1", accessToken: "synthetic-token" }; });
afterEach(() => vi.unstubAllGlobals());
describe("cosmetic account transport", () => {
  it("preserves an existing accessory opt-out when another slot changes during account loading", async () => {
    const current = { theme: "newfoundland", atmosphere: false, hideThemeNeck: true };
    const user = (appearance: object) => new Response(JSON.stringify({ id: "jonathan", user_metadata: { hearth_appearance_v1_development: appearance } }));
    const fetch = vi.fn().mockResolvedValueOnce(user(current)).mockResolvedValueOnce(user({ ...current, hideThemeHat: true }));
    vi.stubGlobal("fetch", fetch);
    expect(await appearanceAccount.write(scope, { hideThemeHat: true }, new AbortController().signal)).toEqual({ ...current, hideThemeHat: true });
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body).data.hearth_appearance_v1_development).toEqual({ ...current, hideThemeHat: true });
  });
  it("merges a pause-only intent with the fresh remote theme and preserves unrelated metadata", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response("taylor", false));
    vi.stubGlobal("fetch", fetch);
    expect(await appearanceAccount.write(scope, { atmosphere: false }, new AbortController().signal)).toEqual({ theme: "taylor", atmosphere: false });
    expect(fetch.mock.calls[0]?.[1].method).toBe("GET");
    const [url, request] = fetch.mock.calls[1]!;
    expect(url).toBe("https://synthetic.invalid/auth/v1/user");
    expect(request.method).toBe("PUT");
    expect(JSON.parse(request.body)).toEqual({ data: { hearth_appearance_v1_development: { theme: "taylor", atmosphere: false } } });
  });
  it("preserves the account’s paused state when changing only its theme", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response("taylor", false)).mockResolvedValueOnce(response("newfoundland", false));
    vi.stubGlobal("fetch", fetch);
    await appearanceAccount.write(scope, { theme: "newfoundland" }, new AbortController().signal);
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body).data.hearth_appearance_v1_development).toEqual({ theme: "newfoundland", atmosphere: false });
  });
  it("refuses a response for a different account", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("taylor", true, "bianca")));
    await expect(appearanceAccount.read(scope, new AbortController().signal)).rejects.toThrow("account changed");
  });
  it("never follows a read with PUT after sign-out", async () => {
    const fetch = vi.fn(async () => { auth.session = null; return response(); });
    vi.stubGlobal("fetch", fetch);
    await expect(appearanceAccount.write(scope, { theme: "newfoundland" }, new AbortController().signal)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects a stale response after the same account signs in with another session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { auth.session!.sessionId = "new-session"; return response(); }));
    await expect(appearanceAccount.read(scope, new AbortController().signal)).rejects.toThrow();
  });
});
