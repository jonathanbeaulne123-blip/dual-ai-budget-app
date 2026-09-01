import type {
  CharterAmendment,
  CharterCeilingChange,
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

function shapeSignatures(
  value: unknown,
  requiredMemberIds?: readonly string[],
): CharterSignature[] {
  const allowedMemberIds = requiredMemberIds
    ? new Set(requiredMemberIds.filter(Boolean))
    : null;
  const signatures = new Map<string, CharterSignature>();
  const duplicates = new Set<string>();
  if (Array.isArray(value)) value.forEach((raw) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Partial<CharterSignature>;
    const memberId = text(row.memberId);
    if (!memberId || (allowedMemberIds && !allowedMemberIds.has(memberId))) return;
    if (signatures.has(memberId)) duplicates.add(memberId);
    else signatures.set(memberId, { memberId, signedAt: isoOrFallback(row.signedAt, null) });
  });
  duplicates.forEach((memberId) => signatures.set(memberId, { memberId, signedAt: null }));

  const memberIds = allowedMemberIds
    ? [...allowedMemberIds]
    : [...signatures.keys()];
  return memberIds
    .sort()
    .map((memberId) => signatures.get(memberId) ?? { memberId, signedAt: null });
}

function shapeAmendments(value: unknown, requiredMemberIds?: readonly string[]): CharterAmendment[] {
  if (!Array.isArray(value)) return [];
  const allowedMemberIds = requiredMemberIds
    ? new Set(requiredMemberIds.filter(Boolean))
    : null;
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<CharterAmendment>;
    const id = text(row.id);
    const raisedByMemberId = text(row.raisedByMemberId);
    const field = text(row.field);
    if (!id || !raisedByMemberId || !field || (allowedMemberIds && !allowedMemberIds.has(raisedByMemberId))) return [];
    const proposedConfirmer = nullableText(row.confirmedByMemberId);
    const confirmedByMemberId = proposedConfirmer
      && proposedConfirmer !== raisedByMemberId
      && (!allowedMemberIds || allowedMemberIds.has(proposedConfirmer))
      ? proposedConfirmer
      : null;
    const proposedHolder = nullableText(row.heldByMemberId);
    const heldByMemberId = proposedHolder && (!allowedMemberIds || allowedMemberIds.has(proposedHolder))
      ? proposedHolder
      : null;
    const ceilingChange = shapeCeilingChange(row.ceilingChange);
    return [{
      id,
      raisedByMemberId,
      field,
      fromText: text(row.fromText, 240),
      toText: text(row.toText, 240),
      confirmedByMemberId,
      heldByMemberId,
      heldNote: heldByMemberId ? text(row.heldNote, 240) : "",
      raisedAt: isoOrFallback(row.raisedAt, EPOCH),
      resolvedAt: confirmedByMemberId ? isoOrFallback(row.resolvedAt, null) : null,
      ceilingChange,
    }];
  }).sort(byId);
}

function shapeCeilingChange(value: unknown): CharterCeilingChange | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CharterCeilingChange>;
  if (!CEILING_KINDS.has(row.kind as CharterCeilingKind)) return null;
  const kind = row.kind as CharterCeilingKind;
  if (kind === "none") return { kind, value: 0 };
  const shapedValue = nonNegativeInteger(row.value);
  return shapedValue > 0 ? { kind, value: shapedValue } : null;
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
  const termsUpdatedAt = isoOrFallback(row.termsUpdatedAt, createdAt);
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
    signatures: shapeSignatures(row.signatures, context?.members.map((member) => member.id)),
    amendments: shapeAmendments(row.amendments, context?.members.map((member) => member.id)),
    foundedOn: foundedOn as HouseholdCharter["foundedOn"],
    createdAt,
    termsUpdatedAt,
    updatedAt: isoOrFallback(row.updatedAt, createdAt),
  };
}

function latestIso(values: Array<string | null | undefined>, fallback: string): string {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? fallback;
}

