import { isAllowedKitchenHost, resolveChatOrigin } from "./herculesGuard.js";

export const FLINKS_STATUS_PATH = "/bank/flinks/status";
const FLINKS_PREFIX = "/bank/flinks/";
const TOOLBOX_API = "https://toolbox-api.private.fin.ag";
const TOOLBOX_IFRAME = "https://toolbox-iframe.private.fin.ag";
const SESSION_TTL_MS = 15 * 60 * 1000;
const CONNECTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MIN_POLL_MS = 10_000;
const POLL_LEASE_MS = 5 * 60 * 1000;
const MAX_PROVIDER_ROWS = 10_000;
const MAX_PROVIDER_BYTES = 6 * 1024 * 1024;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
}

function requestOrigin(request, url, requireOrigin = false) {
  if (request.headers.get("Origin")) return resolveChatOrigin(request);
  // Browsers omit Origin on same-origin GETs. Fetch Metadata is browser-controlled,
  // and the authenticated member bearer remains mandatory before any D1 read.
  if (
    requireOrigin
    && request.method === "GET"
    && request.headers.get("Sec-Fetch-Site") === "same-origin"
    && isAllowedKitchenHost(url.hostname)
  ) return { allowed: true, origin: null };
  return requireOrigin ? { allowed: false, origin: null } : { allowed: isAllowedKitchenHost(url.hostname), origin: null };
}

function corsHeaders(origin, active = false) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": active ? "GET, POST, DELETE, OPTIONS" : "GET, OPTIONS",
    "Access-Control-Allow-Headers": active ? "Accept, Authorization, Content-Type" : "Accept, Content-Type",
    Vary: "Origin",
  };
}

function enabled(env) {
  return String(env?.FLINKS_ENABLED || "").trim().toLowerCase() === "true";
}

function activeConfig(env) {
  if (!enabled(env)) throw new Error("Flinks is not enabled for Development.");
  if (String(env?.FLINKS_ALLOW_PRODUCTION || "").trim().toLowerCase() === "true") throw new Error("Flinks Production activation is not permitted.");
  if (!env?.FLINKS_DB) throw new Error("Flinks encrypted connection storage is not configured.");
  if (String(env?.FLINKS_API_BASE_URL || "").replace(/\/$/, "") !== TOOLBOX_API) throw new Error("Flinks Toolbox API is not configured.");
  if (String(env?.FLINKS_CONNECT_BASE_URL || "").replace(/\/$/, "") !== TOOLBOX_IFRAME) throw new Error("Flinks Toolbox Connect is not configured.");
  const redirectOrigin = String(env?.FLINKS_REDIRECT_ORIGIN || "").replace(/\/$/, "");
  let redirect;
  try { redirect = new URL(redirectOrigin); } catch { throw new Error("Flinks callback origin is not configured."); }
  if (redirect.protocol !== "https:" || redirect.origin !== redirectOrigin || !isAllowedKitchenHost(redirect.hostname)) {
    throw new Error("Flinks callback origin is not an approved Hearth address.");
  }
  const customerId = String(env?.FLINKS_CUSTOMER_ID || "");
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) throw new Error("Flinks customer id is not configured.");
  for (const name of ["FLINKS_SECRET_KEY", "FLINKS_API_KEY", "FLINKS_CONNECTION_ENCRYPTION_KEY", "FLINKS_DIGEST_KEY"]) {
    if (String(env?.[name] || "").length < 24) throw new Error("Flinks secrets are not configured.");
  }
  supabaseConfig(env);
  return { customerId, db: env.FLINKS_DB, redirectOrigin };
}

async function boundedText(stream, maximum, contentLength = null) {
  if (Number(contentLength || 0) > maximum) throw new Error("Flinks response is too large.");
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
      throw new Error("Flinks response is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function readJson(request) {
  const text = await boundedText(request.body, 8_192, request.headers.get("Content-Length"));
  const value = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Flinks request.");
  return value;
}

function scopeFrom(value) {
  const environment = String(value?.environment || "");
  const householdId = String(value?.householdId || "").trim();
  const memberId = String(value?.memberId || "").trim();
  if (environment !== "development") throw new Error("Flinks is Development-only.");
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(householdId) || !/^[A-Za-z0-9_-]{3,100}$/.test(memberId)) throw new Error("Invalid Hearth member scope.");
  return { environment, householdId, memberId };
}

