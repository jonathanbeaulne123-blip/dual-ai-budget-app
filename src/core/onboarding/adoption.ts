import { parseMonthKey, todayKey, type DateKey, type MonthKey } from "../calendar.ts";
import type { BudgetPlan, Household } from "../types.ts";
import { ValidationError } from "../types.ts";
import { approvalsFor, bothApproved } from "./approvals.ts";
import { onboardingIsActive } from "./mode.ts";
import { buildProposal, type BudgetProposal } from "./proposal.ts";

export const ONBOARDING_ADOPTION_COMMAND_KIND = "adoptFirstBudget";
export const ONBOARDING_ADOPTION_PREFIX = "ONB-ADOPT-";
export const ONBOARDING_PLAN_APPROVAL_PREFIX = "ONB-APP-PLAN-";

const SHA256_WORDS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85,
  0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1,
  0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
  0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee,
  0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

export function adoptionSha256(value: string): string {
  const source = new TextEncoder().encode(value);
  const byteLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(byteLength);
  bytes.set(source);
  bytes[source.length] = 0x80;
  const bitLength = source.length * 8;
  const view = new DataView(bytes.buffer);
  view.setUint32(byteLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(byteLength - 4, bitLength >>> 0);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) schedule[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const before15 = schedule[index - 15]!;
      const before2 = schedule[index - 2]!;
      const small0 = rotateRight(before15, 7) ^ rotateRight(before15, 18) ^ (before15 >>> 3);
      const small1 = rotateRight(before2, 17) ^ rotateRight(before2, 19) ^ (before2 >>> 10);
      schedule[index] = (schedule[index - 16]! + small0 + schedule[index - 7]! + small1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const large1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choose = (e! & f!) ^ (~e! & g!);
      const first = (h! + large1 + choose + SHA256_WORDS[index]! + schedule[index]!) >>> 0;
      const large0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const second = (large0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d! + first) >>> 0; d = c; c = b; b = a; a = (first + second) >>> 0;
    }
    state[0] = (state[0]! + a!) >>> 0;
    state[1] = (state[1]! + b!) >>> 0;
    state[2] = (state[2]! + c!) >>> 0;
    state[3] = (state[3]! + d!) >>> 0;
    state[4] = (state[4]! + e!) >>> 0;
    state[5] = (state[5]! + f!) >>> 0;
    state[6] = (state[6]! + g!) >>> 0;
    state[7] = (state[7]! + h!) >>> 0;
  }
  return [...state].map((word) => word.toString(16).padStart(8, "0")).join("");
}

