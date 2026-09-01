import { stableImportHash } from "./importInbox/hash.ts";
import type { CoworkerAttendanceStatus } from "./coworkers.ts";
import { dateKeyInZone, type DateKey } from "./calendar.ts";
import type { Environment, Shift, ShiftEventTag } from "./types.ts";
import type { SevenShiftsEvidenceBundle } from "./evidence.ts";
import type { WeatherGlass } from "./weather.ts";
import type { SevenShiftsScheduledShift } from "./sevenShiftsCalendar.ts";

export const SHIFT_ENVELOPE_STATUSES = [
  "upcoming",
  "picked_up",
  "traded_away",
  "cut",
  "called_off",
  "awaiting_punch",
  "worked_ready",
  "needs_review",
  "confirmed",
  "corrected",
] as const;

export type ShiftEnvelopeStatus = (typeof SHIFT_ENVELOPE_STATUSES)[number];
export type ShiftOutcome = "worked" | "cut" | "called_off" | "traded_away";
export type ShiftSourceCategory =
  | "seven_shifts_schedule"
  | "seven_shifts_timesheet"
  | "seven_shifts_punch"
  | "seven_shifts_email"
  | "ics"
  | "document_scan"
  | "manual"
  | "weather";
export type ShiftSourceFinality = "outlook" | "provisional" | "approved" | "final" | "user_confirmed";
export type ShiftValuePresence = "missing" | "explicit_zero" | "present";
export type ShiftContextConfidence = "observed" | "user_confirmed" | "inferred";

export type ShiftFieldAuthority = {
  field: string;
  source: ShiftSourceCategory;
  observedAt: string;
  finality: ShiftSourceFinality;
  presence: ShiftValuePresence;
};

export type ShiftWeatherContext = {
  state: "pending" | "complete" | "unavailable";
  source: "open-meteo-historical";
  latitudeRounded: number | null;
  longitudeRounded: number | null;
  intervalStartedAt: string;
  intervalEndedAt: string;
  midpointTemperatureCelsius: number | null;
  apparentTemperatureCelsius: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  windKph: number | null;
  fetchedAt: string | null;
};

export type ShiftContextFact = {
  key: string;
  value: string;
  confidence: ShiftContextConfidence;
};

