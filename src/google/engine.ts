import { assertServicesAllowed, GOOGLE_SERVICE_COPY, uniqueGoogleServices } from "../core/google.ts";
import type { GoogleService } from "../core/types.ts";
import type { Environment } from "../core/types.ts";
import { parseGrantedScopes, scopeString, scopesForServices } from "./scopes.ts";
import {
  clearGoogleSession,
  loadGoogleSession,
  saveGoogleSession,
  tokenFresh,
  type GoogleSession,
} from "./tokens.ts";

export type { GoogleSession } from "./tokens.ts";
export {
  adoptGoogleSession,
  clearGoogleSession,
  createMemoryTokenStore,
  googleTokenKey,
  legacyGcalKey,
  loadGoogleSession,
  saveGoogleSession,
  setGoogleTokenStore,
  tokenFresh,
} from "./tokens.ts";

type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

type GoogleIdentityApi = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        hint?: string;
        include_granted_scopes?: boolean;
        callback: (response: { access_token?: string; expires_in?: number; error?: string; scope?: string }) => void;
        error_callback?: (error: { message?: string; type?: string }) => void;
      }) => TokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

export type GoogleAccessResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  scope?: string;
};

export type GoogleTokenRequester = (input: {
  clientId: string;
  scope: string;
  hint?: string;
  prompt: "" | "consent" | "select_account";
}) => Promise<GoogleAccessResponse>;

export type GoogleCallContext = {
  environment: Environment;
  memberId: string;
  session: GoogleSession;
  fetch: typeof googleApiFetch;
};

export type GoogleSuitePing = {
  service: GoogleService;
  ok: boolean;
  detail: string;
};

type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

let clientIdOverride: string | undefined;
let tokenRequester: GoogleTokenRequester | null = null;
let httpFetch: HttpFetch = (input, init) => fetch(input, init);

export function setGoogleClientIdForTests(id: string | undefined): void {
  clientIdOverride = id;
}

export function setGoogleTokenRequester(requester: GoogleTokenRequester | null): void {
  tokenRequester = requester;
}

export function setGoogleHttpFetch(fn: HttpFetch | null): void {
  httpFetch = fn ?? ((input, init) => fetch(input, init));
}

export function googleClientId(): string {
  if (clientIdOverride !== undefined) return clientIdOverride.trim();
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
}

export function googleConfigured(): boolean {
  return googleClientId().length > 0;
}

export function resetGoogleEngineForTests(): void {
  clientIdOverride = undefined;
  tokenRequester = null;
  httpFetch = (input, init) => fetch(input, init);
}

function friendlyGoogleError(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Use the raw body when Google did not return JSON.
  }
  const trimmed = body.trim();
  if (trimmed) return trimmed.slice(0, 280);
  return `Google returned ${status}.`;
}

export async function googleApiFetch<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await httpFetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(friendlyGoogleError(body, response.status));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function loadGis(): Promise<GoogleIdentityApi> {
  if (typeof window === "undefined") throw new Error("Google Identity is not available in this environment.");
  if (window.google?.accounts?.oauth2) return window.google;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-hearth-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Identity failed to load.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.hearthGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity failed to load."));
    document.head.appendChild(script);
  });
  if (!window.google?.accounts?.oauth2) throw new Error("Google Identity is not available in this browser.");
  return window.google;
}

const defaultRequester: GoogleTokenRequester = async (input) => {
  const gis = await loadGis();
  return new Promise((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: input.clientId,
      scope: input.scope,
      hint: input.hint,
      include_granted_scopes: true,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error || "Google did not return an access token."));
          return;
        }
        resolve(response);
      },
      error_callback: (error) => reject(new Error(error.message || "Google sign-in was cancelled.")),
    });
    client.requestAccessToken({ prompt: input.prompt });
  });
};

