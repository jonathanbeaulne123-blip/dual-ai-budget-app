import { isValidDateKey, dateKeyInZone, TIMEZONE, type DateKey } from "../calendar.ts";
import type { WorkJob } from "../types.ts";

const MAX_PUNCHES = 200;
const MAX_COWORKERS = 40;
const PULL_PREFIX = "s7pull_";
const PUNCH_PREFIX = "s7punch_";
const USER_PREFIX = "s7user_";
const FORBIDDEN = /email|mobile|phone|address|birth|token|secret|password|hourly_wage|access_token|punch_id|employee_id/i;

export type SevenShiftsPunchHours = {
  workedHours: number;
  paidBreakHours: number;
  unpaidBreakHours: number;
  elapsedHours: number;
  open: boolean;
};

export type SevenShiftsInboxPunch = {
  stablePunchId: string;
  date: DateKey;
  startedAt: string;
  endedAt: string | null;
  workedHours: number;
  paidBreakHours: number;
  roleName: string;
  locationName: string;
  open: boolean;
  tipsOmitted: true;
};

export type SevenShiftsInboxCoworker = {
  displayName: string;
  roleName: string;
  date: DateKey;
  status: "scheduled" | "punched";
};

export type SevenShiftsInboxPayload = {
  provider: "7shifts";
  sourceName: string;
  sourceHash: string;
  jobId: string;
  punches: SevenShiftsInboxPunch[];
  coworkers: SevenShiftsInboxCoworker[];
};

export type SevenShiftsTimesheetDraft = {
  date: DateKey;
  jobId: string;
  roleId: string;
  roleName: string;
  startedAt: string;
  endedAt: string;
  workedHours: number;
  paidBreakHours: number;
  punchDigest: string;
  sourceLabel: string;
  cashTips: "";
  cardTips: "";
  roleMatched: boolean;
};

export type ParsedSevenShiftsBatch = {
  sourceName: string;
  sourceKind: "7shifts";
  sourceHash: string;
  jobId: string;
  punches: SevenShiftsInboxPunch[];
  coworkers: SevenShiftsInboxCoworker[];
  drafts: SevenShiftsTimesheetDraft[];
  warnings: string[];
};

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function opaqueDigest(value: unknown, label: string, prefix: typeof PULL_PREFIX | typeof PUNCH_PREFIX | typeof USER_PREFIX): string {
  const cleaned = cleanText(value, 160);
  const digest = cleaned.slice(prefix.length);
  if (!cleaned.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`7shifts returned an invalid ${label}.`);
  }
  return cleaned;
}

function assertSafeValue(value: unknown, path: string): void {
  if (FORBIDDEN.test(path)) throw new Error("7shifts inbox included a forbidden field.");
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeValue(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN.test(key)) throw new Error("7shifts inbox included a forbidden field.");
      assertSafeValue(nested, `${path}.${key}`);
    }
  }
}

function hoursBetween(start: string, end: number): number {
  const from = Date.parse(start);
  if (!Number.isFinite(from) || !Number.isFinite(end) || end < from) return 0;
  return Math.round(((end - from) / 3_600_000) * 100) / 100;
}

function breakWindow(row: Record<string, unknown>): { start: string; end: string | null; paid: boolean } | null {
  const start = cleanText(row.in ?? row.start ?? row.clocked_in ?? row.started_at, 40);
  const endRaw = row.out ?? row.end ?? row.clocked_out ?? row.ended_at ?? null;
  const end = endRaw == null || endRaw === "" ? null : cleanText(endRaw, 40);
  if (!start || Number.isNaN(Date.parse(start))) return null;
  return { start, end, paid: row.paid === true || row.is_paid === true };
}

