import { goalEnvelopeUsedCents, goalFundReserve } from "./goalEnvelopes.ts";
import { addDays, calendarDaysBetween, isValidDateKey, monthEndKey, monthStartKey, type DateKey, type MonthKey } from "./calendar.ts";
import { walletForListedAccounts } from "./accounts.ts";
import { isCashLikeKind } from "./accountKinds.ts";
import { projectedCountable, projectedExpenseEffect, transactionProjection } from "./budget.ts";
import { prepareFundHorizon } from "./fundHorizon.ts";
import { foldFundMovements, type FundMovement } from "./fundMovements.ts";
import { activeHouseholdFundEvents } from "./householdFund.ts";
import { compileHousehold } from "./journal.ts";
import { goalVaultCapacity } from "./goalVault.ts";
import { monthObligations } from "./monthObligations.ts";
import { goalVisibleInView, isVisibleInView } from "./visibility.ts";
import { advanceCadence, projectCadence } from "./recurrence.ts";
import type { Household, Transaction } from "./types.ts";
import type { PlanAssumption, PlanDraft, PlanLine, PlanScope, PlanSourceReference, PlanVersion } from "./planSystem.ts";

export type PlanSelection = {
  kind: "version" | "draft" | "scenario";
  id: string;
  scope: PlanScope;
  ownerMemberId?: string;
  monthKey: MonthKey;
  lines: readonly PlanLine[];
  assumptions: readonly PlanAssumption[];
};
export const planSelectionForDraft = (draft: PlanDraft): PlanSelection => ({ ...draft, kind: "draft", monthKey: draft.targetMonth });
export const planSelectionForVersion = (version: PlanVersion): PlanSelection => ({ ...version, kind: "version" });
export type PlanEvidence = { id: string; kind: "payment" | "goal-funding" | "goal-record" | "contribution"; date: DateKey; amountCents: number; reserveCents?: number };
export type PlanLineProjection = {
  line: PlanLine;
  intendedCents: number;
  actualCents: number;
  recordedProgressCents: number;
  verifiedProgressCents: number;
  outcomeFulfilled: boolean;
  remainingCents: number;
  coveredNowCents: number;
  expectedCoverageCents: number;
  gapCents: number;
  dueDate: DateKey | null;
  status: "completed" | "covered-now" | "depends-on-income" | "gap" | "intention" | "outside-horizon";
  evidence: PlanEvidence[];
  issues: string[];
};
export type PlanProjection = {
  kind: "ready" | "unavailable";
  selection: Pick<PlanSelection, "kind" | "id" | "scope" | "monthKey">;
  sourceRevision: number;
  asOf: DateKey;
  through: DateKey;
  cashNowCents: number | null;
  bufferCents: number;
  lines: PlanLineProjection[];
  movements: FundMovement[];
  committedMovements: FundMovement[];
  datedCapacity: Array<{ date: DateKey; balanceCents: number; sourceId: string | null; label: string }>;
  lowPoint: { date: DateKey; balanceCents: number } | null;
  firstExposed: { date: DateKey; label: string; gapCents: number } | null;
  uncommittedNowCents: number | null;
  everydayAllowanceCents: number;
  everydayNowCents: number | null;
  everydayProjectedCents: number | null;
  assumptions: string[];
  issues: string[];
};

/** Read-only evidence matching. Both refund and reversal ancestry matter. */
function purchaseRoot(tx: Transaction, byId: ReadonlyMap<string, Transaction>): Transaction {
  let root = transactionProjection(tx, byId).root;
  const seen = new Set<string>();
  while (root.refundOfId && !seen.has(root.id)) {
    seen.add(root.id);
    const original = byId.get(root.refundOfId);
    if (!original) break;
    root = transactionProjection(original, byId).root;
  }
  return root;
}
export function planSourceVisible(h: Household, source: PlanSourceReference, memberId: string, scope: PlanScope): boolean {
  if (source.type === "category") return h.categories.some(row => row.id === source.id);
  if (source.type === "goal") return h.goals.some(row => row.id === source.id && goalVisibleInView(row, memberId, scope));
  if (source.type === "potential-expense") return (h.potentialExpenses ?? []).some(row => row.id === source.id && isVisibleInView(row, memberId, scope));
  if (source.type === "fund") return scope === "household" && h.householdFund?.id === source.id;
  if (source.type === "bridge") return scope === "household" && (h.planBridgeDecisions ?? []).some(row => row.id === source.id && !["withdrawn", "declined", "superseded"].includes(row.state));
  const recurrence = h.recurrences.find(row => row.id === source.id);
  if (!recurrence) return false;
  const account = h.accounts.find(row => row.id === recurrence.accountId);
  return scope === "personal" ? account?.scope === "personal" && account.ownerMemberId === memberId
    : Boolean(account && account.scope !== "personal");
}

