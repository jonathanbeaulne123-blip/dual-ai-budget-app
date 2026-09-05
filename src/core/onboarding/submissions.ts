import type { Household } from "../types.ts";
import { ValidationError } from "../types.ts";

export type SubmissionKind = "categories" | "estimates";

export type OnboardingSubmission = {
  id: string;
  householdId: string;
  memberId: string;
  kind: SubmissionKind;
  revision: number;
  categoryIds: string[];
  estimates: Array<{ subcategoryId: string; amountCents: number }>;
  submittedAt: string;
  supersededBy: string | null;
};

function cleanId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function normalizeSubmissionCategoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new ValidationError("Choose the categories to submit.");
  const ids = value.map(cleanId);
  if (ids.some((id) => id === null)) throw new ValidationError("Choose valid categories to submit.");
  return [...new Set(ids as string[])].sort((left, right) => left.localeCompare(right));
}

export function normalizeSubmissionEstimates(
  value: unknown,
): Array<{ subcategoryId: string; amountCents: number }> {
  if (!Array.isArray(value)) throw new ValidationError("Enter the estimates to submit.");
  const seen = new Set<string>();
  const rows = value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      throw new ValidationError("Enter valid category estimates.");
    }
    const row = candidate as { subcategoryId?: unknown; amountCents?: unknown };
    if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(["amountCents", "subcategoryId"])) {
      throw new ValidationError("Enter valid category estimates.");
    }
    const subcategoryId = cleanId(row.subcategoryId);
    if (!subcategoryId || !Number.isSafeInteger(row.amountCents) || Number(row.amountCents) < 0) {
      throw new ValidationError("Enter valid category estimates in whole cents.");
    }
    if (seen.has(subcategoryId)) throw new ValidationError("Enter each category estimate once.");
    seen.add(subcategoryId);
    return { subcategoryId, amountCents: Number(row.amountCents) };
  });
  return rows.sort((left, right) => left.subcategoryId.localeCompare(right.subcategoryId));
}

function shapeSubmission(value: unknown): OnboardingSubmission | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OnboardingSubmission>;
  const expectedKeys = [
    "categoryIds",
    "estimates",
    "householdId",
    "id",
    "kind",
    "memberId",
    "revision",
    "submittedAt",
    "supersededBy",
  ];
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(expectedKeys)) return null;
  const id = cleanId(row.id);
  const householdId = cleanId(row.householdId);
  const memberId = cleanId(row.memberId);
  const submittedAt = cleanIso(row.submittedAt);
  if (!id || !householdId || !memberId || !submittedAt) return null;
  if (row.kind !== "categories" && row.kind !== "estimates") return null;
  if (!Number.isSafeInteger(row.revision) || Number(row.revision) < 1) return null;
  if (row.supersededBy !== null && row.supersededBy !== undefined && !cleanId(row.supersededBy)) return null;
  if (row.kind === "categories" && (!Array.isArray(row.estimates) || row.estimates.length !== 0)) return null;
  if (row.kind === "estimates" && (!Array.isArray(row.categoryIds) || row.categoryIds.length !== 0)) return null;

  try {
    return {
      id,
      householdId,
      memberId,
      kind: row.kind,
      revision: Number(row.revision),
      categoryIds: row.kind === "categories" ? normalizeSubmissionCategoryIds(row.categoryIds) : [],
      estimates: row.kind === "estimates" ? normalizeSubmissionEstimates(row.estimates) : [],
      submittedAt,
      supersededBy: cleanId(row.supersededBy),
    };
  } catch {
    return null;
  }
}

function sameRecord(left: OnboardingSubmission, right: OnboardingSubmission): boolean {
  return JSON.stringify({ ...left, supersededBy: null }) === JSON.stringify({ ...right, supersededBy: null });
}

function mergedLink(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left.localeCompare(right) <= 0 ? left : right;
}

