import type {
  CharterAmendment,
  CharterCeilingKind,
  CharterClause,
  CharterPermission,
  CharterSignature,
  CharterSplitRule,
  HouseholdCharter,
  HouseholdFundConfig,
  Member,
} from "./types.ts";

const EPOCH = "1970-01-01T00:00:00.000Z";
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const SPLIT_RULES = new Set<CharterSplitRule>(["even", "proportional", "remainder"]);
const CEILING_KINDS = new Set<CharterCeilingKind>(["hours-per-week", "amount-per-month", "none"]);
const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export type CharterHouseholdContext = {
  members: readonly Pick<Member, "id">[];
  householdFund?: Pick<HouseholdFundConfig, "custodianMemberId"> | null;
};

function isoOrFallback(value: unknown, fallback: string): string;
function isoOrFallback(value: unknown, fallback: null): string | null;
function isoOrFallback(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

function text(value: unknown, max?: number): string {
  const shaped = typeof value === "string" ? value.trim() : "";
  return max === undefined ? shaped : shaped.slice(0, max);
}

function nullableText(value: unknown): string | null {
  const shaped = text(value);
  return shaped || null;
}

function nonNegativeInteger(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function byId<T extends { id: string }>(left: T, right: T): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function shapeClauses(value: unknown): CharterClause[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<CharterClause>;
    const id = text(row.id);
    const heading = text(row.heading, 60);
    if (!id || !heading) return [];
    return [{ id, heading, body: text(row.body, 400) }];
  }).sort(byId);
}

function shapePermissions(value: unknown): CharterPermission[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<CharterPermission>;
    const id = text(row.id);
    const label = text(row.label, 90);
    const grantedByMemberId = text(row.grantedByMemberId);
    const actorMemberId = text(row.actorMemberId);
    if (!id || !label || !grantedByMemberId || !actorMemberId) return [];
    const revokedAt = row.revokedAt === null || row.revokedAt === undefined
      ? null
      : isoOrFallback(row.revokedAt, EPOCH);
    return [{
      id,
      label,
      grantedByMemberId,
      actorMemberId,
      revokedAt,
    }];
  }).sort(byId);
}

function shapeSignatures(value: unknown): CharterSignature[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<CharterSignature>;
    const memberId = text(row.memberId);
    if (!memberId) return [];
    return [{ memberId, signedAt: isoOrFallback(row.signedAt, null) }];
  }).sort((left, right) => left.memberId < right.memberId ? -1 : left.memberId > right.memberId ? 1 : 0);
}

function shapeAmendments(value: unknown): CharterAmendment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<CharterAmendment>;
    const id = text(row.id);
    const raisedByMemberId = text(row.raisedByMemberId);
    const field = text(row.field);
    if (!id || !raisedByMemberId || !field) return [];
    return [{
      id,
      raisedByMemberId,
      field,
      fromText: text(row.fromText),
      toText: text(row.toText),
      confirmedByMemberId: nullableText(row.confirmedByMemberId),
      heldByMemberId: nullableText(row.heldByMemberId),
      heldNote: text(row.heldNote),
      raisedAt: isoOrFallback(row.raisedAt, EPOCH),
      resolvedAt: isoOrFallback(row.resolvedAt, null),
    }];
  }).sort(byId);
}

export function shapeHouseholdCharter(
  value: unknown,
  context?: CharterHouseholdContext,
): HouseholdCharter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<HouseholdCharter>;
  const id = text(row.id);
  const custodianMemberId = text(row.custodianMemberId);
  const foundedOn = text(row.foundedOn);
  if (!id || !custodianMemberId || !DATE_KEY.test(foundedOn)) return null;
  if (!SPLIT_RULES.has(row.splitRule as CharterSplitRule)) return null;

  if (context) {
    const memberIds = new Set(context.members.map((member) => member.id));
    if (!memberIds.has(custodianMemberId)) return null;
    if (context.householdFund && context.householdFund.custodianMemberId !== custodianMemberId) return null;
  }

  const ceilingKind = CEILING_KINDS.has(row.ceilingKind as CharterCeilingKind)
    ? row.ceilingKind as CharterCeilingKind
    : "none";
  const createdAt = isoOrFallback(row.createdAt, EPOCH);
  const cadence = row.cadence === "weekly" || row.cadence === "biweekly" || row.cadence === "monthly"
    ? row.cadence
    : "none";

  return {
    id,
    purpose: text(row.purpose, 240),
    custodianMemberId,
    splitRule: row.splitRule as CharterSplitRule,
    splitNote: text(row.splitNote, 240),
    ceilingKind,
    ceilingValue: ceilingKind === "none" ? 0 : nonNegativeInteger(row.ceilingValue),
    cadence,
    cadenceWeekday: Number.isInteger(row.cadenceWeekday) && Number(row.cadenceWeekday) >= 0 && Number(row.cadenceWeekday) <= 6
      ? Number(row.cadenceWeekday)
      : 0,
    clauses: shapeClauses(row.clauses),
    permissions: shapePermissions(row.permissions),
    signatures: shapeSignatures(row.signatures),
    amendments: shapeAmendments(row.amendments),
    foundedOn: foundedOn as HouseholdCharter["foundedOn"],
    createdAt,
    updatedAt: isoOrFallback(row.updatedAt, createdAt),
  };
}

export function charterIsSigned(charter: HouseholdCharter): boolean {
  return charter.signatures.length > 0 && charter.signatures.every((signature) => signature.signedAt !== null);
}

export function charterUnsignedMemberIds(charter: HouseholdCharter): string[] {
  return charter.signatures
    .filter((signature) => signature.signedAt === null)
    .map((signature) => signature.memberId)
    .sort();
}

export function charterCeilingLabel(charter: HouseholdCharter): string {
  if (charter.ceilingKind === "none") return "no ceiling agreed";
  if (charter.ceilingKind === "amount-per-month") return `${CAD.format(charter.ceilingValue / 100)} a month`;
  const hours = charter.ceilingValue / 10;
  return `${hours.toLocaleString("en-CA", { maximumFractionDigits: 1 })} ${hours === 1 ? "hour" : "hours"} a week`;
}

export function charterActivePermissions(charter: HouseholdCharter): CharterPermission[] {
  return charter.permissions.filter((permission) => permission.revokedAt === null).sort(byId);
}