export type ShiftEnvelope = {
  id: string;
  environment: Environment;
  householdId: string;
  memberId: string;
  canonicalShiftKey: string;
  jobId: string | null;
  roleId: string | null;
  roleLabel: string | null;
  locationName: string | null;
  timezone: string;
  date: DateKey;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  workedMinutes: number | null;
  paidBreakMinutes: number | null;
  unpaidBreakMinutes: number | null;
  approvalState: "unknown" | "unapproved" | "approved" | "final";
  status: ShiftEnvelopeStatus;
  sourceCategories: ShiftSourceCategory[];
  authority: ShiftFieldAuthority[];
  conflicts: string[];
  lastObservedAt: string;
  sourceFinality: ShiftSourceFinality;
  confirmedBibleId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShiftBibleAttendance = {
  coworkerId: string;
  status: CoworkerAttendanceStatus;
  roleLabel: string | null;
};

export type ShiftBibleContextRevision = {
  revision: number;
  materialHash: string;
  weather: ShiftWeatherContext | null;
  authority: ShiftFieldAuthority[];
  updatedAt: string;
};

export type ShiftBible = {
  id: string;
  version: 1;
  revision: number;
  environment: Environment;
  householdId: string;
  memberId: string;
  envelopeId: string;
  outcome: ShiftOutcome;
  jobId: string;
  roleId: string;
  locationName: string;
  timezone: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  workedMinutes: number | null;
  paidBreakMinutes: number | null;
  unpaidBreakMinutes: number | null;
  approvalState: "unknown" | "unapproved" | "approved" | "final" | "user_confirmed";
  scheduleDifferenceMinutes: number | null;
  cashTipsCents: number | null;
  cardTipsCents: number | null;
  salesCents: number | null;
  salesByField: Record<string, number>;
  customersServed: number | null;
  staffingCount: number | null;
  grossWagesCents: number | null;
  netTipsCents: number | null;
  tipOutCents: number | null;
  attendance: ShiftBibleAttendance[];
  weather: ShiftWeatherContext | null;
  weatherGlass: WeatherGlass | null;
  eventTag: ShiftEventTag | null;
  contextFacts: ShiftContextFact[];
  revisionHistory: ShiftBibleContextRevision[];
  authority: ShiftFieldAuthority[];
  linkedShiftId: string | null;
  commandConfirmationId: string;
  correctionOfBibleId: string | null;
  correctedByBibleId: string | null;
  confirmedAt: string;
  materialHash: string;
  createdAt: string;
  updatedAt: string;
};

export type ShiftBibleDraft = {
  envelopeId: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  unpaidBreakMinutes?: number | null;
  approvalState?: ShiftBible["approvalState"];
  weather?: ShiftWeatherContext | null;
  contextFacts?: ShiftContextFact[];
  authority?: ShiftFieldAuthority[];
  correctionOfBibleId?: string | null;
};

export type ShiftEnvelopeEvidenceProposal = {
  canonicalShiftKey: string;
  kind: "coworker-schedule" | "worked-shift" | "schedule-window";
  jobId: string;
  roleId: string;
  date: DateKey;
  startedAt: string;
  endedAt: string;
  workedMinutes: number | null;
  paidBreakMinutes: number | null;
  unpaidBreakMinutes: number | null;
  observedAt: string;
  finality: ShiftSourceFinality;
  source: Extract<ShiftSourceCategory, "seven_shifts_schedule" | "seven_shifts_timesheet" | "seven_shifts_punch" | "seven_shifts_email">;
  statusHint?: Extract<ShiftEnvelopeStatus, "picked_up" | "traded_away" | "cut" | "called_off"> | null;
  completeRange?: { startDate: DateKey; endDate: DateKey } | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,180}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function iso(value: unknown, nullable = false): string | null {
  if (nullable && (value == null || value === "")) return null;
  if (typeof value !== "string" || !ISO.test(value) || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function boundedInt(value: unknown, min: number, max: number, nullable = true): number | null {
  if (nullable && (value == null || value === "")) return null;
  return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : null;
}

function cents(value: unknown): number | null {
  return boundedInt(value, 0, 100_000_000);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
      .map((key) => [key, stable((value as Record<string, unknown>)[key])]));
  }
  return value;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

export function shiftBibleMaterialHash(bible: Omit<ShiftBible, "materialHash"> | ShiftBible): string {
  const { materialHash: _materialHash, ...facts } = bible as ShiftBible;
  return `bible_${stableImportHash(JSON.stringify(stable({
    ...facts,
    authority: [...facts.authority].sort((a, b) => a.field.localeCompare(b.field) || a.source.localeCompare(b.source)),
    attendance: [...facts.attendance].sort((a, b) => a.coworkerId.localeCompare(b.coworkerId)),
    contextFacts: [...facts.contextFacts].sort((a, b) => a.key.localeCompare(b.key)),
  })))}`;
}

export function shapeShiftFieldAuthority(value: unknown): ShiftFieldAuthority[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as ShiftFieldAuthority;
    const field = text(row.field, 80);
    const observedAt = iso(row.observedAt);
    if (!field || !observedAt) return [];
    if (!["seven_shifts_schedule", "seven_shifts_timesheet", "seven_shifts_punch", "seven_shifts_email", "ics", "document_scan", "manual", "weather"].includes(row.source)) return [];
    if (!["outlook", "provisional", "approved", "final", "user_confirmed"].includes(row.finality)) return [];
    if (!["missing", "explicit_zero", "present"].includes(row.presence)) return [];
    return [{ field, source: row.source, observedAt, finality: row.finality, presence: row.presence }];
  });
}