function bearer(request) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new Error("Continue with Google before connecting a bank.");
  return match[1];
}

function supabaseConfig(env) {
  const url = String(env?.SUPABASE_URL || "https://tykhocwacaxwquhynkok.supabase.co").replace(/\/$/, "");
  const key = String(env?.SUPABASE_PUBLISHABLE_KEY || "");
  if (!url.startsWith("https://") || !key || /service_role|secret/i.test(key)) throw new Error("Hearth Auth is not configured.");
  return { url, key };
}

async function supabaseJson(env, path, token) {
  const config = supabaseConfig(env);
  const response = await fetch(`${config.url}${path}`, { headers: { apikey: config.key, Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const text = await boundedText(response.body, 256 * 1024, response.headers.get("Content-Length"));
  const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (!response.ok) throw new Error("Hearth could not verify this Google session.");
  return body;
}

async function verifiedScope(request, env, input) {
  const scope = scopeFrom(input);
  const accessToken = bearer(request);
  const user = await supabaseJson(env, "/auth/v1/user", accessToken);
  if (!user?.id) throw new Error("Continue with Google before connecting a bank.");
  const query = new URLSearchParams({ environment: "eq.development", household_id: `eq.${scope.householdId}`, member_id: `eq.${scope.memberId}`, auth_user_id: `eq.${String(user.id)}`, active: "eq.true", select: "household_id,member_id,auth_user_id,role", limit: "1" });
  const memberships = await supabaseJson(env, `/rest/v1/continuity_memberships?${query}`, accessToken);
  if (!Array.isArray(memberships) || memberships.length !== 1) throw new Error("This Google account is not linked to that Hearth member.");
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
function ownership(scope, connectionId, keyVersion = 1) { return `flinks:v1:k${keyVersion}:${scope.environment}:${scope.authUserId}:${scope.householdId}:${scope.memberId}:${connectionId}`; }

async function aesKey(secret) {
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function sealPrivate(env, scope, connectionId, value, keyVersion = 1) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(ownership(scope, connectionId, keyVersion));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, await aesKey(String(env.FLINKS_CONNECTION_ENCRYPTION_KEY)), new TextEncoder().encode(JSON.stringify(value)));
  return `v1.${keyVersion}.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}
async function unsealPrivate(env, scope, connectionId, sealed) {
  const [version, keyVersionRaw, ivRaw, bodyRaw, extra] = String(sealed || "").split(".");
  const keyVersion = Number(keyVersionRaw);
  if (version !== "v1" || keyVersion !== 1 || !ivRaw || !bodyRaw || extra) throw new Error("Invalid Flinks connection state.");
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivRaw), additionalData: new TextEncoder().encode(ownership(scope, connectionId, keyVersion)) }, await aesKey(String(env.FLINKS_CONNECTION_ENCRYPTION_KEY)), fromBase64Url(bodyRaw));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch { throw new Error("Invalid Flinks connection state."); }
}

async function hmacHex(env, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(env.FLINKS_DIGEST_KEY)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function apiUrl(config, endpoint) { return `${TOOLBOX_API}/v3/${config.customerId}/BankingServices/${endpoint}`; }
async function providerJson(url, options) {
  // Workers implements "follow" and "manual", not the browser-only "error"
  // value. Keep provider redirects inert and reject them explicitly.
  const response = await fetch(url, { ...options, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const error = new Error("Flinks attempted an unexpected redirect.");
    error.status = 502;
    throw error;
  }
  const text = await boundedText(response.body, MAX_PROVIDER_BYTES, response.headers.get("Content-Length"));
  const body = (() => { try { return JSON.parse(text); } catch { return {}; } })();
  if (!response.ok && response.status !== 202) {
    const error = new Error(String(body?.Message || body?.FlinksCode || `Flinks returned ${response.status}.`));
    error.status = response.status;
    throw error;
  }
  return { status: response.status, body };
}
async function authorizeToken(env, config) {
  const { body } = await providerJson(apiUrl(config, "GenerateAuthorizeToken"), { method: "POST", headers: { "flinks-auth-key": String(env.FLINKS_SECRET_KEY), Accept: "application/json", "Content-Type": "application/json" } });
  if (body?.HttpStatusCode !== 200 || typeof body?.Token !== "string" || body.Token.length < 16) throw new Error("Flinks did not issue a Connect token.");
  return body.Token;
}
function connectCallbackUrl(config, state) {
  const url = new URL("/bank/flinks/callback", config.redirectOrigin);
  url.searchParams.set("state", state);
  return url.toString();
}
function connectUrl(token, redirectUrl) {
  const url = new URL("/v2/", TOOLBOX_IFRAME);
  for (const [key, value] of Object.entries({
    demo: "true",
    authorizeToken: token,
    redirectUrl,
    jsRedirect: "true",
    consentEnable: "true",
    closeEnable: "true",
    accountSelectorEnable: "true",
    accountSelectorMultiple: "true",
    accountSelectorCurrency: "cad",
    fetchAllAccounts: "false",
    showAllAccounts: "true",
    daysOfTransactions: "Days90",
    withTransactions: "true",
    customerName: "Hearth",
    language: "en",
  })) url.searchParams.set(key, value);
  return url.toString();
}
async function authorizeLogin(env, config, loginId) {
  const token = await authorizeToken(env, config);
  const { body } = await providerJson(apiUrl(config, "Authorize"), { method: "POST", headers: { "flinks-auth-key": token, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ LoginId: loginId, MostRecentCached: true }) });
  if (!/^[0-9a-f-]{36}$/i.test(String(body?.RequestId || ""))) throw new Error("Flinks did not authorize account retrieval.");
  return String(body.RequestId);
}
async function initialDetail(env, config, requestId, selectedAccountIds) {
  if (!Array.isArray(selectedAccountIds) || selectedAccountIds.length < 1 || selectedAccountIds.length > 32) {
    throw new Error("Flinks account selection is missing or invalid. Disconnect and connect again.");
  }
  return providerJson(apiUrl(config, "GetAccountsDetail"), { method: "POST", headers: { "x-api-key": String(env.FLINKS_API_KEY), Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ RequestId: requestId, WithAccountIdentity: false, WithKYC: false, WithTransactions: true, DaysOfTransactions: "Days90", AccountsFilter: selectedAccountIds }) });
}
async function asyncDetail(env, config, requestId) {
  return providerJson(apiUrl(config, `GetAccountsDetailAsync/${encodeURIComponent(requestId)}`), { method: "GET", headers: { "x-api-key": String(env.FLINKS_API_KEY), Accept: "application/json", "Content-Type": "application/json" } });
}

function accountKind(value) {
  const type = String(value || "").toLowerCase();
  if (/credit|card/.test(type)) return "credit-card";
  if (/chequ|saving|operation|bank/.test(type)) return "bank";
  return "unknown";
}
function exactAmount(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Flinks returned an amount that is not exact to CAD cents.");
  return text;
}
function providerTransactionStatus(transaction) {
  const code = String(transaction?.Code ?? "").trim().toLowerCase();
  const description = String(transaction?.Description ?? "").toLowerCase();
  return code === "1" || code === "pending" || /\bpending\b/.test(description) ? "pending" : "posted";
}
async function inboxPayload(env, scope, connectionId, detail) {
  if (detail?.HttpStatusCode !== 200 || !Array.isArray(detail?.Accounts)) throw new Error("Flinks returned invalid account details.");
  let count = 0;
  const transactions = [];
  for (const account of detail.Accounts) {
    const rawAccountId = String(account?.Id || "");
    if (!rawAccountId) throw new Error("Flinks returned an account without an id.");
    const stableOwner = `flinks:v1:${scope.environment}:${scope.authUserId}:${scope.householdId}:${scope.memberId}`;
    const accountDigest = await hmacHex(env, `${stableOwner}:account:${rawAccountId}`);
    for (const transaction of Array.isArray(account?.Transactions) ? account.Transactions : []) {
      if (++count > MAX_PROVIDER_ROWS) throw new Error("Flinks returned too many transactions.");
      const rawTransactionId = String(transaction?.Id || "");
      if (!rawTransactionId) throw new Error("Flinks returned a transaction without an id.");
      const debit = exactAmount(transaction?.Debit);
      const credit = exactAmount(transaction?.Credit);
      if ((debit == null) === (credit == null)) throw new Error("Flinks returned a transaction without one exact debit or credit amount.");
      transactions.push({ stableTransactionId: `ftx_${await hmacHex(env, `${accountDigest}:transaction:${rawTransactionId}`)}`, status: providerTransactionStatus(transaction), accountRef: `fac_${accountDigest}`, accountLast4: String(account?.LastFourDigits || account?.AccountNumber || "").replace(/\D/g, "").slice(-4), accountKind: accountKind(account?.Type || account?.Category), currency: String(account?.Currency || ""), date: String(transaction?.Date || "").slice(0, 10), debit, credit, code: transaction?.Code == null ? null : String(transaction.Code).slice(0, 40), description: transaction?.Description == null ? null : String(transaction.Description).slice(0, 240), merchant: null });
    }
  }
  return { provider: "flinks", sourceName: String(detail?.InstitutionName || detail?.Institution || "Flinks bank connection").slice(0, 100), sourceHash: `fpull_${await hmacHex(env, `${ownership(scope, connectionId)}:pull:${String(detail.RequestId || "")}`)}`, transactions };
}

function ownerWhere(scope, connectionId) { return [connectionId, scope.environment, scope.authUserId, scope.householdId, scope.memberId]; }
async function connection(config, scope, connectionId) {
  return config.db.prepare("SELECT * FROM flinks_connections WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? LIMIT 1").bind(...ownerWhere(scope, connectionId)).first();
}
function changed(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0) === 1;
}
function leaseActive(row) {
  return Boolean(row?.poll_lease_id && Date.parse(String(row.poll_lease_until || "")) > Date.now());
}
async function acquirePollLease(config, scope, row) {
  if (leaseActive(row)) return null;
  const leaseId = randomId();
  const now = new Date();
  const leased = await config.db.prepare("UPDATE flinks_connections SET poll_lease_id = ?, poll_lease_until = ?, last_poll_at = ?, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = ? AND state_version = ? AND (poll_lease_until IS NULL OR poll_lease_until <= ?)")
    .bind(leaseId, new Date(now.getTime() + POLL_LEASE_MS).toISOString(), now.toISOString(), now.toISOString(), ...ownerWhere(scope, row.connection_id), row.state, row.state_version, now.toISOString()).run();
  return changed(leased) ? leaseId : null;
}
async function releasePollLease(config, scope, row, leaseId) {
  await config.db.prepare("UPDATE flinks_connections SET poll_lease_id = NULL, poll_lease_until = NULL, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND poll_lease_id = ?")
    .bind(new Date().toISOString(), ...ownerWhere(scope, row.connection_id), leaseId).run();
}
async function listConnections(request, env, config, query) {
  const scope = await verifiedScope(request, env, query);
  const now = new Date().toISOString();
  await config.db.prepare("UPDATE flinks_connections SET state = 'expired', sealed_private = NULL, state_version = state_version + 1, updated_at = ? WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'authorizing' AND expires_at <= ?")
    .bind(now, scope.environment, scope.authUserId, scope.householdId, scope.memberId, now).run();
  const result = await config.db.prepare("SELECT connection_id, state, updated_at FROM flinks_connections WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state NOT IN ('revoked', 'expired') ORDER BY updated_at DESC LIMIT 10")
    .bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId).all();
  return (Array.isArray(result?.results) ? result.results : []).map((row) => ({
    connectionId: String(row.connection_id || ""),
    state: String(row.state || ""),
    updatedAt: String(row.updated_at || ""),
  })).filter((row) => /^[A-Za-z0-9_-]{20,80}$/.test(row.connectionId));
}
function parseSessionPath(pathname) {
  const match = pathname.match(/^\/bank\/flinks\/sessions\/([A-Za-z0-9_-]{20,80})(?:\/(complete|transactions))?$/);
  return match ? { connectionId: match[1], action: match[2] || "session" } : null;
}

async function startSession(request, env, config, body) {
  const scope = await verifiedScope(request, env, body);
  const recent = await config.db.prepare("SELECT COUNT(*) AS count FROM flinks_connections WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND created_at >= ?")
    .bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, new Date(Date.now() - SESSION_TTL_MS).toISOString()).first();
  if (Number(recent?.count || 0) >= 3) throw new Error("Too many recent Flinks connection attempts. Wait 15 minutes.");
  const connectionId = randomId();
  const connectState = randomId();
  const sealed = await sealPrivate(env, scope, connectionId, { connectState, loginId: null, requestId: null, selectedAccountIds: null });
  const now = new Date();
  await config.db.prepare("INSERT INTO flinks_connections (connection_id, environment, auth_user_id, household_id, member_id, state, state_version, sealed_private, key_version, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, 'authorizing', 1, ?, 1, ?, ?, ?)").bind(connectionId, scope.environment, scope.authUserId, scope.householdId, scope.memberId, sealed, now.toISOString(), now.toISOString(), new Date(now.getTime() + SESSION_TTL_MS).toISOString()).run();
  try {
    const token = await authorizeToken(env, config);
    return {
      connectionId,
      iframeUrl: connectUrl(token, connectCallbackUrl(config, connectState)),
      messageOrigin: TOOLBOX_IFRAME,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    };
  } catch (error) {
    await config.db.prepare("UPDATE flinks_connections SET state = 'expired', sealed_private = NULL, state_version = state_version + 1, updated_at = ? WHERE connection_id = ?").bind(new Date().toISOString(), connectionId).run();
    throw error;
  }
}
function completionFromRedirect(value, config, expectedState) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("Flinks completion was invalid."); }
  if (url.protocol !== "https:" || url.origin !== config.redirectOrigin || url.pathname !== "/bank/flinks/callback") {
    throw new Error("Flinks completion came from an unexpected redirect.");
  }
  if (url.searchParams.get("state") !== expectedState) throw new Error("Flinks completion did not match this connection attempt.");
  const loginId = String(url.searchParams.get("loginId") || "");
  if (!/^[0-9a-f-]{36}$/i.test(loginId)) throw new Error("Flinks completion did not contain a valid login id.");
  const selectedAccountIds = [...new Set(String(url.searchParams.get("accountId") || "").split(",").map((value) => value.trim()).filter(Boolean))];
  if (selectedAccountIds.length < 1 || selectedAccountIds.length > 32 || selectedAccountIds.some((value) => !/^[0-9a-f-]{36}$/i.test(value))) {
    throw new Error("Flinks completion did not contain a valid account selection.");
  }
  return { loginId, selectedAccountIds };
}
async function completeSession(request, env, config, connectionId, body) {
  const scope = await verifiedScope(request, env, body);
  let row = await connection(config, scope, connectionId);
  if (!row) throw new Error("Flinks connection was not found for this member.");
  if (!["authorizing", "completing"].includes(row.state)) {
    if (["linked", "polling", "ready"].includes(row.state)) return { status: "pending", connectionId, retryAfterMs: MIN_POLL_MS };
    throw new Error("Flinks connection cannot be completed in its current state.");
  }
  if (Date.parse(row.expires_at) <= Date.now()) throw new Error("Flinks Connect expired. Start again.");
  const expectedPrivate = await unsealPrivate(env, scope, connectionId, row.sealed_private);
  const connectState = String(expectedPrivate.connectState || "");
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(connectState)) throw new Error("Invalid Flinks connection state.");
  const { loginId, selectedAccountIds } = completionFromRedirect(body.redirectUrl, config, connectState);
  if (row.state === "authorizing") {
    const loginOnly = await sealPrivate(env, scope, connectionId, { connectState, loginId, requestId: null, selectedAccountIds });
    const claimed = await config.db.prepare("UPDATE flinks_connections SET state = 'completing', state_version = state_version + 1, sealed_private = ?, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'authorizing' AND state_version = ?")
      .bind(loginOnly, new Date().toISOString(), ...ownerWhere(scope, connectionId), row.state_version).run();
    if ((claimed?.meta?.changes ?? claimed?.changes) !== 1) throw new Error("Flinks completion was already claimed.");
    row = { ...row, state: "completing", state_version: Number(row.state_version) + 1, sealed_private: loginOnly };
  } else {
    const claimedPrivate = expectedPrivate;
    if (claimedPrivate.loginId !== loginId) throw new Error("Flinks completion does not match this connection attempt.");
    if (JSON.stringify(claimedPrivate.selectedAccountIds) !== JSON.stringify(selectedAccountIds)) throw new Error("Flinks account selection changed while the connection was completing.");
  }
  const requestId = await authorizeLogin(env, config, loginId);
  const sealed = await sealPrivate(env, scope, connectionId, { connectState, loginId, requestId, selectedAccountIds });
  const leaseId = randomId();
  const now = new Date();
  const updated = await config.db.prepare("UPDATE flinks_connections SET state = 'polling', state_version = state_version + 1, sealed_private = ?, poll_lease_id = ?, poll_lease_until = ?, last_poll_at = ?, updated_at = ?, expires_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'completing' AND state_version = ?")
    .bind(sealed, leaseId, new Date(now.getTime() + POLL_LEASE_MS).toISOString(), now.toISOString(), now.toISOString(), new Date(now.getTime() + CONNECTION_TTL_MS).toISOString(), ...ownerWhere(scope, connectionId), row.state_version).run();
  if (!changed(updated)) throw new Error("Flinks completion was already used.");
  const pollingVersion = Number(row.state_version) + 1;
  try {
    const result = await initialDetail(env, config, requestId, selectedAccountIds);
    if (result.status === 202) {
      await config.db.prepare("UPDATE flinks_connections SET poll_lease_id = NULL, poll_lease_until = NULL, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'polling' AND state_version = ? AND poll_lease_id = ?")
        .bind(new Date().toISOString(), ...ownerWhere(scope, connectionId), pollingVersion, leaseId).run();
      return { status: "pending", connectionId, retryAfterMs: MIN_POLL_MS };
    }
    const payload = await inboxPayload(env, scope, connectionId, result.body);
    const ready = await config.db.prepare("UPDATE flinks_connections SET state = 'ready', state_version = state_version + 1, poll_lease_id = NULL, poll_lease_until = NULL, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'polling' AND state_version = ? AND poll_lease_id = ?")
      .bind(new Date().toISOString(), ...ownerWhere(scope, connectionId), pollingVersion, leaseId).run();
    if (!changed(ready)) throw new Error("Flinks connection changed while account evidence was loading.");
    return { status: "ready", connectionId, payload };
  } catch (error) {
    await releasePollLease(config, scope, { connection_id: connectionId }, leaseId);
    throw error;
  }
}
async function pollSession(request, env, config, connectionId, query) {
  const scope = await verifiedScope(request, env, query);
  const row = await connection(config, scope, connectionId);
  if (!row || !row.sealed_private || !["polling", "ready"].includes(row.state)) throw new Error("Flinks connection is not ready to retrieve.");
  if (Date.parse(row.expires_at) <= Date.now()) throw new Error("Flinks connection expired. Disconnect it and connect again.");
  if (row.last_poll_at && Date.now() - Date.parse(row.last_poll_at) < MIN_POLL_MS) return { status: "pending", connectionId, retryAfterMs: MIN_POLL_MS };
  const leaseId = await acquirePollLease(config, scope, row);
  if (!leaseId) return { status: "pending", connectionId, retryAfterMs: MIN_POLL_MS };
  const privateState = await unsealPrivate(env, scope, connectionId, row.sealed_private);
  try {
    let requestId = String(privateState.requestId || "");
    let sealed = row.sealed_private;
    let result;
    if (row.state === "ready") {
      requestId = await authorizeLogin(env, config, String(privateState.loginId || ""));
      sealed = await sealPrivate(env, scope, connectionId, { connectState: privateState.connectState, loginId: privateState.loginId, requestId, selectedAccountIds: privateState.selectedAccountIds });
      result = await initialDetail(env, config, requestId, privateState.selectedAccountIds);
    } else {
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("Flinks polling state is invalid. Disconnect and connect again.");
      result = await asyncDetail(env, config, requestId);
    }
    if (result.status === 202) {
      const pending = await config.db.prepare("UPDATE flinks_connections SET state = 'polling', sealed_private = ?, state_version = state_version + 1, poll_lease_id = NULL, poll_lease_until = NULL, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = ? AND state_version = ? AND poll_lease_id = ?")
        .bind(sealed, new Date().toISOString(), ...ownerWhere(scope, connectionId), row.state, row.state_version, leaseId).run();
      if (!changed(pending)) throw new Error("Flinks connection changed while polling.");
      return { status: "pending", connectionId, retryAfterMs: MIN_POLL_MS };
    }
    const payload = await inboxPayload(env, scope, connectionId, result.body);
    const ready = await config.db.prepare("UPDATE flinks_connections SET state = 'ready', sealed_private = ?, state_version = state_version + 1, poll_lease_id = NULL, poll_lease_until = NULL, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = ? AND state_version = ? AND poll_lease_id = ?")
      .bind(sealed, new Date().toISOString(), ...ownerWhere(scope, connectionId), row.state, row.state_version, leaseId).run();
    if (!changed(ready)) throw new Error("Flinks connection changed while account evidence was loading.");
    return { status: "ready", connectionId, payload };
  } catch (error) {
    await releasePollLease(config, scope, row, leaseId);
    throw error;
  }
}
async function revokeSession(request, env, config, connectionId, query) {
  const scope = await verifiedScope(request, env, query);
  const row = await connection(config, scope, connectionId);
  if (!row || row.state === "revoked") return { ok: true, revoked: true };
  if (row.state === "revoking" || leaseActive(row)) throw new Error("Flinks is finishing another operation. Try disconnect again in a few minutes.");
  const now = new Date().toISOString();
  const claimed = await config.db.prepare("UPDATE flinks_connections SET state = 'revoking', state_version = state_version + 1, poll_lease_id = NULL, poll_lease_until = NULL, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = ? AND state_version = ? AND (poll_lease_until IS NULL OR poll_lease_until <= ?)")
    .bind(now, ...ownerWhere(scope, connectionId), row.state, row.state_version, now).run();
  if (!changed(claimed)) throw new Error("Flinks connection changed before it could be disconnected. Try again.");
  const revokingVersion = Number(row.state_version) + 1;
  if (row.sealed_private) {
    const privateState = await unsealPrivate(env, scope, connectionId, row.sealed_private);
    if (privateState.loginId) try {
      const deleted = await providerJson(apiUrl(config, `DeleteCard/${encodeURIComponent(String(privateState.loginId || ""))}`), { method: "DELETE", headers: { "x-api-key": String(env.FLINKS_API_KEY), Accept: "application/json", "Content-Type": "application/json" } });
      if (deleted.status !== 200) throw new Error("Flinks deletion is still processing.");
    } catch (error) {
      await config.db.prepare("UPDATE flinks_connections SET state = 'revoke_pending', state_version = state_version + 1, updated_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'revoking' AND state_version = ?")
        .bind(new Date().toISOString(), ...ownerWhere(scope, connectionId), revokingVersion).run();
      throw error;
    }
  }
  const revokedAt = new Date().toISOString();
  const revoked = await config.db.prepare("UPDATE flinks_connections SET state = 'revoked', sealed_private = NULL, state_version = state_version + 1, updated_at = ?, revoked_at = ? WHERE connection_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'revoking' AND state_version = ?")
    .bind(revokedAt, revokedAt, ...ownerWhere(scope, connectionId), revokingVersion).run();
  if (!changed(revoked)) throw new Error("Flinks connection changed before provider deletion could be recorded.");
  return { ok: true, revoked: true };
}

/** Development-only authenticated Bank Inbox boundary. Checked-in flags remain off. */
export async function handleFlinks(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/flinks/sync") {
    const { allowed, origin } = requestOrigin(request, url, true);
    const cors = corsHeaders(origin, true);
    if (!allowed) return json({ ok: false, error: "origin" }, 403, cors);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    return json({ ok: false, error: "The legacy /flinks/sync route is retired. Use secure Flinks Connect in Books > Import." }, 410, cors);
  }
  if (!url.pathname.startsWith(FLINKS_PREFIX)) return null;
  const activeRoute = url.pathname !== FLINKS_STATUS_PATH;
  const { allowed, origin } = requestOrigin(request, url, activeRoute);
  const cors = corsHeaders(origin, activeRoute);
  if (!allowed) return json({ ok: false, error: "origin" }, 403, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (url.pathname === FLINKS_STATUS_PATH && request.method === "GET") {
    try {
      const statusConfig = activeConfig(env);
      await statusConfig.db.prepare("SELECT 1 AS ok FROM flinks_connections LIMIT 1").first();
      return json({ ok: true, available: true, phase: "sandbox-configured", environment: "development-only", providerCallsEnabled: true, productionAllowed: false, detail: "Flinks Toolbox is configured for Development. Bank evidence still enters the review inbox and never posts by itself." }, 200, cors);
    } catch (error) {
      const lockedDetail = enabled(env)
        ? `${String(error.message || error)} No bank was contacted.`
        : "Flinks is installed as a Development Bank Inbox scaffold. Activation still requires the reviewed Auth smoke, encrypted D1 binding, Worker secrets, and deploy approval.";
      return json({ ok: true, available: false, phase: "scaffold", environment: "development-only", providerCallsEnabled: false, productionAllowed: false, detail: lockedDetail }, 200, cors);
    }
  }
  let config;
  try { config = activeConfig(env); } catch (error) { return json({ ok: false, error: String(error.message || error) }, 503, cors); }
  try {
    if (url.pathname === "/bank/flinks/sessions" && request.method === "POST") return json({ ok: true, ...(await startSession(request, env, config, await readJson(request))) }, 201, cors);
    if (url.pathname === "/bank/flinks/connections" && request.method === "GET") return json({ ok: true, connections: await listConnections(request, env, config, Object.fromEntries(url.searchParams.entries())) }, 200, cors);
    const route = parseSessionPath(url.pathname);
    if (!route) return json({ ok: false, error: "Flinks route not found." }, 404, cors);
    if (route.action === "complete" && request.method === "POST") return json({ ok: true, ...(await completeSession(request, env, config, route.connectionId, await readJson(request))) }, 200, cors);
    const query = Object.fromEntries(url.searchParams.entries());
    if (route.action === "transactions" && request.method === "POST") return json({ ok: true, ...(await pollSession(request, env, config, route.connectionId, await readJson(request))) }, 200, cors);
    if (route.action === "session" && request.method === "DELETE") return json(await revokeSession(request, env, config, route.connectionId, query), 200, cors);
    return json({ ok: false, error: "Flinks method not allowed." }, 405, cors);
  } catch (error) {
    const internalMessage = String(error?.message || error || "Flinks request failed.");
    const message = Number(error?.status) >= 400 ? "Flinks provider request failed. Try again or disconnect." : internalMessage;
    const status = /Continue with Google|session|linked to/.test(message) ? 401 : /not found/.test(message) ? 404 : /current state|already used|invalid|expired|Development-only|member scope|another operation|changed before|while polling|while account evidence/.test(message) ? 409 : Number(error?.status) >= 400 ? 502 : 400;
    return json({ ok: false, error: message }, status, cors);
  }
}
