import { isAllowedKitchenHost, resolveChatOrigin } from "./herculesGuard.js";
import {
  hoursFromSevenShiftsPunch,
  sevenShiftsDisplayName,
  sevenShiftsPunchDate,
  sevenShiftsSafeLabel,
} from "../src/core/importInbox/sevenshifts.ts";

export const SEVENSHIFTS_STATUS_PATH = "/work/7shifts/status";
const SEVENSHIFTS_PREFIX = "/work/7shifts/";
const API_BASE = "https://api.7shifts.com";
const API_VERSION = "2026-01-01";
const MAX_PROVIDER_BYTES = 2 * 1024 * 1024;
const MAX_PAGES = 5;
const PAGE_LIMIT = 100;
const PULL_DAYS = 14;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
}

export function requestOrigin(request, url, requireOrigin = false) {
  if (request.headers.get("Origin")) return resolveChatOrigin(request);
  if (
    requireOrigin
    && request.method === "GET"
    && request.headers.get("Sec-Fetch-Site") === "same-origin"
    && isAllowedKitchenHost(url.hostname)
  ) return { allowed: true, origin: null };
  return requireOrigin ? { allowed: false, origin: null } : { allowed: isAllowedKitchenHost(url.hostname), origin: null };
}

export function corsHeaders(origin, active = false) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": active ? "GET, POST, DELETE, OPTIONS" : "GET, OPTIONS",
    "Access-Control-Allow-Headers": active ? "Accept, Authorization, Content-Type" : "Accept, Content-Type",
    Vary: "Origin",
  };
}

function enabled(env) {
  return String(env?.SEVENSHIFTS_ENABLED || "").trim().toLowerCase() === "true";
}

function supabaseConfig(env) {
  const url = String(env?.SUPABASE_URL || "https://tykhocwacaxwquhynkok.supabase.co").replace(/\/$/, "");
  const key = String(env?.SUPABASE_PUBLISHABLE_KEY || "");
  if (!url.startsWith("https://") || !key || /service_role|secret/i.test(key)) throw new Error("Hearth Auth is not configured.");
  return { url, key };
}

function activeConfig(env, environment = "development") {
  if (!enabled(env)) throw new Error("7shifts is not enabled.");
  if (environment !== "development" && environment !== "production") throw new Error("7shifts environment is invalid.");
  const production = environment === "production";
  if (production && String(env?.SEVENSHIFTS_ALLOW_PRODUCTION || "").trim().toLowerCase() !== "true") {
    throw new Error("7shifts Production activation is not permitted.");
  }
  const db = production ? env?.SEVENSHIFTS_PRODUCTION_DB : env?.FLINKS_DB;
  if (!db) throw new Error(`7shifts ${environment} encrypted connection storage is not configured.`);
  if (String(env?.SEVENSHIFTS_API_BASE_URL || "").replace(/\/$/, "") !== API_BASE) {
    throw new Error("7shifts API host is not configured.");
  }
  const encryptionKey = String((production ? env?.SEVENSHIFTS_PRODUCTION_CONNECTION_ENCRYPTION_KEY : env?.SEVENSHIFTS_CONNECTION_ENCRYPTION_KEY) || "");
  const digestKey = String((production ? env?.SEVENSHIFTS_PRODUCTION_DIGEST_KEY : env?.SEVENSHIFTS_DIGEST_KEY) || "");
  if (encryptionKey.length < 24 || digestKey.length < 24) throw new Error(`7shifts ${environment} secrets are not configured.`);
  supabaseConfig(env);
  return { db, environment, encryptionKey, digestKey };
}

