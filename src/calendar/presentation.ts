import { addDays } from '../core/calendar.ts';
import type { BoardDay, BoardItem } from '../core/board.ts';
import type { Household } from '../core/types.ts';

export type CalendarDisplayItem = BoardItem & { completed?: boolean; receiptId?: string; completionLabel?: string };

/** Presentation only: completed occurrences never enter pressure, cash-flow or posting models. */
export function calendarDisplayDays(days: BoardDay[], household: Household): (Omit<BoardDay, "items"> & {items:CalendarDisplayItem[]})[] {
  const reversed = new Set(household.transactions.filter(t => !t.isDuplicate && t.reversalOfId).map(t => t.reversalOfId));
  const live = household.transactions.filter(t => !t.isDuplicate && !t.reversalOfId && !reversed.has(t.id));
  const byId = new Map(live.map(t => [t.id, t]));
  const completed = new Map<string, CalendarDisplayItem>();
  for (const recurrence of household.recurrences) {
    if (!household.accounts.some(a => a.id === recurrence.accountId)) continue;
    const linked = new Set((recurrence.payments ?? []).map(p => p.transactionId));
    const evidence = [
      ...(recurrence.payments ?? []).flatMap(p => { const tx = byId.get(p.transactionId); return tx ? [{date:p.occurrenceDate, tx}] : []; }),
      ...live.filter(t => t.source === 'recurring' && t.sourceId === recurrence.id && !linked.has(t.id)).map(tx => ({date:tx.date, tx})),
    ];
    for (const {date, tx} of evidence) completed.set(`${recurrence.id}:${date}`, {
      id:`${recurrence.id}:${date}`, date, title:recurrence.note || 'Recurring payment', amountCents:tx.amountCents,
      direction:recurrence.type === 'income' ? 'in' : 'out', kind:recurrence.kind, source:'recurrence',
      recurrenceId:recurrence.id, due:false, completed:true, receiptId:tx.id, completionLabel:recurrence.type === 'income' ? 'Received' : recurrence.type === 'transfer' ? 'Recorded' : 'Paid',
    });
  }
  return days.map(day => ({...day, items:[
    ...day.items.filter(item => !completed.has(item.id)),
    ...[...completed.values()].filter(item => item.date === day.date),
  ]}));
}

export function calendarItemReading(item: CalendarDisplayItem, household: Household) {
  const account = item.recurrenceId ? household.accounts.find(a => a.id === household.recurrences.find(r => r.id === item.recurrenceId)?.accountId) : undefined;
  const event = item.source === 'event' ? household.nativeEvents?.find(e => item.id.startsWith(`${e.id}:`)) : undefined;
  const potential = household.potentialExpenses?.find(p => p.id === item.potentialExpenseId);
  const shift = item.source === "shift" ? household.shifts.find(s => `shift:${s.id}` === item.id) : undefined;
  const memberId = event?.createdBy ?? potential?.createdBy ?? item.memberId ?? account?.ownerMemberId;
  const member = household.members.find(m => m.id === memberId);
  const scope = event?.visibility ?? potential?.visibility ?? shift?.visibility ?? account?.scope;
  const owner = item.source === 'google' ? `${member?.name ?? 'Connected'} · Google`
    : scope === 'personal' ? member?.name ?? 'Personal'
    : scope === 'household' || scope === 'both' || scope === 'shared' || (account && !account.scope) ? 'Shared'
    : member ? member.name : 'This ledger';
  const status = item.completed ? 'done' : item.due ? 'attention' : 'upcoming';
  const statusLabel = item.completed ? item.completionLabel ?? (item.direction === 'in' ? 'Received' : 'Paid') : item.due ? 'Needs attention' : 'Scheduled';
  return {owner, status, statusLabel};
}

/** Allocate runs before days: overlapping spans cannot jump lanes or disappear midway. */
export function calendarLanes(days: BoardDay[], limit = 3): (CalendarDisplayItem | null)[][] {
  const result: (CalendarDisplayItem | null)[][] = days.map(() => Array(limit).fill(null));
  const runs = new Map<string, {day:number; item:CalendarDisplayItem}[]>();
  days.forEach((day, index) => day.items.forEach(item => {
    if (!item.span) return;
    const start = addDays(item.date, -item.span.index);
    const identity = item.id.slice(0, item.id.lastIndexOf(':'));
    const key = `${item.source}:${item.memberId ?? ''}:${item.calendarId ?? ''}:${identity}:${start}`;
    const run = runs.get(key) ?? []; run.push({day:index,item}); runs.set(key,run);
  }));
  [...runs.entries()].sort(([ak,a],[bk,b]) => a[0]!.day-b[0]!.day || b.length-a.length || ak.localeCompare(bk)).forEach(([,run]) => {
    const lane = Array.from({length:limit},(_,i)=>i).find(i => run.every(r => result[r.day]![i] === null));
    if (lane !== undefined) run.forEach(r => {result[r.day]![lane] = r.item;});
  });
  days.forEach((day,index) => {
    const slots = result[index]!;
    // Ordinary items follow the last occupied span, preserving empty continuation lanes.
    let next = slots.reduce((last,item,i) => item ? i+1 : last, 0);
    day.items.filter(item=>!item.span).forEach(item=>{if(next<limit)slots[next++]=item;});
    while(slots.length && slots.at(-1) === null) slots.pop();
  });
  return result;
}
