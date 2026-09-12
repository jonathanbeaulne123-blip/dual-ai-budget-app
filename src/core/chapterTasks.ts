import type { Household } from './types.ts';
import type { Move, Ritual } from './chapters.ts';
import { validateTask, type Task, type TaskMoneyLink } from './tasks.ts';
import { chapterTaskId, type ChapterTaskSource } from './chapterTaskSource.ts';
import { chapterConsentFail } from './chapterConsent.ts';
import type { DateKey } from './calendar.ts';

export function ritualMaterialVersion(ritual: Ritual): number {
  return ritual.agreement?.proposals.find(proposal => proposal.id === ritual.agreement?.acceptedProposalId)?.sequence ?? 1;
}
export function ritualOperational(ritual: Ritual): boolean {
  return ['active', 'graduated'].includes(ritual.state) && (!ritual.agreement || ritual.agreement.legacyBaseline || ritual.agreement.acceptedProposalId !== null || ritual.approvalViaClosure !== undefined);
}
export function chapterTask(household: Pick<Household, 'tasks'>, source: Pick<ChapterTaskSource, 'kind' | 'sourceId' | 'onDate'>): Task | null {
  const task = household.tasks?.find(row => row.id === chapterTaskId(source.kind, source.sourceId, source.onDate));
  if (!task) return null;
  if (task.chapterSource?.kind !== source.kind || task.chapterSource.sourceId !== source.sourceId || task.chapterSource.onDate !== source.onDate) chapterConsentFail('This task identity belongs to a different source. Keep both records for recovery.');
  return task;
}
function makeTask(input: { source: ChapterTaskSource; title: string; notes: string; owner: string | null; backup: string | null; createdBy: string | null; at: string; moneyLink?: TaskMoneyLink | null; expectedAmountCents?: number | null; completedAt?: string | null; completedBy?: string | null; deleted?: boolean }): Task {
  return validateTask({ version: 1, id: chapterTaskId(input.source.kind, input.source.sourceId, input.source.onDate), revision: 1, createdBy: input.createdBy, visibility: 'household', title: input.title.slice(0, 240), notes: input.notes.slice(0, 2000),
    listId: null, parentId: null, doDate: input.source.onDate, dueDate: null, repeat: 'none', cue: 'none', assigneeId: input.owner, backupId: input.backup === input.owner ? null : input.backup, acknowledgedBy: [], chapterId: input.source.chapterId, planReference: null,
    moneyLink: input.moneyLink ?? null, expectedAmountCents: input.expectedAmountCents ?? null, completedAt: input.completedAt ?? null, completedBy: input.completedBy ?? null, completionEvidence: null, deleted: input.deleted ?? false, createdAt: input.at, updatedAt: input.at, chapterSource: input.source, participation: [],
  });
}
export function taskForMove(household: Household, move: Move, at: string, legacy: boolean, creator: string | null): Task {
  const source: ChapterTaskSource = { version: 1, kind: 'chapter-move', chapterId: move.chapterId, sourceId: move.id, onDate: null, materialVersion: 1, requiresMoneyEvidence: false, legacy: legacy ? { createdBy: move.createdByMemberId ?? null, completedAt: move.completedAt, completedBy: move.completedByMemberId, evidenceRef: move.evidenceRef, originalState: move.state } : null };
  const existing = chapterTask(household, source); if (existing) return existing;
  const owner = household.members.some(m => m.id === move.ownerMemberId && m.active) ? move.ownerMemberId : null;
  return makeTask({ source, title: move.text, notes: '', owner, backup: null, createdBy: creator, at, completedAt: move.completedAt, completedBy: move.completedAt ? move.completedByMemberId : null, deleted: move.state === 'declined' || move.state === 'done' && !move.completedAt });
}
export function taskForRitual(household: Household, ritual: Ritual, onDate: DateKey, at: string, legacyHeld: boolean, creator: string): Task {
  const source: ChapterTaskSource = { version: 1, kind: 'ritual-occurrence', chapterId: ritual.chapterId, sourceId: ritual.id, onDate, materialVersion: ritualMaterialVersion(ritual), requiresMoneyEvidence: ritual.requiresMoneyEvidence === true,
    // A legacy heldOn date did not record a completion instant or person. Keep
    // that historical fact in an archived Task without manufacturing either.
    legacy: legacyHeld ? { createdBy: null, completedAt: null, completedBy: null, evidenceRef: null, originalState: 'held' } : null };
  const existing = chapterTask(household, source); if (existing) return existing;
  return makeTask({ source, title: ritual.title, notes: `${ritual.doneDefinition}\n\nIf we miss it: ${ritual.recoveryMove}`.trim(), owner: ritual.ownerMemberId, backup: ritual.backupMemberId, createdBy: legacyHeld ? null : creator, at, moneyLink: ritual.moneyLink, expectedAmountCents: ritual.expectedAmountCents, deleted: legacyHeld });
}
export function projectMoveTask(household: Pick<Household, 'tasks'> & Partial<Pick<Household, 'members'>>, move: Move): Move {
  if (!move.taskId) return move;
  const task = chapterTask(household, { kind: 'chapter-move', sourceId: move.id, onDate: null });
  if (!task || task.id !== move.taskId) chapterConsentFail('This Move needs its linked Task restored.');
  const shared = move.sharedApprovals?.materialVersion === task.chapterSource!.materialVersion ? move.sharedApprovals.memberIds : [];
  const ownerPaused = task.participation?.some(row => row.memberId === task.assigneeId && row.paused);
  const active = household.members?.filter(member => member.active) ?? [];
  const everyonePaused = active.length >= 2 && active.every(member => task.participation?.some(row => row.memberId === member.id && row.paused));
  const oldDone = task.chapterSource?.legacy?.originalState === 'done';
  return { ...move, text: task.title, ownerMemberId: task.assigneeId, acknowledgedByMemberIds: shared,
    state: task.completedAt || oldDone && task.deleted ? 'done' : task.deleted ? 'declined' : ownerPaused || everyonePaused ? 'paused' : task.assigneeId && task.acknowledgedBy.includes(task.assigneeId) ? 'accepted' : 'offered',
    completedAt: task.completedAt, completedByMemberId: task.completedBy, evidenceRef: task.completionEvidence?.kind === 'transaction' ? task.completionEvidence.transactionId : task.completionEvidence?.kind === 'goal-contribution' ? task.completionEvidence.contributionId : task.chapterSource?.legacy?.evidenceRef ?? null,
  };
}
export function projectRitualTasks(household: Pick<Household, 'tasks'>, ritual: Ritual): Ritual {
  if (!ritual.taskAdoption) return ritual;
  const heldOn = (household.tasks ?? []).filter(task => task.chapterSource?.kind === 'ritual-occurrence' && task.chapterSource.sourceId === ritual.id && (task.completedAt !== null && !task.deleted || task.chapterSource.legacy?.originalState === 'held')).map(task => task.chapterSource!.onDate!);
  return { ...ritual, heldOn: [...new Set(heldOn)].sort() };
}

export function validateRitualClosureReference(household: Pick<Household, 'chapters'>, ritual: Ritual): void {
  const ref = ritual.approvalViaClosure; if (!ref) return;
  const chapter = household.chapters?.find(row => row.id === ref.chapterId);
  const proposal = chapter?.closure?.proposals.find(row => row.id === ref.proposalId && row.digest === ref.digest && row.state === 'accepted');
  const approved = proposal?.terms.rituals.find(row => row.ritualId === ritual.id);
  if (!chapter || chapter.id !== ritual.chapterId || chapter.closure?.acceptedProposalId !== ref.proposalId || !approved || approved.afterState !== ritual.state) chapterConsentFail('This Ritual needs its exact accepted Chapter closure restored.');
}
