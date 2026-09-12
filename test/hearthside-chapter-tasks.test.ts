import { describe, expect, it } from 'vitest';
import { catalogHousehold } from '../src/core/seed.ts';
import { acknowledgeRitualChange, adoptChapterTasks, chapterClosureRevision, closeChapter as closeChapterCommand, reviewChapterClosure, completeMove, editRitual, movesForChapter, offerMove, openChapter, pendingChapterClosure, pendingRitualReview, prepareRitualOccurrence, recordRitualHeld, respondToMove, ritualAgreementRevision, ritualsForChapter, ritualTerms, setRitualParticipation, shapeChapters, shapeRituals, mergeChapters, mergeRituals, mergeMoves, type ChapterOutcome } from '../src/core/chapters.ts';
import { acknowledgeTask, completeTask, saveTask, validateTask, type Task, type TaskEvidence } from '../src/core/tasks.ts';
import { assertChapterTaskGraph } from '../src/core/chapterAuthority.ts';
import { chapterTask } from '../src/core/chapterTasks.ts';
import type { Household } from '../src/core/types.ts';
import { executeIntent } from '../src/ledgerSync/registry.ts';
import { financialAuditHash } from '../src/core/commandIdentity.ts';
import { splitForSync, ensureHouseholdShape } from '../src/core/sync.ts';
import { addGoal, contributeToGoal, postEntry } from '../src/core/commands.ts';

function closeChapter(h: Household, input: Parameters<typeof closeChapterCommand>[1]) { return closeChapterCommand(h, { ...input, ...(!input.proposalId ? { reviewDigest: reviewChapterClosure(h, input).reviewDigest } : {}) }); }
const A = 'MEM-001', B = 'MEM-002', AT = '2026-09-12T12:00:00.000Z';
function opened(foundationId = 'make-rent-boring' as Parameters<typeof openChapter>[1]['foundationId']) { return openChapter(catalogHousehold(), { memberId: A, foundationId, at: AT }).household; }
function approveRitual(h: Household) { const r = h.rituals![0]!, p = pendingRitualReview(r)!; return acknowledgeRitualChange(h, { memberId: B, ritualId: r.id, expectedRevision: ritualAgreementRevision(r), proposalId: p.id, digest: p.digest, at: AT }).household; }
function takeMove(h: Household, memberId = A) { const m = h.moves![0]!, task = h.tasks!.find(row => row.id === m.taskId)!; return respondToMove(h, { memberId, moveId: m.id, response: 'accept', expectedTaskRevision: task.revision, at: AT }).household; }
function proposeClosure(h: Household, outcome: ChapterOutcome = 'established') { const chapter = h.chapters![0]!; return closeChapter(h, { memberId: A, chapterId: chapter.id, expectedRevision: chapterClosureRevision(chapter), outcome, carryForward: 'Keep our little habit', at: AT }).household; }
function finishClosure(h: Household) { const chapter = h.chapters![0]!, p = pendingChapterClosure(chapter)!; return closeChapter(h, { memberId: B, chapterId: chapter.id, expectedRevision: chapterClosureRevision(chapter), outcome: p.terms.outcome, carryForward: p.terms.carryForward, sitdownId: p.terms.sitdownId ?? undefined, proposalId: p.id, digest: p.digest, at: AT }).household; }
function occurrence(h: Household, date = '2026-09-12') { const r = h.rituals![0]!; return chapterTask(h, { kind: 'ritual-occurrence', sourceId: r.id, onDate: date })!; }
function prepareOccurrence(h: Household, date = '2026-09-12') { const r = h.rituals![0]!; return prepareRitualOccurrence(h, { memberId: A, ritualId: r.id, onDate: date, expectedRevision: ritualAgreementRevision(r), at: AT }).household; }

