import type { ActionContext, ActionDefinition, ActionField, ActionValues } from './herculesActions.ts';
import { ValidationError, type WorkJob, type WorkPaySchedule } from './types.ts';
import { upsertWorkJob } from './commands.ts';
import { parseWholeCents } from './money.ts';
import { householdForView } from './visibility.ts';

const choice = (key: string, label: string, question: string, options: [string, string][]): ActionField => ({
  key, label, question, choices: () => options.map(([value, label]) => ({ value, label })),
});
const field = (key: string, label: string, kind: ActionField['kind'] = 'text'): ActionField => ({ key, label, question: `What is the ${label.toLowerCase()}?`, kind });
const accounts = (c: ActionContext) => householdForView(c.household, c.memberId, c.view).accounts.filter(a => a.active
  && ['chequing', 'savings', 'other', 'cash'].includes(a.kind)
  && (c.view === 'personal' ? a.scope === 'personal' && a.ownerMemberId === c.memberId : a.scope !== 'personal'))
  .map(a => ({ value: a.id, label: a.name }));
const account = (key: string, label: string): ActionField => ({ ...field(key, label), choices: accounts });
function number(v: string | undefined, label: string, min: number, max: number): number {
  const n = Number(v);
  if (!v?.trim() || !Number.isFinite(n) || n < min || n > max) throw new ValidationError(`${label} must be between ${min} and ${max}.`);
  return n;
}
function schedule(v: ActionValues): WorkPaySchedule {
  const cadence = v.payCadence as WorkPaySchedule['cadence'];
  return { cadence, anchorDate: v.payday || v.effectiveDate!, weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: '09:00' };
}

