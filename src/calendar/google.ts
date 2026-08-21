import { TIMEZONE, type DateKey } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { googleRrule, HEARTH_REMINDER_HOUR } from "../core/recurrence.ts";
import type { Environment, Recurrence } from "../core/types.ts";
import type { OverlayEvent } from "../core/board.ts";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");

export const HEARTH_BILLS_CALENDAR_NAME = "Hearth · bills";

export type GoogleAccount = {
  memberId: string;
  email: string;
  calendarId: string;
  accessToken: string;
  expiresAt: number;
};

type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        hint?: string;
        callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
        error_callback?: (error: { message?: string; type?: string }) => void;
      }) => TokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export function googleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
}

export function googleConfigured(): boolean {
  return googleClientId().length > 0;
}

function storageKey(environment: Environment, memberId: string): string {
  return `hearth:v1:${environment}:gcal:${memberId}`;
}

export function loadGoogleAccount(environment: Environment, memberId: string): GoogleAccount | null {
  try {
    const raw = localStorage.getItem(storageKey(environment, memberId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleAccount;
    if (!parsed.accessToken || !parsed.memberId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGoogleAccount(environment: Environment, account: GoogleAccount): void {
  localStorage.setItem(storageKey(environment, account.memberId), JSON.stringify(account));
}

export function clearGoogleAccount(environment: Environment, memberId: string): void {
  localStorage.removeItem(storageKey(environment, memberId));
}

export function loadGoogleAccounts(environment: Environment, memberIds: string[]): GoogleAccount[] {
  return memberIds.map((id) => loadGoogleAccount(environment, id)).filter((item): item is GoogleAccount => Boolean(item));
}

export function tokenFresh(account: GoogleAccount, now = Date.now()): boolean {
  return Boolean(account.accessToken) && account.expiresAt - 60_000 > now;
}

export function dateFromGoogleEvent(event: {
  start?: { date?: string; dateTime?: string };
}): DateKey | null {
  const value = event.start?.date || event.start?.dateTime?.slice(0, 10);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function overlayFromGoogleEvent(
  event: { id?: string; summary?: string; start?: { date?: string; dateTime?: string }; extendedProperties?: { private?: Record<string, string> } },
  memberId: string,
  memberColor: string,
): OverlayEvent | null {
  const date = dateFromGoogleEvent(event);
  if (!date || !event.id) return null;
  return {
    id: event.id,
    date,
    title: event.summary?.trim() || "Google event",
    memberId,
    memberColor,
    hearthOwned: event.extendedProperties?.private?.hearth === "1",
  };
}

export function hearthGoogleEvent(item: Recurrence, titleNote: string): Record<string, unknown> {
  const startHour = String(HEARTH_REMINDER_HOUR).padStart(2, "0");
  const minutes = Math.max(0, Math.round((item.reminderHoursBefore || 24) * 60));
  return {
    summary: `Hearth · ${titleNote} · ${formatCad(item.amountCents)}`,
    description: "Hearth reminder. This is not a posted ledger row. Open Hearth and mark it paid to write the books.",
    start: { dateTime: `${item.nextDate}T${startHour}:00:00`, timeZone: TIMEZONE },
    end: { dateTime: `${item.nextDate}T${startHour}:30:00`, timeZone: TIMEZONE },
    recurrence: [googleRrule(item.nextDate, item.cadence)],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes },
        { method: "popup", minutes: 0 },
      ],
    },
    extendedProperties: {
      private: { hearth: "1", recurrenceId: item.id },
    },
  };
}

async function googleFetch<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Google Calendar returned ${response.status}.`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function loadGis(): Promise<GoogleIdentity> {
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

export function connectGoogleAccount(input: {
  memberId: string;
  environment: Environment;
  loginHint?: string;
}): Promise<GoogleAccount> {
  const clientId = googleClientId();
  if (!clientId) {
    return Promise.reject(new Error("This build has no Google client ID. Download the .ics file instead."));
  }
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const gis = await loadGis();
        const client = gis.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_SCOPES,
          hint: input.loginHint,
          callback: (response) => {
            void (async () => {
              if (!response.access_token) {
                reject(new Error(response.error || "Google did not return an access token."));
                return;
              }
              try {
                const list = await googleFetch<{ items?: { id: string; primary?: boolean }[] }>(
                  response.access_token,
                  "https://www.googleapis.com/calendar/v3/users/me/calendarList",
                );
                const primary = list.items?.find((item) => item.primary) ?? list.items?.[0];
                if (!primary) throw new Error("That Google account has no calendars.");
                const account: GoogleAccount = {
                  memberId: input.memberId,
                  email: primary.id,
                  calendarId: primary.id,
                  accessToken: response.access_token,
                  expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
                };
                saveGoogleAccount(input.environment, account);
                resolve(account);
              } catch (caught) {
                reject(caught instanceof Error ? caught : new Error(String(caught)));
              }
            })();
          },
          error_callback: (error) => reject(new Error(error.message || "Google sign-in was cancelled.")),
        });
        client.requestAccessToken({ prompt: input.loginHint ? "" : "select_account" });
      } catch (caught) {
        reject(caught instanceof Error ? caught : new Error(String(caught)));
      }
    })();
  });
}

async function ensureToken(environment: Environment, account: GoogleAccount): Promise<GoogleAccount> {
  if (tokenFresh(account)) return account;
  return connectGoogleAccount({ memberId: account.memberId, environment, loginHint: account.email });
}

export async function listGoogleOverlays(input: {
  environment: Environment;
  accounts: GoogleAccount[];
  memberColor: (memberId: string) => string;
  from: DateKey;
  to: DateKey;
}): Promise<OverlayEvent[]> {
  const overlays: OverlayEvent[] = [];
  for (const raw of input.accounts) {
    const account = await ensureToken(input.environment, raw);
    const timeMin = `${input.from}T00:00:00-04:00`;
    const timeMax = `${input.to}T23:59:59-04:00`;
    const payload = await googleFetch<{ items?: Parameters<typeof overlayFromGoogleEvent>[0][] }>(
      account.accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250`,
    );
    for (const event of payload.items ?? []) {
      const overlay = overlayFromGoogleEvent(event, account.memberId, input.memberColor(account.memberId));
      if (overlay) overlays.push(overlay);
    }
  }
  return overlays;
}

