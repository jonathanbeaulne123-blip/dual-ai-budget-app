import type { Household } from "../types.ts";
import { ValidationError } from "../types.ts";

export type OnboardingApprovalScope = "proposal" | "ready";

export type OnboardingApproval = {
  id: string;
  householdId: string;
  memberId: string;
  scope: OnboardingApprovalScope;
  digest: string;
  approvedAt: string;
};

export const OWN_ONBOARDING_APPROVAL_COPY = "Only you can approve for yourself.";

function cleanId(value: unknown): string | null {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 160
    ? value
    : null;
}

function cleanDigest(value: unknown): string | null {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= 256
    && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function cleanIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function normalizeOnboardingApprovalDigest(value: unknown): string {
  const digest = cleanDigest(value);
  if (!digest) throw new ValidationError("Review the current version before approving it.");
  return digest;
}

function shapeApproval(value: unknown): OnboardingApproval | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OnboardingApproval>;
  const expectedKeys = ["approvedAt", "digest", "householdId", "id", "memberId", "scope"];
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(expectedKeys)) return null;
  const id = cleanId(row.id);
  const householdId = cleanId(row.householdId);
  const memberId = cleanId(row.memberId);
  const digest = cleanDigest(row.digest);
  const approvedAt = cleanIso(row.approvedAt);
  if (!id || !householdId || !memberId || !digest || !approvedAt) return null;
  if (row.scope !== "proposal" && row.scope !== "ready") return null;
  return { id, householdId, memberId, scope: row.scope, digest, approvedAt };
}

function approvalOrder(left: OnboardingApproval, right: OnboardingApproval): number {
  return left.scope.localeCompare(right.scope)
    || left.digest.localeCompare(right.digest)
    || left.memberId.localeCompare(right.memberId)
    || left.approvedAt.localeCompare(right.approvedAt)
    || left.id.localeCompare(right.id);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index]));
  }
  if (!left || typeof left !== "object" || !right || typeof right !== "object") return left === right;
  const leftEntries = Object.entries(left as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return leftEntries.length === rightEntries.length
    && leftEntries.every(([key, value], index) => (
      key === rightEntries[index]?.[0] && sameValue(value, rightEntries[index]?.[1])
    ));
}

export function shapeOnboardingApprovals(value: unknown, householdId?: string): OnboardingApproval[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, OnboardingApproval>();
  for (const candidate of value) {
    const row = shapeApproval(candidate);
    if (!row || (householdId && row.householdId !== householdId)) continue;
    const prior = byId.get(row.id);
    if (prior && !sameValue(prior, row)) {
      throw new ValidationError("Conflicting onboarding approval history.");
    }
    byId.set(row.id, row);
  }
  return [...byId.values()].sort(approvalOrder);
}

export function mergeOnboardingApprovals(server: unknown, client: unknown): OnboardingApproval[] {
  return shapeOnboardingApprovals([
    ...shapeOnboardingApprovals(server),
    ...shapeOnboardingApprovals(client),
  ]);
}

export function approvalsFor(
  household: Pick<Household, "householdId" | "members" | "onboardingApprovals">,
  scope: OnboardingApprovalScope,
  digest: string,
): OnboardingApproval[] {
  const normalizedDigest = cleanDigest(digest);
  if (!normalizedDigest || (scope !== "proposal" && scope !== "ready")) return [];
  const active = new Set(household.members.filter((member) => member.active).map((member) => member.id));
  return shapeOnboardingApprovals(household.onboardingApprovals, household.householdId)
    .filter((row) => row.scope === scope && row.digest === normalizedDigest && active.has(row.memberId));
}

export function bothApproved(
  household: Pick<Household, "householdId" | "members" | "onboardingApprovals">,
  scope: OnboardingApprovalScope,
  digest: string,
): boolean {
  const activeMemberIds = [...new Set(household.members
    .filter((member) => member.active)
    .map((member) => member.id))].sort((left, right) => left.localeCompare(right));
  if (activeMemberIds.length !== 2) return false;
  const approved = new Set(approvalsFor(household, scope, digest).map((row) => row.memberId));
  return activeMemberIds.every((memberId) => approved.has(memberId));
}

