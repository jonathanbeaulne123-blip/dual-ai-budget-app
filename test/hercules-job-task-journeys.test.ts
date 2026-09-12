import { describe, expect, it } from 'vitest';
import { catalogHousehold, postEntry, postWorkShift } from '../src/core/index.ts';
import { actionById, actionFields, executeReviewedAction, prepareAction, type ActionContext, type ActionValues } from '../src/core/herculesActions.ts';
import { executeHerculesAction } from '../src/core/herculesExecution.ts';
import { companionFor, commitCompanion } from '../src/core/herculesCompanion.ts';
import { capturedIntent } from '../src/ledgerSync/capture.ts';
import { commandFromCapture, type Scope } from '../src/ledgerSync/protocol.ts';
import { prepareCommand } from '../src/ledgerSync/authority.ts';
import { splitForSync } from '../src/core/sync.ts';
import { adoptBoardTasks, saveTask } from '../src/core/tasks.ts';
import { saveBoardTask } from '../src/core/commands.ts';
import { deterministicHerculesReadFallback } from '../src/core/herculesPlanner.ts';

function context(view: 'personal' | 'household' = 'household'): ActionContext {
  const household = catalogHousehold();
  if (view === 'personal') household.accounts = household.accounts.map(a => ({ ...a, scope: 'personal', ownerMemberId: 'MEM-001' }));
  return { household, memberId: 'MEM-001', view, today: '2026-09-12' };
}
function run(c: ActionContext, id: string, values: ActionValues) {
  const review = prepareAction(c, id, values);
  c.household = executeReviewedAction(c, review, crypto.randomUUID()).household;
  return review;
}
const jobValues: ActionValues = { name: 'Cafe Moonbeam', roleName: 'Server', effectiveDate: '2026-09-01', grossRate: '18',
  takeHomeMethod: 'deductions', deductionPercent: '22', tipped: 'no', wagesAccountId: 'ACC-CHEQUING', overtime: 'no', payCadence: 'irregular' };

describe('job setup supports a separately reviewed shift', () => {
  it.each(['personal', 'household'] as const)('creates only settings in %s, then posts the supplied shift once', view => {
    const c = context(view), original = structuredClone(c.household);
    const review = prepareAction(c, 'add-job', jobValues);
    expect(c.household).toEqual(original);
    expect(review.effects).toEqual([]);
    c.household = executeReviewedAction(c, review, crypto.randomUUID()).household;
    expect(c.household.transactions).toEqual(original.transactions);
    const job = c.household.workJobs.at(-1)!;
    expect(job.memberId).toBe(c.memberId);
    expect(job.defaults.wagesVisibility).toBe(view);
    const shift = prepareAction(c, 'worked-shift', { jobId: job.id, roleId: job.roles[0]!.id, date: c.today, workedHours: '6', paidBreakHours: '0' });
    expect(c.household.shifts).toHaveLength(0);
    c.household = executeReviewedAction(c, shift, crypto.randomUUID()).household;
    expect(c.household.shifts).toHaveLength(1);
    expect(c.household.shifts[0]!.wagesCents).toBe(8424);
  });
  it('refuses another member’s account and does not accept injected owner or owed identities', () => {
    const c = context('personal');
    c.household.accounts.find(a => a.id === 'ACC-CHEQUING')!.ownerMemberId = 'MEM-002';
    expect(() => prepareAction(c, 'add-job', jobValues)).toThrow();
    const safe = context();
    const review = prepareAction(safe, 'add-job', { ...jobValues, memberId: 'MEM-002', wagesReceivableAccountId: 'ACC-CHEQUING' });
    const result = executeReviewedAction(safe, review, crypto.randomUUID());
    expect(result.household.workJobs[0]!.memberId).toBe('MEM-001');
    expect(result.household.workJobs[0]!.wagesReceivableAccountId).not.toBe('ACC-CHEQUING');
    expect(review.values.memberId).toBeUndefined();
  });
  it('invalidates reviewed job creation when account or existing job facts change', () => {
    const c = context(), review = prepareAction(c, 'add-job', jobValues);
    c.household.accounts[0]!.name = 'Changed on another phone';
    expect(() => executeReviewedAction(c, review, crypto.randomUUID())).toThrow(/changed/i);
  });
  it('unknown wages block posting even with positive tips, while known zero deductions are distinguished', () => {
    const c = context();
    run(c, 'add-job', { ...jobValues, takeHomeMethod: 'unknown', tipped: 'yes', cashAccountId: 'ACC-CASH', cardAccountId: 'ACC-CHEQUING', tipOutBasis: 'none', tipPayRhythm: 'irregular' });
    const job = c.household.workJobs[0]!;
    const input = { memberId: c.memberId, jobId: job.id, roleId: job.roles[0]!.id, date: c.today, workedHours: 6, paidBreakHours: 0,
      cashTips: '10', cardTips: '0', customersServed: 1, staffingCount: 1, createdBy: c.memberId };
    expect(() => postWorkShift(c.household, input)).toThrow(/take-home is not set/i);
    job.paidBreakRate = 'custom'; job.paidBreakHourlyRateCents = 1500;
    expect(postWorkShift(c.household, { ...input, workedHours: 0, paidBreakHours: 1 }).household.shifts[0]!.paidBreakIncomeCents).toBe(1500);
    job.roles[0]!.rates[0]!.takeHomeMode = 'deductions';
    job.roles[0]!.rates[0]!.deductions = [{ id: 'D', label: 'Supplied', percent: 100 }];
    expect(postWorkShift(c.household, input).household.shifts).toHaveLength(1);
  });
  it('uses the shift-date rate when a future rate has a different take-home basis', () => {
    const c = context(); run(c, 'add-job', jobValues);
    const job = c.household.workJobs[0]!, rate = job.roles[0]!.rates[0]!;
    job.roles[0]!.rates.push({ ...rate, id: 'RATE-FUTURE', effectiveDate: '2026-10-01', takeHomeMode: 'direct', takeHomeHourlyRateCents: 0 });
    expect(() => prepareAction(c, 'worked-shift', { jobId: job.id, roleId: job.roles[0]!.id, date: c.today, workedHours: '6', paidBreakHours: '0' })).not.toThrow();
  });
});

