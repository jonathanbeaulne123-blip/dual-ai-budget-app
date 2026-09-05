import type { Category, Household } from "../types.ts";
import { ValidationError } from "../types.ts";
import { currentSubmission, mergedCategorySelection, shapeOnboardingSubmissions } from "./submissions.ts";

export type OnboardingCategoryProposal = {
  id: string;
  householdId: string;
  memberId: string;
  submissionId: string;
  name: string;
  parentId: string;
  proposedAt: string;
};

export type OnboardingCategoryResolution = {
  sourceId: string;
  categoryId: string;
};

export type OnboardingCategoryMerge = {
  id: string;
  householdId: string;
  submissionIds: string[];
  resolutions: OnboardingCategoryResolution[];
  categoryIds: string[];
  mergedByMemberId: string;
  mergedAt: string;
};

export type OnboardingCategoryConflict = {
  name: string;
  options: Array<{ id: string; name: string; parentId: string; proposed: boolean }>;
};

export type OnboardingCategoryState = {
  kind: "selecting" | "waiting-member" | "review" | "complete" | "invalid";
  currentMemberIds: string[];
  submissionIds: string[];
  unionIds: string[];
  bySubmitter: Record<string, string[]>;
  unionLabels: string[];
  labelsBySubmitter: Record<string, string[]>;
  proposals: OnboardingCategoryProposal[];
  conflicts: OnboardingCategoryConflict[];
  merge: OnboardingCategoryMerge | null;
};

function cleanId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-CA");
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(stable(item))));
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, JSON.parse(stable(item))])));
}

function shapeProposal(value: unknown): OnboardingCategoryProposal | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OnboardingCategoryProposal>;
  const keys = ["householdId", "id", "memberId", "name", "parentId", "proposedAt", "submissionId"];
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(keys)) return null;
  const id = cleanId(row.id);
  const householdId = cleanId(row.householdId);
  const memberId = cleanId(row.memberId);
  const submissionId = cleanId(row.submissionId);
  const name = typeof row.name === "string" ? row.name.trim().replace(/\s+/g, " ") : "";
  const parentId = cleanId(row.parentId);
  const proposedAt = cleanIso(row.proposedAt);
  if (!id || !householdId || !memberId || !submissionId || !name || !parentId || !proposedAt) return null;
  return { id, householdId, memberId, submissionId, name, parentId, proposedAt };
}

function shapeResolution(value: unknown): OnboardingCategoryResolution | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OnboardingCategoryResolution>;
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(["categoryId", "sourceId"])) return null;
  const sourceId = cleanId(row.sourceId);
  const categoryId = cleanId(row.categoryId);
  return sourceId && categoryId ? { sourceId, categoryId } : null;
}

function shapeMerge(value: unknown): OnboardingCategoryMerge | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OnboardingCategoryMerge>;
  const keys = ["categoryIds", "householdId", "id", "mergedAt", "mergedByMemberId", "resolutions", "submissionIds"];
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(keys)) return null;
  const id = cleanId(row.id);
  const householdId = cleanId(row.householdId);
  const mergedByMemberId = cleanId(row.mergedByMemberId);
  const mergedAt = cleanIso(row.mergedAt);
  if (!id || !householdId || !mergedByMemberId || !mergedAt
    || !Array.isArray(row.submissionIds) || !Array.isArray(row.categoryIds) || !Array.isArray(row.resolutions)) return null;
  const submissionIds = row.submissionIds.map(cleanId);
  const categoryIds = row.categoryIds.map(cleanId);
  const resolutions = row.resolutions.map(shapeResolution);
  if (submissionIds.some((item) => !item) || categoryIds.some((item) => !item) || resolutions.some((item) => !item)) return null;
  const shapedResolutions = (resolutions as OnboardingCategoryResolution[])
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  if (new Set(shapedResolutions.map((item) => item.sourceId)).size !== shapedResolutions.length) return null;
  return {
    id,
    householdId,
    submissionIds: sortedUnique(submissionIds as string[]),
    resolutions: shapedResolutions,
    categoryIds: sortedUnique(categoryIds as string[]),
    mergedByMemberId,
    mergedAt,
  };
}

