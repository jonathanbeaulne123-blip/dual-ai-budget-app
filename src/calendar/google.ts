import { TIMEZONE, type DateKey } from "../core/calendar.ts";
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

export async function listGoogleOverlays(input: {
  environment: Environment;
  householdId: string;
  accounts: GoogleAccount[];
  memberColor: (memberId: string) => string;
  from: DateKey;
  to: DateKey;
  enabledServices?: Iterable<string>;
}): Promise<OverlayEvent[]> {
  const overlays: OverlayEvent[] = [];
  for (const account of input.accounts) {
    const items = await withGoogle({
      environment: input.environment,
      memberId: account.memberId,
      householdId: input.householdId,
      services: ["identity", "calendar"],
      enabledServices: input.enabledServices,
      loginHint: account.email,
      fn: async (ctx) => {
        const calendarId = ctx.session.calendarId;
        if (!calendarId) return [] as OverlayEvent[];
        const timeMin = `${input.from}T00:00:00-04:00`;
        const timeMax = `${input.to}T23:59:59-04:00`;
        const payload = await ctx.fetch<{ items?: Parameters<typeof overlayFromGoogleEvent>[0][] }>(
          ctx.session.accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250`,
        );
        return (payload.items ?? [])
          .map((event) => overlayFromGoogleEvent(event, account.memberId, input.memberColor(account.memberId)))
          .filter((item): item is OverlayEvent => Boolean(item));
      },
    });
    overlays.push(...items);
  }
  return overlays;
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