export function shapeShiftEnvelope(value: unknown, ownerMemberId?: string): ShiftEnvelope | null {
  if (!value || typeof value !== "object") return null;
  const row = value as ShiftEnvelope;
  if (ownerMemberId && row.memberId !== ownerMemberId) return null;
  const scheduledStart = iso(row.scheduledStart);
  const scheduledEnd = iso(row.scheduledEnd);
  const createdAt = iso(row.createdAt);
  const updatedAt = iso(row.updatedAt);
  const lastObservedAt = iso(row.lastObservedAt);
  if (!SAFE_ID.test(row.id) || !SAFE_ID.test(row.canonicalShiftKey) || !SAFE_ID.test(row.memberId)
    || !SAFE_ID.test(row.householdId) || !scheduledStart || !scheduledEnd || !createdAt || !updatedAt || !lastObservedAt
    || scheduledEnd <= scheduledStart || !DATE.test(row.date) || !SHIFT_ENVELOPE_STATUSES.includes(row.status)) return null;
  const sourceCategories = uniqueSorted((Array.isArray(row.sourceCategories) ? row.sourceCategories : [])
    .filter((item): item is ShiftSourceCategory => ["seven_shifts_schedule", "seven_shifts_timesheet", "seven_shifts_punch", "seven_shifts_email", "ics", "document_scan", "manual", "weather"].includes(item)));
  const approvalState = ["unknown", "unapproved", "approved", "final"].includes(row.approvalState) ? row.approvalState : "unknown";
  const sourceFinality = ["outlook", "provisional", "approved", "final", "user_confirmed"].includes(row.sourceFinality) ? row.sourceFinality : "outlook";
  return {
    id: row.id,
    environment: row.environment === "production" ? "production" : "development",
    householdId: row.householdId,
    memberId: row.memberId,
    canonicalShiftKey: row.canonicalShiftKey,
    jobId: SAFE_ID.test(row.jobId ?? "") ? row.jobId : null,
    roleId: SAFE_ID.test(row.roleId ?? "") ? row.roleId : null,
    roleLabel: text(row.roleLabel, 80) || null,
    locationName: text(row.locationName, 120) || null,
    timezone: text(row.timezone, 80) || "America/Toronto",
    date: row.date,
    scheduledStart,
    scheduledEnd,
    actualStart: iso(row.actualStart, true),
    actualEnd: iso(row.actualEnd, true),
    workedMinutes: boundedInt(row.workedMinutes, 0, 2_880),
    paidBreakMinutes: boundedInt(row.paidBreakMinutes, 0, 1_440),
    unpaidBreakMinutes: boundedInt(row.unpaidBreakMinutes, 0, 1_440),
    approvalState,
    status: row.status,
    sourceCategories,
    authority: shapeShiftFieldAuthority(row.authority),
    conflicts: uniqueSorted((Array.isArray(row.conflicts) ? row.conflicts : []).map((item) => text(item, 160)).filter(Boolean)),
    lastObservedAt,
    sourceFinality,
    confirmedBibleId: SAFE_ID.test(row.confirmedBibleId ?? "") ? row.confirmedBibleId : null,
    createdAt,
    updatedAt,
  };
}

export function shapeShiftEnvelopes(value: unknown, ownerMemberId?: string): ShiftEnvelope[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, ShiftEnvelope>();
  for (const item of value.slice(0, 2_000)) {
    const shaped = shapeShiftEnvelope(item, ownerMemberId);
    if (shaped) byId.set(shaped.id, shaped);
  }
  return [...byId.values()].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart) || a.id.localeCompare(b.id));
}

export function shapeShiftWeatherContext(value: unknown): ShiftWeatherContext | null {
  if (!value || typeof value !== "object") return null;
  const row = value as ShiftWeatherContext;
  const intervalStartedAt = iso(row.intervalStartedAt);
  const intervalEndedAt = iso(row.intervalEndedAt);
  if (!intervalStartedAt || !intervalEndedAt || intervalEndedAt <= intervalStartedAt || !["pending", "complete", "unavailable"].includes(row.state)) return null;
  const decimal = (raw: unknown, min: number, max: number): number | null => typeof raw === "number" && Number.isFinite(raw) && raw >= min && raw <= max ? Math.round(raw * 10) / 10 : null;
  return {
    state: row.state,
    source: "open-meteo-historical",
    latitudeRounded: decimal(row.latitudeRounded, -90, 90),
    longitudeRounded: decimal(row.longitudeRounded, -180, 180),
    intervalStartedAt,
    intervalEndedAt,
    midpointTemperatureCelsius: decimal(row.midpointTemperatureCelsius, -100, 70),
    apparentTemperatureCelsius: decimal(row.apparentTemperatureCelsius, -120, 80),
    precipitationMm: decimal(row.precipitationMm, 0, 10_000),
    weatherCode: boundedInt(row.weatherCode, 0, 999),
    windKph: decimal(row.windKph, 0, 500),
    fetchedAt: iso(row.fetchedAt, true),
  };
}