function immutableMerge<T extends { id: string }>(server: T[], client: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of [...server, ...client].sort((left, right) => left.id.localeCompare(right.id))) {
    const prior = byId.get(row.id);
    if (prior && stable(prior) !== stable(row)) throw new ValidationError("Conflicting onboarding category history.");
    byId.set(row.id, row);
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function shapeOnboardingCategoryProposals(value: unknown, householdId?: string): OnboardingCategoryProposal[] {
  if (!Array.isArray(value)) return [];
  const rows = value.map(shapeProposal).filter((row): row is OnboardingCategoryProposal => Boolean(row));
  return immutableMerge([], rows).filter((row) => !householdId || row.householdId === householdId);
}

export function shapeOnboardingCategoryMerges(value: unknown, householdId?: string): OnboardingCategoryMerge[] {
  if (!Array.isArray(value)) return [];
  const rows = value.map(shapeMerge).filter((row): row is OnboardingCategoryMerge => Boolean(row));
  return immutableMerge([], rows).filter((row) => !householdId || row.householdId === householdId);
}

export function mergeOnboardingCategoryProposals(server: unknown, client: unknown): OnboardingCategoryProposal[] {
  return immutableMerge(shapeOnboardingCategoryProposals(server), shapeOnboardingCategoryProposals(client));
}

export function mergeOnboardingCategoryMerges(server: unknown, client: unknown): OnboardingCategoryMerge[] {
  return immutableMerge(shapeOnboardingCategoryMerges(server), shapeOnboardingCategoryMerges(client));
}

function activeExpenseCategories(household: Pick<Household, "categories">): Category[] {
  return household.categories.filter((row) => row.active && row.recordType === "category" && row.transactionType === "expense");
}

function currentMemberIds(household: Pick<Household, "members">): string[] {
  return household.members.filter((member) => member.active).map((member) => member.id).sort();
}

function matchingMerge(household: Household, submissionIds: string[]): OnboardingCategoryMerge | null {
  const target = sortedUnique(submissionIds);
  return shapeOnboardingCategoryMerges(household.onboardingCategoryMerges, household.householdId)
    .find((row) => stable(row.submissionIds) === stable(target)) ?? null;
}

function labelRows(household: Household, unionIds: string[], proposals: OnboardingCategoryProposal[]) {
  const categories = new Map(activeExpenseCategories(household).map((row) => [row.id, row]));
  const proposalMap = new Map(proposals.map((row) => [row.id, row]));
  return unionIds.map((id) => {
    const category = categories.get(id);
    if (category) return { id, name: category.name, parentId: category.parentId ?? "", proposed: false };
    const proposal = proposalMap.get(id);
    return proposal ? { id, name: proposal.name, parentId: proposal.parentId, proposed: true } : null;
  });
}

export function onboardingCategoryState(household: Household): OnboardingCategoryState {
  const memberIds = currentMemberIds(household);
  const submissions = memberIds.map((memberId) => currentSubmission(household, memberId, "categories")).filter(Boolean);
  const submissionIds = submissions.map((row) => row!.id).sort();
  const selection = mergedCategorySelection(household);
  const allProposals = shapeOnboardingCategoryProposals(household.onboardingCategoryProposals, household.householdId);
  const proposals = allProposals.filter((row) => submissionIds.includes(row.submissionId));
  const rows = labelRows(household, selection.unionIds, proposals);
  if (memberIds.length !== 2 || rows.some((row) => row === null)) {
    return {
      kind: "invalid", currentMemberIds: memberIds, submissionIds, unionIds: selection.unionIds,
      bySubmitter: selection.bySubmitter, unionLabels: [], labelsBySubmitter: {}, proposals, conflicts: [], merge: null,
    };
  }
  const resolvedRows = rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
  const canonicalRows = activeExpenseCategories(household).map((row) => ({
    id: row.id,
    name: row.name,
    parentId: row.parentId ?? "",
    proposed: false,
  }));
  const byName = new Map<string, typeof resolvedRows>();
  for (const row of resolvedRows) {
    const key = normalizedName(row.name);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }
  for (const proposal of proposals) {
    const key = normalizedName(proposal.name);
    const matches = canonicalRows.filter((row) => normalizedName(row.name) === key);
    if (!matches.length) continue;
    const current = byName.get(key) ?? [];
    byName.set(key, [...current, ...matches.filter((match) => !current.some((row) => row.id === match.id))]);
  }
  const conflicts = [...byName.values()]
    .filter((items) => new Set(items.map((item) => item.id)).size > 1)
    .map((items) => ({
      name: items[0]!.name,
      options: [...items].sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const merge = matchingMerge(household, submissionIds);
  const resolutionMap = new Map(merge?.resolutions.map((row) => [row.sourceId, row.categoryId]) ?? []);
  const canonicalCategories = new Map(activeExpenseCategories(household).map((row) => [row.id, row]));
  const labelFor = (id: string): string => {
    const resolvedId = resolutionMap.get(id) ?? id;
    return canonicalCategories.get(resolvedId)?.name
      ?? resolvedRows.find((row) => row.id === id)?.name
      ?? id;
  };
  const labelsBySubmitter = Object.fromEntries(Object.entries(selection.bySubmitter).map(([memberId, ids]) => [
    memberId,
    sortedUnique(ids.map(labelFor)),
  ]));
  const unionLabels = sortedUnique((merge?.categoryIds ?? selection.unionIds).map(labelFor));
  const allSubmitted = submissions.length === memberIds.length;
  const needsMerge = allSubmitted && proposals.length > 0 && !merge;
  return {
    kind: submissions.length === 0
      ? "selecting"
      : !allSubmitted
        ? "waiting-member"
        : needsMerge
          ? "review"
          : "complete",
    currentMemberIds: memberIds,
    submissionIds,
    unionIds: merge?.categoryIds ?? selection.unionIds,
    bySubmitter: selection.bySubmitter,
    unionLabels,
    labelsBySubmitter,
    proposals,
    conflicts,
    merge,
  };
}

function idSlug(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "CATEGORY";
}

export function onboardingCategoryProposalId(memberId: string, revision: number, index: number): string {
  return `ONB-CAT-${idSlug(memberId)}-${revision}-${index + 1}`;
}

export function canonicalCategoryId(parentName: string, name: string, usedIds: ReadonlySet<string>): string {
  const base = `SUB-${idSlug(parentName)}-${idSlug(name)}`;
  if (!usedIds.has(base)) return base;
  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function categoryMergeId(submissionIds: readonly string[]): string {
  return `ONB-CAT-MERGE-${sortedUnique(submissionIds).map(idSlug).join("-")}`;
}

export function assertCategoryProposalInputs(
  household: Household,
  inputs: Array<{ name: string; parentId: string }>,
): Array<{ name: string; parentId: string }> {
  const groups = new Set(household.categories.filter((row) => row.active && row.recordType === "group" && row.transactionType === "expense").map((row) => row.id));
  const seen = new Set<string>();
  return inputs.map((input) => {
    const name = input.name.trim().replace(/\s+/g, " ");
    const parentId = input.parentId.trim();
    if (!name) throw new ValidationError("Name the category you want to suggest.");
    if (!groups.has(parentId)) throw new ValidationError("Choose where that category belongs.");
    const key = `${normalizedName(name)}\u001f${parentId}`;
    if (seen.has(key)) throw new ValidationError("Keep one suggestion for each category name.");
    seen.add(key);
    return { name, parentId };
  });
}

export function currentCategorySubmissionIds(household: Household): string[] {
  return currentMemberIds(household)
    .map((memberId) => currentSubmission(household, memberId, "categories")?.id ?? "")
    .filter(Boolean)
    .sort();
}

export function assertOnboardingCategoryCollections(household: Household): void {
  const submissions = shapeOnboardingSubmissions(household.onboardingSubmissions, household.householdId);
  const submissionMap = new Map(submissions.map((row) => [row.id, row]));
  for (const proposal of shapeOnboardingCategoryProposals(household.onboardingCategoryProposals, household.householdId)) {
    const submission = submissionMap.get(proposal.submissionId);
    if (!submission || submission.kind !== "categories" || submission.memberId !== proposal.memberId
      || !submission.categoryIds.includes(proposal.id) || submission.submittedAt !== proposal.proposedAt) {
      throw new ValidationError("Conflicting onboarding category history.");
    }
  }
  for (const merge of shapeOnboardingCategoryMerges(household.onboardingCategoryMerges, household.householdId)) {
    if (merge.submissionIds.length !== 2 || merge.submissionIds.some((id) => !submissionMap.has(id))
      || merge.resolutions.some((row) => !merge.categoryIds.includes(row.categoryId))) {
      throw new ValidationError("Conflicting onboarding category history.");
    }
  }
}

export function assertOnboardingCategoryMergeTransition(
  previous: Household | null,
  next: Household,
  input: { actorMemberId?: string; commandKind?: string; postedIds: readonly string[] },
): void {
  if (!previous || input.commandKind !== "mergeOnboardingCategories" || !input.actorMemberId
    || !previous.members.some((member) => member.active && member.id === input.actorMemberId)) {
    throw new ValidationError("Review the category merge from an active household seat.");
  }
  assertOnboardingCategoryCollections(previous);
  assertOnboardingCategoryCollections(next);
  const beforeMerges = shapeOnboardingCategoryMerges(previous.onboardingCategoryMerges, previous.householdId);
  const afterMerges = shapeOnboardingCategoryMerges(next.onboardingCategoryMerges, next.householdId);
  const beforeIds = new Set(beforeMerges.map((row) => row.id));
  const addedMerges = afterMerges.filter((row) => !beforeIds.has(row.id));
  const merge = addedMerges[0];
  const priorCategories = new Map(previous.categories.map((row) => [row.id, row]));
  const addedCategories = next.categories.filter((row) => !priorCategories.has(row.id));
  const existingCategoriesUnchanged = previous.categories.every((row) => {
    const retained = next.categories.find((candidate) => candidate.id === row.id);
    return retained && stable(retained) === stable(row);
  });
  const state = onboardingCategoryState(previous);
  const expectedPosted = new Set([merge?.id ?? "", ...addedCategories.map((row) => row.id)].filter(Boolean));
  const posted = new Set(input.postedIds);
  if (!merge || addedMerges.length !== 1 || afterMerges.length !== beforeMerges.length + 1
    || merge.householdId !== previous.householdId
    || merge.mergedByMemberId !== input.actorMemberId
    || stable(merge.submissionIds) !== stable(state.submissionIds)
    || state.kind !== "review"
    || !existingCategoriesUnchanged
    || expectedPosted.size !== posted.size
    || [...expectedPosted].some((id) => !posted.has(id))) {
    throw new ValidationError("Review the category merge again.");
  }
  const proposals = new Map(state.proposals.map((row) => [row.id, row]));
  const resolutions = new Map(merge.resolutions.map((row) => [row.sourceId, row.categoryId]));
  if (resolutions.size !== state.unionIds.length || state.unionIds.some((id) => !resolutions.has(id))) {
    throw new ValidationError("Review the category merge again.");
  }
  const resolvedNames = new Map<string, string>();
  for (const sourceId of state.unionIds) {
    const existing = priorCategories.get(sourceId);
    const proposal = proposals.get(sourceId);
    const targetId = resolutions.get(sourceId)!;
    const target = next.categories.find((row) => row.id === targetId);
    if (!target || !target.active || target.recordType !== "category" || target.transactionType !== "expense") {
      throw new ValidationError("Review the category merge again.");
    }
    if (existing && targetId !== existing.id) throw new ValidationError("Review the category merge again.");
    if (proposal && normalizedName(target.name) !== normalizedName(proposal.name)) {
      throw new ValidationError("Review the category merge again.");
    }
    const key = normalizedName(existing?.name ?? proposal!.name);
    const priorTarget = resolvedNames.get(key);
    if (priorTarget && priorTarget !== targetId) throw new ValidationError("Review the category merge again.");
    resolvedNames.set(key, targetId);
  }
  if (stable(sortedUnique(merge.categoryIds)) !== stable(sortedUnique([...resolutions.values()]))) {
    throw new ValidationError("Review the category merge again.");
  }
  if (addedCategories.some((row) => {
    const source = state.proposals.find((proposal) => resolutions.get(proposal.id) === row.id);
    return !source || normalizedName(source.name) !== normalizedName(row.name) || source.parentId !== row.parentId;
  })) {
    throw new ValidationError("Review the category merge again.");
  }
  const {
    categories: _beforeCategories,
    onboardingCategoryMerges: _beforeMerges,
    activity: _beforeActivity,
    lastCommittedAt: _beforeCommitted,
    ...beforeRest
  } = previous;
  const {
    categories: _afterCategories,
    onboardingCategoryMerges: _afterMerges,
    activity: _afterActivity,
    lastCommittedAt: _afterCommitted,
    ...afterRest
  } = next;
  if (stable(beforeRest) !== stable(afterRest)) throw new ValidationError("Review the category merge again.");
}