describe('to-dos remain usable after Hercules creates them', () => {
  it.each(['personal', 'household'] as const)('creates, edits, completes, reopens and removes the same %s task', view => {
    const c = context(view), transactions = structuredClone(c.household.transactions);
    run(c, 'task', { title: 'Book the hotel', dueDate: '2026-10-01' });
    const id = c.household.tasks![0]!.id;
    run(c, 'edit-task', { id, title: 'Compare hotels first' });
    expect(c.household.tasks![0]!.dueDate).toBe('2026-10-01');
    run(c, 'complete-task', { id }); expect(c.household.tasks![0]!.completedAt).toBeTruthy();
    run(c, 'reopen-task', { id }); expect(c.household.tasks![0]!.completedAt).toBeNull();
    run(c, 'remove-task', { id }); expect(c.household.tasks![0]!.deleted).toBe(true);
    expect(c.household.tasks).toHaveLength(1);
    expect(c.household.transactions).toEqual(transactions);
  });
  it('cannot turn a financial task into a plain tick or disclose another member’s private task', () => {
    const c = context('personal'); run(c, 'task', { title: 'Book a hotel $600' });
    const id = c.household.tasks![0]!.id;
    expect(() => prepareAction(c, 'complete-task', { id })).toThrow();
    const partner = { ...c, memberId: 'MEM-002' };
    expect(actionFields(actionById('edit-task', partner), partner, {})[0]!.choices!(partner, {})).toEqual([]);
    expect(() => prepareAction(partner, 'edit-task', { id, title: 'Read private title' })).toThrow();
  });
  it('a stale review cannot replace newer edits, and recurrence keeps completed history', () => {
    const c = context(); run(c, 'task', { title: 'Water plants', dueDate: c.today });
    const task = c.household.tasks![0]!;
    c.household = saveTask(c.household, { memberId: c.memberId, id: task.id, expectedRevision: task.revision, task: { ...task, repeat: 'weekly' } }).household;
    const review = prepareAction(c, 'edit-task', { id: task.id, title: 'Water everything' });
    run(c, 'complete-task', { id: task.id });
    expect(c.household.tasks).toHaveLength(2);
    expect(c.household.tasks!.find(t => t.id === task.id)!.completedAt).toBeTruthy();
    expect(() => executeReviewedAction(c, review, crypto.randomUUID())).toThrow(/changed/i);
  });
  it('retains legacy drafts before adoption and requires a refreshed identity after adoption', () => {
    const c = context();
    c.household = saveBoardTask(c.household, { memberId: c.memberId, id: 'BOARD-TASK-old', expectedVersion: 0, title: 'Old board task', dueDate: null, completed: false, assigneeId: c.memberId }).household;
    const old = prepareAction(c, 'edit-task', { id: 'BOARD-TASK-old', title: 'Updated old task' });
    expect(executeReviewedAction(c, old, crypto.randomUUID()).household.kitchen.boards!.tasks[0]!.title).toBe('Updated old task');
    c.household = adoptBoardTasks(c.household, { memberId: c.memberId }).household;
    expect(() => executeReviewedAction(c, old, crypto.randomUUID())).toThrow();
    run(c, 'edit-task', { id: 'TASK-board-old', title: 'Updated planner task' });
    expect(c.household.tasks![0]!.title).toBe('Updated planner task');
  });
});

