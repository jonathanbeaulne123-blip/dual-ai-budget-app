import { corsHeaders, resolveChatOrigin } from "./herculesGuard.js";

const DEFAULT_SUPABASE_URL = "https://tykhocwacaxwquhynkok.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS";
const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 1500;
const SESSION_TTL_SECONDS = 900;
const CONNECT_SESSION_KIND = "flinks-connect-session";
const CONNECTION_KIND = "flinks-connection";

function json(body, status = 200, cors = {}, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors, ...extra },
  });
}

function flinksCors(origin) {
  const base = corsHeaders(origin);
  return {
    ...base,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function base64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomId() {
  return base64Url(crypto.getRandomValues(new Uint8Array(18)));
}

function clip(value, max = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function supabaseConfig(env) {
  return {
    url: String(env?.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ""),
    key: String(env?.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY),
  };
}

async function supabaseRequest(env, path, accessToken, init = {}) {
  const config = supabaseConfig(env);
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${accessToken || config.key}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Hearth cloud did not answer.");
  return body;
}

async function verifiedSupabaseUser(env, accessToken) {
  const body = await supabaseRequest(env, "/auth/v1/user", accessToken);
  if (!body?.id || !body?.email) throw new Error("Continue with Google in Hearth before connecting Flinks.");
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
  const rows = await supabaseRequest(env, `/rest/v1/continuity_memberships?${query}`, claims.supabaseAccessToken);
  if (!Array.isArray(rows) || !rows.length) throw new Error("This Google account is no longer linked to that Hearth member.");
  return rows[0];
}

function memberKey(claims) {
  return `${claims.environment}|${claims.householdId}|${claims.memberId}|${claims.authUserId}`;
}

function assertDevelopmentOnly(environment) {
  if (environment === "production") throw new Error("Flinks is Development-only until Production readiness.");
}

function flinksConfigured(env) {
  return Boolean(String(env.FLINKS_CUSTOMER_ID || "").trim() && String(env.FLINKS_API_KEY || "").trim());
}

function flinksInstance(env) {
  return String(env.FLINKS_INSTANCE || "toolbox").trim() || "toolbox";
}

function flinksIframeOrigin(env) {
  return `https://${flinksInstance(env)}-iframe.private.fin.ag`;
}

function flinksBase(env) {
  const customerId = String(env.FLINKS_CUSTOMER_ID || "").trim();
  if (!customerId) throw new Error("Flinks is not configured on the Worker.");
  return `https://${flinksInstance(env)}-api.private.fin.ag/v3/${customerId}/BankingServices`;
}

async function digestKey(env) {
  const secret = String(env.FLINKS_DIGEST_KEY || "").trim();
  if (secret.length < 16) throw new Error("Flinks digest key is not configured on the Worker.");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function digestFlinksId(env, kind, value) {
  const key = await digestKey(env);
  const payload = `${kind}:${String(value || "")}`;
  const digest = base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
  return `flinks:${kind}:${digest.slice(0, 32)}`;
}

async function connectionEncryptionKey(env) {
  const secret = String(env.FLINKS_CONNECTION_ENCRYPTION_KEY || "").trim();
  if (secret.length < 16) throw new Error("Flinks connection encryption key is not configured on the Worker.");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptBlob(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await connectionEncryptionKey(env), plaintext);
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decryptBlob(env, token) {
  const [version, encodedIv, encodedBody, extra] = String(token || "").split(".");
  if (version !== "v1" || !encodedIv || !encodedBody || extra) throw new Error("Stored Flinks connection is invalid.");
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(encodedIv) },
      await connectionEncryptionKey(env),
      fromBase64Url(encodedBody),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Stored Flinks connection could not be decrypted.");
  }
}

async function flinksFetch(env, path, init = {}) {
  const apiKey = String(env.FLINKS_API_KEY || "").trim();
  if (!apiKey) throw new Error("Flinks API key is not configured on the Worker.");
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    ...(init.headers ?? {}),
  };
  const response = await fetch(`${flinksBase(env)}${path}`, { ...init, headers });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("json") ? await response.json() : null;
  return { response, payload };
}

async function generateAuthorizeKey(env) {
  const secretKey = String(env.FLINKS_SECRET_KEY || env.FLINKS_API_KEY || "").trim();
  const { response, payload } = await flinksFetch(env, "/GenerateAuthorizeToken", {
    method: "POST",
    body: JSON.stringify(secretKey ? { secret: secretKey } : {}),
  });
  if (!response.ok) throw new Error(payload?.Message || `Flinks authorize token failed (${response.status}).`);
  const token = payload?.Token || payload?.AuthorizeToken || payload?.token;
  if (!token) throw new Error("Flinks did not return an authorize token.");
  return String(token);
}

async function authorizeLogin(env, loginId, authKey) {
  const { response, payload } = await flinksFetch(env, "/Authorize", {
    method: "POST",
    headers: { "flinks-auth-key": authKey },
    body: JSON.stringify({ LoginId: loginId, MostRecentCached: true, Save: true, Language: "en" }),
  });
  if (response.status === 203) throw new Error("Flinks needs another sign-in step. Finish Connect, then import again.");
  if (!response.ok) throw new Error(payload?.Message || `Flinks authorize failed (${response.status}).`);
  const requestId = payload?.RequestId;
  if (!requestId) throw new Error("Flinks authorize did not return a RequestId.");
  return String(requestId);
}

async function fetchAccountsDetail(env, requestId, authKey) {
  const { response, payload } = await flinksFetch(env, "/GetAccountsDetail", {
    method: "POST",
    headers: { "flinks-auth-key": authKey },
    body: JSON.stringify({
      RequestId: requestId,
      WithAccountIdentity: true,
      WithKYC: false,
      WithTransactions: true,
      DaysOfTransactions: "Days90",
    }),
  });
  if (response.status === 202) return { pending: true, payload };
  if (!response.ok) throw new Error(payload?.Message || `Flinks account detail failed (${response.status}).`);
  return { pending: false, payload };
}

async function pollAccountsDetail(env, requestId, authKey) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const direct = await fetchAccountsDetail(env, requestId, authKey);
    if (!direct.pending) return direct.payload;
    const { response, payload } = await flinksFetch(env, `/GetAccountsDetailAsync/${requestId}`, {
      method: "GET",
      headers: { "flinks-auth-key": authKey },
    });
    if (response.status === 200) return payload;
    if (response.status !== 202) throw new Error(payload?.Message || `Flinks async detail failed (${response.status}).`);
    await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
  }
  throw new Error("Flinks is still preparing account data. Try again in a moment.");
}