export function hoursFromSevenShiftsPunch(
  punch: { clocked_in?: string | null; clocked_out?: string | null; breaks?: unknown },
  nowMs = Date.now(),
): SevenShiftsPunchHours {
  const startedAt = cleanText(punch.clocked_in, 40);
  const endedRaw = punch.clocked_out == null || punch.clocked_out === "" ? null : cleanText(punch.clocked_out, 40);
  const open = !endedRaw || Number.isNaN(Date.parse(endedRaw)) || Date.parse(endedRaw) <= Date.parse(startedAt);
  const stop = open ? nowMs : Date.parse(endedRaw!);
  const elapsedHours = hoursBetween(startedAt, stop);
  const breaks = Array.isArray(punch.breaks) ? punch.breaks : [];
  let paidBreakHours = 0;
  let unpaidBreakHours = 0;
  for (const item of breaks) {
    if (!item || typeof item !== "object") continue;
    const window = breakWindow(item as Record<string, unknown>);
    if (!window) continue;
    const end = window.end ? Date.parse(window.end) : stop;
    const hours = hoursBetween(window.start, end);
    if (window.paid) paidBreakHours += hours;
    else unpaidBreakHours += hours;
  }
  paidBreakHours = Math.round(paidBreakHours * 100) / 100;
  unpaidBreakHours = Math.round(unpaidBreakHours * 100) / 100;
  return {
    elapsedHours,
    paidBreakHours,
    unpaidBreakHours,
    workedHours: Math.max(0, Math.round((elapsedHours - paidBreakHours - unpaidBreakHours) * 100) / 100),
    open,
  };
}

/** First name plus last initial. Never an email, phone, or employee id. */
export function sevenShiftsDisplayName(user: {
  first_name?: string | null;
  last_name?: string | null;
  preferred_first_name?: string | null;
  preferred_last_name?: string | null;
} | null | undefined): string {
  const first = cleanText(user?.preferred_first_name || user?.first_name, 40);
  const last = cleanText(user?.preferred_last_name || user?.last_name, 40);
  if (!first && !last) return "Coworker";
  if (!last) return first;
  return `${first} ${last.slice(0, 1)}.`;
}

export function sevenShiftsPunchDate(clockedIn: string, timeZone = TIMEZONE): DateKey {
  const at = new Date(clockedIn);
  if (Number.isNaN(at.getTime())) throw new Error("7shifts punch is missing a clock-in time.");
  return dateKeyInZone(at, timeZone);
}

export function matchWorkRoleId(job: WorkJob, roleName: string): { roleId: string; matched: boolean } {
  const wanted = cleanText(roleName, 40).toLowerCase();
  const active = job.roles.filter((role) => role.active);
  const exact = active.find((role) => role.name.trim().toLowerCase() === wanted);
  if (exact) return { roleId: exact.id, matched: true };
  const fallback = active[0] ?? job.roles[0];
  return { roleId: fallback?.id ?? "", matched: false };
}

/**
 * Normalize the Worker 7shifts inbox. This never writes money. Tips are required
 * omitted; cash/card CAD pads stay empty until the worker types them.
 */
