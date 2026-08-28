import { dateKeyInZone, TIMEZONE, type DateKey } from "./calendar.ts";
import { stableImportHash } from "./importInbox/hash.ts";
import type { ShiftEventTag, WorkJob } from "./types.ts";

const MAX_ICS_BYTES = 2_000_000;
const MAX_EVENTS = 2_000;
const MAX_LINE_CHARS = 8_192;

type CalendarField = { params: Record<string, string>; value: string };
type CalendarEvent = Record<string, CalendarField[]>;

export type SevenShiftsScheduledShift = {
  id: string;
  memberId: string;
  source: "7shifts-calendar";
  provenanceId: string;
  startedAt: string;
  endedAt: string;
  date: DateKey;
  scheduledMinutes: number;
  jobId: string | null;
  roleId: string | null;
  eventTag: ShiftEventTag;
  staffingCount: number | null;
  staffingSource: "calendar-overlap" | "unavailable";
  delivery: "calendar-sync" | "selected-file";
  selfMatch: "member-name" | "personal-feed-assertion";
  notesPresent: boolean;
  sequence: number;
  sourceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParsedSevenShiftsCalendar = {
  source: "7shifts-calendar";
  eventsRead: number;
  shifts: SevenShiftsScheduledShift[];
  warnings: string[];
  requiresSelfAssertion: boolean;
};

export function shapeSevenShiftsSchedules(value: unknown, memberId?: string): SevenShiftsScheduledShift[] {
  if (!Array.isArray(value)) return [];
  const shaped: SevenShiftsScheduledShift[] = [];
  for (const raw of value.slice(0, MAX_EVENTS)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Partial<SevenShiftsScheduledShift>;
    const keys = Object.keys(row);
    if (keys.some((key) => !new Set(["id", "memberId", "source", "provenanceId", "startedAt", "endedAt", "date", "scheduledMinutes", "jobId", "roleId", "eventTag", "staffingCount", "staffingSource", "delivery", "selfMatch", "notesPresent", "sequence", "sourceUpdatedAt", "createdAt", "updatedAt"]).has(key))) continue;
    if (!/^7SC-[0-9a-f]{16}$/.test(String(row.id))
      || !/^[A-Za-z0-9_-]{3,100}$/.test(String(row.memberId))
      || (memberId && row.memberId !== memberId)
      || row.source !== "7shifts-calendar"
      || !/^7shifts-calendar:[0-9a-f]{16}$/.test(String(row.provenanceId))
      || row.provenanceId !== `7shifts-calendar:${String(row.id).slice(4)}`) continue;
    const start = Date.parse(String(row.startedAt));
    const end = Date.parse(String(row.endedAt));
    const startedAt = Number.isFinite(start) ? new Date(start).toISOString() : "";
    const endedAt = Number.isFinite(end) ? new Date(end).toISOString() : "";
    const scheduledMinutes = Math.round((end - start) / 60_000);
    if (!startedAt || !endedAt || row.startedAt !== startedAt || row.endedAt !== endedAt
      || scheduledMinutes <= 0 || scheduledMinutes > 24 * 60 || row.scheduledMinutes !== scheduledMinutes
      || row.date !== dateKeyInZone(new Date(start), TIMEZONE)) continue;
    if (!new Set<ShiftEventTag>(["regular", "holiday", "sports", "festival", "private_party", "short_staffed", "vacation_cover", "illness_cover", "other"]).has(row.eventTag as ShiftEventTag)) continue;
    if (row.staffingCount != null && (!Number.isInteger(row.staffingCount) || row.staffingCount < 1 || row.staffingCount > 500)) continue;
    if (!new Set(["calendar-overlap", "unavailable"]).has(String(row.staffingSource))
      || !new Set(["calendar-sync", "selected-file"]).has(String(row.delivery))
      || !new Set(["member-name", "personal-feed-assertion"]).has(String(row.selfMatch))
      || typeof row.notesPresent !== "boolean"
      || !Number.isSafeInteger(row.sequence) || Number(row.sequence) < 0 || Number(row.sequence) > 1_000_000) continue;
    const timestamps = [row.sourceUpdatedAt, row.createdAt, row.updatedAt];
    if (timestamps.some((item, index) => (index === 0 && item == null) ? false : typeof item !== "string" || Number.isNaN(Date.parse(item)) || new Date(item).toISOString() !== item)) continue;
    if ((row.jobId != null && !/^[A-Za-z0-9_-]{1,100}$/.test(row.jobId)) || (row.roleId != null && !/^[A-Za-z0-9_-]{1,100}$/.test(row.roleId))) continue;
    shaped.push(row as SevenShiftsScheduledShift);
  }
  return [...new Map(shaped.map((row) => [row.id, row])).values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
}
function bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function unfold(source: string): string[] {
  const physical = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of physical) {
    if (line.length > MAX_LINE_CHARS) throw new Error("7shifts calendar contains an oversized line.");
    if (/^[ \t]/.test(line)) {
      if (!lines.length) throw new Error("7shifts calendar begins with an invalid folded line.");
      lines[lines.length - 1] += line.slice(1);
      if (lines[lines.length - 1]!.length > MAX_LINE_CHARS) throw new Error("7shifts calendar contains an oversized folded line.");
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function unescapeText(value: string): string {
  return value.replace(/\\[nN]/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseField(line: string): { key: string; field: CalendarField } | null {
  const colon = line.indexOf(":");
  if (colon <= 0) return null;
  const head = line.slice(0, colon).split(";");
  const key = head.shift()!.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,64}$/.test(key)) return null;
  const params: Record<string, string> = {};
  for (const item of head) {
    const equals = item.indexOf("=");
    if (equals <= 0) continue;
    const name = item.slice(0, equals).trim().toUpperCase();
    const value = item.slice(equals + 1).trim().replace(/^"|"$/g, "");
    if (/^[A-Z0-9-]{1,40}$/.test(name) && value.length <= 120) params[name] = value;
  }
  return { key, field: { params, value: unescapeText(line.slice(colon + 1)) } };
}

function calendarEvents(source: string): CalendarEvent[] {
  if (bytes(source) > MAX_ICS_BYTES) throw new Error("That 7shifts calendar is larger than 2 MB.");
  const lines = unfold(source);
  if (!lines.some((line) => line.trim().toUpperCase() === "BEGIN:VCALENDAR")) throw new Error("That file is not an iCalendar schedule.");
  const events: CalendarEvent[] = [];
  let current: CalendarEvent | null = null;
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      if (current) throw new Error("7shifts calendar contains nested events.");
      current = {};
      continue;
    }
    if (upper === "END:VEVENT") {
      if (!current) throw new Error("7shifts calendar closes an event that was not opened.");
      events.push(current);
      if (events.length > MAX_EVENTS) throw new Error("7shifts calendar contains more than 2,000 events.");
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = parseField(line);
    if (!parsed) continue;
    (current[parsed.key] ??= []).push(parsed.field);
  }
  if (current) throw new Error("7shifts calendar contains an unclosed event.");
  return events;
}

function first(event: CalendarEvent, key: string): CalendarField | null {
  return event[key]?.[0] ?? null;
}

function zoneParts(instant: Date, timeZone: string): number[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return [get("year"), get("month"), get("day"), get("hour"), get("minute"), get("second")];
}

function localIanaInstant(parts: number[], timeZone: string, label: string): string {
  if (timeZone !== TIMEZONE) throw new Error(`${label} uses unsupported timezone ${timeZone}; Hearth requires America/Toronto or UTC.`);
  const target = Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, parts[3]!, parts[4]!, parts[5]!);
  const matches: number[] = [];
  for (let offsetHours = -8; offsetHours <= -3; offsetHours += 1) {
    const candidate = target - offsetHours * 3_600_000;
    if (zoneParts(new Date(candidate), timeZone).every((value, index) => value === parts[index])) matches.push(candidate);
  }
  if (matches.length !== 1) throw new Error(`${label} is missing or ambiguous around a daylight-saving transition.`);
  return new Date(matches[0]!).toISOString();
}

function calendarInstant(field: CalendarField | null, label: string): string {
  if (!field) throw new Error(`${label} is missing.`);
  const value = field.value.trim();
  let match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (match) {
    const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
    const instant = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!, second!));
    if (Number.isNaN(instant.getTime())
      || instant.getUTCFullYear() !== year || instant.getUTCMonth() + 1 !== month || instant.getUTCDate() !== day
      || instant.getUTCHours() !== hour || instant.getUTCMinutes() !== minute || instant.getUTCSeconds() !== second) {
      throw new Error(`${label} is not a real timestamp.`);
    }
    return instant.toISOString();
  }
  match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} must include a complete calendar timestamp.`);
  return localIanaInstant(match.slice(1).map(Number), field.params.TZID || TIMEZONE, label);
}

function optionalInstant(field: CalendarField | null): string | null {
  if (!field) return null;
  return calendarInstant(field, "7shifts schedule update");
}

function normalized(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function eventText(event: CalendarEvent): string {
  return [first(event, "SUMMARY")?.value, first(event, "DESCRIPTION")?.value, first(event, "CATEGORIES")?.value, first(event, "LOCATION")?.value]
    .filter(Boolean).join(" ").slice(0, 20_000);
}

function summaryOwnerMatches(event: CalendarEvent, memberName: string): boolean {
  const owner = (first(event, "SUMMARY")?.value ?? "").split(/\s+-\s+/, 1)[0] ?? "";
  return Boolean(normalized(memberName) && normalized(owner) === normalized(memberName));
}

function identifiesSevenShifts(source: string): boolean {
  if (bytes(source) > MAX_ICS_BYTES) throw new Error("That 7shifts calendar is larger than 2 MB.");
  return unfold(source).some((line) => {
    const parsed = parseField(line);
    return parsed?.key === "PRODID" && normalized(parsed.field.value).includes("7shifts");
  });
}

function classifyEvent(value: string): ShiftEventTag {
  const text = normalized(value);
  if (/\b(holiday|christmas|new year|thanksgiving|canada day|civic holiday)\b/.test(text)) return "holiday";
  if (/\b(game|hockey|leafs|raptors|jays|sports|playoff|final)\b/.test(text)) return "sports";
  if (/\b(festival|concert|parade|exhibition|cne|caribana|pride)\b/.test(text)) return "festival";
  if (/\b(private|wedding|banquet|buyout|party)\b/.test(text)) return "private_party";
  if (/\b(short staff|short staffed|understaffed)\b/.test(text)) return "short_staffed";
  if (/\b(vacation cover|vacation relief)\b/.test(text)) return "vacation_cover";
  if (/\b(sick cover|illness cover)\b/.test(text)) return "illness_cover";
  return "regular";
}

function matchJob(text: string, jobs: WorkJob[]): { jobId: string; roleId: string } | null {
  const haystack = ` ${normalized(text)} `;
  const matches: Array<{ jobId: string; roleId: string }> = [];
  for (const job of jobs.filter((row) => row.active)) {
    const jobMatch = normalized(job.name);
    const locationMatch = normalized(job.locationName);
    const namedJob = Boolean(jobMatch && haystack.includes(` ${jobMatch} `));
    const namedLocation = Boolean(locationMatch && haystack.includes(` ${locationMatch} `));
    if (!namedJob && !namedLocation) continue;
    for (const role of job.roles.filter((row) => row.active)) {
      const roleName = normalized(role.name);
      if (roleName && haystack.includes(` ${roleName} `)) matches.push({ jobId: job.id, roleId: role.id });
    }
  }
  const unique = [...new Map(matches.map((row) => [`${row.jobId}|${row.roleId}`, row])).values()];
  return unique.length === 1 ? unique[0]! : null;
}

function overlaps(left: { start: number; end: number; location: string }, right: { start: number; end: number; location: string }): boolean {
  return left.location === right.location && left.start < right.end && right.start < left.end;
}

export function parseSevenShiftsCalendar(input: {
  source: string;
  sourceName?: string;
  memberId: string;
  memberName: string;
  jobs: WorkJob[];
  delivery?: SevenShiftsScheduledShift["delivery"];
  now?: Date;
}): ParsedSevenShiftsCalendar {
  if (!identifiesSevenShifts(input.source)) throw new Error("That calendar does not identify itself as a 7shifts schedule.");
  const events = calendarEvents(input.source).filter((event) => first(event, "STATUS")?.value.toUpperCase() !== "CANCELLED");
  const parsed = events.map((event, index) => {
    const startedAt = calendarInstant(first(event, "DTSTART"), `7shifts event ${index + 1} start`);
    const endedAt = calendarInstant(first(event, "DTEND"), `7shifts event ${index + 1} end`);
    const start = Date.parse(startedAt);
    const end = Date.parse(endedAt);
    const scheduledMinutes = Math.round((end - start) / 60_000);
    if (!Number.isSafeInteger(scheduledMinutes) || scheduledMinutes <= 0 || scheduledMinutes > 24 * 60) throw new Error(`7shifts event ${index + 1} has an invalid duration.`);
    const text = eventText(event);
    const location = normalized(first(event, "LOCATION")?.value ?? "") || "unknown";
    const uid = first(event, "UID")?.value.trim();
    if (!uid || uid.length > 512 || /[\u0000-\u001f\u007f]/.test(uid)) throw new Error(`7shifts event ${index + 1} has an invalid identity.`);
    const sequenceRaw = Number(first(event, "SEQUENCE")?.value ?? 0);
    const sequence = Number.isSafeInteger(sequenceRaw) && sequenceRaw >= 0 && sequenceRaw <= 1_000_000 ? sequenceRaw : 0;
    return { event, text, location, startedAt, endedAt, start, end, scheduledMinutes, uid, sequence };
  });
  const named = parsed.filter((row) => summaryOwnerMatches(row.event, input.memberName));
  const candidates = named.length ? named : parsed;
  const selfMatch: SevenShiftsScheduledShift["selfMatch"] = named.length ? "member-name" : "personal-feed-assertion";
  const now = (input.now ?? new Date()).toISOString();
  const shifts = candidates.map((row) => {
    const match = matchJob(row.text, input.jobs.filter((job) => job.memberId === input.memberId));
    const staffing = parsed.filter((other) => overlaps(row, other)).length;
    const sourceUpdatedAt = optionalInstant(first(row.event, "LAST-MODIFIED") ?? first(row.event, "DTSTAMP"));
    const key = stableImportHash(`seven-shifts-calendar|${row.uid}`);
    return {
      id: `7SC-${key}`,
      memberId: input.memberId,
      source: "7shifts-calendar" as const,
      provenanceId: `7shifts-calendar:${key}`,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      date: dateKeyInZone(new Date(row.startedAt), TIMEZONE) as DateKey,
      scheduledMinutes: row.scheduledMinutes,
      jobId: match?.jobId ?? null,
      roleId: match?.roleId ?? null,
      eventTag: classifyEvent(row.text),
      staffingCount: staffing > 0 && staffing <= 500 ? staffing : null,
      staffingSource: staffing > 0 && staffing <= 500 ? "calendar-overlap" as const : "unavailable" as const,
      delivery: input.delivery ?? "selected-file",
      selfMatch,
      notesPresent: Boolean(first(row.event, "DESCRIPTION")?.value.trim()),
      sequence: row.sequence,
      sourceUpdatedAt,
      createdAt: now,
      updatedAt: sourceUpdatedAt ?? now,
    };
  }).sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  return {
    source: "7shifts-calendar",
    eventsRead: parsed.length,
    shifts,
    requiresSelfAssertion: selfMatch === "personal-feed-assertion",
    warnings: [
      "Published calendar shifts are schedule evidence, not worked hours or earnings.",
      ...(selfMatch === "personal-feed-assertion" ? ["The feed did not name this Hearth member; confirm it is your personal 7shifts calendar before saving."] : []),
      ...(parsed.length > shifts.length ? [`${parsed.length - shifts.length} other schedule event(s) were used only for anonymous overlap counts and then discarded.`] : []),
    ],
  };
}
