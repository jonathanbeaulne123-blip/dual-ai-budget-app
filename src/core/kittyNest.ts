import { walletForListedAccounts } from "./accounts.ts";
import { projectedCountable, projectedExpenseEffect, transactionProjection } from "./budget.ts";
import { type DateKey, monthKeyFromDateKey } from "./calendar.ts";
import { goalFundReserve, goalRemainingClaim } from "./goalEnvelopes.ts";
import { projectHouseholdFund } from "./householdFund.ts";
import { booksPresentationFloor } from "./ledgerExperience.ts";
import { goalVisibleInView, isVisibleInView } from "./visibility.ts";
import { nestDesignInView, nestLookAt, NEST_CATEGORIES, type KittyNestDesign, type NestCategory } from "./kittyNestDesigns.ts";
import type { Goal, Household, LedgerView } from "./types.ts";

export type NestBank = {
  id: string;
  designKey: string;
  tier: "king" | "plan" | "goal" | "bill";
  parentId: string | null;
  category: NestCategory | null;
  name: string;
  amountCents: number;
  targetCents: number;
  date: DateKey | null;
  state: "open" | "broken" | "archived";
  receiptId?: string;
  goal?: Goal;
  design?: KittyNestDesign;
  children: NestBank[];
};
export type KittyNest = { king: NestBank; categories: NestBank[]; history: NestBank[]; totalCents: number; sourceLabel: string };
export const NEST_CATEGORY_LABELS: Record<NestCategory, string> = { protect: "Protect", everyday: "Everyday", build: "Build", prepare: "Prepare" };
export const NEST_CATEGORY_MEANINGS: Record<NestCategory, string> = {
  protect: "Bills and breathing room", everyday: "Day-to-day choices", build: "Dreams we are growing", prepare: "Costs coming around",
};
export function nestCategoryFor(name: string, explicit?: NestCategory | null): NestCategory {
  if (explicit) return explicit;
  if (/vacation|holiday|trip|travel|wedding|renovat|home deposit|date night|concert/i.test(name)) return "build";
  if (/annual|yearly|christmas|birthday|tax|insurance|repair|school/i.test(name)) return "prepare";
  if (/rent|mortgage|hydro|phone|internet|electric|utility|emergency|buffer/i.test(name)) return "protect";
  return "everyday";
}
/** Exact cents, including debt. Targets are wishes; these shares are portions of one total. */
export function allocateNestTotal(totalCents: number, desired: Partial<Record<NestCategory, number>>): Record<NestCategory, number> {
  if (!Number.isSafeInteger(totalCents)) throw new Error("Invalid King amount.");
  const result = { protect: 0, everyday: 0, build: 0, prepare: 0 };
  let remaining = Math.max(0, totalCents);
  for (const category of ["build", "prepare", "protect"] as const) {
    const amount = desired[category] ?? 0;
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid category amount.");
    result[category] = Math.min(remaining, amount);
    remaining -= result[category];
  }
  result.everyday = totalCents - result.protect - result.build - result.prepare;
  return result;
}
/** Receipt truth, including correction/reversal chains and refunds; no inferred paid dates. */
export function nestReceiptAmount(h: Household, receiptId: string, memberId: string, view: LedgerView, today: DateKey): number {
  const rows = h.transactions.filter(tx => tx.date <= today && isVisibleInView(tx, memberId, view));
  const byId = new Map(rows.map(tx => [tx.id, tx]));
  const receipt = byId.get(receiptId);
  if (!receipt || receipt.type !== "expense" || !projectedCountable(receipt, byId)) return 0;
  let amount = 0;
  for (const tx of rows) {
    if (!projectedCountable(tx, byId)) continue;
    let root = transactionProjection(tx, byId).root;
    const seen = new Set<string>();
    while (root.refundOfId && !seen.has(root.id)) {
      seen.add(root.id);
      const parent = byId.get(root.refundOfId);
      if (!parent) break;
      root = transactionProjection(parent, byId).root;
    }
    if (root.id === receiptId) amount += projectedExpenseEffect(tx, byId);
  }
  return Math.max(0, amount);
}
/** Stable view over accepted sources: opening Home never creates or posts anything. */
export function projectKittyNest(h: Household, memberId: string, view: LedgerView, today: DateKey): KittyNest {
  const designs = new Map((h.kittyNestDesigns ?? []).filter(row => nestDesignInView(row, memberId, view)).map(row => [row.bankKey, row]));
  const floor = booksPresentationFloor(h, memberId, view);
  const accountIds = new Set(floor.accounts.filter(a => view === "household" ? a.scope !== "personal" : a.scope === "personal" && a.ownerMemberId === memberId).map(a => a.id));
  const fund = projectHouseholdFund(h, today);
  const totalCents = view === "household" ? fund.operatingBalanceCents + fund.kittyCents : walletForListedAccounts(h, floor.accounts.map(a => a.id), today).netWorthCents;
  const sourceNames = new Map<string, string>();
  const make = (id: string, designKey: string, tier: NestBank["tier"], name: string, category: NestCategory | null, targetCents = 0, date: DateKey | null = null): NestBank => {
    const design = designs.get(designKey);
    sourceNames.set(id, name);
    return { id, designKey, tier, name: design?.name || name, category: design?.category ?? category, parentId: tier === "king" ? null : tier === "plan" ? "king" : `plan:${design?.category ?? category ?? "everyday"}`, amountCents: 0, targetCents, date, state: design?.archivedAt ? "archived" : "open", design, children: [] };
  };
  const king = make("king", "king", "king", view === "household" ? "Our King" : "My King", null);
  king.amountCents = totalCents;
  const categories = NEST_CATEGORIES.map(category => make(`plan:${category}`, `plan:${category}`, "plan", NEST_CATEGORY_LABELS[category], category));
  king.children = categories;
  const leaves: NestBank[] = [];
  const representedPlanLines = new Set<string>();
  for (const goal of h.goals.filter(g => goalVisibleInView(g, memberId, view))) {
    // Migration is a projection: retain every legacy goal ID, design, receipt and contribution.
    const category = nestCategoryFor(goal.name, goal.envelope?.kind);
    const bank = make(`goal:${goal.id}`, `goal:${goal.id}`, "goal", goal.name, category, goal.targetCents, goal.arrivalDate ?? goal.deadline);
    bank.goal = goal;
    const reserve = view === "household" ? goalFundReserve(h, goal.id, today) : null;
    bank.amountCents = view === "household" ? (reserve?.unresolved ? 0 : reserve?.reservedCents ?? 0) : goalRemainingClaim(h, goal, today);
    bank.state = goal.envelope?.archivedAt ? "archived" : goal.status === "retired" ? "broken" : "open";
    leaves.push(bank);
  }
  for (const recurrence of h.recurrences.filter(r => r.type === "expense" && accountIds.has(r.accountId))) {
    const designKey = `recurrence:${recurrence.id}`;
    const category = nestCategoryFor(recurrence.note);
    const evidence = new Map<string, string[]>();
    const explicitlyLinked = new Set((recurrence.payments ?? []).map(payment => payment.transactionId));
    for (const payment of recurrence.payments ?? []) evidence.set(payment.occurrenceDate, [...(evidence.get(payment.occurrenceDate) ?? []), payment.transactionId]);
    for (const tx of h.transactions) if (tx.type === "expense" && tx.source === "recurring" && tx.sourceId === recurrence.id && !tx.reversalOfId && !tx.refundOfId && !explicitlyLinked.has(tx.id)) evidence.set(tx.date, [...(evidence.get(tx.date) ?? []), tx.id]);
    for (const [date, receiptIds] of evidence) {
      const receiptId = receiptIds.find(id => nestReceiptAmount(h, id, memberId, view, today) > 0) ?? receiptIds[0]!;
      const paid = receiptIds.reduce((sum, id) => sum + nestReceiptAmount(h, id, memberId, view, today), 0);
      const bank = make(`${designKey}:${date}`, designKey, "bill", recurrence.note || "Recurring bill", category, recurrence.amountCents, date);
      if (paid > 0) { bank.state = "broken"; bank.receiptId = receiptId; }
      // A reversed payment restores the old obligation without erasing the next occurrence.
      if (paid > 0 || recurrence.active) leaves.push(bank);
    }
    if (recurrence.active && !evidence.has(recurrence.nextDate)) leaves.push(make(`${designKey}:${recurrence.nextDate}`, designKey, "bill", recurrence.note || "Recurring bill", category, recurrence.amountCents, recurrence.nextDate));
  }
  for (const expense of h.potentialExpenses ?? []) {
    if (!accountIds.has(expense.accountId) || !isVisibleInView(expense, memberId, view) || expense.status === "removed") continue;
    const key = `potential:${expense.id}`;
    const bank = make(key, key, "bill", expense.title, nestCategoryFor(expense.title), expense.expectedAmountCents, expense.date);
    if (expense.transactionId && nestReceiptAmount(h, expense.transactionId, memberId, view, today) > 0) { bank.state = "broken"; bank.receiptId = expense.transactionId; }
    leaves.push(bank);
  }
  for (const appointment of floor.appointments) {
    if (!accountIds.has(appointment.accountId) || appointment.typicalCostCents <= 0) continue;
    const key = `appointment:${appointment.id}`;
    if (appointment.active) leaves.push(make(`${key}:${appointment.nextDate}`, key, "bill", appointment.sensitivity === "quiet" ? "Appointment" : appointment.title, "prepare", appointment.typicalCostCents, appointment.nextDate));
    const visitIds = new Set([
      ...(appointment.lastPostedTransactionId ? [appointment.lastPostedTransactionId] : []),
      ...h.transactions.filter(tx => tx.source === "visit" && tx.sourceId === appointment.id && tx.type === "expense" && !tx.reversalOfId && !tx.refundOfId).map(tx => tx.id),
      ...h.claims.filter(claim => claim.appointmentId === appointment.id).map(claim => claim.expenseTransactionId),
    ]);
    for (const receiptId of visitIds) {
      const receipt = h.transactions.find(tx => tx.id === receiptId);
      if (!receipt || nestReceiptAmount(h, receiptId, memberId, view, today) <= 0) continue;
      const bank = make(`${key}:paid:${receipt.id}`, key, "bill", appointment.sensitivity === "quiet" ? "Appointment" : appointment.title, "prepare", receipt.amountCents, receipt.date);
      bank.state = "broken"; bank.receiptId = receiptId; leaves.push(bank);
    }
  }
  for (const task of h.tasks ?? []) {
    if (task.deleted || task.visibility !== view || (view === "personal" && task.createdBy !== memberId) || task.moneyLink || !task.expectedAmountCents) continue;
    const key = `task:${task.id}`;
    if (task.planReference) representedPlanLines.add(`${task.planReference.planVersionId}:${task.planReference.planLineId}`);
    const bank = make(key, key, "bill", task.title, nestCategoryFor(task.title), task.expectedAmountCents, task.dueDate ?? task.doDate ?? null);
    if (task.completionEvidence?.kind === "transaction" && nestReceiptAmount(h, task.completionEvidence.transactionId, memberId, view, today) > 0) { bank.state = "broken"; bank.receiptId = task.completionEvidence.transactionId; }
    leaves.push(bank);
  }
  for (const bank of leaves) if (bank.state === "broken" && bank.receiptId) {
    const paidAt = h.transactions.find(tx => tx.id === bank.receiptId)?.createdAt;
    if (paidAt) {
      const historic = nestLookAt(bank.design, paidAt);
      if (bank.design && !historic) bank.name = sourceNames.get(bank.id) ?? bank.name;
      bank.design = historic;
      if (historic?.name) bank.name = historic.name;
    }
  }
  const month = monthKeyFromDateKey(today);
  const versions = (h.planVersions ?? []).filter(v => v.scope === view && v.monthKey === month && v.state === "active" && (view === "household" || v.ownerMemberId === memberId)).sort((a, b) => b.sequence - a.sequence);
  for (const line of versions[0]?.lines ?? []) {
    if ((line.sourceReference && line.sourceReference.type !== "category") || line.envelopeGoalId
      || representedPlanLines.has(`${versions[0]!.id}:${line.id}`)
      || !["obligation", "true-expense"].includes(line.kind) || line.amountCents <= 0) continue;
    const key = `plan-line:${line.id}`;
    leaves.push(make(key, key, "bill", line.labelSnapshot, line.lens, line.kind === "true-expense" ? line.decision?.targetCents ?? line.amountCents : line.amountCents, line.dueDate ?? line.decision?.deadline ?? null));
  }
  const desired = { protect: 0, everyday: 0, build: 0, prepare: 0 };
  for (const bank of leaves) if (bank.goal && bank.state === "open") desired[bank.category ?? "everyday"] += bank.amountCents;
  if (view === "household") {
    // Unattributed historic Fund earmarks stay represented without inventing a goal owner.
    desired.build += Math.max(0, fund.kittyCents - Object.values(desired).reduce((sum, n) => sum + n, 0));
    desired.protect += Math.max(0, fund.bufferCents + fund.upcomingReserveCents + fund.transferDueCents - fund.transferCreditCents);
  } else {
    for (const bank of leaves) if (bank.tier === "bill" && bank.state === "open" && bank.date && bank.date.slice(0, 7) === month) desired[bank.category ?? "everyday"] += bank.targetCents;
  }
  const allocations = allocateNestTotal(totalCents, desired);
  for (const category of categories) {
    category.amountCents = allocations[category.category!];
    category.children = leaves.filter(bank => bank.category === category.category && bank.state === "open").sort((a, b) => (a.tier === b.tier ? (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.id.localeCompare(b.id) : a.tier === "goal" ? -1 : 1));
    category.targetCents = category.children.reduce((sum, bank) => sum + bank.targetCents, 0);
    let available = Math.max(0, category.amountCents - category.children.filter(bank => bank.goal).reduce((sum, bank) => sum + bank.amountCents, 0));
    for (const bank of category.children.filter(bank => !bank.goal)) { bank.amountCents = Math.min(available, bank.targetCents); available -= bank.amountCents; }
  }
  king.targetCents = categories.reduce((sum, category) => sum + category.targetCents, 0);
  return { king, categories, history: leaves.filter(bank => bank.state !== "open"), totalCents, sourceLabel: view === "household" ? "Whole Household Fund" : "Net worth" };
}