export function shapeShiftBible(value: unknown, ownerMemberId?: string): ShiftBible | null {
  if (!value || typeof value !== "object") return null;
  const row = value as ShiftBible;
  if (ownerMemberId && row.memberId !== ownerMemberId) return null;
  const confirmedAt = iso(row.confirmedAt);
  const createdAt = iso(row.createdAt);
  const updatedAt = iso(row.updatedAt);
  if (!SAFE_ID.test(row.id) || !SAFE_ID.test(row.envelopeId) || !SAFE_ID.test(row.memberId) || !SAFE_ID.test(row.householdId)
    || !SAFE_ID.test(row.jobId) || !SAFE_ID.test(row.roleId) || !confirmedAt || !createdAt || !updatedAt
    || row.version !== 1 || !Number.isSafeInteger(row.revision) || row.revision < 1 || !["worked", "cut", "called_off", "traded_away"].includes(row.outcome)) return null;
  const attendance: ShiftBibleAttendance[] = Array.isArray(row.attendance) ? row.attendance.slice(0, 250).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as ShiftBibleAttendance;
    if (!SAFE_ID.test(entry.coworkerId) || !["scheduled-assumed", "user-confirmed-present", "user-confirmed-absent", "surprise-helper"].includes(entry.status)) return [];
    return [{ coworkerId: entry.coworkerId, status: entry.status, roleLabel: text(entry.roleLabel, 80) || null }];
  }) : [];
  const contextFacts: ShiftContextFact[] = Array.isArray(row.contextFacts) ? row.contextFacts.slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as ShiftContextFact;
    const key = text(entry.key, 60);
    const valueText = text(entry.value, 160);
    if (!key || !valueText || !["observed", "user_confirmed", "inferred"].includes(entry.confidence)) return [];
    return [{ key, value: valueText, confidence: entry.confidence }];
  }) : [];
  const revisionHistory: ShiftBibleContextRevision[] = Array.isArray(row.revisionHistory) ? row.revisionHistory.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const revision = Number((item as ShiftBibleContextRevision).revision);
    const materialHash = text((item as ShiftBibleContextRevision).materialHash, 100);
    const historyUpdatedAt = iso((item as ShiftBibleContextRevision).updatedAt);
    if (!Number.isSafeInteger(revision) || revision < 1 || !/^bible_[a-f0-9]+$/.test(materialHash) || !historyUpdatedAt) return [];
    return [{ revision, materialHash, weather: shapeShiftWeatherContext((item as ShiftBibleContextRevision).weather), authority: shapeShiftFieldAuthority((item as ShiftBibleContextRevision).authority), updatedAt: historyUpdatedAt }];
  }) : [];
  const bibleWithoutHash: Omit<ShiftBible, "materialHash"> = {
    id: row.id,
    version: 1,
    revision: row.revision,
    environment: row.environment === "production" ? "production" : "development",
    householdId: row.householdId,
    memberId: row.memberId,
    envelopeId: row.envelopeId,
    outcome: row.outcome,
    jobId: row.jobId,
    roleId: row.roleId,
    locationName: text(row.locationName, 120),
    timezone: text(row.timezone, 80) || "America/Toronto",
    scheduledStart: iso(row.scheduledStart, true),
    scheduledEnd: iso(row.scheduledEnd, true),
    actualStart: iso(row.actualStart, true),
    actualEnd: iso(row.actualEnd, true),
    workedMinutes: boundedInt(row.workedMinutes, 0, 2_880),
    paidBreakMinutes: boundedInt(row.paidBreakMinutes, 0, 1_440),
    unpaidBreakMinutes: boundedInt(row.unpaidBreakMinutes, 0, 1_440),
    approvalState: ["unknown", "unapproved", "approved", "final", "user_confirmed"].includes(row.approvalState) ? row.approvalState : "unknown",
    scheduleDifferenceMinutes: boundedInt(row.scheduleDifferenceMinutes, -2_880, 2_880),
    cashTipsCents: cents(row.cashTipsCents),
    cardTipsCents: cents(row.cardTipsCents),
    salesCents: cents(row.salesCents),
    salesByField: Object.fromEntries(Object.entries(row.salesByField ?? {}).flatMap(([key, raw]) => {
      const amount = cents(raw);
      return SAFE_ID.test(key) && amount != null ? [[key, amount]] : [];
    })),
    customersServed: boundedInt(row.customersServed, 0, 5_000),
    staffingCount: boundedInt(row.staffingCount, 0, 200),
    grossWagesCents: cents(row.grossWagesCents),
    netTipsCents: cents(row.netTipsCents),
    tipOutCents: cents(row.tipOutCents),
    attendance,
    weather: shapeShiftWeatherContext(row.weather),
    weatherGlass: ["clear", "rain", "snow", "night", "humid"].includes(row.weatherGlass ?? "") ? row.weatherGlass : null,
    eventTag: ["regular", "holiday", "sports", "festival", "private_party", "short_staffed", "vacation_cover", "illness_cover", "other"].includes(row.eventTag ?? "") ? row.eventTag : null,
    contextFacts,
    revisionHistory,
    authority: shapeShiftFieldAuthority(row.authority),
    linkedShiftId: SAFE_ID.test(row.linkedShiftId ?? "") ? row.linkedShiftId : null,
    commandConfirmationId: text(row.commandConfirmationId, 180),
    correctionOfBibleId: SAFE_ID.test(row.correctionOfBibleId ?? "") ? row.correctionOfBibleId : null,
    correctedByBibleId: SAFE_ID.test(row.correctedByBibleId ?? "") ? row.correctedByBibleId : null,
    confirmedAt,
    createdAt,
    updatedAt,
  };
  const materialHash = shiftBibleMaterialHash(bibleWithoutHash);
  if (row.materialHash !== materialHash) return null;
  if (bibleWithoutHash.outcome === "worked" && (!bibleWithoutHash.linkedShiftId || bibleWithoutHash.workedMinutes == null)) return null;
  if (bibleWithoutHash.outcome !== "worked" && bibleWithoutHash.linkedShiftId) return null;
  return { ...bibleWithoutHash, materialHash };
}