function submissionOrder(left: OnboardingSubmission, right: OnboardingSubmission): number {
  return left.memberId.localeCompare(right.memberId)
    || left.kind.localeCompare(right.kind)
    || left.revision - right.revision
    || left.submittedAt.localeCompare(right.submittedAt)
    || left.id.localeCompare(right.id);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalValue(nested)]),
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

export function shapeOnboardingSubmissions(value: unknown, householdId?: string): OnboardingSubmission[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, OnboardingSubmission>();
  for (const valueRow of value) {
    const row = shapeSubmission(valueRow);
    if (!row || (householdId && row.householdId !== householdId)) continue;
    const prior = byId.get(row.id);
    if (!prior) {
      byId.set(row.id, row);
    } else if (sameRecord(prior, row)) {
      byId.set(row.id, { ...prior, supersededBy: mergedLink(prior.supersededBy, row.supersededBy) });
    } else {
      throw new ValidationError("Conflicting onboarding submission history.");
    }
  }
  const shaped = [...byId.values()].sort(submissionOrder);
  assertOnboardingSubmissionHistory(shaped);
  return shaped;
}

export function currentSubmission(
  household: Pick<Household, "householdId" | "onboardingSubmissions">,
  memberId: string,
  kind: SubmissionKind,
): OnboardingSubmission | null {
  const rows = shapeOnboardingSubmissions(household.onboardingSubmissions, household.householdId)
    .filter((row) => row.memberId === memberId && row.kind === kind && row.supersededBy === null)
    .sort((left, right) => right.revision - left.revision
      || right.submittedAt.localeCompare(left.submittedAt)
      || right.id.localeCompare(left.id));
  return rows[0] ?? null;
}

export function mergedCategorySelection(
  household: Pick<Household, "householdId" | "members" | "onboardingSubmissions">,
): { unionIds: string[]; bySubmitter: Record<string, string[]> } {
  const bySubmitter: Record<string, string[]> = {};
  const union = new Set<string>();
  const memberIds = household.members
    .filter((member) => member.active)
    .map((member) => member.id)
    .sort((left, right) => left.localeCompare(right));
  for (const memberId of memberIds) {
    const row = currentSubmission(household, memberId, "categories");
    if (!row) continue;
    bySubmitter[memberId] = [...row.categoryIds];
    row.categoryIds.forEach((id) => union.add(id));
  }
  return { unionIds: [...union].sort((left, right) => left.localeCompare(right)), bySubmitter };
}

export function mergeSubmissions(server: unknown, client: unknown): OnboardingSubmission[] {
  const rows = [...shapeOnboardingSubmissions(server), ...shapeOnboardingSubmissions(client)].sort(submissionOrder);
  const byId = new Map<string, OnboardingSubmission>();
  for (const row of rows) {
    const prior = byId.get(row.id);
    if (!prior) {
      byId.set(row.id, row);
      continue;
    }
    if (!sameRecord(prior, row)) throw new ValidationError("Conflicting onboarding submission history.");
    byId.set(row.id, { ...prior, supersededBy: mergedLink(prior.supersededBy, row.supersededBy) });
  }
  const merged = [...byId.values()].sort(submissionOrder);
  assertOnboardingSubmissionHistory(merged);
  return merged;
}

export function assertOnboardingSubmissionHistory(rows: readonly OnboardingSubmission[]): void {
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const row of rows) {
    if (!row.supersededBy) continue;
    const successor = byId.get(row.supersededBy);
    if (!successor
      || successor.householdId !== row.householdId
      || successor.memberId !== row.memberId
      || successor.kind !== row.kind
      || successor.revision !== row.revision + 1) {
      throw new ValidationError("Conflicting onboarding submission history.");
    }
  }
}