function earliestIso(values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

function charterTermsKey(charter: HouseholdCharter): string {
  return JSON.stringify([
    charter.purpose,
    charter.custodianMemberId,
    charter.splitRule,
    charter.splitNote,
    charter.ceilingKind,
    charter.ceilingValue,
    charter.cadence,
    charter.cadenceWeekday,
    charter.clauses,
  ]);
}

function chooseTerms(left: HouseholdCharter, right: HouseholdCharter): HouseholdCharter {
  if (left.termsUpdatedAt !== right.termsUpdatedAt) {
    return left.termsUpdatedAt > right.termsUpdatedAt ? left : right;
  }
  return charterTermsKey(left) >= charterTermsKey(right) ? left : right;
}

function mergeSignatures(left: HouseholdCharter, right: HouseholdCharter): CharterSignature[] {
  const rows = new Map<string, CharterSignature>();
  for (const signature of [...left.signatures, ...right.signatures]) {
    const existing = rows.get(signature.memberId);
    if (!existing) {
      rows.set(signature.memberId, signature);
      continue;
    }
    rows.set(signature.memberId, {
      memberId: signature.memberId,
      signedAt: earliestIso([existing.signedAt, signature.signedAt]),
    });
  }
  return [...rows.values()].sort((a, b) => a.memberId.localeCompare(b.memberId));
}

function permissionIdentity(permission: CharterPermission): string {
  return JSON.stringify([
    permission.label,
    permission.grantedByMemberId,
    permission.actorMemberId,
  ]);
}

function collisionId(id: string, identity: string): string {
  const encodedIdentity = [...new TextEncoder().encode(identity)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${id}~conflict-${encodedIdentity}`;
}

function mergedPermissionState(left: CharterPermission, right: CharterPermission): CharterPermission {
  return {
    ...left,
    revokedAt: earliestIso([left.revokedAt, right.revokedAt]),
  };
}

function insertPermission(rows: Map<string, CharterPermission>, initial: CharterPermission): void {
  let permission = initial;
  while (true) {
    const existing = rows.get(permission.id);
    if (!existing) {
      rows.set(permission.id, permission);
      return;
    }
    const existingIdentity = permissionIdentity(existing);
    const incomingIdentity = permissionIdentity(permission);
    if (existingIdentity === incomingIdentity) {
      rows.set(permission.id, mergedPermissionState(existing, permission));
      return;
    }

    const winner = existingIdentity >= incomingIdentity ? existing : permission;
    const loser = winner === existing ? permission : existing;
    rows.set(permission.id, { ...winner, id: permission.id });
    permission = { ...loser, id: collisionId(permission.id, permissionIdentity(loser)) };
  }
}

function mergePermissions(left: HouseholdCharter, right: HouseholdCharter): CharterPermission[] {
  const rows = new Map<string, CharterPermission>();
  for (const permission of [...left.permissions, ...right.permissions]) {
    insertPermission(rows, permission);
  }
  return [...rows.values()].sort(byId);
}

function amendmentIdentity(amendment: CharterAmendment): string {
  return JSON.stringify([
    amendment.raisedByMemberId,
    amendment.field,
    amendment.fromText,
    amendment.toText,
    amendment.raisedAt,
    amendment.ceilingChange,
  ]);
}

function mergedAmendmentState(left: CharterAmendment, right: CharterAmendment): CharterAmendment {
  const held = [left, right]
    .filter((row) => row.heldByMemberId)
    .sort((a, b) => `${a.heldByMemberId}\u0000${a.heldNote}`.localeCompare(`${b.heldByMemberId}\u0000${b.heldNote}`))
    .at(-1);
  return {
    ...left,
    confirmedByMemberId: [left.confirmedByMemberId, right.confirmedByMemberId]
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null,
    heldByMemberId: held?.heldByMemberId ?? null,
    heldNote: held?.heldNote ?? "",
    resolvedAt: earliestIso([left.resolvedAt, right.resolvedAt]),
  };
}

function insertAmendment(rows: Map<string, CharterAmendment>, initial: CharterAmendment): void {
  let amendment = initial;
  while (true) {
    const existing = rows.get(amendment.id);
    if (!existing) {
      rows.set(amendment.id, amendment);
      return;
    }
    const existingIdentity = amendmentIdentity(existing);
    const incomingIdentity = amendmentIdentity(amendment);
    if (existingIdentity === incomingIdentity) {
      rows.set(amendment.id, mergedAmendmentState(existing, amendment));
      return;
    }

    const winner = existingIdentity >= incomingIdentity ? existing : amendment;
    const loser = winner === existing ? amendment : existing;
    rows.set(amendment.id, { ...winner, id: amendment.id });
    amendment = { ...loser, id: collisionId(amendment.id, amendmentIdentity(loser)) };
  }
}

function mergeAmendments(left: HouseholdCharter, right: HouseholdCharter): CharterAmendment[] {
  const rows = new Map<string, CharterAmendment>();
  for (const amendment of [...left.amendments, ...right.amendments]) {
    insertAmendment(rows, amendment);
  }
  return [...rows.values()].sort(byId);
}

function applyResolvedAmendments(
  charter: HouseholdCharter,
  amendments: CharterAmendment[],
  memberIds: readonly string[],
): HouseholdCharter {
  const validMemberIds = new Set(memberIds);
  return amendments
    .filter((amendment) => amendment.confirmedByMemberId && amendment.resolvedAt)
    .sort((left, right) => left.resolvedAt!.localeCompare(right.resolvedAt!) || left.id.localeCompare(right.id))
    .reduce((next, amendment) => {
      switch (amendment.field) {
        case "purpose": return { ...next, purpose: amendment.toText.slice(0, 240) };
        case "custodianMemberId": return validMemberIds.has(amendment.toText)
          ? { ...next, custodianMemberId: amendment.toText }
          : next;
        case "splitRule": return SPLIT_RULES.has(amendment.toText as CharterSplitRule)
          ? { ...next, splitRule: amendment.toText as CharterSplitRule }
          : next;
        case "splitNote": return { ...next, splitNote: amendment.toText.slice(0, 240) };
        case "ceiling": return amendment.ceilingChange
          ? { ...next, ceilingKind: amendment.ceilingChange.kind, ceilingValue: amendment.ceilingChange.value }
          : next;
        // Legacy separate-unit rows are not replayed across replicas because their value has no bound unit.
        // The term winner still retains an already-applied legacy change; all new ceiling motions use `ceiling`.
        case "ceilingKind": return amendment.toText === "none" ? { ...next, ceilingKind: "none", ceilingValue: 0 } : next;
        case "ceilingValue": return next;
        case "cadence": return amendment.toText === "weekly" || amendment.toText === "biweekly"
          || amendment.toText === "monthly" || amendment.toText === "none"
          ? {
            ...next,
            cadence: amendment.toText,
            ...(amendment.toText === "none" || amendment.toText === "monthly" ? { cadenceWeekday: 0 } : {}),
          }
          : next;
        case "cadenceWeekday": {
          const weekday = Number(amendment.toText);
          return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
            ? { ...next, cadenceWeekday: weekday }
            : next;
        }
        default: return next;
      }
    }, charter);
}

/** Merge one Charter's independent subrecords without letting routine activity overwrite its terms. */
export function mergeHouseholdCharters(
  leftValue: unknown,
  rightValue: unknown,
  context: CharterHouseholdContext,
): HouseholdCharter | null {
  const memberContext = { members: context.members, householdFund: null };
  const left = shapeHouseholdCharter(leftValue, memberContext);
  const right = shapeHouseholdCharter(rightValue, memberContext);
  if (!left && !right) return null;
  if (!left || !right || left.id !== right.id) {
    const candidate = !left ? right : !right ? left : chooseTerms(left, right);
    if (!candidate) return null;
    const withFundCustody = context.householdFund
      ? { ...candidate, custodianMemberId: context.householdFund.custodianMemberId }
      : candidate;
    return shapeHouseholdCharter(withFundCustody, context);
  }

  const terms = chooseTerms(left, right);
  const amendments = mergeAmendments(left, right);
  const resolved = applyResolvedAmendments({
    ...terms,
    signatures: mergeSignatures(left, right),
    permissions: mergePermissions(left, right),
    amendments,
    termsUpdatedAt: latestIso([
      left.termsUpdatedAt,
      right.termsUpdatedAt,
      ...amendments.map((amendment) => amendment.resolvedAt),
    ], terms.termsUpdatedAt),
    updatedAt: latestIso([left.updatedAt, right.updatedAt], terms.updatedAt),
  }, amendments, context.members.map((member) => member.id));
  const withFundCustody = context.householdFund
    ? { ...resolved, custodianMemberId: context.householdFund.custodianMemberId }
    : resolved;
  return shapeHouseholdCharter(withFundCustody, context);
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
