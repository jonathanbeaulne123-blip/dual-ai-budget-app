import type { Household, LedgerView, Recurrence } from "./types.ts";
import { addDays, monthKeyFromDateKey, shiftMonthKey, type DateKey } from "./calendar.ts";
import { projectCadence } from "./recurrence.ts";
import { nativeEventOccurrences } from "./nativeEvents.ts";
import { householdForView } from "./visibility.ts";
import { householdWallet } from "./accounts.ts";
import { projectHouseholdFund, shapeHouseholdFundConfig } from "./householdFund.ts";
import { paydayTicks } from "./monthSpread.ts";
import { memberEarningSchedule } from "./work.ts";
import { nextWorkScheduleDate } from "./workSettlement.ts";
import { taskIsFinancial, type Task, type TaskEvidence } from "./tasks.ts";

/**
 * The agenda is a derived read-model: one ranked list per period that unions
 * tasks with the money and life already in the books. It is a pure function
 * over the view-projected household and carries no new money meaning — every
 * amount here is either an accepted transaction or an expectation the books
 * already hold (a recurrence, a planned cost, a goal, a task's expected cost).
 */
export type AgendaKind = "task" | "bill" | "planned-cost" | "appointment" | "shift" | "event" | "goal";
export type AgendaItem = {
  key: string;
  kind: AgendaKind;
  id: string;
  date: DateKey | null;
  /** Deadline when it differs from the do date (tasks only). */
  dueDate: DateKey | null;
  title: string;
  amountCents: number | null;
  money: boolean;
  memberId: string | null;
  done: boolean;
  overdue: boolean;
  task: Task | null;
  /** Evidence the books already hold for a linked money task (derived, never stored until confirmed). */
  evidence: TaskEvidence | null;
};
export type AgendaView = "today" | "week" | "anytime" | "logbook" | "upcoming";
export type AgendaOwnership = "all" | "mine" | "theirs" | "ours";
export type AgendaInput = { memberId: string; view: LedgerView; today: DateKey; from?: DateKey; to?: DateKey; ownership?: AgendaOwnership };

const dateOf = (task: Task) => task.doDate ?? task.dueDate;
const dateKeyOfIso = (iso: string) => iso.slice(0, 10);

/** Occurrence dates of a repeating task inside a window, counted from its own date. */
export function taskOccurrences(task: Task, from: DateKey, to: DateKey): DateKey[] {
  const start = dateOf(task);
  if (!start) return [];
  if (task.repeat === "none") return start >= from && start <= to ? [start] : [];
  if (task.repeat === "yearly") {
    const out: DateKey[] = [];
    for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
      const date = `${year}${start.slice(4)}`;
      if (date >= start && date >= from && date <= to) out.push(date);
    }
    return out;
  }
  return projectCadence(start, task.repeat, from < start ? start : from, to);
}
/** Evidence the books already hold for a linked task. Derived on read so a partner's phone shows the same truth. */
export function evidenceForTask(household: Household, task: Task): TaskEvidence | null {
  if (task.completionEvidence) return task.completionEvidence;
  const link = task.moneyLink;
  if (!link) return null;
  if (link.kind === "recurrence") {
    const tx = household.transactions.find((row) => !row.isDuplicate && row.source === "recurring" && row.sourceId === link.recurrenceId && row.date === link.date)
      ?? household.recurrences.find((row) => row.id === link.recurrenceId)?.payments?.filter((p) => p.occurrenceDate === link.date).map((p) => household.transactions.find((row) => row.id === p.transactionId)).find(Boolean);
    return tx ? { kind: "transaction", transactionId: tx.id, amountCents: tx.amountCents, date: tx.date } : null;
  }
  if (link.kind === "potential-expense") {
    const plan = (household.potentialExpenses ?? []).find((row) => row.id === link.potentialExpenseId);
    const tx = plan?.status === "posted" && plan.transactionId ? household.transactions.find((row) => row.id === plan.transactionId) : null;
    return tx ? { kind: "transaction", transactionId: tx.id, amountCents: tx.amountCents, date: tx.date } : null;
  }
  const since = task.doDate ?? dateKeyOfIso(task.createdAt);
  const contribution = [...(household.goalContributions ?? [])].filter((row) => row.goalId === link.goalId && row.date >= since && (task.expectedAmountCents === null || row.amountCents >= task.expectedAmountCents)).sort((a, b) => a.date.localeCompare(b.date))[0];
  return contribution ? { kind: "goal-contribution", contributionId: contribution.id, amountCents: contribution.amountCents, date: contribution.date } : null;
}
/** Receipts that could be this task's evidence: same window, similar amount, or a shared word. The person chooses; nothing attaches itself. */
export function suggestedEvidence(household: Household, memberId: string, task: Task, today: DateKey): TaskEvidence[] {
  const anchor = task.dueDate ?? task.doDate ?? today;
  const words = task.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  return household.transactions
    .filter((row) => !row.isDuplicate && row.type === "expense" && (row.visibility !== "personal" || row.createdBy === memberId) && row.date >= addDays(anchor, -10) && row.date <= addDays(anchor, 10))
    .map((row) => {
      const amountFit = task.expectedAmountCents ? Math.abs(row.amountCents - task.expectedAmountCents) / task.expectedAmountCents : 1;
      const wordFit = words.some((w) => `${row.note} ${row.place}`.toLowerCase().includes(w)) ? 0 : 1;
      return { row, score: amountFit + wordFit };
    })
    .filter((entry) => entry.score < 1.25)
    .sort((a, b) => a.score - b.score || b.row.date.localeCompare(a.row.date))
    .slice(0, 6)
    .map(({ row }) => ({ kind: "transaction", transactionId: row.id, amountCents: row.amountCents, date: row.date }));
}

