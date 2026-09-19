import {
  acknowledgeRitualChange, chapterClosureRevision, closeChapter, completeMove,
  pendingChapterClosure, pendingRitualReview, prepareRitualOccurrence,
  recordRitualHeld, respondToMove, reviewChapterClosure, ritualAgreementRevision,
  type CloseChapterInput,
} from './chapters.ts';
import { chapterTask } from './chapterTasks.ts';
import { acknowledgeTask } from './tasks.ts';
import { atSyntheticClock, runtimeNowIso } from './syntheticRuntime.ts';
import type { Household } from './types.ts';

/** Fixture orchestration only: every agreement, assignment and completion uses its real command. */
function atTaskClock(before: Household, at: string, run: () => Household): Household {
  const next = atSyntheticClock(at, run);
  // Task commands still use the wall clock. Normalize only their clock metadata;
  // responsibility, acceptance, evidence and revisions remain command results.
  return { ...next, tasks: next.tasks?.map(task => {
    const old = before.tasks?.find(row => row.id === task.id);
    return old?.revision === task.revision ? task : { ...task, createdAt: old?.createdAt ?? at, updatedAt: at };
  }) };
}

/** Each still-missing participant agrees to the exact proposal, never on somebody else's behalf. */
export function agreeSyntheticRitual(h: Household, ritualId: string, at: string): Household {
  let next = h;
  const pending = pendingRitualReview(next.rituals!.find(row => row.id === ritualId)!);
  if (!pending) return next;
  for (const memberId of pending.audience.filter(id => !pending.approvals.some(row => row.memberId === id))) {
    const ritual = next.rituals!.find(row => row.id === ritualId)!;
    next = acknowledgeRitualChange(next, { memberId, ritualId, expectedRevision: ritualAgreementRevision(ritual), proposalId: pending.id, digest: pending.digest, at }).household;
  }
  return next;
}

export function holdSyntheticRitual(h: Household, input: Parameters<typeof recordRitualHeld>[1]): Household {
  const at = input.at ?? `${input.onDate}T20:00:00.000Z`;
  return atTaskClock(h, at, () => {
    let next = agreeSyntheticRitual(h, input.ritualId, at);
    const ritual = next.rituals!.find(row => row.id === input.ritualId)!;
    // A missing bank link stays visibly unresolved. Once linked, missing receipts
    // leave a prepared, accepted Task open rather than inventing a money event.
    if (ritual.requiresMoneyEvidence && !ritual.moneyLink) return next;
    next = prepareRitualOccurrence(next, { memberId: input.memberId, ritualId: ritual.id, onDate: input.onDate, expectedRevision: ritualAgreementRevision(ritual), at }).household;
    let task = chapterTask(next, { kind: 'ritual-occurrence', sourceId: ritual.id, onDate: input.onDate })!;
    if (!task.acknowledgedBy.includes(input.memberId)) next = acknowledgeTask(next, { memberId: input.memberId, id: task.id, expectedRevision: task.revision }).household;
    if ((ritual.requiresMoneyEvidence || ritual.moneyLink || (ritual.expectedAmountCents ?? 0) > 0) && !input.evidence) return next;
    task = next.tasks!.find(row => row.id === task.id)!;
    return recordRitualHeld(next, { ...input, expectedTaskRevision: task.revision, at }).household;
  });
}

export function respondToSyntheticMove(h: Household, input: Parameters<typeof respondToMove>[1]): Household {
  const at = input.at ?? runtimeNowIso();
  const task = chapterTask(h, { kind: 'chapter-move', sourceId: input.moveId, onDate: null })!;
  return atTaskClock(h, at, () => respondToMove(h, { ...input, expectedTaskRevision: task.revision, at }).household);
}

export function completeSyntheticMove(h: Household, input: Parameters<typeof completeMove>[1]): Household {
  const at = input.at ?? runtimeNowIso();
  return atTaskClock(h, at, () => {
    // The person doing the work accepts their own assignment.
    let next = respondToSyntheticMove(h, { memberId: input.memberId, moveId: input.moveId, response: 'accept', at });
    const move = next.moves!.find(row => row.id === input.moveId)!;
    if (move.needsAcknowledgment) for (const member of next.members.filter(row => row.active)) {
      if (!next.moves!.find(row => row.id === move.id)!.sharedApprovals?.memberIds.includes(member.id)) next = respondToSyntheticMove(next, { memberId: member.id, moveId: move.id, response: 'acknowledge', at });
    }
    const task = chapterTask(next, { kind: 'chapter-move', sourceId: move.id, onDate: null })!;
    return completeMove(next, { ...input, expectedTaskRevision: task.revision, at }).household;
  });
}

/** Propose once, then approve as each other participant against the refreshed revision. */
export function closeSyntheticChapter(h: Household, input: CloseChapterInput): Household {
  const at = input.at ?? runtimeNowIso();
  const review = reviewChapterClosure(h, input);
  let next = closeChapter(h, { ...input, expectedRevision: review.expectedRevision, reviewDigest: review.reviewDigest, at }).household;
  const pending = pendingChapterClosure(next.chapters!.find(row => row.id === input.chapterId)!)!;
  for (const memberId of pending.audience.filter(id => !pending.approvals.some(row => row.memberId === id))) {
    const chapter = next.chapters!.find(row => row.id === input.chapterId)!;
    next = closeChapter(next, { ...input, memberId, expectedRevision: chapterClosureRevision(chapter), proposalId: pending.id, digest: pending.digest, at }).household;
  }
  return next;
}
