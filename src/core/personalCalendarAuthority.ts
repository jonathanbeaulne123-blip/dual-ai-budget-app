import { refreshDuplicateFlags } from "./duplicate.ts";
import type { CommitResult, Household, PotentialExpensePlan } from "./types.ts";

const kinds = new Set(["addPotentialExpense", "updatePotentialExpense", "movePotentialExpense", "removePotentialExpense", "dismissPotentialExpenseNotice", "postPotentialExpense"]);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Allow one owned Calendar plan change, plus its explicitly reviewed private receipt. */
export function personalCalendarUpdateAllowed(current: Household, result: CommitResult, memberId: string): boolean {
  const next = result.household, kind = result.undo.commandKind ?? "";
  if (!kinds.has(kind) || result.persistenceScope !== "member-personal" || result.personalMemberId !== memberId
    || !current.members.some(member => member.id === memberId && member.active)) return false;
  const owns = (plan: PotentialExpensePlan) => plan.visibility === "personal" && plan.createdBy === memberId;
  if (new Set(next.potentialExpenses.map(row => row.id)).size !== next.potentialExpenses.length) return false;
  if (!same(current.potentialExpenses.filter(row => !owns(row)), next.potentialExpenses.filter(row => !owns(row)))) return false;
  if (current.potentialExpenses.some(row => !next.potentialExpenses.some(candidate => candidate.id === row.id))) return false;
  const changed = next.potentialExpenses.filter(row => !same(row, current.potentialExpenses.find(before => before.id === row.id)));
  if (changed.length !== 1 || !owns(changed[0]!)) return false;
  const plan = changed[0]!, before = current.potentialExpenses.find(row => row.id === plan.id);
  if (kind === "addPotentialExpense" ? Boolean(before) || plan.status !== "planned" : !before || !owns(before) || before.status !== "planned") return false;
  if (kind === "removePotentialExpense" ? plan.status !== "removed" : kind === "postPotentialExpense" ? plan.status !== "posted" : plan.status !== "planned") return false;
  const normalized = structuredClone(next);
  if (kind === "postPotentialExpense") {
    const added = next.transactions.filter(row => !current.transactions.some(before => before.id === row.id));
    if (added.length !== 1) return false;
    const tx = added[0]!;
    if (tx.visibility !== "personal" || tx.createdBy !== memberId || tx.type !== "expense" || tx.source !== "calendar"
      || tx.sourceId !== plan.id || tx.id !== plan.transactionId || !result.postedIds.includes(tx.id)) return false;
    if (!same(refreshDuplicateFlags([...current.transactions, tx]), next.transactions)) return false;
  } else if (!same(refreshDuplicateFlags(current.transactions), next.transactions)) return false;
  normalized.transactions = current.transactions;
  normalized.potentialExpenses = current.potentialExpenses;
  // Domain commit bookkeeping is derived, not an independent editable fact.
  normalized.activity = current.activity;
  normalized.lastCommittedAt = current.lastCommittedAt;
  return same(normalized, current);
}