export async function boundedText(stream, maximum, contentLength = null) {
  if (Number(contentLength || 0) > maximum) throw new Error("7shifts response is too large.");
  if (!stream) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error("7shifts response is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function readJson(request) {
  const text = await boundedText(request.body, 8_192, request.headers.get("Content-Length"));
  const value = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid 7shifts request.");
  return value;
}

function scopeFrom(value, env) {
  const environment = String(value?.environment || "");
  const householdId = String(value?.householdId || "").trim();
  const memberId = String(value?.memberId || "").trim();
  if (environment !== "development" && environment !== "production") throw new Error("7shifts environment is invalid.");
  const productionAllowed = [env?.SEVENSHIFTS_ALLOW_PRODUCTION, env?.EVIDENCE_ALLOW_PRODUCTION]
    .some((flag) => String(flag || "").trim().toLowerCase() === "true");
  if (environment === "production" && !productionAllowed) throw new Error("Hearth Production data access is not permitted.");
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(householdId) || !/^[A-Za-z0-9_-]{3,100}$/.test(memberId)) {
    throw new Error("Invalid Hearth member scope.");
  }
  return { environment, householdId, memberId };
}

function bearer(request) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new Error("Continue with Google before connecting 7shifts.");
  return match[1];
}

function accessTokenFrom(value) {
  const token = String(value?.accessToken || "").trim();
  if (token.length < 24 || token.length > 512 || /\s/.test(token) || /["'\\]/.test(token)) {
    throw new Error("Paste a 7shifts access token from Company Settings → Developer Tools.");
  }
  return token;
}

async function supabaseJson(env, path, token) {
  const config = supabaseConfig(env);
  const response = await fetch(`${config.url}${path}`, { headers: { apikey: config.key, Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const text = await boundedText(response.body, 256 * 1024, response.headers.get("Content-Length"));
  const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (!response.ok) throw new Error("Hearth could not verify this Google session.");
  return body;
}

export async function verifiedScope(request, env, input) {
  const scope = scopeFrom(input, env);
  const accessToken = bearer(request);
  const user = await supabaseJson(env, "/auth/v1/user", accessToken);
  if (!user?.id) throw new Error("Continue with Google before connecting 7shifts.");
  const query = new URLSearchParams({
    environment: `eq.${scope.environment}`,
    household_id: `eq.${scope.householdId}`,
    member_id: `eq.${scope.memberId}`,
    auth_user_id: `eq.${String(user.id)}`,
    active: "eq.true",
    select: "environment,household_id,member_id,auth_user_id,role",
    limit: "1",
  });
  const memberships = await supabaseJson(env, `/rest/v1/continuity_memberships?${query}`, accessToken);
  const membership = Array.isArray(memberships) && memberships.length === 1 ? memberships[0] : null;
  if (
    !membership
    || membership.environment !== scope.environment
    || membership.household_id !== scope.householdId
    || membership.member_id !== scope.memberId
    || membership.auth_user_id !== String(user.id)
  ) {
    throw new Error("This Google account is not linked to that Hearth member.");
  }
  return { ...scope, authUserId: String(user.id) };
}

function base64Url(bytes) {
  let raw = "";
  for (const value of bytes) raw += String.fromCharCode(value);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
function randomId() { return base64Url(crypto.getRandomValues(new Uint8Array(24))); }
function ownership(scope, connectionId, keyVersion = 1) {
  return `sevenshifts:v1:k${keyVersion}:${scope.environment}:${scope.authUserId}:${scope.householdId}:${scope.memberId}:${connectionId}`;
}

async function aesKey(secret) {
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function sealPrivate(config, scope, connectionId, value, keyVersion = 1) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(ownership(scope, connectionId, keyVersion));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    await aesKey(config.encryptionKey),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `v1.${keyVersion}.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}
async function unsealPrivate(config, scope, connectionId, sealed) {
  const [version, keyVersionRaw, ivRaw, bodyRaw, extra] = String(sealed || "").split(".");
  const keyVersion = Number(keyVersionRaw);
  if (version !== "v1" || keyVersion !== 1 || !ivRaw || !bodyRaw || extra) throw new Error("Invalid 7shifts connection state.");
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivRaw), additionalData: new TextEncoder().encode(ownership(scope, connectionId, keyVersion)) },
      await aesKey(config.encryptionKey),
      fromBase64Url(bodyRaw),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Invalid 7shifts connection state.");
  }
}

async function hmacHex(config, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.digestKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function punchOwnership(scope, companyId, userId, punchId) {
  return `sevenshifts:punch:v1:${scope.environment}:${scope.authUserId}:${scope.householdId}:${scope.memberId}:${companyId}:${userId}:${punchId}`;
}

async function providerJson(url, token) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "x-api-version": API_VERSION },
  });
  if (response.status >= 300 && response.status < 400) {
    const error = new Error("7shifts attempted an unexpected redirect.");
    error.status = 502;
    throw error;
  }
  const text = await boundedText(response.body, MAX_PROVIDER_BYTES, response.headers.get("Content-Length"));
  const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (response.status === 401 || response.status === 403) throw new Error("That 7shifts token was refused. Create a new access token in Developer Tools.");
  if (!response.ok || !body) {
    const error = new Error("7shifts provider request failed. Try again or disconnect.");
    error.status = 502;
    throw error;
  }
  return body;
}

async function paged(url, token) {
  const rows = [];
  let next = url;
  for (let page = 0; page < MAX_PAGES && next; page += 1) {
    const body = await providerJson(next, token);
    const data = Array.isArray(body?.data) ? body.data : [];
    rows.push(...data);
    const cursor = body?.meta?.cursor?.next;
    if (!cursor || data.length === 0) break;
    const parsed = new URL(next);
    parsed.searchParams.set("cursor", String(cursor));
    next = parsed.toString();
  }
  return rows;
}

function byId(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row && row.id != null) map.set(Number(row.id), row);
  }
  return map;
}

async function discoverCompany(token) {
  const body = await providerJson(`${API_BASE}/v2/companies?limit=5`, token);
  const company = Array.isArray(body?.data) ? body.data[0] : null;
  const companyId = Number(company?.id);
  const name = sevenShiftsSafeLabel(company?.name || company?.company_name, 80, "7shifts");
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("That 7shifts token did not return a company.");
  return { companyId, name };
}

async function discoverUsers(token, companyId) {
  const whoami = await providerJson(`${API_BASE}/v2/whoami`, token);
  const users = Array.isArray(whoami?.data?.users) ? whoami.data.users : [];
  return users.filter((user) => Number(user?.company_id) === companyId && user?.active !== false);
}

async function probeConnection(request, env, config, input) {
  const scope = await verifiedScope(request, env, input);
  const token = accessTokenFrom(input);
  const company = await discoverCompany(token);
  const users = await discoverUsers(token, company.companyId);
  if (!users.length) throw new Error("That 7shifts token has no active users on this company.");
  return {
    companyName: sevenShiftsSafeLabel(company.name, 80, "7shifts"),
    users: await Promise.all(users.slice(0, 20).map(async (user) => ({
      userDigest: `s7user_${await hmacHex(config, `${scope.authUserId}:${company.companyId}:${user.id}`)}`,
      displayName: sevenShiftsDisplayName(user),
    }))),
  };
}

async function connectAccount(request, env, config, input) {
  const scope = await verifiedScope(request, env, input);
  const token = accessTokenFrom(input);
  const jobId = String(input?.jobId || "").trim();
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(jobId)) throw new Error("Choose a Hearth job before connecting 7shifts.");
  const userDigest = String(input?.userDigest || "").trim();
  if (!/^s7user_[a-f0-9]{64}$/.test(userDigest)) throw new Error("Choose which 7shifts profile is yours.");
  const company = await discoverCompany(token);
  const users = await discoverUsers(token, company.companyId);
  const matched = [];
  for (const user of users) {
    const digest = `s7user_${await hmacHex(config, `${scope.authUserId}:${company.companyId}:${user.id}`)}`;
    if (digest === userDigest) matched.push(user);
  }
  if (matched.length !== 1) throw new Error("Choose which 7shifts profile is yours.");
  const connectionId = `s7c_${randomId()}`;
  const now = new Date().toISOString();
  const sealed = await sealPrivate(config, scope, connectionId, {
    accessToken: token,
    companyId: company.companyId,
    userId: Number(matched[0].id),
    jobId,
  });
  await config.db.prepare(
    "INSERT INTO seven_shifts_connections (connection_id, environment, auth_user_id, household_id, member_id, job_id, state, state_version, sealed_private, key_version, company_label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ready', 1, ?, 1, ?, ?, ?)",
  ).bind(connectionId, scope.environment, scope.authUserId, scope.householdId, scope.memberId, jobId, sealed, sevenShiftsSafeLabel(company.name, 80, "7shifts"), now, now).run();
  return { connectionId, companyName: sevenShiftsSafeLabel(company.name, 80, "7shifts"), jobId, state: "ready" };
}

function ownerWhere(scope, connectionId) {
  return [connectionId, scope.environment, scope.authUserId, scope.householdId, scope.memberId];
}

async function listConnections(request, env, config, query) {
  const scope = await verifiedScope(request, env, query);
  const result = await config.db.prepare(
    "SELECT connection_id, state, job_id, company_label, updated_at, last_pull_at FROM seven_shifts_connections WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'ready' ORDER BY updated_at DESC LIMIT 10",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId).all();
  return (result?.results || []).map((row) => ({
    connectionId: row.connection_id,
    state: row.state,
    jobId: row.job_id,
    companyName: sevenShiftsSafeLabel(row.company_label, 80, "7shifts"),
    updatedAt: row.updated_at,
    lastPullAt: row.last_pull_at || null,
  }));
}

async function loadConnection(config, scope, connectionId) {
  const row = await config.db.prepare(
    "SELECT * FROM seven_shifts_connections WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? LIMIT 1",
  ).bind(...ownerWhere(scope, connectionId)).first();
  if (!row || row.state !== "ready") throw new Error("7shifts connection not found.");
  return row;
}

async function nameMap(url, token) {
  const rows = await paged(url, token);
  const map = new Map();
  for (const row of rows) map.set(Number(row.id), sevenShiftsSafeLabel(row.name || row.location_name, 40, ""));
  return map;
}

async function pullConnection(request, env, config, connectionId, input) {
  const scope = await verifiedScope(request, env, input);
  const row = await loadConnection(config, scope, connectionId);
  const privateState = await unsealPrivate(config, scope, connectionId, row.sealed_private);
  const token = String(privateState?.accessToken || "");
  const companyId = Number(privateState?.companyId);
  const userId = Number(privateState?.userId);
  const jobId = String(privateState?.jobId || row.job_id || "");
  if (!token || !companyId || !userId || !jobId) throw new Error("Invalid 7shifts connection state.");
  const to = new Date();
  const from = new Date(to.getTime() - PULL_DAYS * 24 * 60 * 60 * 1000);
  const range = `clocked_in[gte]=${encodeURIComponent(from.toISOString())}&clocked_in[lte]=${encodeURIComponent(to.toISOString())}&limit=${PAGE_LIMIT}`;
  const shiftRange = `start[gte]=${encodeURIComponent(from.toISOString())}&start[lte]=${encodeURIComponent(to.toISOString())}&limit=${PAGE_LIMIT}&draft=false`;
  const [punches, roles] = await Promise.all([
    paged(`${API_BASE}/v2/company/${companyId}/time_punches?user_id=${userId}&${range}`, token),
    nameMap(`${API_BASE}/v2/company/${companyId}/roles?limit=${PAGE_LIMIT}`, token),
  ]);
  const enrichment = await Promise.allSettled([
    paged(`${API_BASE}/v2/company/${companyId}/shifts?${shiftRange}`, token),
    nameMap(`${API_BASE}/v2/company/${companyId}/locations?limit=${PAGE_LIMIT}`, token),
    paged(`${API_BASE}/v2/company/${companyId}/users?limit=${PAGE_LIMIT}`, token),
  ]);
  const scheduled = enrichment[0].status === "fulfilled" ? enrichment[0].value : [];
  const locations = enrichment[1].status === "fulfilled" ? enrichment[1].value : new Map();
  const users = enrichment[2].status === "fulfilled" ? enrichment[2].value : [];
  const warningCodes = enrichment.some((result) => result.status === "rejected") ? ["coworker-roster-incomplete"] : [];
  const usersById = byId(users);
  const inboxPunches = [];
  for (const punch of punches) {
    if (Number(punch.user_id) !== userId) continue;
    if (punch.deleted === true) continue;
    const providerPunchId = String(punch.id ?? "").trim();
    if (!/^\d{1,32}$/.test(providerPunchId)) continue;
    const hours = hoursFromSevenShiftsPunch(punch);
    const startedAt = String(punch.clocked_in || "");
    if (!startedAt || Number.isNaN(Date.parse(startedAt))) continue;
    inboxPunches.push({
      stablePunchId: `s7punch_${await hmacHex(config, punchOwnership(scope, companyId, userId, providerPunchId))}`,
      date: sevenShiftsPunchDate(startedAt),
      startedAt,
      endedAt: hours.open ? null : String(punch.clocked_out),
      workedHours: hours.workedHours,
      paidBreakHours: hours.paidBreakHours,
      roleName: sevenShiftsSafeLabel(roles.get(Number(punch.role_id)), 40, "Role"),
      locationName: sevenShiftsSafeLabel(locations.get(Number(punch.location_id)), 40, ""),
      open: hours.open,
      tipsOmitted: true,
    });
  }
  const coworkerKeys = new Set();
  const coworkers = [];
  const consider = [...scheduled, ...punches.filter((punch) => Number(punch.user_id) !== userId && punch.deleted !== true)];
  for (const item of consider) {
    const otherId = Number(item.user_id);
    if (!otherId || otherId === userId) continue;
    const start = String(item.start || item.clocked_in || "");
    if (!start || Number.isNaN(Date.parse(start))) continue;
    const date = sevenShiftsPunchDate(start);
    const displayName = sevenShiftsDisplayName(usersById.get(otherId));
    const roleName = sevenShiftsSafeLabel(roles.get(Number(item.role_id)), 40, "Role");
    const status = item.clocked_in ? "punched" : "scheduled";
    const key = `${displayName}|${roleName}|${date}|${status}`;
    if (coworkerKeys.has(key) || coworkers.length >= 40) continue;
    coworkerKeys.add(key);
    coworkers.push({ displayName, roleName, date, status });
  }
  const now = new Date().toISOString();
  await config.db.prepare(
    "UPDATE seven_shifts_connections SET last_pull_at = ?, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ?",
  ).bind(now, now, ...ownerWhere(scope, connectionId)).run();
  return {
    connectionId,
    payload: {
      provider: "7shifts",
      sourceName: sevenShiftsSafeLabel(row.company_label, 80, "7shifts"),
      sourceHash: `s7pull_${await hmacHex(config, `${ownership(scope, connectionId)}:pull:${now}`)}`,
      jobId,
      punches: inboxPunches.slice(0, 200),
      coworkers,
      ...(warningCodes.length ? { warningCodes } : {}),
    },
  };
}

async function revokeConnection(request, env, config, connectionId, query) {
  const scope = await verifiedScope(request, env, query);
  const updated = await config.db.prepare(
    "UPDATE seven_shifts_connections SET state = 'revoked', sealed_private = NULL, state_version = state_version + 1, updated_at = ?, revoked_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'ready'",
  ).bind(new Date().toISOString(), new Date().toISOString(), ...ownerWhere(scope, connectionId)).run();
  if (!updated?.meta?.changes) throw new Error("7shifts connection not found.");
  return { ok: true, revoked: true };
}

function parseConnectionPath(pathname) {
  const match = pathname.match(/^\/work\/7shifts\/connections\/([A-Za-z0-9_-]{20,80})(?:\/(pull))?$/);
  if (!match) return null;
  return { connectionId: match[1], action: match[2] || "session" };
}

async function routeEnvironment(request, url) {
  const queryEnvironment = String(url.searchParams.get("environment") || "");
  if (queryEnvironment) return queryEnvironment;
  if ((request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    const input = await readJson(request.clone());
    return String(input.environment || "");
  }
  throw new Error("7shifts environment is required.");
}

export async function handleSevenShifts(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(SEVENSHIFTS_PREFIX)) return null;
  const activeRoute = url.pathname !== SEVENSHIFTS_STATUS_PATH;
  const { allowed, origin } = requestOrigin(request, url, activeRoute);
  const cors = corsHeaders(origin, activeRoute);
  if (!allowed) return json({ ok: false, error: "origin" }, 403, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (url.pathname === SEVENSHIFTS_STATUS_PATH && request.method === "GET") {
    const states = {};
    for (const environment of ["development", "production"]) {
      try {
        const statusConfig = activeConfig(env, environment);
        await statusConfig.db.prepare("SELECT 1 AS ok FROM seven_shifts_connections LIMIT 1").first();
        states[environment] = { available: true };
      } catch (error) {
        states[environment] = { available: false, detail: String(error.message || error) };
      }
    }
    const productionAllowed = String(env?.SEVENSHIFTS_ALLOW_PRODUCTION || "").trim().toLowerCase() === "true";
    const available = states.development.available || states.production.available;
    return json({
      ok: true,
      available,
      phase: available ? "sandbox-configured" : "scaffold",
      environment: productionAllowed ? "development-and-production" : "development-only",
      providerCallsEnabled: available,
      productionAllowed,
      environments: states,
      detail: available
        ? "7shifts is configured for authenticated read-only pulls. A restaurant administrator token is still required per connection."
        : `${states.development.detail} No 7shifts account was contacted.`,
    }, 200, cors);
  }
  let config;
  try { config = activeConfig(env, await routeEnvironment(request, url)); } catch (error) { return json({ ok: false, error: String(error.message || error) }, 503, cors); }
  try {
    if (url.pathname === "/work/7shifts/probe" && request.method === "POST") {
      return json({ ok: true, ...(await probeConnection(request, env, config, await readJson(request))) }, 200, cors);
    }
    if (url.pathname === "/work/7shifts/connections" && request.method === "POST") {
      return json({ ok: true, ...(await connectAccount(request, env, config, await readJson(request))) }, 201, cors);
    }
    if (url.pathname === "/work/7shifts/connections" && request.method === "GET") {
      return json({ ok: true, connections: await listConnections(request, env, config, Object.fromEntries(url.searchParams.entries())) }, 200, cors);
    }
    const route = parseConnectionPath(url.pathname);
    if (!route) return json({ ok: false, error: "7shifts route not found." }, 404, cors);
    if (route.action === "pull" && request.method === "POST") {
      return json({ ok: true, ...(await pullConnection(request, env, config, route.connectionId, await readJson(request))) }, 200, cors);
    }
    if (route.action === "session" && request.method === "DELETE") {
      return json(await revokeConnection(request, env, config, route.connectionId, Object.fromEntries(url.searchParams.entries())), 200, cors);
    }
    return json({ ok: false, error: "7shifts method not allowed." }, 405, cors);
  } catch (error) {
    const internalMessage = String(error?.message || error || "7shifts request failed.");
    const message = Number(error?.status) >= 400 ? "7shifts provider request failed. Try again or disconnect." : internalMessage;
    const status = /Continue with Google|session|linked to/.test(message) ? 401
      : /not found/.test(message) ? 404
      : /Development-only|member scope/.test(message) ? 409
      : Number(error?.status) >= 400 ? 502
      : 400;
    return json({ ok: false, error: message }, status, cors);
  }
}