export async function upsertHearthReminders(input: {
  environment: Environment;
  account: GoogleAccount;
  recurrences: Recurrence[];
  titleFor: (item: Recurrence) => string;
}): Promise<{ memberId: string; calendarId: string; eventId: string; recurrenceId: string }[]> {
  const account = await ensureToken(input.environment, input.account);
  const existing = await googleFetch<{ items?: { id: string; extendedProperties?: { private?: Record<string, string> } }[] }>(
    account.accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId)}/events?privateExtendedProperty=hearth%3D1&maxResults=250`,
  );
  const byRecurrence = new Map<string, string>();
  for (const event of existing.items ?? []) {
    const recurrenceId = event.extendedProperties?.private?.recurrenceId;
    if (recurrenceId && event.id) byRecurrence.set(recurrenceId, event.id);
  }

  const written: { memberId: string; calendarId: string; eventId: string; recurrenceId: string }[] = [];
  const live = new Set(input.recurrences.filter((item) => item.active).map((item) => item.id));

  for (const item of input.recurrences.filter((row) => row.active)) {
    const body = JSON.stringify(hearthGoogleEvent(item, input.titleFor(item)));
    const known = byRecurrence.get(item.id) || item.googleSync[account.memberId]?.eventId;
    let eventId = known;
    if (known) {
      await googleFetch(
        account.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId)}/events/${encodeURIComponent(known)}`,
        { method: "PATCH", body },
      );
    } else {
      const created = await googleFetch<{ id: string }>(
        account.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId)}/events`,
        { method: "POST", body },
      );
      eventId = created.id;
    }
    if (eventId) {
      written.push({
        memberId: account.memberId,
        calendarId: account.calendarId,
        eventId,
        recurrenceId: item.id,
      });
    }
  }

  for (const [recurrenceId, eventId] of byRecurrence) {
    if (live.has(recurrenceId)) continue;
    await googleFetch(
      account.accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
  }

  saveGoogleAccount(input.environment, account);
  return written;
}
