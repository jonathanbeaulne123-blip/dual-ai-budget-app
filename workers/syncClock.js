import { resolveChatOrigin } from "./herculesGuard.js";

export const SYNC_CLOCK_PATH = "/sync/clock";
const MAX_BODY_BYTES = 8_192;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
    Vary: "Origin",
  };
}

function scopeFrom(value) {
  if (Object.keys(value).some((key) => !["environment", "householdId", "memberId"].includes(key))) {
    throw new HttpError(400, "Invalid clock request.");
  }
  const environment = String(value?.environment || "");
  const householdId = String(value?.householdId || "").trim();
  const memberId = String(value?.memberId || "").trim();
  if (environment !== "development") throw new HttpError(409, "Clock calibration is Development-only.");
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(householdId) || !/^[A-Za-z0-9_-]{3,100}$/.test(memberId)) {
    throw new HttpError(400, "Invalid Hearth member scope.");
  }
  return { environment, householdId, memberId };
}

function bearer(request) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new HttpError(401, "Continue with Google before measuring the proof clock.");
  return match[1];
}

function supabaseConfig(env) {
  const url = String(env?.SUPABASE_URL || "https://tykhocwacaxwquhynkok.supabase.co").replace(/\/$/, "");
  const key = String(env?.SUPABASE_PUBLISHABLE_KEY || "");
  if (!url.startsWith("https://") || !key || /service_role|secret/i.test(key)) {
    throw new HttpError(503, "Hearth Auth is not configured.");
  }
  return { url, key };
}

async function readJson(request) {
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) throw new HttpError(413, "Clock request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new HttpError(413, "Clock request is too large.");
  let value;
  try { value = JSON.parse(text || "{}"); } catch { throw new HttpError(400, "Invalid clock request."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Invalid clock request.");
  return value;
}

async function supabaseJson(env, path, token) {
  const config = supabaseConfig(env);
  const response = await fetch(`${config.url}${path}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await response.text();
  const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (!response.ok) throw new HttpError(401, "Hearth could not verify this Google session.");
  return body;
}

async function verifyMember(request, env, scope) {
  const accessToken = bearer(request);
  const user = await supabaseJson(env, "/auth/v1/user", accessToken);
  if (!user?.id) throw new HttpError(401, "Continue with Google before measuring the proof clock.");
  const query = new URLSearchParams({
    environment: "eq.development",
    household_id: `eq.${scope.householdId}`,
    member_id: `eq.${scope.memberId}`,
    auth_user_id: `eq.${String(user.id)}`,
    active: "eq.true",
    select: "environment,household_id,member_id,auth_user_id",
    limit: "1",
  });
  const rows = await supabaseJson(env, `/rest/v1/continuity_memberships?${query}`, accessToken);
  const membership = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  if (
    !membership
    || membership.environment !== "development"
    || membership.household_id !== scope.householdId
    || membership.member_id !== scope.memberId
    || membership.auth_user_id !== String(user.id)
  ) throw new HttpError(403, "This Google account is not linked to that Hearth member.");
}

export async function handleSyncClock(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== SYNC_CLOCK_PATH) return null;
  const { allowed, origin } = resolveChatOrigin(request);
  const cors = corsHeaders(origin);
  if (!allowed) return json({ ok: false, error: "origin" }, 403, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405, cors);

  // NTP-style four timestamps let the client subtract authenticated server
  // processing time instead of treating it as network/clock uncertainty.
  const serverReceivedAtMs = Date.now();
  try {
    const scope = scopeFrom(await readJson(request));
    await verifyMember(request, env, scope);
    const serverSentAtMs = Date.now();
    return json({
      ok: true,
      source: "authenticated-cloud-clock",
      serverReceivedAtMs,
      serverSentAtMs,
    }, 200, cors);
  } catch (caught) {
    const status = Number(caught?.status) || 400;
    const message = caught instanceof Error ? caught.message : "Clock calibration failed.";
    return json({ ok: false, error: message }, status, cors);
  }
}