describe('exact shared Chapter and Ritual agreements', () => {
  it('opens one canonical Move Task and keeps the initial Ritual proposal unapproved by the partner', async () => {
    const before = catalogHousehold(), h = openChapter(before, { memberId: A, foundationId: 'make-rent-boring', at: AT }).household; expect(h.tasks).toHaveLength(1); expect(h.moves![0]!.taskId).toBe(h.tasks![0]!.id);
    expect(pendingRitualReview(h.rituals![0]!)!.approvals.map(row => row.memberId)).toEqual([A]); expect(() => prepareOccurrence(h)).toThrow(/Both of you/);
    expect(await financialAuditHash(h)).toBe(await financialAuditHash(before));
    const shaped = ensureHouseholdShape(h); expect(shaped.tasks).toEqual(h.tasks); expect(shaped.rituals).toEqual(h.rituals); expect(splitForSync(shaped, A).shared.tasks).toEqual(h.tasks);
  });
  it('leaves a Chapter open after the first approval and applies the complete reviewed closure after the second', () => {
    const h = proposeClosure(opened()), chapter = h.chapters![0]!, p = pendingChapterClosure(chapter)!;
    expect(chapter.state).toBe('open'); expect(h.rituals![0]!.state).toBe('active'); expect(p.terms.rituals[0]!.before.doneDefinition).toBe(h.rituals![0]!.doneDefinition); expect(p.terms.moves).toHaveLength(1);
    const closed = finishClosure(h); expect(closed.chapters![0]!.state).toBe('established'); expect(closed.rituals![0]!.state).toBe('graduated'); expect(movesForChapter(closed, chapter.id)[0]!.state).toBe('paused'); expect(closed.wins!.filter(w => w.level === 'graduation')).toHaveLength(1);
    expect(closed.rituals![0]!.approvalViaClosure?.proposalId).toBe(p.id); expect(prepareOccurrence(closed).tasks).toHaveLength(2);
  });
  it('rejects a stale closure after Task changes and rejects old-client and forged-actor closure calls', () => {
    const proposed = proposeClosure(opened()), changed = takeMove(proposed);
    expect(() => finishClosure(changed)).toThrow(/terms or participants changed/);
    const chapter = proposed.chapters![0]!, p = pendingChapterClosure(chapter)!;
    expect(() => executeIntent(proposed, 'closeChapter', [{ memberId: B, chapterId: chapter.id, expectedRevision: 1, proposalId: p.id, digest: p.digest, outcome: p.terms.outcome, carryForward: p.terms.carryForward }], A, 'spoof')).toThrow('ACTOR_MISMATCH');
    expect(() => closeChapter(proposed, { memberId: A, chapterId: chapter.id, outcome: 'closed' })).toThrow(/exact current/);
  });
  it('changing the proposed closure resets approvals while retaining earlier proposals', () => {
    let h = proposeClosure(opened()); const first = pendingChapterClosure(h.chapters![0]!)!;
    h = closeChapter(h, { memberId: B, chapterId: h.chapters![0]!.id, expectedRevision: 1, outcome: 'life-changed', carryForward: 'A smaller next step', at: AT }).household;
    expect(h.chapters![0]!.closure!.proposals[0]!.state).toBe('superseded'); expect(pendingChapterClosure(h.chapters![0]!)!.approvals.map(row => row.memberId)).toEqual([B]);
    expect(() => closeChapter(h, { memberId: B, chapterId: h.chapters![0]!.id, expectedRevision: 2, outcome: first.terms.outcome, carryForward: first.terms.carryForward, proposalId: first.id, digest: first.digest })).toThrow();
  });
  it('pauses only the actor immediately and preserves responsibility and unrelated pending approval', () => {
    let h = opened(), r = h.rituals![0]!;
    h = setRitualParticipation(h, { memberId: A, ritualId: r.id, expectedMemberRevision: 0, paused: true, at: AT }).household;
    expect(h.rituals![0]!.ownerMemberId).toBe(A); expect(h.rituals![0]!.backupMemberId).toBe(B); expect(h.rituals![0]!.state).toBe('active'); expect(ritualAgreementRevision(h.rituals![0]!)).toBe(1);
    h = approveRitual(h); expect(h.rituals![0]!.agreement!.acceptedProposalId).not.toBeNull(); expect(() => prepareOccurrence(h)).toThrow(/paused/);
    expect(() => setRitualParticipation(h, { memberId: A, ritualId: r.id, expectedMemberRevision: 0, paused: false })).toThrow(/changed/);
    h = setRitualParticipation(h, { memberId: A, ritualId: r.id, expectedMemberRevision: 1, paused: false, at: AT }).household; expect(prepareOccurrence(h).tasks).toHaveLength(2);
  });
  it('requires exact-version mutual review for changing the Ritual owner or recovery', () => {
    const initial = approveRitual(opened()), r = initial.rituals![0]!, terms = { ...ritualTerms(r), ownerMemberId: B, backupMemberId: A, recoveryMove: 'We choose a smaller version together.' };
    const proposed = editRitual(initial, { memberId: A, ritualId: r.id, expectedRevision: ritualAgreementRevision(r), terms, at: AT }).household;
    expect(proposed.rituals![0]!.ownerMemberId).toBe(A); const p = pendingRitualReview(proposed.rituals![0]!)!;
    expect(() => acknowledgeRitualChange(proposed, { memberId: B, ritualId: r.id, expectedRevision: 2, proposalId: p.id, digest: p.digest })).toThrow(/changed/);
    const accepted = acknowledgeRitualChange(proposed, { memberId: B, ritualId: r.id, expectedRevision: 3, proposalId: p.id, digest: p.digest, at: AT }).household;
    expect(accepted.rituals![0]!.ownerMemberId).toBe(B); expect(accepted.rituals![0]!.recoveryMove).toBe(terms.recoveryMove);
  });
  it('refuses participant changes and tampered persisted agreement terms', () => {
    const h = opened(), r = h.rituals![0]!, changed = structuredClone(h); changed.members.push({ ...changed.members[0]!, id: 'MEM-003' });
    expect(() => approveRitual(changed)).toThrow(/participants changed/);
    const raw = structuredClone(r); raw.agreement!.proposals[0]!.terms.title = 'Rewritten after approval'; expect(() => shapeRituals([raw])).toThrow(/changed after/);
    const c = proposeClosure(h).chapters![0]!; c.closure!.proposals[0]!.approvals.push({ memberId: B, at: AT }); c.closure!.proposals[0]!.state = 'accepted'; c.closure!.proposals[0]!.acceptedAt = AT;
    // The decoder preserves receipt structure; only authenticated commands may
    // create approvals. This malformed accepted pointer is refused as well.
    c.closure!.acceptedProposalId = 'missing'; expect(() => shapeChapters([c])).toThrow(/restored/);
  });
});