async function deleteFlinksCard(env, loginId) {
  const { response, payload } = await flinksFetch(env, `/DeleteCard/${encodeURIComponent(loginId)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(payload?.Message || `Flinks disconnect failed (${response.status}).`);
  }
}

function isPendingTransaction(transaction) {
  const code = Number(transaction?.Code);
  if (code === 1) return true;
  const description = String(transaction?.Description || "").toLowerCase();
  return /\bpending\b/.test(description);
}

function centsFromAmount(value) {
  if (value == null || !Number.isFinite(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

async function resolveClaims(request, env, body = null) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Continue with Google in Hearth before using Flinks.");
  const url = new URL(request.url);
  const environment = (body?.environment ?? url.searchParams.get("environment")) === "production" ? "production" : "development";
  assertDevelopmentOnly(environment);
  const householdId = clip(body?.householdId ?? url.searchParams.get("householdId"), 80);
  const memberId = clip(body?.memberId ?? url.searchParams.get("memberId"), 80);
  if (!householdId || !memberId) throw new Error("Household and member scope are required.");
  const user = await verifiedSupabaseUser(env, match[1]);
  const claims = {
    environment,
    householdId,
    memberId,
    authUserId: user.id,
    supabaseAccessToken: match[1],
  };
  await verifiedMembership(env, claims);
  return claims;
}

async function readConnection(env, memberKeyValue) {
  if (!env.FLINKS_DB) throw new Error("Flinks storage is not configured on the Worker.");
  const row = await env.FLINKS_DB.prepare(
    "SELECT encrypted_blob, institution, account_label, account_last4, currency FROM flinks_connections WHERE member_key = ?",
  ).bind(memberKeyValue).first();
  if (!row) return null;
  const secrets = await decryptBlob(env, row.encrypted_blob);
  if (secrets.kind !== CONNECTION_KIND) throw new Error("Stored Flinks connection is invalid.");
  return {
    secrets,
    institution: row.institution,
    accountLabel: row.account_label,
    accountLast4: row.account_last4,
    currency: row.currency || "CAD",
  };
}

async function writeConnection(env, memberKeyValue, secrets, meta) {
  const encryptedBlob = await encryptBlob(env, { kind: CONNECTION_KIND, ...secrets });
  const now = Date.now();
  await env.FLINKS_DB.prepare(`
    INSERT INTO flinks_connections (member_key, encrypted_blob, institution, account_label, account_last4, currency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_key) DO UPDATE SET
      encrypted_blob = excluded.encrypted_blob,
      institution = excluded.institution,
      account_label = excluded.account_label,
      account_last4 = excluded.account_last4,
      currency = excluded.currency,
      updated_at = excluded.updated_at
  `).bind(
    memberKeyValue,
    encryptedBlob,
    meta.institution || null,
    meta.accountLabel || null,
    meta.accountLast4 || null,
    meta.currency || "CAD",
    now,
    now,
  ).run();
}

async function deleteConnection(env, memberKeyValue) {
  await env.FLINKS_DB.prepare("DELETE FROM flinks_connections WHERE member_key = ?").bind(memberKeyValue).run();
}

async function createConnectSession(env, claims) {
  const sessionId = randomId();
  const stateNonce = randomId();
  const iframeOrigin = flinksIframeOrigin(env);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await env.FLINKS_DB.prepare(`
    INSERT INTO flinks_connect_sessions (session_id, member_key, state_nonce, iframe_origin, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(sessionId, memberKey(claims), stateNonce, iframeOrigin, expiresAt).run();
  const authorizeToken = await generateAuthorizeKey(env);
  const redirectPath = String(env.FLINKS_CONNECT_REDIRECT_PATH || "/import/flinks/callback").trim() || "/import/flinks/callback";
  const redirectUrl = `${new URL(claims.origin || "https://localhost").origin}${redirectPath}`;
  const demo = String(env.FLINKS_DEMO || "true").trim().toLowerCase() !== "false";
  const params = new URLSearchParams({
    authorizeToken,
    redirectUrl,
    ...(demo ? { demo: "true" } : {}),
  });
  return {
    sessionId,
    stateNonce,
    iframeOrigin,
    iframeUrl: `${iframeOrigin}/?${params.toString()}`,
    redirectUrl,
    expiresAt,
  };
}

async function loadConnectSession(env, sessionId, memberKeyValue) {
  const row = await env.FLINKS_DB.prepare(
    "SELECT member_key, state_nonce, iframe_origin, expires_at FROM flinks_connect_sessions WHERE session_id = ?",
  ).bind(sessionId).first();
  if (!row) throw new Error("Flinks Connect session expired. Start again.");
  if (row.member_key !== memberKeyValue) throw new Error("Flinks Connect session does not belong to this member.");
  if (Number(row.expires_at) <= Math.floor(Date.now() / 1000)) throw new Error("Flinks Connect session expired. Start again.");
  return row;
}

async function clearConnectSession(env, sessionId) {
  await env.FLINKS_DB.prepare("DELETE FROM flinks_connect_sessions WHERE session_id = ?").bind(sessionId).run();
}

async function redactInboxPayload(env, memberKeyValue, payload) {
  const institution = clip(payload?.Institution ?? "Flinks", 160);
  const sourceHash = await digestFlinksId(env, "batch", `${memberKeyValue}|${institution}|${Date.now()}`);
  const accounts = Array.isArray(payload?.Accounts) ? payload.Accounts : [];
  const selectedAccountId = payload.__selectedAccountId || null;
  const filteredAccounts = selectedAccountId
    ? accounts.filter((account) => String(account?.Id || "") === selectedAccountId)
    : accounts.filter((account) => String(account?.Currency || "CAD").toUpperCase() === "CAD").slice(0, 1);
  if (!filteredAccounts.length) throw new Error("Flinks returned no selected CAD account.");
  const redactedAccounts = [];
  const redactedTransactions = [];
  for (const account of filteredAccounts) {
    const providerAccountId = String(account?.Id || "");
    const accountRef = await digestFlinksId(env, "account", `${memberKeyValue}|${providerAccountId}`);
    const last4 = clip(account?.LastFourDigits || account?.AccountNumber || "", 4).replace(/\D/g, "").slice(-4);
    redactedAccounts.push({
      accountRef,
      accountLast4: last4,
      title: clip(account?.Title ?? "Linked account", 120),
      type: clip(account?.Type ?? "", 80),
      category: clip(account?.Category ?? "", 80),
      currency: clip(account?.Currency ?? "CAD", 8).toUpperCase() || "CAD",
      balanceCents: centsFromAmount(account?.Balance?.Current ?? account?.Balance?.Available),
    });
    const transactions = Array.isArray(account?.Transactions) ? account.Transactions : [];
    for (const [index, transaction] of transactions.entries()) {
      if (isPendingTransaction(transaction)) continue;
      const providerTxId = String(transaction?.Id || `${providerAccountId}:${index}`);
      redactedTransactions.push({
        accountRef,
        provenanceId: await digestFlinksId(env, "tx", `${memberKeyValue}|${providerAccountId}|${providerTxId}|${index}`),
        date: clip(transaction?.Date ?? "", 32),
        description: clip(transaction?.Description ?? "", 240),
        debitCents: centsFromAmount(transaction?.Debit),
        creditCents: centsFromAmount(transaction?.Credit),
      });
    }
  }
  if (!redactedTransactions.length) throw new Error("Flinks returned no posted transactions for the selected account.");
  return {
    institution,
    sourceHash,
    accounts: redactedAccounts,
    transactions: redactedTransactions,
  };
}

async function handleStatus(request, env, cors) {
  const claims = await resolveClaims(request, env);
  claims.origin = request.headers.get("Origin") || "";
  const connection = await readConnection(env, memberKey(claims));
  return json({
    ok: true,
    configured: flinksConfigured(env),
    connected: Boolean(connection),
    institution: connection?.institution ?? null,
    accountLabel: connection?.accountLabel ?? null,
    accountLast4: connection?.accountLast4 ?? null,
    currency: connection?.currency ?? "CAD",
  }, 200, cors);
}

async function handleConnectStart(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const claims = await resolveClaims(request, env, body);
  claims.origin = request.headers.get("Origin") || new URL(request.url).origin;
  if (!flinksConfigured(env)) return json({ ok: false, error: "Flinks is not configured on the Worker." }, 503, cors);
  const session = await createConnectSession(env, claims);
  return json({ ok: true, ...session }, 200, cors);
}

async function handleConnectComplete(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "Invalid JSON body." }, 400, cors);
  const claims = await resolveClaims(request, env, body);
  const sessionId = clip(body.sessionId, 120);
  const stateNonce = clip(body.stateNonce, 120);
  const loginId = clip(body.loginId ?? body.LoginId, 120);
  const selectedAccountId = clip(body.accountId ?? body.selectedAccountId, 120);
  if (!sessionId || !stateNonce || !loginId) {
    return json({ ok: false, error: "Flinks Connect did not finish." }, 400, cors);
  }
  const session = await loadConnectSession(env, sessionId, memberKey(claims));
  if (session.state_nonce !== stateNonce) return json({ ok: false, error: "Flinks Connect state mismatch." }, 400, cors);
  const iframeOrigin = clip(body.iframeOrigin, 120);
  if (!iframeOrigin || iframeOrigin !== session.iframe_origin) {
    return json({ ok: false, error: "Flinks Connect origin mismatch." }, 400, cors);
  }
  await writeConnection(env, memberKey(claims), {
    loginId,
    selectedAccountId: selectedAccountId || null,
  }, {
    institution: clip(body.institution, 160),
    accountLabel: clip(body.accountLabel ?? body.accountTitle, 120),
    accountLast4: clip(body.accountLast4, 4).replace(/\D/g, "").slice(-4),
    currency: "CAD",
  });
  await clearConnectSession(env, sessionId);
  return json({
    ok: true,
    connected: true,
    institution: clip(body.institution, 160) || null,
    accountLabel: clip(body.accountLabel ?? body.accountTitle, 120) || null,
    accountLast4: clip(body.accountLast4, 4).replace(/\D/g, "").slice(-4) || null,
  }, 200, cors);
}