export function matchPlanEvidence(h: Household, line: PlanLine, monthKey: MonthKey, asOf: DateKey, memberId: string, scope: PlanScope): PlanEvidence[] {
  const source = line.sourceReference;
  if (!source || !planSourceVisible(h, source, memberId, scope)) return [];
  const byId = new Map(h.transactions.filter(tx => tx.date <= asOf).map(tx => [tx.id, tx]));
  if (source.type === "goal") {
    const contributions = (h.goalContributions ?? []).filter(row => row.goalId === source.id && row.date <= asOf && (scope === "household" || row.memberId === memberId));

    // Both transfer legs describe one economic movement. Reversals reduce that
    // movement; an incoming leg must never create another funding principal.
    const economicTransfer = (id: string) => {
      const tx = byId.get(id);
      if (!tx) return null;
      const root = transactionProjection(tx, byId).root;
      const pair = root.transferPairId ? byId.get(root.transferPairId) : undefined;
      if (root.type !== "transfer" || !pair || pair.transferPairId !== root.id) return null;
      const out = root.accountId === root.transferFromAccountId ? root : pair;
      const incoming = out.id === root.id ? pair : root;
      if (incoming.accountId !== out.transferToAccountId || out.amountCents !== incoming.amountCents) return null;
      const netFor = (leg: Transaction) => [...byId.values()].filter(item => transactionProjection(item, byId).root.id === leg.id && projectedCountable(item, byId)).reduce((sum, item) => sum + item.amountCents * transactionProjection(item, byId).multiplier, 0);
      return { root: out, net: Math.max(0, Math.min(netFor(out), netFor(incoming))) };
    };
    const claims = (h.goalContributions ?? []).filter(row => row.date <= asOf).map(row => ({ row, transfer: row.transferId ? economicTransfer(row.transferId) : null }));
    const backedClaim = (claim: typeof claims[number]) => {
      const root = claim.transfer?.root;
      const destination = root?.transferToAccountId ? h.accounts.find(account => account.id === root.transferToAccountId) : undefined;
      const visibleVault = Boolean(destination); // The existing vault partitions entries by goal owner, not account custody.
      const claimed = claims.filter(other => root && other.transfer?.root.id === root.id).reduce((sum, other) => sum + other.row.amountCents, 0);
      return Boolean(root && visibleVault && destination?.savings?.purpose === "goals" && isVisibleInView(root, memberId, scope) && claim.transfer!.net >= claimed);
    };
    let usedRemaining = goalEnvelopeUsedCents(h, source.id, asOf);
    const evidence: PlanEvidence[] = contributions.map(row => {
      const claim = claims.find(item => item.row.id === row.id)!;
      const backed = backedClaim(claim);
      const vault = claim.transfer?.root.transferToAccountId;
      // A withdrawal without goal attribution makes current reserves uncertain.
      // Keep the historical contribution, but never spend the same cash twice.
      const vaultClaims = h.goals.filter(goal => goal.status !== "retired" && !goal.purchaseId && goalVisibleInView(goal, memberId, scope)).reduce((total, goal) => total + Math.min(Math.max(0, goal.savedCents), Math.max(0, claims.filter(other => other.row.goalId === goal.id && other.transfer?.root.transferToAccountId === vault && backedClaim(other)).reduce((sum, other) => sum + other.row.amountCents, 0) - goalEnvelopeUsedCents(h, goal.id, asOf))), 0);
      let currentBacking = false;
      if (backed && vault) { const capacity = goalVaultCapacity(h, source.id, asOf); currentBacking = capacity.kind === "ready" && capacity.vaultId === vault && capacity.cashCents >= vaultClaims; }
      const consumed = backed ? Math.min(usedRemaining, row.amountCents) : 0;
      usedRemaining -= consumed;
      return { id: row.id, kind: backed ? "goal-funding" : "goal-record", date: row.date, amountCents: row.amountCents, reserveCents: currentBacking ? row.amountCents - consumed : 0 };
    });
    // Kitty allocations are an alternative accepted funding path, not a second transfer.
    if (scope === "household" && h.householdFund) {
      const events = activeHouseholdFundEvents({...h,fundEvents:h.fundEvents?.filter(row=>row.date<=asOf)}, h.householdFund.id);
      const reserve = goalFundReserve(h, source.id, asOf);
      const released = reserve.unresolved;
      let fundReleased = reserve.releasedCents;
      for (const allocation of h.fundKittyAllocations ?? []) {
        const event = events.find(row => row.id === allocation.eventId && row.kind === "kitty-allocated");
        if (allocation.goalId === source.id && event) { const consumed = Math.min(fundReleased, allocation.amountCents); fundReleased -= consumed; evidence.push({ id: allocation.id, kind: released ? "goal-record" : "goal-funding", date: event.date, amountCents: allocation.amountCents, reserveCents: released?0:Math.max(0, allocation.amountCents - consumed) }); }
      }
    }
    return evidence;
  }
  if (source.type === "fund" || source.type === "bridge") {
    if (!h.householdFund || scope !== "household") return [];
    const bridge = source.type === "bridge" ? (h.planBridgeDecisions ?? []).find(row => row.id === source.id) : null;
    if (bridge) return []; // A member receipt does not identify which offer it fulfilled.
    return activeHouseholdFundEvents(h, h.householdFund.id).filter(row => row.kind === "contribution-confirmed" && row.date <= asOf && row.date.startsWith(monthKey)
).map(row => ({ id: row.id, kind: "contribution", date: row.date, amountCents: row.amountCents }));
  }
  const recurrence = source.type === "recurrence" ? h.recurrences.find(row => row.id === source.id) : undefined;
  const explicitIds = new Set(recurrence?.payments?.filter(row => row.occurrenceDate.startsWith(monthKey)).map(row => row.transactionId) ?? []);
  const potential = source.type === "potential-expense" ? h.potentialExpenses?.find(row => row.id === source.id) : undefined;
  return [...byId.values()].flatMap(tx => {
    if (!isVisibleInView(tx, memberId, scope) || !projectedCountable(tx, byId)) return [];
    const root = purchaseRoot(tx, byId);
    if (!isVisibleInView(root, memberId, scope)) return [];
    const matches = source.type === "category" ? tx.date.startsWith(monthKey) && transactionProjection(tx, byId).root.subcategoryId === source.id
      : source.type === "recurrence" ? explicitIds.has(root.id) || root.date.startsWith(monthKey) && root.source === "recurring" && root.sourceId === source.id
      : Boolean(potential?.transactionId && root.id === potential.transactionId);
    if (!matches) return [];
    const amountCents = projectedExpenseEffect(tx, byId);
    return amountCents ? [{ id: tx.id, kind: "payment" as const, date: tx.date, amountCents }] : [];
  });
}