/** A bounded hourly job builder. Ownership, IDs, owed accounts and timestamps are server/domain controlled. */
export const herculesWorkActions: ActionDefinition[] = [{
  id: 'add-job', title: 'Set up an hourly job', example: 'Add a job',
  match: /\b(?:add|create|set up|start) (?:a |my |new )?(?:hourly )?job\b/i,
  views: ['household', 'personal'],
  fields: [
    { ...field('name', 'Job name'), maxLength: 60 }, { ...field('roleName', 'Role name'), maxLength: 40 },
    field('effectiveDate', 'Rate effective date', 'date'), field('grossRate', 'Gross hourly wage (CAD)', 'money'),
    choice('takeHomeMethod', 'Take-home method', 'Do you know your hourly take-home, your total deduction percentage, or neither yet?', [
      ['direct', 'I know my hourly take-home'], ['deductions', 'Calculate using my deduction percentage'], ['unknown', 'Take-home is not known yet'],
    ]),
    choice('tipped', 'Tips', 'Does this role receive tips?', [['no', 'No tips'], ['yes', 'Receives tips']]),
    account('wagesAccountId', 'Wage deposit account'),
    choice('overtime', 'Overtime', 'Should this job calculate weekly overtime using rules you supply?', [['no', 'No overtime calculation'], ['yes', 'Use my weekly overtime rules']]),
    choice('payCadence', 'Pay rhythm', 'How often are wages paid?', [['irregular', 'No fixed payday yet'], ['weekly', 'Weekly'], ['biweekly', 'Every two weeks']]),
  ],
  dynamicFields: (_c, v) => [
    ...(v.takeHomeMethod === 'direct' ? [field('netRate', 'Take-home hourly wage (CAD)', 'money')] : v.takeHomeMethod === 'deductions' ? [field('deductionPercent', 'Total deductions (%)', 'number')] : []),
    ...(v.overtime === 'yes' ? [field('overtimeThreshold', 'Weekly overtime threshold (hours)', 'number'), field('overtimeMultiplier', 'Overtime multiplier', 'number')] : []),
    ...(['weekly', 'biweekly'].includes(v.payCadence ?? '') ? [field('payday', 'Anchor payday', 'date')] : []),
    ...(v.tipped === 'yes' ? [account('cashAccountId', 'Cash tips account'), account('cardAccountId', 'Card tips deposit account'),
      choice('tipOutBasis', 'Tip-out rule', 'Which tip-out rule applies? More complex rules can be configured in Work before recording a shift.', [
        ['none', 'No tip-out'], ['total-sales', 'Percentage of total sales'], ['card-tips', 'Percentage of card tips'], ['all-tips', 'Percentage of all tips'],
      ]),
      choice('tipPayRhythm', 'Card tips payday', 'When are card tips paid?', [['irregular', 'No fixed rhythm'], ['with-wages', 'Same rhythm as wages']]),
      ...(v.tipOutBasis && v.tipOutBasis !== 'none' ? [field('tipOutPercent', 'Tip-out percentage (%)', 'number'),
        field('tipOutRounding', 'Tip-out rounding increment (CAD; 0 for exact cents)', 'money'),
        choice('tipOutRoundingMode', 'Rounding direction', 'Which rounding direction does the job use?', [['nearest', 'Nearest increment'], ['up', 'Round up'], ['down', 'Round down']]),
        choice('tipOutTiming', 'Tip-out payment', 'When is tip-out paid?', [['immediate', 'From cash tips now'], ['withheld', 'Withheld from card tips owed'], ['deferred', 'Paid later']]),
      ] : []),
    ] : []),
  ],
  consequence: 'Create your hourly job and its owed accounts. No wages, tips or bank payment are recorded. Paid breaks use the role rate; tip weeks start Monday and reminders use 9 am Toronto time. Unknown take-home must be set in Work before posting earned wages. Additional roles and complex pay rules can be edited in Work.',
  dependencies: c => ({ jobs: c.household.workJobs?.filter(j => j.memberId === c.memberId), accounts: householdForView(c.household, c.memberId, c.view).accounts, member: c.household.members.find(m => m.id === c.memberId) }),
  execute: (c, v) => {
    const allowed = new Set(accounts(c).map(a => a.value));
    for (const key of ['wagesAccountId', ...(v.tipped === 'yes' ? ['cashAccountId', 'cardAccountId'] : [])])
      if (!allowed.has(v[key]!)) throw new ValidationError('Choose a current deposit account in these books.');
    const gross = parseWholeCents(v.grossRate!, 'Gross hourly wage');
    const direct = v.takeHomeMethod === 'direct' ? parseWholeCents(v.netRate!, 'Take-home hourly wage') : 0;
    const deductions = v.takeHomeMethod === 'deductions' ? [{ id: 'DEDUCTION-TOTAL', label: 'Supplied total deductions', percent: number(v.deductionPercent, 'Deductions', 0, 100) }] : [];
    if (direct > gross) throw new ValidationError('Hourly take-home cannot exceed gross wages. Keep tips separate.');
    const tipped = v.tipped === 'yes', tipOut = tipped && v.tipOutBasis !== 'none';
    const at = '1970-01-01T00:00:00.000Z';
    const paySchedule = schedule(v);
    const job: WorkJob = {
      id: '', memberId: c.memberId, name: v.name!, color: '#a85a3d', active: true, timezone: 'America/Toronto',
      locationName: '', gpsEnabled: false, locationLatitude: null, locationLongitude: null,
      roles: [{ id: 'ROLE-1', name: v.roleName!, active: true, tipped, rates: [{ id: 'RATE-1', effectiveDate: v.effectiveDate!,
        grossHourlyRateCents: gross, takeHomeMode: v.takeHomeMethod === 'deductions' ? 'deductions' : 'direct', takeHomeHourlyRateCents: direct,
        deductions, createdAt: at, updatedAt: at }], createdAt: at, updatedAt: at }],
      paidBreakRate: 'role', paidBreakHourlyRateCents: 0,
      overtimeEnabled: v.overtime === 'yes', overtimeWeeklyThresholdHours: v.overtime === 'yes' ? number(v.overtimeThreshold, 'Overtime threshold', 1, 168) : 44,
      overtimeMultiplier: v.overtime === 'yes' ? number(v.overtimeMultiplier, 'Overtime multiplier', 1, 5) : 1.5,
      tipOutRules: tipOut ? [{ id: 'TIPOUT-1', label: 'Tip-out', basis: v.tipOutBasis as 'total-sales' | 'card-tips' | 'all-tips',
        value: number(v.tipOutPercent, 'Tip-out percentage', 0, 100), roundingCents: parseWholeCents(v.tipOutRounding!, 'Rounding increment', { allowZero: true }),
        roundingMode: v.tipOutRoundingMode as 'nearest' | 'up' | 'down', timing: v.tipOutTiming as 'immediate' | 'withheld' | 'deferred', active: true, createdAt: at, updatedAt: at }] : [],
      salesFields: tipOut && v.tipOutBasis === 'total-sales' ? [{ id: 'SALES-TOTAL', label: 'Total sales', requirement: 'required', createdAt: at, updatedAt: at }] : [],
      paySchedule, tipSchedule: v.tipPayRhythm === 'with-wages' ? paySchedule : { ...paySchedule, cadence: 'irregular' }, tipWeekStartsOn: 1,
      defaults: { wagesVisibility: c.view, cashTipsVisibility: c.view, cardTipsVisibility: c.view, tipOutVisibility: c.view,
        wagesDepositAccountId: v.wagesAccountId!, cashTipsAccountId: tipped ? v.cashAccountId! : v.wagesAccountId!, cardTipsDepositAccountId: tipped ? v.cardAccountId! : v.wagesAccountId! },
      wagesReceivableAccountId: '', cardTipsReceivableAccountId: '', note: '', createdAt: '', updatedAt: '',
    };
    return upsertWorkJob(c.household, { job });
  },
}];