export function shapeShiftBibles(value: unknown, ownerMemberId?: string): ShiftBible[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, ShiftBible>();
  for (const item of value.slice(0, 5_000)) {
    const shaped = shapeShiftBible(item, ownerMemberId);
    if (shaped) byId.set(shaped.id, shaped);
  }
  return [...byId.values()].sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt) || a.id.localeCompare(b.id));
}

export function envelopeFromSchedule(input: {
  householdId: string;
  environment: Environment;
  schedule: SevenShiftsScheduledShift;
  locationName?: string | null;
  timezone?: string;
  observedAt?: string;
}): ShiftEnvelope {
  const observedAt = input.observedAt ?? input.schedule.sourceUpdatedAt ?? input.schedule.updatedAt;
  const canonicalShiftKey = `schedule:${input.schedule.provenanceId}`;
  const id = `ENV-${stableImportHash(`${input.householdId}:${input.schedule.memberId}:${canonicalShiftKey}`)}`;
  return {
    id,
    environment: input.environment,
    householdId: input.householdId,
    memberId: input.schedule.memberId,
    canonicalShiftKey,
    jobId: input.schedule.jobId ?? null,
    roleId: input.schedule.roleId ?? null,
    roleLabel: null,
    locationName: input.locationName ?? null,
    timezone: input.timezone ?? "America/Toronto",
    date: input.schedule.date,
    scheduledStart: input.schedule.startedAt,
    scheduledEnd: input.schedule.endedAt,
    actualStart: null,
    actualEnd: null,
    workedMinutes: null,
    paidBreakMinutes: null,
    unpaidBreakMinutes: null,
    approvalState: "unknown",
    status: "upcoming",
    sourceCategories: [input.schedule.selfMatch === "personal-feed-assertion" ? "ics" : "seven_shifts_schedule"],
    authority: [
      { field: "scheduledStart", source: input.schedule.selfMatch === "personal-feed-assertion" ? "ics" : "seven_shifts_schedule", observedAt, finality: "outlook", presence: "present" },
      { field: "scheduledEnd", source: input.schedule.selfMatch === "personal-feed-assertion" ? "ics" : "seven_shifts_schedule", observedAt, finality: "outlook", presence: "present" },
    ],
    conflicts: [],
    lastObservedAt: observedAt,
    sourceFinality: "outlook",
    confirmedBibleId: null,
    createdAt: input.schedule.createdAt,
    updatedAt: input.schedule.updatedAt,
  };
}

