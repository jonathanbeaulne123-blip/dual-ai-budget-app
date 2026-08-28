export type CoworkerSource = "seven-shifts-roster" | "seven-shifts-schedule" | "surprise-helper" | "manual";

export type CoworkerObservedRole = {
  label: string;
  firstObservedAt: string;
  lastObservedAt: string;
};

/** A member-owned workplace identity. This is never a Hearth household member. */
export type Coworker = {
  id: string;
  ownerMemberId: string;
  jobId: string;
  locationName: string;
  displayName: string;
  normalizedName: string;
  aliases: string[];
  observedRoles: CoworkerObservedRole[];
  source: CoworkerSource;
  /** Owner-private protected provider subject/canonical key. Never a raw provider id. */
  sourceIdentityKey?: string | null;
  active: boolean;
  provisional: boolean;
  mergedIntoCoworkerId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CoworkerAttendanceStatus =
  | "scheduled-assumed"
  | "user-confirmed-present"
  | "user-confirmed-absent"
  | "surprise-helper";

export type CoworkerAttendance = {
  id: string;
  ownerMemberId: string;
  jobId: string;
  shiftId: string;
  coworkerId: string;
  roleLabel: string;
  status: CoworkerAttendanceStatus;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CoworkerNameMatch =
  | { kind: "exact"; coworker: Coworker }
  | { kind: "suggested-last-name"; coworker: Coworker }
  | { kind: "ambiguous"; candidates: Coworker[] }
  | { kind: "none"; candidates: [] };

const VALID_SOURCE = new Set<CoworkerSource>(["seven-shifts-roster", "seven-shifts-schedule", "surprise-helper", "manual"]);
const VALID_ATTENDANCE = new Set<CoworkerAttendanceStatus>([
  "scheduled-assumed", "user-confirmed-present", "user-confirmed-absent", "surprise-helper",
]);

function text(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function iso(value: unknown, fallback: string): string {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function sourceIdentityKey(value: unknown): string | null {
  const shaped = text(value, 128);
  return /^s7subject_[A-Za-z0-9_-]{20,112}$/.test(shaped) ? shaped : null;
}

export function normalizeCoworkerName(value: unknown): string {
  return text(value, 80)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-CA")
    .replace(/[^a-z0-9' -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCoworkerLocation(value: unknown): string {
  return normalizeCoworkerName(value);
}

function shapeRoles(value: unknown, fallbackIso: string): CoworkerObservedRole[] {
  if (!Array.isArray(value)) return [];
  const roles = new Map<string, CoworkerObservedRole>();
  for (const candidate of value.slice(0, 64)) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Partial<CoworkerObservedRole>;
    const label = text(row.label, 80);
    const roleKey = normalizeCoworkerName(label);
    if (!roleKey) continue;
    const firstObservedAt = iso(row.firstObservedAt, fallbackIso);
    const lastObservedAt = iso(row.lastObservedAt, firstObservedAt);
    const existing = roles.get(roleKey);
    roles.set(roleKey, existing ? {
      label: existing.label,
      firstObservedAt: existing.firstObservedAt < firstObservedAt ? existing.firstObservedAt : firstObservedAt,
      lastObservedAt: existing.lastObservedAt > lastObservedAt ? existing.lastObservedAt : lastObservedAt,
    } : { label, firstObservedAt, lastObservedAt });
  }
  return [...roles.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export function shapeCoworker(value: unknown, fallbackIso: string): Coworker | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Coworker>;
  const id = text(row.id, 96);
  const ownerMemberId = text(row.ownerMemberId, 96);
  const jobId = text(row.jobId, 96);
  const locationName = text(row.locationName, 80);
  const displayName = text(row.displayName, 80);
  const normalizedName = normalizeCoworkerName(displayName);
  if (!id || !ownerMemberId || !jobId || !locationName || !displayName || !normalizedName) return null;
  const aliases = Array.isArray(row.aliases)
    ? [...new Set(row.aliases.map(normalizeCoworkerName).filter(Boolean))].slice(0, 32)
    : [];
  const createdAt = iso(row.createdAt, fallbackIso);
  return {
    id,
    ownerMemberId,
    jobId,
    locationName,
    displayName,
    normalizedName,
    aliases: [...new Set([normalizedName, ...aliases])],
    observedRoles: shapeRoles(row.observedRoles, createdAt),
    source: VALID_SOURCE.has(row.source as CoworkerSource) ? row.source as CoworkerSource : "manual",
    sourceIdentityKey: sourceIdentityKey(row.sourceIdentityKey),
    active: row.active !== false,
    provisional: row.provisional === true,
    mergedIntoCoworkerId: text(row.mergedIntoCoworkerId, 96) || null,
    createdAt,
    updatedAt: iso(row.updatedAt, createdAt),
  };
}

export function shapeCoworkers(value: unknown, fallbackIso: string, ownerMemberId?: string): Coworker[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, Coworker>();
  for (const candidate of value.slice(0, 5_000)) {
    const coworker = shapeCoworker(candidate, fallbackIso);
    if (!coworker || (ownerMemberId && coworker.ownerMemberId !== ownerMemberId)) continue;
    const existing = byId.get(coworker.id);
    if (!existing || coworker.updatedAt >= existing.updatedAt) byId.set(coworker.id, coworker);
  }
  return [...byId.values()].sort((left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id));
}

export function shapeCoworkerAttendance(value: unknown, fallbackIso: string, ownerMemberId?: string): CoworkerAttendance[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, CoworkerAttendance>();
  for (const candidate of value.slice(0, 20_000)) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Partial<CoworkerAttendance>;
    const id = text(row.id, 96);
    const owner = text(row.ownerMemberId, 96);
    const jobId = text(row.jobId, 96);
    const shiftId = text(row.shiftId, 96);
    const coworkerId = text(row.coworkerId, 96);
    if (!id || !owner || !jobId || !shiftId || !coworkerId || (ownerMemberId && owner !== ownerMemberId)) continue;
    const createdAt = iso(row.createdAt, fallbackIso);
    const shaped: CoworkerAttendance = {
      id,
      ownerMemberId: owner,
      jobId,
      shiftId,
      coworkerId,
      roleLabel: text(row.roleLabel, 80),
      status: VALID_ATTENDANCE.has(row.status as CoworkerAttendanceStatus) ? row.status as CoworkerAttendanceStatus : "scheduled-assumed",
      scheduledStart: row.scheduledStart ? iso(row.scheduledStart, createdAt) : null,
      scheduledEnd: row.scheduledEnd ? iso(row.scheduledEnd, createdAt) : null,
      createdAt,
      updatedAt: iso(row.updatedAt, createdAt),
    };
    const existing = byId.get(id);
    if (!existing || shaped.updatedAt >= existing.updatedAt) byId.set(id, shaped);
  }
  return [...byId.values()].sort((left, right) => left.shiftId.localeCompare(right.shiftId) || left.coworkerId.localeCompare(right.coworkerId));
}

export function matchCoworkerName(
  coworkers: Coworker[],
  inputName: unknown,
  scope: { ownerMemberId: string; jobId: string; locationName: string },
): CoworkerNameMatch {
  const normalized = normalizeCoworkerName(inputName);
  if (!normalized) return { kind: "none", candidates: [] };
  const location = normalizeCoworkerLocation(scope.locationName);
  const eligible = coworkers.filter((row) => row.active
    && !row.mergedIntoCoworkerId
    && row.ownerMemberId === scope.ownerMemberId
    && row.jobId === scope.jobId
    && normalizeCoworkerLocation(row.locationName) === location);
  const exact = eligible.filter((row) => row.normalizedName === normalized || row.aliases.includes(normalized));
  if (exact.length === 1) return { kind: "exact", coworker: exact[0]! };
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact };
  const last = normalized.split(" ").at(-1);
  const lastMatches = eligible.filter((row) => row.normalizedName.split(" ").at(-1) === last
    || row.aliases.some((alias) => alias.split(" ").at(-1) === last));
  if (lastMatches.length === 1) return { kind: "suggested-last-name", coworker: lastMatches[0]! };
  if (lastMatches.length > 1) return { kind: "ambiguous", candidates: lastMatches };
  return { kind: "none", candidates: [] };
}