/** Complete bounded enumeration for preparation; legacy cadence semantics remain unchanged. */
export function completePlanDates(start: DateKey, cadence: import("./types.ts").RecurrenceCadence, from: DateKey, through: DateKey): DateKey[] {
  if (![start, from, through].every(isValidDateKey)) return [];
  let cursor = start;
  const dates: DateKey[] = [];
  for (let step = 0; cursor <= through && step < 40000; step++) {
    if (cursor >= from) dates.push(cursor);
    const next = advanceCadence(cursor, cadence);
    if (next <= cursor) break;
    cursor = next;
  }
  return dates;
}

export function planIntendedCents(line: PlanLine, month: MonthKey): number {
  if (line.cadence !== "weekly") return line.amountCents;
  const start = line.dueDate && isValidDateKey(line.dueDate) ? line.dueDate : monthStartKey(month);
  return line.amountCents * projectCadence(start, "weekly", monthStartKey(month), monthEndKey(month)).length;
}

export type PlanDisruption = { incomeDelayDays?: number; incomeReductionPercent?: number; extraCostCents?: number; extraCostDate?: DateKey; expenseIncreasePercent?: number };

/** One scope, accepted revision, dated opening, and explicit working selection. Never writes books. */
export function projectPlan(h: Household, input: {
  memberId: string; scope: PlanScope; acceptedRevision: number; asOf: DateKey; through: DateKey; selection: PlanSelection; disruption?: PlanDisruption;
}): PlanProjection {
  const { memberId, scope, asOf, through, selection, disruption = {} } = input;
  const result: PlanProjection = { kind: "unavailable", selection: { kind: selection.kind, id: selection.id, scope, monthKey: selection.monthKey }, sourceRevision: h.revision,
    asOf, through, cashNowCents: null, bufferCents: 0, lines: [], movements: [], committedMovements: [], datedCapacity: [], lowPoint: null, firstExposed: null,
    uncommittedNowCents: null, everydayAllowanceCents: 0, everydayNowCents: null, everydayProjectedCents: null, assumptions: [], issues: [] };
  if (input.acceptedRevision !== h.revision) { result.issues.push("The accepted evidence changed. Refresh this comparison."); return result; }
  if (selection.scope !== scope || (selection.kind !== "version" || scope === "personal") && selection.ownerMemberId !== memberId) { result.issues.push("This Plan is outside the current member and ledger scope."); return result; }
  if (!isValidDateKey(asOf) || !isValidDateKey(through) || through < asOf || calendarDaysBetween(asOf, through) > 365) { result.issues.push("Choose a dated horizon of up to 366 days."); return result; }
  const movements: FundMovement[] = [];
  const sourceMeta = new Map<string, { recurrenceId: string | null; goalId: string | null; transactionId: string | null; categoryId?: string | null }>();
  if (scope === "household") {
    const horizon = prepareFundHorizon(h, asOf, through, { purpose: "plan" });
    if (horizon.kind === "unavailable") result.issues.push(...horizon.reasons.map(row => row.message));
    else {
      result.cashNowCents = horizon.anchorCents;
      result.bufferCents = horizon.monthlyBuffers[0]?.bufferCents ?? 0;
      result.assumptions.push(...horizon.assumptions);
      movements.push(...horizon.movements);
      let lastBuffer = result.bufferCents;
      for (const month of horizon.monthlyBuffers) {
        for (const row of monthObligations(h, month.monthKey, asOf).rows) sourceMeta.set(row.id, row);
        if (month.bufferCents !== lastBuffer) movements.push({ sourceId: `buffer:${month.monthKey}`, date: monthStartKey(month.monthKey), deltaCents: lastBuffer - month.bufferCents, label: "Fund buffer change", kind: "obligation", estimated: false, memberId: null });
        lastBuffer = month.bufferCents;
      }
    }
  } else {
    const accountIds = h.accounts.filter(row => row.active && row.scope === "personal" && row.ownerMemberId === memberId && isCashLikeKind(row.kind) && row.savings?.purpose !== "goals").map(row => row.id);
    if (!accountIds.length) result.issues.push("Identify your Personal cash accounts before estimating available coverage.");
    else { try { result.cashNowCents = walletForListedAccounts(h, accountIds, asOf).cashCents; } catch { result.issues.push("The accepted account books need review before estimating Personal capacity."); } }
    // Include operational standing orders even when the Plan has not linked them yet.
    for (const recurrence of h.recurrences.filter(row => row.active && row.type !== "income" && (accountIds.includes(row.accountId) || row.payments?.some(payment => accountIds.includes(payment.accountId))))) {
      if (recurrence.type === "transfer" && recurrence.transferToAccountId && accountIds.includes(recurrence.transferToAccountId)) continue;
      for (const date of [...new Set([...completePlanDates(recurrence.nextDate, recurrence.cadence, recurrence.nextDate, through), ...(recurrence.payments ?? []).map(row => row.occurrenceDate).filter(date => date <= through)])].sort()) {
        const completedPayments = recurrence.payments?.filter(row => row.occurrenceDate === date && row.paymentDate <= asOf) ?? [];
        const completed = date < recurrence.nextDate && completedPayments.length > 0;
        // A completed occurrence keeps its reviewed payment amount and account;
        // editing the next bill must not rewrite the earlier obligation.
        if (completed ? completedPayments.some(row => !accountIds.includes(row.accountId)) : !accountIds.includes(recurrence.accountId)) continue;
        const dueCents = completed ? completedPayments.reduce((sum, row) => sum + row.amountCents, 0) : recurrence.amountCents;
        const txById = new Map(h.transactions.filter(tx => tx.date <= asOf).map(tx => [tx.id, tx]));
        const paymentIds = new Set(recurrence.payments?.filter(row => row.occurrenceDate === date && row.paymentDate <= asOf).map(row => row.transactionId) ?? []);
        const paid = [...txById.values()].filter(tx => paymentIds.has(purchaseRoot(tx, txById).id) && projectedCountable(tx, txById)).reduce((sum, tx) => sum + (recurrence.type === "expense" ? projectedExpenseEffect(tx, txById) : tx.accountId === recurrence.accountId ? tx.amountCents * transactionProjection(tx, txById).multiplier : 0), 0);
        const sourceId = `recurrence:${recurrence.id}:${date}`;
        sourceMeta.set(sourceId, { recurrenceId: recurrence.id, goalId: recurrence.goalId, transactionId: null });
        movements.push({ sourceId, date: date < asOf ? asOf : date, deltaCents: -Math.max(0, dueCents - paid), label: recurrence.note || "Standing order", kind: "obligation", estimated: false, memberId: null });
      }
    }
    // Accepted future register entries are dated evidence, not today's cash.
    // Fold the canonical journal once: internal transfers net to zero here.
    try {
      const books = compileHousehold(h), txById = new Map(h.transactions.map(tx => [tx.id, tx]));
      for (const entry of books.entries.filter(row => row.recognized && row.date > asOf && row.date <= through)) {
        const deltaCents = entry.lines.filter(row => accountIds.includes(row.accountId)).reduce((sum, row) => sum + row.debitCents - row.creditCents, 0);
        if (!deltaCents) continue;
        const tx = entry.originTransactionIds.map(id => txById.get(id)).find(Boolean);
        if (!tx) { result.issues.push("A future cash entry needs its original receipt before coverage can be trusted."); continue; }
        const root = purchaseRoot(tx, txById);
        const recurrence = h.recurrences.find(row => row.id === root.sourceId && root.source === "recurring" || row.payments?.some(payment => entry.originTransactionIds.includes(payment.transactionId)));
        const payment = recurrence?.payments?.find(row => entry.originTransactionIds.includes(row.transactionId));
        const due = deltaCents < 0 && payment && payment.occurrenceDate < entry.date ? payment.occurrenceDate : entry.date;
        const date = due < asOf ? asOf : due;
        if (recurrence && deltaCents < 0) {
          const existing = movements.find(row => row.sourceId === `recurrence:${recurrence.id}:${payment?.occurrenceDate ?? root.date}`);
          if (existing) existing.deltaCents = Math.min(0, existing.deltaCents - deltaCents);
        }
        const sourceId = `accepted:${entry.id}`;
        const goal = h.goalContributions?.find(row => row.transferId && entry.originTransactionIds.includes(row.transferId));
        sourceMeta.set(sourceId, { recurrenceId: recurrence?.id ?? null, goalId: goal?.goalId ?? null, transactionId: root.id, categoryId: root.type === "expense" ? root.subcategoryId : null });
        movements.push({ sourceId, date, deltaCents, label: deltaCents < 0 ? "Reserved for a future dated payment" : "Future dated receipt", kind: deltaCents > 0 ? "contribution" : "obligation", estimated: false, memberId: null });
      }
    } catch { result.issues.push("The future account register needs review before estimating dated capacity."); }
    result.assumptions.push("Personal capacity uses your accepted cash accounts, excluding goal vaults. Unrecorded commitments remain unknown.");
  }
  // An explicit dated Plan inflow replaces, rather than adds to, a matching forecast.
  const inflowSources = new Set<string>();
  for (const assumption of selection.assumptions.filter(row => row.kind === "income")) {
    if (!assumption.expectedDate || !isValidDateKey(assumption.expectedDate) || assumption.expectedDate <= asOf || assumption.expectedDate > through) continue;
    const references = assumption.sourceReferences.filter(ref => planSourceVisible(h, ref, memberId, scope));
    if (!references.length || references.length !== assumption.sourceReferences.length || !Number.isSafeInteger(assumption.valueCents) || assumption.valueCents! < 0) { result.issues.push("An expected inflow needs a visible source, date and amount."); continue; }
    if (references.some(ref => inflowSources.has(`${ref.type}:${ref.id}:${assumption.expectedDate}`))) { result.issues.push("Two income assumptions use the same source. Review their attribution."); continue; }
    references.forEach(ref => inflowSources.add(`${ref.type}:${ref.id}:${assumption.expectedDate}`));
    if (scope === "personal" && !references.every(ref => ref.type === "recurrence" && h.recurrences.some(row => row.id === ref.id && row.type === "income"))) { result.issues.push("Personal expected money needs a visible income schedule."); continue; }
    if (scope === "household" && !references.every(ref => ref.type === "bridge" && h.planBridgeDecisions?.some(row => row.id === ref.id && row.kind === "contribution"))) { result.issues.push("Shared expected money must come from a deliberately shared contribution offer."); continue; }
    if (references.some(ref => ref.type === "recurrence" && movements.some(row => row.deltaCents > 0 && row.sourceId?.startsWith("accepted:") && sourceMeta.get(row.sourceId)?.recurrenceId === ref.id && row.date === assumption.expectedDate))) {
      result.assumptions.push("A dated income assumption already has an accepted future receipt; the receipt is counted once."); continue;
    }
    for (const ref of references) {
      const bridge = h.planBridgeDecisions?.find(row => row.id === ref.id);
      if (ref.type === "bridge" && bridge) for (let i = movements.length - 1; i >= 0; i--) if (movements[i]!.estimated && movements[i]!.memberId === bridge.offeredByMemberId && movements[i]!.sourceId?.startsWith("estimate:")) movements.splice(i, 1);
    }
    movements.push({ sourceId: `assumption:${assumption.id}`, date: assumption.expectedDate, deltaCents: assumption.valueCents!, label: "Expected contribution / income", kind: "contribution", estimated: true, memberId: null });
    result.assumptions.push(`Expected ${assumption.valueCents} cents on ${assumption.expectedDate}; ${assumption.confidence}; last reviewed ${assumption.observedAt.slice(0, 10)}.`);
  }
  const usedEvidence = new Set<string>(), usedSources = new Set<string>();
  const assigned = new Map<string, string>();
  const allTransactions = new Map(h.transactions.map(tx => [tx.id, tx]));
  // Specific obligations get first attribution; category pools receive the unmatched remainder.
  const orderedLines = [...selection.lines].sort((a, b) => Number(a.sourceReference?.type === "category") - Number(b.sourceReference?.type === "category") || a.id.localeCompare(b.id));
  for (const line of orderedLines) {
    const intendedCents = planIntendedCents(line, selection.monthKey);
    const issues: string[] = [];
    const source = line.sourceReference;
    const key = source ? `${source.type}:${source.id}` : "";
    const visible = source && planSourceVisible(h, source, memberId, scope);
    if (source?.type === "bridge") issues.push("A contribution offer is not a receipt; its completion needs explicit Fund evidence.");
    if (!visible) issues.push("Link visible evidence to turn this intention into supported coverage.");
    if (key && usedSources.has(key)) issues.push("This source already belongs to another Plan line. Combine or relink these intentions.");
    if (key) usedSources.add(key);
    let matched:PlanEvidence[]=[];
    try{matched=matchPlanEvidence(h, line, selection.monthKey, asOf, memberId, scope);}catch{issues.push("The bank’s receipt history needs review before its reserve can be used.");}
    const evidence = matched.filter(row => {
      if (usedEvidence.has(row.id)) return false;
      usedEvidence.add(row.id); return true;
    });
    const actualCents = evidence.filter(row => row.kind === "payment" || row.date.startsWith(selection.monthKey) && row.kind !== "goal-record").reduce((sum, row) => sum + row.amountCents, 0);
    const recordedProgressCents = evidence.filter(row => row.kind === "goal-record" || row.kind === "goal-funding").reduce((sum, row) => sum + row.amountCents, 0);
    const goal = source?.type === "goal" ? h.goals.find(row => row.id === source.id) : null;
    // Retired/purchased goals and unallocated releases cannot claim live reserves.
    const verifiedProgressCents = goal && goal.status !== "retired" && !goal.purchaseId ? Math.max(0, Math.min(goal.savedCents, evidence.filter(row => row.kind === "goal-funding" && !h.fundKittyAllocations?.some(allocation => allocation.id === row.id)).reduce((sum, row) => sum + (row.reserveCents ?? 0), 0)) + evidence.filter(row => row.kind === "goal-funding" && h.fundKittyAllocations?.some(allocation => allocation.id === row.id)).reduce((sum, row) => sum + (row.reserveCents ?? row.amountCents), 0)) : 0;
    const outcomeFulfilled = Boolean(goal?.purchaseId);
    let attributedUse=0;try{if(goal)attributedUse=goalEnvelopeUsedCents(h,goal.id,asOf);}catch{issues.push("Review the bank’s connected purchase and correction receipts.");}
    if (goal?.status === "retired" && !outcomeFulfilled) issues.push("This goal has been retired. Review whether to remove or replace this intention.");
    if (goal && goal.status !== "retired" && !outcomeFulfilled && recordedProgressCents > verifiedProgressCents + attributedUse + goalFundReserve(h, goal.id, asOf).releasedCents) issues.push("Some goal progress lacks current backing evidence; it is not available reserve money.");
    const remainingCents = outcomeFulfilled || goal?.status === "retired" ? 0 : Math.max(0, intendedCents - actualCents);
    const dueDate = line.dueDate && isValidDateKey(line.dueDate) ? line.dueDate : null;
    if (!dueDate) issues.push("Choose a contribution or payment date.");
    if (!line.decision?.funding && remainingCents > 0) issues.push("Identify available money or a dated expected inflow.");
    const row: PlanLineProjection = { line, intendedCents, actualCents, recordedProgressCents, verifiedProgressCents, outcomeFulfilled, remainingCents, coveredNowCents: 0, expectedCoverageCents: 0, gapCents: remainingCents, dueDate, evidence, issues,
      status: dueDate && dueDate > through ? "outside-horizon" : issues.length ? "intention" : (outcomeFulfilled || remainingCents === 0 && evidence.length) ? "completed" : "gap" };
    result.lines.push(row);
    if (dueDate && dueDate > through || outcomeFulfilled || goal?.status === "retired") continue;
    // Contribution promises are inflows to Shared, never a second cash reservation.
    if (scope === "household" && (source?.type === "bridge" || source?.type === "fund")) continue;
    const represented: Array<{ movement: FundMovement; remaining: number }> = [];
    for (const movement of movements) {
      if (movement.deltaCents >= 0 || !movement.sourceId || assigned.has(movement.sourceId)) continue;
      const meta = sourceMeta.get(movement.sourceId);
      const matches = source?.type === "recurrence" ? meta?.recurrenceId === source.id
        : source?.type === "goal" ? meta?.goalId === source.id
        : source?.type === "category" ? meta?.categoryId === source.id || meta?.recurrenceId && h.recurrences.some(recurrence => recurrence.id === meta.recurrenceId && recurrence.subcategoryId === source.id)
        : source?.type === "potential-expense" ? visible && meta?.transactionId && (() => {
          const linked = h.potentialExpenses?.find(item => item.id === source.id)?.transactionId;
          const transaction = allTransactions.get(meta.transactionId);
          return Boolean(linked && transaction && purchaseRoot(transaction, allTransactions).id === linked);
        })() : false;
      if (matches && movement.date.startsWith(selection.monthKey)) { assigned.set(movement.sourceId, line.id); represented.push({ movement, remaining: -movement.deltaCents }); }
    }
    const dates = line.cadence === "weekly"
      ? completePlanDates(line.dueDate ?? monthStartKey(selection.monthKey), "weekly", monthStartKey(selection.monthKey), monthEndKey(selection.monthKey))
      : ["prepare", "build"].includes(line.lens) && line.decision?.paydays?.some(day => day.startsWith(selection.monthKey))
        ? [...new Set(line.decision.paydays)].filter(day => day.startsWith(selection.monthKey)).sort()
        : [dueDate ?? monthEndKey(selection.monthKey)];
    const explicit = line.decision?.contributionSchedule?.filter(item => item.date.startsWith(selection.monthKey));
    const futurePaydays = !explicit?.length && ["prepare", "build"].includes(line.lens) && line.decision?.paydays?.length && dates.every(date => date > asOf);
    let consumed = futurePaydays ? 0 : Math.max(0, actualCents - (explicit?.length ? line.decision?.scheduleActualCents ?? 0 : 0));
    let undistributed = futurePaydays ? remainingCents : intendedCents + Math.max(0, -actualCents);
    const installment = Math.ceil(undistributed / Math.max(1, dates.length));
    const promises = explicit?.length ? explicit : dates.map(date => { const amountCents = Math.min(installment, undistributed); undistributed -= amountCents; return { date, amountCents }; });
    for (const [index, promise] of promises.entries()) {
      const date = promise.date < asOf ? asOf : promise.date;
      const used = Math.min(consumed, promise.amountCents); consumed -= used;
      let additional = promise.amountCents - used;
      // Match each economic cost once. A later payment must reserve capacity
      // at the earlier promise date, without creating a second future debit.
      for (const item of represented.sort((a, b) => a.movement.date.localeCompare(b.movement.date))) {
        const matched = Math.min(additional, item.remaining);
        if (!matched) continue;
        additional -= matched; item.remaining -= matched;
        if (item.movement.date > date) {
          const sourceId = `reservation:${line.id}:${index}:${item.movement.sourceId}`;
          item.movement.deltaCents += matched;
          assigned.set(sourceId, line.id);
          movements.push({ ...item.movement, sourceId, date, deltaCents: -matched,
            label: `${line.labelSnapshot} · reserved for payment ${item.movement.date}` });
        }
      }
      if (additional <= 0) continue;
      const sourceId = `plan:${line.id}:${index}`;
      assigned.set(sourceId, line.id);
      movements.push({ sourceId, date, deltaCents: -additional, label: line.labelSnapshot, kind: "obligation", estimated: false, memberId: null });
    }

  }
  if (disruption.extraCostCents && disruption.extraCostCents > 0 && Number.isSafeInteger(disruption.extraCostCents)) movements.push({ sourceId: "rehearsal:extra", date: disruption.extraCostDate ?? asOf, deltaCents: -disruption.extraCostCents, label: "Unexpected cost rehearsal", kind: "obligation", estimated: true, memberId: null });
  const adjusted = movements.map(row => {
    if (row.deltaCents > 0 && row.kind === "contribution") return { ...row, date: addDays(row.date, Math.max(0, Math.min(90, disruption.incomeDelayDays ?? 0))), deltaCents: Math.round(row.deltaCents * (1 - Math.max(0, Math.min(100, disruption.incomeReductionPercent ?? 0)) / 100)) };
    if (row.deltaCents < 0 && assigned.has(row.sourceId ?? "") && result.lines.some(line => line.line.id === assigned.get(row.sourceId!) && line.line.lens === "protect")) return { ...row, deltaCents: Math.round(row.deltaCents * (1 + Math.max(0, Math.min(100, disruption.expenseIncreasePercent ?? 0)) / 100)) };
    return row;
  }).filter(row => row.deltaCents !== 0 && row.date >= asOf && row.date <= through);
  if (result.cashNowCents === null) return result;
  const opening = result.cashNowCents - result.bufferCents;
  const folded = foldFundMovements(opening, adjusted);
  if (![opening, ...folded.points.map(row => row.balanceCents)].every(Number.isSafeInteger)) { result.issues.push("These amounts exceed the supported cent range."); return result; }
  result.kind = "ready";
  result.movements = adjusted;
  result.datedCapacity = [{ date: asOf, balanceCents: opening, sourceId: null, label: "Available after Fund buffer" }, ...folded.points];
  result.lowPoint = result.datedCapacity.reduce((low, row) => row.balanceCents < low.balanceCents ? { date: row.date, balanceCents: row.balanceCents } : low, { date: asOf, balanceCents: opening });
  if (opening < 0) result.firstExposed = { date: asOf, label: "Current commitments and buffer", gapCents: -opening };
  let now = Math.max(0, opening), expected = Math.min(0, opening);
  for (const movement of folded.points) {
    if (movement.deltaCents >= 0) { expected += movement.deltaCents; continue; }
    const demand = -movement.deltaCents;
    const current = Math.min(now, demand); now -= current;
    const future = Math.min(Math.max(0, expected), demand - current); expected -= demand - current;
    const line = result.lines.find(row => row.line.id === assigned.get(movement.sourceId ?? ""));
    if (line) { line.coveredNowCents += current; line.expectedCoverageCents += future; }
    if (current + future < demand && !result.firstExposed) result.firstExposed = { date: movement.date, label: movement.label, gapCents: demand - current - future };
  }
  for (const row of result.lines) {
    row.coveredNowCents = Math.min(row.remainingCents, row.coveredNowCents);
    row.expectedCoverageCents = Math.min(row.remainingCents - row.coveredNowCents, row.expectedCoverageCents);
    row.gapCents = Math.max(0, row.remainingCents - row.coveredNowCents - row.expectedCoverageCents);
    if (["intention", "outside-horizon", "completed"].includes(row.status)) continue;
    row.status = row.gapCents ? "gap" : row.expectedCoverageCents ? "depends-on-income" : "covered-now";
  }
  result.uncommittedNowCents = Math.max(0, opening - adjusted.reduce((sum, row) => sum + Math.max(0, -row.deltaCents), 0));
  const everyday = new Set(result.lines.filter(row => row.line.lens === "everyday").map(row => row.line.id));
  const essential = adjusted.filter(row => !row.sourceId?.startsWith("plan:") || !everyday.has(assigned.get(row.sourceId ?? "") ?? ""));
  const scheduledEveryday = essential.filter(row => everyday.has(assigned.get(row.sourceId ?? "") ?? "")).reduce((sum, row) => sum + Math.max(0, -row.deltaCents), 0);
  const allowance = Math.max(0, result.lines.filter(row => row.line.lens === "everyday").reduce((sum, row) => sum + row.remainingCents, 0) - scheduledEveryday);
  result.everydayAllowanceCents = allowance;
  result.committedMovements = essential;
  const essentialFold = foldFundMovements(opening, essential);
  result.everydayNowCents = Math.min(allowance, Math.max(0, opening - essential.reduce((sum, row) => sum + Math.max(0, -row.deltaCents), 0)));
  result.everydayProjectedCents = Math.min(allowance, Math.max(0, essentialFold.endBalanceCents));
  result.assumptions.push("Covered means allocated within this Plan using visible evidence. No bank money is frozen or transferred.", "The selected Plan month is projected once. Later operational commitments remain included; later Plan intentions must be reviewed separately.");
  return result;
}