export function statusForEnvelopeAt(envelope: ShiftEnvelope, now = new Date()): ShiftEnvelopeStatus {
  if (["traded_away", "cut", "called_off", "worked_ready", "needs_review", "confirmed", "corrected"].includes(envelope.status)) return envelope.status;
  if (envelope.actualEnd && envelope.workedMinutes != null) return "worked_ready";
  if (Date.parse(envelope.scheduledEnd) <= now.getTime()) return "awaiting_punch";
  return envelope.status === "picked_up" ? "picked_up" : "upcoming";
}

export function mergeScheduleEnvelopes(input: {
  existing: ShiftEnvelope[];
  schedules: SevenShiftsScheduledShift[];
  householdId: string;
  environment: Environment;
  memberId: string;
  jobs: Array<{ id: string; memberId: string; locationName: string; timezone: string }>;
  observedAt: string;
  completeRange?: { startDate: DateKey; endDate: DateKey } | null;
}): ShiftEnvelope[] {
  const allExisting = shapeShiftEnvelopes(input.existing);
  const untouched = allExisting.filter((row) => row.memberId !== input.memberId);
  const existing = allExisting.filter((row) => row.memberId === input.memberId);
  const byCanonical = new Map(existing.map((row) => [row.canonicalShiftKey, row]));
  const captured = new Set<string>();
  for (const schedule of input.schedules.filter((row) => row.memberId === input.memberId)) {
    const job = input.jobs.find((row) => row.id === schedule.jobId && row.memberId === input.memberId);
    const proposed = envelopeFromSchedule({ householdId: input.householdId, environment: input.environment, schedule, locationName: job?.locationName, timezone: job?.timezone, observedAt: input.observedAt });
    captured.add(proposed.canonicalShiftKey);
    const prior = byCanonical.get(proposed.canonicalShiftKey);
    byCanonical.set(proposed.canonicalShiftKey, prior ? {
      ...proposed,
      id: prior.id,
      actualStart: prior.actualStart,
      actualEnd: prior.actualEnd,
      workedMinutes: prior.workedMinutes,
      paidBreakMinutes: prior.paidBreakMinutes,
      unpaidBreakMinutes: prior.unpaidBreakMinutes,
      approvalState: prior.approvalState,
      status: ["worked_ready", "needs_review", "confirmed", "corrected", "called_off", "traded_away"].includes(prior.status) ? prior.status : proposed.status,
      sourceCategories: uniqueSorted([...prior.sourceCategories, ...proposed.sourceCategories]),
      authority: [...prior.authority.filter((row) => !["scheduledStart", "scheduledEnd"].includes(row.field)), ...proposed.authority],
      conflicts: prior.conflicts,
      confirmedBibleId: prior.confirmedBibleId,
      createdAt: prior.createdAt,
      updatedAt: input.observedAt,
    } : proposed);
  }
  if (input.completeRange) {
    for (const [key, envelope] of byCanonical) {
      if (envelope.memberId !== input.memberId || envelope.date < input.completeRange.startDate || envelope.date > input.completeRange.endDate || captured.has(key)) continue;
      if (["confirmed", "corrected", "called_off", "traded_away"].includes(envelope.status)) continue;
      byCanonical.set(key, {
        ...envelope,
        status: "cut",
        sourceCategories: uniqueSorted([...envelope.sourceCategories, "seven_shifts_schedule"]),
        authority: [...envelope.authority, { field: "outcome", source: "seven_shifts_schedule", observedAt: input.observedAt, finality: "final", presence: "present" }],
        lastObservedAt: input.observedAt,
        sourceFinality: "final",
        updatedAt: input.observedAt,
      });
    }
  }
  const observedAt = new Date(input.observedAt);
  return [...untouched, ...byCanonical.values()].map((row) => ({ ...row, status: statusForEnvelopeAt(row, observedAt) }))
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart) || a.id.localeCompare(b.id));
}