export async function requestGoogleAccess(input: {
  services: GoogleService[];
  loginHint?: string;
  stepUp?: boolean;
  selectAccount?: boolean;
}): Promise<{ accessToken: string; expiresAt: number; grantedScopes: string[] }> {
  const clientId = googleClientId();
  if (!clientId) {
    throw new Error("This build has no Google client ID. Add VITE_GOOGLE_CLIENT_ID, or use the .ics file for calendar.");
  }
  const requested = uniqueGoogleServices(input.services);
  const scope = scopeString(requested);
  const prompt: "" | "consent" | "select_account" = input.stepUp
    ? "consent"
    : input.selectAccount
      ? "select_account"
      : input.loginHint
        ? ""
        : "select_account";
  const requester = tokenRequester ?? defaultRequester;
  const response = await requester({
    clientId,
    scope,
    hint: input.loginHint,
    prompt,
  });
  if (!response.access_token) {
    throw new Error(response.error || "Google did not return an access token.");
  }
  return {
    accessToken: response.access_token,
    expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
    grantedScopes: parseGrantedScopes(response.scope, scopesForServices(requested)),
  };
}

async function hydrateSession(access: {
  memberId: string;
  accessToken: string;
  expiresAt: number;
  grantedScopes: string[];
  previous?: GoogleSession | null;
  services: GoogleService[];
}): Promise<GoogleSession> {
  const services = uniqueGoogleServices(access.services);
  let identity = access.previous?.identity ?? { email: "", subject: "", displayName: "" };
  if (services.includes("identity") || !identity.email || !identity.subject) {
    const profile = await googleApiFetch<{ sub?: string; email?: string; name?: string; picture?: string }>(
      access.accessToken,
      "https://www.googleapis.com/oauth2/v3/userinfo",
    );
    if (!profile.email) throw new Error("Google did not share an email. Allow email on the Google screen.");
    identity = {
      email: profile.email,
      subject: profile.sub || identity.subject,
      displayName: (profile.name || identity.displayName || "").trim(),
      picture: profile.picture || identity.picture,
    };
  }
  let calendarId = access.previous?.calendarId;
  if (services.includes("calendar")) {
    const list = await googleApiFetch<{ items?: { id: string; primary?: boolean }[] }>(
      access.accessToken,
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    );
    const primary = list.items?.find((item) => item.primary) ?? list.items?.[0];
    if (!primary) throw new Error("That Google account has no calendars.");
    calendarId = primary.id;
  }
  return {
    memberId: access.memberId,
    accessToken: access.accessToken,
    expiresAt: access.expiresAt,
    grantedScopes: [...new Set([...(access.previous?.grantedScopes ?? []), ...access.grantedScopes])],
    identity,
    calendarId,
  };
}

function needsNewToken(session: GoogleSession | null, services: GoogleService[], stepUp?: boolean): boolean {
  if (stepUp || !session || !tokenFresh(session)) return true;
  const needed = scopesForServices(services);
  return needed.some((scope) => !session.grantedScopes.includes(scope));
}

export async function connectGoogle(input: {
  environment: Environment;
  memberId: string;
  services: GoogleService[];
  enabledServices?: Iterable<string>;
  loginHint?: string;
  stepUp?: boolean;
  selectAccount?: boolean;
}): Promise<GoogleSession> {
  const services = input.enabledServices
    ? assertServicesAllowed(input.enabledServices, input.services)
    : uniqueGoogleServices(input.services);
  const previous = loadGoogleSession(input.environment, input.memberId);
  const access = await requestGoogleAccess({
    services,
    loginHint: input.loginHint || previous?.identity.email,
    stepUp: input.stepUp,
    selectAccount: input.selectAccount,
  });
  const session = await hydrateSession({
    memberId: input.memberId,
    accessToken: access.accessToken,
    expiresAt: access.expiresAt,
    grantedScopes: access.grantedScopes,
    previous,
    services,
  });
  saveGoogleSession(input.environment, session);
  return session;
}

export function disconnectGoogle(environment: Environment, memberId: string): void {
  clearGoogleSession(environment, memberId);
}

