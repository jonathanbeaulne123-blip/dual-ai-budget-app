import { captureCommand } from '../ledgerSync/capture.ts';
import { canonical } from '../ledgerSync/patch.ts';
import type { CommitResult, Household } from '../core/types.ts';
import {
  decodeExperience,
  decodeHearthside,
  decodeMemory,
  identifier,
  memoryKeptByEveryone,
  object,
  revisionValue,
  type DesignReference,
  type MemoryComposition,
  type SharedExperience,
  type SharedReference,
} from './contracts.ts';
import { sharedReferenceExists } from './commands.ts';
import {
  decodePersonalLife,
  decodePersonalLifeExperience,
  decodePersonalLifeMemory,
  decodePersonalLifeNote,
  decodePersonalLifePlacement,
  decodePersonalLifeWish,
  personalLifeDigest,
  type PersonalLifeDocument,
  type PersonalLifeExperience,
  type PersonalLifeMemory,
  type PersonalLifeNote,
  type PersonalLifePlacement,
  type PersonalLifeShareReceipt,
  type PersonalLifeWish,
} from './personalLifeContracts.ts';

export type PersonalLifeShareReview = {
  version: 1;
  id: string;
  sourceKind: 'wish' | 'experience' | 'memory';
  sourceId: string;
  sourceRevision: number;
  sourceDigest: string;
  copy:
    | { kind: 'experience'; value: SharedExperience }
    | { kind: 'memory'; value: MemoryComposition };
};

export type PreparePersonalLifeShareReviewInput = {
  id: string;
  sourceKind: PersonalLifeShareReview['sourceKind'];
  sourceId: string;
  sharedId: string;
  sharedExperienceId?: string | null;
  sharedDesigns?: DesignReference[];
};

export type PersonalLifeOperation =
  | { kind: 'wish.save'; expectedRevision: number; value: PersonalLifeWish }
  | { kind: 'experience.save'; expectedRevision: number; value: PersonalLifeExperience }
  | { kind: 'experience.mark-lived'; id: string; expectedRevision: number; livedOn: string }
  | { kind: 'note.save'; expectedRevision: number; value: PersonalLifeNote }
  | { kind: 'memory.save'; expectedRevision: number; value: PersonalLifeMemory }
  | { kind: 'memory.keep' | 'memory.withdraw'; id: string; expectedRevision: number }
  | { kind: 'placement.save'; expectedRevision: number; value: PersonalLifePlacement }
  | { kind: 'share.copy'; review: PersonalLifeShareReview; expectedDigest: string };

export type PersonalLifeIntent = {
  version: 1;
  id: string;
  scope: { environment: Household['environment']; householdId: string; memberId: string };
  operation: PersonalLifeOperation;
};

export const hasPersonalLifeData = (household: Pick<Household, 'personalLife'>): boolean => household.personalLife !== undefined;

const digestText = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw Error('PERSONAL_LIFE_INVALID_DIGEST');
  return value;
};

export function decodePersonalLifeShareReview(value: unknown): PersonalLifeShareReview {
  const row = object(value, ['version', 'id', 'sourceKind', 'sourceId', 'sourceRevision', 'sourceDigest', 'copy']);
  if (row.version !== 1 || !['wish', 'experience', 'memory'].includes(String(row.sourceKind))) throw Error('PERSONAL_LIFE_INVALID_SHARE_REVIEW');
  const copy = object(row.copy, ['kind', 'value']);
  if (copy.kind !== (row.sourceKind === 'memory' ? 'memory' : 'experience')) throw Error('PERSONAL_LIFE_INVALID_SHARE_REVIEW');
  return {
    version: 1,
    id: identifier(row.id),
    sourceKind: row.sourceKind as PersonalLifeShareReview['sourceKind'],
    sourceId: identifier(row.sourceId),
    sourceRevision: revisionValue(row.sourceRevision, 1),
    sourceDigest: digestText(row.sourceDigest),
    copy: copy.kind === 'experience'
      ? { kind: 'experience', value: decodeExperience(copy.value) }
      : { kind: 'memory', value: decodeMemory(copy.value) },
  };
}

export const personalLifeShareReviewDigest = (review: PersonalLifeShareReview): string => personalLifeDigest(decodePersonalLifeShareReview(review));