export function preparePlanSchedule(line: PlanLine, projection: PlanLineProjection, asOf: DateKey) {
  const target = line.decision?.targetCents ?? line.amountCents;
  const remainingCents = projection.outcomeFulfilled ? 0 : Math.max(0, target - projection.verifiedProgressCents);
  const dates = [...new Set(line.decision?.paydays ?? [])].filter(day => day > asOf && (!line.decision?.deadline || day <= line.decision.deadline)).sort();
  const perPaydayCents = dates.length ? Math.ceil(remainingCents / dates.length) : null;
  return { targetCents: target, remainingCents, perPaydayCents, schedule: dates.map((date, index) => ({ date, amountCents: Math.min(perPaydayCents!, remainingCents - perPaydayCents! * index) })).filter(row => row.amountCents > 0) };
}

export function applyPlanSchedule(line: PlanLine, row: PlanLineProjection, asOf: DateKey, month: MonthKey): PlanLine {
  const { schedule } = preparePlanSchedule(line, row, asOf);
  const monthly = schedule.filter(item => item.date.startsWith(month));
  return { ...line, amountCents: Math.max(0, row.actualCents) + monthly.reduce((sum, item) => sum + item.amountCents, 0), cadence: "monthly", dueDate: monthly[0]?.date ?? line.dueDate,
    decision: { ...line.decision, paydays: schedule.map(item => item.date), contributionSchedule: monthly, scheduleActualCents: Math.max(0, row.actualCents) } };
}

export function rehearsePlanPurchase(projection: PlanProjection, amountCents: number, date: DateKey) {
  if (projection.kind !== "ready" || !Number.isSafeInteger(amountCents) || amountCents < 0 || date < projection.asOf || date > projection.through) return { kind: "unavailable" as const, reason: "Choose a valid amount and a date inside this comparison." };
  const opening = (projection.cashNowCents ?? 0) - projection.bufferCents;
  const withoutPurchase = foldFundMovements(opening, projection.committedMovements);
  const before = withoutPurchase.points.filter(row => row.date <= date).at(-1)?.balanceCents ?? opening;
  const futureFloor = Math.min(before, ...withoutPurchase.points.filter(row => row.date >= date).map(row => row.balanceCents));
  const allowance = projection.everydayAllowanceCents;
  const available = Math.max(0, Math.min(allowance, futureFloor));
  const unresolved = projection.issues.length > 0 || projection.lines.some(row => row.issues.length > 0 && row.status !== "outside-horizon");
  return { kind: "comparison" as const, fits: amountCents <= available && !unresolved, availableCents: available, afterCents: available - amountCents, changeNeededCents: Math.max(0, amountCents - available), dependsOnIncome: amountCents > (projection.everydayNowCents ?? 0), unresolved };
}