export function onboardingApprovalSummary(memberName: string, scope: OnboardingApprovalScope): string {
  return `${memberName} approved ${scope === "proposal" ? "the first-plan proposal" : "onboarding readiness"}`;
}

export function assertOnboardingApprovalTransition(
  previous: Household | null,
  next: Household,
  input: { actorMemberId?: string; commandKind?: string; postedIds: readonly string[] },
): void {
  const scope: OnboardingApprovalScope | null = input.commandKind === "approveOnboardingProposal"
    ? "proposal"
    : input.commandKind === "approveOnboardingReady"
      ? "ready"
      : null;
  const memberId = input.actorMemberId;
  const member = previous?.members.find((candidate) => candidate.active && candidate.id === memberId);
  if (!previous || !scope || !memberId || !member || previous.householdId !== next.householdId) {
    throw new ValidationError(OWN_ONBOARDING_APPROVAL_COPY);
  }

  const before = shapeOnboardingApprovals(previous.onboardingApprovals, previous.householdId);
  const after = shapeOnboardingApprovals(next.onboardingApprovals, next.householdId);
  const rawAfter = next.onboardingApprovals;
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const afterById = new Map(after.map((row) => [row.id, row]));
  const added = after.filter((row) => !beforeById.has(row.id));
  const row = added[0];
  const posted = new Set(input.postedIds);
  if (!Array.isArray(rawAfter)
    || rawAfter.length !== after.length
    || after.length !== before.length + 1
    || added.length !== 1
    || !row
    || row.householdId !== previous.householdId
    || row.memberId !== memberId
    || row.scope !== scope
    || !cleanDigest(row.digest)
    || input.postedIds.length !== 1
    || input.postedIds[0] !== row.id
    || posted.size !== 1
    || !posted.has(row.id)
    || before.some((prior) => !sameValue(prior, afterById.get(prior.id)))) {
    throw new ValidationError(OWN_ONBOARDING_APPROVAL_COPY);
  }

  const expectedActivityLength = Math.min(200, previous.activity.length + 1);
  const addedActivity = next.activity.at(-1);
  const retainedActivity = next.activity.slice(0, -1);
  const expectedRetainedActivity = retainedActivity.length
    ? previous.activity.slice(-retainedActivity.length)
    : [];
  const expectedActivityKeys = ["action", "at", "id", "summary", "updatedAt"];
  if (next.activity.length !== expectedActivityLength
    || !addedActivity
    || JSON.stringify(Object.keys(addedActivity).sort()) !== JSON.stringify(expectedActivityKeys)
    || !cleanId(addedActivity.id)
    || previous.activity.some((activity) => activity.id === addedActivity.id)
    || addedActivity.action !== "Onboarding approval"
    || addedActivity.summary !== onboardingApprovalSummary(member.name, scope)
    || addedActivity.at !== next.lastCommittedAt
    || addedActivity.updatedAt !== next.lastCommittedAt
    || typeof next.lastCommittedAt !== "string"
    || Number.isNaN(Date.parse(next.lastCommittedAt))
    || !sameValue(retainedActivity, expectedRetainedActivity)) {
    throw new ValidationError(OWN_ONBOARDING_APPROVAL_COPY);
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
    onboardingApprovals: _beforeApprovals,
    activity: _beforeActivity,
    lastCommittedAt: _beforeCommittedAt,
    ...beforeState
  } = normalizedPrevious;
  const {
    onboardingApprovals: _afterApprovals,
    activity: _afterActivity,
    lastCommittedAt: _afterCommittedAt,
    ...afterState
  } = next;
  if (!sameValue(afterState, beforeState)) {
    throw new ValidationError(OWN_ONBOARDING_APPROVAL_COPY);
  }
}
