import { describe, expect, it, vi, afterEach } from 'vitest';
import { catalogHousehold } from '../src/core/seed.ts';
import { shapeWorkJob } from '../src/core/work.ts';
import type { WorkJob } from '../src/core/types.ts';
import { HERCULES_ACTIONS, availableHerculesActions, herculesWorkspaceActionCatalogue, type ActionContext } from '../src/core/herculesActions.ts';
import { executeWorkspaceActionQuery } from '../src/workspace/actionQueries.ts';
import { HERCULES_READ_TOOL_NAMES } from '../src/core/herculesTools.ts';
import { createWorkspaceProject } from '../src/workspace/contracts.ts';
import { executeWorkspaceTool, type ToolContext } from '../workers/workspace/tools.ts';
import { leaseGrant, requireWorkspaceReadGrant, WORKSPACE_GRANTED_READ_NAMES } from '../workers/workspace/grants.ts';
import { DEFAULT_RUN_BUDGET } from '../src/workspace/runtime.ts';
const now = '2026-09-12T16:00:00.000Z';
function job(memberId: string, id: string): WorkJob {
  return shapeWorkJob({ id, memberId, name: id, color: '#abcdef', active: true, timezone: 'America/Toronto', locationName: '', gpsEnabled: false,
    roles: [{ id: `${id}-role`, name: `${id}-role`, tipped: true, active: true, rates: [{ id: `${id}-rate`, effectiveDate: '2026-09-01', grossHourlyRateCents: 1800, takeHomeMode: 'direct', takeHomeHourlyRateCents: 1500, deductions: [], createdAt: now, updatedAt: now }], createdAt: now, updatedAt: now }],
    paidBreakRate: 'role', paidBreakHourlyRateCents: 0, overtimeEnabled: false, overtimeWeeklyThresholdHours: 44, overtimeMultiplier: 1.5, tipOutRules: [],
    salesFields: [{ id: 'FOOD', label: 'Food sales', requirement: 'required', createdAt: now, updatedAt: now }],
    paySchedule: { cadence: 'weekly', anchorDate: '2026-09-04', weekday: 5, monthDays: [], customDates: [], reminderTime: '09:00' },
    tipSchedule: { cadence: 'weekly', anchorDate: '2026-09-04', weekday: 5, monthDays: [], customDates: [], reminderTime: '09:00' },
    tipWeekStartsOn: 1, defaults: { wagesVisibility: 'personal', cashTipsVisibility: 'personal', cardTipsVisibility: 'personal', tipOutVisibility: 'personal', wagesDepositAccountId: '', cashTipsAccountId: '', cardTipsDepositAccountId: '' },
    wagesReceivableAccountId: '', cardTipsReceivableAccountId: '', note: '', createdAt: now, updatedAt: now });
}
function context(view: ActionContext['view'] = 'personal'): ActionContext {
  const household = catalogHousehold();
  household.workJobs = [job('MEM-001', 'JOB-OWN'), job('MEM-002', 'JOB-PARTNER-PRIVATE')];
  const base = household.accounts[0]!;
  household.accounts.push({ ...base, id: 'ACC-OWN', name: 'My private account', scope: 'personal', ownerMemberId: 'MEM-001' },
    { ...base, id: 'ACC-PARTNER', name: 'Partner private account', scope: 'personal', ownerMemberId: 'MEM-002' });
  return { household, memberId: 'MEM-001', view, today: '2026-09-12' };
}
function options(c: ActionContext, actionId: string, values: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return executeWorkspaceActionQuery('action_options', { actionId, values, ...extra }, c);
}
function fields(result: Record<string, unknown>) {
  return result.fields as Array<{ key: string; optional: boolean; choices?: Array<{ value: string; label: string }>; choiceCount?: number; nextOffset?: number | null; hasMore?: boolean }>;
}
afterEach(() => vi.unstubAllGlobals());
describe('authenticated workspace action options', () => {
  it.each(['personal', 'household'] as const)('uses the executable registry and actual availability in %s', view => {
    const c = context(view), result = executeWorkspaceActionQuery('action_catalogue', {}, c);
    expect(result.actions).toEqual(herculesWorkspaceActionCatalogue(c).slice(0, 20));
    expect((result.actions as Array<{ id: string }>).map(a => a.id)).toEqual(availableHerculesActions(c).slice(0, 20).map(a => a.id));
    expect(result.actionCount).toBe(availableHerculesActions(c).length);
    expect(herculesWorkspaceActionCatalogue().map(a => [a.id, a.views])).toEqual(HERCULES_ACTIONS.map(a => [a.id, a.views]));
    expect((result.actions as Array<{ id: string }>).some(a => a.id === 'fund-received')).toBe(false);
    if (view === 'personal') {
      expect((result.actions as Array<{ id: string }>).some(a => a.id === 'task')).toBe(true);
      expect(() => options(c, 'add-appointment')).toThrow(/not available/);
    }
  });
  it('resolves only own jobs and their dynamic shift fields without changing accepted state', () => {
    const c = context(), before = structuredClone(c.household);
    const start = options(c, 'worked-shift');
    expect(fields(start).find(f => f.key === 'jobId')?.choices).toEqual([{ value: 'JOB-OWN', label: 'JOB-OWN' }]);
    const next = options(c, 'worked-shift', { roleId: 'JOB-OWN-role', jobId: 'JOB-OWN', workedHours: '6', paidBreakHours: '0' });
    expect(fields(next).map(f => f.key)).toEqual(expect.arrayContaining(['cashTips', 'cardTips', 'sales_0', 'workedHours', 'paidBreakHours', 'customersServed', 'staffingCount']));
    expect(fields(next).find(f => f.key === 'sales_0')?.optional).toBe(false);
    expect(next.values).toMatchObject({ workedHours: '6', paidBreakHours: '0' });
    expect(next.missingFields).toContain('cashTips');
    expect(JSON.stringify(next)).not.toContain('JOB-PARTNER');
    expect(next.noActionExecuted).toBe(true); expect(c.household).toEqual(before);
  });
  it('keeps account choices in their requested ledger and rejects hidden identifiers', () => {
    const personal = options(context(), 'expense'), shared = options(context('household'), 'expense');
    expect(fields(personal).find(f => f.key === 'accountId')?.choices?.some(a => a.value === 'ACC-OWN')).toBe(true);
    expect(JSON.stringify(personal)).not.toContain('Partner private');
    expect(JSON.stringify(shared)).not.toContain('My private');
    for (const [action, values] of [['worked-shift', { jobId: 'JOB-PARTNER-PRIVATE' }], ['expense', { accountId: 'ACC-PARTNER' }]] as const)
      expect(() => options(context(), action, values)).toThrow(/available choices/);
  });
  it('pages current choices with explicit totals and never silently drops a field', () => {
    const c = context(); c.household.workJobs = Array.from({ length: 27 }, (_, i) => job(c.memberId, `JOB-${i}`));
    const first = fields(options(c, 'worked-shift', {}, { fieldKey: 'jobId', limit: 10 }))[0]!;
    expect(first).toMatchObject({ choiceCount: 27, hasMore: true, nextOffset: 10 }); expect(first.choices).toHaveLength(10);
    const last = fields(options(c, 'worked-shift', {}, { fieldKey: 'jobId', offset: 20, limit: 10 }))[0]!;
    expect(last).toMatchObject({ choiceCount: 27, hasMore: false, nextOffset: null }); expect(last.choices).toHaveLength(7);
    expect(() => options(c, 'worked-shift', {}, { fieldKey: 'arbitrary' })).toThrow('ACTION_FIELD_UNAVAILABLE');
    expect(() => options(c, 'worked-shift', {}, { offset: 10 })).toThrow('ACTION_FIELD_REQUIRED_FOR_PAGE');
  });
  it('refuses arbitrary action ids, control properties, unsupported values and inactive members', () => {
    const c = context();
    expect(() => options(c, 'postEntry')).toThrow(/not available/);
    expect(() => options(c, 'expense', { amount: 12 })).toThrow('INVALID_ACTION_VALUES');
    expect(() => options(c, 'expense', { amount: '12', createdBy: 'MEM-002' })).toThrow('ACTION_VALUES_UNAVAILABLE_REFRESH_OPTIONS');
    expect(() => options(c, 'expense', {}, { command: 'postEntry' })).toThrow('INVALID_ACTION_OPTIONS_ARGUMENTS');
    expect(() => options({ ...c, memberId: 'MEM-NOT-A-MEMBER' }, 'expense')).toThrow('ACTION_MEMBER_REQUIRED');
  });
  it('uses the accepted ledger read callback and records observation/expiry without an action proposal', async () => {
    const c = context(), observedAt = '2026-09-12T15:59:55.000Z';
    const read = vi.fn(async (name: string, args: Record<string, unknown>, view: ActionContext['view']) => ({ ...executeWorkspaceActionQuery(name, args, { ...c, view }), acceptedSequence: 17, observedAt, scope: view }));
    const tc: ToolContext = { project: createWorkspaceProject('project', 'Work', c.memberId, now), id: 'tool-call', now, read, search: vi.fn(), execute: vi.fn() };
    const result = await executeWorkspaceTool('hearth_action_options', { actionId: 'worked-shift', scope: 'personal', valuesJson: '{}' }, tc);
    expect(read).toHaveBeenCalledWith('action_options', { actionId: 'worked-shift', values: {} }, 'personal');
    expect(result.result).toMatchObject({ acceptedSequence: 17, observedAt, evidenceId: 'tool-call' });
    expect(result.effect?.evidence?.[0]).toMatchObject({ scope: 'personal', sourceVersion: '17', observedAt, expiresAt: '2026-09-12T16:00:55.000Z' });
    expect(result.effect?.proposal).toBeUndefined();
    await executeWorkspaceTool('discover_tools', { scope: 'household' }, tc);
    expect(read).toHaveBeenLastCalledWith('action_catalogue', {}, 'household');
    await expect(executeWorkspaceTool('hearth_action_options', { actionId: 'expense', scope: 'both', valuesJson: '{}' }, tc)).rejects.toThrow('ACTION_SCOPE_REQUIRED');
  });
  it('retains old immutable grants and requires renewal before reading new action options', async () => {
    const old = [...HERCULES_READ_TOOL_NAMES], snapshot = [...old];
    const grant = { token: 'fixture-token', id: 'grant', runId: 'run', projectId: 'project', expiresAt: new Date(Date.now() + 60000).toISOString() };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ runId: 'run', projectId: 'project', environment: 'development', householdId: 'HH-TEST', memberId: 'MEM-001', subject: 'synthetic-member', role: 'owner', permittedReads: old, budget: DEFAULT_RUN_BUDGET, leaseExpiresAt: new Date(Date.now() + 60000).toISOString() })));
    const lease = await leaseGrant({ SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable' }, grant);
    expect(lease.permittedReads).toEqual(snapshot);
    expect(() => requireWorkspaceReadGrant(lease.permittedReads, 'action_options')).toThrow('GRANT_ACTION_OPTIONS_REFRESH_REQUIRED');
    expect(() => requireWorkspaceReadGrant(lease.permittedReads, 'ledger_context')).not.toThrow();
    expect(() => requireWorkspaceReadGrant(WORKSPACE_GRANTED_READ_NAMES, 'action_options')).not.toThrow();
    expect(WORKSPACE_GRANTED_READ_NAMES.length).toBeLessThanOrEqual(80);
    expect(old).toEqual(snapshot);
    const legacyLocal = await leaseGrant({ SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable', LEDGER_SYNC_LOCAL_AUTH: 'true' }, { ...grant, localScope: { environment: 'development', householdId: 'HH-TEST', memberId: 'MEM-001', subject: 'local:MEM-001', role: 'owner', aclEpoch: 1, expires: Date.now() + 60000 } });
    expect(legacyLocal.permittedReads).toEqual(snapshot);
  });
});