describe('one Task completion across Chapter and Planner', () => {
  it('uses the same occurrence identity, assignment acceptance and completion in both views', () => {
    let h = prepareOccurrence(approveRitual(opened())), task = occurrence(h); const id = task.id;
    expect(prepareOccurrence(h).tasks!.filter(row => row.id === id)).toHaveLength(1);
    expect(() => recordRitualHeld(h, { memberId: A, ritualId: h.rituals![0]!.id, onDate: '2026-09-12', expectedTaskRevision: task.revision })).toThrow(/Accept/);
    h = acknowledgeTask(h, { memberId: A, id, expectedRevision: task.revision }).household; task = occurrence(h);
    h = completeTask(h, { memberId: A, id, expectedRevision: task.revision, completedAt: AT }).household;
    expect(ritualsForChapter(h, h.chapters![0]!.id)[0]!.heldOn).toEqual(['2026-09-12']); expect(h.rituals![0]!.heldOn).toEqual([]);
    expect(() => recordRitualHeld(h, { memberId: A, ritualId: h.rituals![0]!.id, onDate: '2026-09-12', expectedTaskRevision: occurrence(h).revision })).toThrow(/already done/);
    expect(prepareOccurrence(h, '2026-09-19').tasks!.filter(row => row.chapterSource?.kind === 'ritual-occurrence')).toHaveLength(2);
  });
  it('a partner cannot complete another person’s unaccepted assignment or silently take it', () => {
    let h = opened(); const chapter = h.chapters![0]!;
    h = offerMove(h, { memberId: A, chapterId: chapter.id, text: 'Call the vet', ownerMemberId: A, at: AT }).household; const move = h.moves!.at(-1)!, task = h.tasks!.find(row => row.id === move.taskId)!;
    expect(() => completeTask(h, { memberId: B, id: task.id, expectedRevision: task.revision })).toThrow(/responsible/);
    expect(() => respondToMove(h, { memberId: B, moveId: move.id, response: 'accept', expectedTaskRevision: task.revision })).toThrow(/cannot take/);
    expect(() => completeMove(h, { memberId: A, moveId: move.id, expectedTaskRevision: task.revision })).toThrow(/Accept/);
  });
  it('money Rituals need accepted evidence and a generic tick cannot bypass that rule', () => {
    expect(() => prepareOccurrence(approveRitual(opened('build-breathing-room')))).toThrow(/existing bank/);
    let h = addGoal(opened('build-breathing-room'), { name: 'Buffer', target: 100, shared: true }).household;
    const ritual = h.rituals![0]!, goal = h.goals[0]!;
    h = editRitual(h, { memberId: A, ritualId: ritual.id, expectedRevision: ritualAgreementRevision(ritual), terms: { ...ritualTerms(ritual), moneyLink: { kind: 'goal', goalId: goal.id } }, at: AT }).household;
    h = prepareOccurrence(approveRitual(h)); let task = occurrence(h);
    h = acknowledgeTask(h, { memberId: A, id: task.id, expectedRevision: task.revision }).household; task = occurrence(h);
    expect(() => completeTask(h, { memberId: A, id: task.id, expectedRevision: task.revision })).toThrow(/evidence/);
    const fake: TaskEvidence = { kind: 'transaction', transactionId: 'not-in-books', date: '2026-09-12', amountCents: 300 };
    expect(() => completeTask(h, { memberId: A, id: task.id, expectedRevision: task.revision, evidence: fake })).toThrow(/not in the books/);
    const posted = postEntry(h, { type: 'expense', date: '2026-09-12', amount: '3.00', accountId: 'ACC-VISA', subcategoryId: 'SUB-FOOD-GROCERIES', note: 'Synthetic accepted test receipt', createdBy: A, visibility: 'household', confirmDuplicate: true }); h = posted.household;
    const tx = h.transactions.find(row => posted.postedIds.includes(row.id))!;
    expect(() => completeTask(h, { memberId: A, id: task.id, expectedRevision: task.revision, evidence: { kind: 'transaction', transactionId: tx.id, amountCents: tx.amountCents, date: tx.date } })).toThrow(/goal’s accepted contribution/);
    h = contributeToGoal(h, goal.id, 3, { createdBy: A, date: '2026-09-12' }).household; const contribution = h.goalContributions!.at(-1)!;
    h = recordRitualHeld(h, { memberId: A, ritualId: h.rituals![0]!.id, onDate: '2026-09-12', expectedTaskRevision: task.revision, evidence: { kind: 'goal-contribution', contributionId: contribution.id, amountCents: contribution.amountCents, date: contribution.date }, at: AT }).household;
    expect(occurrence(h).completionEvidence).toMatchObject({ contributionId: contribution.id });
    h = prepareOccurrence(h, '2026-09-19'); const later = occurrence(h, '2026-09-19'); h = acknowledgeTask(h, { memberId: A, id: later.id, expectedRevision: later.revision }).household;
    expect(() => completeTask(h, { memberId: A, id: later.id, expectedRevision: later.revision + 1, evidence: { kind: 'goal-contribution', contributionId: contribution.id, amountCents: contribution.amountCents, date: contribution.date } })).toThrow(/occurrence’s date/);
  });
  it('adopts legacy identities once without inventing the unknown author, completion instant or receipt', () => {
    const h = opened(), move = h.moves![0]!, ritual = h.rituals![0]!; h.tasks = [];
    delete move.taskId; delete move.createdByMemberId; delete move.sharedApprovals; move.state = 'done'; move.completedAt = AT; move.completedByMemberId = null; move.evidenceRef = 'older-unverified-reference';
    delete ritual.taskAdoption; delete ritual.agreement; ritual.heldOn = ['2026-08-01', '2026-08-08'];
    const adopted = adoptChapterTasks(h, { memberId: A, at: AT }).household; expect(adopted.tasks).toHaveLength(3);
    const moved = adopted.tasks!.find(row => row.chapterSource!.kind === 'chapter-move')!; expect(moved.createdBy).toBeNull(); expect(moved.completedBy).toBeNull(); expect(moved.completionEvidence).toBeNull(); expect(moved.chapterSource!.legacy!.evidenceRef).toBe('older-unverified-reference');
    const earlier = adopted.tasks!.filter(row => row.chapterSource!.kind === 'ritual-occurrence'); expect(earlier.every(row => row.deleted && row.createdBy === null && row.completedAt === null && row.completedBy === null)).toBe(true);
    expect(ritualsForChapter(adopted, h.chapters![0]!.id)[0]!.heldOn).toEqual(ritual.heldOn); expect(adoptChapterTasks(adopted, { memberId: B, at: AT }).household.tasks).toEqual(adopted.tasks);
    expect(ensureHouseholdShape(adopted).tasks).toEqual(adopted.tasks);
  });
  it('rejects generic Task source injection and invalidates assignment acceptance when work changes', () => {
    let h = takeMove(opened()), task = h.tasks![0]!;
    expect(task.acknowledgedBy).toEqual([A]);
    const fake: Task = { ...task, id: 'TASK-forged', revision: 1 }; expect(() => saveTask(h, { memberId: A, id: fake.id, expectedRevision: 0, task: fake })).toThrow(/sources/);
    h = saveTask(h, { memberId: A, id: task.id, expectedRevision: task.revision, task: { ...task, title: 'A materially different task' } }).household; task = h.tasks![0]!;
    expect(task.acknowledgedBy).toEqual([]); expect(() => completeTask(h, { memberId: A, id: task.id, expectedRevision: task.revision })).toThrow(/Accept/);
    const invalid = { ...task, createdBy: null }; expect(() => validateTask(invalid)).toThrow(/valid owner/);
  });
});