export function assertOnboardingSubmissionTransition(
  previous: Household | null,
  next: Household,
  input: { actorMemberId?: string; commandKind?: string; postedIds: readonly string[] },
): void {
  const kind: SubmissionKind | null = input.commandKind === "submitOnboardingCategories"
    ? "categories"
    : input.commandKind === "submitOnboardingEstimates"
      ? "estimates"
      : null;
  const memberId = input.actorMemberId;
  if (!previous || !kind || !memberId
    || previous.householdId !== next.householdId
    || !previous.members.some((member) => member.active && member.id === memberId)) {
    throw new ValidationError("Only you can submit your own.");
  }

  const before = shapeOnboardingSubmissions(previous.onboardingSubmissions, previous.householdId);
  const after = shapeOnboardingSubmissions(next.onboardingSubmissions, next.householdId);
  const beforeIds = new Set(before.map((row) => row.id));
  const added = after.filter((row) => !beforeIds.has(row.id));
  const prior = currentSubmission(previous, memberId, kind);
  const expectedRevision = before
    .filter((row) => row.memberId === memberId && row.kind === kind)
    .reduce((highest, row) => Math.max(highest, row.revision), 0) + 1;
  const row = added[0];
  const expectedPosted = new Set(prior ? [prior.id, row?.id] : [row?.id]);
  const posted = new Set(input.postedIds);
  if (added.length !== 1 || !row
    || row.householdId !== previous.householdId
    || row.memberId !== memberId
    || row.kind !== kind
    || row.revision !== expectedRevision
    || row.supersededBy !== null
    || posted.size !== expectedPosted.size
    || [...expectedPosted].some((id) => !id || !posted.has(id))) {
    throw new ValidationError("Only you can submit your own.");
  }

  const afterById = new Map(after.map((candidate) => [candidate.id, candidate]));
  if (after.length !== before.length + 1 || before.some((beforeRow) => {
    const afterRow = afterById.get(beforeRow.id);
    if (!afterRow || !sameRecord(beforeRow, afterRow)) return true;
    const expectedLink = beforeRow.id === prior?.id ? row.id : beforeRow.supersededBy;
    return afterRow.supersededBy !== expectedLink;
  })) {
    throw new ValidationError("Only you can submit your own.");
  }


  const expectedActivityLength = Math.min(200, previous.activity.length + 1);
  const addedActivity = next.activity.at(-1);
  const retainedActivity = next.activity.slice(0, -1);
  const expectedRetainedActivity = retainedActivity.length
    ? previous.activity.slice(-retainedActivity.length)
    : [];
  if (next.activity.length !== expectedActivityLength
    || !addedActivity
    || addedActivity.action !== "Onboarding submission"
    || addedActivity.summary !== `${previous.members.find((member) => member.id === memberId)?.name} submitted ${kind}`
    || addedActivity.at !== next.lastCommittedAt
    || addedActivity.updatedAt !== next.lastCommittedAt
    || typeof next.lastCommittedAt !== "string"
    || Number.isNaN(Date.parse(next.lastCommittedAt))
    || JSON.stringify(retainedActivity) !== JSON.stringify(expectedRetainedActivity)) {
    throw new ValidationError("Only you can submit your own.");
  }

  const normalizedPrevious: Household = {
    ...previous,
    baseRevision: previous.baseRevision ?? 0,
    booksAcceptedHash: previous.booksAcceptedHash ?? null,
    commandReceipts: previous.commandReceipts ?? [],
    conflicts: previous.conflicts ?? [],
    sharing: previous.sharing ?? {
      mode: previous.linked ? "linked" : "local",
      linked: previous.linked,
      lastTransportAt: null,
      lastError: null,
      pending: false,
    },
  };
  const {
    onboardingSubmissions: _beforeRows,
    activity: _beforeActivity,
    lastCommittedAt: _beforeCommittedAt,
    ...beforeState
  } = normalizedPrevious;
  const {
    onboardingSubmissions: _afterRows,
    activity: _afterActivity,
    lastCommittedAt: _afterCommittedAt,
    ...afterState
  } = next;
  if (!sameValue(afterState, beforeState)) {
    throw new ValidationError("Only you can submit your own.");
  }
}