export function onboardingPlanApprovalPrefix(household: Pick<Household, "budgetPlans">): string {
  const plans = [...household.budgetPlans]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((plan) => ({
      id: plan.id,
      monthKey: plan.monthKey,
      subcategoryId: plan.subcategoryId,
      amountCents: plan.amountCents,
      essential: plan.essential,
      incomeStability: plan.incomeStability,
      active: plan.active,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));
  return `${ONBOARDING_PLAN_APPROVAL_PREFIX}${adoptionSha256(JSON.stringify(plans))}-`;
}

export type OnboardingAdoptionInput = {
  memberId: string;
  createdBy: string;
  monthKey: MonthKey;
  proposalDigest: string;
};

export type OnboardingAdoptionIdentity = {
  monthKey: MonthKey;
  proposalDigest: string;
};

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

function exactDigest(value: unknown): string {
  if (typeof value !== "string" || !/^proposal-v\d+-[a-f0-9]{64}$/.test(value)) {
    throw new ValidationError("Review the current first-plan proposal before adopting it.");
  }
  return value;
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && Boolean(value) && !Number.isNaN(Date.parse(value));
}

export function onboardingAdoptionIdentity(monthKey: MonthKey, proposalDigest: string): string {
  parseMonthKey(monthKey);
  return `${ONBOARDING_ADOPTION_PREFIX}${monthKey}-${exactDigest(proposalDigest)}`;
}

export function onboardingAdoptionPlanId(
  monthKey: MonthKey,
  proposalDigest: string,
  rowIndex: number,
): string {
  parseMonthKey(monthKey);
  const exact = exactDigest(proposalDigest);
  const digest = exact.slice(exact.lastIndexOf("-") + 1);
  if (!Number.isSafeInteger(rowIndex) || rowIndex < 0 || rowIndex > 999) {
    throw new ValidationError("The first plan has too many category rows.");
  }
  return `BUD-${monthKey.replace("-", "")}-ONB-${digest}-${String(rowIndex + 1).padStart(3, "0")}`;
}

function currentApprovalRows(
  household: Household,
  proposalDigest: string,
  requiredIdPrefix?: string,
) {
  const digest = exactDigest(proposalDigest);
  const activeMemberIds = [...new Set(household.members
    .filter((member) => member.active)
    .map((member) => member.id))].sort((left, right) => left.localeCompare(right));
  const approvals = approvalsFor(household, "proposal", digest);
  const latestByMember = activeMemberIds.map((memberId) => approvals
    .filter((row) => row.memberId === memberId && (!requiredIdPrefix || row.id.startsWith(requiredIdPrefix)))
    .sort((left, right) => right.approvedAt.localeCompare(left.approvedAt) || right.id.localeCompare(left.id))[0]);
  if (activeMemberIds.length !== 2 || latestByMember.some((row) => !row)) {
    throw new ValidationError(requiredIdPrefix
      ? "The current plan changed after an approval. Both members must review and approve it again."
      : "Both household members must approve this exact first-plan proposal.");
  }
  return latestByMember.map((row) => row!);
}

export function onboardingAdoptionApprovedAt(
  household: Household,
  proposalDigest: string,
  monthKey?: MonthKey,
): string {
  const targetHasPlans = Boolean(monthKey && household.budgetPlans.some(
    (plan) => plan.active && plan.monthKey === monthKey,
  ));
  const approvals = currentApprovalRows(
    household,
    proposalDigest,
    targetHasPlans ? onboardingPlanApprovalPrefix(household) : undefined,
  );
  return approvals.map((row) => row.approvedAt).sort().at(-1)!;
}

export function parseOnboardingAdoptionIdentity(value: unknown): OnboardingAdoptionIdentity | null {
  if (typeof value !== "string" || !value.startsWith(ONBOARDING_ADOPTION_PREFIX)) return null;
  const suffix = value.slice(ONBOARDING_ADOPTION_PREFIX.length);
  const monthKey = suffix.slice(0, 7) as MonthKey;
  if (suffix[7] !== "-") return null;
  const proposalDigest = suffix.slice(8);
  try {
    parseMonthKey(monthKey);
    exactDigest(proposalDigest);
    return { monthKey, proposalDigest };
  } catch {
    return null;
  }
}

export function currentOnboardingAdoptionProposal(
  household: Household,
  input: OnboardingAdoptionInput,
  observedOn: DateKey = todayKey(),
): BudgetProposal {
  parseMonthKey(input.monthKey);
  const digest = exactDigest(input.proposalDigest);
  const member = household.members.find((candidate) => candidate.active && candidate.id === input.memberId);
  const actor = household.members.find((candidate) => candidate.active && candidate.id === input.createdBy);
  if (!member || !actor || member.id !== actor.id) {
    throw new ValidationError("Only an active household member can adopt the first plan.");
  }
  if (!onboardingIsActive(household)) {
    throw new ValidationError("Resume household setup together before adopting the first plan.");
  }
  const proposal = buildProposal(household, input.monthKey, observedOn);
  if (proposal.monthKey !== input.monthKey || proposal.sourceDigest !== digest) {
    throw new ValidationError("The first-plan proposal changed. Review and approve the current version.");
  }
  if (!bothApproved(household, "proposal", digest)) {
    throw new ValidationError("Both household members must approve this exact first-plan proposal.");
  }

  const proposalCategoryIds = new Set(proposal.rows.map((row) => row.subcategoryId));
  const activeTargetPlans = household.budgetPlans.filter((plan) => plan.active && plan.monthKey === input.monthKey);
  if (activeTargetPlans.some((plan) => !proposalCategoryIds.has(plan.subcategoryId))) {
    throw new ValidationError("The current month's accepted plan has categories outside this proposal. Review it before adopting.");
  }
  if (new Set(activeTargetPlans.map((plan) => plan.subcategoryId)).size !== activeTargetPlans.length) {
    throw new ValidationError("The current month's accepted plan has duplicate category rows.");
  }
  if (activeTargetPlans.length) {
    currentApprovalRows(household, digest, onboardingPlanApprovalPrefix(household));
  }
  for (const [rowIndex, row] of proposal.rows.entries()) {
    if (activeTargetPlans.some((plan) => plan.subcategoryId === row.subcategoryId)) continue;
    const id = onboardingAdoptionPlanId(proposal.monthKey, proposal.sourceDigest, rowIndex);
    if (household.budgetPlans.some((plan) => plan.id === id)) {
      throw new ValidationError("A first-plan row identity is already in use. Review the current plan before adopting.");
    }
  }
  return proposal;
}

function expectedPlanIds(
  previous: Household,
  candidatePlans: readonly BudgetPlan[],
  proposal: BudgetProposal,
): string[] {
  const previousIds = new Set(previous.budgetPlans.map((plan) => plan.id));
  const ids: string[] = [];
  for (const [rowIndex, row] of proposal.rows.entries()) {
    const prior = previous.budgetPlans.find((plan) => (
      plan.active && plan.monthKey === proposal.monthKey && plan.subcategoryId === row.subcategoryId
    ));
    const candidates = candidatePlans.filter((plan) => (
      plan.active && plan.monthKey === proposal.monthKey && plan.subcategoryId === row.subcategoryId
    ));
    if (candidates.length !== 1) {
      throw new ValidationError("The first plan must contain exactly one row for every approved category.");
    }
    const candidate = candidates[0]!;
    if (prior && candidate.id !== prior.id) {
      throw new ValidationError("The first plan cannot replace an existing plan row silently.");
    }
    if (!prior && (previousIds.has(candidate.id)
      || candidate.id !== onboardingAdoptionPlanId(proposal.monthKey, proposal.sourceDigest, rowIndex))) {
      throw new ValidationError("A new first-plan row has an invalid identity.");
    }
    ids.push(candidate.id);
  }
  return ids.sort((left, right) => left.localeCompare(right));
}

/**
 * Re-check the exact adopted plan rows at the acceptance/replay boundary.
 * This deliberately ignores Activity because command-event replay transports
 * bounded plan facts, not presentation history.
 */
export function assertOnboardingAdoptionPlans(
  previous: Household,
  candidatePlans: readonly BudgetPlan[],
  input: {
    actorMemberId: string;
    confirmationId: string;
    postedIds: readonly string[];
    observedOn?: DateKey;
  },
): BudgetProposal {
  const identity = parseOnboardingAdoptionIdentity(input.confirmationId);
  if (!identity) throw new ValidationError("The first-plan adoption identity is invalid.");
  const proposal = currentOnboardingAdoptionProposal(previous, {
    memberId: input.actorMemberId,
    createdBy: input.actorMemberId,
    monthKey: identity.monthKey,
    proposalDigest: identity.proposalDigest,
  }, input.observedOn);
  const expectedIds = expectedPlanIds(previous, candidatePlans, proposal);
  const postedIds = [...input.postedIds].sort((left, right) => left.localeCompare(right));
  if (postedIds.length !== new Set(postedIds).size || !sameValue(postedIds, expectedIds)) {
    throw new ValidationError("The first-plan receipt must name the complete approved batch.");
  }

  const expectedNewCount = proposal.rows.filter((row) => !previous.budgetPlans.some((plan) => (
    plan.active && plan.monthKey === proposal.monthKey && plan.subcategoryId === row.subcategoryId
  ))).length;
  if (candidatePlans.length !== previous.budgetPlans.length + expectedNewCount) {
    throw new ValidationError("The first plan cannot add, remove, or partially apply unrelated rows.");
  }

  const candidateById = new Map(candidatePlans.map((plan) => [plan.id, plan]));
  if (candidateById.size !== candidatePlans.length) {
    throw new ValidationError("The first plan contains duplicate row identities.");
  }
  const proposalByCategory = new Map(proposal.rows.map((row) => [row.subcategoryId, row]));
  const approvedAt = onboardingAdoptionApprovedAt(previous, proposal.sourceDigest, proposal.monthKey);
  for (const prior of previous.budgetPlans) {
    const candidate = candidateById.get(prior.id);
    if (!candidate) throw new ValidationError("The first plan cannot remove an accepted plan row.");
    const proposalRow = prior.active && prior.monthKey === proposal.monthKey
      ? proposalByCategory.get(prior.subcategoryId)
      : undefined;
    if (!proposalRow) {
      if (!sameValue(candidate, prior)) {
        throw new ValidationError("The first plan cannot alter an unrelated plan row.");
      }
      continue;
    }
    const { amountCents: _priorAmount, updatedAt: _priorUpdatedAt, ...priorStable } = prior;
    const { amountCents, updatedAt, ...candidateStable } = candidate;
    if (!sameValue(candidateStable, priorStable)
      || amountCents !== proposalRow.proposedCents
      || updatedAt !== (prior.updatedAt >= approvedAt ? prior.updatedAt : approvedAt)) {
      throw new ValidationError("An existing first-plan row does not match the approved proposal.");
    }
  }

  for (const row of proposal.rows) {
    const existed = previous.budgetPlans.some((plan) => (
      plan.active && plan.monthKey === proposal.monthKey && plan.subcategoryId === row.subcategoryId
    ));
    if (existed) continue;
    const plan = candidatePlans.find((candidate) => (
      candidate.active && candidate.monthKey === proposal.monthKey && candidate.subcategoryId === row.subcategoryId
    ));
    const category = previous.categories.find((candidate) => candidate.id === row.subcategoryId);
    if (!plan || !category
      || JSON.stringify(Object.keys(plan).sort()) !== JSON.stringify([
        "active", "amountCents", "createdAt", "essential", "id", "incomeStability", "monthKey", "subcategoryId", "updatedAt",
      ])
      || plan.amountCents !== row.proposedCents
      || plan.essential !== category.essential
      || plan.incomeStability !== category.incomeStability
      || plan.createdAt !== approvedAt
      || plan.updatedAt !== approvedAt) {
      throw new ValidationError("A new first-plan row does not match the approved proposal.");
    }
  }
  return proposal;
}

export function assertOnboardingAdoptionTransition(
  previous: Household | null,
  candidate: Household,
  input: {
    actorMemberId?: string;
    commandKind?: string;
    confirmationId: string;
    postedIds: readonly string[];
  },
): void {
  if (!previous
    || previous.householdId !== candidate.householdId
    || input.commandKind !== ONBOARDING_ADOPTION_COMMAND_KIND
    || !input.actorMemberId) {
    throw new ValidationError("The first-plan adoption authority is invalid.");
  }
  const proposal = assertOnboardingAdoptionPlans(previous, candidate.budgetPlans, {
    actorMemberId: input.actorMemberId,
    confirmationId: input.confirmationId,
    postedIds: input.postedIds,
  });
  const member = previous.members.find((row) => row.active && row.id === input.actorMemberId)!;
  const activity = candidate.activity.at(-1);
  const retainedActivity = candidate.activity.slice(0, -1);
  const expectedRetainedActivity = retainedActivity.length
    ? previous.activity.slice(-retainedActivity.length)
    : [];
  const expectedActivityLength = Math.min(200, previous.activity.length + 1);
  const expectedActivityKeys = ["action", "at", "id", "summary", "updatedAt"];
  if (candidate.activity.length !== expectedActivityLength
    || !activity
    || JSON.stringify(Object.keys(activity).sort()) !== JSON.stringify(expectedActivityKeys)
    || typeof activity.id !== "string"
    || !activity.id.trim()
    || activity.id !== activity.id.trim()
    || previous.activity.some((row) => row.id === activity.id)
    || activity.action !== "Adopt first budget"
    || activity.summary !== `${member.name} adopted the ${proposal.monthKey} first plan`
    || activity.at !== candidate.lastCommittedAt
    || activity.updatedAt !== candidate.lastCommittedAt
    || !validIso(candidate.lastCommittedAt)
    || !sameValue(retainedActivity, expectedRetainedActivity)) {
    throw new ValidationError("The first-plan adoption receipt is not tied to its approved action.");
  }

  const {
    budgetPlans: _beforePlans,
    activity: _beforeActivity,
    lastCommittedAt: _beforeCommittedAt,
    ...beforeState
  } = previous;
  const {
    budgetPlans: _afterPlans,
    activity: _afterActivity,
    lastCommittedAt: _afterCommittedAt,
    ...afterState
  } = candidate;
  if (!sameValue(afterState, beforeState)) {
    throw new ValidationError("The first-plan adoption can change budget plans only.");
  }
}