describe('canonical recovery and older clients', () => {
  it('does not let a newer wall clock erase exact Chapter agreement history or Task adoption', () => {
    const early = opened(), modern = finishClosure(proposeClosure(early));
    const stale = structuredClone(early); stale.chapters![0]!.updatedAt = '2099-01-01T00:00:00Z'; stale.rituals![0]!.updatedAt = '2099-01-01T00:00:00Z'; delete stale.rituals![0]!.agreement; delete stale.rituals![0]!.taskAdoption;
    expect(mergeChapters(modern.chapters, stale.chapters)[0]!.state).toBe('established'); expect(mergeRituals(modern.rituals, stale.rituals)[0]!.approvalViaClosure).toEqual(modern.rituals![0]!.approvalViaClosure);
    const divergent = structuredClone(modern.chapters!); divergent[0]!.closure!.proposals[0]!.approvals[1]!.at = '2026-09-13T00:00:00Z'; expect(() => mergeChapters(modern.chapters, divergent)).toThrow(/Conflicting/);
    const adoptedMove = modern.moves![0]!, oldMove = { ...adoptedMove, updatedAt: '2099-01-01T00:00:00Z' }; delete oldMove.taskId; delete oldMove.sharedApprovals;
    expect(mergeMoves([oldMove], [adoptedMove])[0]!.taskId).toBe(adoptedMove.taskId);
  });
  it('combines independent own participation without unioning ambiguous approvals', () => {
    const h = opened(), id = h.rituals![0]!.id;
    const a = setRitualParticipation(h, { memberId: A, ritualId: id, expectedMemberRevision: 0, paused: true, at: AT }).household;
    const b = setRitualParticipation(h, { memberId: B, ritualId: id, expectedMemberRevision: 0, paused: true, at: AT }).household;
    expect(mergeRituals(a.rituals, b.rituals)[0]!.participation!.map(row => row.memberId)).toEqual([A, B]);
    const conflict = structuredClone(a.rituals!); conflict[0]!.participation![0]!.paused = false; expect(() => mergeRituals(a.rituals, conflict)).toThrow(/Conflicting/);
  });
  it('rejects dangling Task and closure references, and mutated canonical occurrence dates', () => {
    const h = prepareOccurrence(finishClosure(proposeClosure(opened()))); assertChapterTaskGraph(h);
    const noTask = structuredClone(h); noTask.tasks = []; expect(() => assertChapterTaskGraph(noTask)).toThrow(/canonical Task/);
    const badClosure = structuredClone(h); badClosure.rituals![0]!.approvalViaClosure!.proposalId = 'missing'; expect(() => assertChapterTaskGraph(badClosure)).toThrow(/closure restored/);
    const task = occurrence(h); expect(() => validateTask({ ...task, doDate: '2026-09-19' })).toThrow(/original Task identity and date/);
  });
  it('supports private self-authored work and an explicit atomic claim of shared unassigned work', () => {
    let h = opened(), source = h.tasks![0]!;
    const { chapterSource: _source, participation: _pause, ...plain } = source;
    h = saveTask(h, { memberId: A, id: 'TASK-self', expectedRevision: 0, task: { ...plain, visibility: 'personal', assigneeId: null, backupId: null, chapterId: null } }).household;
    h = completeTask(h, { memberId: A, id: 'TASK-self', expectedRevision: 1, completedAt: AT }).household; expect(h.tasks!.find(row => row.id === 'TASK-self')!.completedBy).toBe(A);
    h = saveTask(h, { memberId: A, id: 'TASK-unassigned', expectedRevision: 0, task: { ...plain, assigneeId: null, backupId: null, chapterId: null } }).household;
    h = acknowledgeTask(h, { memberId: B, id: 'TASK-unassigned', expectedRevision: 1 }).household; const task = h.tasks!.find(row => row.id === 'TASK-unassigned')!;
    expect(task.assigneeId).toBe(B); expect(task.acknowledgedBy).toEqual([B]); expect(() => completeTask(h, { memberId: A, id: task.id, expectedRevision: task.revision })).toThrow(/responsible/);
  });
});