export async function withGoogle<T>(input: {
  environment: Environment;
  memberId: string;
  services: GoogleService[];
  enabledServices?: Iterable<string>;
  loginHint?: string;
  stepUp?: boolean;
  fn: (ctx: GoogleCallContext) => Promise<T>;
}): Promise<T> {
  const services = input.enabledServices
    ? assertServicesAllowed(input.enabledServices, input.services)
    : uniqueGoogleServices(input.services);
  let session = loadGoogleSession(input.environment, input.memberId);
  if (needsNewToken(session, services, input.stepUp)) {
    session = await connectGoogle({
      environment: input.environment,
      memberId: input.memberId,
      services,
      loginHint: input.loginHint || session?.identity.email,
      stepUp: input.stepUp,
    });
  } else if (session && services.includes("identity") && (!session.identity.email || !session.identity.subject)) {
    session = await hydrateSession({
      memberId: input.memberId,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      grantedScopes: session.grantedScopes,
      previous: session,
      services,
    });
    saveGoogleSession(input.environment, session);
  }
  if (!session) throw new Error("Google sign-in did not finish.");
  return input.fn({
    environment: input.environment,
    memberId: input.memberId,
    session,
    fetch: googleApiFetch,
  });
}

async function pingService(service: GoogleService, token: string): Promise<string> {
  if (service === "identity") {
    const profile = await googleApiFetch<{ email?: string; name?: string }>(
      token,
      "https://www.googleapis.com/oauth2/v3/userinfo",
    );
    return `Signed in as ${profile.email || profile.name || "Google"}`;
  }
  if (service === "calendar") {
    const list = await googleApiFetch<{ items?: unknown[] }>(
      token,
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    );
    const count = list.items?.length ?? 0;
    return count === 1 ? "1 calendar visible" : `${count} calendars visible`;
  }
  if (service === "drive") {
    const about = await googleApiFetch<{ user?: { emailAddress?: string; displayName?: string } }>(
      token,
      "https://www.googleapis.com/drive/v3/about?fields=user",
    );
    return `Drive as ${about.user?.displayName || about.user?.emailAddress || "this account"} (Hearth files only)`;
  }
  if (service === "contacts") {
    const me = await googleApiFetch<{ names?: { displayName?: string }[] }>(
      token,
      "https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses",
    );
    return `Contacts as ${me.names?.[0]?.displayName || "this account"}`;
  }
  if (service === "gmail") {
    const profile = await googleApiFetch<{ emailAddress?: string; messagesTotal?: number }>(
      token,
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    );
    return `Gmail ${profile.emailAddress || ""}`.trim();
  }
  const response = await httpFetch("https://sheets.googleapis.com/v4/spreadsheets/invalid", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Google Sheets did not accept this sign-in.");
  }
  return "Sheets is ready. Hearth will open a workbook only when a feature needs it.";
}

export async function syncGoogleSuite(input: {
  environment: Environment;
  memberId: string;
  enabledServices: Iterable<string>;
}): Promise<GoogleSuitePing[]> {
  const enabled = uniqueGoogleServices(input.enabledServices);
  return withGoogle({
    environment: input.environment,
    memberId: input.memberId,
    services: enabled,
    enabledServices: enabled,
    fn: async (ctx) => {
      const pings: GoogleSuitePing[] = [];
      for (const service of enabled) {
        try {
          const detail = await pingService(service, ctx.session.accessToken);
          pings.push({ service, ok: true, detail });
        } catch (caught) {
          pings.push({
            service,
            ok: false,
            detail: caught instanceof Error ? caught.message : String(caught),
          });
        }
      }
      return pings;
    },
  });
}

export function describeGooglePing(ping: GoogleSuitePing): string {
  const label = GOOGLE_SERVICE_COPY[ping.service].label;
  return ping.ok ? `${label}: ${ping.detail}` : `${label} failed — ${ping.detail}`;
}
