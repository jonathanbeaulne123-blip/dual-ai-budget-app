import type { Household } from './types.ts';
import { chapterConsentFail } from './chapterConsent.ts';
import { validateRitualClosureReference } from './chapterTasks.ts';
import { FOUNDATION_CHAPTERS, ritualTerms } from './chapters.ts';
import { canonical } from '../ledgerSync/patch.ts';
import { chapterTaskId } from './chapterTaskSource.ts';
/** Explicit reader/writer capability for the new agreement and canonical Task semantics. */
export const CHAPTER_AGREEMENT_VERSION = 1;
export const CHAPTER_COMMANDS = ['openChapter', 'addRitual', 'editRitual', 'acknowledgeRitualChange', 'setRitualParticipation', 'adoptChapterTasks', 'prepareRitualOccurrence', 'recordRitualHeld', 'setRitualState', 'offerMove', 'respondToMove', 'completeMove', 'closeChapter', 'closeChapterAtSitdown'] as const;
export function hasChapterAgreementData(h: Pick<Household, 'chapters' | 'rituals' | 'moves' | 'tasks'>): boolean {
  return Boolean(h.chapters?.some(row => row.closure) || h.rituals?.some(row => row.agreement || row.taskAdoption || row.participation?.length) || h.moves?.some(row => row.taskId) || h.tasks?.some(row => row.chapterSource));
}
/** These commands validate their own narrow revisions at the serialized authority. */
export function isChapterAgreementCommand(kind: string): boolean { return (CHAPTER_COMMANDS as readonly string[]).includes(kind); }
/** Run after all collections are shaped, and after recovery/materialization. */
export function assertChapterTaskGraph(h: Pick<Household, 'chapters' | 'rituals' | 'moves' | 'tasks'>): void {
  for (const chapter of h.chapters ?? []) {
    const accepted = chapter.closure?.proposals.find(row => row.id === chapter.closure?.acceptedProposalId);
    if (accepted && (chapter.state !== accepted.terms.outcome || chapter.carryForward !== accepted.terms.carryForward || chapter.closedAtSitdownId !== accepted.terms.sitdownId || chapter.closedAt !== accepted.acceptedAt)) chapterConsentFail('A Chapter changed outside its accepted closure. Restore its exact history.');
    if (accepted?.terms.nextChapter) {
      const next = accepted.terms.nextChapter, foundation = FOUNDATION_CHAPTERS.find(row => row.id === next.foundationId);
      const openings = (h.chapters ?? []).filter(row => row.id !== chapter.id && row.openedAt === accepted.acceptedAt && row.openedByMemberId === next.ownerMemberId && row.intendedMonth === next.month && row.openedAtSitdownId === accepted.terms.sitdownId);
      const opened = openings[0];
      if (openings.length !== 1 || !opened || opened.foundationId !== (next.foundationId ?? null) || opened.title !== (foundation?.title ?? next.custom?.title) || opened.meaning !== (next.custom?.meaning ?? foundation?.meaning ?? '') || opened.lessonId !== (next.custom?.lessonId ?? foundation?.lessonId ?? '') || opened.betterFeelsLike !== (next.custom?.betterFeelsLike ?? foundation?.betterFeelsLike ?? '')) chapterConsentFail('Restore the exact next Chapter that both people reviewed.');
    }

  }
  for (const ritual of h.rituals ?? []) {
    validateRitualClosureReference(h, ritual);
    const closure = ritual.approvalViaClosure ? h.chapters?.find(row => row.id === ritual.chapterId)?.closure?.proposals.find(row => row.id === ritual.approvalViaClosure!.proposalId)?.terms.rituals.find(row => row.ritualId === ritual.id) : null;
    const agreed = closure ? { ...closure.before, state: closure.afterState } : ritual.agreement?.proposals.find(row => row.id === ritual.agreement?.acceptedProposalId)?.terms;
    if (agreed && canonical(ritualTerms(ritual)) !== canonical(agreed)) chapterConsentFail('A Ritual changed outside its accepted terms. Restore its exact shared review.');
  }
  for (const move of h.moves ?? []) {
    if (!move.taskId) continue;
    const task = h.tasks?.find(row => row.id === move.taskId);
    if (!task || task.chapterSource?.kind !== 'chapter-move' || task.chapterSource.sourceId !== move.id || task.chapterSource.chapterId !== move.chapterId || move.taskId !== chapterTaskId('chapter-move', move.id)) chapterConsentFail('A Chapter Move needs its canonical Task restored.');
  }
  for (const task of h.tasks ?? []) {
    const source = task.chapterSource; if (!source) continue;
    if (source.kind === 'ritual-occurrence') {
      const ritual = h.rituals?.find(row => row.id === source.sourceId);
      if (!ritual || !ritual.taskAdoption || ritual.chapterId !== source.chapterId) chapterConsentFail('A dated Task needs its original Ritual restored.');
    } else if (!h.moves?.some(row => row.id === source.sourceId && row.taskId === task.id)) chapterConsentFail('A Task needs its original Chapter Move restored.');
    if (!h.chapters?.some(row => row.id === source.chapterId)) chapterConsentFail('A Task needs its original Chapter restored.');
  }
}