describe('serialized authority integration (apply chapter-authority-integration.patch)', () => {
  it('replays real captured proposals with authenticated authors and refuses missing capability or forged approvals', async () => {
    const { prepareCommand } = await import('../src/ledgerSync/authority.ts');
    const { commandFromCapture } = await import('../src/ledgerSync/protocol.ts');
    const { capturedIntent, clearCapturedIntent } = await import('../src/ledgerSync/capture.ts');
    const { assembleHousehold } = await import('../src/core/sync.ts');
    const initial = catalogHousehold(), a = splitForSync(initial, A), b = splitForSync(initial, B);
    let state = { sequence: 0, shared: a.shared, personal: new Map([[A, a.personal], [B, b.personal]]) };
    const baseScope = { environment: initial.environment, householdId: initial.householdId, subject: 'synthetic-subject', role: 'owner' as const, expires: 9e12, aclEpoch: 1 };
    const run = async (memberId: string, command: (h: Household) => { household: Household }) => {
      const current = assembleHousehold(state.shared, state.personal.get(memberId)!, { linked: true }); clearCapturedIntent(current);
      const candidate = command(current).household, packet = await commandFromCapture(capturedIntent(candidate)!, baseScope, crypto.randomUUID());
      const scope = { ...baseScope, memberId };
      const old = { ...packet }; delete old.chapterAgreementVersion; await expect(prepareCommand(state, old, scope, () => {})).rejects.toThrow(/CLIENT_RELOAD_REQUIRED/);
      const prepared = await prepareCommand(state, packet, scope, () => {}); state = { sequence: prepared.event.sequence, shared: prepared.shared, personal: new Map(state.personal).set(memberId, prepared.personal) }; return prepared.household;
    };
    let h = await run(A, current => openChapter(current, { memberId: A, foundationId: 'make-rent-boring', at: AT }));
    let r = h.rituals![0]!, p = pendingRitualReview(r)!;
    h = await run(B, current => acknowledgeRitualChange(current, { memberId: B, ritualId: r.id, expectedRevision: ritualAgreementRevision(r), proposalId: p.id, digest: p.digest, at: AT }));
    expect(h.rituals![0]!.agreement!.proposals[0]!.approvals.map(row => row.memberId)).toEqual([A, B]);
    h = await run(A, current => prepareRitualOccurrence(current, { memberId: A, ritualId: r.id, expectedRevision: ritualAgreementRevision(h.rituals![0]!), onDate: '2026-09-12', at: AT }));
    expect(h.tasks!.filter(task => task.chapterSource?.kind === 'ritual-occurrence')).toHaveLength(1);
    expect(() => executeIntent(h, 'setRitualParticipation', [{ memberId: B, ritualId: r.id, expectedMemberRevision: 0, paused: true }], A, 'forged')).toThrow('ACTOR_MISMATCH');
    const r2 = h.rituals![0]!; expect(() => executeIntent(h, 'editRitual', [{ memberId: A, ritualId: r.id, expectedRevision: ritualAgreementRevision(r2), terms: { ...ritualTerms(r2), approvals: [A, B] } }], A, 'forged-terms')).toThrow(/not supported/);
  });
});

it('rejects closure agreement if its affected work changed after the author reviewed it', () => { const h = opened(), input = { memberId: A, chapterId: h.chapters![0]!.id, outcome: 'closed' as const, expectedRevision: 0 }; const review = reviewChapterClosure(h, input); expect(() => closeChapterCommand(h, input)).toThrow(/Read the affected/); const changed = takeMove(h); expect(() => closeChapterCommand(changed, { ...input, reviewDigest: review.reviewDigest })).toThrow(/exact closure review/); });
