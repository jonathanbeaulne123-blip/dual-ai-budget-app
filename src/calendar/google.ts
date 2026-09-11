import { TIMEZONE, addDays, dateKeyInZone, type DateKey } from "../core/calendar.ts";
import { formatCad } from "../core/money.ts";
import { googleRrule, HEARTH_REMINDER_HOUR } from "../core/recurrence.ts";
import type { Environment, Recurrence } from "../core/types.ts";
import type { OverlayEvent } from "../core/board.ts";
import {
  CALENDAR_GOOGLE_SCOPES,
  clearGoogleSession,
  connectGoogle,
  disconnectGoogle,
  googleApiFetch,
  googleClientId,
  googleConfigured,
  loadGoogleSession,
  saveGoogleSession,
  withGoogle,
  type GoogleSession,
} from "../google/index.ts";

export const GOOGLE_SCOPES = CALENDAR_GOOGLE_SCOPES.join(" ");

export const HEARTH_BILLS_CALENDAR_NAME = "Hearth · bills";

export type GoogleAccount = {
  memberId: string;
  email: string;
  calendarId: string;
  accessToken: string;
  expiresAt: number;
};

export { googleClientId, googleConfigured };

export function accountFromSession(session: GoogleSession): GoogleAccount | null {
  const calendarId = session.calendarId || "";
  if (!session.accessToken || !calendarId) return null;
  return {
    memberId: session.memberId,
    email: session.identity.email,
    calendarId,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
  };
}

export function loadGoogleAccount(environment: Environment, memberId: string, householdId?: string): GoogleAccount | null {
  const session = loadGoogleSession(environment, memberId, householdId);
  return session ? accountFromSession(session) : null;
}

export function saveGoogleAccount(environment: Environment, account: GoogleAccount, householdId?: string): void {
  const previous = loadGoogleSession(environment, account.memberId, householdId);
  saveGoogleSession(environment, {
    memberId: account.memberId,
    householdId,
    accessToken: account.accessToken,
    expiresAt: account.expiresAt,
    grantedScopes: previous?.grantedScopes?.length ? previous.grantedScopes : [...CALENDAR_GOOGLE_SCOPES],
    identity: {
      email: account.email,
      subject: previous?.identity?.subject ?? "",
      displayName: previous?.identity?.displayName ?? "",
      picture: previous?.identity?.picture,
    },
    calendarId: account.calendarId,
  });
}

export function clearGoogleAccount(environment: Environment, memberId: string, householdId?: string): void {
  clearGoogleSession(environment, memberId, householdId);
}

export function loadGoogleAccounts(environment: Environment, memberIds: string[], householdId?: string): GoogleAccount[] {
  return memberIds.map((id) => loadGoogleAccount(environment, id, householdId)).filter((item): item is GoogleAccount => Boolean(item));
}