it('can select current posted-shift facts when the model planner is unavailable', () => {
  expect(deterministicHerculesReadFallback('Are my shifts posted this week?').calls[0]).toMatchObject({ name: 'shift_summary', args: { period: 'this_week', member: 'me' } });
  expect(deterministicHerculesReadFallback('How much did I earn on shifts last week?').calls[0]).toMatchObject({ name: 'shift_summary', args: { period: 'last_week' } });
  for (const text of ['Record my shift', 'What shifts are scheduled next week?', 'Are my shifts posted today?']) expect(deterministicHerculesReadFallback(text).calls).toEqual([]);
});


it('job prerequisite resumes the queued shift through one authoritative receipt without posting earnings', async () => {
  const c = context(), review = prepareAction(c, 'add-job', jobValues), id = crypto.randomUUID(), bridge = crypto.randomUUID();
  const claimed = commitCompanion(c.household, { version: 1, id: crypto.randomUUID(), scope: companionFor(c.household, c.memberId).scope,
    operation: { kind: 'workflow.set', workflowId: 'task-household', expectedRevision: 0, view: c.view, generation: 0,
      value: { version: 1, actionId: 'add-job', view: c.view, generation: 0, values: review.values, updatedAt: new Date().toISOString(),
        submission: { id, review: JSON.stringify(review) }, queue: [{ actionId: 'worked-shift', values: { date: c.today, workedHours: '6', paidBreakHours: '0' }, workspaceConfirmationId: bridge }] } } }).household;
  const result = executeHerculesAction(structuredClone(claimed), { memberId: c.memberId, view: c.view, today: c.today, submissionId: id, review });
  expect(result.household.transactions).toEqual(c.household.transactions);
  const resumed = companionFor(result.household, c.memberId).workflows![0]!.value!;
  expect(resumed).toMatchObject({ actionId: 'worked-shift', values: { date: c.today, workedHours: '6', paidBreakHours: '0', jobId: result.household.workJobs[0]!.id, roleId: 'ROLE-1' }, workspaceConfirmationId: bridge, submission: null });
  expect(() => executeHerculesAction(result.household, { memberId: c.memberId, view: c.view, today: c.today, submissionId: id, review })).toThrow(/no longer pending/);
  const scope: Scope = { environment: claimed.environment, householdId: claimed.householdId, memberId: c.memberId, subject: 'synthetic', role: 'owner', expires: Date.now() + 60000, aclEpoch: 1 };
  const one = splitForSync(claimed, c.memberId), two = splitForSync(claimed, 'MEM-002');
  const command = await commandFromCapture(capturedIntent(result.household)!, scope, id);
  const accepted = await prepareCommand({ sequence: claimed.revision, shared: one.shared, personal: new Map([[c.memberId, one.personal], ['MEM-002', two.personal]]) }, command, scope, () => {});
  expect(accepted.receipt.postedIds).toHaveLength(1);
  expect(accepted.personal.companionProfile?.workflows?.[0]?.value?.workspaceConfirmationId).toBe(bridge);
});


it('financial task completion uses matching accepted payment evidence, including owned both-view expenses', () => {
 const c=context('personal');run(c,'task',{title:'Pay rent $1000',dueDate:c.today});const id=c.household.tasks![0]!.id;
 c.household=postEntry(c.household,{createdBy:c.memberId,visibility:'personal',type:'income',date:c.today,amount:'1',accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES',note:'Wages'}).household;
 const wrong=c.household.transactions.at(-1)!;
 expect(()=>prepareAction(c,'complete-task',{id,evidence:`transaction:${wrong.id}`})).toThrow();
 c.household.accounts.find(a=>a.id==='ACC-CHEQUING')!.scope='shared';c.household.accounts.find(a=>a.id==='ACC-CHEQUING')!.ownerMemberId='joint';
 c.household=postEntry(c.household,{createdBy:c.memberId,visibility:'both',type:'expense',date:c.today,amount:'1000',accountId:'ACC-CHEQUING',subcategoryId:'SUB-FOOD-GROCERIES',note:'Rent'}).household;
 const payment=c.household.transactions.at(-1)!;
 run(c,'complete-task',{id,evidence:`transaction:${payment.id}`});
 expect(c.household.tasks![0]!.completionEvidence).toMatchObject({kind:'transaction',transactionId:payment.id,amountCents:100000});
});
