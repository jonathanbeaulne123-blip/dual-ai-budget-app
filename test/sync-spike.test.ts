import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

describe("Development sync spike", () => {
  it("bundles the JS entry and TS DO, executes SQLite and rejects unauthenticated verification", async () => {
    const bundle = await build({ entryPoints: ["workers/site.js"], bundle: true, write: false, format: "esm", platform: "browser", external: ["cloudflare:workers"] });
    const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles![0]!.text, compatibilityDate: "2026-08-21", durableObjects: { SYNC_SPIKE: { className: "SyncSpike", useSQLite: true } }, bindings: { SYNC_SPIKE_ENABLED: "true", SUPABASE_URL: "https://example.supabase.co" } }));
    try {
      const response = await mf.dispatchFetch("https://example.com/sync-spike");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sqlite: 1, typescript: true });
      expect((await mf.dispatchFetch("https://example.com/sync-spike/verify")).status).toBe(401);
      expect((await mf.dispatchFetch("https://example.com/sync-spike/verify", { headers: { Authorization: "Bearer invalid" } })).status).toBe(401);
    } finally { await mf.dispose(); }
  }, 30000);
});

import { SyncSpike, handleSyncSpike } from "../workers/sync/spike.ts";
import { vi } from "vitest";

it("verifies ES256 with cached JWKS and rejects tampering, expiry, wrong issuer and disabled routing", async () => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const fetchJwks = vi.fn(async () => Response.json({ keys: [{ ...jwk, kid: "test", alg: "ES256" }] }));
  vi.stubGlobal("fetch", fetchJwks);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const issue = async (overrides = {}) => {
    const input = `${encode({ alg: "ES256", kid: "test" })}.${encode({ iss: "https://example.supabase.co/auth/v1", aud: "authenticated", role: "authenticated", sub: "00000000-0000-4000-8000-000000000001", exp: Date.now() / 1000 + 3600, ...overrides })}`;
    const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, new TextEncoder().encode(input));
    return `${input}.${Buffer.from(signature).toString("base64url")}`;
  };
  try {
    const spike = new SyncSpike({ storage: { sql: { exec: () => ({ one: () => ({ sqlite_ok: 1 }) }) } } }, { SUPABASE_URL: "https://example.supabase.co" });
    const token = await issue();
    expect(await spike.probe(token)).toMatchObject({ alg: "ES256", cached: false, authUserIdExtracted: true });
    expect(await spike.probe(token)).toMatchObject({ cached: true });
    expect(fetchJwks).toHaveBeenCalledTimes(1);
    await expect(spike.probe(await issue({ exp: 1 }))).rejects.toThrow("invalid-claims");
    await expect(spike.probe(await issue({ iss: "https://wrong.example/auth/v1" }))).rejects.toThrow("invalid-claims");
    const parts = token.split(".");
    parts[2] = Buffer.alloc(64).toString("base64url");
    await expect(spike.probe(parts.join("."))).rejects.toThrow("invalid-signature");
    expect((await handleSyncSpike(new Request("https://example.com/sync-spike"), {})).status).toBe(404);
  } finally { vi.unstubAllGlobals(); }
});
