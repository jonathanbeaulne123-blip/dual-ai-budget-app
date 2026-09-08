import { monthEndKey, type DateKey, type MonthKey } from '../../core/calendar.ts';
import { projectedExpenseEffect, transactionProjection } from '../../core/budget.ts';
import { suggestedRhythms } from '../../core/rhythm.ts';
import { isVisibleInView } from '../../core/visibility.ts';
import type { Household } from '../../core/types.ts';
import type { StatementDraftScope, StatementSetupDraft, StatementSuggestion } from './types.ts';
export type AcceptedStatementCoverage = { accountId: string; from: string; through: string; sourceIds: string[] };
export function statementSetupSuggestions(input: { household: Household; scope: StatementDraftScope; draft: StatementSetupDraft; today: string; acceptedCoverage?: AcceptedStatementCoverage[] }): { suggestions: StatementSuggestion[]; estimateStatus: string } {
  const suggestions: StatementSuggestion[] = [];
  const eligibleCategoryIds = new Set(input.household.categories.filter(category => category.active && category.recordType === 'category').map(category => category.id));
  const groups = new Map<string, typeof input.draft.rows>();
  for (const row of input.draft.rows) {
    if (row.decision === 'exclude' || row.type !== 'expense' || !row.subcategoryId || !eligibleCategoryIds.has(row.subcategoryId)) continue;
    const key = `${row.subcategoryId}|${row.place.toLowerCase().trim() || row.note.toLowerCase().trim()}`;
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  for (const [key, rows] of groups) {
    const categoryId = rows[0]!.subcategoryId;
    const category = input.household.categories.find(item => item.id === categoryId)!;
    suggestions.push({ id: `category:${key}`, kind: 'category', label: category.name, categoryId, sampleSize: rows.length,
      reason: 'Matched a named category or repeated accepted coding. Review before using.', sourceIds: rows.map(row => row.sourceIdentity) });
  }
  const visible = input.household.transactions.filter(row => isVisibleInView(row, input.scope.memberId, input.scope.view));
  const byId = new Map(visible.map(row => [row.id, row]));
  const netByRoot = new Map<string, number>();
  for (const row of visible) {
    const { root, multiplier } = transactionProjection(row, byId);
    if (row.isDuplicate || root.isDuplicate) continue;
    netByRoot.set(root.id, (netByRoot.get(root.id) ?? 0) + multiplier);
  }
  const activeHistory = visible.filter(row => !row.reversalOfId && !row.isDuplicate && (netByRoot.get(row.id) ?? 0) > 0);
  for (const rhythm of suggestedRhythms({ ...input.household, transactions: activeHistory }, input.today as DateKey)) {
    suggestions.push({ id: `recurrence:${rhythm.key}`, kind: 'recurrence', label: rhythm.note, categoryId: rhythm.subcategoryId,
      amountCents: rhythm.amountCents, sampleSize: rhythm.count, rhythmKey: rhythm.key, cadence: rhythm.cadence,
      reason: `The existing Calendar detector found ${rhythm.count} ${rhythm.cadence} payments. Review in Calendar before adopting.`,
      sourceIds: activeHistory.filter(row => row.subcategoryId === rhythm.subcategoryId && rhythm.dates.includes(row.date)).map(row => row.id) });
  }
  // A complete calendar month requires accepted coverage, not a first/last transaction guess.
  const requiredAccounts = input.household.accounts.filter(account => account.active && account.kind !== 'investment'
    && (input.scope.view === 'personal' ? account.scope === 'personal' && account.ownerMemberId === input.scope.memberId : account.scope !== 'personal')).map(account => account.id);
  const allCoverage = input.acceptedCoverage ?? [];
  function coversMonth(accountId: string, from: string, through: string): boolean {
    const intervals = allCoverage.filter(coverage => coverage.accountId === accountId).sort((a,b) => a.from.localeCompare(b.from));
    let cursor = from;
    for (const interval of intervals) {
      if (interval.through < cursor) continue;
      if (interval.from > cursor) return false;
      if (interval.through >= through) return true;
      const next = new Date(`${interval.through}T00:00:00Z`); next.setUTCDate(next.getUTCDate()+1); cursor = next.toISOString().slice(0,10);
    }
    return false;
  }
  const selectedMonths: string[] = [];
  for (const offset of [-3,-2,-1]) {
    const first = new Date(`${input.today.slice(0,7)}-01T00:00:00Z`); first.setUTCMonth(first.getUTCMonth()+offset);
    const month = first.toISOString().slice(0,7), from = `${month}-01`, through = monthEndKey(month as MonthKey);
    if (requiredAccounts.length && requiredAccounts.every(accountId => coversMonth(accountId,from,through))) selectedMonths.push(month);
  }
  if (!selectedMonths.length) return { suggestions, estimateStatus: 'Not enough accepted history for a complete calendar month. Estimates stay blank; you can enter your own.' };
  const amounts = new Map<string, { cents: number; ids: string[] }>();
  for (const row of visible) {
    const projected = transactionProjection(row, byId);
    if (!selectedMonths.includes(projected.root.date.slice(0,7)) || !projected.root.subcategoryId || !eligibleCategoryIds.has(projected.root.subcategoryId)) continue;
    const effect = projectedExpenseEffect(row, byId);
    if (!effect) continue;
    const entry = amounts.get(projected.root.subcategoryId) ?? { cents: 0, ids: [] };
    entry.cents += effect; entry.ids.push(row.id); amounts.set(projected.root.subcategoryId, entry);
  }
  for (const [categoryId, value] of amounts) {
    const category = input.household.categories.find(item => item.id === categoryId)!;
    suggestions.push({ id: `estimate:${categoryId}:${selectedMonths.join(',')}`, kind: 'estimate', label: category.name, categoryId,
      amountCents: Math.max(0, Math.round(value.cents / selectedMonths.length)), sampleSize: selectedMonths.length,
      reason: `Accepted net spending across ${selectedMonths.join(', ')}; refunds reduce spending, reversals cancel their original rows.`, sourceIds: [...new Set(value.ids)] });
  }
  return { suggestions, estimateStatus: `Using ${selectedMonths.length} complete calendar month${selectedMonths.length === 1 ? '' : 's'} of accepted history${selectedMonths.length < 3 ? '; fewer than three months are available' : ''}.` };
}