it('retains only the caller’s private Household Plan preparation choices', async () => {
 const {planLifeFixture}=await import('./fixtures/plan-life.ts');
 const c={...context('household'),household:planLifeFixture('household')};
 const own=c.household.planDrafts![0]!;
 c.household.planDrafts!.push({...structuredClone(own),id:'PARTNER-DRAFT',ownerMemberId:'MEM-002'});
 for(const actionId of ['plan-line-change','plan-scenario','plan-household-proposal']) {
  const result=options(c,actionId);
  expect(fields(result).find(f=>f.key==='draftId')?.choices?.map(v=>v.value)).toContain(own.id);
  expect(JSON.stringify(result)).not.toContain('PARTNER-DRAFT');
 }
});

it('scrubs quiet source text without inventing replacement identifiers', async () => {
 const {addAppointment,postEntry}=await import('../src/core/commands.ts');
 const c=context('household');
 c.household=addAppointment(c.household,{title:'Quiet Canary',kind:'dentist',memberId:'MEM-001',nextDate:'2026-09-14',cadence:{kind:'monthly',interval:6},sensitivity:'quiet',coverage:'private',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',typicalCost:'120',typicalRecovery:'80',place:'Quiet Place',practitioner:'Quiet Practitioner'}).household;
 c.household=postEntry(c.household,{createdBy:'MEM-001',type:'expense',date:c.today,amount:'20',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',note:'Quiet Canary at Quiet Practitioner'}).household;
 const id=c.household.transactions.at(-1)!.id;
 const result=options(c,'reverse-entry');
 expect(fields(result).find(f=>f.key==='transactionId')?.choices?.some(v=>v.value===id)).toBe(true);
 expect(JSON.stringify(result)).not.toMatch(/Quiet Canary|Quiet Practitioner|Quiet Place/);
 c.household.transactions.at(-1)!.id='TXN-Quiet Canary';
 expect(JSON.stringify(options(c,'reverse-entry'))).not.toContain('TXN-Quiet');
 expect(()=>options(c,'reverse-entry',{transactionId:'TXN-Quiet Canary'})).toThrow(/PRIVATE_DETAILS/);
 c.household.appointments.at(-1)!.id='APP-Quiet Canary';
 expect(fields(options(c,'archive-appointment'))[0]!.choices).toEqual([]);
 expect(()=>options(c,'archive-appointment',{appointmentId:'Private appointment · 2026-09-14'})).toThrow(/PRIVATE_DETAILS/);
});
