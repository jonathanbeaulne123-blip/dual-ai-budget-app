type SpikeState = { storage: { sql: { exec(query: string): { one(): Record<string, unknown> } } } };
type SpikeEnv = { SUPABASE_URL: string };

// Disposable Development probe. No household data, membership authority or money writes.
export class SyncSpike {
  constructor(private ctx: SpikeState, private env: SpikeEnv) {}

  async fetch(request: Request): Promise<Response> {
    try {
      return Response.json(await this.probe(request.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1]));
    } catch { return Response.json({ error: "verification-failed" }, { status: 401 }); }
  }
  private keys = new Map<string, CryptoKey>();
  private keysUntil = 0;

  async probe(token?: string) {
    const sql = this.ctx.storage.sql.exec("SELECT 1 AS sqlite_ok").one();
    if (!token) return { sqlite: sql.sqlite_ok, typescript: true };
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("invalid-token");
    const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0]!)));
    if (header.alg !== "ES256") throw new Error("unsupported-algorithm");
    const cached = this.keysUntil > Date.now() && this.keys.has(header.kid);
    if (!cached) {
      const response = await fetch(`${this.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
      if (!response.ok) throw new Error("jwks-unavailable");
      const jwks = await response.json() as { keys: (JsonWebKey & { kid: string; alg: string })[] };
      this.keys.clear();
      for (const key of jwks.keys) {
        if (key.alg === "ES256" && key.kty === "EC" && key.crv === "P-256") {
          this.keys.set(key.kid, await crypto.subtle.importKey("jwk", key, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]));
        }
      }
      this.keysUntil = Date.now() + 300000;
    }
    const key = this.keys.get(header.kid);
    if (!key) throw new Error("unknown-key");
    const start = performance.now();
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, decode(parts[2]!), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) throw new Error("invalid-signature");
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1]!)));
    const now = Date.now() / 1000;
    if (claims.iss !== `${this.env.SUPABASE_URL}/auth/v1` || claims.aud !== "authenticated" ||
        typeof claims.exp !== "number" || claims.exp <= now || (claims.nbf !== undefined && claims.nbf > now) ||
        typeof claims.sub !== "string" || !/^[0-9a-f-]{36}$/i.test(claims.sub) || claims.role !== "authenticated") throw new Error("invalid-claims");
    // Extract the auth id but never return it or log bearer tokens.
    const authUserId: string = claims.sub;
    return { sqlite: sql.sqlite_ok, alg: header.alg, authUserIdExtracted: !!authUserId, cached, verifyMs: performance.now() - start };
  }
}

export async function handleSyncSpike(request: Request, env: any): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "https://hearth-books.jonathan-beaulne123.workers.dev", "Access-Control-Allow-Headers": "Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
  if (env.SYNC_SPIKE_ENABLED !== "true" || !env.SYNC_SPIKE) return new Response(null, { status: 404 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const path = new URL(request.url).pathname;
  if (path !== "/sync-spike" && path !== "/sync-spike/verify") return new Response(null, { status: 404 });
  if (request.method !== "GET" && request.method !== "POST") return new Response(null, { status: 405 });
  const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (path.endsWith("/verify") && !token) return new Response('{"error":"unauthorized"}', { status: 401, headers });
  try {
    const response = await env.SYNC_SPIKE.getByName("development:toolchain-spike").fetch(request);
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return new Response('{"error":"verification-failed"}', { status: 401, headers });
  }
}
