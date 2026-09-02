import { dateKeyInZone, parseDateKey, TIMEZONE, weekBounds, type DateKey } from "./calendar.ts";
import { cloneHousehold } from "./household.ts";
import { nextId, nowIso } from "./ids.ts";
import type { CommitResult, Household, Member, WeeklyDocumentStamp } from "./types.ts";
import { ValidationError } from "./types.ts";

export type WeeklyDocumentStampLine = {
  memberId: string;
  memberName: string;
  stamp: WeeklyDocumentStamp | null;
};

function validIso(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function isWeekStart(value: DateKey): boolean {
  try {
    parseDateKey(value);
    return weekBounds(value).start === value;
  } catch {
    return false;
  }
}

/** Invalid legacy or injected rows are omitted; distinct ids remain additive. */
export function shapeWeeklyDocumentStamps(
  value: unknown,
  members?: readonly Pick<Member, "id" | "active">[],
): WeeklyDocumentStamp[] {
  if (!Array.isArray(value)) return [];
  const knownMemberIds = members
    ? new Set(members.map((member) => member.id))
    : null;
  const byId = new Map<string, WeeklyDocumentStamp>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<WeeklyDocumentStamp>;
    const stampedAt = validIso(row.stampedAt);
    const createdAt = validIso(row.createdAt);
    const updatedAt = validIso(row.updatedAt);
    if (!row.id?.startsWith("WSTAMP-")
      || !row.memberId
      || !row.weekStart
      || !isWeekStart(row.weekStart)
      || !stampedAt
      || !createdAt
      || !updatedAt
      || (knownMemberIds && !knownMemberIds.has(row.memberId))) continue;
    const shaped: WeeklyDocumentStamp = {
      id: row.id,
      weekStart: row.weekStart,
      memberId: row.memberId,
      stampedAt,
      createdAt,
      updatedAt,
    };
    const existing = byId.get(shaped.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(shaped)) {
      throw new ValidationError("A weekly stamp changed after it was accepted.");
    }
    byId.set(shaped.id, shaped);
  }
  return [...byId.values()].sort((left, right) => (
    left.weekStart.localeCompare(right.weekStart)
    || left.stampedAt.localeCompare(right.stampedAt)
    || left.memberId.localeCompare(right.memberId)
    || left.id.localeCompare(right.id)
  ));
}

/** Merge append-only facts without allowing one device to overwrite another id. */
export function mergeWeeklyDocumentStamps(
  left: unknown,
  right: unknown,
  members?: readonly Pick<Member, "id" | "active">[],
): WeeklyDocumentStamp[] {
  const rows = new Map<string, WeeklyDocumentStamp>();
  for (const stamp of [
    ...shapeWeeklyDocumentStamps(left, members),
    ...shapeWeeklyDocumentStamps(right, members),
  ]) {
    const existing = rows.get(stamp.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(stamp)) {
      throw new ValidationError("A weekly stamp changed after it was accepted.");
    }
    rows.set(stamp.id, stamp);
  }
  return shapeWeeklyDocumentStamps([...rows.values()], members);
}

export function weeklyDocumentStampsForWeek(
  household: Pick<Household, "weeklyDocumentStamps" | "members">,
  today: DateKey,
): WeeklyDocumentStamp[] {
  const weekStart = weekBounds(today).start;
  return shapeWeeklyDocumentStamps(household.weeklyDocumentStamps, household.members)
    .filter((stamp) => stamp.weekStart === weekStart);
}

/** Every active member gets a quiet line. Concurrent same-member facts choose the earliest stamp. */
export function weeklyDocumentStampLines(
  household: Pick<Household, "weeklyDocumentStamps" | "members">,
  today: DateKey,
): WeeklyDocumentStampLine[] {
  const stamps = weeklyDocumentStampsForWeek(household, today);
  return household.members.filter((member) => member.active).map((member) => ({
    memberId: member.id,
    memberName: member.name,
    stamp: stamps.find((stamp) => stamp.memberId === member.id) ?? null,
  }));
}

/** One member acknowledgement completes the weekly; the other line may stay blank. */
export function weeklyDocumentIsComplete(
  household: Pick<Household, "weeklyDocumentStamps" | "members">,
  today: DateKey,
): boolean {
  return weeklyDocumentStampsForWeek(household, today).length > 0;
}

export function stampWeeklyDocument(household: Household, input: {
  memberId: string;
  today: DateKey;
  now?: string;
}): CommitResult {
  parseDateKey(input.today);
  const member = household.members.find((row) => row.id === input.memberId && row.active);
  if (!member) throw new ValidationError("That active household member is not available.");
  const at = input.now ? validIso(input.now) : nowIso();
  if (!at) throw new ValidationError("Stamp time must be an ISO timestamp.");
  if (dateKeyInZone(new Date(at), TIMEZONE) !== input.today) {
    throw new ValidationError("The weekly page must be stamped on today's Toronto date.");
  }
  const weekStart = weekBounds(input.today).start;
  const stamps = shapeWeeklyDocumentStamps(household.weeklyDocumentStamps, household.members);
  if (stamps.some((stamp) => stamp.weekStart === weekStart && stamp.memberId === member.id)) {
    throw new ValidationError("You already stamped this weekly page.");
  }
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const stamp: WeeklyDocumentStamp = {
    id: nextId("WSTAMP-", stamps.map((row) => row.id)),
    weekStart,
    memberId: member.id,
    stampedAt: at,
    createdAt: at,
    updatedAt: at,
  };
  next.weeklyDocumentStamps = [...stamps, stamp];
  next.lastCommittedAt = at;
  return {
    household: next,
    warnings: [],
    postedIds: [stamp.id],
    undo: {
      id: nextId("UNDO-WEEKLY-STAMP-", []),
      label: `Stamped the weekly page for ${member.name}`,
      snapshot: previous,
      postedIds: [stamp.id],
      commandKind: "stampWeeklyDocument",
    },
  };
}
