import { executeHerculesReadToolPlan } from "../src/core/herculesTools.ts";
import { ensureHouseholdShape } from "../src/core/sync.ts";

const DEFAULT_SUPABASE_URL = "https://tykhocwacaxwquhynkok.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS";
const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_REQUEST_TTL_SECONDS = 10 * 60;
const CODE_TTL_SECONDS = 5 * 60;
const memoryCodes = new Set();

const TOOL_CATALOG = [
  ["account_balance", "Read one visible account balance or list visible accounts."],
  ["find_transactions", "Find posted rows by merchant, account, category, member, period, or amount."],
  ["spending_summary", "Total expenses less refunds for a period, optionally filtered."],
  ["income_summary", "Total posted income for a period, optionally filtered."],
  ["compare_spending", "Compare spending between two periods."],
  ["bills_due", "List repeating household bills due within 1 to 90 days."],
  ["shift_summary", "Summarize posted shifts, hours, wages, tips, and paid breaks."],
  ["goal_progress", "Read visible savings-jar progress."],
  ["money_owed", "Read visible outstanding claims and receivables."],
  ["cash_position", "Read the household sit-down cash position."],
  ["budget_status", "Compare posted income and spending with the monthly plan."],
  ["category_breakdown", "Rank visible spending or income categories for a month."],
  ["credit_card_status", "Read a card balance, statement, minimum, due date, and utilization."],
  ["net_worth", "Read household assets less liabilities."],
  ["audit_health", "Read the deterministic books opinion and integrity-finding count."],
  ["duplicate_review", "List potential duplicate pairs and confidence. Never deletes rows."],
];