export function dateFromGoogleEvent(event: {
  start?: { date?: string; dateTime?: string };
}, timeZone: string = TIMEZONE): DateKey | null {
  const instant = event.start?.dateTime ? new Date(event.start.dateTime) : null;
  const value = event.start?.date || (instant && Number.isFinite(instant.getTime()) ? dateKeyInZone(instant, timeZone) : null);
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

export async function connectGoogleAccount(input: {
  memberId: string;
  environment: Environment;
  householdId?: string;
  loginHint?: string;
}): Promise<GoogleAccount> {
  const session = await connectGoogle({
    memberId: input.memberId,
    environment: input.environment,
    householdId: input.householdId,
    services: ["identity", "calendar"],
    loginHint: input.loginHint,
  });
  const account = accountFromSession(session);
  if (!account) throw new Error("Google sign-in did not return a calendar.");
  return account;
}

export function disconnectGoogleAccount(environment: Environment, memberId: string, householdId?: string): void {
  disconnectGoogle(environment, memberId, householdId);
}

export type GoogleCalendarRead = { overlays: OverlayEvent[]; calendars: string[]; errors: string[] };
type CalendarListEntry = { id: string; summary?: string; primary?: boolean; accessRole?: string; deleted?: boolean; hidden?: boolean };
type ReadEvent = Parameters<typeof overlayFromGoogleEvent>[0] & { status?: string; end?: { date?: string; dateTime?: string } };

/** Read subscribed calendars, including shared reader calendars. No Google writes. */
export async function readGoogleCalendars(input: {
  environment: Environment;
  householdId: string;
  accounts: GoogleAccount[];
  memberColor: (memberId: string) => string;
  from: DateKey;
  to: DateKey;
  timeZone?: string;
  enabledServices?: Iterable<string>;
}): Promise<GoogleCalendarRead> {
  const result: GoogleCalendarRead = { overlays: [], calendars: [], errors: [] };
  const seen = new Set<string>();
  const timeZone = input.timeZone ?? TIMEZONE;
  for (const account of input.accounts) {
    try {
      await withGoogle({
        environment: input.environment, memberId: account.memberId, householdId: input.householdId,
        services: ["identity", "calendar"], enabledServices: input.enabledServices, loginHint: account.email,
        fn: async ctx => {
          const calendars: CalendarListEntry[] = [];
          let pageToken: string | undefined;
          for (let page = 0; ; page++) {
            if (page === 20) throw new Error("Too many calendar pages. Google calendar loading is incomplete.");
            const query = new URLSearchParams({ minAccessRole: "reader", maxResults: "250" });
            if (pageToken) query.set("pageToken", pageToken);
            const payload = await ctx.fetch<{ items?: CalendarListEntry[]; nextPageToken?: string }>(ctx.session.accessToken,
              `https://www.googleapis.com/calendar/v3/users/me/calendarList?${query}`);
            calendars.push(...(payload.items ?? []).filter(c => c.id && !c.deleted && !c.hidden && c.accessRole !== "freeBusyReader" && c.accessRole !== "none"));
            pageToken = payload.nextPageToken;
            if (!pageToken) break;
          }
          // A small concurrency limit keeps multi-calendar refreshes responsive.
          let cursor = 0;
          await Promise.all(Array.from({ length: Math.min(3, calendars.length) }, async () => {
            while (cursor < calendars.length) {
              const calendar = calendars[cursor++]!;
              const name = calendar.summary || (calendar.primary ? "Primary calendar" : calendar.id);
              try {
                const events: ReadEvent[] = [];
                let nextPage: string | undefined;
                for (let page = 0; ; page++) {
                  if (page === 20) throw new Error("Too many event pages; this calendar could not be fully loaded.");
                  // Fetch a padded UTC range, then filter by household civil date.
                  // This covers DST and offsets without hard-coding Toronto summer time.
                  const query = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: "250",
                    timeMin: `${addDays(input.from, -1)}T00:00:00Z`, timeMax: `${addDays(input.to, 2)}T00:00:00Z`, timeZone });
                  if (nextPage) query.set("pageToken", nextPage);
                  const payload = await ctx.fetch<{ items?: ReadEvent[]; nextPageToken?: string }>(ctx.session.accessToken,
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${query}`);
                  events.push(...(payload.items ?? []));
                  nextPage = payload.nextPageToken;
                  if (!nextPage) break;
                }
                for (const event of events) {
                  if (event.status === "cancelled" || !event.id) continue;
                  const start = dateFromGoogleEvent(event, timeZone);
                  if (!start) continue;
                  const endInstant = event.end?.dateTime ? new Date(event.end.dateTime).getTime() - 1 : NaN;
                  const end = event.end?.date ? addDays(event.end.date, -1) : Number.isFinite(endInstant) ? dateKeyInZone(new Date(endInstant), timeZone) : start;
                  for (let date = start < input.from ? input.from : start; date <= end && date <= input.to; date = addDays(date, 1)) {
                    const id = `${encodeURIComponent(calendar.id)}:${event.id}:${date}`;
                    if (seen.has(id)) continue;
                    seen.add(id);
                    result.overlays.push({ id, date, title: event.summary?.trim() || "Google event", memberId: account.memberId,
                      memberColor: input.memberColor(account.memberId), hearthOwned: event.extendedProperties?.private?.hearth === "1" });
                  }
                }
                result.calendars.push(name);
              } catch (error) { result.errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`); }
            }
          }));
        },
      });
    } catch (error) { result.errors.push(`${account.email}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  result.overlays.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  result.calendars.sort((a, b) => a.localeCompare(b));
  return result;
}

/** Compatibility helper for callers requiring an all-or-error overlay array. */
export async function listGoogleOverlays(input: Parameters<typeof readGoogleCalendars>[0]): Promise<OverlayEvent[]> {
  const result = await readGoogleCalendars(input);
  if (result.errors.length) throw new Error(result.errors.join(" "));
  return result.overlays;
}

export async function upsertHearthReminders(input: {
  environment: Environment;
  householdId: string;
  account: GoogleAccount;
  recurrences: Recurrence[];
  titleFor: (item: Recurrence) => string;
  enabledServices?: Iterable<string>;
}): Promise<{ memberId: string; calendarId: string; eventId: string; recurrenceId: string }[]> {
  return withGoogle({
    environment: input.environment,
    memberId: input.account.memberId,
    householdId: input.householdId,
    services: ["identity", "calendar"],
    enabledServices: input.enabledServices,
    loginHint: input.account.email,
    interactive: true,
    fn: async (ctx) => {
      const calendarId = ctx.session.calendarId;
      if (!calendarId) throw new Error("That Google account has no calendars.");
      const existing = await googleApiFetch<{ items?: { id: string; extendedProperties?: { private?: Record<string, string> } }[] }>(
        ctx.session.accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?privateExtendedProperty=hearth%3D1&maxResults=250`,
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
        const known = byRecurrence.get(item.id) || item.googleSync[ctx.session.memberId]?.eventId;
        let eventId = known;
        if (known) {
          await googleApiFetch(
            ctx.session.accessToken,
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(known)}`,
            { method: "PATCH", body },
          );
        } else {
          const created = await googleApiFetch<{ id: string }>(
            ctx.session.accessToken,
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            { method: "POST", body },
          );
          eventId = created.id;
        }
        if (eventId) {
          written.push({
            memberId: ctx.session.memberId,
            calendarId,
            eventId,
            recurrenceId: item.id,
          });
        }
      }

      for (const [recurrenceId, eventId] of byRecurrence) {
        if (live.has(recurrenceId)) continue;
        await googleApiFetch(
          ctx.session.accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          { method: "DELETE" },
        );
      }

      return written;
    },
  });
}
