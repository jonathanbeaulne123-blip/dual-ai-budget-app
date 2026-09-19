import { describe, expect, it } from 'vitest';
import { addGoal, financialAuditHash, fundGoal, openChapter } from '../src/core/index.ts';
import { editRitual, movesForChapter, ritualAgreementRevision, ritualTerms, ritualsForChapter } from '../src/core/chapters.ts';
import { closeSyntheticChapter, completeSyntheticMove, holdSyntheticRitual } from '../src/core/syntheticChapters.ts';
import { assertChapterTaskGraph } from '../src/core/chapterAuthority.ts';
import { focusedAgendaTask } from '../src/core/agenda.ts';
import { pathStones } from '../src/core/pathStones.ts';
import { planLifeFixture } from './fixtures/plan-life.ts';

const first = 'MEM-001', second = 'MEM-002', at = '2026-09-05T20:00:00.000Z';

describe('synthetic Chapter history uses the actual authority commands', () => {
  it('keeps separate paired approvals and records the responsible completer without changing money', async () => {
    let h = openChapter(planLifeFixture('household'), { memberId: first, foundationId: 'see-our-shared-life', at }).household;
    const before = await financialAuditHash(h), chapter = h.chapters![0]!, ritual = h.rituals![0]!;
    h = holdSyntheticRitual(h, { memberId: second, ritualId: ritual.id, onDate: '2026-09-05', at });
    h = completeSyntheticMove(h, { memberId: second, moveId: h.moves![0]!.id, at });
    expect(ritualsForChapter(h, chapter.id)[0]!.heldOn).toEqual(['2026-09-05']);
    expect(movesForChapter(h, chapter.id)[0]).toMatchObject({ state: 'done', ownerMemberId: second, completedByMemberId: second });
    h = closeSyntheticChapter(h, { memberId: first, chapterId: chapter.id, outcome: 'established', at });
    expect(h.chapters![0]!.closure!.proposals[0]!.approvals.map(row => row.memberId)).toEqual([first, second]);
    expect(h.rituals![0]!.agreement!.proposals[0]!.approvals.map(row => row.memberId)).toEqual([first, second]);
    expect(() => assertChapterTaskGraph(h)).not.toThrow();
    expect(await financialAuditHash(h)).toBe(before);
  });

  it('leaves money occurrences open until a real receipt for the same date exists', async () => {
    let h = addGoal(planLifeFixture('household'), { name: 'Fictional buffer', target: '100', shared: true, ownerMemberId: first }).household;
    const goalId = h.goals.at(-1)!.id;
    h = fundGoal(h, { goalId, amount: '10', fromAccountId: 'ACC-CHEQUING', date: '2026-09-05', createdBy: first, visibility: 'household' }).household;
    h = openChapter(h, { memberId: first, foundationId: 'build-breathing-room', at }).household;
    const ritual = h.rituals![0]!;
    h = editRitual(h, { memberId: first, ritualId: ritual.id, expectedRevision: ritualAgreementRevision(ritual), terms: { ...ritualTerms(ritual), moneyLink: { kind: 'goal', goalId } }, at }).household;
    const before = await financialAuditHash(h);
    h = holdSyntheticRitual(h, { memberId: second, ritualId: ritual.id, onDate: '2026-09-04', at });
    const missing = h.tasks!.find(row => row.chapterSource?.onDate === '2026-09-04')!;
    expect(missing).toMatchObject({ completedAt: null, completionEvidence: null, acknowledgedBy: [second] });
    const agendaInput = { memberId: second, view: 'household' as const, today: '2026-09-05' };
    expect(focusedAgendaTask(h, missing.id, agendaInput)).toMatchObject({ done: false, evidence: null });
    expect(pathStones(h, second, '2026-09-05').find(row => row.id === missing.id)).toMatchObject({ state: 'waiting', lit: false });
    const receipt = h.goalContributions!.find(row => row.goalId === goalId)!;
    const evidence = { kind: 'goal-contribution' as const, contributionId: receipt.id, amountCents: receipt.amountCents, date: receipt.date };
    expect(() => holdSyntheticRitual(h, { memberId: second, ritualId: ritual.id, onDate: '2026-09-04', evidence, at })).toThrow(/occurrence.*date/i);
    h = holdSyntheticRitual(h, { memberId: second, ritualId: ritual.id, onDate: receipt.date, at });
    const matching = h.tasks!.find(row => row.chapterSource?.onDate === receipt.date)!;
    expect(focusedAgendaTask(h, matching.id, agendaInput)).toMatchObject({ done: false, evidence: null });
    expect(pathStones(h, second, '2026-09-05').find(row => row.id === matching.id)).toMatchObject({ state: 'waiting', lit: false });
    h = holdSyntheticRitual(h, { memberId: second, ritualId: ritual.id, onDate: receipt.date, evidence, at });
    expect(ritualsForChapter(h, ritual.chapterId)[0]!.heldOn).toEqual([receipt.date]);
    expect(h.rituals![0]!.requiresMoneyEvidence).toBe(true);
    expect(() => assertChapterTaskGraph(h)).not.toThrow();
    expect(focusedAgendaTask(h, matching.id, agendaInput)).toMatchObject({ done: true, evidence });
    expect(pathStones(h, second, '2026-09-05').find(row => row.id === matching.id)).toMatchObject({ state: 'done', lit: true });
    expect(await financialAuditHash(h)).toBe(before);
  });
});