const TOOL_PROPERTIES = {
  view: { type: "string", enum: ["personal", "household"], description: "Which ledger to inspect. Defaults to personal." },
  period: { type: "string", enum: ["this_week", "last_week", "this_month", "last_month", "last_30_days", "custom"] },
  currentPeriod: { type: "string", enum: ["this_week", "last_week", "this_month", "last_month", "last_30_days"] },
  comparisonPeriod: { type: "string", enum: ["this_week", "last_week", "this_month", "last_month", "last_30_days"] },
  from: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
  to: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
  member: { type: "string", maxLength: 80 },
  account: { type: "string", maxLength: 80 },
  category: { type: "string", maxLength: 80 },
  merchant: { type: "string", maxLength: 80 },
  goal: { type: "string", maxLength: 80 },
  type: { type: "string", enum: ["expense", "income"] },
  minimumAmountCents: { type: "integer", minimum: 0, maximum: 1000000000 },
  maximumAmountCents: { type: "integer", minimum: 0, maximum: 1000000000 },
  horizonDays: { type: "integer", minimum: 1, maximum: 90 },
  limit: { type: "integer", minimum: 1, maximum: 10 },
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function originOf(request) {
  return new URL(request.url).origin;
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeJson(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
}

function signingSecret(env) {
  const secret = String(env?.HERCULES_PRO_SIGNING_SECRET || "");
  if (secret.length < 32) throw new Error("Hercules Pro has not been connected by the household owner yet.");
  return secret;
}

async function signature(env, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

async function seal(env, claims) {
  const payload = encodeJson(claims);
  return `${payload}.${await signature(env, payload)}`;
}

async function unseal(env, token, kind) {
  const [payload, supplied, extra] = String(token || "").split(".");
  if (!payload || !supplied || extra) throw new Error("Invalid token.");
  const expected = await signature(env, payload);
  if (expected.length !== supplied.length) throw new Error("Invalid token.");
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  if (mismatch) throw new Error("Invalid token.");
  const claims = decodeJson(payload);
  if (claims.kind !== kind || Number(claims.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error("Expired token.");
  return claims;
}

async function encryptionKey(env) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signingSecret(env)));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function sealPrivate(env, claims) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(claims));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), plaintext);
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function unsealPrivate(env, token, kind) {
  const [version, encodedIv, encodedBody, extra] = String(token || "").split(".");
  if (version !== "v1" || !encodedIv || !encodedBody || extra) throw new Error("Invalid token.");
  let claims;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(encodedIv) },
      await encryptionKey(env),
      fromBase64Url(encodedBody),
    );
    claims = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Invalid token.");
  }
  if (claims.kind !== kind || Number(claims.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error("Expired token.");
  return claims;
}

function randomId() {
  return base64Url(crypto.getRandomValues(new Uint8Array(18)));
}

async function sha256Base64Url(value) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function supabaseConfig(env) {
  return {
    url: String(env?.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ""),
    key: String(env?.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY),
  };
}

async function supabaseJson(env, path, accessToken) {
  const config = supabaseConfig(env);
  const response = await fetch(`${config.url}${path}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${accessToken || config.key}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Hearth cloud did not answer.");
  return body;
}

async function verifiedSupabaseUser(env, accessToken) {
  const body = await supabaseJson(env, "/auth/v1/user", accessToken);
  if (!body?.id || !body?.email) throw new Error("Continue with Google in Hearth before connecting Hercules Pro.");
  return { id: String(body.id), email: String(body.email).toLowerCase() };
}

async function verifiedMembership(env, claims) {
  const query = new URLSearchParams({
    environment: `eq.${claims.environment}`,
    household_id: `eq.${claims.householdId}`,
    member_id: `eq.${claims.memberId}`,
    auth_user_id: `eq.${claims.authUserId}`,
    active: "eq.true",
    select: "household_id,member_id,auth_user_id,role",
    limit: "1",
  });
  const rows = await supabaseJson(env, `/rest/v1/continuity_memberships?${query}`, claims.supabaseAccessToken);
  if (!Array.isArray(rows) || !rows.length) throw new Error("This Google account is no longer linked to that Hearth member.");
  return rows[0];
}

function parsePayload(row) {
  if (!row?.payload) return null;
  return typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
}

function overlayPersonal(household, personal, memberId) {
  if (!personal || personal.kind !== "personal" || personal.memberId !== memberId) return household;
  const txIds = new Set((personal.transactions || []).map((row) => row.id));
  const shiftIds = new Set((personal.shifts || []).map((row) => row.id));
  const goals = (personal.goals || []).filter((row) => !row.shared && row.ownerMemberId === memberId);
  const goalIds = new Set(goals.map((row) => row.id));
  return ensureHouseholdShape({
    ...household,
    transactions: [
      ...household.transactions.filter((row) => !((row.visibility === "personal" && row.createdBy === memberId) || txIds.has(row.id))),
      ...(personal.transactions || []).filter((row) => row.visibility === "personal" && row.createdBy === memberId),
    ],
    shifts: [
      ...household.shifts.filter((row) => !((row.visibility === "personal" && row.createdBy === memberId) || shiftIds.has(row.id))),
      ...(personal.shifts || []).filter((row) => row.visibility === "personal" && row.createdBy === memberId),
    ],
    goals: [...household.goals.filter((row) => !goalIds.has(row.id) && (row.shared || row.ownerMemberId !== memberId)), ...goals],
    goalContributions: [...household.goalContributions.filter((row) => !goalIds.has(row.goalId)), ...(personal.goalContributions || []).filter((row) => goalIds.has(row.goalId))],
    goalPurchases: [...household.goalPurchases.filter((row) => !goalIds.has(row.goalId)), ...(personal.goalPurchases || []).filter((row) => goalIds.has(row.goalId))],
  });
}

async function loadBooks(env, claims) {
  await verifiedMembership(env, claims);
  const sharedQuery = new URLSearchParams({
    environment: `eq.${claims.environment}`,
    household_id: `eq.${claims.householdId}`,
    select: "payload",
    limit: "1",
  });
  const personalQuery = new URLSearchParams({
    environment: `eq.${claims.environment}`,
    household_id: `eq.${claims.householdId}`,
    member_id: `eq.${claims.memberId}`,
    select: "payload",
    limit: "1",
  });
  const [sharedRows, personalRows] = await Promise.all([
    supabaseJson(env, `/rest/v1/household_snapshots?${sharedQuery}`, claims.supabaseAccessToken),
    supabaseJson(env, `/rest/v1/continuity_personal_snapshots?${personalQuery}`, claims.supabaseAccessToken),
  ]);
  const shared = parsePayload(sharedRows?.[0]);
  if (!shared) throw new Error("Hearth could not find this household's cloud ledger.");
  return overlayPersonal(ensureHouseholdShape(shared), parsePayload(personalRows?.[0]), claims.memberId);
}

function toolDefinitions() {
  return TOOL_CATALOG.map(([name, description]) => ({
    name,
    title: name.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
    description: `${description} Read-only; uses posted Hearth books and never changes them.`,
    inputSchema: { type: "object", properties: TOOL_PROPERTIES, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["hearth.read"] }],
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["hearth.read"] }] },
  }));
}

function torontoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function unauthorized(request) {
  const resource = `${originOf(request)}/.well-known/oauth-protected-resource`;
  return json({ error: "unauthorized", error_description: "Connect the Google account you use for Hearth." }, 401, {
    "WWW-Authenticate": `Bearer resource_metadata="${resource}", scope="hearth.read"`,
  });
}

async function accessClaims(request, env) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await unsealPrivate(env, match[1], "access");
  } catch {
    return null;
  }
}

async function handleMcp(request, env) {
  const claims = await accessClaims(request, env);
  if (!claims) return unauthorized(request);
  let rpc;
  try {
    rpc = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  if (rpc.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (rpc.method === "initialize") {
    return json({ jsonrpc: "2.0", id: rpc.id, result: {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "hearth-hercules-pro", version: "0.1.0" },
      instructions: "Hercules is a read-only financial teacher. Call tools for all current numbers. Never imply a write occurred.",
    } });
  }
  if (rpc.method === "tools/list") return json({ jsonrpc: "2.0", id: rpc.id, result: { tools: toolDefinitions() } });
  if (rpc.method === "tools/call") {
    const name = String(rpc.params?.name || "");
    if (!TOOL_CATALOG.some(([toolName]) => toolName === name)) {
      return json({ jsonrpc: "2.0", id: rpc.id, error: { code: -32602, message: "Unknown read tool." } }, 400);
    }
    try {
      const books = await loadBooks(env, claims);
      const args = rpc.params?.arguments && typeof rpc.params.arguments === "object" ? rpc.params.arguments : {};
      const view = args.view === "household" ? "household" : "personal";
      const run = executeHerculesReadToolPlan(books, { calls: [{ id: String(rpc.id ?? randomId()), name, args }] }, torontoToday(), {
        memberId: claims.memberId,
        view,
      });
      const result = run.results[0];
      const structuredContent = {
        status: result?.status || "empty",
        answer: result?.sentence || run.talk.spoken,
        facts: result?.facts || [],
        ledger: view,
        householdId: claims.householdId,
        memberId: claims.memberId,
        asOf: torontoToday(),
        readOnly: true,
      };
      return json({ jsonrpc: "2.0", id: rpc.id, result: {
        content: [{ type: "text", text: JSON.stringify(structuredContent) }],
        structuredContent,
        isError: false,
      } });
    } catch (error) {
      return json({ jsonrpc: "2.0", id: rpc.id, result: {
        content: [{ type: "text", text: error instanceof Error ? error.message : "Hearth could not read the books." }],
        isError: true,
      } });
    }
  }
  return json({ jsonrpc: "2.0", id: rpc.id ?? null, error: { code: -32601, message: "Method not found" } }, 404);
}

async function registerClient(request, env) {
  const body = await request.json().catch(() => null);
  const redirects = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String).filter((uri) => /^https:\/\//.test(uri)).slice(0, 8) : [];
  if (!redirects.length) return json({ error: "invalid_client_metadata" }, 400);
  const now = Math.floor(Date.now() / 1000);
  const clientId = await seal(env, { kind: "client", redirectUris: redirects, clientName: String(body?.client_name || "ChatGPT"), iat: now, exp: now + 365 * 24 * 60 * 60 });
  return json({ client_id: clientId, client_id_issued_at: now, redirect_uris: redirects, token_endpoint_auth_method: "none" }, 201);
}

async function authorize(request, env) {
  const url = new URL(request.url);
  try {
    const clientId = url.searchParams.get("client_id") || "";
    const client = await unseal(env, clientId, "client");
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    if (!client.redirectUris.includes(redirectUri)) throw new Error("Redirect mismatch.");
    if (url.searchParams.get("response_type") !== "code") throw new Error("Only authorization code is supported.");
    if (url.searchParams.get("code_challenge_method") !== "S256" || !url.searchParams.get("code_challenge")) throw new Error("PKCE S256 is required.");
    const now = Math.floor(Date.now() / 1000);
    const approvalRequest = await seal(env, {
      kind: "authorize",
      clientId,
      redirectUri,
      state: url.searchParams.get("state") || "",
      challenge: url.searchParams.get("code_challenge"),
      scope: "hearth.read",
      iat: now,
      exp: now + AUTH_REQUEST_TTL_SECONDS,
    });
    const approval = new URL("/", originOf(request));
    approval.searchParams.set("herculesProAuthorize", approvalRequest);
    return Response.redirect(approval.toString(), 302);
  } catch (error) {
    return json({ error: "invalid_request", error_description: error instanceof Error ? error.message : "Invalid authorization request." }, 400);
  }
}

async function approve(request, env) {
  const body = await request.json().catch(() => null);
  try {
    const authorization = await unseal(env, body?.authorizationRequest, "authorize");
    if (body?.deny === true) {
      const redirect = new URL(authorization.redirectUri);
      redirect.searchParams.set("error", "access_denied");
      redirect.searchParams.set("error_description", "The person chose not to connect Hearth.");
      if (authorization.state) redirect.searchParams.set("state", authorization.state);
      return json({ ok: true, redirect: redirect.toString() });
    }
    const environment = body?.environment === "production" ? "production" : "development";
    if (environment === "production" && String(env?.HERCULES_PRO_ALLOW_PRODUCTION || "") !== "true") {
      throw new Error("Hercules Pro is Development-only until the September security cutover.");
    }
    const user = await verifiedSupabaseUser(env, String(body?.supabaseAccessToken || ""));
    const membershipClaims = {
      environment,
      householdId: String(body?.householdId || ""),
      memberId: String(body?.memberId || ""),
      authUserId: user.id,
      supabaseAccessToken: String(body?.supabaseAccessToken || ""),
      supabaseRefreshToken: String(body?.supabaseRefreshToken || ""),
    };
    if (!membershipClaims.supabaseRefreshToken) throw new Error("Reconnect Google in Hearth, then try again.");
    await verifiedMembership(env, membershipClaims);
    const now = Math.floor(Date.now() / 1000);
    const jti = randomId();
    const code = await sealPrivate(env, {
      kind: "code",
      ...membershipClaims,
      email: user.email,
      clientId: authorization.clientId,
      redirectUri: authorization.redirectUri,
      challenge: authorization.challenge,
      jti,
      iat: now,
      exp: now + CODE_TTL_SECONDS,
    });
    const redirect = new URL(authorization.redirectUri);
    redirect.searchParams.set("code", code);
    if (authorization.state) redirect.searchParams.set("state", authorization.state);
    return json({ ok: true, redirect: redirect.toString() });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Hercules Pro connection failed." }, 400);
  }
}

async function useCodeOnce(env, jti, exp) {
  const key = `oauth-code:${jti}`;
  if (env?.HERCULES_PRO_AUTH) {
    const used = await env.HERCULES_PRO_AUTH.get(key);
    if (used) return false;
    await env.HERCULES_PRO_AUTH.put(key, "used", { expirationTtl: Math.max(60, exp - Math.floor(Date.now() / 1000)) });
    return true;
  }
  if (memoryCodes.has(key)) return false;
  memoryCodes.add(key);
  if (memoryCodes.size > 1024) memoryCodes.delete(memoryCodes.values().next().value);
  return true;
}

async function issueTokens(env, claims, clientId) {
  const now = Math.floor(Date.now() / 1000);
  const common = {
    environment: claims.environment,
    householdId: claims.householdId,
    memberId: claims.memberId,
    authUserId: claims.authUserId,
    clientId,
    scope: "hearth.read",
    supabaseAccessToken: claims.supabaseAccessToken,
  };
  return {
    access_token: await sealPrivate(env, { kind: "access", ...common, iat: now, exp: now + ACCESS_TTL_SECONDS }),
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: await sealPrivate(env, {
      kind: "refresh",
      ...common,
      supabaseRefreshToken: claims.supabaseRefreshToken,
      iat: now,
      exp: now + REFRESH_TTL_SECONDS,
    }),
    scope: "hearth.read",
  };
}

async function refreshSupabaseTokens(env, refreshToken) {
  const config = supabaseConfig(env);
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.access_token || !body?.refresh_token) throw new Error("The Google-linked Hearth session expired. Connect Hercules Pro again.");
  return { supabaseAccessToken: body.access_token, supabaseRefreshToken: body.refresh_token };
}

async function token(request, env) {
  const form = new URLSearchParams(await request.text());
  try {
    const grant = form.get("grant_type");
    const clientId = form.get("client_id") || "";
    await unseal(env, clientId, "client");
    if (grant === "authorization_code") {
      const code = await unsealPrivate(env, form.get("code"), "code");
      if (code.clientId !== clientId || code.redirectUri !== form.get("redirect_uri")) throw new Error("Authorization code does not match this client.");
      if (await sha256Base64Url(form.get("code_verifier") || "") !== code.challenge) throw new Error("PKCE verification failed.");
      if (!await useCodeOnce(env, code.jti, code.exp)) throw new Error("Authorization code was already used.");
      return json(await issueTokens(env, code, clientId));
    }
    if (grant === "refresh_token") {
      const refresh = await unsealPrivate(env, form.get("refresh_token"), "refresh");
      if (refresh.clientId !== clientId) throw new Error("Refresh token does not match this client.");
      const renewed = await refreshSupabaseTokens(env, refresh.supabaseRefreshToken);
      const claims = { ...refresh, ...renewed };
      await verifiedMembership(env, claims);
      return json(await issueTokens(env, claims, clientId));
    }
    throw new Error("Unsupported grant type.");
  } catch (error) {
    return json({ error: "invalid_grant", error_description: error instanceof Error ? error.message : "Token exchange failed." }, 400);
  }
}

export async function handleHerculesPro(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/.well-known/oauth-protected-resource" || url.pathname === "/.well-known/oauth-protected-resource/mcp") {
    return json({ resource: `${url.origin}/mcp`, authorization_servers: [url.origin], scopes_supported: ["hearth.read"], bearer_methods_supported: ["header"] });
  }
  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return json({
      issuer: url.origin,
      authorization_endpoint: `${url.origin}/oauth/authorize`,
      token_endpoint: `${url.origin}/oauth/token`,
      registration_endpoint: `${url.origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["hearth.read"],
    });
  }
  if (url.pathname === "/oauth/register" && request.method === "POST") return registerClient(request, env);
  if (url.pathname === "/oauth/authorize" && request.method === "GET") return authorize(request, env);
  if (url.pathname === "/oauth/approve" && request.method === "POST") return approve(request, env);
  if (url.pathname === "/oauth/token" && request.method === "POST") return token(request, env);
  if (url.pathname === "/mcp" && request.method === "POST") return handleMcp(request, env);
  if (url.pathname === "/mcp") {
    const claims = await accessClaims(request, env);
    return claims ? new Response(null, { status: 405, headers: { Allow: "POST" } }) : unauthorized(request);
  }
  return null;
}

export const herculesProTest = { seal, unseal, sealPrivate, unsealPrivate, sha256Base64Url, toolDefinitions, overlayPersonal };
