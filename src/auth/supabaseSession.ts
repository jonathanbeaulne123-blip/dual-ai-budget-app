import type { Environment } from "../core/types.ts";
import { bundledSupabaseConfig, type SupabaseConfig } from "../ledger/supabase.ts";

/** Supabase Auth session used only for Hearth's books REST/RPC boundary. */
export type HearthSupabaseSession = {
  accessToken: string;
  refreshToken: string;
  providerToken?: string;
  userId: string;
  /** Supabase JWT session_id; migration 017 uses it for device revocation. */
  sessionId: string;
  email: string;
  googleSubject: string;
  displayName: string;
  expiresAt: number;
};

export type HearthAuthConfig = {
  supabaseUrl: string;
  /** Publishable / anon key — never service_role. */
  publishableKey: string;
};

export function supabaseSessionMatchesGoogleIdentity(
  session: HearthSupabaseSession,
  identity: { subject: string; email: string },
): boolean {
  const expectedSubject = identity.subject.trim();
  const actualSubject = session.googleSubject.trim();
  if (expectedSubject && actualSubject) return expectedSubject === actualSubject;
  return Boolean(identity.email.trim())
    && session.email.trim().toLowerCase() === identity.email.trim().toLowerCase();
}

type TokenStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const SESSION_PREFIX = "hearth:v1:supabase-auth:";
export const SUPABASE_SESSION_CHANGED_EVENT = "hearth:supabase-session-changed";
const REQUIRED_GOOGLE_ACCOUNT_SCOPES = "https://www.googleapis.com/auth/drive.file";
let storeOverride: TokenStore | null = null;
const refreshFlights = new Map<Environment, Promise<HearthSupabaseSession>>();
const sessionGenerations = new Map<Environment, number>();
let authRedirectEnvironment: Environment | null = null;
let authRedirectStartedAt = 0;
let authRedirectResetTimer: ReturnType<typeof setTimeout> | null = null;
const AUTH_REDIRECT_LATCH_MS = 15_000;

function resetAuthRedirectLatch(): void {
  authRedirectEnvironment = null;
  authRedirectStartedAt = 0;
  if (authRedirectResetTimer) clearTimeout(authRedirectResetTimer);
  authRedirectResetTimer = null;
}

function browserStore(): TokenStore | null {
  if (storeOverride) return storeOverride;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function setSupabaseSessionStore(store: TokenStore | null): void {
  storeOverride = store;
}

export function resetSupabaseAuthConcurrencyForTests(): void {
  refreshFlights.clear();
  sessionGenerations.clear();
  resetAuthRedirectLatch();
}

export function supabaseSessionKey(environment: Environment): string {
  return `${SESSION_PREFIX}${environment}`;
}

export function assertPublishableKey(key: string): void {
  if (/service_role|secret/i.test(key)) {
    throw new Error("Service-role or secret keys must never ship in the kitchen client.");
  }
}

export function supabaseAuthEnabled(): boolean {
  return String(import.meta.env.VITE_SUPABASE_AUTH_ENABLED || "") === "1";
}

export function readHearthAuthConfig(): HearthAuthConfig | null {
  if (!supabaseAuthEnabled()) return null;
  // Prefer explicit VITE_ values; fall back to the same bundled Development project
  // defaults the kitchen already ships for hosted books REST.
  const bundled = bundledSupabaseConfig();
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || bundled.url).replace(/\/$/, "");
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || bundled.key);
  if (!supabaseUrl || !publishableKey) return null;
  assertPublishableKey(publishableKey);
  return { supabaseUrl, publishableKey };
}

function isSession(value: unknown): value is HearthSupabaseSession {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<HearthSupabaseSession>;
  return Boolean(
    row.accessToken && row.refreshToken && row.userId && row.sessionId && row.email
    && Number.isFinite(row.expiresAt),
  );
}

export function loadSupabaseSession(environment: Environment): HearthSupabaseSession | null {
  const raw = browserStore()?.getItem(supabaseSessionKey(environment));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function notifySupabaseSessionChanged(environment: Environment): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent(SUPABASE_SESSION_CHANGED_EVENT, {
    detail: { environment },
  }));
}

export function saveSupabaseSession(environment: Environment, session: HearthSupabaseSession): void {
  browserStore()?.setItem(supabaseSessionKey(environment), JSON.stringify(session));
  notifySupabaseSessionChanged(environment);
}