export function parseSevenShiftsInbox(
  payload: SevenShiftsInboxPayload,
  jobs: WorkJob[],
  postedPunchDigests: Iterable<string> = [],
): ParsedSevenShiftsBatch {
  if (!payload || payload.provider !== "7shifts" || !Array.isArray(payload.punches) || !Array.isArray(payload.coworkers)) {
    throw new Error("7shifts returned an invalid Timesheet inbox response.");
  }
  assertSafeValue(payload, "payload");
  if (payload.punches.length > MAX_PUNCHES) throw new Error("7shifts returned more than 200 punches. Pull a smaller date range.");
  if (payload.coworkers.length > MAX_COWORKERS) throw new Error("7shifts returned too many coworkers. Pull a smaller date range.");
  const sourceName = cleanText(payload.sourceName, 100) || "7shifts";
  const sourceHash = opaqueDigest(payload.sourceHash, "pull digest", PULL_PREFIX);
  const jobId = cleanText(payload.jobId, 80);
  const job = jobs.find((row) => row.id === jobId && row.active);
  const posted = new Set([...postedPunchDigests].filter(Boolean));
  const warnings: string[] = [];
  const punches: SevenShiftsInboxPunch[] = [];
  const drafts: SevenShiftsTimesheetDraft[] = [];

  for (const row of payload.punches) {
    if (row?.tipsOmitted !== true) throw new Error("7shifts inbox must omit tips.");
    if ("cashTips" in (row as object) || "cardTips" in (row as object) || "tips" in (row as object)) {
      throw new Error("7shifts inbox must not carry tip amounts.");
    }
    const stablePunchId = opaqueDigest(row.stablePunchId, "punch digest", PUNCH_PREFIX);
    if (!isValidDateKey(row.date)) throw new Error("7shifts punch is missing a Toronto calendar date.");
    if (!row.startedAt || Number.isNaN(Date.parse(row.startedAt))) throw new Error("7shifts punch is missing a clock-in time.");
    const endedAt = row.endedAt && !Number.isNaN(Date.parse(row.endedAt)) ? row.endedAt : null;
    const punch: SevenShiftsInboxPunch = {
      stablePunchId,
      date: row.date,
      startedAt: row.startedAt,
      endedAt,
      workedHours: Math.max(0, Number(row.workedHours) || 0),
      paidBreakHours: Math.max(0, Number(row.paidBreakHours) || 0),
      roleName: cleanText(row.roleName, 40) || "Role",
      locationName: cleanText(row.locationName, 80),
      open: row.open === true || !endedAt,
      tipsOmitted: true,
    };
    punches.push(punch);
    if (punch.open) {
      warnings.push(`${punch.date} is still clocked on 7shifts. Clock out there before Confirm.`);
      continue;
    }
    if (posted.has(punch.stablePunchId)) {
      warnings.push(`${punch.date} is already on the books.`);
      continue;
    }
    if (!job) {
      warnings.push("Connect this 7shifts account to an active Hearth job before Confirm.");
      continue;
    }
    if (punch.workedHours + punch.paidBreakHours <= 0) {
      warnings.push(`${punch.date} has no hours to confirm.`);
      continue;
    }
    const role = matchWorkRoleId(job, punch.roleName);
    if (!role.roleId) {
      warnings.push(`${job.name} needs an active role before this punch can fill Timesheet.`);
      continue;
    }
    if (!role.matched) warnings.push(`No Hearth role named ${punch.roleName}; using ${job.roles.find((row) => row.id === role.roleId)?.name ?? "the first role"}.`);
    drafts.push({
      date: punch.date,
      jobId: job.id,
      roleId: role.roleId,
      roleName: punch.roleName,
      startedAt: punch.startedAt,
      endedAt: punch.endedAt!,
      workedHours: punch.workedHours,
      paidBreakHours: punch.paidBreakHours,
      punchDigest: punch.stablePunchId,
      sourceLabel: sourceName,
      cashTips: "",
      cardTips: "",
      roleMatched: role.matched,
    });
  }

  const coworkers: SevenShiftsInboxCoworker[] = payload.coworkers.map((row) => {
    const displayName = cleanText(row.displayName, 40);
    if (!displayName || displayName.includes("@")) throw new Error("7shifts coworker list included an unsafe name.");
    if (!isValidDateKey(row.date)) throw new Error("7shifts coworker is missing a date.");
    if (row.status !== "scheduled" && row.status !== "punched") throw new Error("7shifts coworker status is invalid.");
    return {
      displayName,
      roleName: cleanText(row.roleName, 40) || "Role",
      date: row.date,
      status: row.status,
    };
  });

  return { sourceName, sourceKind: "7shifts", sourceHash, jobId, punches, coworkers, drafts, warnings };
}

export function postedSevenShiftsPunchDigests(shifts: Array<{ sevenShiftsPunchDigest?: string | null; correctedByShiftId?: string | null }>): string[] {
  return shifts
    .filter((shift) => !shift.correctedByShiftId)
    .map((shift) => shift.sevenShiftsPunchDigest)
    .filter((value): value is string => Boolean(value));
}