function recurrenceVisible(visible: Household, row: Recurrence) {
  return row.active && row.type !== "transfer" && visible.accounts.some((account) => account.id === row.accountId);
}
function postedOccurrence(household: Household, row: Recurrence, date: DateKey) {
  return household.transactions.some((tx) => !tx.isDuplicate && tx.source === "recurring" && tx.sourceId === row.id && tx.date === date) || Boolean(row.payments?.some((p) => p.occurrenceDate === date));
}
function ownershipMatches(task: Task, memberId: string, ownership: AgendaOwnership) {
  if (ownership === "all") return true;
  if (task.visibility === "personal") return ownership === "mine";
  if (ownership === "mine") return task.assigneeId === memberId || task.backupId === memberId;
  if (ownership === "theirs") return task.assigneeId !== null && task.assigneeId !== memberId;
  return task.assigneeId === null;
}

/** Every visible open task that could still be done; repeating tasks appear once per occurrence in the window. */
function taskItems(full: Household, visible: Household, input: AgendaInput, from: DateKey, to: DateKey): AgendaItem[] {
  const ownership = input.ownership ?? "all";
  return (visible.tasks ?? []).filter((task) => !task.deleted && ownershipMatches(task, input.memberId, ownership)).flatMap((task): AgendaItem[] => {
    const evidence = task.completedAt ? task.completionEvidence : evidenceForTask(full, task);
    const done = Boolean(task.completedAt) || (evidence !== null && task.moneyLink !== null);
    const base = { kind: "task" as const, id: task.id, title: task.title, amountCents: task.expectedAmountCents, money: taskIsFinancial(task), memberId: task.assigneeId, task, evidence, dueDate: task.dueDate };
    const own = dateOf(task);
    if (done) return [{ ...base, key: task.id, date: task.completedAt ? dateKeyOfIso(task.completedAt) : evidence?.date ?? own, done: true, overdue: false }];
    if (!own) return [{ ...base, key: task.id, date: null, done: false, overdue: false }];
    if (task.repeat === "none") return [{ ...base, key: task.id, date: own, done: false, overdue: own < input.today }];
    const dates = own < from ? [own, ...taskOccurrences(task, from, to)] : taskOccurrences(task, from, to);
    return dates.map((date) => ({ ...base, key: `${task.id}@${date}`, date, dueDate: task.dueDate && task.doDate ? addDays(task.dueDate, Math.round((Date.parse(date) - Date.parse(task.doDate)) / 86400000)) : task.dueDate, done: false, overdue: date < input.today }));
  });
}
function booksItems(full: Household, visible: Household, input: AgendaInput, from: DateKey, to: DateKey): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const row of visible.recurrences.filter((r) => recurrenceVisible(visible, r))) {
    for (const date of projectCadence(row.nextDate, row.cadence, from, to)) {
      const done = postedOccurrence(full, row, date);
      items.push({ key: `bill:${row.id}:${date}`, kind: "bill", id: row.id, date, dueDate: null, title: row.note || (row.kind === "paycheck" ? "Payday" : "Recurring"), amountCents: row.type === "income" ? -row.amountCents : row.amountCents, money: true, memberId: null, done, overdue: !done && date < input.today, task: null, evidence: null });
    }
  }
  // A bill paid early leaves the projection (its template advanced) but must not vanish: the posted occurrence is the done row.
  for (const tx of visible.transactions.filter((t) => !t.isDuplicate && t.source === "recurring" && t.sourceId && t.date >= from && t.date <= to)) {
    const row = visible.recurrences.find((r) => r.id === tx.sourceId);
    if (!row || items.some((item) => item.key === `bill:${row.id}:${tx.date}`)) continue;
    items.push({ key: `bill:${row.id}:${tx.date}`, kind: "bill", id: row.id, date: tx.date, dueDate: null, title: row.note || tx.note || "Recurring", amountCents: tx.type === "income" ? -tx.amountCents : tx.amountCents, money: true, memberId: null, done: true, overdue: false, task: null, evidence: { kind: "transaction", transactionId: tx.id, amountCents: tx.amountCents, date: tx.date } });
  }
  for (const row of (visible.potentialExpenses ?? []).filter((r) => r.status === "planned" && r.date >= from && r.date <= to)) {
    items.push({ key: `planned:${row.id}`, kind: "planned-cost", id: row.id, date: row.date, dueDate: null, title: row.title, amountCents: row.expectedAmountCents, money: true, memberId: null, done: false, overdue: row.date < input.today, task: null, evidence: null });
  }
  for (const row of (visible.appointments ?? []).filter((r) => r.active && r.nextDate >= from && r.nextDate <= to)) {
    const memberId = typeof row.memberId === "string" && visible.members.some((m) => m.id === row.memberId) ? row.memberId : null;
    if (input.view === "personal" && memberId && memberId !== input.memberId) continue;
    items.push({ key: `appointment:${row.id}`, kind: "appointment", id: row.id, date: row.nextDate, dueDate: null, title: row.title, amountCents: row.typicalCostCents || null, money: false, memberId, done: false, overdue: false, task: null, evidence: null });
  }
  for (const row of visible.shifts.filter((r) => r.date >= from && r.date <= to && !r.correctedByShiftId)) {
    items.push({ key: `shift:${row.id}`, kind: "shift", id: row.id, date: row.date, dueDate: null, title: `${visible.members.find((m) => m.id === row.memberId)?.name ?? "A"} shift`, amountCents: null, money: false, memberId: row.memberId, done: row.date < input.today, overdue: false, task: null, evidence: null });
  }
  for (const row of visible.nativeEvents ?? []) {
    for (const occurrence of nativeEventOccurrences(row, from, to)) {
      items.push({ key: `event:${row.id}:${occurrence.date}`, kind: "event", id: row.id, date: occurrence.date, dueDate: null, title: row.title, amountCents: null, money: false, memberId: row.visibility === "personal" ? row.createdBy : null, done: false, overdue: false, task: null, evidence: null });
    }
  }
  for (const row of visible.goals.filter((g) => g.status === "open" && g.deadline && g.deadline >= from && g.deadline <= to)) {
    items.push({ key: `goal:${row.id}`, kind: "goal", id: row.id, date: row.deadline, dueDate: null, title: `${row.name} arrives`, amountCents: Math.max(0, row.targetCents - row.savedCents) || null, money: true, memberId: row.ownerMemberId, done: row.savedCents >= row.targetCents, overdue: false, task: null, evidence: null });
  }
  return items;
}
const RANK: Record<AgendaKind, number> = { task: 0, bill: 1, "planned-cost": 2, goal: 3, appointment: 4, shift: 5, event: 6 };
function sortItems(items: AgendaItem[]) {
  return items.sort((a, b) => Number(a.done) - Number(b.done) || (a.date ?? "9999").localeCompare(b.date ?? "9999") || RANK[a.kind] - RANK[b.kind] || a.title.localeCompare(b.title));
}