async function handleImport(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const claims = await resolveClaims(request, env, body);
  const connection = await readConnection(env, memberKey(claims));
  if (!connection?.secrets?.loginId) return json({ ok: false, error: "Connect Flinks before importing." }, 400, cors);
  const authKey = await generateAuthorizeKey(env);
  const requestId = await authorizeLogin(env, connection.secrets.loginId, authKey);
  const payload = await pollAccountsDetail(env, requestId, authKey);
  payload.__selectedAccountId = connection.secrets.selectedAccountId || null;
  const inbox = await redactInboxPayload(env, memberKey(claims), payload);
  return json({ ok: true, inbox }, 200, cors);
}

async function handleDisconnect(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const claims = await resolveClaims(request, env, body);
  const key = memberKey(claims);
  const connection = await readConnection(env, key);
  if (connection?.secrets?.loginId) {
    try {
      await deleteFlinksCard(env, connection.secrets.loginId);
    } catch {
      /* best effort revoke */
    }
  }
  await deleteConnection(env, key);
  return json({ ok: true, connected: false }, 200, cors);
}

function retiredSyncResponse(cors) {
  return json({
    ok: false,
    error: "The legacy /flinks/sync route is retired. Use /bank/flinks through Flinks Connect.",
  }, 410, cors);
}