export function preparePersonalLifeShareReview(document: PersonalLifeDocument, input: PreparePersonalLifeShareReviewInput): PersonalLifeShareReview {
  const source = input.sourceKind === 'wish' ? document.wishes.find(row => row.id === input.sourceId && !row.archived)
    : input.sourceKind === 'experience' ? document.experiences.find(row => row.id === input.sourceId)
    : document.memories.find(row => row.id === input.sourceId && !row.withdrawn);
  if (!source) throw Error('PERSONAL_LIFE_SHARE_SOURCE_MISSING');
  if (input.sharedId === source.id) throw Error('PERSONAL_LIFE_SHARED_ID_REQUIRED');
  if (input.sourceKind === 'wish' || input.sourceKind === 'experience') {
    const experience = source as PersonalLifeExperience | PersonalLifeWish;
    const references: SharedReference[] = experience.references
      .filter(reference => reference.audience === 'household')
      .map(({ audience: _audience, ...reference }) => reference);
    return decodePersonalLifeShareReview({
      version: 1, id: input.id, sourceKind: input.sourceKind, sourceId: source.id, sourceRevision: source.revision,
      sourceDigest: personalLifeDigest(source),
      copy: { kind: 'experience', value: { version: 1, id: input.sharedId, revision: 1, title: experience.title, intention: experience.intention,
        state: 'state' in experience ? experience.state : 'dreaming', horizon: experience.horizon, createdBy: document.ownerMemberId, ...('livedOn' in experience && experience.livedOn ? {livedOn:experience.livedOn} : {}), references } },
    });
  }
  const memory = source as PersonalLifeMemory;
  return decodePersonalLifeShareReview({
    version: 1, id: input.id, sourceKind: 'memory', sourceId: source.id, sourceRevision: source.revision,
    sourceDigest: personalLifeDigest(source),
    copy: { kind: 'memory', value: { version: 1, id: input.sharedId, revision: 1, title: memory.title, date: memory.date,
      experienceId: input.sharedExperienceId ?? null, media: [], designs: input.sharedDesigns ?? [],
      recollections: [{ memberId: document.ownerMemberId, text: memory.recollection }], hideAmounts: memory.hideAmounts,
      approvals: [], withdrawn: false } },
  });
}

function expectRevision(actual: number, expected: number, next?: number): void {
  revisionValue(expected);
  if (actual !== expected || next !== undefined && next !== expected + 1) throw Error('PERSONAL_LIFE_CHANGED: Review the current private copy.');
}

function personalReferenceExists(household: Household, actor: string, reference: PersonalLifeExperience['references'][number]): boolean {
  if (reference.kind === 'chapter') return reference.audience === 'household' && Boolean(household.chapters?.some(row => row.id === reference.id));
  if (reference.kind === 'bank') return household.goals.some(row => row.id === reference.id && (reference.audience === 'household' ? row.shared : !row.shared && row.ownerMemberId === actor));
  if (reference.kind === 'task') return Boolean(household.tasks?.some(row => row.id === reference.id && !row.deleted && (reference.audience === 'household' ? row.visibility === 'household' : row.visibility === 'personal' && row.createdBy === actor)));
  if (reference.kind === 'calendar-event') return Boolean(household.nativeEvents?.some(row => row.id === reference.id && !row.deleted && (reference.audience === 'household' ? row.visibility === 'household' : row.visibility === 'personal' && row.createdBy === actor)));
  return Boolean(household.planVersions?.some(plan => plan.id === reference.planVersionId
    && (reference.audience === 'household' ? plan.scope === 'household' : plan.scope === 'personal' && plan.ownerMemberId === actor)
    && plan.state !== 'superseded' && plan.lines.some(line => line.id === reference.id)));
}

function designExists(document: PersonalLifeDocument, reference: DesignReference): boolean {
  return document.designs.some(design => design.designId === reference.documentId && design.revision >= reference.revision && design.pieceIds.includes(reference.pieceId));
}

function validateShareCopy(household: Household, actor: string, review: PersonalLifeShareReview): void {
  const shared = decodeHearthside(household.hearthside);
  if (review.copy.value.id === review.sourceId) throw Error('PERSONAL_LIFE_SHARED_ID_REQUIRED');
  if (review.copy.kind === 'experience') {
    const copy = review.copy.value;
    if (copy.revision !== 1 || copy.createdBy !== actor || shared.experiences.some(row => row.id === copy.id)
      || copy.references.some(reference => !sharedReferenceExists(household, reference))) throw Error('PERSONAL_LIFE_SHARED_COPY_INVALID');
    return;
  }
  const copy = review.copy.value;
  if (copy.revision !== 1 || copy.withdrawn || copy.approvals.length || copy.media.length || copy.publication || copy.legacySource
    || copy.recollections.length !== 1 || copy.recollections[0]?.memberId !== actor || shared.memories.some(row => row.id === copy.id)
    || copy.experienceId !== null && !shared.experiences.some(row => row.id === copy.experienceId)
    || copy.designs.some(reference => !shared.designs.some(design => design.designId === reference.documentId && design.revision >= reference.revision && design.pieceIds.includes(reference.pieceId)))) {
    throw Error('PERSONAL_LIFE_SHARED_COPY_INVALID');
  }
}