export type Agenda = { view: AgendaView; from: DateKey; to: DateKey; items: AgendaItem[]; days: { date: DateKey; items: AgendaItem[] }[]; months: { monthKey: string; items: AgendaItem[]; handled: number; bills: number; billCents: number }[] };
export function agenda(household: Household, view: AgendaView, input: AgendaInput): Agenda {
  const visible = householdForView(household, input.memberId, input.view);
  const today = input.today;
  const from = input.from ?? (view === "week" ? today : view === "upcoming" ? addDays(today, 1) : today);
  const to = input.to ?? (view === "week" ? addDays(today, 6) : view === "upcoming" ? addDays(today, 30) : today);
  const tasks = taskItems(household, visible, input, from, to);
  if (view === "anytime") return { view, from, to, items: sortItems(tasks.filter((item) => !item.done && item.date === null)), days: [], months: [] };
  if (view === "logbook") {
    const done = sortItems(tasks.filter((item) => item.done)).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const months = new Map<string, AgendaItem[]>();
    for (const item of done) { const key = item.date ? monthKeyFromDateKey(item.date) : "undated"; months.set(key, [...(months.get(key) ?? []), item]); }
    return { view, from, to, items: done, days: [], months: [...months.entries()].map(([monthKey, items]) => ({ monthKey, items, handled: items.length, bills: items.filter((i) => i.money).length, billCents: items.reduce((sum, i) => sum + (i.evidence?.amountCents ?? i.amountCents ?? 0), 0) })) };
  }
  // Open tasks dated inside the window, overdue ones carried to the first day, and what already got done this period.
  const dated = tasks.filter((item) => item.date !== null && item.date <= to && (item.done ? item.date >= from : item.date >= from || item.overdue));
  const items = sortItems([...dated, ...booksItems(household, visible, input, from, to)]);
  const days: Agenda["days"] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) days.push({ date, items: items.filter((item) => item.date === date || (date === from && item.overdue && (item.date ?? "") < from)) });
  return { view, from, to, items, days, months: [] };
}

