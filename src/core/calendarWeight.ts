import { projectedCountable, transactionProjection } from "./budget.ts";
import { projectAppointmentDates } from "./appointments.ts";
import { monthEndKey } from "./calendar.ts";
import { cashFlowClass, cashFlowDelta, cashFlowRows, isOutgoingCash, type CashFlowRow } from "./cashFlowRows.ts";
import type { BoardItem, MonthBoard } from "./board.ts";
import type { Household } from "./types.ts";
import { formatCad } from "./money.ts";
import { workOwedFacts } from "./workSettlement.ts";

export type WeightItem = { item: BoardItem; outstandingOutCents: number; note: string; allowPost: boolean; scheduledDate?: string };
export type WeightDay = { date: string; posted: CashFlowRow[]; scheduled: WeightItem[]; postedOutCents: number; postedInCents: number; outstandingOutCents: number; weightCents: number };

/** A view over the caller's already-scoped household; never discovers another ledger. */
export function calendarWeight(household: Household, board: MonthBoard, today: string): WeightDay[] {
  const end = monthEndKey(board.monthKey);
  const posted = cashFlowRows(household, `${board.monthKey}-01`, end);
  const txById = new Map(household.transactions.map(tx => [tx.id, tx]));
  const liveRoots = new Map<string, number>();
  for (const tx of household.transactions) {
    if (tx.date > end || !projectedCountable(tx, txById)) continue;
    const { root, multiplier } = transactionProjection(tx, txById);
    if (root.type === "expense" || root.type === "income") liveRoots.set(root.id, (liveRoots.get(root.id) ?? 0) + root.amountCents * multiplier);
  }
  const recognizedRoots = [...liveRoots].filter(([, amount]) => amount > 0).map(([id]) => txById.get(id)!);
  const recurrencePosted = new Set(recognizedRoots.filter(tx => tx.source === "recurring" && tx.sourceId).map(tx => `${tx.sourceId}:${tx.date}`));
  const visits = new Map<string, Set<string>>();
  const visitHistory = new Map<string, Set<string>>();
  const roots = household.transactions.filter(tx => !tx.reversalOfId && tx.date <= end);
  const recurrenceHistory = new Set(roots.filter(tx => tx.source === "recurring" && tx.sourceId).map(tx => `${tx.sourceId}:${tx.date}`));
  for (const appointment of household.appointments ?? []) {
    const dates = new Set(recognizedRoots.filter(tx => tx.type === "expense" && tx.source === "visit" && (
      tx.sourceId === appointment.id || tx.id === appointment.lastPostedTransactionId
      || household.claims.some(claim => claim.appointmentId === appointment.id && claim.expenseTransactionId === tx.id)
    )).map(tx => tx.date));
    visits.set(appointment.id, dates);
    visitHistory.set(appointment.id, new Set(roots.filter(tx => tx.type === "expense" && tx.source === "visit" && (
      tx.sourceId === appointment.id || tx.id === appointment.lastPostedTransactionId
      || household.claims.some(claim => claim.appointmentId === appointment.id && claim.expenseTransactionId === tx.id)
    )).map(tx => tx.date)));
  }
  const accounts = new Map(household.accounts.map(account => [account.id, account]));
  const workFacts = new Map(workOwedFacts(household, today).map(fact => [fact.id, fact]));
  const describe = (item: BoardItem): WeightItem | null => {
    let amount = 0, note = "On the board", allowPost = true;
    let scheduledDate: string | undefined;
    if (item.source === "recurrence") {
      if (recurrencePosted.has(`${item.recurrenceId}:${item.date}`)) return null;
      const recurrence = household.recurrences.find(row => row.id === item.recurrenceId);
      const account = recurrence && accounts.get(recurrence.accountId);
      const destination = recurrence?.transferToAccountId ? accounts.get(recurrence.transferToAccountId) : undefined;
      const component = recurrence && account ? cashFlowClass(recurrence.type, account.kind, destination?.kind) : null;
      amount = isOutgoingCash(component) ? item.amountCents : 0;
      note = component === "cardSpendCents" ? "Scheduled card spending · not cash leaving"
        : component === "other-transfer" ? "Scheduled transfer · within cash or non-cash accounts"
          : amount ? (item.due ? "Due · not posted" : "Scheduled · not posted") : item.direction === "in" ? "Expected · not received" : "Scheduled · cash account not established";
      if (recurrenceHistory.has(`${item.recurrenceId}:${item.date}`)) {
        allowPost = false; amount = 0; note = "Earlier receipt corrected or excluded · payment status needs review, not plotted";
      }
    } else if (item.source === "appointment") {
      const appointment = household.appointments.find(row => row.id === item.appointmentId);
      if (!appointment) return { item, outstandingOutCents: 0, note: "Visit estimate · account not established", allowPost: false };
      const dates = visits.get(appointment.id)!;
      if (dates.has(item.date) || (appointment.cadence.kind === "once" && dates.has(appointment.nextDate))) return null;
      // The board repeats an overdue occurrence on today. Keep its original dated row once.
      const projectedDates = projectAppointmentDates(appointment.nextDate, appointment.cadence, board.days[0]!.date, board.days.at(-1)!.date);
      if (item.date === today && appointment.nextDate < today && !projectedDates.includes(today)
        && board.days.some(day => day.inMonth && day.date === appointment.nextDate)) return null;
      const carried = item.date === today && appointment.nextDate < today && !projectedDates.includes(today);
      if (carried) scheduledDate = appointment.nextDate;
      const account = accounts.get(appointment.accountId);
      amount = account && isOutgoingCash(cashFlowClass("expense", account.kind)) ? appointment.typicalCostCents : 0;
      note = `Visit estimate${account?.kind === "credit" ? " · card spending, not cash leaving" : !account ? " · account not established" : ""}${appointment.typicalRecoveryCents ? ` · ${formatCad(appointment.typicalRecoveryCents)} expected back separately` : ""}`;
      if (carried) note += ` · overdue from ${appointment.nextDate}, shown today`;
      const history = visitHistory.get(appointment.id)!;
      if (history.has(item.date) || (appointment.cadence.kind === "once" && history.has(appointment.nextDate))) {
        allowPost = false; amount = 0; note += " · earlier receipt corrected or excluded; payment status needs review, not plotted";
      }
      item = { ...item, amountCents: appointment.typicalCostCents };
    } else if (item.source === "work-settlement") {
      const fact = workFacts.get(item.id), account = fact && accounts.get(fact.accountId);
      if (fact?.kind === "deferred-tipout" && account && isOutgoingCash(cashFlowClass("expense", account.kind))) amount = item.amountCents;
      note = item.direction === "out" ? "Owed · payment needs Confirm" : "Owed to you · receipt needs Confirm";
    } else if (item.source === "rhythm") note = "Suggested rhythm · not a scheduled payment";
    else if (item.source === "claim") note = "Expected recovery · not received";
    else if (item.source === "shift") note = "Posted shift · earnings are not a second cash receipt";
    else if (item.source === "shift-envelope") note = "Shift schedule · not posted money";
    else if (item.source === "google") note = "Calendar overlay · not posted money";
    return { item, outstandingOutCents: amount, note, allowPost, scheduledDate };
  };
  return board.days.filter(day => day.inMonth).map(day => {
    const rows = posted.filter(row => row.date === day.date);
    const scheduled = day.items.map(describe).filter((row): row is WeightItem => row !== null);
    const postedOutCents = rows.reduce((sum, row) => sum + Math.max(0, -cashFlowDelta(row)), 0);
    const postedInCents = rows.reduce((sum, row) => sum + Math.max(0, cashFlowDelta(row)), 0);
    const outstandingOutCents = scheduled.reduce((sum, row) => sum + row.outstandingOutCents, 0);
    return { date: day.date, posted: rows, scheduled, postedOutCents, postedInCents, outstandingOutCents, weightCents: postedOutCents + outstandingOutCents };
  });
}
