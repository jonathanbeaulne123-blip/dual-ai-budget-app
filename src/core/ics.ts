import { addDays, TIMEZONE, type DateKey } from "./calendar.ts";
import { nativeEventInstant, type NativeEvent } from "./nativeEvents.ts";
import { formatCad } from "./money.ts";
import { googleRrule, HEARTH_REMINDER_HOUR } from "./recurrence.ts";
import { detectRhythms } from "./rhythm.ts";
import { appointmentPublicTitle, formatAppointmentCadence } from "./appointments.ts";
import type { Household, Recurrence } from "./types.ts";

function fold(line: string): string {
  if (line.length <= 74) return line;
  const chunks = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length) {
    chunks.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  return chunks.join("\r\n");
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function stamp(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function localStamp(date: DateKey, hour = HEARTH_REMINDER_HOUR, minute = 0): string {
  return `${date.replace(/-/g, "")}T${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}00`;
}

function vevent(input: {
  uid: string;
  stamp: string;
  date: DateKey;
  title: string;
  description: string;
  cadence?: Recurrence["cadence"];
  hoursBefore: number;
  tentative?: boolean;
}): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${input.stamp}`,
    `DTSTART;TZID=${TIMEZONE}:${localStamp(input.date)}`,
    `DTEND;TZID=${TIMEZONE}:${localStamp(input.date, HEARTH_REMINDER_HOUR, 30)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    `LOCATION:${icsEscape("Hearth household")}`,
  ];
  if (input.cadence) lines.push(googleRrule(input.date, input.cadence));
  if (input.tentative) lines.push("STATUS:TENTATIVE", "TRANSP:TRANSPARENT");
  else lines.push("STATUS:CONFIRMED");
  lines.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(input.title)}`,
    `TRIGGER:-PT${input.hoursBefore}H`,
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`${input.title} · due today`)}`,
    "TRIGGER:PT0S",
    "END:VALARM",
    "END:VEVENT",
  );
  return lines;
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TIMEZONE}`,
  `X-LIC-LOCATION:${TIMEZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Preserve the series identity: detached occurrences share UID and carry RECURRENCE-ID. */
function nativeEventIcs(event: NativeEvent, householdId: string): string[] {
  const time = (name:string,value:string) => event.allDay
    ? `${name};VALUE=DATE:${value.replace(/-/g, '')}`
    : `${name};TZID=${event.timezone}:${value.replace(/[-:]/g, '')}00`;
  const common = ['BEGIN:VEVENT', `UID:hearth-${householdId}-${event.id}@hearth.local`,
    `DTSTAMP:${stamp(event.updatedAt)}`, `SEQUENCE:${event.revision}`,
    `SUMMARY:${icsEscape(event.title)}`, `DESCRIPTION:${icsEscape(event.notes)}`, `LOCATION:${icsEscape(event.location)}`];
  const period = (start:string,end:string) => [time('DTSTART',start),time('DTEND',event.allDay?addDays(end,1):end)];
  const lines = [...common,...period(event.start,event.end)];
  if(event.repeat!=='none') {
    const until=event.until ? (event.allDay?event.until.replace(/-/g,''):stamp(nativeEventInstant(`${event.until}T23:59`,event.timezone,event.fold))) : null;
    lines.push(`RRULE:FREQ=${event.repeat.toUpperCase()}${until?`;UNTIL=${until}`:''}`);
  }
  for(const [date,exception] of Object.entries(event.exceptions)) if(exception.cancelled) lines.push(time('EXDATE',date+event.start.slice(10)));
  lines.push('END:VEVENT');
  for(const [date,exception] of Object.entries(event.exceptions)) if(!exception.cancelled&&exception.start&&exception.end)
    lines.push(...common,time('RECURRENCE-ID',date+event.start.slice(10)),...period(exception.start,exception.end),'END:VEVENT');
  return lines;
}

export function buildHouseholdIcs(household: Household, today: DateKey): string {
  const stampNow = stamp(household.lastCommittedAt);
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Hearth//Household bills//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`${household.name} · Hearth bills`)}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
    ...VTIMEZONE,
  ];

  for (const item of household.recurrences.filter((row) => row.active)) {
    const title = `${item.note.trim() || "Recurring"} · ${formatCad(item.amountCents)}`;
    lines.push(
      ...vevent({
        uid: `hearth-${household.householdId}-${item.id}@hearth.local`,
        stamp: stampNow,
        date: item.nextDate < today ? today : item.nextDate,
        title,
        description: "Hearth reminder. This is not a posted ledger row. Open Hearth and mark it paid to write the books.",
        cadence: item.cadence,
        hoursBefore: item.reminderHoursBefore || 24,
      }),
    );
  }

  for (const appointment of (household.appointments ?? []).filter((row) => row.active)) {
    const title = appointmentPublicTitle(appointment, "card");
    const netCents = Math.max(0, appointment.typicalCostCents - appointment.typicalRecoveryCents);
    lines.push(
      ...vevent({
        uid: `hearth-${household.householdId}-${appointment.id}@hearth.local`,
        stamp: stampNow,
        date: appointment.nextDate < today ? today : appointment.nextDate,
        title: netCents ? `${title} · ${formatCad(netCents)} out of pocket` : title,
        description: `Hearth visit (${formatAppointmentCadence(appointment.cadence)}). Reminder only — open Hearth and post the visit to write the books. Appointment notes travel with the household snapshot until Auth.`,
        hoursBefore: 24,
      }),
    );
  }

  for (const rhythm of detectRhythms(household, today).filter((item) => item.status === "suggested")) {
    lines.push(
      ...vevent({
        uid: `hearth-${household.householdId}-rhythm-${rhythm.key.replace(/[^a-z0-9]+/gi, "-")}@hearth.local`,
        stamp: stampNow,
        date: rhythm.nextDate,
        title: `${rhythm.note} · ${formatCad(rhythm.amountCents)} (detected)`,
        description: `Hearth spotted this ${rhythm.cadence} ${rhythm.kind} in the ledger. Adopt it in Calendar before it can post.`,
        cadence: rhythm.cadence,
        hoursBefore: 24,
        tentative: true,
      }),
    );
  }

  for(const event of household.nativeEvents??[]) if(!event.deleted) lines.push(...nativeEventIcs(event,household.householdId));
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function icsFilename(household: Household): string {
  const slug = household.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "household";
  return `hearth-bills-${slug}.ics`;
}