export async function handleFlinks(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/flinks/sync") {
    const { allowed, origin } = resolveChatOrigin(request);
    const cors = flinksCors(origin);
    if (!allowed) return json({ ok: false, error: "origin" }, 403, cors);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    return retiredSyncResponse(cors);
  }
  if (!url.pathname.startsWith("/bank/flinks")) return null;

  const { allowed, origin } = resolveChatOrigin(request);
  const cors = flinksCors(origin);
  if (!allowed) return json({ ok: false, error: "origin" }, 403, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    if (url.pathname === "/bank/flinks/status" && request.method === "GET") return await handleStatus(request, env, cors);
    if (url.pathname === "/bank/flinks/connect/start" && request.method === "POST") return await handleConnectStart(request, env, cors);
    if (url.pathname === "/bank/flinks/connect/complete" && request.method === "POST") return await handleConnectComplete(request, env, cors);
    if (url.pathname === "/bank/flinks/import" && request.method === "POST") return await handleImport(request, env, cors);
    if (url.pathname === "/bank/flinks/disconnect" && request.method === "POST") return await handleDisconnect(request, env, cors);
    return json({ ok: false, error: "method" }, 405, cors, { Allow: "GET, POST, OPTIONS" });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const status = /Continue with Google|member|scope|Development-only/.test(message) ? 401 : 503;
    return json({ ok: false, error: message }, status, cors);
  }
}