export type AffordabilityStatus = "covered" | "short-until-payday" | "short" | "none";
export type AffordabilityLine = { key: string; status: AffordabilityStatus; shortCents: number; payday: DateKey | null };
export type Affordability = {
  from: DateKey; to: DateKey;
  /** Cash the view can spend today: the Fund's free-to-spend when configured, else visible cash accounts. */
  availableCents: number;
  /** Open money the period still expects: money tasks, unpaid bills, planned costs. */
  plannedCents: number;
  /** Known income landing inside the period (paycheck recurrences). */
  incomeCents: number;
  nextPayday: DateKey | null;
  lines: Map<string, AffordabilityLine>;
  source: "fund" | "accounts";
};
export function nextPayday(household: Household, memberId: string, view: LedgerView, today: DateKey): DateKey | null {
  const candidates: DateKey[] = [];
  const fund = shapeHouseholdFundConfig(household.householdFund);
  if (view === "household" && fund) for (const key of [monthKeyFromDateKey(today), shiftMonthKey(monthKeyFromDateKey(today), 1)]) candidates.push(...paydayTicks(household, key).map((t) => t.date));
  const schedule = memberEarningSchedule(household, view === "personal" ? memberId : fund?.custodianMemberId ?? memberId);
  const scheduled = schedule ? nextWorkScheduleDate(schedule, addDays(today, 1)) : null;
  if (scheduled) candidates.push(scheduled);
  for (const row of household.recurrences.filter((r) => r.active && r.kind === "paycheck")) candidates.push(...projectCadence(row.nextDate, row.cadence, addDays(today, 1), addDays(today, 45)));
  return candidates.filter((d) => d > today).sort()[0] ?? null;
}
/** Planned spend against what is actually available, with the payday line. Pure; no new money meaning. */
export function affordability(household: Household, items: AgendaItem[], input: AgendaInput & { from: DateKey; to: DateKey }): Affordability {
  const visible = householdForView(household, input.memberId, input.view);
  const fund = shapeHouseholdFundConfig(household.householdFund);
  const useFund = input.view === "household" && Boolean(fund);
  const availableCents = useFund ? projectHouseholdFund(household, input.today).freeToSpendCents : householdWallet(visible, input.today).cashCents;
  const payday = nextPayday(household, input.memberId, input.view, input.today);
  const incomes = visible.recurrences.filter((r) => r.active && r.type === "income" && recurrenceVisible(visible, r)).flatMap((r) => projectCadence(r.nextDate, r.cadence, addDays(input.today, 1), input.to).map((date) => ({ date, amountCents: r.amountCents })));
  const planned = items.filter((item) => item.money && !item.done && item.amountCents !== null && item.amountCents > 0 && item.kind !== "goal").sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const lines = new Map<string, AffordabilityLine>();
  let cumulative = 0;
  for (const item of planned) {
    const amount = item.amountCents!, date = item.date ?? input.to;
    cumulative += amount;
    const now = availableCents - cumulative;
    const knownIncome = incomes.filter((i) => i.date <= date).reduce((sum, i) => sum + i.amountCents, 0);
    // Covered by cash on hand, or by known income that lands first; a payday with no known amount is a hope, and reads as one.
    const status: AffordabilityStatus = now >= 0 || availableCents + knownIncome - cumulative >= 0 ? "covered" : payday && payday <= date ? "short-until-payday" : "short";
    lines.set(item.key, { key: item.key, status, shortCents: status === "covered" ? 0 : Math.min(amount, -now), payday: status === "covered" ? null : payday });
  }
  for (const item of items) if (!lines.has(item.key)) lines.set(item.key, { key: item.key, status: item.money && !item.done ? "covered" : "none", shortCents: 0, payday: null });
  return { from: input.from, to: input.to, availableCents, plannedCents: planned.reduce((sum, p) => sum + p.amountCents!, 0), incomeCents: incomes.reduce((sum, i) => sum + i.amountCents, 0), nextPayday: payday, lines, source: useFund ? "fund" : "accounts" };
}