function receiptMatches(receipt: PersonalLifeShareReceipt, review: PersonalLifeShareReview): boolean {
  return receipt.id === review.id && receipt.sourceKind === review.sourceKind && receipt.sourceId === review.sourceId
    && receipt.sourceRevision === review.sourceRevision && receipt.sourceDigest === review.sourceDigest
    && receipt.sharedId === review.copy.value.id && receipt.sharedRevision === review.copy.value.revision;
}

export const commitPersonalLife = captureCommand('commitPersonalLife', (household: Household, input: PersonalLifeIntent): CommitResult => {
  const previous = household;
  object(input, ['version', 'id', 'scope', 'operation']);
  object(input.scope, ['environment', 'householdId', 'memberId']);
  identifier(input.id);
  const actor = identifier(input.scope.memberId);
  if (input.version !== 1 || input.scope.environment !== household.environment || input.scope.householdId !== household.householdId
    || !household.members.some(member => member.id === actor && member.active)) throw Error('PERSONAL_LIFE_SCOPE_MISMATCH');
  const document = decodePersonalLife(household.personalLife, actor);
  const operation = input.operation;
  let sharedMutation = false;
  if (operation.kind === 'wish.save') {
    const value = decodePersonalLifeWish(operation.value), old = document.wishes.find(row => row.id === value.id);
    expectRevision(old?.revision ?? 0, operation.expectedRevision, value.revision);
    if (value.createdBy !== actor || old && old.createdBy !== actor || value.references.some(reference => !personalReferenceExists(household, actor, reference))) throw Error('PERSONAL_LIFE_REFERENCE_FORBIDDEN');
    document.wishes = [...document.wishes.filter(row => row.id !== value.id), value];
  } else if (operation.kind === 'experience.save') {
    const value = decodePersonalLifeExperience(operation.value), old = document.experiences.find(row => row.id === value.id);
    expectRevision(old?.revision ?? 0, operation.expectedRevision, value.revision);
    if (value.createdBy !== actor || old && old.createdBy !== actor || value.wishId !== null && !document.wishes.some(wish => wish.id === value.wishId) || value.references.some(reference => !personalReferenceExists(household, actor, reference))) throw Error('PERSONAL_LIFE_REFERENCE_FORBIDDEN');
    document.experiences = [...document.experiences.filter(row => row.id !== value.id), value];
  } else if (operation.kind === 'experience.mark-lived') {
    const experience = document.experiences.find(row => row.id === identifier(operation.id));
    if (!experience) throw Error('PERSONAL_LIFE_EXPERIENCE_MISSING');
    expectRevision(experience.revision, operation.expectedRevision);
    const livedOn = operation.livedOn;
    // Reuse the strict record decoder for the civil date and resulting revision.
    const next = decodePersonalLifeExperience({ ...experience, revision: experience.revision + 1, state: 'lived', livedOn });
    document.experiences = [...document.experiences.filter(row => row.id !== next.id), next];
  } else if (operation.kind === 'note.save') {
    const value = decodePersonalLifeNote(operation.value), old = document.notes.find(row => row.id === value.id);
    expectRevision(old?.revision ?? 0, operation.expectedRevision, value.revision);
    if (value.authorId !== actor || old && old.authorId !== actor || value.experienceId !== null && !document.experiences.some(row => row.id === value.experienceId)) throw Error('PERSONAL_LIFE_NOTE_FORBIDDEN');
    document.notes = [...document.notes.filter(row => row.id !== value.id), value];
  } else if (operation.kind === 'memory.save') {
    const value = decodePersonalLifeMemory(operation.value), old = document.memories.find(row => row.id === value.id);
    expectRevision(old?.revision ?? 0, operation.expectedRevision, value.revision);
    if (value.createdBy !== actor || old && old.createdBy !== actor || value.withdrawn || value.keptRevision !== null
      || old?.withdrawn || value.experienceId !== null && !document.experiences.some(row => row.id === value.experienceId)
      || value.designs.some(reference => !designExists(document, reference))) throw Error('PERSONAL_LIFE_MEMORY_FORBIDDEN');
    document.memories = [...document.memories.filter(row => row.id !== value.id), value];
  } else if (operation.kind === 'memory.keep' || operation.kind === 'memory.withdraw') {
    const memory = document.memories.find(row => row.id === identifier(operation.id));
    if (!memory) throw Error('PERSONAL_LIFE_MEMORY_MISSING');
    expectRevision(memory.revision, operation.expectedRevision);
    if (operation.kind === 'memory.keep') {
      if (memory.withdrawn) throw Error('PERSONAL_LIFE_MEMORY_WITHDRAWN');
      memory.keptRevision = memory.revision;
    } else {
      memory.withdrawn = true; memory.keptRevision = null; memory.revision++;
      document.placements = document.placements.filter(row => !(row.object.kind === 'memory' && row.object.id === memory.id));
    }
  } else if (operation.kind === 'placement.save') {
    const value = decodePersonalLifePlacement(operation.value), old = document.placements.find(row => row.id === value.id);
    expectRevision(old?.revision ?? 0, operation.expectedRevision, value.revision);
    if (old && (old.room !== value.room || canonical(old.object) !== canonical(value.object))) throw Error('PERSONAL_LIFE_PLACEMENT_IDENTITY_CHANGED');
    const target = value.object;
    const exists = target.kind === 'experience' ? document.experiences.some(row => row.id === target.id)
      : target.kind === 'note' ? document.notes.some(row => row.id === target.id && !row.archived)
      : target.kind === 'memory' ? document.memories.some(row => row.id === target.id && !row.withdrawn && row.keptRevision === row.revision)
      : document.designs.some(row => row.designId === target.designId && row.pieceIds.includes(target.id));
    if (!exists) throw Error('PERSONAL_LIFE_DISPLAY_REFERENCE_REQUIRED');
    document.placements = [...document.placements.filter(row => row.id !== value.id), value];
  } else if (operation.kind === 'share.copy') {
    const review = decodePersonalLifeShareReview(operation.review);
    if (personalLifeShareReviewDigest(review) !== digestText(operation.expectedDigest)) throw Error('PERSONAL_LIFE_SHARE_REVIEW_CHANGED');
    const accepted = document.shareReceipts.find(receipt => receipt.id === review.id);
    if (accepted) {
      if (!receiptMatches(accepted, review)) throw Error('PERSONAL_LIFE_SHARE_ID_REUSED');
      const state = decodeHearthside(household.hearthside);
      const exists = review.copy.kind === 'experience' ? state.experiences.some(row => row.id === accepted.sharedId && row.revision >= accepted.sharedRevision)
        : state.memories.some(row => row.id === accepted.sharedId && row.revision >= accepted.sharedRevision);
      if (!exists) throw Error('PERSONAL_LIFE_SHARED_COPY_MISSING');
      return { household, postedIds: [], warnings: [], undo: { id: input.id, label: 'Already shared with Our Home', snapshot: previous, postedIds: [], actorMemberId: actor, commandKind: 'personal-life' } };
    }
    const source = review.sourceKind === 'wish' ? document.wishes.find(row => row.id === review.sourceId && !row.archived)
      : review.sourceKind === 'experience' ? document.experiences.find(row => row.id === review.sourceId)
      : document.memories.find(row => row.id === review.sourceId && !row.withdrawn && row.keptRevision === row.revision);
    if (!source || source.revision !== review.sourceRevision || personalLifeDigest(source) !== review.sourceDigest) throw Error('PERSONAL_LIFE_SHARE_SOURCE_CHANGED');
    validateShareCopy(household, actor, review);
    const state = decodeHearthside(household.hearthside);
    if (review.copy.kind === 'experience') state.experiences.push(review.copy.value);
    else state.memories.push(review.copy.value);
    household = { ...household, hearthside: decodeHearthside(state) };
    document.shareReceipts.push({ version: 1, id: review.id, sourceKind: review.sourceKind, sourceId: review.sourceId,
      sourceRevision: review.sourceRevision, sourceDigest: review.sourceDigest, sharedId: review.copy.value.id,
      sharedRevision: review.copy.value.revision, copiedAt: new Date().toISOString() });
    sharedMutation = true;
  } else throw Error('PERSONAL_LIFE_OPERATION_UNKNOWN');
  const next = { ...household, personalLife: decodePersonalLife(document, actor) };
  return {
    household: next, postedIds: [], warnings: [],
    ...(!sharedMutation ? { persistenceScope: 'member-personal' as const, personalMemberId: actor } : {}),
    undo: { id: input.id, label: sharedMutation ? 'Share with Our Home' : 'Personal life', snapshot: previous, postedIds: [], actorMemberId: actor, commandKind: 'personal-life' },
  };
});

/** Shared memories retain their existing exact-composition gate. This helper is intentionally read-only. */
export function sharedCopyKeptByEveryone(household: Household, sharedId: string): boolean {
  const memory = decodeHearthside(household.hearthside).memories.find(row => row.id === sharedId);
  return Boolean(memory && memoryKeptByEveryone(memory, household.members.filter(member => member.active).map(member => member.id)));
}