export function clearSupabaseSession(environment: Environment): void {
  sessionGenerations.set(environment, (sessionGenerations.get(environment) ?? 0) + 1);
  browserStore()?.removeItem(supabaseSessionKey(environment));
  notifySupabaseSessionChanged(environment);
}

function sessionGeneration(environment: Environment): number {
  return sessionGenerations.get(environment) ?? 0;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof atob !== "function") throw new Error("This browser cannot decode the Auth session.");
  return decodeURIComponent([...atob(padded)]
    .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
    .join(""));
}

type JwtPayload = {
  sub?: string;
  session_id?: string;
  email?: string;
  exp?: number;
  user_metadata?: Record<string, unknown>;
};

export function decodeSupabaseJwt(accessToken: string): JwtPayload {
  const payload = accessToken.split(".")[1];
  if (!payload) throw new Error("Supabase returned an invalid access token.");
  const parsed: unknown = JSON.parse(decodeBase64Url(payload));
  if (!parsed || typeof parsed !== "object") throw new Error("Supabase returned an invalid session payload.");
  return parsed as JwtPayload;
}

function sessionFromTokenPayload(input: {
  accessToken: string;
  refreshToken: string;
  providerToken?: string;
  expiresIn?: number;
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
}): HearthSupabaseSession {
  const jwt = decodeSupabaseJwt(input.accessToken);
  const metadata = input.user?.user_metadata ?? jwt.user_metadata ?? {};
  const userId = input.user?.id || jwt.sub || "";
  const sessionId = String(jwt.session_id || "");
  const email = String(input.user?.email || jwt.email || metadata.email || "").trim().toLowerCase();
  if (!userId || !sessionId || !email) {
    throw new Error("Supabase did not return a usable Google session identity.");
  }
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    providerToken: input.providerToken,
    userId,
    sessionId,
    email,
    googleSubject: String(metadata.provider_id || metadata.sub || ""),
    displayName: String(metadata.full_name || metadata.name || "").trim(),
    expiresAt: jwt.exp ? jwt.exp * 1000 : Date.now() + (input.expiresIn ?? 3600) * 1000,
  };
}