export function applyWorkedEvidenceToEnvelope(envelope: ShiftEnvelope, bundle: SevenShiftsEvidenceBundle, observedAt: string): ShiftEnvelope {
  if (bundle.memberId !== envelope.memberId || bundle.jobId !== envelope.jobId
    || dateKeyInZone(new Date(bundle.startedAt), envelope.timezone) !== envelope.date) throw new Error("Worked evidence belongs to another shift envelope.");
  const startedAt = bundle.observations.find((row) => row.field === "startedAt")?.value;
  const endedAt = bundle.observations.find((row) => row.field === "endedAt")?.value;
  const workedMinutes = bundle.observations.find((row) => row.field === "workedMinutes")?.value;
  if (typeof startedAt !== "string" || typeof endedAt !== "string" || !Number.isSafeInteger(workedMinutes)) throw new Error("Worked evidence is missing its exact time facts.");
  const priorMaterial = JSON.stringify([envelope.actualStart, envelope.actualEnd, envelope.workedMinutes, envelope.paidBreakMinutes, envelope.unpaidBreakMinutes]);
  const paidBreak = bundle.observations.find((row) => row.field === "paidBreakMinutes")?.value;
  const unpaidBreak = bundle.observations.find((row) => row.field === "unpaidBreakMinutes")?.value;
  const nextMaterial = JSON.stringify([startedAt, endedAt, workedMinutes, paidBreak ?? null, unpaidBreak ?? null]);
  return {
    ...envelope,
    actualStart: startedAt,
    actualEnd: endedAt,
    workedMinutes: Number(workedMinutes),
    paidBreakMinutes: Number.isSafeInteger(paidBreak) ? Number(paidBreak) : null,
    unpaidBreakMinutes: Number.isSafeInteger(unpaidBreak) ? Number(unpaidBreak) : null,
    approvalState: bundle.state === "eligible" ? "approved" : "unknown",
    status: envelope.confirmedBibleId && priorMaterial !== nextMaterial
      ? "needs_review"
      : bundle.state === "eligible"
        ? "worked_ready"
        : "needs_review",
    sourceCategories: uniqueSorted([...envelope.sourceCategories, "seven_shifts_timesheet"]),
    sourceFinality: bundle.state === "eligible" ? "approved" : "provisional",
    lastObservedAt: observedAt,
    updatedAt: observedAt,
  };
}

