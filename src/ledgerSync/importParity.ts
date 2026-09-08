import type { Household, SharedEnvelope, PersonalEnvelope, CommandReceipt } from '../core/types.ts';
import { assembleHousehold } from '../core/sync.ts';
import { assertAcceptableBooks } from '../core/booksValidation.ts';
import { accountRegister, trialBalance, booksEquation, snapshotPnL } from '../core/journal.ts';
import { assertHouseholdFundIntegrity, projectHouseholdFund } from '../core/householdFund.ts';
import { projectLedgerExperience } from '../core/ledgerExperience.ts';
import { canonical, digest } from './patch.ts';
import type { DateKey } from '../core/calendar.ts';

export type FieldPolicy = 'exact' | 'transport' | 'receipt-relocation';
// Exhaustive: adding a Household field requires an explicit parity decision.
export const IMPORT_FIELD_POLICY = {
  version: 'exact',
  householdId: 'exact',
  inviteCode: 'exact',
  linked: 'transport',
  revision: 'transport',
  baseRevision: 'transport',
  booksAcceptedHash: 'transport',
  tombstones: 'exact',
  name: 'exact',
  ledgerNames: 'exact',
  timezone: 'exact',
  currency: 'exact',
  environment: 'exact',
  members: 'exact',
  accounts: 'exact',
  categories: 'exact',
  transactions: 'exact',
  accountOpeningCheckpoints: 'exact',
  accountHistoryApprovals: 'exact',
  accountHistoryReviews: 'exact',
  shifts: 'exact',
  sevenShiftsSchedules: 'exact',
  coworkers: 'exact',
  coworkerAttendance: 'exact',
  coworkerSchedules: 'exact',
  shiftEnvelopes: 'exact',
  shiftBibles: 'exact',
  recurrences: 'exact',
  appointments: 'exact',
  claims: 'exact',
  presets: 'exact',
  calendar: 'exact',
  kitchen: 'exact',
  google: 'exact',
  goals: 'exact',
  goalContributions: 'exact',
  goalPurchases: 'exact',
  householdOnboarding: 'exact',
  onboardingSubmissions: 'exact',
  onboardingCategoryProposals: 'exact',
  onboardingCategoryMerges: 'exact',
  onboardingApprovals: 'exact',
  onboardingAttestations: 'exact',
  onboardingAttestationInvalidations: 'exact',
  acceptedStarterPlans: 'exact',
  charter: 'exact',
  householdFund: 'exact',
  fundMonthPlans: 'exact',
  fundEvents: 'exact',
  fundSettlementAllocations: 'exact',
  fundKittyAllocations: 'exact',
  fundPrivate: 'exact',
  monthRehearsals: 'exact',
  weeklyDocumentStamps: 'exact',
  budgetPlans: 'exact',
  sitDownSessions: 'exact',
  activity: 'exact',
  devices: 'exact',
  workJobs: 'exact',
  shiftSettings: 'exact',
  lastCommittedAt: 'exact',
  commandReceipts: 'receipt-relocation',
  sharing: 'transport',
  conflicts: 'exact',
  syntheticFixture: 'exact',
  restorePoints: 'exact',
  herculesProPermissions: 'exact',
} satisfies Record<keyof Household, FieldPolicy>;
export type ImportParityReport = {
  version: 1; pass: boolean; memberId: string; sourceRevision: number; targetRevision: number;
  fields: { field: string; policy: string; equal: boolean }[];
  financial: { name: string; equal: boolean; sourceHash?: string; targetHash?: string }[];
  receipts: { sourceCount: number; relocated: boolean; reserved: boolean; manifestCount: number; manifestExact: boolean };
  differences: string[];
};
/** No raw amounts, rows, receipt identities, or another member's payload in output. */
export async function compareImportParity(input: {
  source: { shared: SharedEnvelope; personal: PersonalEnvelope };
  target: { shared: SharedEnvelope; personal: PersonalEnvelope };
  importedReceipts: CommandReceipt[];
  reserved: (id: string) => Promise<boolean>;
  manifestCount: number; manifestExact: boolean;
  today: DateKey;
}): Promise<ImportParityReport> {
  const {source, target} = input;
  const fields: ImportParityReport['fields'] = [], financial: ImportParityReport['financial'] = [], differences: string[] = [];
  const compare = (field: string, policy: string, a: unknown, b: unknown) => {
    const equal = (a === undefined) === (b === undefined) && canonical(a) === canonical(b); fields.push({field,policy,equal}); if(!equal) differences.push(field);
  };
  if(source.personal.memberId !== target.personal.memberId || source.shared.householdId !== target.shared.householdId || source.shared.environment !== target.shared.environment) differences.push('scope');
  for(const [label,envelopes] of [["source",source],["target",target]] as const) {
    const member=envelopes.personal.memberId;
    if(envelopes.shared.transactions.some(row=>row.visibility==='personal') || envelopes.shared.shifts.some(row=>row.visibility==='personal') || envelopes.shared.accounts.some(row=>row.scope==='personal'))differences.push(`${label}.sharedPrivacy`);
    if(envelopes.personal.transactions.some(row=>row.visibility!=='personal'||row.createdBy!==member) || envelopes.personal.shifts.some(row=>row.visibility!=='personal'||row.createdBy!==member)
      || envelopes.personal.accounts?.some(row=>row.scope!=='personal'||row.ownerMemberId!==member) || envelopes.personal.goals?.some(row=>row.shared||row.ownerMemberId!==member))differences.push(`${label}.personalPrivacy`);
  }
  for(const scope of ['shared','personal'] as const) for(const field of new Set([...Object.keys(source[scope]),...Object.keys(target[scope])])) {
    if(scope==='shared' && field==='commandReceipts') continue;
    compare(`${scope}.${field}`, 'exact', (source[scope] as any)[field], (target[scope] as any)[field]);
  }
  // Identity relocation is checked in full inside the authority, never hidden
  // by normalizing it out of both sides or reporting just a ring count.
  const sourceReceipts=source.shared.commandReceipts ?? [];
  const relocated = new Set(input.importedReceipts.map(row=>row.confirmationId)).size===input.importedReceipts.length
    && input.importedReceipts.length===sourceReceipts.length && sourceReceipts.every(receipt => input.importedReceipts.some(row => canonical(row) === canonical(receipt)))
    && (target.shared.commandReceipts ?? []).length===0;
  const reserved = (await Promise.all((source.shared.commandReceipts ?? []).map(row => input.reserved(row.confirmationId)))).every(Boolean);
  if(!relocated)differences.push('commandReceipts.relocation');if(!reserved||!input.manifestExact)differences.push('commandReceipts.reservations');
  const before=assembleHousehold(source.shared,source.personal,{linked:true});
  const after=assembleHousehold({...target.shared, commandReceipts: source.shared.commandReceipts},target.personal,{linked:true});
  for(const [field, policy] of Object.entries(IMPORT_FIELD_POLICY)) {
    if(policy==='exact')compare(`household.${field}`,policy,(before as any)[field],(after as any)[field]);
    else fields.push({field:`household.${field}`,policy,equal:true});
  }
  const derived = async (name:string,a:unknown,b:unknown) => {
    const equal=canonical(a)===canonical(b);financial.push({name,equal,sourceHash:await digest(a),targetHash:await digest(b)});if(!equal)differences.push(name);
  };
  try {
    const a=assertAcceptableBooks(before),b=assertAcceptableBooks(after);
    assertHouseholdFundIntegrity(before);assertHouseholdFundIntegrity(after);
    await derived('journal',a.entries,b.entries);
    await derived('trialBalance',trialBalance(a),trialBalance(b));
    await derived('equation',booksEquation(a),booksEquation(b));
    await derived('pnl',snapshotPnL(before),snapshotPnL(after));
    await derived('accountRegisters',before.accounts.map(account=>({id:account.id,rows:accountRegister(a,account.id)})),after.accounts.map(account=>({id:account.id,rows:accountRegister(b,account.id)})));
    await derived('fund',projectHouseholdFund(before,input.today),projectHouseholdFund(after,input.today));
    for(const view of ['household','personal'] as const) await derived(`readModel.${view}`,projectLedgerExperience(before,source.personal.memberId,view,input.today),projectLedgerExperience(after,target.personal.memberId,view,input.today));
  } catch { financial.push({name:'validBooksAndFund',equal:false});differences.push('validBooksAndFund'); }
  return {version:1,pass:!differences.length,memberId:source.personal.memberId,sourceRevision:source.shared.revision,targetRevision:target.shared.revision,fields,financial,
    receipts:{sourceCount:(source.shared.commandReceipts ?? []).length,relocated,reserved,manifestCount:input.manifestCount,manifestExact:input.manifestExact},differences};
}