export function buildSupabaseGoogleAuthorizeUrl(
  config: HearthAuthConfig,
  environment: Environment,
  returnUrl: string,
  options: { selectAccount?: boolean } = {},
): string {
  assertPublishableKey(config.publishableKey);
  const redirect = new URL(returnUrl);
  redirect.searchParams.set("hearthAuthEnv", environment);
  const url = new URL("/auth/v1/authorize", config.supabaseUrl);
  url.searchParams.set("provider", "google");
  url.searchParams.set("scopes", REQUIRED_GOOGLE_ACCOUNT_SCOPES);
  url.searchParams.set("redirect_to", redirect.toString());
  if (options.selectAccount) url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function startSupabaseGoogleSignIn(
  environment: Environment,
  returnUrl = typeof window === "undefined" ? "" : window.location.href,
  config = readHearthAuthConfig(),
  navigate: (url: string) => void = (url) => window.location.assign(url),
  options: { selectAccount?: boolean } = {},
): boolean {
  if (!config) throw new Error("Supabase Google sign-in is not enabled in this build.");
  if (!returnUrl) throw new Error("Google sign-in needs a browser return address.");
  if (authRedirectEnvironment && Date.now() - authRedirectStartedAt < AUTH_REDIRECT_LATCH_MS) return false;
  authRedirectEnvironment = environment;
  authRedirectStartedAt = Date.now();
  if (authRedirectResetTimer) clearTimeout(authRedirectResetTimer);
  authRedirectResetTimer = setTimeout(() => {
    authRedirectEnvironment = null;
    authRedirectStartedAt = 0;
    authRedirectResetTimer = null;
  }, AUTH_REDIRECT_LATCH_MS);
  try {
    navigate(buildSupabaseGoogleAuthorizeUrl(config, environment, returnUrl, options));
    if (typeof window !== "undefined") {
      window.addEventListener("pageshow", resetAuthRedirectLatch, { once: true });
    }
    return true;
  } catch (caught) {
    resetAuthRedirectLatch();
    throw caught;
  }
}

/** Start the same Google flow after Supabase positively rejects a refresh credential. */
export function startSupabaseGoogleReauthentication(
  environment: Environment,
  returnUrl: string,
  config = readHearthAuthConfig(),
  navigate?: (url: string) => void,
): boolean {
  return navigate
    ? startSupabaseGoogleSignIn(environment, returnUrl, config, navigate)
    : startSupabaseGoogleSignIn(environment, returnUrl, config);
}

/** Consume the standard Supabase OAuth hash and remove tokens from the URL. */
export function consumeSupabaseAuthRedirect(url = window.location.href): HearthSupabaseSession | null {
  const parsedUrl = new URL(url);
  const params = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  const environment = parsedUrl.searchParams.get("hearthAuthEnv") === "production"
    ? "production"
    : "development";
  const session = sessionFromTokenPayload({
    accessToken,
    refreshToken,
    providerToken: params.get("provider_token") || undefined,
    expiresIn: Number(params.get("expires_in") || 3600),
  });
  saveSupabaseSession(environment, session);
  parsedUrl.hash = "";
  parsedUrl.searchParams.delete("hearthAuthEnv");
  if (typeof window !== "undefined") {
    window.history.replaceState({}, "", `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`);
  }
  return session;
}

export function supabaseSessionFresh(session: HearthSupabaseSession, now = Date.now()): boolean {
  return session.expiresAt - 60_000 > now;
}

function replacementSupabaseSession(
  environment: Environment,
  attempted: HearthSupabaseSession,
): HearthSupabaseSession | null {
  const latest = loadSupabaseSession(environment);
  if (!latest) return null;
  return latest.refreshToken !== attempted.refreshToken || latest.accessToken !== attempted.accessToken
    ? latest
    : null;
}

export async function refreshSupabaseSession(
  environment: Environment,
  session: HearthSupabaseSession,
  config = readHearthAuthConfig(),
  fetcher: typeof fetch = fetch,
): Promise<HearthSupabaseSession> {
  if (!config) throw new Error("Supabase Google sign-in is not enabled in this build.");
  const refreshGeneration = sessionGeneration(environment);
  try {
    const response = await fetcher(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!response.ok) {
      const replacement = replacementSupabaseSession(environment, session);
      if (replacement) return replacement;
      if (sessionGeneration(environment) !== refreshGeneration || !loadSupabaseSession(environment)) {
        throw new Error("Your Hearth cloud session changed while it was refreshing.");
      }
      if (response.status === 400 || response.status === 401) {
        clearSupabaseSession(environment);
        throw new Error("Your Hearth cloud session needs Google confirmation again.");
      }
      throw new Error("Hearth could not refresh the cloud session. The saved session is still on this phone; try again when connected.");
    }
    const body = await response.json() as {
      access_token: string;
      refresh_token: string;
      provider_token?: string;
      expires_in?: number;
      user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
    };
    const refreshed = sessionFromTokenPayload({
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      providerToken: body.provider_token || session.providerToken,
      expiresIn: body.expires_in,
      user: body.user,
    });
    const latest = loadSupabaseSession(environment);
    if (!latest || sessionGeneration(environment) !== refreshGeneration) {
      throw new Error("Your Hearth cloud session changed while it was refreshing.");
    }
    const replacement = replacementSupabaseSession(environment, session);
    if (replacement) return replacement;
    saveSupabaseSession(environment, refreshed);
    return refreshed;
  } catch (caught) {
    const replacement = replacementSupabaseSession(environment, session);
    if (replacement) return replacement;
    throw caught;
  }
}

export async function ensureSupabaseSession(
  environment: Environment,
  config = readHearthAuthConfig(),
  fetcher: typeof fetch = fetch,
): Promise<HearthSupabaseSession | null> {
  const current = loadSupabaseSession(environment);
  if (!current) return null;
  if (supabaseSessionFresh(current)) return current;
  const active = refreshFlights.get(environment);
  if (active) return active;
  const flight = refreshSupabaseSession(environment, current, config, fetcher);
  refreshFlights.set(environment, flight);
  try {
    return await flight;
  } finally {
    if (refreshFlights.get(environment) === flight) refreshFlights.delete(environment);
  }
}

export function authenticatedSupabaseConfig(
  base: SupabaseConfig | null,
  session: HearthSupabaseSession | null,
): SupabaseConfig | null {
  if (!base || !session) return base;
  return { ...base, accessToken: session.accessToken, authUserId: session.userId };
}

export function bearerHeaders(session: HearthSupabaseSession, publishableKey: string): HeadersInit {
  assertPublishableKey(publishableKey);
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };
}

export function joinUrlFromInviteToken(
  kitchenOrigin: string,
  inviteToken: string,
  environment: Environment,
): string {
  const url = new URL("/join", kitchenOrigin);
  url.searchParams.set("invite", inviteToken);
  url.searchParams.set("env", environment);
  return url.toString();
}
