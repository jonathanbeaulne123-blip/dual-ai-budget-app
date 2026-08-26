import { corsHeaders, resolveChatOrigin } from "./herculesGuard.js";

const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 1500;

function json(body, status = 200, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function flinksBase(env) {
  const instance = String(env.FLINKS_INSTANCE || "toolbox").trim() || "toolbox";
  const customerId = String(env.FLINKS_CUSTOMER_ID || "").trim();
  if (!customerId) throw new Error("Flinks is not configured on the Worker.");
  return `https://${instance}-api.private.fin.ag/v3/${customerId}/BankingServices`;
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
  const { response, payload } = await flinksFetch(env, "/GenerateAuthorizeToken", { method: "POST", body: "{}" });
  if (!response.ok) {
    throw new Error(payload?.Message || `Flinks authorize token failed (${response.status}).`);
  }
  const token = payload?.Token || payload?.AuthorizeToken || payload?.token;
  if (!token) throw new Error("Flinks did not return an authorize token.");
  return String(token);
}

async function authorizeLogin(env, loginId, authKey) {
  const { response, payload } = await flinksFetch(env, "/Authorize", {
    method: "POST",
    headers: { "flinks-auth-key": authKey },
    body: JSON.stringify({
      LoginId: loginId,
      MostRecentCached: true,
      Save: true,
      Language: "en",
    }),
  });
  if (response.status === 203) {
    throw new Error("Flinks needs another sign-in step. Finish Connect, then sync again.");
  }
  if (!response.ok) {
    throw new Error(payload?.Message || `Flinks authorize failed (${response.status}).`);
  }
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
  if (!response.ok) {
    throw new Error(payload?.Message || `Flinks account detail failed (${response.status}).`);
  }
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
    if (response.status !== 202) {
      throw new Error(payload?.Message || `Flinks async detail failed (${response.status}).`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
  }
  throw new Error("Flinks is still preparing account data. Try again in a moment.");
}

export async function handleFlinksSync(request, env) {
  const { allowed, origin } = resolveChatOrigin(request);
  const cors = corsHeaders(origin);
  if (!allowed) return json({ ok: false, error: "origin" }, 403, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405, cors);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400, cors);
  }

  const loginId = String(body?.loginId ?? body?.LoginId ?? "").trim();
  const requestIdInput = String(body?.requestId ?? body?.RequestId ?? "").trim();
  if (!loginId && !requestIdInput) {
    return json({ ok: false, error: "Send a Flinks LoginId or RequestId from Connect." }, 400, cors);
  }

  try {
    const authKey = await generateAuthorizeKey(env);
    const requestId = requestIdInput || await authorizeLogin(env, loginId, authKey);
    const payload = await pollAccountsDetail(env, requestId, authKey);
    return json({
      ok: true,
      requestId,
      institution: payload?.Institution ?? null,
      accounts: payload?.Accounts ?? [],
    }, 200, cors);
  } catch (caught) {
    return json({ ok: false, error: caught instanceof Error ? caught.message : String(caught) }, 503, cors);
  }
}