export function bibleFromConfirmedShift(input: {
  householdId: string;
  environment: Environment;
  shift: Shift;
  envelope: ShiftEnvelope;
  draft: ShiftBibleDraft;
  attendance: ShiftBibleAttendance[];
  confirmationId: string;
  createdAt: string;
}): ShiftBible {
  const { shift, envelope, draft } = input;
  if (!shift.jobId || !shift.roleId || shift.memberId !== envelope.memberId || envelope.jobId !== shift.jobId || envelope.roleId !== shift.roleId) {
    throw new Error("Shift Bible scope does not match the confirmed job and role.");
  }
  const workedMinutes = Math.round(shift.hours * 60);
  const scheduledMinutes = Math.round((Date.parse(envelope.scheduledEnd) - Date.parse(envelope.scheduledStart)) / 60_000);
  const reviewedPresence = (field: string): ShiftValuePresence => [...(draft.authority ?? [])].reverse().find((row) => row.field === field)?.presence ?? "missing";
  const reviewedNumber = (field: string, value: number | null | undefined): number | null => reviewedPresence(field) === "missing" ? null : value ?? null;
  const bibleWithoutHash: Omit<ShiftBible, "materialHash"> = {
    id: `BIBLE-${stableImportHash(`${input.householdId}:${shift.memberId}:${shift.id}:1`)}`,
    version: 1,
    revision: 1,
    environment: input.environment,
    householdId: input.householdId,
    memberId: shift.memberId,
    envelopeId: envelope.id,
    outcome: "worked",
    jobId: shift.jobId,
    roleId: shift.roleId,
    locationName: envelope.locationName ?? "",
    timezone: envelope.timezone,
    scheduledStart: draft.scheduledStart ?? envelope.scheduledStart,
    scheduledEnd: draft.scheduledEnd ?? envelope.scheduledEnd,
    actualStart: shift.startedAt ?? envelope.actualStart,
    actualEnd: shift.endedAt ?? envelope.actualEnd,
    workedMinutes,
    paidBreakMinutes: shift.paidBreakHours == null ? null : Math.round(shift.paidBreakHours * 60),
    unpaidBreakMinutes: draft.unpaidBreakMinutes ?? envelope.unpaidBreakMinutes,
    approvalState: draft.approvalState ?? envelope.approvalState,
    scheduleDifferenceMinutes: workedMinutes - scheduledMinutes,
    cashTipsCents: reviewedNumber("cashTipsCents", shift.cashTipsCents),
    cardTipsCents: reviewedNumber("cardTipsCents", shift.ccTipsCents),
    salesCents: reviewedNumber("salesCents", shift.salesCents),
    salesByField: shift.salesByField ?? {},
    customersServed: reviewedNumber("customersServed", shift.customersServed),
    staffingCount: reviewedNumber("staffingCount", shift.staffingCount),
    grossWagesCents: shift.grossWagesCents ?? shift.wagesCents,
    netTipsCents: shift.netTipsCents,
    tipOutCents: (shift.immediateTipOutCents ?? 0) + (shift.withheldTipOutCents ?? 0) + (shift.deferredTipOutCents ?? 0),
    attendance: input.attendance,
    weather: draft.weather ?? null,
    weatherGlass: shift.weatherGlass ?? null,
    eventTag: shift.eventTag ?? null,
    contextFacts: draft.contextFacts ?? [],
    revisionHistory: [],
    authority: [
      ...envelope.authority,
      ...(draft.authority ?? []),
      { field: "confirmation", source: "manual", observedAt: input.createdAt, finality: "user_confirmed", presence: "present" },
    ],
    linkedShiftId: shift.id,
    commandConfirmationId: input.confirmationId,
    correctionOfBibleId: draft.correctionOfBibleId ?? null,
    correctedByBibleId: null,
    confirmedAt: input.createdAt,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  return { ...bibleWithoutHash, materialHash: shiftBibleMaterialHash(bibleWithoutHash) };
}

export function bibleForNonWorkOutcome(input: {
  id: string;
  envelope: ShiftEnvelope;
  outcome: Exclude<ShiftOutcome, "worked">;
  confirmationId: string;
  confirmedAt: string;
}): ShiftBible {
  const envelope = input.envelope;
  if (!envelope.jobId || !envelope.roleId) throw new Error("Outcome confirmation needs a mapped job and role.");
  const bibleWithoutHash: Omit<ShiftBible, "materialHash"> = {
    id: input.id,
    version: 1,
    revision: 1,
    environment: envelope.environment,
    householdId: envelope.householdId,
    memberId: envelope.memberId,
    envelopeId: envelope.id,
    outcome: input.outcome,
    jobId: envelope.jobId,
    roleId: envelope.roleId,
    locationName: envelope.locationName ?? "",
    timezone: envelope.timezone,
    scheduledStart: envelope.scheduledStart,
    scheduledEnd: envelope.scheduledEnd,
    actualStart: null,
    actualEnd: null,
    workedMinutes: null,
    paidBreakMinutes: null,
    unpaidBreakMinutes: null,
    approvalState: "user_confirmed",
    scheduleDifferenceMinutes: null,
    cashTipsCents: null,
    cardTipsCents: null,
    salesCents: null,
    salesByField: {},
    customersServed: null,
    staffingCount: null,
    grossWagesCents: null,
    netTipsCents: null,
    tipOutCents: null,
    attendance: [],
    weather: null,
    weatherGlass: null,
    eventTag: null,
    contextFacts: [],
    revisionHistory: [],
    authority: [...envelope.authority, { field: "outcome", source: "manual", observedAt: input.confirmedAt, finality: "user_confirmed", presence: "present" }],
    linkedShiftId: null,
    commandConfirmationId: input.confirmationId,
    correctionOfBibleId: null,
    correctedByBibleId: null,
    confirmedAt: input.confirmedAt,
    createdAt: input.confirmedAt,
    updatedAt: input.confirmedAt,
  };
  return { ...bibleWithoutHash, materialHash: shiftBibleMaterialHash(bibleWithoutHash) };
}

export function currentWorkedBibleForShift(shift: Shift): ShiftBible | null {
  return shift.shiftBible?.outcome === "worked" && !shift.shiftBible.correctedByBibleId ? shift.shiftBible : null;
}
